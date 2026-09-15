/**
 * @file storage.js
 * @description Persistence and offline progress calculation engine.
 * Serializes game state to localStorage and simulates excavation yields across offline duration.
 */

import { MINES } from './data/mines.js';
import { ORES } from './data/ores.js';
import { UPGRADES } from './data/upgrades.js';
import {
  gameState,
  calculateMinePower,
  addPlayerXp,
  getOreDefinition
} from './state.js';
import { STATIONS, getStation } from './stations.js';
import { activeMinerAgents } from './minerFSM.js';
import { rebirthState, initRebirthState } from './rebirth.js';
import { getActiveBounties, initBounties } from './commissions.js';
import { getHotmSaveData, initHotmState } from './hotm.js';

export const STORAGE_KEY = 'MINING_SIM_SAVE';
export const SAVE_VERSION = '2.2.0';
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // 8 hours maximum offline progress cap
const MIN_OFFLINE_THRESHOLD_SECONDS = 10; // Minimum duration to trigger offline progress dialog

// Fallback in-memory storage if localStorage is restricted
let memoryStorage = null;

/**
 * Safe wrapper to retrieve localStorage.
 */
function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (e) {
    // LocalStorage inaccessible (e.g. strict security sandboxes)
  }
  return {
    getItem: (key) => memoryStorage,
    setItem: (key, val) => { memoryStorage = val; },
    removeItem: (key) => { memoryStorage = null; }
  };
}

/**
 * Serializes gameState plus a lastSavedTimestamp into JSON and saves it under "MINING_SIM_SAVE".
 * @param {typeof gameState} state
 * @returns {boolean} Success status
 */
export function saveGame(state) {
  try {
    const storage = getStorage();
    const payload = {
      version: 1,
      saveVersion: SAVE_VERSION,
      lastSavedTimestamp: Date.now(),
      player: state.player,
      upgrades: state.upgrades,
      miners: state.miners,
      inventory: state.inventory,
      activeMines: state.activeMines,
      stations: STATIONS.map(s => ({
        id: s.id,
        level: s.level,
        unlocked: s.unlocked,
        currentHP: s.currentHP
      })),
      workerCount: activeMinerAgents.length,
      rebirth: {
        rebirthCount: rebirthState.rebirthCount,
        depthTier: rebirthState.depthTier
      },
      bounties: getActiveBounties(),
      hotm: getHotmSaveData()
    };

    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Failed to save game state to storage:', err);
    return false;
  }
}

/**
 * Deserializes save data, validates against missing keys, and populates gameState.
 * @returns {{ success: boolean, lastSavedTimestamp: number | null, saveFound: boolean }}
 */
export function loadGame() {
  try {
    const storage = getStorage();
    const rawData = storage.getItem(STORAGE_KEY);
    if (!rawData) {
      return { success: false, lastSavedTimestamp: null, saveFound: false };
    }

    const data = JSON.parse(rawData);
    if (!data || typeof data !== 'object') {
      return { success: false, lastSavedTimestamp: null, saveFound: false };
    }

    // Version migration: if save is from an older version, wipe stale testing save
    if (data.saveVersion !== SAVE_VERSION) {
      storage.removeItem(STORAGE_KEY);
      return { success: false, lastSavedTimestamp: null, saveFound: false };
    }

    // 1. Validate & populate player
    if (data.player && typeof data.player === 'object') {
      gameState.player.name = data.player.name || 'MinerGM';
      gameState.player.level = Math.max(1, Number(data.player.level) || 1);
      gameState.player.xp = Math.max(0, Number(data.player.xp) || 0);
      gameState.player.xpNeeded = Math.max(50, Number(data.player.xpNeeded) || 100);
      gameState.player.coins = Math.max(0, Number(data.player.coins) || 0);
      gameState.player.gems = Math.max(0, Number(data.player.gems) || 0);
      gameState.player.powder = Math.max(0, Number(data.player.powder) || 0);
    }

    // 2. Validate & populate upgrades
    if (data.upgrades && typeof data.upgrades === 'object') {
      UPGRADES.forEach(u => {
        gameState.upgrades[u.id] = Math.min(u.maxLevel, Math.max(0, Number(data.upgrades[u.id]) || 0));
      });
    }

    // 3. Validate & populate miners roster
    if (Array.isArray(data.miners) && data.miners.length > 0) {
      gameState.miners = data.miners.map(m => ({
        instanceId: String(m.instanceId),
        minerId: String(m.minerId),
        level: Math.max(1, Number(m.level) || 1),
        assignedMineId: m.assignedMineId ? String(m.assignedMineId) : null,
        assignedSlot: m.assignedSlot !== null && m.assignedSlot !== undefined ? Number(m.assignedSlot) : null
      }));
    }

    // 4. Validate & populate inventory (clamped to maxStorage cap)
    if (data.inventory && typeof data.inventory === 'object') {
      const maxStore = data.maxStorage || gameState.maxStorage || 20;
      let totalLoaded = 0;
      ORES.forEach(ore => {
        const count = Math.max(0, Number(data.inventory[ore.id]) || 0);
        const allowed = Math.max(0, Math.min(count, maxStore - totalLoaded));
        gameState.inventory[ore.id] = allowed;
        totalLoaded += allowed;
      });
    }

    // 5. Validate & populate active mines
    if (data.activeMines && typeof data.activeMines === 'object') {
      MINES.forEach(mine => {
        const savedMine = data.activeMines[mine.id];
        if (savedMine) {
          gameState.activeMines[mine.id] = {
            isMining: Boolean(savedMine.isMining),
            currentDurability: Number(savedMine.currentDurability) || mine.totalDurability,
            totalDurability: mine.totalDurability,
            assignedMiners: Array.isArray(savedMine.assignedMiners)
              ? savedMine.assignedMiners.slice(0, mine.maxSlots)
              : new Array(mine.maxSlots).fill(null)
          };
        } else {
          gameState.activeMines[mine.id] = {
            isMining: false,
            currentDurability: mine.totalDurability,
            totalDurability: mine.totalDurability,
            assignedMiners: new Array(mine.maxSlots).fill(null)
          };
        }
      });
    }

    // 6. Validate & populate stations
    if (Array.isArray(data.stations)) {
      data.stations.forEach(saved => {
        const station = getStation(saved.id);
        if (station) {
          station.level = Math.max(1, Number(saved.level) || 1);
          station.unlocked = Boolean(saved.unlocked);
          if (saved.currentHP !== undefined) {
            station.currentHP = Number(saved.currentHP) || station.maxHP;
          }
        }
      });
    }

    // 7. Validate & populate rebirth state
    if (data.rebirth && typeof data.rebirth === 'object') {
      initRebirthState(data.rebirth);
    } else {
      initRebirthState({ rebirthCount: 0, depthTier: 1 });
    }

    // 8. Validate & populate commissions / bounties
    if (Array.isArray(data.bounties) && data.bounties.length > 0) {
      initBounties(data.bounties);
    } else {
      initBounties();
    }

    // 9. Validate & populate Heart of the Mountain (HOTM) perks
    if (data.hotm && typeof data.hotm === 'object') {
      initHotmState(data.hotm);
    } else {
      initHotmState({});
    }

    return {
      success: true,
      lastSavedTimestamp: Number(data.lastSavedTimestamp) || null,
      saveFound: true,
      workerCount: Math.max(1, Number(data.workerCount) || 1)
    };
  } catch (err) {
    console.error('Failed to parse saved game data:', err);
    return { success: false, lastSavedTimestamp: null, saveFound: false };
  }
}

/**
 * Formats a duration in seconds into a friendly human-readable time string.
 * @param {number} totalSeconds
 * @returns {string} e.g. "2 hours 15 mins" or "45 mins" or "20 secs"
 */
export function formatOfflineTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || (hours === 0 && minutes < 5)) parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Rolls an ore reward from a mine's weighted drop table.
 * @param {readonly import('./data/mines.js').OreDropEntry[]} dropTable
 * @returns {string} Won oreId
 */
function rollDropTable(dropTable) {
  const totalWeight = dropTable.reduce((sum, entry) => sum + entry.dropChance, 0);
  let randomVal = Math.random() * totalWeight;

  for (const entry of dropTable) {
    if (randomVal <= entry.dropChance) {
      return entry.oreId;
    }
    randomVal -= entry.dropChance;
  }

  return dropTable[0].oreId;
}

/**
 * Simulates excavation progress accumulated while the player was away.
 * Clamps to 8 hours max, rolls drop tables, applies double drops,
 * adds earnings to state, and returns a summary.
 *
 * @param {typeof gameState} state
 * @param {number} lastSavedTimestamp
 * @returns {{ totalCoins: number, oresGained: Record<string, number>, timeElapsed: string, offlineSeconds: number, totalXp: number, cyclesCompleted: number } | null}
 */
export function calculateOfflineProgress(state, lastSavedTimestamp) {
  if (!lastSavedTimestamp) return null;

  const rawSeconds = (Date.now() - lastSavedTimestamp) / 1000;
  if (rawSeconds < MIN_OFFLINE_THRESHOLD_SECONDS) {
    return null; // Ignore trivial reload durations under 10 seconds
  }

  const offlineSeconds = Math.min(rawSeconds, MAX_OFFLINE_SECONDS);
  const timeElapsed = formatOfflineTime(offlineSeconds);

  let totalCoinsEarned = 0;
  let totalXpEarned = 0;
  let totalCycles = 0;
  /** @type {Record<string, number>} */
  const oresGained = {};

  // Check Ore Multiplier upgrade for double drops
  const oreMultDef = UPGRADES.find(u => u.id === 'ore_multiplier');
  const oreMultLevel = state.upgrades ? (state.upgrades.ore_multiplier || 0) : 0;
  const doubleDropChance = oreMultDef ? oreMultDef.effectFormula(oreMultLevel) : 0;

  for (const mine of MINES) {
    const mineState = state.activeMines[mine.id];
    if (!mineState || !mineState.isMining) continue;

    const power = calculateMinePower(mine.id);
    if (power <= 0) continue;

    const totalDamageOutput = power * offlineSeconds;
    const currentDur = mineState.currentDurability;

    if (totalDamageOutput >= currentDur) {
      // Completed at least one excavation cycle
      const cycles = 1 + Math.floor((totalDamageOutput - currentDur) / mine.totalDurability);
      const remainingDamage = (totalDamageOutput - currentDur) % mine.totalDurability;
      mineState.currentDurability = mine.totalDurability - remainingDamage;
      totalCycles += cycles;

      const baseXP = Math.max(5, Math.round(mine.totalDurability / 15));
      const coinBonus = Math.round(mine.requiredLevel * 2);

      // Simulate cycle drops
      for (let i = 0; i < cycles; i++) {
        const wonOreId = rollDropTable(mine.oreDropTable);
        const ore = getOreDefinition(wonOreId);
        const isDouble = Math.random() < doubleDropChance;
        const oreCount = isDouble ? 2 : 1;

        oresGained[wonOreId] = (oresGained[wonOreId] || 0) + oreCount;
        state.inventory[wonOreId] = (state.inventory[wonOreId] || 0) + oreCount;

        const cycleCoin = ((ore ? ore.sellValue : 1) * oreCount) + coinBonus;
        totalCoinsEarned += cycleCoin;
        totalXpEarned += baseXP;
      }
    } else {
      // Partial cycle, didn't complete a full durability bar
      mineState.currentDurability -= totalDamageOutput;
    }
  }

  // Credit player with accumulated coins & XP
  if (totalCoinsEarned > 0) {
    state.player.coins += totalCoinsEarned;
  }
  if (totalXpEarned > 0) {
    addPlayerXp(totalXpEarned);
  }

  // If no mines were active or zero cycles completed, return null
  if (totalCycles === 0 && totalCoinsEarned === 0) {
    return null;
  }

  return {
    totalCoins: totalCoinsEarned,
    oresGained,
    timeElapsed,
    offlineSeconds,
    totalXp: totalXpEarned,
    cyclesCompleted: totalCycles
  };
}

/**
 * Initializes auto-save interval and beforeunload window listeners.
 * @param {() => typeof gameState} getState
 * @param {number} [intervalMs=10000]
 * @returns {() => void} Teardown cleaner function
 */
export function setupAutoSave(getState, intervalMs = 10000) {
  // 1. Regular 10-second auto-save interval
  const timer = setInterval(() => {
    saveGame(getState());
  }, intervalMs);

  // 2. Immediate save on tab close / reload / navigation
  const onBeforeUnload = () => {
    saveGame(getState());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  return () => {
    clearInterval(timer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
  };
}

/**
 * Hard resets the saved game state, wiping localStorage and refreshing the window.
 */
export function resetSave() {
  const storage = getStorage();
  storage.removeItem(STORAGE_KEY);
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload();
  }
}


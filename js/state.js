/**
 * @file state.js
 * @description Centralized reactive game state manager for the idle mining simulator.
 * Coordinates player progression, owned miners roster, inventory, upgrades, and mine operations.
 */

import { MINES } from './data/mines.js';
import { MINERS } from './data/miners.js';
import { ORES } from './data/ores.js';
import { UPGRADES } from './data/upgrades.js';

/**
 * @typedef {Object} MinerInstance
 * @property {string} instanceId - Unique runtime ID for this specific miner.
 * @property {string} minerId - Key referencing the MINERS catalog.
 * @property {number} level - Miner unit upgrade level.
 * @property {string | null} assignedMineId - Mine ID if currently assigned, else null.
 * @property {number | null} assignedSlot - Slot index (0-3) if assigned, else null.
 */

/**
 * Primary Game State Object
 */
export const gameState = {
  player: {
    name: 'MinerGM',
    level: 1,
    xp: 0,
    xpNeeded: 100,
    coins: 100,
    gems: 5
  },

  /**
   * Adds coins to the player's balance and returns the new total.
   * @param {number} amount
   * @returns {number}
   */
  addCoins(amount) {
    this.player.coins += Math.max(0, amount);
    return this.player.coins;
  },


  /** @type {Record<string, number>} */
  upgrades: {
    pickaxe_sharpness: 0,
    ore_multiplier: 0,
    depth_scanner: 0
  },

  /** @type {MinerInstance[]} */
  miners: [],

  /** @type {Record<string, number>} */
  inventory: {
    dirt: 0,
    stone: 0,
    copper: 0,
    iron: 0,
    gold: 0,
    diamond: 0
  },

  /**
   * @type {Record<string, {
   *   isMining: boolean,
   *   currentDurability: number,
   *   totalDurability: number,
   *   assignedMiners: (string | null)[]
   * }>}
   */
  activeMines: {}
};

/**
 * Computes the effective player level threshold for unlocking a mine,
 * considering Depth Scanner upgrade reductions.
 * @param {import('./data/mines.js').Mine} mine
 * @returns {number}
 */
export function getEffectiveRequiredLevel(mine) {
  const scannerDef = UPGRADES.find(u => u.id === 'depth_scanner');
  const scannerLevel = gameState.upgrades ? (gameState.upgrades.depth_scanner || 0) : 0;
  const reduction = scannerDef ? scannerDef.effectFormula(scannerLevel) : 0;
  return Math.max(1, mine.requiredLevel - reduction);
}

/**
 * Initializes game state with starter progression & equipment.
 * Starter equipment: 1 Novice Digger miner, Surface Trench unlocked.
 */
export function initStarterState() {
  gameState.upgrades = {
    pickaxe_sharpness: 0,
    ore_multiplier: 0,
    depth_scanner: 0
  };

  // Initialize mines from MINES data catalog
  MINES.forEach(mine => {
    gameState.activeMines[mine.id] = {
      isMining: false,
      currentDurability: mine.totalDurability,
      totalDurability: mine.totalDurability,
      assignedMiners: new Array(mine.maxSlots).fill(null)
    };
  });

  // Grant starter equipment: 1 Novice Digger
  const starterInstanceId = 'miner_' + Date.now() + '_1';
  gameState.miners = [
    {
      instanceId: starterInstanceId,
      minerId: 'novice_digger',
      level: 1,
      assignedMineId: null,
      assignedSlot: null
    }
  ];

  // Auto-assign starter miner to first slot of Surface Trench for immediate action
  const surfaceMine = gameState.activeMines['surface_trench'];
  if (surfaceMine) {
    surfaceMine.assignedMiners[0] = starterInstanceId;
    gameState.miners[0].assignedMineId = 'surface_trench';
    gameState.miners[0].assignedSlot = 0;
    surfaceMine.isMining = true; // Start excavating
  }

  return gameState;
}

/**
 * Retrieves miner definition metadata from MINERS catalog.
 * @param {string} minerId
 * @returns {import('./data/miners.js').Miner | undefined}
 */
export function getMinerDefinition(minerId) {
  return MINERS.find(m => m.id === minerId);
}

/**
 * Retrieves ore definition metadata from ORES catalog.
 * @param {string} oreId
 * @returns {import('./data/ores.js').Ore | undefined}
 */
export function getOreDefinition(oreId) {
  return ORES.find(o => o.id === oreId);
}

/**
 * Retrieves list of all miners not currently deployed to any mine slot.
 * @returns {MinerInstance[]}
 */
export function getUnassignedMiners() {
  return gameState.miners.filter(m => m.assignedMineId === null);
}

/**
 * Assigns an unassigned miner to a specific mine slot.
 * @param {string} mineId
 * @param {number} slotIndex
 * @param {string} instanceId
 * @returns {boolean} Success status
 */
export function assignMinerToMine(mineId, slotIndex, instanceId) {
  const mineState = gameState.activeMines[mineId];
  if (!mineState || slotIndex < 0 || slotIndex >= mineState.assignedMiners.length) {
    return false;
  }

  const miner = gameState.miners.find(m => m.instanceId === instanceId);
  if (!miner) return false;

  // Unassign from old position if assigned elsewhere
  if (miner.assignedMineId !== null && miner.assignedSlot !== null) {
    const oldMine = gameState.activeMines[miner.assignedMineId];
    if (oldMine) {
      oldMine.assignedMiners[miner.assignedSlot] = null;
    }
  }

  // If slot already had a miner, unassign them
  const existingInstanceId = mineState.assignedMiners[slotIndex];
  if (existingInstanceId) {
    const existing = gameState.miners.find(m => m.instanceId === existingInstanceId);
    if (existing) {
      existing.assignedMineId = null;
      existing.assignedSlot = null;
    }
  }

  // Place new miner
  mineState.assignedMiners[slotIndex] = instanceId;
  miner.assignedMineId = mineId;
  miner.assignedSlot = slotIndex;

  return true;
}

/**
 * Removes a miner from a specified slot in a mine.
 * @param {string} mineId
 * @param {number} slotIndex
 * @returns {boolean}
 */
export function removeMinerFromMine(mineId, slotIndex) {
  const mineState = gameState.activeMines[mineId];
  if (!mineState) return false;

  const instanceId = mineState.assignedMiners[slotIndex];
  if (!instanceId) return false;

  const miner = gameState.miners.find(m => m.instanceId === instanceId);
  if (miner) {
    miner.assignedMineId = null;
    miner.assignedSlot = null;
  }

  mineState.assignedMiners[slotIndex] = null;

  // If no miners left in mine, automatically stop mining
  const hasMiners = mineState.assignedMiners.some(id => id !== null);
  if (!hasMiners) {
    mineState.isMining = false;
  }

  return true;
}

/**
 * Toggles the active mining state of a mine.
 * @param {string} mineId
 * @returns {boolean} New mining state
 */
export function toggleMiningState(mineId) {
  const mineState = gameState.activeMines[mineId];
  if (!mineState) return false;

  // Cannot start mining if no miners are assigned
  const hasMiners = mineState.assignedMiners.some(id => id !== null);
  if (!hasMiners && !mineState.isMining) {
    return false;
  }

  mineState.isMining = !mineState.isMining;
  return mineState.isMining;
}

/**
 * Calculates the combined mining power for a given mine,
 * incorporating Pickaxe Sharpness upgrade bonuses.
 * @param {string} mineId
 * @returns {number}
 */
export function calculateMinePower(mineId) {
  const mineState = gameState.activeMines[mineId];
  if (!mineState) return 0;

  let basePower = 0;
  for (const instanceId of mineState.assignedMiners) {
    if (instanceId) {
      const miner = gameState.miners.find(m => m.instanceId === instanceId);
      if (miner) {
        const def = getMinerDefinition(miner.minerId);
        if (def) {
          basePower += def.miningPower * (1 + (miner.level - 1) * 0.25);
        }
      }
    }
  }

  // Apply Pickaxe Sharpness multiplier
  const sharpnessDef = UPGRADES.find(u => u.id === 'pickaxe_sharpness');
  const sharpnessLevel = gameState.upgrades ? (gameState.upgrades.pickaxe_sharpness || 0) : 0;
  const sharpnessMultiplier = sharpnessDef ? sharpnessDef.effectFormula(sharpnessLevel) : 1;

  return Math.round(basePower * sharpnessMultiplier);
}

/**
 * Adds experience to the player and handles leveling up.
 * @param {number} amount
 * @returns {boolean} True if leveled up
 */
export function addPlayerXp(amount) {
  gameState.player.xp += amount;
  let leveledUp = false;

  while (gameState.player.xp >= gameState.player.xpNeeded) {
    gameState.player.xp -= gameState.player.xpNeeded;
    gameState.player.level += 1;
    gameState.player.xpNeeded = Math.round(gameState.player.xpNeeded * 1.5);
    leveledUp = true;
  }

  return leveledUp;
}

/**
 * Awards mined ore, coins, and XP to the player,
 * with chance of double drops from Ore Multiplier upgrade.
 * @param {string} oreId
 * @param {number} count
 * @param {number} xpAmount
 * @param {number} coinBonus
 */
export function grantMiningReward(oreId, count, xpAmount, coinBonus = 0) {
  // Check for Ore Multiplier double yield
  const oreMultDef = UPGRADES.find(u => u.id === 'ore_multiplier');
  const oreMultLevel = gameState.upgrades ? (gameState.upgrades.ore_multiplier || 0) : 0;
  const doubleChance = oreMultDef ? oreMultDef.effectFormula(oreMultLevel) : 0;
  const finalCount = Math.random() < doubleChance ? count * 2 : count;

  if (gameState.inventory[oreId] !== undefined) {
    gameState.inventory[oreId] += finalCount;
  }

  const ore = getOreDefinition(oreId);
  const coinYield = (ore ? ore.sellValue : 1) * finalCount + coinBonus;
  gameState.player.coins += coinYield;

  const leveledUp = addPlayerXp(xpAmount);
  return { ore, finalCount, coinYield, leveledUp };
}

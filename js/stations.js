/**
 * @file stations.js
 * @description Station upgrading, unlocking, and economic scaling engine
 * for the 2D idle mining tycoon simulator.
 */

import { gameState } from './state.js';
import { spawnMinerAgent, activeMinerAgents } from './minerFSM.js';
import { getGlobalEarningsMultiplier } from './rebirth.js';
import { onGameEvent } from './commissions.js';

/**
 * @typedef {Object} MiningStation
 * @property {string} id - Station identifier ('station-1', 'station-2', 'station-3').
 * @property {string} key - Logical identifier key ('dirt_node', 'copper_node', 'gold_node').
 * @property {string} name - Display title.
 * @property {string} oreId - Key matching the ORES catalog.
 * @property {number} baseCost - Initial base upgrade price.
 * @property {number} unlockCost - Coins needed to unlock (0 if unlocked by default).
 * @property {number} baseOreValue - Base coin yield per harvested ore.
 * @property {number} maxHP - Hit points required to complete one excavation cycle.
 * @property {number} currentHP - Active remaining hit points.
 * @property {number} workerSlots - Maximum recommended worker capacity.
 * @property {number} level - Current station upgrade tier (default 1).
 * @property {boolean} unlocked - Whether station is open for excavation.
 * @property {number} workerSpotX - Default worker coordinate X on mine stage.
 * @property {number} workerSpotY - Default worker coordinate Y on mine stage.
 */

/**
 * Dynamic slot calculation per station based on level:
 * - Level 1 to 9: 1 Worker Slot
 * - Level 10 to 24: 2 Worker Slots (Milestone unlock!)
 * - Level 25+: 3 Worker Slots (Milestone unlock!)
 * @param {MiningStation | number} stationOrLevel
 * @returns {number}
 */
export function getStationSlots(stationOrLevel) {
  const level = typeof stationOrLevel === 'number' ? stationOrLevel : (stationOrLevel?.level || 1);
  if (level >= 25) return 3;
  if (level >= 10) return 2;
  return 1;
}

/**
 * Returns the sum of available worker slots across all UNLOCKED stations.
 * Starts at 1, maxes out at 9 when all 3 stations reach Lv 25.
 * @returns {number}
 */
export function getTotalMaxSlots() {
  const unlocked = STATIONS.filter(s => s.unlocked || s.isUnlocked);
  return unlocked.reduce((sum, s) => sum + getStationSlots(s.level), 0);
}

/**
 * Active collection of progressive mining stations.
 * Baseline durabilities tuned for 11-13 minute Biome progression.
 * @type {MiningStation[]}
 */
export const STATIONS = [
  {
    id: 'station-1',
    key: 'dirt_node',
    name: 'Dirt & Coal Node',
    oreId: 'dirt',
    baseCost: 10,
    unlockCost: 0,
    baseOreValue: 1,
    maxHP: 15,
    currentHP: 15,
    get workerSlots() { return getStationSlots(this.level); },
    set workerSlots(v) {},
    level: 1,
    unlocked: true,
    workerSpotX: 180,
    workerSpotY: 156,
    get totalDurability() { return this.maxHP; },
    set totalDurability(v) { this.maxHP = v; },
    get currentDurability() { return this.currentHP; },
    set currentDurability(v) { this.currentHP = v; },
    get isUnlocked() { return this.unlocked; },
    set isUnlocked(v) { this.unlocked = v; }
  },
  {
    id: 'station-2',
    key: 'copper_node',
    name: 'Copper Node',
    oreId: 'copper',
    baseCost: 35,
    unlockCost: 280,
    baseOreValue: 5,
    maxHP: 45,
    currentHP: 45,
    get workerSlots() { return getStationSlots(this.level); },
    set workerSlots(v) {},
    level: 1,
    unlocked: false,
    workerSpotX: 180,
    workerSpotY: 260,
    get totalDurability() { return this.maxHP; },
    set totalDurability(v) { this.maxHP = v; },
    get currentDurability() { return this.currentHP; },
    set currentDurability(v) { this.currentHP = v; },
    get isUnlocked() { return this.unlocked; },
    set isUnlocked(v) { this.unlocked = v; }
  },
  {
    id: 'station-3',
    key: 'gold_node',
    name: 'Gold Node',
    oreId: 'gold',
    baseCost: 180,
    unlockCost: 2200,
    baseOreValue: 24,
    maxHP: 110,
    currentHP: 110,
    get workerSlots() { return getStationSlots(this.level); },
    set workerSlots(v) {},
    level: 1,
    unlocked: false,
    workerSpotX: 180,
    workerSpotY: 366,
    get totalDurability() { return this.maxHP; },
    set totalDurability(v) { this.maxHP = v; },
    get currentDurability() { return this.currentHP; },
    set currentDurability(v) { this.currentHP = v; },
    get isUnlocked() { return this.unlocked; },
    set isUnlocked(v) { this.unlocked = v; }
  }
];

/**
 * Calculates the exponential upgrade cost for a station at its current tier.
 * Formula: Math.floor(baseCost * Math.pow(1.11, level))
 * @param {MiningStation} station
 * @returns {number}
 */
export function getStationUpgradeCost(station) {
  return Math.floor(station.baseCost * Math.pow(1.11, station.level));
}

/**
 * Calculates the ore sell value based on station level.
 * Formula: Math.max(1, Math.round(station.baseOreValue * station.level))
 * @param {MiningStation} station
 * @returns {number}
 */
export function getStationOreValue(station) {
  const rebirthMult = getGlobalEarningsMultiplier();
  return Math.max(1, Math.round(station.baseOreValue * station.level * rebirthMult));
}


/**
 * Finds a station by its DOM element ID or logical key.
 * @param {string} stationId
 * @returns {MiningStation | undefined}
 */
export function getStation(stationId) {
  return STATIONS.find(s => s.id === stationId || s.key === stationId);
}

/**
 * Retrieves all registered stations.
 * @returns {MiningStation[]}
 */
export function getStations() {
  return STATIONS;
}

/**
 * Unlocks a station, deducts coins, and marks it available for autonomous miners.
 * @param {string} stationId
 * @returns {{ success: boolean, station?: MiningStation, cost?: number, reason?: string }}
 */
export function unlockStation(stationId) {
  const station = getStation(stationId);
  if (!station) {
    return { success: false, reason: 'Station not found.' };
  }

  if (station.unlocked) {
    return { success: false, reason: 'Station is already unlocked.' };
  }

  const cost = station.unlockCost;
  if (gameState.player.coins < cost) {
    return { success: false, cost, reason: `Requires ${Math.floor(cost).toLocaleString()} coins.` };
  }

  // Deduct coins & mark unlocked
  gameState.player.coins -= cost;
  station.unlocked = true;

  // Update DOM representation
  if (typeof document !== 'undefined') {
    const el = document.getElementById(station.id);
    if (el) {
      el.classList.remove('station-locked');
      el.classList.add('station-unlocked');

      const nextUpgradeCost = getStationUpgradeCost(station);
      const actionsCol = el.querySelector('.station-actions-col');
      if (actionsCol) {
        actionsCol.innerHTML = `
          <button type="button" class="btn-station-upgrade" id="upgrade-btn-${station.id}" data-action="upgrade-station" data-station="${station.id}">
            <div class="upgrade-btn-main">
              <span class="upgrade-action-text">Level Up</span>
              <span class="upgrade-level-badge" id="level-badge-${station.id}">Lv. ${station.level}</span>
            </div>
            <div class="upgrade-cost-tag">
              <span class="cost-coin-icon">🪙</span>
              <span class="cost-amount" id="cost-${station.id}">${Math.floor(nextUpgradeCost).toLocaleString()}</span>
            </div>
          </button>
        `;
      }
    }
  }

  return { success: true, station, cost };
}

/**
 * Upgrades a station by one level, deducting coins and updating DOM.
 *
 * @param {string} stationId
 * @returns {{ success: boolean, station?: MiningStation, newLevel?: number, cost?: number, reason?: string }}
 */
export function upgradeStation(stationId) {
  const station = getStation(stationId);
  if (!station) {
    return { success: false, reason: 'Station not found.' };
  }

  if (!station.unlocked) {
    return { success: false, reason: 'Station must be unlocked before upgrading.' };
  }

  const cost = getStationUpgradeCost(station);

  if (gameState.player.coins < cost) {
    return { success: false, cost, reason: `Requires ${Math.floor(cost).toLocaleString()} coins.` };
  }

  // Deduct coins & increment level
  gameState.player.coins -= cost;
  station.level += 1;

  // Dispatch King's Bounty event for station upgrades
  onGameEvent('UPGRADE_STATIONS', { stationId, levelsBought: 1 });

  // Update DOM visuals
  if (typeof document !== 'undefined') {
    const badgeEl = document.getElementById(`level-badge-${station.id}`);
    const costEl = document.getElementById(`cost-${station.id}`);
    const nextCost = getStationUpgradeCost(station);

    if (badgeEl) {
      badgeEl.textContent = `Lv. ${station.level}`;
    }
    if (costEl) {
      costEl.textContent = Math.floor(nextCost).toLocaleString();
    }

    if (typeof window !== 'undefined') {
      if (typeof window.updateStationDigSlotsUI === 'function') {
        window.updateStationDigSlotsUI(station);
      }
    }
  }

  return {
    success: true,
    station,
    newLevel: station.level,
    cost
  };
}

/**
 * Calculates maximum worker cap based on the total worker slots of all currently unlocked stations.
 * Dynamic worktop expansion: Lv 1-9 = 1 slot, Lv 10-24 = 2 slots, Lv 25+ = 3 slots (Max 9 workers total).
 * @returns {number}
 */
export function getMaxWorkers() {
  return getTotalMaxSlots();
}

/**
 * Calibrated Worker Hiring Costs
 * Worker 1: Free starter (0)
 * Worker 2: 60 coins
 * Worker 3: 320 coins
 * Worker 4: 1,200 coins
 * Worker 5: 4,500 coins
 * Worker 6+: Math.floor(8000 * Math.pow(1.8, count - 5))
 */
export const WORKER_HIRE_COSTS = [
  0,
  60,
  320,
  1200,
  4500,
  8000,
  14400,
  25920,
  46656
];

/**
 * Calculates hiring cost for an additional autonomous miner.
 * @param {number} [workerIndex]
 * @returns {number}
 */
export function getHireMinerCost(workerIndex = activeMinerAgents.length) {
  const count = typeof workerIndex === 'number' ? workerIndex : activeMinerAgents.length;
  const baseList = [0, 60, 320, 1200, 4500];
  if (count < baseList.length) {
    return baseList[count];
  }
  return Math.floor(8000 * Math.pow(1.8, count - 5));
}

/**
 * Spawns an additional MinerAgent to increase total mine throughput.
 * @returns {{ success: boolean, cost?: number, miner?: any, reason?: string }}
 */
export function hireExtraMiner() {
  const maxWorkers = getTotalMaxSlots();
  if (activeMinerAgents.length >= maxWorkers) {
    return {
      success: false,
      reason: 'Slots Full (Reach Lv 10/25)'
    };
  }

  const cost = getHireMinerCost();
  if (gameState.player.coins < cost) {
    return { success: false, cost, reason: `Requires ${formatNumber(cost)} coins to recruit worker.` };
  }

  // Deduct hiring coins
  gameState.player.coins -= cost;

  const avatars = ['👷‍♂️', '🧌', '🤖', '⚒️', '🧑‍🚀'];
  const names = ['Quarry Mason', 'Tunnel Runner', 'Steam Driller', 'Cyber Sifter', 'Core Specialist'];
  const index = activeMinerAgents.length;
  const avatar = avatars[index % avatars.length];
  const name = names[index % names.length];

  const miner = spawnMinerAgent({
    id: `worker_${Date.now()}`,
    name,
    avatar,
    miningPower: 10 + (index * 2),
    moveSpeed: 90,
    backpackCapacity: 4,
    startX: 75,
    startY: 45
  });

  // Update status badge with new worker count
  if (typeof document !== 'undefined') {
    const statusCount = document.getElementById('mines-status-count');
    if (statusCount) {
      statusCount.textContent = `${STATIONS.length} Stations • ${activeMinerAgents.length} Workers`;
    }
  }

  return { success: true, cost, miner };
}

/**
 * Synchronizes the DOM representation for all stations according to their
 * current runtime state (levels, unlocked statuses, upgrade costs, and HP bars).
 */
export function syncStationsDOM() {
  if (typeof document === 'undefined') return;

  // Update worker & station count
  const countEl = document.getElementById('mines-status-count');
  if (countEl) {
    countEl.textContent = `${STATIONS.length} Stations • ${activeMinerAgents.length} Workers`;
  }

  for (const station of STATIONS) {
    const el = document.getElementById(station.id);
    if (!el) continue;

    if (station.unlocked) {
      el.classList.remove('station-locked');
      el.classList.add('station-unlocked');

      const nextCost = getStationUpgradeCost(station);
      const actionsCol = el.querySelector('.station-actions-col');
      if (actionsCol) {
        actionsCol.innerHTML = `
          <button type="button" class="btn-station-upgrade" id="upgrade-btn-${station.id}" data-action="upgrade-station" data-station="${station.id}">
            <div class="upgrade-btn-main">
              <span class="upgrade-action-text">Level Up</span>
              <span class="upgrade-level-badge" id="level-badge-${station.id}">Lv. ${station.level}</span>
            </div>
            <div class="upgrade-cost-tag">
              <span class="cost-coin-icon">🪙</span>
              <span class="cost-amount" id="cost-${station.id}">${Math.floor(nextCost).toLocaleString()}</span>
            </div>
          </button>
        `;
      }
    } else {
      el.classList.add('station-locked');
      el.classList.remove('station-unlocked');
    }

    // Update HP bar & text
    const fillEl = document.getElementById(`hp-fill-${station.id}`);
    const textEl = document.getElementById(`hp-text-${station.id}`);
    if (fillEl) {
      const pct = Math.max(0, Math.min(100, (station.currentHP / station.maxHP) * 100));
      fillEl.style.width = `${pct.toFixed(1)}%`;
    }
    if (textEl) {
      textEl.textContent = `${Math.ceil(station.currentHP)}/${station.maxHP} HP`;
    }

    // Refresh expandable dig slots UI
    if (typeof window !== 'undefined' && typeof window.updateStationDigSlotsUI === 'function') {
      window.updateStationDigSlotsUI(station);
    }
  }
}

/**
 * Applies damage to a station from a miner hit.
 * If HP drops to 0 or below, regenerates immediately (instant respawn).
 * @param {string} stationId
 * @param {number} damage
 * @returns {boolean} True if the node broke and yielded ore this frame
 */
export function damageStation(stationId, damage) {
  const station = getStation(stationId);
  if (!station || !station.unlocked) return false;

  station.currentHP -= damage;

  // Immediate regeneration upon breaking
  if (station.currentHP <= 0) {
    station.currentHP = station.maxHP;
    return true; // Node was broken and ore yielded
  }

  return false;
}



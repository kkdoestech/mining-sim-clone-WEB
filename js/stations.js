/**
 * @file stations.js
 * @description Station upgrading, unlocking, and economic scaling engine
 * for the 2D idle mining tycoon simulator.
 */

import { gameState } from './state.js';
import { spawnMinerAgent, activeMinerAgents } from './minerFSM.js';
import { formatNumber } from './utils/format.js';

export { formatNumber };

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
 * Milestone progression definitions inspired by Cat Snack Bar.
 * Compounding bonuses reward milestone thresholds with immediate earnings spikes.
 * Level 10: 2x Value Multiplier
 * Level 25: 3x Value Multiplier + 50% Speed Boost (1.5x)
 * Level 50: 5x Value Multiplier
 * Level 100: 10x Value Multiplier
 */
export const STATION_MILESTONES = [
  { level: 10, valueMultiplier: 2, speedMultiplier: 1.0, label: '2x Value', banner: 'MILESTONE REACHED! 2x BOOST!' },
  { level: 25, valueMultiplier: 3, speedMultiplier: 1.5, label: '3x Value + 50% Speed', banner: 'MILESTONE REACHED! 3x VALUE + 50% SPEED BOOST!' },
  { level: 50, valueMultiplier: 5, speedMultiplier: 1.0, label: '5x Value', banner: 'MILESTONE REACHED! 5x BOOST!' },
  { level: 100, valueMultiplier: 10, speedMultiplier: 1.0, label: '10x Value', banner: 'MILESTONE REACHED! 10x BOOST!' }
];

/**
 * Computes compounding milestone value bonuses for a given station level tier.
 * Levels 1-9: 1x
 * Levels 10-24: 2x
 * Levels 25-49: 2 * 3 = 6x
 * Levels 50-99: 6 * 5 = 30x
 * Levels 100+: 30 * 10 = 300x
 * @param {number} level
 * @returns {number}
 */
export function calculateStationMultiplier(level) {
  let mult = 1;
  for (const m of STATION_MILESTONES) {
    if (level >= m.level) {
      mult *= m.valueMultiplier;
    }
  }
  return mult;
}

/**
 * Computes the speed multiplier for an active station (e.g., 50% speed boost at Lv 25+).
 * @param {MiningStation | number} stationOrLevel
 * @returns {number}
 */
export function getStationSpeedMultiplier(stationOrLevel) {
  const level = typeof stationOrLevel === 'number' ? stationOrLevel : (stationOrLevel?.level || 1);
  let speed = 1.0;
  for (const m of STATION_MILESTONES) {
    if (level >= m.level && m.speedMultiplier > 1.0) {
      speed *= m.speedMultiplier;
    }
  }
  return speed;
}

/**
 * Finds the next upcoming milestone target for a given level.
 * @param {number} level
 * @returns {Object | null}
 */
export function getNextMilestone(level) {
  for (const m of STATION_MILESTONES) {
    if (level < m.level) {
      return m;
    }
  }
  return null;
}

/**
 * Formats a concise milestone progress descriptor for station cards.
 * Example: "Lv. 7 / 10 ➔ 2x Boost!"
 * @param {number} level
 * @returns {{ text: string, targetLevel: number, reward: string, isMax: boolean }}
 */
export function getMilestoneProgressInfo(level) {
  const next = getNextMilestone(level);
  if (!next) {
    return {
      text: `Lv. ${level} • MAX (300x Boost!)`,
      targetLevel: 100,
      reward: 'MAX',
      isMax: true
    };
  }
  const rewardLabel = next.speedMultiplier > 1.0 ? `${next.valueMultiplier}x + 50% Spd!` : `${next.valueMultiplier}x Boost!`;
  return {
    text: `Lv. ${level} / ${next.level} ➔ ${rewardLabel}`,
    targetLevel: next.level,
    reward: rewardLabel,
    isMax: false
  };
}

/**
 * Active collection of progressive mining stations.
 * Baseline durabilities tuned so early worker hits break blocks in 1.5–2.0 seconds.
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
    maxHP: 20,
    currentHP: 20,
    workerSlots: 1,
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
    baseCost: 50,
    unlockCost: 250,
    baseOreValue: 5,
    maxHP: 40,
    currentHP: 40,
    workerSlots: 2,
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
    baseCost: 250,
    unlockCost: 1500,
    baseOreValue: 25,
    maxHP: 75,
    currentHP: 75,
    workerSlots: 3,
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
 * Formula: Math.floor(baseCost * Math.pow(1.14, level))
 * @param {MiningStation} station
 * @returns {number}
 */
export function getStationUpgradeCost(station) {
  return Math.floor(station.baseCost * Math.pow(1.14, station.level));
}

/**
 * Calculates cumulative geometric cost to buy n levels for a station at once
 * using the geometric series formula:
 * TotalCost = CurrentCost * ((1 - r^n) / (1 - r)) = CurrentCost * ((r^n - 1) / (r - 1)), with r = 1.14
 *
 * @param {MiningStation} station
 * @param {number} n - Number of levels to purchase
 * @returns {number} Cumulative total cost
 */
export function calculateCostForNLevels(station, n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count <= 0) return 0;
  const currentCost = getStationUpgradeCost(station);
  if (count === 1) return currentCost;
  const r = 1.14;
  const factor = (Math.pow(r, count) - 1) / (r - 1);
  return Math.floor(currentCost * factor);
}

/**
 * Calculates the maximum levels the player can afford right now and the total cost.
 * Solves inverse geometric progression:
 * TotalCost <= availableCoins
 *
 * @param {MiningStation} station
 * @param {number} availableCoins
 * @returns {{ levels: number, cost: number }}
 */
export function calculateMaxAffordableLevels(station, availableCoins) {
  const coins = Math.max(0, Math.floor(Number(availableCoins) || 0));
  const currentCost = getStationUpgradeCost(station);
  if (coins < currentCost) {
    return { levels: 0, cost: 0 };
  }

  const r = 1.14;
  // Analytical approximation from: currentCost * (r^n - 1) / (r - 1) <= coins
  const rawN = Math.floor(Math.log(1 + (coins * (r - 1)) / currentCost) / Math.log(r));
  let n = Math.max(1, rawN);

  // Precision boundary checks
  while (calculateCostForNLevels(station, n + 1) <= coins) {
    n++;
  }
  while (n > 0 && calculateCostForNLevels(station, n) > coins) {
    n--;
  }

  const cost = calculateCostForNLevels(station, n);
  return { levels: n, cost };
}

/**
 * Calculates the ore sell value scaling exponentially with station level and milestone multipliers.
 * Formula: Math.max(1, Math.round(baseOreValue * Math.pow(1.08, level - 1) * calculateStationMultiplier(level)))
 * @param {MiningStation} station
 * @returns {number}
 */
export function getStationOreValue(station) {
  const milestoneMult = calculateStationMultiplier(station.level);
  const expGrowth = Math.pow(1.08, Math.max(0, station.level - 1));
  return Math.max(1, Math.round(station.baseOreValue * expGrowth * milestoneMult));
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
    return { success: false, cost, reason: `Requires ${formatNumber(cost)} coins.` };
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
              <span class="cost-amount" id="cost-${station.id}">${formatNumber(nextUpgradeCost)}</span>
            </div>
          </button>
        `;
      }
    }
  }

  return { success: true, station, cost };
}

/**
 * Upgrades a station, deducting coins, incrementing its level tier,
 * and updating the visual badges on the card.
 * @param {string} stationId
 * @returns {{ success: boolean, station?: MiningStation, newLevel?: number, cost?: number, reason?: string }}
 */
/**
 * Upgrades a station, deducting coins, incrementing its level tier,
 * and updating the visual badges on the card.
 * Supports multi-buy modes ('1x', '10x', 'MAX').
 *
 * @param {string} stationId
 * @param {string | number} [mode='1x'] - '1x', '10x', 'MAX', or explicit number of levels
 * @returns {{ success: boolean, station?: MiningStation, newLevel?: number, levelsBought?: number, cost?: number, milestone?: Object | null, reason?: string }}
 */
export function upgradeStation(stationId, mode = '1x') {
  const station = getStation(stationId);
  if (!station) {
    return { success: false, reason: 'Station not found.' };
  }

  if (!station.unlocked) {
    return { success: false, reason: 'Station must be unlocked before upgrading.' };
  }

  let levelsToBuy = 1;
  let cost = 0;

  if (mode === '10x') {
    levelsToBuy = 10;
    cost = calculateCostForNLevels(station, 10);
  } else if (mode === 'MAX') {
    const maxAffordable = calculateMaxAffordableLevels(station, gameState.player.coins);
    levelsToBuy = maxAffordable.levels;
    cost = maxAffordable.cost;
    if (levelsToBuy <= 0) {
      return { success: false, cost: getStationUpgradeCost(station), reason: 'Insufficient coins for upgrade.' };
    }
  } else {
    levelsToBuy = typeof mode === 'number' && mode > 0 ? Math.floor(mode) : 1;
    cost = calculateCostForNLevels(station, levelsToBuy);
  }

  if (gameState.player.coins < cost) {
    return { success: false, cost, reason: `Requires ${formatNumber(cost)} coins.` };
  }

  // Deduct coins & increment level tier
  gameState.player.coins -= cost;
  const oldLevel = station.level;
  station.level += levelsToBuy;
  const newLevel = station.level;

  // Detect any milestones crossed during multi-level purchase
  const reachedMilestones = STATION_MILESTONES.filter(m => m.level > oldLevel && m.level <= newLevel);
  const milestone = reachedMilestones.length > 0 ? reachedMilestones[reachedMilestones.length - 1] : null;

  // Update DOM visuals
  if (typeof document !== 'undefined') {
    const badgeEl = document.getElementById(`level-badge-${station.id}`);
    const costEl = document.getElementById(`cost-${station.id}`);
    const milestoneEl = document.getElementById(`milestone-text-${station.id}`);
    const milestonePill = document.getElementById(`milestone-${station.id}`);
    const nextCost = getStationUpgradeCost(station);

    if (badgeEl) {
      badgeEl.textContent = `Lv. ${station.level}`;
    }
    if (costEl) {
      costEl.textContent = formatNumber(nextCost);
    }
    if (milestoneEl) {
      const progress = getMilestoneProgressInfo(station.level);
      milestoneEl.textContent = progress.text;
      if (milestonePill) {
        if (progress.isMax) {
          milestonePill.classList.add('milestone-max');
        } else {
          milestonePill.classList.remove('milestone-max');
        }
      }
    }

    // Trigger celebratory banner if milestone reached
    if (milestone) {
      if (typeof window !== 'undefined' && typeof window.triggerMilestoneCelebration === 'function') {
        window.triggerMilestoneCelebration(station.id, milestone.banner);
      }
    }
  }

  return {
    success: true,
    station,
    newLevel: station.level,
    levelsBought: levelsToBuy,
    cost,
    milestone
  };
}

/**
 * Calculates hiring cost for an additional autonomous miner.
 * Scales geometrically: Math.floor(100 * Math.pow(1.4, workerCount - 1))
 * @returns {number}
 */
export function getHireMinerCost() {
  const count = activeMinerAgents.length;
  return Math.round(100 * Math.pow(1.4, Math.max(0, count - 1)));
}

/**
 * Spawns an additional MinerAgent to increase total mine throughput.
 * @returns {{ success: boolean, cost?: number, miner?: any, reason?: string }}
 */
export function hireExtraMiner() {
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
    miningPower: 14 + (index * 3),
    moveSpeed: 220 + (index * 10),
    backpackCapacity: 4 + (index % 3),
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
              <span class="cost-amount" id="cost-${station.id}">${formatNumber(nextCost)}</span>
            </div>
          </button>
        `;
      }
    } else {
      el.classList.add('station-locked');
      el.classList.remove('station-unlocked');
    }

    // Update milestone indicator text & max styling
    const milestoneEl = document.getElementById(`milestone-text-${station.id}`);
    const milestonePill = document.getElementById(`milestone-${station.id}`);
    if (milestoneEl) {
      const progress = getMilestoneProgressInfo(station.level);
      milestoneEl.textContent = progress.text;
      if (milestonePill) {
        if (progress.isMax) {
          milestonePill.classList.add('milestone-max');
        } else {
          milestonePill.classList.remove('milestone-max');
        }
      }
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



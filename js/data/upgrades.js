/**
 * @file upgrades.js
 * @description Global progression upgrade definitions for the idle mining simulator.
 * Models tool enhancements, resource multipliers, and expedition access unlocks.
 */

/**
 * @typedef {Object} Upgrade
 * @property {string} id - Unique identifier for the upgrade.
 * @property {string} name - Display title of the upgrade.
 * @property {string} description - Lore & mechanics description.
 * @property {string} icon - Visual icon or emoji representation.
 * @property {number} baseCost - Initial purchase cost in coins.
 * @property {number} costMultiplier - Exponential price scaling factor per tier.
 * @property {number} currentLevel - Default baseline tier (0).
 * @property {number} maxLevel - Maximum purchasable upgrade level cap.
 * @property {(level: number) => number} effectFormula - Computes numerical buff modifier at level.
 * @property {(level: number) => string} formatEffect - Generates human-readable buff description.
 */

/**
 * Calculates the coin purchase cost for an upgrade at a given tier.
 * @param {Upgrade} upgrade
 * @param {number} level
 * @returns {number}
 */
export function getUpgradeCost(upgrade, level) {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

/**
 * Master catalog of global purchasable upgrades.
 * @type {readonly Upgrade[]}
 */
export const UPGRADES = Object.freeze([
  {
    id: 'pickaxe_sharpness',
    name: 'Pickaxe Sharpness',
    description: 'Hardens pickaxe alloy, increasing total miner damage output by +15% per tier.',
    icon: '⛏️',
    baseCost: 100,
    costMultiplier: 1.5,
    currentLevel: 0,
    maxLevel: 10,
    effectFormula: (level) => 1 + (level * 0.15),
    formatEffect: (level) => `+${level * 15}% Miner Power`
  },
  {
    id: 'ore_multiplier',
    name: 'Ore Multiplier',
    description: 'Refines excavation precision, granting a chance to extract double ores on completion.',
    icon: '✨',
    baseCost: 250,
    costMultiplier: 1.75,
    currentLevel: 0,
    maxLevel: 10,
    effectFormula: (level) => Math.min(1.0, level * 0.10),
    formatEffect: (level) => `${Math.round(level * 10)}% Double Drop Chance`
  },
  {
    id: 'depth_scanner',
    name: 'Depth Scanner',
    description: 'Sub-surface geological sonar that lowers player level requirements for deep zones.',
    icon: '📡',
    baseCost: 500,
    costMultiplier: 2.0,
    currentLevel: 0,
    maxLevel: 5,
    effectFormula: (level) => level * 2,
    formatEffect: (level) => `-${level * 2} Zone Level Req`
  }
]);

export default UPGRADES;


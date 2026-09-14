/**
 * @file mines.js
 * @description Mine zone definitions and drop tables for the idle mining simulator.
 * Defines progression requirements, excavation durability cycles, and ore probability tables.
 */

/**
 * @typedef {Object} OreDropEntry
 * @property {string} oreId - Target ore identifier corresponding to ORES data.
 * @property {number} dropChance - Drop probability percentage (0 to 100).
 */

/**
 * @typedef {Object} Mine
 * @property {string} id - Unique identifier for the mining zone.
 * @property {string} name - Display name of the expedition zone.
 * @property {number} requiredLevel - Player level threshold required to unlock.
 * @property {string} description - Lore and environmental description.
 * @property {number} maxSlots - Maximum miner units assignable to this expedition (default 4).
 * @property {number} totalDurability - Hit point pool needed to complete one mining cycle.
 * @property {readonly OreDropEntry[]} oreDropTable - Weighted loot table for completed cycles.
 * @property {string} bgImage - Background gradient or image asset reference.
 */

/**
 * Deep freezes an object or array to ensure full immutability.
 * @template T
 * @param {T} object
 * @returns {Readonly<T>}
 */
function deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = /** @type {any} */ (object)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(object);
}

/**
 * Master catalog of progressive expedition mine zones.
 * @type {readonly Mine[]}
 */
export const MINES = deepFreeze([
  {
    id: 'surface_trench',
    name: 'Surface Trench',
    requiredLevel: 1,
    description: 'Shallow earthen cuts rich in loose topsoil, stone pebbles, and scattered copper veins.',
    maxSlots: 4,
    totalDurability: 100,
    oreDropTable: [
      { oreId: 'dirt', dropChance: 60 },
      { oreId: 'stone', dropChance: 30 },
      { oreId: 'copper', dropChance: 10 }
    ],
    bgImage: 'linear-gradient(135deg, rgba(139, 90, 43, 0.15) 0%, rgba(22, 25, 34, 0.95) 100%)'
  },
  {
    id: 'bedrock_shaft',
    name: 'Bedrock Shaft',
    requiredLevel: 5,
    description: 'Deep subterranean galleries where heavy igneous strata encase rich veins of iron and raw gold.',
    maxSlots: 4,
    totalDurability: 500,
    oreDropTable: [
      { oreId: 'stone', dropChance: 45 },
      { oreId: 'copper', dropChance: 30 },
      { oreId: 'iron', dropChance: 20 },
      { oreId: 'gold', dropChance: 5 }
    ],
    bgImage: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(22, 25, 34, 0.95) 100%)'
  },
  {
    id: 'crystal_abyss',
    name: 'Crystal Abyss',
    requiredLevel: 15,
    description: 'An ancient tectonic chasm shimmering with concentrated prismatic resonance and radiant diamonds.',
    maxSlots: 4,
    totalDurability: 2500,
    oreDropTable: [
      { oreId: 'iron', dropChance: 40 },
      { oreId: 'gold', dropChance: 40 },
      { oreId: 'diamond', dropChance: 20 }
    ],
    bgImage: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(22, 25, 34, 0.95) 100%)'
  }
]);

export default MINES;


/**
 * @file ores.js
 * @description Core ore definitions for the idle mining simulator.
 * Defines immutable properties including rarity, economic value, and hardness.
 */

/**
 * @typedef {'Common' | 'Rare' | 'Epic' | 'Legendary'} OreRarity
 */

/**
 * @typedef {Object} Ore
 * @property {string} id - Unique identifier for the ore type.
 * @property {string} name - Display name of the ore.
 * @property {OreRarity} rarity - Rarity classification tier.
 * @property {number} sellValue - Base coin yield when sold.
 * @property {number} hardness - Damage reduction / durability resistance multiplier.
 * @property {string} colorHex - Brand color hex representation for UI accents and particles.
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
 * Master baseline ores catalog.
 * @type {readonly Ore[]}
 */
export const ORES = deepFreeze([
  {
    id: 'dirt',
    name: 'Dirt',
    rarity: 'Common',
    sellValue: 1,
    hardness: 1,
    colorHex: '#8b5a2b'
  },
  {
    id: 'stone',
    name: 'Stone',
    rarity: 'Common',
    sellValue: 3,
    hardness: 2,
    colorHex: '#78716c'
  },
  {
    id: 'copper',
    name: 'Copper',
    rarity: 'Common',
    sellValue: 8,
    hardness: 4,
    colorHex: '#d97706'
  },
  {
    id: 'iron',
    name: 'Iron',
    rarity: 'Rare',
    sellValue: 20,
    hardness: 8,
    colorHex: '#94a3b8'
  },
  {
    id: 'gold',
    name: 'Gold',
    rarity: 'Epic',
    sellValue: 60,
    hardness: 15,
    colorHex: '#f59e0b'
  },
  {
    id: 'diamond',
    name: 'Diamond',
    rarity: 'Legendary',
    sellValue: 250,
    hardness: 30,
    colorHex: '#38bdf8'
  }
]);

export default ORES;


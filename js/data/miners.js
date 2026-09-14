/**
 * @file miners.js
 * @description Recruitable miner unit definitions for the idle mining simulator.
 * Defines immutable worker units, their mining output per tick, and hiring economics.
 */

/**
 * @typedef {Object} Miner
 * @property {string} id - Unique identifier for the miner unit.
 * @property {string} name - Unit title / class name.
 * @property {number} tier - Power tier ranking (1 to 4).
 * @property {number} miningPower - Base damage dealt to mine durability per simulation tick.
 * @property {number} hireCost - Initial gold coin cost to recruit.
 * @property {string} iconUrl - Visual icon identifier, emoji representation, or SVG data URL.
 * @property {string} flavorText - Atmospheric lore and gameplay description.
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
 * Master catalog of recruitable miner units.
 * @type {readonly Miner[]}
 */
export const MINERS = deepFreeze([
  {
    id: 'novice_digger',
    name: 'Novice Digger',
    tier: 1,
    miningPower: 2,
    hireCost: 50,
    iconUrl: '👷‍♂️',
    flavorText: 'Equipped with a weather-worn pickaxe and endless optimism.'
  },
  {
    id: 'stone_mason',
    name: 'Stone Mason',
    tier: 2,
    miningPower: 8,
    hireCost: 250,
    iconUrl: '⚒️',
    flavorText: 'An experienced artisan who understands natural fault lines and structural fissures.'
  },
  {
    id: 'iron_driller',
    name: 'Iron Driller',
    tier: 3,
    miningPower: 25,
    hireCost: 1200,
    iconUrl: '⚙️',
    flavorText: 'Operates a heavy pneumatic drill powered by pressurized steam chambers.'
  },
  {
    id: 'cyber_miner',
    name: 'Cyber Miner',
    tier: 4,
    miningPower: 80,
    hireCost: 6000,
    iconUrl: '🤖',
    flavorText: 'Autonomous cybernetic excavation droid running overclocked plasma drill routines.'
  }
]);

export default MINERS;


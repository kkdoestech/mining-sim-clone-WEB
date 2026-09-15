/**
 * @file rebirth.js
 * @description World-Shift Biome Rebirth system for the idle mining simulator.
 * Manages depth biomes (Surface Quarry, Dwarven Caverns, Magma Core),
 * elevator descent transitions, soft-resets, and permanent global multipliers.
 */

import { gameState } from './state.js';
import { STATIONS, syncStationsDOM } from './stations.js';
import { createFloatingText } from './juice.js';

/**
 * Depth Biome Catalog definitions
 */
export const BIOMES = [
  {
    tier: 1,
    id: 'quarry',
    name: 'Surface Quarry',
    themeClass: 'theme-quarry',
    surfaceName: 'Grassy Outpost',
    cartCanopy: '⛺',
    cartBody: '🛒',
    merchant: '🧓',
    desc: 'Grassy surface, brown wood ladders, earthy dirt/copper/gold nodes.',
    stationSkins: [
      { id: 'station-1', name: 'Dirt & Coal Node', tierTag: 'Layer 1 • Shallow', icon: '🪨', particleColor: '#8b6d48' },
      { id: 'station-2', name: 'Copper Node', tierTag: 'Layer 2 • Subterranean', icon: '🧱', particleColor: '#d97706' },
      { id: 'station-3', name: 'Gold Node', tierTag: 'Layer 3 • Deep Core', icon: '🪙', particleColor: '#fbbf24' }
    ]
  },
  {
    tier: 2,
    id: 'dwarven',
    name: 'Dwarven Caverns',
    themeClass: 'theme-dwarven',
    surfaceName: 'Blue Slate Outpost',
    cartCanopy: '🏛️',
    cartBody: '⚒️',
    merchant: '🧙‍♂️',
    desc: 'Blue slate surface, stone pillars, mithril/titanium glowing nodes.',
    stationSkins: [
      { id: 'station-1', name: 'Mithril Node', tierTag: 'Cavern 1 • Crystal Vein', icon: '💠', particleColor: '#38bdf8' },
      { id: 'station-2', name: 'Titanium Node', tierTag: 'Cavern 2 • Heavy Metal', icon: '⚙️', particleColor: '#94a3b8' },
      { id: 'station-3', name: 'Luminite Node', tierTag: 'Cavern 3 • Radiant Rift', icon: '🔮', particleColor: '#a855f7' }
    ]
  },
  {
    tier: 3,
    id: 'magma',
    name: 'Magma Core',
    themeClass: 'theme-magma',
    surfaceName: 'Obsidian Citadel',
    cartCanopy: '🌋',
    cartBody: '🔥',
    merchant: '👹',
    desc: 'Obsidian surface, lava rivers, ruby/amethyst molten nodes.',
    stationSkins: [
      { id: 'station-1', name: 'Molten Basalt', tierTag: 'Mantle 1 • Lava Crust', icon: '🪨', particleColor: '#ef4444' },
      { id: 'station-2', name: 'Ruby Crystal', tierTag: 'Mantle 2 • Thermal Core', icon: '💎', particleColor: '#f43f5e' },
      { id: 'station-3', name: 'Void Amethyst', tierTag: 'Mantle 3 • Abyssal Heart', icon: '✨', particleColor: '#c084fc' }
    ]
  }
];

// Runtime state tracking
export const rebirthState = {
  rebirthCount: 0,
  depthTier: 1
};

/**
 * Returns the active permanent global earnings multiplier.
 * Formula: 1.0 + (rebirthCount * 2.0)
 * e.g., 0 rebirths -> 1.0x, 1 rebirth -> 3.0x, 2 rebirths -> 5.0x
 * @returns {number}
 */
export function getGlobalEarningsMultiplier() {
  return 1.0 + (rebirthState.rebirthCount * 2.0);
}

/**
 * Returns metadata for the currently active biome tier.
 * @returns {typeof BIOMES[0]}
 */
export function getCurrentBiome() {
  const index = Math.max(0, Math.min(BIOMES.length - 1, (rebirthState.depthTier - 1) % BIOMES.length));
  return BIOMES[index];
}

/**
 * Retrieves biome metadata by tier number (1, 2, or 3).
 * @param {number} tier
 * @returns {typeof BIOMES[0]}
 */
export function getBiomeByTier(tier) {
  const index = Math.max(0, Math.min(BIOMES.length - 1, (Number(tier) - 1) % BIOMES.length));
  return BIOMES[index];
}

/**
 * Checks if the player is currently eligible to perform a Rebirth descent.
 * Condition: All active stations in the current zone must reach Level 25+.
 * @returns {boolean}
 */
export function canRebirth() {
  if (!STATIONS || STATIONS.length === 0) return false;
  return STATIONS.every(station => station.unlocked && station.level >= 25);
}

/**
 * Applies the visual CSS theme and station skin names/icons according to the active depth tier.
 * @param {number} [tier]
 */
export function applyBiomeTheme(tier = rebirthState.depthTier) {
  if (typeof document === 'undefined') return;

  const biome = getBiomeByTier(tier);
  const stage = document.getElementById('mine-stage');
  if (stage) {
    // Replace existing theme classes with the target biome theme class
    BIOMES.forEach(b => stage.classList.remove(b.themeClass));
    stage.classList.add(biome.themeClass);
  }

  // Update merchant cart visuals if available
  const cartCanopy = document.querySelector('.cart-canopy');
  const cartBody = document.querySelector('.cart-body');
  const merchantNpc = document.querySelector('.merchant-npc');
  if (cartCanopy) cartCanopy.textContent = biome.cartCanopy;
  if (cartBody) cartBody.textContent = biome.cartBody;
  if (merchantNpc) merchantNpc.textContent = biome.merchant;

  // Update station skin identity (titles, tags, rock icons)
  biome.stationSkins.forEach(skin => {
    const platform = document.getElementById(skin.id);
    if (!platform) return;

    const titleEl = platform.querySelector('.station-title');
    const tagEl = platform.querySelector('.station-tier-tag');
    const iconEl = platform.querySelector('.rock-icon');

    if (titleEl) titleEl.textContent = skin.name;
    if (tagEl) tagEl.textContent = skin.tierTag;
    if (iconEl) iconEl.textContent = skin.icon;
  });

  // Update Elevator Station UI
  updateElevatorUI();
}

/**
 * Synchronizes the Elevator Descent Station console DOM elements with current rebirth eligibility.
 */
export function updateElevatorUI() {
  if (typeof document === 'undefined') return;

  const biome = getCurrentBiome();
  const titleEl = document.getElementById('elevator-biome-title');
  const statusEl = document.getElementById('elevator-status-text');
  const button = document.getElementById('btn-elevator-descend');

  if (titleEl) {
    titleEl.textContent = `Tier ${rebirthState.depthTier} • ${biome.name}`;
  }

  const eligible = canRebirth();
  const nextMult = 1.0 + ((rebirthState.rebirthCount + 1) * 2.0);

  if (statusEl) {
    if (eligible) {
      statusEl.textContent = `⚡ Ready to Descend! (+200% Multiplier ➔ ${nextMult.toFixed(1)}x)`;
      statusEl.classList.add('ready-glow');
    } else {
      const minLevel = Math.min(...STATIONS.map(s => s.unlocked ? s.level : 0));
      statusEl.textContent = `Reach Lv. 25 on all stations to Descend (${minLevel}/25)`;
      statusEl.classList.remove('ready-glow');
    }
  }

  if (button) {
    button.disabled = !eligible;
    if (eligible) {
      button.classList.add('elevator-btn-ready');
    } else {
      button.classList.remove('elevator-btn-ready');
    }
  }
}

/**
 * Executes a World-Shift Biome Rebirth:
 * 1. Plays a 1-second elevator fade transition.
 * 2. Resets player soft coins to 0.
 * 3. Resets station levels to 1 (Station 1 unlocked, Stations 2 & 3 locked).
 * 4. Increments rebirthCount and advances depthTier.
 * 5. Applies new biome theme and station skins.
 * 6. Invokes onRebirthComplete callback.
 *
 * @param {Object} [options]
 * @param {() => void} [options.onComplete]
 * @returns {Promise<{ success: boolean, newTier?: number, rebirthCount?: number, multiplier?: number, reason?: string }>}
 */
export function performRebirth(options = {}) {
  if (!canRebirth()) {
    return Promise.resolve({
      success: false,
      reason: 'All stations must reach Level 25 before descending.'
    });
  }

  return new Promise((resolve) => {
    // 1. Play 1-second elevator descent transition
    if (typeof document !== 'undefined') {
      const shutter = document.getElementById('elevator-shutter');
      if (shutter) {
        shutter.classList.remove('hidden');
        shutter.classList.add('active-descent');
      }
    }

    setTimeout(() => {
      // 2. Reset soft coins
      gameState.player.coins = 0;

      // 3. Reset stations: Station 1 Lv 1 unlocked, others locked
      STATIONS.forEach((station, index) => {
        station.level = 1;
        station.unlocked = index === 0;
        station.currentHP = station.maxHP;
      });

      // 4. Advance progression metrics
      rebirthState.rebirthCount += 1;
      rebirthState.depthTier = ((rebirthState.depthTier - 1 + 1) % BIOMES.length) + 1;
      const newMultiplier = getGlobalEarningsMultiplier();

      // 5. Apply new biome visuals & theme
      applyBiomeTheme(rebirthState.depthTier);
      syncStationsDOM();

      // 6. Spawn visual celebratory floater
      if (typeof document !== 'undefined') {
        const stage = document.getElementById('mine-stage');
        if (stage) {
          createFloatingText(
            150,
            120,
            `🌟 DESCENDED TO ${getCurrentBiome().name.toUpperCase()}! (${newMultiplier.toFixed(1)}x Multiplier)`,
            '#38bdf8'
          );
        }

        // Fade out elevator shutter
        const shutter = document.getElementById('elevator-shutter');
        if (shutter) {
          shutter.classList.remove('active-descent');
          shutter.classList.add('fade-out');
          setTimeout(() => {
            shutter.classList.add('hidden');
            shutter.classList.remove('fade-out');
          }, 500);
        }
      }

      if (typeof options.onComplete === 'function') {
        options.onComplete();
      }

      resolve({
        success: true,
        newTier: rebirthState.depthTier,
        rebirthCount: rebirthState.rebirthCount,
        multiplier: newMultiplier
      });
    }, 500);
  });
}

/**
 * Initializes or restores rebirth state from storage.
 * @param {Object} [savedData]
 */
export function initRebirthState(savedData = {}) {
  rebirthState.rebirthCount = Math.max(0, Number(savedData.rebirthCount) || 0);
  rebirthState.depthTier = Math.max(1, Math.min(3, Number(savedData.depthTier) || 1));
  applyBiomeTheme(rebirthState.depthTier);
}


/**
 * @file abilities.js
 * @description Active Abilities system inspired by Hypixel Skyblock pickaxe skills.
 * Provides the "Pickobulus Blast" ability: catastrophic instant excavation of all
 * unlocked stations, immediate coin liquidation at the surface cart, full-screen
 * shockwave flash, heavy screen shake, and floating text banners.
 */

import { gameState } from './state.js';
import { STATIONS, damageStation, getStationOreValue } from './stations.js';
import {
  shake,
  triggerShockwaveFlash,
  createMassiveBanner,
  createFloatingText,
  createRockImpactParticles,
  triggerOreNodePunch,
  getStationRockCoords
} from './juice.js';
import { getSurfaceWaypoint, updateStationHPUI } from './minerFSM.js';
import { onGameEvent } from './commissions.js';
import { sellAllOres } from './economy.js';

/**
 * Pickobulus Active Ability State
 */
export const pickobulusAbility = {
  id: 'pickobulus',
  name: 'Pickobulus Blast',
  cooldown: 60, // 60 seconds base cooldown
  timer: 0      // 0 = Ready
};

/**
 * Checks whether the Pickobulus ability is off cooldown and ready to fire.
 * @returns {boolean}
 */
export function isReady() {
  return pickobulusAbility.timer <= 0;
}

/**
 * Returns remaining cooldown duration in seconds.
 * @returns {number}
 */
export function getCooldownRemaining() {
  return Math.max(0, pickobulusAbility.timer);
}

/**
 * Updates ability cooldown timers by delta time.
 * Designed to be called every tick inside the 60FPS game loop.
 *
 * @param {number} dt - Frame delta time in seconds
 */
export function updateAbilities(dt) {
  if (pickobulusAbility.timer > 0) {
    pickobulusAbility.timer = Math.max(0, pickobulusAbility.timer - dt);
    updatePickobulusButtonDOM();
  }
}

/** Cache for tracking previous second integer to prevent redundant text mutations */
let lastDisplayedSeconds = -1;

/**
 * Synchronizes the DOM state of the #btn-pickobulus button.
 * Reflects ready vs cooling down, radial cooldown sweep, and countdown label.
 */
export function updatePickobulusButtonDOM() {
  if (typeof document === 'undefined') return;

  const btn = document.getElementById('btn-pickobulus');
  if (!btn) return;

  const label = document.getElementById('pickobulus-btn-label');
  const overlay = document.getElementById('pickobulus-cd-overlay');

  const ready = isReady();

  if (ready) {
    if (!btn.classList.contains('ready')) {
      btn.classList.add('ready');
      btn.classList.remove('cooling-down');
      btn.disabled = false;
      btn.setAttribute('aria-label', 'Pickobulus Blast: Ready');
      if (label) label.textContent = 'BLAST';
      if (overlay) overlay.style.setProperty('--cd-angle', '0deg');
      lastDisplayedSeconds = -1;
    }
  } else {
    if (!btn.classList.contains('cooling-down')) {
      btn.classList.add('cooling-down');
      btn.classList.remove('ready');
      btn.disabled = true;
    }

    const remaining = getCooldownRemaining();
    const remainingSec = Math.ceil(remaining);

    // Only mutate text if integer second changed
    if (remainingSec !== lastDisplayedSeconds) {
      lastDisplayedSeconds = remainingSec;
      if (label) label.textContent = `${remainingSec}s`;
      btn.setAttribute('aria-label', `Pickobulus Blast: Cooldown ${remainingSec}s`);
    }

    if (overlay) {
      const progress = remaining / pickobulusAbility.cooldown; // 1.0 down to 0.0
      const angle = Math.round(progress * 360);
      overlay.style.setProperty('--cd-angle', `${angle}deg`);
    }
  }
}

/**
 * Triggers the "Pickobulus Blast" active ability:
 * 1. Validates readiness (exits if still on cooldown).
 * 2. Sets timer to cooldown (45s).
 * 3. Deals instant massive damage (100% Max HP) to ALL unlocked stations.
 * 4. Instantly deposits all yielded ores into the surface cart and credits coins.
 * 5. Triggers full-screen shockwave flash and heavy screen shake (shake(600)).
 * 6. Spawns massive floating text banner: "💥 PICKOBULUS BLAST!".
 *
 * @returns {{ success: boolean, coinsEarned?: number, oresYielded?: number, reason?: string }}
 */
export function triggerPickobulus() {
  if (!isReady()) {
    return {
      success: false,
      reason: `Pickobulus is on cooldown (${Math.ceil(getCooldownRemaining())}s remaining).`
    };
  }

  // 1. Put ability on cooldown
  pickobulusAbility.timer = pickobulusAbility.cooldown;
  updatePickobulusButtonDOM();

  // 1.5 Liquidate stored inventory in surface cart
  sellAllOres();

  let totalCoinsEarned = 0;
  let totalOresYielded = 0;

  // 2. Deal instant massive damage (100% of Max HP) to ALL unlocked stations
  for (const station of STATIONS) {
    if (!station.unlocked) continue;

    const damage = station.maxHP;
    const broke = damageStation(station.id, damage);

    if (broke) {
      const oreVal = getStationOreValue(station);
      totalCoinsEarned += oreVal;
      totalOresYielded += 1;

      // Spawns rock particles, node punch, and floating CRIT text at station rock
      const coords = getStationRockCoords(station.id);
      createRockImpactParticles(coords.x, coords.y, '#38bdf8');
      triggerOreNodePunch(station.id);
      createFloatingText(coords.x, coords.y - 22, 'CRIT! 💥', '#38bdf8');
      updateStationHPUI(station);

      // Dispatch King's Bounty event for mining ore
      onGameEvent('MINE_ORE', {
        oreId: station.oreId,
        stationId: station.id,
        count: 1
      });
    }
  }

  // 3. Instantly deposit all yielded ores into the surface cart and credit coins
  if (totalCoinsEarned > 0) {
    if (typeof gameState.addCoins === 'function') {
      gameState.addCoins(totalCoinsEarned);
    } else {
      gameState.player.coins += totalCoinsEarned;
    }

    // Visual juice floater at surface merchant cart
    const surfacePos = getSurfaceWaypoint();
    createFloatingText(surfacePos.x + 18, surfacePos.y - 14, `+${Math.floor(totalCoinsEarned).toLocaleString()} 🪙`, '#facc15');

    // Dispatch King's Bounty event for hauling carts to surface
    onGameEvent('HAUL_CARTS', { count: 1 });
  }

  // 4. Trigger full-screen shockwave flash and heavy screen shake (600ms)
  shake(600);
  triggerShockwaveFlash();

  // 5. Spawn massive floating text banner
  createMassiveBanner('💥 PICKOBULUS BLAST!');

  return {
    success: true,
    coinsEarned: totalCoinsEarned,
    oresYielded: totalOresYielded
  };
}


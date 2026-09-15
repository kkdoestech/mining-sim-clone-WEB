/**
 * @file commissions.js
 * @description Hypixel Skyblock-inspired Commissions / King's Bounties system
 * with Mithril Powder (🟣) and coin rewards.
 * Procedurally generates active tasks (mining specific ores, hauling carts, upgrading stations)
 * and dispatches game events across minerFSM and stations modules.
 */

import { gameState } from './state.js';
import { getCurrentBiome } from './rebirth.js';
import { STATIONS } from './stations.js';
import { createFloatingText } from './juice.js';
import { getPerkMultiplier } from './hotm.js';
import { isFlashEventActive } from './events.js';

/**
 * @typedef {Object} Bounty
 * @property {string} id - Unique identifier.
 * @property {'MINE_ORE' | 'HAUL_CARTS' | 'UPGRADE_STATIONS'} type - Bounty task category.
 * @property {string} title - Human-readable bounty title.
 * @property {number} current - Current progress count.
 * @property {number} target - Required target threshold.
 * @property {boolean} isCompleted - Whether current >= target.
 * @property {number} rewardCoins - Coin reward upon claim.
 * @property {number} rewardPowder - Mithril Powder (🟣) reward upon claim.
 * @property {string | null} [targetStationId] - Station ID constraint for MINE_ORE.
 * @property {string | null} [targetOreId] - Ore ID constraint for MINE_ORE.
 */

/**
 * Active player bounties (always maintains 2 slots).
 * @type {Bounty[]}
 */
export const activeBounties = [];

/**
 * Available task categories.
 */
export const BOUNTY_TYPES = ['MINE_ORE', 'HAUL_CARTS', 'UPGRADE_STATIONS'];

/**
 * Generates a fresh procedural bounty scaled to the current player depth tier and level.
 * @param {Bounty[]} [existingBounties=[]]
 * @returns {Bounty}
 */
export function generateBounty(existingBounties = activeBounties) {
  const biome = typeof getCurrentBiome === 'function' ? getCurrentBiome() : null;
  const tier = biome?.tier || 1;
  const playerLevel = gameState?.player?.level || 1;

  // Determine available types not overly saturated
  const existingTypes = existingBounties.map(b => b.type);
  const candidateTypes = BOUNTY_TYPES.filter(t => !existingTypes.includes(t));
  const chosenType = candidateTypes.length > 0
    ? candidateTypes[Math.floor(Math.random() * candidateTypes.length)]
    : BOUNTY_TYPES[Math.floor(Math.random() * BOUNTY_TYPES.length)];

  const id = `bounty_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (chosenType === 'MINE_ORE') {
    // Pick an active skin/station
    let stationName = 'Ore';
    let targetStationId = 'station-1';
    let targetOreId = 'dirt';

    if (biome && Array.isArray(biome.stationSkins) && biome.stationSkins.length > 0) {
      const skin = biome.stationSkins[Math.floor(Math.random() * biome.stationSkins.length)];
      stationName = skin.name;
      targetStationId = skin.id;
      const matchedStation = STATIONS.find(s => s.id === skin.id);
      targetOreId = matchedStation?.oreId || 'dirt';
    }

    const target = 10 + (tier * 4) + Math.floor(Math.random() * 5); // 14 to 26
    const rewardCoins = Math.round((120 + (tier * 80)) * (1 + playerLevel * 0.05));
    const rewardPowder = 15 + (tier * 10) + Math.floor(Math.random() * 6); // 25 to 45

    return {
      id,
      type: 'MINE_ORE',
      title: `Mine ${target} ${stationName}`,
      current: 0,
      target,
      isCompleted: false,
      rewardCoins,
      rewardPowder,
      targetStationId,
      targetOreId
    };
  }

  if (chosenType === 'HAUL_CARTS') {
    const target = 3 + tier + Math.floor(Math.random() * 2); // 4 to 6
    const rewardCoins = Math.round((160 + (tier * 90)) * (1 + playerLevel * 0.05));
    const rewardPowder = 18 + (tier * 12) + Math.floor(Math.random() * 5);

    return {
      id,
      type: 'HAUL_CARTS',
      title: `Deliver ${target} Carts to Surface`,
      current: 0,
      target,
      isCompleted: false,
      rewardCoins,
      rewardPowder,
      targetStationId: null,
      targetOreId: null
    };
  }

  // Default: UPGRADE_STATIONS
  const target = 5 + (tier * 3) + Math.floor(Math.random() * 4); // 8 to 17
  const rewardCoins = Math.round((140 + (tier * 70)) * (1 + playerLevel * 0.05));
  const rewardPowder = 14 + (tier * 9) + Math.floor(Math.random() * 5);

  return {
    id,
    type: 'UPGRADE_STATIONS',
    title: `Buy ${target} Station Upgrades`,
    current: 0,
    target,
    isCompleted: false,
    rewardCoins,
    rewardPowder,
    targetStationId: null,
    targetOreId: null
  };
}

/**
 * Initializes active bounties pool from saved state or fresh generation.
 * Always ensures exactly 2 active bounties.
 * @param {Bounty[]} [savedBounties]
 */
export function initBounties(savedBounties = []) {
  activeBounties.length = 0;

  if (Array.isArray(savedBounties) && savedBounties.length > 0) {
    for (const b of savedBounties) {
      if (b && b.id && b.type && b.target) {
        activeBounties.push({
          id: String(b.id),
          type: b.type,
          title: String(b.title),
          current: Math.min(Number(b.target) || 1, Math.max(0, Number(b.current) || 0)),
          target: Math.max(1, Number(b.target) || 1),
          isCompleted: Boolean(b.isCompleted || (Number(b.current) >= Number(b.target))),
          rewardCoins: Math.max(1, Number(b.rewardCoins) || 100),
          rewardPowder: Math.max(1, Number(b.rewardPowder) || 15),
          targetStationId: b.targetStationId || null,
          targetOreId: b.targetOreId || null
        });
      }
    }
  }

  // Fill up to 2 slots
  while (activeBounties.length < 2) {
    activeBounties.push(generateBounty(activeBounties));
  }

  renderBountiesBar();
}

/**
 * Centralized game event dispatcher for commissions.
 * Called from minerFSM.js and stations.js.
 *
 * @param {'MINE_ORE' | 'HAUL_CARTS' | 'UPGRADE_STATIONS'} type
 * @param {Object} [payload]
 * @param {string} [payload.oreId]
 * @param {string} [payload.stationId]
 * @param {number} [payload.count]
 * @param {number} [payload.levelsBought]
 */
export function onGameEvent(type, payload = {}) {
  let changed = false;

  for (const bounty of activeBounties) {
    if (bounty.isCompleted) continue;

    if (bounty.type === type) {
      if (type === 'MINE_ORE') {
        const matchesStation = !bounty.targetStationId || bounty.targetStationId === payload.stationId;
        const matchesOre = !bounty.targetOreId || bounty.targetOreId === payload.oreId;
        if (matchesStation || matchesOre) {
          bounty.current = Math.min(bounty.target, bounty.current + (payload.count || 1));
          changed = true;
        }
      } else if (type === 'HAUL_CARTS') {
        bounty.current = Math.min(bounty.target, bounty.current + (payload.count || 1));
        changed = true;
      } else if (type === 'UPGRADE_STATIONS') {
        bounty.current = Math.min(bounty.target, bounty.current + (payload.levelsBought || 1));
        changed = true;
      }

      if (bounty.current >= bounty.target) {
        bounty.isCompleted = true;
        changed = true;
      }
    }
  }

  if (changed) {
    renderBountiesBar();
  }
}

/**
 * Claims rewards for a completed bounty, grants coins and Mithril Powder,
 * and replaces the slot with a new procedural bounty.
 *
 * @param {string} bountyId
 * @returns {{ success: boolean, bounty?: Bounty, newBounty?: Bounty, coinsGranted?: number, powderGranted?: number, reason?: string }}
 */
export function claimBounty(bountyId) {
  const index = activeBounties.findIndex(b => b.id === bountyId);
  if (index === -1) {
    return { success: false, reason: 'Bounty not found.' };
  }

  const bounty = activeBounties[index];
  if (!bounty.isCompleted && bounty.current < bounty.target) {
    return { success: false, reason: 'Bounty conditions not yet met.' };
  }

  // 1. Grant Rewards to player
  const coins = bounty.rewardCoins || 100;
  const powderBuff = typeof getPerkMultiplier === 'function' ? getPerkMultiplier('powder_buff') : 0;
  let powder = Math.round((bounty.rewardPowder || 20) * (1 + powderBuff));
  if (typeof isFlashEventActive === 'function' && isFlashEventActive('2X_POWDER_RUSH')) {
    powder *= 2;
  }

  if (typeof gameState.addCoins === 'function') {
    gameState.addCoins(coins);
  } else {
    gameState.player.coins += coins;
  }

  if (typeof gameState.addPowder === 'function') {
    gameState.addPowder(powder);
  } else {
    gameState.player.powder = (gameState.player.powder || 0) + powder;
  }

  // 2. Visual Floater feedback
  if (typeof document !== 'undefined') {
    const cardEl = document.getElementById(`bounty-card-${bounty.id}`);
    const coords = cardEl ? cardEl.getBoundingClientRect() : null;
    const stage = document.getElementById('mine-stage');
    const stageRect = stage ? stage.getBoundingClientRect() : null;

    let posX = 160;
    let posY = 40;
    if (coords && stageRect) {
      posX = Math.round(coords.left - stageRect.left + coords.width / 2);
      posY = Math.round(coords.top - stageRect.top + 20);
    }

    createFloatingText(posX - 30, posY, `+${Math.floor(coins).toLocaleString()} 🪙`, '#f5a623');
    createFloatingText(posX + 30, posY - 16, `+${Math.floor(powder).toLocaleString()} 🟣`, '#c084fc');
  }

  // 3. Replace claimed bounty with fresh random bounty
  const newBounty = generateBounty(activeBounties);
  activeBounties[index] = newBounty;

  // 4. Update UI representation
  renderBountiesBar();

  return {
    success: true,
    bounty,
    newBounty,
    coinsGranted: coins,
    powderGranted: powder
  };
}

/**
 * Returns active bounties array for serialization and external inspection.
 * @returns {Bounty[]}
 */
export function getActiveBounties() {
  return activeBounties;
}

/**
 * Renders the compact 2-card King's Bounties bar inside #bounties-bar.
 */
export function renderBountiesBar() {
  if (typeof document === 'undefined') return;

  const bar = document.getElementById('bounties-bar');
  if (!bar) return;

  if (activeBounties.length === 0) {
    initBounties();
  }

  bar.innerHTML = activeBounties.map(bounty => {
    const pct = Math.max(0, Math.min(100, (bounty.current / bounty.target) * 100));
    const isDone = bounty.isCompleted || bounty.current >= bounty.target;

    const iconMap = {
      MINE_ORE: '⛏️',
      HAUL_CARTS: '🛒',
      UPGRADE_STATIONS: '⚡'
    };
    const typeIcon = iconMap[bounty.type] || '📜';

    return `
      <div class="bounty-card ${isDone ? 'bounty-card-completed' : ''}" id="bounty-card-${bounty.id}">
        <div class="bounty-header">
          <div class="bounty-title-group">
            <span class="bounty-icon">${typeIcon}</span>
            <span class="bounty-title">${bounty.title}</span>
          </div>
          <div class="bounty-rewards-pill" title="Rewards upon completion">
            <span class="reward-tag-coin">🪙 ${Math.floor(bounty.rewardCoins).toLocaleString()}</span>
            <span class="reward-tag-powder">🟣 ${Math.floor(bounty.rewardPowder).toLocaleString()}</span>
          </div>
        </div>

        <div class="bounty-action-row">
          ${isDone ? `
            <button type="button" class="btn-bounty-claim" data-action="claim-bounty" data-bounty-id="${bounty.id}">
              <span class="claim-glow-icon">✨</span>
              <span class="claim-label">CLAIM REWARD</span>
              <span class="claim-powder-badge">+${bounty.rewardPowder} 🟣</span>
            </button>
          ` : `
            <div class="bounty-progress-wrap">
              <div class="bounty-progress-track">
                <div class="bounty-progress-fill" style="width: ${pct.toFixed(1)}%;"></div>
              </div>
              <span class="bounty-progress-text">${bounty.current} / ${bounty.target} (${pct.toFixed(0)}%)</span>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}


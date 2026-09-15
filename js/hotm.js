/**
 * @file hotm.js
 * @description Heart of the Mountain (HOTM) Perk Tree system powered by Mithril Powder (🟣).
 * Provides permanent account-wide boosts for miner speed, fortune, cleave damage,
 * backpack capacity, hauling speed, and bounty powder bonuses.
 */

import { gameState } from './state.js';
import { createFloatingText } from './juice.js';

/**
 * @typedef {Object} HotmPerk
 * @property {string} id - Unique identifier.
 * @property {string} name - Display title.
 * @property {string} icon - Emoji / icon descriptor.
 * @property {string} desc - Effect summary description.
 * @property {number} maxLevel - Level cap.
 * @property {(level: number) => number} multiplierFormula - Stat bonus formula.
 * @property {(level: number) => string} formatBonus - Formatted bonus string.
 */

/**
 * Registry of the 6 Heart of the Mountain Perks.
 * @type {HotmPerk[]}
 */
export const HOTM_PERKS = [
  {
    id: 'mining_speed',
    name: 'Mining Speed',
    icon: '⛏️',
    desc: '+10% worker swing rate per level',
    maxLevel: 10,
    multiplierFormula: (level) => level * 0.10,
    formatBonus: (level) => `+${(level * 10)}% Swing Rate`
  },
  {
    id: 'mining_fortune',
    name: 'Mining Fortune',
    icon: '💎',
    desc: '+12% chance for double ore drops per swing',
    maxLevel: 10,
    multiplierFormula: (level) => level * 0.12,
    formatBonus: (level) => `+${(level * 12)}% Double Drops`
  },
  {
    id: 'efficient_miner',
    name: 'Efficient Miner',
    icon: '💥',
    desc: '+15% chance to spread 50% damage to an adjacent node',
    maxLevel: 5,
    multiplierFormula: (level) => level * 0.15,
    formatBonus: (level) => `+${(level * 15)}% Node Cleave`
  },
  {
    id: 'deep_pockets',
    name: 'Deep Pockets',
    icon: '🎒',
    desc: '+2 max ore capacity per miner backpack',
    maxLevel: 5,
    multiplierFormula: (level) => level * 2,
    formatBonus: (level) => `+${(level * 2)} Ore Slots`
  },
  {
    id: 'speedy_hauler',
    name: 'Speedy Hauler',
    icon: '⚡',
    desc: '+15% worker move speed on platforms & ladders',
    maxLevel: 10,
    multiplierFormula: (level) => level * 0.15,
    formatBonus: (level) => `+${(level * 15)}% Move Speed`
  },
  {
    id: 'powder_buff',
    name: 'Powder Buff',
    icon: '🟣',
    desc: '+20% bonus powder from completed bounties',
    maxLevel: 5,
    multiplierFormula: (level) => level * 0.20,
    formatBonus: (level) => `+${(level * 20)}% Bounty Powder`
  }
];

/**
 * Runtime state tracking perk levels: { [perkId]: level }
 * @type {Record<string, number>}
 */
export const hotmState = {
  mining_speed: 0,
  mining_fortune: 0,
  efficient_miner: 0,
  deep_pockets: 0,
  speedy_hauler: 0,
  powder_buff: 0
};

/**
 * Retrieves a perk definition by identifier.
 * @param {string} perkId
 * @returns {HotmPerk | undefined}
 */
export function getPerk(perkId) {
  return HOTM_PERKS.find(p => p.id === perkId);
}

/**
 * Calculates Mithril Powder upgrade cost for a perk at its current tier.
 * Formula: Math.floor(30 * Math.pow(1.35, level).toLocaleString())
 * @param {string} perkId
 * @returns {number}
 */
export function getPerkCost(perkId) {
  const currentLevel = hotmState[perkId] || 0;
  const perk = getPerk(perkId);
  if (!perk || currentLevel >= perk.maxLevel) {
    return Infinity;
  }
  return Math.floor(30 * Math.pow(1.35, currentLevel).toLocaleString());
}

/**
 * Returns the current active stat bonus for a perk.
 * @param {string} perkId
 * @returns {number}
 */
export function getPerkMultiplier(perkId) {
  const perk = getPerk(perkId);
  if (!perk) return 0;
  const level = hotmState[perkId] || 0;
  return perk.multiplierFormula(level);
}

/**
 * Upgrades a perk, deducting Mithril Powder (🟣), incrementing its level,
 * and refreshing UI displays.
 *
 * @param {string} perkId
 * @returns {{ success: boolean, newLevel?: number, cost?: number, reason?: string }}
 */
export function upgradePerk(perkId) {
  const perk = getPerk(perkId);
  if (!perk) {
    return { success: false, reason: 'Perk not found.' };
  }

  const currentLevel = hotmState[perkId] || 0;
  if (currentLevel >= perk.maxLevel) {
    return { success: false, reason: 'Perk is already at maximum level.' };
  }

  const cost = getPerkCost(perkId);
  const playerPowder = gameState?.player?.powder || 0;

  if (playerPowder < cost) {
    return { success: false, cost, reason: `Requires ${Math.floor(cost).toLocaleString()} 🟣 Powder.` };
  }

  // Deduct powder
  gameState.player.powder = playerPowder - cost;
  hotmState[perkId] = currentLevel + 1;

  // Visual juice floater
  if (typeof document !== 'undefined') {
    const cardEl = document.getElementById(`hotm-card-${perkId}`);
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      createFloatingText(rect.left + 50, rect.top, `-${Math.floor(cost).toLocaleString()} 🟣`, '#c084fc');
      createFloatingText(rect.left + 120, rect.top - 20, `Lv. ${hotmState[perkId]} UP! ⭐`, '#e879f9');
    }
  }

  // Update DOM representation
  renderHotmGrid();

  return {
    success: true,
    newLevel: hotmState[perkId],
    cost
  };
}

/**
 * Returns a serializable snapshot of HOTM levels for save persistence.
 * @returns {Record<string, number>}
 */
export function getHotmSaveData() {
  return { ...hotmState };
}

/**
 * Restores HOTM state from storage, validating against max levels.
 * @param {Object} [savedData]
 */
export function initHotmState(savedData = {}) {
  for (const perk of HOTM_PERKS) {
    if (savedData && savedData[perk.id] !== undefined) {
      hotmState[perk.id] = Math.max(0, Math.min(perk.maxLevel, Number(savedData[perk.id]) || 0));
    } else {
      hotmState[perk.id] = 0;
    }
  }
}

/**
 * Renders the 2x3 grid of Heart of the Mountain perk cards inside #hotm-perks-grid.
 */
export function renderHotmGrid() {
  if (typeof document === 'undefined') return;

  const grid = document.getElementById('hotm-perks-grid');
  const powderValEl = document.getElementById('hotm-powder-val');
  const currentPowder = gameState?.player?.powder || 0;

  if (powderValEl) {
    powderValEl.textContent = Math.floor(currentPowder).toLocaleString();
  }

  if (!grid) return;

  grid.innerHTML = HOTM_PERKS.map(perk => {
    const level = hotmState[perk.id] || 0;
    const isMax = level >= perk.maxLevel;
    const cost = getPerkCost(perk.id);
    const canAfford = !isMax && currentPowder >= cost;
    const bonusText = level > 0 ? perk.formatBonus(level) : 'Not unlocked';
    const nextBonus = !isMax ? perk.formatBonus(level + 1) : 'Max Tier Reached';

    return `
      <div class="hotm-perk-card ${isMax ? 'perk-maxed' : ''} ${canAfford ? 'perk-affordable' : ''}" id="hotm-card-${perk.id}">
        <div class="perk-card-header">
          <div class="perk-icon-wrap">
            <span class="perk-icon">${perk.icon}</span>
          </div>
          <div class="perk-meta-group">
            <span class="perk-title">${perk.name}</span>
            <span class="perk-level-badge ${isMax ? 'badge-max' : ''}">
              ${isMax ? 'MAX LEVEL' : `Lv. ${level} / ${perk.maxLevel}`}
            </span>
          </div>
        </div>

        <div class="perk-desc-wrap">
          <p class="perk-desc">${perk.desc}</p>
          <div class="perk-active-stat">
            <span class="stat-current">${bonusText}</span>
            ${!isMax ? `<span class="stat-arrow">➔</span><span class="stat-next">${nextBonus}</span>` : ''}
          </div>
        </div>

        <div class="perk-action-row">
          <button
            type="button"
            class="btn-perk-upgrade ${isMax ? 'btn-perk-max' : ''}"
            data-action="upgrade-hotm-perk"
            data-perk="${perk.id}"
            ${!canAfford || isMax ? 'disabled' : ''}
          >
            ${isMax ? `
              <span class="perk-btn-label">MAX TIER</span>
            ` : `
              <span class="perk-btn-label">Upgrade</span>
              <span class="perk-cost-tag">
                <span class="cost-powder-icon">🟣</span>
                <span class="cost-amount">${Math.floor(cost).toLocaleString()}</span>
              </span>
            `}
          </button>
        </div>
      </div>
    `;
  }).join('');
}


/**
 * @file ui.js
 * @description Modular UI controller for the idle mining simulator.
 * Handles DOM rendering, reactive state projections, progress bar animations,
 * bottom-sheet miner modal, inventory sheet with "Sell All", and upgrades shop.
 */

import { ORES } from './data/ores.js';
import { UPGRADES, getUpgradeCost } from './data/upgrades.js';
import {
  getMinerDefinition,
  calculateMinePower,
  getEffectiveRequiredLevel,
  getOreDefinition,
  gameState
} from './state.js';
import {
  STATIONS,
  getStationUpgradeCost,
  getHireMinerCost,
  STATION_MILESTONES,
  getMilestoneProgressInfo,
  getNextMilestone,
  calculateCostForNLevels,
  calculateMaxAffordableLevels
} from './stations.js';
import {
  createFloatingText,
  createRockImpactParticles,
  triggerOreNodePunch,
  getStationRockCoords,
  getStationParticleColor
} from './juice.js';
import { formatNumber } from './utils/format.js';

export { formatNumber };

// DOM Element Cache for high-frequency updates
let elements = null;

// Cache mapping mineId -> progress bar DOM elements to prevent querySelector overhead in tick loops
const mineProgressCache = new Map();

// Active tab view tracking ('mines' | 'backpack' | 'shop' | 'forge' | 'settings')
let activeView = 'mines';

// Active selection context for the bottom-sheet miner modal
let currentModalContext = {
  mineId: null,
  slotIndex: null
};

// Registered event handler callbacks
let eventHandlers = {
  onAssignMiner: null,
  onRemoveMiner: null,
  onToggleMine: null,
  onSellAllOres: null,
  onSellSingleOre: null,
  onBuyUpgrade: null
};

/**
 * Initializes and caches primary static DOM element references.
 */
function getElements() {
  if (!elements) {
    elements = {
      coins: document.getElementById('player-coins'),
      gems: document.getElementById('player-gems'),
      levelBadge: document.getElementById('player-level-badge'),
      xpFill: document.getElementById('player-xp-fill'),
      xpText: document.getElementById('player-xp-text'),
      minesListWrap: document.getElementById('mines-list-wrap'),
      minesStatusCount: document.getElementById('mines-status-count'),
      backpackContentWrap: document.getElementById('backpack-content-wrap'),
      shopContentWrap: document.getElementById('shop-content-wrap'),
      modalOverlay: document.getElementById('miner-modal-overlay'),
      modalSubtitle: document.getElementById('modal-subtitle'),
      modalMinersList: document.getElementById('modal-miners-list'),
      modalCloseBtn: document.getElementById('modal-close-btn'),
      modalBackdrop: document.getElementById('modal-backdrop'),
      navItems: document.querySelectorAll('.bottom-nav .nav-item'),
      views: {
        mines: document.getElementById('view-mines'),
        backpack: document.getElementById('view-backpack'),
        shop: document.getElementById('view-shop'),
        forge: document.getElementById('view-forge'),
        settings: document.getElementById('view-settings')
      }
    };
  }
  return elements;
}

/**
 * Updates player economy, level badge, and XP bar in the top header.
 * @param {{ name: string, level: number, xp: number, xpNeeded: number, coins: number, gems: number }} player
 */
export function updateHeader(player) {
  const els = getElements();
  if (!els.coins || !player) return;

  els.coins.textContent = formatNumber(player.coins);
  els.gems.textContent = formatNumber(player.gems);
  els.levelBadge.textContent = `Lv. ${player.level}`;

  const xpPercentage = Math.min(100, Math.max(0, (player.xp / player.xpNeeded) * 100));
  els.xpFill.style.width = `${xpPercentage.toFixed(1)}%`;
  els.xpText.textContent = `${player.xp} / ${player.xpNeeded} XP`;

  // Update Surface Zone indicators
  const surfaceCoins = document.getElementById('surface-coins-val');
  if (surfaceCoins) {
    surfaceCoins.textContent = formatNumber(player.coins);
  }

  const capText = document.getElementById('surface-capacity-text');
  const capFill = document.getElementById('surface-capacity-fill');
  if (capText && capFill && gameState?.inventory) {
    const totalOres = Object.values(gameState.inventory).reduce((a, b) => a + b, 0);
    const maxCapacity = 20;
    capText.textContent = `${totalOres} / ${maxCapacity}`;
    capFill.style.width = `${Math.min(100, (totalOres / maxCapacity) * 100)}%`;
  }

  // Live-update station upgrade, unlock, and miner hire button affordability states
  updateStationButtonsState(player.coins);
}

// Active multi-buy mode ('1x' | '10x' | 'MAX')
let currentBuyMode = '1x';

/**
 * Returns the active multi-buy mode.
 * @returns {'1x' | '10x' | 'MAX'}
 */
export function getBuyMode() {
  return currentBuyMode;
}

/**
 * Sets the active multi-buy mode and updates station buttons.
 * @param {'1x' | '10x' | 'MAX'} mode
 */
export function setBuyMode(mode) {
  if (['1x', '10x', 'MAX'].includes(mode)) {
    currentBuyMode = mode;
    updateBuyModeDOM();
    updateStationButtonsState();
  }
}

/**
 * Synchronizes the active visual state on .btn-buy-mode buttons.
 */
export function updateBuyModeDOM() {
  if (typeof document === 'undefined') return;
  const buttons = document.querySelectorAll('.btn-buy-mode');
  buttons.forEach(btn => {
    const mode = btn.getAttribute('data-buy-mode');
    const isActive = mode === currentBuyMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

/**
 * Dynamically updates enabled/disabled, labels, and visual affordability states for
 * station upgrade buttons (reflecting 1x, 10x, and MAX modes), unlock buttons, and the miner recruitment button.
 * @param {number} [playerCoins]
 */
export function updateStationButtonsState(playerCoins = (gameState?.player?.coins || 0)) {
  if (typeof document === 'undefined') return;

  // 1. Station upgrade & unlock buttons
  for (const station of STATIONS) {
    if (station.unlocked) {
      const upgradeBtn = document.getElementById(`upgrade-btn-${station.id}`) ||
                         document.querySelector(`[data-action="upgrade-station"][data-station="${station.id}"]`);
      if (upgradeBtn) {
        const actionTextEl = upgradeBtn.querySelector('.upgrade-action-text');
        const levelBadgeEl = document.getElementById(`level-badge-${station.id}`) || upgradeBtn.querySelector('.upgrade-level-badge');
        const costEl = document.getElementById(`cost-${station.id}`) || upgradeBtn.querySelector('.cost-amount');

        if (currentBuyMode === '10x') {
          const cost10 = calculateCostForNLevels(station, 10);
          if (actionTextEl) actionTextEl.textContent = '+10 Lvs';
          if (levelBadgeEl) levelBadgeEl.textContent = `Lv. ${station.level} ➔ ${station.level + 10}`;
          if (costEl && costEl.textContent !== formatNumber(cost10)) {
            costEl.textContent = formatNumber(cost10);
          }
          upgradeBtn.disabled = playerCoins < cost10;
        } else if (currentBuyMode === 'MAX') {
          const maxAffordable = calculateMaxAffordableLevels(station, playerCoins);
          if (maxAffordable.levels > 0) {
            if (actionTextEl) actionTextEl.textContent = `+${maxAffordable.levels} Lvs`;
            if (levelBadgeEl) levelBadgeEl.textContent = `Lv. ${station.level} ➔ ${station.level + maxAffordable.levels}`;
            if (costEl && costEl.textContent !== formatNumber(maxAffordable.cost)) {
              costEl.textContent = formatNumber(maxAffordable.cost);
            }
            upgradeBtn.disabled = false;
          } else {
            const cost1 = getStationUpgradeCost(station);
            if (actionTextEl) actionTextEl.textContent = '+0 Lvs';
            if (levelBadgeEl) levelBadgeEl.textContent = `Lv. ${station.level}`;
            if (costEl && costEl.textContent !== formatNumber(cost1)) {
              costEl.textContent = formatNumber(cost1);
            }
            upgradeBtn.disabled = true;
          }
        } else {
          // Default: 1x mode
          const cost1 = getStationUpgradeCost(station);
          if (actionTextEl && actionTextEl.textContent !== 'Level Up') {
            actionTextEl.textContent = 'Level Up';
          }
          if (levelBadgeEl) {
            levelBadgeEl.textContent = `Lv. ${station.level}`;
          }
          if (costEl && costEl.textContent !== formatNumber(cost1)) {
            costEl.textContent = formatNumber(cost1);
          }
          upgradeBtn.disabled = playerCoins < cost1;
        }
      }
    } else {
      const unlockBtn = document.getElementById(`unlock-btn-${station.id}`) ||
                        document.querySelector(`[data-action="unlock-station"][data-station="${station.id}"]`);
      if (unlockBtn) {
        unlockBtn.disabled = playerCoins < station.unlockCost;
      }
    }

    // Refresh milestone progress indicator
    const milestoneEl = document.getElementById(`milestone-text-${station.id}`);
    const milestonePill = document.getElementById(`milestone-${station.id}`);
    if (milestoneEl) {
      const progress = getMilestoneProgressInfo(station.level);
      if (milestoneEl.textContent !== progress.text) {
        milestoneEl.textContent = progress.text;
      }
      if (milestonePill) {
        if (progress.isMax) {
          milestonePill.classList.add('milestone-max');
        } else {
          milestonePill.classList.remove('milestone-max');
        }
      }
    }
  }

  // 2. Hire Miner button
  const hireBtn = document.getElementById('hire-miner-btn');
  if (hireBtn) {
    const hireCost = getHireMinerCost();
    const hireCostEl = document.getElementById('hire-miner-cost');
    if (hireCostEl) {
      hireCostEl.textContent = `🪙 ${formatNumber(hireCost)}`;
    }
    hireBtn.disabled = playerCoins < hireCost;
  }
}

/**
 * Displays a floating level-up indicator badge over a station platform upon upgrade.
 * @param {string} stationId
 * @param {number} newLevel
 * @param {number} [levelsBought=1]
 */
export function showLevelUpBadge(stationId, newLevel, levelsBought = 1) {
  if (typeof document === 'undefined') return;

  const stationEl = document.getElementById(stationId);
  if (!stationEl) return;

  const badge = document.createElement('div');
  badge.className = 'level-up-float-badge';
  badge.textContent = levelsBought > 1 ? `⭐ +${levelsBought} Lvs UP! (Lv. ${newLevel})` : `⭐ Lv. ${newLevel} UP!`;

  const button = stationEl.querySelector('.btn-station-upgrade') || stationEl;
  badge.style.left = `${button.offsetLeft + (button.offsetWidth / 2)}px`;
  badge.style.top = `${button.offsetTop - 12}px`;

  stationEl.appendChild(badge);

  const cleanup = () => {
    if (badge.parentNode) {
      badge.parentNode.removeChild(badge);
    }
  };

  badge.addEventListener('animationend', cleanup, { once: true });
  setTimeout(cleanup, 1250);
}

/**
 * Triggers an animated celebratory banner and particle burst when reaching a major station milestone
 * (Level 10, 25, 50, 100).
 * @param {string} stationId
 * @param {string} [bannerText="MILESTONE REACHED!"]
 */
export function triggerMilestoneCelebration(stationId, bannerText = 'MILESTONE REACHED!') {
  if (typeof document === 'undefined') return;

  const stage = document.getElementById('mine-stage');
  const stationEl = document.getElementById(stationId);
  if (!stage) return;

  // 1. Spawns the central glowing milestone celebration banner
  const banner = document.createElement('div');
  banner.className = 'milestone-celebration-banner';
  banner.textContent = `🎉 ${bannerText}`;

  if (stationEl) {
    const stationTop = stationEl.offsetTop;
    banner.style.top = `${Math.max(50, stationTop - 20)}px`;
  }

  stage.appendChild(banner);

  const cleanupBanner = () => {
    if (banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  };
  banner.addEventListener('animationend', cleanupBanner, { once: true });
  setTimeout(cleanupBanner, 2000);

  // 2. Celebratory sparkles / confetti particles around station rock
  const rockCoords = getStationRockCoords(stationId);
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      createRockImpactParticles(rockCoords.x + (Math.random() * 24 - 12), rockCoords.y + (Math.random() * 20 - 10), '#facc15');
    }, i * 75);
  }

  // 3. Spawns upward floating gold text
  createFloatingText(rockCoords.x, rockCoords.y - 30, bannerText, '#facc15');
}

// Bind to window for cross-module invocations
if (typeof window !== 'undefined') {
  window.triggerMilestoneCelebration = triggerMilestoneCelebration;
}

/**
 * Updates the milestone progress indicators on all station cards.
 */
export function updateMilestoneIndicators() {
  if (typeof document === 'undefined') return;

  for (const station of STATIONS) {
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
  }
}

/**
 * Switches the active viewport section tab.
 * @param {string} viewName
 * @param {Object} [stateContext] - Current gameState to refresh the opened view
 */
export function switchView(viewName, stateContext) {
  const els = getElements();
  if (!els.views[viewName]) return;

  activeView = viewName;

  // Toggle active class on views
  Object.keys(els.views).forEach(key => {
    const viewEl = els.views[key];
    if (viewEl) {
      if (key === viewName) {
        viewEl.classList.remove('hidden');
        viewEl.classList.add('active');
      } else {
        viewEl.classList.add('hidden');
        viewEl.classList.remove('active');
      }
    }
  });

  // Toggle active class on navigation tabs
  els.navItems.forEach(item => {
    const target = item.getAttribute('data-nav-target');
    if (target === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Re-render contents of newly selected view if context is provided
  if (stateContext) {
    if (viewName === 'backpack') {
      renderBackpack(stateContext.inventory);
    } else if (viewName === 'shop') {
      renderShop(stateContext.upgrades, stateContext.player.coins);
    }
  }
}

/**
 * Returns the currently active navigation view identifier.
 * @returns {string}
 */
export function getActiveView() {
  return activeView;
}

/**
 * Dynamically builds and renders the FWOG GM-styled mine cards into `#mines-container`.
 *
 * @param {readonly import('./data/mines.js').Mine[]} mines - Data catalog of mines
 * @param {Record<string, any>} activeMines - Runtime state of each mine
 * @param {import('./state.js').MinerInstance[]} miners - Player's owned miners
 * @param {typeof import('./state.js').gameState.player} player - Current player progression state
 */
export function renderMinesList(mines, activeMines, miners, player) {
  const els = getElements();
  if (!els.minesListWrap) return;

  mineProgressCache.clear();
  let activeExpeditionCount = 0;

  const cardsHtml = mines.map(mine => {
    const mineState = activeMines[mine.id] || {
      isMining: false,
      currentDurability: mine.totalDurability,
      totalDurability: mine.totalDurability,
      assignedMiners: [null, null, null, null]
    };

    const effectiveReqLevel = getEffectiveRequiredLevel(mine);
    const isLocked = player.level < effectiveReqLevel;
    const isMining = mineState.isMining && !isLocked;
    if (isMining) activeExpeditionCount++;

    const totalPower = calculateMinePower(mine.id);
    const assignedCount = mineState.assignedMiners.filter(Boolean).length;
    const progressPercent = Math.max(
      0,
      Math.min(100, ((mine.totalDurability - mineState.currentDurability) / mine.totalDurability) * 100)
    );

    // Render 4 miner slots
    let slotsHtml = '';
    for (let slotIndex = 0; slotIndex < mine.maxSlots; slotIndex++) {
      if (isLocked) {
        slotsHtml += `
          <div class="miner-slot locked" aria-hidden="true">
            <span class="slot-lock-icon">🔒</span>
          </div>
        `;
      } else {
        const assignedInstanceId = mineState.assignedMiners[slotIndex];
        const assignedMiner = assignedInstanceId
          ? miners.find(m => m.instanceId === assignedInstanceId)
          : null;

        if (assignedMiner) {
          const minerDef = getMinerDefinition(assignedMiner.minerId);
          const icon = minerDef ? minerDef.iconUrl : '⛏️';
          const name = minerDef ? minerDef.name : 'Miner';

          slotsHtml += `
            <div class="miner-slot filled" title="${name}">
              <div class="miner-avatar">${icon}</div>
              <span class="slot-badge">Lv. ${assignedMiner.level}</span>
              <button
                type="button"
                class="slot-remove-btn"
                title="Remove Miner"
                aria-label="Remove ${name}"
                data-action="remove-miner"
                data-mine-id="${mine.id}"
                data-slot-index="${slotIndex}"
              >&times;</button>
            </div>
          `;
        } else {
          slotsHtml += `
            <button
              type="button"
              class="miner-slot empty"
              aria-label="Assign miner to slot ${slotIndex + 1}"
              data-action="open-miner-modal"
              data-mine-id="${mine.id}"
              data-slot-index="${slotIndex}"
            >
              <span class="slot-add-icon">+</span>
            </button>
          `;
        }
      }
    }

    // Action button state
    let actionBtnHtml = '';
    if (isLocked) {
      actionBtnHtml = `
        <button class="btn btn-disabled" type="button" disabled>
          <span>Requires Lv. ${effectiveReqLevel}</span>
        </button>
      `;
    } else if (isMining) {
      actionBtnHtml = `
        <button
          class="btn btn-danger-action"
          type="button"
          data-action="toggle-mine"
          data-mine-id="${mine.id}"
        >
          <span class="btn-icon">⏹</span>
          <span>Stop Mining</span>
        </button>
      `;
    } else if (assignedCount > 0) {
      actionBtnHtml = `
        <button
          class="btn btn-start-action"
          type="button"
          data-action="toggle-mine"
          data-mine-id="${mine.id}"
        >
          <span class="btn-icon">▶</span>
          <span>Start Mining</span>
        </button>
      `;
    } else {
      actionBtnHtml = `
        <button
          class="btn btn-start-action"
          type="button"
          style="opacity: 0.6;"
          data-action="open-miner-modal"
          data-mine-id="${mine.id}"
          data-slot-index="0"
        >
          <span>+ Assign Miners First</span>
        </button>
      `;
    }

    if (isLocked) {
      return `
        <article class="mine-card locked-mine" id="card-${mine.id}">
          <div class="locked-banner-overlay"></div>
          <div class="mine-card-header">
            <div class="mine-heading">
              <h3 class="mine-title">${mine.name}</h3>
              <p class="mine-depth">${mine.description}</p>
            </div>
            <span class="badge badge-locked">🔒 Requires Lv. ${effectiveReqLevel}</span>
          </div>

          <div class="miner-slots-section">
            <div class="slots-header">
              <span class="slots-label text-muted">Miner Slots (Locked)</span>
            </div>
            <div class="miner-slots-grid">
              ${slotsHtml}
            </div>
          </div>

          <div class="locked-message-box">
            <span class="lock-big-icon">🗝️</span>
            <p class="lock-requirement-text">Reach Player Level ${effectiveReqLevel} to explore and excavate this zone.</p>
          </div>

          <div class="mine-card-footer">
            ${actionBtnHtml}
          </div>
        </article>
      `;
    }

    return `
      <article class="mine-card active-mine" id="card-${mine.id}">
        <div class="mine-card-header">
          <div class="mine-heading">
            <h3 class="mine-title">${mine.name}</h3>
            <p class="mine-depth">${mine.description}</p>
          </div>
          <span class="badge badge-rec-level">Lv. ${effectiveReqLevel}+</span>
        </div>

        <div class="miner-slots-section">
          <div class="slots-header">
            <span class="slots-label">Assigned Miners (${assignedCount}/${mine.maxSlots})</span>
            <span class="mining-rate-badge" id="rate-${mine.id}">
              ${totalPower > 0 ? `+${totalPower} Power` : 'Idle'}
            </span>
          </div>
          <div class="miner-slots-grid">
            ${slotsHtml}
          </div>
        </div>

        <div class="mine-progress-section">
          <div class="progress-info">
            <span class="progress-status" id="status-${mine.id}">
              ${isMining ? 'Excavating Vein...' : 'Excavation Paused'}
            </span>
            <span class="progress-percentage" id="percent-${mine.id}">
              ${Math.floor(progressPercent)}%
            </span>
          </div>
          <div class="progress-track">
            <div
              class="progress-fill ${isMining ? 'pulsing-progress' : ''}"
              id="fill-${mine.id}"
              style="width: ${progressPercent.toFixed(1)}%;"
            >
              <div class="progress-glow"></div>
            </div>
          </div>
        </div>

        <div class="mine-card-footer">
          ${actionBtnHtml}
        </div>
      </article>
    `;
  }).join('');

  els.minesListWrap.innerHTML = cardsHtml;

  if (els.minesStatusCount) {
    els.minesStatusCount.textContent = `${activeExpeditionCount} Active`;
  }

  // Populate progress elements cache
  mines.forEach(mine => {
    const fillEl = document.getElementById(`fill-${mine.id}`);
    const percentEl = document.getElementById(`percent-${mine.id}`);
    const statusEl = document.getElementById(`status-${mine.id}`);
    const rateEl = document.getElementById(`rate-${mine.id}`);

    if (fillEl && percentEl) {
      mineProgressCache.set(mine.id, {
        fillEl,
        percentEl,
        statusEl,
        rateEl
      });
    }
  });
}

/**
 * Smoothly adjusts the width percentage and status text of a mine's progress bar.
 * @param {string} mineId
 * @param {number} currentDurability
 * @param {number} totalDurability
 */
export function updateMineProgress(mineId, currentDurability, totalDurability) {
  let cached = mineProgressCache.get(mineId);

  if (!cached) {
    const fillEl = document.getElementById(`fill-${mineId}`);
    const percentEl = document.getElementById(`percent-${mineId}`);
    const statusEl = document.getElementById(`status-${mineId}`);
    const rateEl = document.getElementById(`rate-${mineId}`);

    if (fillEl && percentEl) {
      cached = { fillEl, percentEl, statusEl, rateEl };
      mineProgressCache.set(mineId, cached);
    } else {
      return;
    }
  }

  const progressPercent = Math.max(
    0,
    Math.min(100, ((totalDurability - currentDurability) / totalDurability) * 100)
  );

  cached.fillEl.style.width = `${progressPercent.toFixed(1)}%`;
  cached.percentEl.textContent = `${Math.floor(progressPercent)}%`;
}

/**
 * Renders the Backpack / Inventory view showing collected ores and Sell All button.
 * @param {Record<string, number>} inventory
 */
export function renderBackpack(inventory) {
  const els = getElements();
  if (!els.backpackContentWrap) return;

  let totalItemsCount = 0;
  let estimatedTotalValue = 0;

  for (const ore of ORES) {
    const count = inventory[ore.id] || 0;
    totalItemsCount += count;
    estimatedTotalValue += count * ore.sellValue;
  }

  const hasItems = totalItemsCount > 0;

  const oresListHtml = ORES.map(ore => {
    const count = inventory[ore.id] || 0;
    const rarityClass = `rarity-${ore.rarity.toLowerCase()}`;

    return `
      <div class="ore-item-card">
        <div class="ore-info-group">
          <div class="ore-swatch" style="background: ${ore.colorHex}22; border-color: ${ore.colorHex}; color: ${ore.colorHex};">
            ⛏️
          </div>
          <div class="ore-details">
            <div class="ore-name-row">
              <span class="ore-name">${ore.name}</span>
              <span class="badge badge-rarity ${rarityClass}">${ore.rarity}</span>
            </div>
            <span class="ore-pricing">${formatNumber(ore.sellValue)} 🪙 each</span>
          </div>
        </div>
        <div class="ore-actions">
          <span class="ore-count-badge">x ${formatNumber(count)}</span>
          <button
            type="button"
            class="btn-sell-single"
            ${count === 0 ? 'disabled' : ''}
            data-action="sell-single-ore"
            data-ore-id="${ore.id}"
            data-ore-qty="${count}"
            title="Sell all ${ore.name}"
          >
            Sell (${formatNumber(count * ore.sellValue)} 🪙)
          </button>
        </div>
      </div>
    `;
  }).join('');

  els.backpackContentWrap.innerHTML = `
    <!-- Inventory Valuation Summary Card -->
    <div class="inventory-summary-card">
      <div class="summary-row">
        <div class="summary-meta">
          <span class="summary-title">Total Extracted Ores</span>
          <span class="summary-value" style="color: var(--text-primary);">${formatNumber(totalItemsCount)} units</span>
        </div>
        <div class="summary-meta" style="text-align: right;">
          <span class="summary-title">Estimated Value</span>
          <span class="summary-value">${formatNumber(estimatedTotalValue)} 🪙</span>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-sell-all"
        data-action="sell-all-ores"
        ${!hasItems ? 'disabled' : ''}
      >
        <span>🪙 Sell All Ores (+${formatNumber(estimatedTotalValue)} Coins)</span>
      </button>
    </div>

    <!-- Ores Grid / List -->
    <div class="inventory-list">
      ${oresListHtml}
    </div>
  `;
}

/**
 * Renders the Upgrades Shop view displaying purchasable global upgrades.
 * @param {Record<string, number>} currentUpgrades
 * @param {number} playerCoins
 */
export function renderShop(currentUpgrades, playerCoins) {
  const els = getElements();
  if (!els.shopContentWrap) return;

  const upgradesHtml = UPGRADES.map(upgrade => {
    const level = currentUpgrades ? (currentUpgrades[upgrade.id] || 0) : 0;
    const isMax = level >= upgrade.maxLevel;
    const cost = getUpgradeCost(upgrade, level);
    const canAfford = playerCoins >= cost && !isMax;

    const currentBuffText = level === 0 ? 'None (Tier 0)' : upgrade.formatEffect(level);
    const nextBuffText = isMax ? 'MAX TIER' : upgrade.formatEffect(level + 1);

    return `
      <div class="upgrade-card">
        <div class="upgrade-header">
          <div class="upgrade-title-group">
            <div class="upgrade-icon">${upgrade.icon}</div>
            <div>
              <h4 class="upgrade-name">${upgrade.name}</h4>
              <span class="upgrade-desc">${upgrade.description}</span>
            </div>
          </div>
          <span class="upgrade-tier-badge ${isMax ? 'max-tier' : ''}">
            ${isMax ? 'MAX' : `Tier ${level} / ${upgrade.maxLevel}`}
          </span>
        </div>

        <div class="upgrade-effects-row">
          <span class="effect-current">Current: <strong>${currentBuffText}</strong></span>
          <span class="effect-next">${isMax ? '🏆 Maxed' : `Next: +${nextBuffText}`}</span>
        </div>

        <div class="upgrade-action-row">
          <button
            type="button"
            class="btn btn-buy-upgrade"
            data-action="buy-upgrade"
            data-upgrade-id="${upgrade.id}"
            ${!canAfford ? 'disabled' : ''}
          >
            ${isMax
              ? '<span>Max Tier Reached</span>'
              : canAfford
                ? `<span>Upgrade for ${formatNumber(cost)} 🪙</span>`
                : `<span>Requires ${formatNumber(cost)} 🪙</span>`
            }
          </button>
        </div>
      </div>
    `;
  }).join('');

  els.shopContentWrap.innerHTML = `
    <div class="shop-list">
      ${upgradesHtml}
    </div>
  `;
}

/**
 * Displays the bottom-sheet modal for miner selection.
 * @param {string} mineId
 * @param {number} slotIndex
 * @param {import('./state.js').MinerInstance[]} unassignedMiners
 */
export function openMinerSelectionModal(mineId, slotIndex, unassignedMiners) {
  const els = getElements();
  if (!els.modalOverlay) return;

  currentModalContext = { mineId, slotIndex };

  if (els.modalSubtitle) {
    els.modalSubtitle.textContent = `Select a miner for Slot ${Number(slotIndex) + 1}`;
  }

  if (unassignedMiners.length === 0) {
    els.modalMinersList.innerHTML = `
      <div class="modal-empty-state">
        <span class="modal-empty-icon">👷</span>
        <p class="modal-empty-text">
          No available idle miners.<br>
          Unassign a miner from an existing mine or recruit more from the Shop!
        </p>
      </div>
    `;
  } else {
    els.modalMinersList.innerHTML = unassignedMiners.map(miner => {
      const def = getMinerDefinition(miner.minerId);
      if (!def) return '';

      return `
        <div class="modal-miner-card">
          <div class="modal-miner-info">
            <div class="modal-miner-avatar">${def.iconUrl}</div>
            <div class="modal-miner-details">
              <span class="modal-miner-name">${def.name} (Lv. ${miner.level})</span>
              <span class="modal-miner-stats">
                <span>⚡ +${Math.round(def.miningPower * (1 + (miner.level - 1) * 0.25))} Power</span>
                <span class="modal-miner-tier">• Tier ${def.tier}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-assign-miner"
            data-action="confirm-assign-miner"
            data-instance-id="${miner.instanceId}"
          >
            Deploy
          </button>
        </div>
      `;
    }).join('');
  }

  els.modalOverlay.classList.remove('hidden');
  els.modalOverlay.setAttribute('aria-hidden', 'false');
}

/**
 * Dismisses the bottom-sheet miner selection modal.
 */
export function closeMinerSelectionModal() {
  const els = getElements();
  if (!els.modalOverlay) return;

  els.modalOverlay.classList.add('hidden');
  els.modalOverlay.setAttribute('aria-hidden', 'true');
  currentModalContext = { mineId: null, slotIndex: null };
}

/**
 * Displays the welcoming modal reporting offline excavation gains and rewards.
 * @param {{ totalCoins: number, oresGained: Record<string, number>, timeElapsed: string, totalXp: number }} summary
 * @param {() => void} [onClaim]
 */
export function showOfflineProgressModal(summary, onClaim) {
  const overlay = document.getElementById('offline-modal-overlay');
  const body = document.getElementById('offline-modal-body');
  const claimBtn = document.getElementById('offline-claim-btn');
  if (!overlay || !body || !claimBtn) return;

  const oresEntries = Object.entries(summary.oresGained || {}).filter(([_, count]) => count > 0);

  let oresHtml = '';
  if (oresEntries.length > 0) {
    oresHtml = oresEntries.map(([oreId, count]) => {
      const ore = getOreDefinition(oreId);
      const name = ore ? ore.name : oreId;
      const color = ore ? ore.colorHex : '#ffffff';
      return `
        <div class="offline-loot-card">
          <div class="offline-loot-info">
            <span style="color: ${color}; font-size: 1.1rem;">⛏️</span>
            <span class="offline-loot-name">${name}</span>
          </div>
          <span class="offline-loot-amount">+${formatNumber(count)}</span>
        </div>
      `;
    }).join('');
  } else {
    oresHtml = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 6px 0;">
        No whole ore veins completed during this duration.
      </div>
    `;
  }

  body.innerHTML = `
    <div class="offline-time-banner">
      While you were away for <strong>${summary.timeElapsed}</strong>, your miners gathered:
    </div>

    <div class="offline-loot-grid">
      <!-- Coins earned -->
      <div class="offline-loot-card" style="border-color: rgba(245, 166, 35, 0.4);">
        <div class="offline-loot-info">
          <span style="font-size: 1.1rem;">🪙</span>
          <span class="offline-loot-name">Coins</span>
        </div>
        <span class="offline-loot-amount">+${formatNumber(summary.totalCoins)}</span>
      </div>

      <!-- Experience earned -->
      <div class="offline-loot-card" style="border-color: rgba(45, 112, 246, 0.4);">
        <div class="offline-loot-info">
          <span style="font-size: 1.1rem;">⚡</span>
          <span class="offline-loot-name">Experience</span>
        </div>
        <span class="offline-loot-amount" style="color: #60a5fa;">+${formatNumber(summary.totalXp)} XP</span>
      </div>

      <!-- Ores gained -->
      ${oresHtml}
    </div>
  `;

  const handleClaim = () => {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    claimBtn.removeEventListener('click', handleClaim);
    if (onClaim) onClaim();
  };

  claimBtn.onclick = handleClaim;

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}


/**
 * Attaches delegated top-level event listeners for miner assignments,
 * card actions, tab navigation, inventory selling, and upgrades.
 *
 * @param {Object} handlers
 * @param {(mineId: string, slotIndex: number, instanceId: string) => void} handlers.onAssignMiner
 * @param {(mineId: string, slotIndex: number) => void} handlers.onRemoveMiner
 * @param {(mineId: string) => void} handlers.onToggleMine
 * @param {() => void} handlers.onSellAllOres
 * @param {(oreId: string, quantity: number) => void} handlers.onSellSingleOre
 * @param {(upgradeId: string) => void} handlers.onBuyUpgrade
 * @param {(tabName: string) => void} handlers.onSwitchTab
 * @param {() => import('./state.js').MinerInstance[]} handlers.getUnassignedMiners
 */
export function initEventListeners(handlers) {
  eventHandlers = handlers;
  const els = getElements();

  if (els.modalCloseBtn) {
    els.modalCloseBtn.addEventListener('click', closeMinerSelectionModal);
  }

  if (els.modalBackdrop) {
    els.modalBackdrop.addEventListener('click', closeMinerSelectionModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMinerSelectionModal();
    }
  });

  // Bottom Navigation Click Handlers
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    bottomNav.addEventListener('click', (event) => {
      const navItem = /** @type {HTMLElement} */ (event.target).closest('[data-nav-target]');
      if (!navItem) return;

      event.preventDefault();
      const targetView = navItem.getAttribute('data-nav-target');
      if (targetView && handlers.onSwitchTab) {
        handlers.onSwitchTab(targetView);
      }
    });
  }

  // Multi-Buy Toggle Mode Bar Handlers
  const buyModeBar = document.getElementById('buy-mode-bar');
  if (buyModeBar) {
    buyModeBar.addEventListener('click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      const btn = target.closest('[data-buy-mode]');
      if (!btn) return;
      const mode = btn.getAttribute('data-buy-mode');
      if (mode) {
        setBuyMode(mode);
      }
    });
  }

  // Delegated click handler across #app-container
  const appContainer = document.getElementById('app-container');
  if (!appContainer) return;

  // Rapid Hold-to-Upgrade Engine
  let holdTimer = null;
  let holdInterval = null;
  let activeHoldButton = null;
  let lastHoldActionTimestamp = 0;

  function stopHoldingUpgrade() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
    if (activeHoldButton) {
      activeHoldButton.classList.remove('holding-purchase');
      activeHoldButton = null;
    }
  }

  function executeHoldUpgrade(stationId) {
    if (!handlers.onUpgradeStation) return;
    handlers.onUpgradeStation(stationId, currentBuyMode);
  }

  // Bind pointerdown for instant response and repeat loop
  appContainer.addEventListener('pointerdown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const upgradeBtn = target.closest('[data-action="upgrade-station"]');
    if (!upgradeBtn || upgradeBtn.disabled) return;

    const stationId = upgradeBtn.getAttribute('data-station');
    if (!stationId) return;

    stopHoldingUpgrade();
    activeHoldButton = upgradeBtn;
    upgradeBtn.classList.add('holding-purchase');
    lastHoldActionTimestamp = Date.now();

    // Execute first upgrade immediately
    executeHoldUpgrade(stationId);

    // After 300ms hold debounce, repeatedly purchase every 100ms
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(() => {
        if (!activeHoldButton || activeHoldButton.disabled) {
          stopHoldingUpgrade();
          return;
        }
        executeHoldUpgrade(stationId);
      }, 100);
    }, 300);
  });

  // Release hold on pointer release or cancellation
  window.addEventListener('pointerup', stopHoldingUpgrade);
  window.addEventListener('pointercancel', stopHoldingUpgrade);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopHoldingUpgrade();
  });

  appContainer.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const actionBtn = target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');

    switch (action) {
      case 'open-miner-modal': {
        const mineId = actionBtn.getAttribute('data-mine-id');
        const slotIndex = parseInt(actionBtn.getAttribute('data-slot-index') || '0', 10);
        if (mineId !== null && handlers.getUnassignedMiners) {
          const unassigned = handlers.getUnassignedMiners();
          openMinerSelectionModal(mineId, slotIndex, unassigned);
        }
        break;
      }

      case 'confirm-assign-miner': {
        const instanceId = actionBtn.getAttribute('data-instance-id');
        if (instanceId && currentModalContext.mineId !== null && handlers.onAssignMiner) {
          handlers.onAssignMiner(
            currentModalContext.mineId,
            currentModalContext.slotIndex,
            instanceId
          );
          closeMinerSelectionModal();
        }
        break;
      }

      case 'remove-miner': {
        event.stopPropagation();
        const mineId = actionBtn.getAttribute('data-mine-id');
        const slotIndex = parseInt(actionBtn.getAttribute('data-slot-index') || '0', 10);
        if (mineId && handlers.onRemoveMiner) {
          handlers.onRemoveMiner(mineId, slotIndex);
        }
        break;
      }

      case 'toggle-mine': {
        const mineId = actionBtn.getAttribute('data-mine-id');
        if (mineId && handlers.onToggleMine) {
          handlers.onToggleMine(mineId);
        }
        break;
      }

      case 'sell-all-ores': {
        if (handlers.onSellAllOres) {
          handlers.onSellAllOres();
        }
        break;
      }

      case 'sell-single-ore': {
        const oreId = actionBtn.getAttribute('data-ore-id');
        const qty = parseInt(actionBtn.getAttribute('data-ore-qty') || '0', 10);
        if (oreId && qty > 0 && handlers.onSellSingleOre) {
          handlers.onSellSingleOre(oreId, qty);
        }
        break;
      }

      case 'buy-upgrade': {
        const upgradeId = actionBtn.getAttribute('data-upgrade-id');
        if (upgradeId && handlers.onBuyUpgrade) {
          handlers.onBuyUpgrade(upgradeId);
        }
        break;
      }

      case 'upgrade-station': {
        // If pointerdown executed within the last 350ms, avoid double trigger
        if (Date.now() - lastHoldActionTimestamp < 350) {
          break;
        }
        const stationId = actionBtn.getAttribute('data-station');
        if (stationId && handlers.onUpgradeStation) {
          handlers.onUpgradeStation(stationId, currentBuyMode);
        }
        break;
      }

      case 'unlock-station': {
        const stationId = actionBtn.getAttribute('data-station');
        if (stationId && handlers.onUnlockStation) {
          handlers.onUnlockStation(stationId);
        }
        break;
      }

      case 'hire-miner': {
        if (handlers.onHireMiner) {
          handlers.onHireMiner();
        }
        break;
      }

      default:
        break;
    }
  });

  // Direct interactive tap on Ore Node rocks (triggers squash punch, particles, & floating text)
  const mineStage = document.getElementById('mine-stage');
  if (mineStage) {
    mineStage.addEventListener('click', (event) => {
      const rock = /** @type {HTMLElement} */ (event.target).closest('.ore-node-rock');
      if (!rock) return;

      const platform = rock.closest('.station-platform');
      const stationId = platform ? platform.id : 'station-1';

      // 1. Squash-and-stretch punch animation
      triggerOreNodePunch(stationId);

      // 2. Retrigger chipRock damage shake animation
      rock.classList.remove('chip-damage');
      void rock.offsetWidth;
      rock.classList.add('chip-damage');

      // 3. Spawns 4-6 dispersing rock impact particles
      const coords = getStationRockCoords(stationId);
      const color = getStationParticleColor(stationId);
      createRockImpactParticles(coords.x, coords.y, color);

      // 4. Spawns floating +1 coin text via Juice system
      createFloatingText(coords.x, coords.y - 18, `+${formatNumber(1)} 🪙`, '#f5a623');
    });
  }
}


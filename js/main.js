/**
 * @file main.js
 * @description Application entry point for the idle mining simulator.
 * Wires data catalogs, reactive state, progression economy, storage persistence,
 * offline progress simulation, game loop, and UI controller.
 */

import { MINES } from './data/mines.js';
import { MINERS } from './data/miners.js';
import { ORES } from './data/ores.js';
import { UPGRADES } from './data/upgrades.js';
import {
  gameState,
  initStarterState,
  assignMinerToMine,
  removeMinerFromMine,
  toggleMiningState,
  getUnassignedMiners
} from './state.js';
import { startLoop } from './loop.js';
import {
  sellAllOres,
  sellOre,
  buyUpgrade,
  triggerCoinFloatAnimation
} from './economy.js';
import {
  saveGame,
  loadGame,
  calculateOfflineProgress,
  setupAutoSave
} from './storage.js';
import {
  updateHeader,
  renderMinesList,
  renderBackpack,
  renderShop,
  switchView,
  getActiveView,
  updateMineProgress,
  showOfflineProgressModal,
  showLevelUpBadge,
  triggerMilestoneCelebration,
  updateStationButtonsState,
  getBuyMode,
  initEventListeners
} from './ui.js';
import {
  unlockStation,
  upgradeStation,
  hireExtraMiner,
  syncStationsDOM
} from './stations.js';
import {
  initTycoonWorkers
} from './minerFSM.js';
import { createFloatingText } from './juice.js';
import { formatNumber } from './utils/format.js';


/**
 * Initializes the application on DOM ready.
 */
function initApp() {
  // 1. Attempt to load existing save game from localStorage
  const loadResult = loadGame();

  let offlineProgress = null;
  if (!loadResult.saveFound) {
    // Brand new game session: initialize starter loadout (Novice Digger & Surface Trench)
    initStarterState();
    saveGame(gameState);
  } else if (loadResult.lastSavedTimestamp) {
    // Existing game session: calculate offline progress accrued while absent
    offlineProgress = calculateOfflineProgress(gameState, loadResult.lastSavedTimestamp);
  }

  // 2. Initial header and view screens render
  updateHeader(gameState.player);
  renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
  renderBackpack(gameState.inventory);
  renderShop(gameState.upgrades, gameState.player.coins);
  syncStationsDOM();

  // 3. Initialize autonomous 2D Tycoon Miners on the Quarry Stage
  initTycoonWorkers(loadResult.workerCount || 2);
  updateStationButtonsState(gameState.player.coins);

  // 4. Display welcoming modal if offline progress was made
  if (offlineProgress) {
    showOfflineProgressModal(offlineProgress, () => {
      // On Claim: animate coins, update views and immediately save
      triggerCoinFloatAnimation(formatNumber(offlineProgress.totalCoins));
      updateHeader(gameState.player);
      renderBackpack(gameState.inventory);
      renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
      saveGame(gameState);
    });
  }

  // 4. Set up auto-save interval every 10 seconds and beforeunload window hook
  setupAutoSave(() => gameState, 10000);

  // 5. Bind delegated top-level click listeners for all interactive systems
  initEventListeners({
    onAssignMiner: (mineId, slotIndex, instanceId) => {
      const assigned = assignMinerToMine(mineId, slotIndex, instanceId);
      if (assigned) {
        renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
        saveGame(gameState);
      }
    },

    onRemoveMiner: (mineId, slotIndex) => {
      const removed = removeMinerFromMine(mineId, slotIndex);
      if (removed) {
        renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
        saveGame(gameState);
      }
    },

    onToggleMine: (mineId) => {
      toggleMiningState(mineId);
      renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
      saveGame(gameState);
    },

    onSellAllOres: () => {
      const result = sellAllOres();
      if (result.success) {
        updateHeader(gameState.player);
        renderBackpack(gameState.inventory);
        if (getActiveView() === 'shop') {
          renderShop(gameState.upgrades, gameState.player.coins);
        }
        saveGame(gameState);
      }
    },

    onSellSingleOre: (oreId, qty) => {
      const result = sellOre(oreId, qty);
      if (result.success) {
        updateHeader(gameState.player);
        renderBackpack(gameState.inventory);
        if (getActiveView() === 'shop') {
          renderShop(gameState.upgrades, gameState.player.coins);
        }
        saveGame(gameState);
      }
    },

    onBuyUpgrade: (upgradeId) => {
      const result = buyUpgrade(upgradeId);
      if (result.success) {
        updateHeader(gameState.player);
        renderShop(gameState.upgrades, gameState.player.coins);
        renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
        saveGame(gameState);
      }
    },

    onUpgradeStation: (stationId, mode) => {
      const activeMode = mode || getBuyMode();
      const res = upgradeStation(stationId, activeMode);
      if (res.success) {
        showLevelUpBadge(stationId, res.newLevel, res.levelsBought);
        if (res.milestone) {
          triggerMilestoneCelebration(stationId, res.milestone.banner);
        }
        triggerCoinFloatAnimation(`-${formatNumber(res.cost)} 🪙`);
        updateHeader(gameState.player);
        saveGame(gameState);
      }
    },

    onUnlockStation: (stationId) => {
      const res = unlockStation(stationId);
      if (res.success) {
        showLevelUpBadge(stationId, 1);
        triggerCoinFloatAnimation(`-${formatNumber(res.cost)} 🪙`);
        updateHeader(gameState.player);
        saveGame(gameState);
      }
    },

    onHireMiner: () => {
      const res = hireExtraMiner();
      if (res.success) {
        triggerCoinFloatAnimation(`-${formatNumber(res.cost)} 🪙`);
        createFloatingText(75, 50, '+1 Worker 👷‍♂️', '#10b981');
        updateHeader(gameState.player);
        saveGame(gameState);
      }
    },

    onSwitchTab: (tabName) => {
      switchView(tabName, gameState);
    },

    getUnassignedMiners: () => {
      return getUnassignedMiners();
    }
  });

  // 6. Start the 60FPS delta-time simulation game loop
  startLoop({
    onMineProgress: (mineId, currentDurability, totalDurability) => {
      // Non-destructive smooth CSS width updates per tick without DOM churn
      updateMineProgress(mineId, currentDurability, totalDurability);
    },

    onPlayerUpdate: (player) => {
      // Updates economy pills and level XP progress on completion rolls
      updateHeader(player);

      // If player is currently inspecting Backpack view, live-update ore counts
      if (getActiveView() === 'backpack') {
        renderBackpack(gameState.inventory);
      }
    },

    onLevelUp: () => {
      // Refresh mine cards to unlock newly eligible zones when leveling up
      renderMinesList(MINES, gameState.activeMines, gameState.miners, gameState.player);
      updateHeader(gameState.player);
      saveGame(gameState);
    }
  });

  console.log('⛏️ MINING GM initialized successfully.', {
    saveLoaded: loadResult.saveFound,
    offlineAccrued: offlineProgress ? offlineProgress.timeElapsed : 'none',
    oresCount: ORES.length,
    minersCount: MINERS.length,
    minesCount: MINES.length,
    upgradesCount: UPGRADES.length,
    initialPlayer: gameState.player
  });
}

// Ensure DOM is ready before bootstrapping
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

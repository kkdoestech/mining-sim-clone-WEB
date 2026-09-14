/**
 * @file economy.js
 * @description Handles transactions, inventory management, upgrades, and player progression.
 */

import { ORES } from './data/ores.js';
import { UPGRADES, getUpgradeCost } from './data/upgrades.js';
import { MINES } from './data/mines.js';
import { gameState, getOreDefinition, getEffectiveRequiredLevel } from './state.js';
import { formatNumber } from './utils/format.js';

export { formatNumber };

/**
 * Triggers a visual floating coin indicator on screen when coins are earned.
 * @param {string | number} amountText
 */
export function triggerCoinFloatAnimation(amountText) {
  if (typeof document === 'undefined') return;

  const appContainer = document.getElementById('app-container');
  if (!appContainer) return;

  const floatEl = document.createElement('div');
  floatEl.className = 'coin-float-indicator';

  let text;
  if (typeof amountText === 'number') {
    text = `+${formatNumber(amountText)} 🪙`;
  } else {
    const s = String(amountText).trim();
    if (s.includes('🪙')) {
      text = s;
    } else if (s.startsWith('+') || s.startsWith('-')) {
      text = `${s} 🪙`;
    } else {
      text = `+${s} 🪙`;
    }
  }

  floatEl.textContent = text;

  appContainer.appendChild(floatEl);

  // Clean up element after animation finishes
  setTimeout(() => {
    if (floatEl.parentNode) {
      floatEl.parentNode.removeChild(floatEl);
    }
  }, 1250);
}

/**
 * Converts a specific quantity of an ore into Coins based on ore.sellValue.
 * @param {string} oreId
 * @param {number} quantity
 * @returns {{ success: boolean, coinsEarned: number, oreId: string, quantity: number, reason?: string }}
 */
export function sellOre(oreId, quantity) {
  const currentCount = gameState.inventory[oreId] || 0;
  if (quantity <= 0 || currentCount < quantity) {
    return {
      success: false,
      coinsEarned: 0,
      oreId,
      quantity,
      reason: 'Insufficient ore quantity in inventory.'
    };
  }

  const ore = getOreDefinition(oreId);
  const unitPrice = ore ? ore.sellValue : 1;
  const coinsEarned = unitPrice * quantity;

  // Deduct from inventory and credit wallet
  gameState.inventory[oreId] -= quantity;
  gameState.player.coins += coinsEarned;

  triggerCoinFloatAnimation(formatNumber(coinsEarned));

  return {
    success: true,
    coinsEarned,
    oreId,
    quantity
  };
}

/**
 * Calculates the total coin liquidation value of the current inventory.
 * @returns {number}
 */
export function getInventoryTotalValue() {
  let total = 0;
  for (const ore of ORES) {
    const count = gameState.inventory[ore.id] || 0;
    total += count * ore.sellValue;
  }
  return total;
}

/**
 * Calculates total coin value of the entire inventory, clears the inventory,
 * credits player wallet, and triggers a visual coin-earned float animation.
 *
 * @returns {{ success: boolean, totalCoinsEarned: number, itemsSold: { oreId: string, count: number, value: number }[] }}
 */
export function sellAllOres() {
  let totalCoinsEarned = 0;
  const itemsSold = [];

  for (const ore of ORES) {
    const count = gameState.inventory[ore.id] || 0;
    if (count > 0) {
      const value = count * ore.sellValue;
      totalCoinsEarned += value;
      itemsSold.push({
        oreId: ore.id,
        count,
        value
      });
      gameState.inventory[ore.id] = 0;
    }
  }

  if (totalCoinsEarned > 0) {
    gameState.player.coins += totalCoinsEarned;
    triggerCoinFloatAnimation(formatNumber(totalCoinsEarned));
  }

  return {
    success: totalCoinsEarned > 0,
    totalCoinsEarned,
    itemsSold
  };
}

/**
 * Deducts coins and increments upgrade level if affordable.
 * @param {string} upgradeId
 * @returns {{ success: boolean, upgradeId: string, newLevel?: number, cost?: number, reason?: string }}
 */
export function buyUpgrade(upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) {
    return { success: false, upgradeId, reason: 'Upgrade definition not found.' };
  }

  if (!gameState.upgrades) {
    gameState.upgrades = { pickaxe_sharpness: 0, ore_multiplier: 0, depth_scanner: 0 };
  }

  const currentLevel = gameState.upgrades[upgradeId] || 0;
  if (currentLevel >= upgrade.maxLevel) {
    return { success: false, upgradeId, reason: 'Maximum upgrade tier reached.' };
  }

  const cost = getUpgradeCost(upgrade, currentLevel);
  if (gameState.player.coins < cost) {
    return {
      success: false,
      upgradeId,
      cost,
      reason: `Insufficient coins. Requires ${formatNumber(cost)} 🪙.`
    };
  }

  // Deduct coins & level up upgrade
  gameState.player.coins -= cost;
  gameState.upgrades[upgradeId] = currentLevel + 1;

  return {
    success: true,
    upgradeId,
    newLevel: currentLevel + 1,
    cost
  };
}

/**
 * Checks if current XP exceeds requiredXp. If so, increments level,
 * increases requiredXp exponentially, and unlocks newly qualified mines.
 *
 * @returns {{ leveledUp: boolean, newLevel: number, newlyUnlockedMines: import('./data/mines.js').Mine[] }}
 */
export function checkLevelUp() {
  let leveledUp = false;
  const initialLevel = gameState.player.level;

  while (gameState.player.xp >= gameState.player.xpNeeded) {
    gameState.player.xp -= gameState.player.xpNeeded;
    gameState.player.level += 1;
    gameState.player.xpNeeded = Math.round(gameState.player.xpNeeded * 1.5);
    leveledUp = true;
  }

  const newlyUnlockedMines = [];
  if (leveledUp) {
    for (const mine of MINES) {
      const prevReq = getEffectiveRequiredLevel(mine);
      if (initialLevel < prevReq && gameState.player.level >= prevReq) {
        newlyUnlockedMines.push(mine);
      }
    }
  }

  return {
    leveledUp,
    newLevel: gameState.player.level,
    newlyUnlockedMines
  };
}


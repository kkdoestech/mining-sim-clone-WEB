/**
 * @file loop.js
 * @description Game loop controller for the idle mining simulator.
 * Coordinates real-time delta time progression, excavation ticks, and drop roll resolution.
 */

import { MINES } from './data/mines.js';
import { gameState, calculateMinePower, grantMiningReward } from './state.js';
import { updateAllMinerAgents } from './minerFSM.js';
import { updateAbilities } from './abilities.js';
import { updateEvents } from './events.js';

let isRunning = false;
let lastTimestamp = 0;

/**
 * Rolls an ore reward from a mine's weighted drop table.
 * @param {readonly import('./data/mines.js').OreDropEntry[]} dropTable
 * @returns {string} Won oreId
 */
function rollDropTable(dropTable) {
  const totalWeight = dropTable.reduce((sum, entry) => sum + entry.dropChance, 0);
  let randomVal = Math.random() * totalWeight;

  for (const entry of dropTable) {
    if (randomVal <= entry.dropChance) {
      return entry.oreId;
    }
    randomVal -= entry.dropChance;
  }

  return dropTable[0].oreId;
}

/**
 * Executes a single frame tick of the mining simulation.
 * @param {number} timestamp
 * @param {Object} callbacks
 * @param {(mineId: string, currentDurability: number, totalDurability: number) => void} callbacks.onMineProgress
 * @param {(player: typeof gameState.player) => void} callbacks.onPlayerUpdate
 * @param {() => void} [callbacks.onLevelUp]
 */
function tick(timestamp, callbacks) {
  if (!isRunning) return;

  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.5); // Cap delta time at 0.5s for stability
  lastTimestamp = timestamp;

  let playerStateDirty = false;
  const prevCoins = gameState.player.coins;

  // 1. Update autonomous Tycoon Miner Agents (FSM), Active Abilities, and Flash Events every frame
  updateAllMinerAgents(dt);
  updateAbilities(dt);
  updateEvents(dt);

  if (gameState.player.coins !== prevCoins) {
    playerStateDirty = true;
  }

  // 2. Process all active background mines
  for (const mine of MINES) {
    const mineState = gameState.activeMines[mine.id];
    if (!mineState || !mineState.isMining) continue;

    const power = calculateMinePower(mine.id);
    if (power <= 0) continue;

    // Apply damage per second based on cumulative mining power
    mineState.currentDurability -= power * dt;

    // Check if mining cycle completed
    if (mineState.currentDurability <= 0) {
      // Completed excavation cycle
      const wonOreId = rollDropTable(mine.oreDropTable);
      const baseXP = Math.max(5, Math.round(mine.totalDurability / 15));
      const coinBonus = Math.round(mine.requiredLevel * 2);

      const { leveledUp } = grantMiningReward(wonOreId, 1, baseXP, coinBonus);
      playerStateDirty = true;

      if (leveledUp && callbacks.onLevelUp) {
        callbacks.onLevelUp();
      }

      // Reset durability for next cycle
      mineState.currentDurability = mineState.totalDurability;
    }

    // Fire smooth progress update for this mine
    if (callbacks.onMineProgress) {
      callbacks.onMineProgress(mine.id, mineState.currentDurability, mineState.totalDurability);
    }
  }

  // Update player header stats if anything changed
  if (playerStateDirty && callbacks.onPlayerUpdate) {
    callbacks.onPlayerUpdate(gameState.player);
  }

  requestAnimationFrame((t) => tick(t, callbacks));
}

/**
 * Starts the global simulation game loop.
 * @param {Object} callbacks
 * @param {(mineId: string, currentDurability: number, totalDurability: number) => void} callbacks.onMineProgress
 * @param {(player: typeof gameState.player) => void} callbacks.onPlayerUpdate
 * @param {() => void} [callbacks.onLevelUp]
 */
export function startLoop(callbacks) {
  if (isRunning) return;
  isRunning = true;
  lastTimestamp = 0;
  requestAnimationFrame((t) => tick(t, callbacks));
}

/**
 * Pauses the global simulation loop.
 */
export function stopLoop() {
  isRunning = false;
  lastTimestamp = 0;
}


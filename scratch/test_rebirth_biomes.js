import assert from 'node:assert';
import {
  BIOMES,
  rebirthState,
  getGlobalEarningsMultiplier,
  getCurrentBiome,
  getBiomeByTier,
  canRebirth,
  performRebirth,
  initRebirthState
} from '../js/rebirth.js';
import {
  STATIONS,
  getStation,
  getStationOreValue,
  calculateStationMultiplier
} from '../js/stations.js';
import { MinerAgent } from '../js/minerFSM.js';
import { gameState } from '../js/state.js';
import { saveGame, loadGame } from '../js/storage.js';

console.log('--- TEST 1: Biome Catalog & Tier Definitions ---');
assert.strictEqual(BIOMES.length, 3, 'Must have 3 depth biomes');
assert.strictEqual(BIOMES[0].id, 'quarry');
assert.strictEqual(BIOMES[0].themeClass, 'theme-quarry');
assert.strictEqual(BIOMES[1].id, 'dwarven');
assert.strictEqual(BIOMES[1].themeClass, 'theme-dwarven');
assert.strictEqual(BIOMES[2].id, 'magma');
assert.strictEqual(BIOMES[2].themeClass, 'theme-magma');

assert.strictEqual(BIOMES[0].stationSkins.length, 3);
assert.strictEqual(BIOMES[1].stationSkins.length, 3);
assert.strictEqual(BIOMES[2].stationSkins.length, 3);

// Test skin mapping
assert.strictEqual(BIOMES[1].stationSkins[0].name, 'Mithril Node');
assert.strictEqual(BIOMES[2].stationSkins[1].name, 'Ruby Crystal');
console.log('✓ Biome catalog definitions verified');

console.log('--- TEST 2: Permanent Multiplier Equation ---');
initRebirthState({ rebirthCount: 0, depthTier: 1 });
assert.strictEqual(getGlobalEarningsMultiplier(), 1.0, '0 rebirths = 1.0x');

rebirthState.rebirthCount = 1;
assert.strictEqual(getGlobalEarningsMultiplier(), 3.0, '1 rebirth = 3.0x (1 + 1*2.0)');

rebirthState.rebirthCount = 2;
assert.strictEqual(getGlobalEarningsMultiplier(), 5.0, '2 rebirths = 5.0x (1 + 2*2.0)');

rebirthState.rebirthCount = 5;
assert.strictEqual(getGlobalEarningsMultiplier(), 11.0, '5 rebirths = 11.0x');
console.log('✓ Global earnings multiplier equation verified');

console.log('--- TEST 3: Pacing Calibration (Speed & Block Excavation) ---');
const testMiner = new MinerAgent();
assert.strictEqual(testMiner.moveSpeed, 90, 'Miner speed must be 90px/sec');
assert.strictEqual(testMiner.miningPower, 10, 'Miner mining power calibrated to 10');

const dirtNode = getStation('station-1');
assert.strictEqual(dirtNode.maxHP, 15, 'Dirt node base HP calibrated to 15');

// Base mining duration = 15 HP / 10 damage/sec = 1.5 seconds
const baseMiningDuration = dirtNode.maxHP / testMiner.miningPower;
assert.strictEqual(baseMiningDuration, 1.5, 'Mining duration must be 1.5s');
console.log('✓ Pacing calibration verified (90px/s and 1.5s excavation)');

console.log('--- TEST 4: Global Multiplier Stacking in getStationOreValue ---');
initRebirthState({ rebirthCount: 0, depthTier: 1 });
dirtNode.level = 1;
const baseValueNoRebirth = getStationOreValue(dirtNode);
assert.strictEqual(baseValueNoRebirth, 1);

rebirthState.rebirthCount = 1; // 3.0x multiplier
const valueRebirth1 = getStationOreValue(dirtNode);
assert.strictEqual(valueRebirth1, 3, '1 rebirth (3x) should triple base ore value (1 * 3 = 3)');

rebirthState.rebirthCount = 2; // 5.0x multiplier
const valueRebirth2 = getStationOreValue(dirtNode);
assert.strictEqual(valueRebirth2, 5, '2 rebirths (5x) should 5x base ore value (1 * 5 = 5)');
console.log('✓ Global multiplier stacks into station ore value accurately');

console.log('--- TEST 5: canRebirth Eligibility & Soft-Reset Cycle ---');
initRebirthState({ rebirthCount: 0, depthTier: 1 });
STATIONS.forEach(s => {
  s.level = 20;
  s.unlocked = true;
});
assert.strictEqual(canRebirth(), false, 'Cannot rebirth if any station < Level 25');

// Make all stations Lv 25+
STATIONS.forEach(s => {
  s.level = 25;
  s.unlocked = true;
});
assert.strictEqual(canRebirth(), true, 'Eligible to rebirth when all stations reach Lv 25+');

// Perform rebirth
gameState.player.coins = 999999;
const rebirthPromise = performRebirth();
assert.ok(rebirthPromise instanceof Promise, 'performRebirth returns a promise');

await rebirthPromise;

assert.strictEqual(gameState.player.coins, 0, 'Soft coins must reset to 0 upon rebirth');
assert.strictEqual(rebirthState.rebirthCount, 1, 'rebirthCount must increment to 1');
assert.strictEqual(rebirthState.depthTier, 2, 'depthTier must advance from 1 to 2');
assert.strictEqual(getCurrentBiome().id, 'dwarven', 'Current biome must become Dwarven Caverns');

// Verify stations reset: Station 1 Lv 1 unlocked, others locked
assert.strictEqual(STATIONS[0].level, 1, 'Station 1 reset to level 1');
assert.strictEqual(STATIONS[0].unlocked, true, 'Station 1 unlocked');
assert.strictEqual(STATIONS[1].level, 1, 'Station 2 reset to level 1');
assert.strictEqual(STATIONS[1].unlocked, false, 'Station 2 locked');
assert.strictEqual(STATIONS[2].level, 1, 'Station 3 reset to level 1');
assert.strictEqual(STATIONS[2].unlocked, false, 'Station 3 locked');
console.log('✓ Rebirth execution and world-shift reset verified');

console.log('--- TEST 6: Biome Rotation 1 -> 2 -> 3 -> 1 ---');
assert.strictEqual(getBiomeByTier(1).id, 'quarry');
assert.strictEqual(getBiomeByTier(2).id, 'dwarven');
assert.strictEqual(getBiomeByTier(3).id, 'magma');
assert.strictEqual(getBiomeByTier(4).id, 'quarry', 'Tier 4 wraps to quarry');
console.log('✓ Biome rotation verified');

console.log('--- TEST 7: Storage Persistence & Restoration ---');
rebirthState.rebirthCount = 3;
rebirthState.depthTier = 3;
saveGame(gameState);

// Reset state
initRebirthState({ rebirthCount: 0, depthTier: 1 });
assert.strictEqual(rebirthState.rebirthCount, 0);
assert.strictEqual(rebirthState.depthTier, 1);

// Load game
const loadRes = loadGame();
assert.ok(loadRes.success);
assert.strictEqual(rebirthState.rebirthCount, 3, 'Restored rebirthCount must be 3');
assert.strictEqual(rebirthState.depthTier, 3, 'Restored depthTier must be 3');
assert.strictEqual(getCurrentBiome().id, 'magma', 'Restored biome must be Magma Core');
console.log('✓ Storage persistence and restoration verified');

console.log('\n🌟 ALL WORLD-SHIFT BIOME & PACING TESTS PASSED PERFECTLY!');


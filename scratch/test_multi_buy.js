import assert from 'node:assert';
import {
  STATIONS,
  getStation,
  getStationUpgradeCost,
  calculateCostForNLevels,
  calculateMaxAffordableLevels,
  upgradeStation
} from '../js/stations.js';
import { gameState } from '../js/state.js';
import { getBuyMode, setBuyMode } from '../js/ui.js';

console.log('--- TEST 1: calculateCostForNLevels Geometric Series Formula ---');
const dirt = getStation('station-1');
assert.ok(dirt, 'Station 1 must exist');
dirt.level = 1;

// Single level cost
const cost1 = getStationUpgradeCost(dirt);
assert.strictEqual(calculateCostForNLevels(dirt, 1), cost1, '1 level cost must equal getStationUpgradeCost');
assert.strictEqual(calculateCostForNLevels(dirt, 0), 0, '0 levels cost must be 0');
assert.strictEqual(calculateCostForNLevels(dirt, -5), 0, 'Negative levels cost must be 0');

// 10 levels cumulative cost: currentCost * (1.14^10 - 1) / 0.14
const expected10 = Math.floor(cost1 * (Math.pow(1.14, 10) - 1) / 0.14);
const actual10 = calculateCostForNLevels(dirt, 10);
assert.strictEqual(actual10, expected10, `Expected 10 levels cost ${expected10}, got ${actual10}`);
assert.ok(actual10 > cost1 * 10, 'Geometric cost for 10 levels must exceed linear 10x');
console.log('✓ calculateCostForNLevels verified');

console.log('--- TEST 2: calculateMaxAffordableLevels Inverse Formula ---');
// When player cannot afford even 1 level
const unaffordable = calculateMaxAffordableLevels(dirt, cost1 - 1);
assert.deepStrictEqual(unaffordable, { levels: 0, cost: 0 });

// When player has exact cost for 1 level
const exact1 = calculateMaxAffordableLevels(dirt, cost1);
assert.strictEqual(exact1.levels, 1);
assert.strictEqual(exact1.cost, cost1);

// When player has enough for several levels
const testCoins = 5000;
const maxResult = calculateMaxAffordableLevels(dirt, testCoins);
assert.ok(maxResult.levels > 1, 'Should afford multiple levels with 5,000 coins');
assert.ok(maxResult.cost <= testCoins, 'Cost must not exceed available coins');

// Boundary verification: cost for n+1 must exceed available coins
const costPlusOne = calculateCostForNLevels(dirt, maxResult.levels + 1);
assert.ok(costPlusOne > testCoins, 'Affording n+1 levels should exceed available coins');
console.log('✓ calculateMaxAffordableLevels boundary math verified');

console.log('--- TEST 3: upgradeStation Multi-Buy 10x Mode ---');
dirt.level = 1;
const costFor10 = calculateCostForNLevels(dirt, 10);
gameState.player.coins = costFor10 + 500;
const initialCoins = gameState.player.coins;

const up10Res = upgradeStation('station-1', '10x');
assert.ok(up10Res.success);
assert.strictEqual(up10Res.levelsBought, 10, 'Must buy exactly 10 levels');
assert.strictEqual(dirt.level, 11, 'Station level should increase from 1 to 11');
assert.strictEqual(up10Res.cost, costFor10, 'Cost charged must match calculateCostForNLevels(10)');
assert.strictEqual(gameState.player.coins, initialCoins - costFor10);
assert.ok(up10Res.milestone, 'Must detect milestone reached (Lv 10 crossed)');
assert.strictEqual(up10Res.milestone.banner, 'MILESTONE REACHED! 2x BOOST!');
console.log('✓ upgradeStation 10x mode & milestone detection verified');

console.log('--- TEST 4: upgradeStation Multi-Buy MAX Mode ---');
gameState.player.coins = 10000;
const currentCoins = gameState.player.coins;
const maxExpected = calculateMaxAffordableLevels(dirt, currentCoins);

const upMaxRes = upgradeStation('station-1', 'MAX');
assert.ok(upMaxRes.success);
assert.strictEqual(upMaxRes.levelsBought, maxExpected.levels);
assert.strictEqual(upMaxRes.cost, maxExpected.cost);
assert.strictEqual(gameState.player.coins, currentCoins - maxExpected.cost);
console.log('✓ upgradeStation MAX mode verified');

console.log('--- TEST 5: Milestone Detection on Large Level Jump ---');
dirt.level = 20;
gameState.player.coins = 1000000;
// Buying 10 levels from Lv 20 -> Lv 30 crosses Lv 25 milestone (3x + 50% Speed)
const upMilestoneJump = upgradeStation('station-1', '10x');
assert.ok(upMilestoneJump.success);
assert.strictEqual(dirt.level, 30);
assert.ok(upMilestoneJump.milestone, 'Must detect Lv 25 milestone during jump');
assert.strictEqual(upMilestoneJump.milestone.level, 25);
assert.strictEqual(upMilestoneJump.milestone.speedMultiplier, 1.5);
console.log('✓ Multi-level milestone detection verified');

console.log('--- TEST 6: Buy Mode State in UI Module ---');
assert.strictEqual(getBuyMode(), '1x');
setBuyMode('10x');
assert.strictEqual(getBuyMode(), '10x');
setBuyMode('MAX');
assert.strictEqual(getBuyMode(), 'MAX');
setBuyMode('invalid');
assert.strictEqual(getBuyMode(), 'MAX', 'Invalid mode should be ignored');
setBuyMode('1x');
assert.strictEqual(getBuyMode(), '1x');
console.log('✓ Buy mode state transitions verified');

console.log('\n🎉 ALL MULTI-BUY TESTS PASSED SUCCESSFULLY!');


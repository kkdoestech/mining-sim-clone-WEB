import assert from 'node:assert';
import {
  STATIONS,
  getStationUpgradeCost,
  getStationOreValue,
  getStation,
  unlockStation,
  upgradeStation,
  damageStation,
  getHireMinerCost,
  hireExtraMiner
} from '../js/stations.js';
import {
  getStationRockCoords,
  getStationParticleColor
} from '../js/juice.js';
import { gameState } from '../js/state.js';
import { activeMinerAgents } from '../js/minerFSM.js';

console.log('--- TEST 1: Station Scaling & Formulas ---');
const dirt = getStation('station-1');
assert.ok(dirt, 'Station 1 must exist');
assert.strictEqual(dirt.level, 1);
assert.strictEqual(dirt.maxHP, 15);
assert.strictEqual(dirt.currentHP, 15);

// Formula: Math.floor(10 * Math.pow(1.11, 1)) = Math.floor(11.1) = 11
const costLv1 = getStationUpgradeCost(dirt);
assert.strictEqual(costLv1, 11, `Expected Lv1 dirt upgrade cost to be 11, got ${costLv1}`);

// Ore value at Lv 1: 1 * (1 + 0) = 1
const valLv1 = getStationOreValue(dirt);
assert.strictEqual(valLv1, 1, `Expected Lv1 ore value to be 1, got ${valLv1}`);

console.log('✓ Station 1 baseline formulas verified');

console.log('--- TEST 2: Station Damage & Instant Regeneration ---');
// Max HP is 15. Damage 10 -> 5 HP remaining, returns false (not broken)
const broke1 = damageStation('station-1', 10);
assert.strictEqual(broke1, false, 'Station should not break at 5 HP');
assert.strictEqual(dirt.currentHP, 5, 'Station currentHP should be 5');

// Damage 6 -> drops below 0, breaks and resets to 15 immediately
const broke2 = damageStation('station-1', 6);
assert.strictEqual(broke2, true, 'Station should break on lethal damage');
assert.strictEqual(dirt.currentHP, dirt.maxHP, 'Station currentHP should immediately regenerate to maxHP');

console.log('✓ Node damage and instant regeneration verified');

console.log('--- TEST 3: Station Upgrades & Unlocks ---');
gameState.player.coins = 5000;

// Upgrade station-1
const upRes = upgradeStation('station-1');
assert.ok(upRes.success, 'Upgrade should succeed when player has sufficient coins');
assert.strictEqual(dirt.level, 2, 'Station level should be incremented to 2');
assert.strictEqual(upRes.cost, 11, 'Upgrade cost deducted should be 11');

// Ore value at Lv 2: 1 * 1.08^1 * 1 = 1.08 -> rounded to 1
// At Lv 10 (2x milestone): 1 * 1.08^9 * 2 = 4
dirt.level = 10;
assert.strictEqual(getStationOreValue(dirt), 4, 'At Lv 10, dirt ore value should scale to 4 with 2x milestone');
dirt.level = 2; // reset back

// Unlock station-2 (Copper Node, 250 coins)
const copper = getStation('station-2');
assert.ok(copper, 'Station 2 must exist');
assert.strictEqual(copper.unlocked, false, 'Copper should start locked');
const unlockRes = unlockStation('station-2');
assert.ok(unlockRes.success, 'Unlock should succeed with sufficient coins');
assert.strictEqual(copper.unlocked, true, 'Copper should now be unlocked');

console.log('✓ Station upgrade and unlock mechanics verified');

console.log('--- TEST 4: Miner Recruitment & Cost Scaling ---');
// Worker hiring costs: [0, 60, 320, 1200, 4500, 8000...]
dirt.level = 10; // 2 slots on dirt + 1 on copper = 3 max slots
activeMinerAgents.length = 2;
const hireCost1 = getHireMinerCost();
assert.strictEqual(hireCost1, 320, `Cost for 3rd worker should be 320, got ${hireCost1}`);

const hireRes = hireExtraMiner();
assert.ok(hireRes.success, 'Hiring extra miner should succeed');
assert.strictEqual(activeMinerAgents.length, 3, 'Worker count should increase to 3');

const hireCost2 = getHireMinerCost();
assert.strictEqual(hireCost2, 1200, `Cost for 4th worker should be 1200, got ${hireCost2}`);

console.log('✓ Miner recruitment and calibrated hiring cost verified');

console.log('--- TEST 5: Juice System Coordinates & Colors ---');
const coords1 = getStationRockCoords('station-1');
assert.ok(coords1.x > 0 && coords1.y > 0, 'Station 1 rock coords must be valid numbers');

const color1 = getStationParticleColor('station-1');
const color2 = getStationParticleColor('station-2');
const color3 = getStationParticleColor('station-3');
assert.strictEqual(color1, '#8b6d48', 'Station 1 color should be dirt earth');
assert.strictEqual(color2, '#d97706', 'Station 2 color should be copper bronze');
assert.strictEqual(color3, '#fbbf24', 'Station 3 color should be gold amber');

console.log('✓ Juice rock coordinates and particle color mapping verified');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');


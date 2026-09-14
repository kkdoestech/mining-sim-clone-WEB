import assert from 'node:assert';
import {
  STATIONS,
  STATION_MILESTONES,
  calculateStationMultiplier,
  getStationSpeedMultiplier,
  getNextMilestone,
  getMilestoneProgressInfo,
  getStationUpgradeCost,
  getStationOreValue,
  getStation,
  upgradeStation,
  damageStation
} from '../js/stations.js';
import { MinerAgent, MinerState, activeMinerAgents } from '../js/minerFSM.js';
import { gameState } from '../js/state.js';

console.log('--- TEST 1: Milestone Progression Definitions ---');
assert.strictEqual(STATION_MILESTONES.length, 4, 'Must define 4 milestone tiers');
assert.deepStrictEqual(
  STATION_MILESTONES.map(m => m.level),
  [10, 25, 50, 100],
  'Milestone levels must be 10, 25, 50, 100'
);
assert.strictEqual(STATION_MILESTONES[0].valueMultiplier, 2);
assert.strictEqual(STATION_MILESTONES[1].valueMultiplier, 3);
assert.strictEqual(STATION_MILESTONES[1].speedMultiplier, 1.5);
assert.strictEqual(STATION_MILESTONES[2].valueMultiplier, 5);
assert.strictEqual(STATION_MILESTONES[3].valueMultiplier, 10);
console.log('✓ Milestone definitions verified');

console.log('--- TEST 2: Compounding Milestone Multiplier ---');
assert.strictEqual(calculateStationMultiplier(1), 1, 'Lv 1 multiplier should be 1x');
assert.strictEqual(calculateStationMultiplier(9), 1, 'Lv 9 multiplier should be 1x');
assert.strictEqual(calculateStationMultiplier(10), 2, 'Lv 10 multiplier should be 2x');
assert.strictEqual(calculateStationMultiplier(24), 2, 'Lv 24 multiplier should be 2x');
assert.strictEqual(calculateStationMultiplier(25), 6, 'Lv 25 multiplier should compound to 2 * 3 = 6x');
assert.strictEqual(calculateStationMultiplier(49), 6, 'Lv 49 multiplier should be 6x');
assert.strictEqual(calculateStationMultiplier(50), 30, 'Lv 50 multiplier should compound to 6 * 5 = 30x');
assert.strictEqual(calculateStationMultiplier(99), 30, 'Lv 99 multiplier should be 30x');
assert.strictEqual(calculateStationMultiplier(100), 300, 'Lv 100 multiplier should compound to 30 * 10 = 300x');
assert.strictEqual(calculateStationMultiplier(150), 300, 'Lv > 100 multiplier should cap at 300x');
console.log('✓ Compounding multiplier math verified');

console.log('--- TEST 3: Station Speed Boost Multipliers ---');
assert.strictEqual(getStationSpeedMultiplier(1), 1.0, 'Lv 1 speed multiplier should be 1.0x');
assert.strictEqual(getStationSpeedMultiplier(10), 1.0, 'Lv 10 speed multiplier should be 1.0x');
assert.strictEqual(getStationSpeedMultiplier(24), 1.0, 'Lv 24 speed multiplier should be 1.0x');
assert.strictEqual(getStationSpeedMultiplier(25), 1.5, 'Lv 25 speed multiplier should be 1.5x (50% boost)');
assert.strictEqual(getStationSpeedMultiplier(50), 1.5, 'Lv 50 speed multiplier should remain at least 1.5x');
assert.strictEqual(getStationSpeedMultiplier(100), 1.5, 'Lv 100 speed multiplier should remain at least 1.5x');
console.log('✓ Milestone speed boost verified');

console.log('--- TEST 4: Milestone Progress Info Formatter ---');
const infoLv1 = getMilestoneProgressInfo(1);
assert.strictEqual(infoLv1.text, 'Lv. 1 / 10 ➔ 2x Boost!');
assert.strictEqual(infoLv1.isMax, false);

const infoLv7 = getMilestoneProgressInfo(7);
assert.strictEqual(infoLv7.text, 'Lv. 7 / 10 ➔ 2x Boost!');

const infoLv10 = getMilestoneProgressInfo(10);
assert.strictEqual(infoLv10.text, 'Lv. 10 / 25 ➔ 3x + 50% Spd!');

const infoLv25 = getMilestoneProgressInfo(25);
assert.strictEqual(infoLv25.text, 'Lv. 25 / 50 ➔ 5x Boost!');

const infoLv50 = getMilestoneProgressInfo(50);
assert.strictEqual(infoLv50.text, 'Lv. 50 / 100 ➔ 10x Boost!');

const infoLv100 = getMilestoneProgressInfo(100);
assert.ok(infoLv100.isMax);
assert.ok(infoLv100.text.includes('MAX'));
console.log('✓ Milestone indicator text verified');

console.log('--- TEST 5: Baseline Durabilities & Cost / Value Scaling ---');
const dirt = getStation('station-1');
const copper = getStation('station-2');
const gold = getStation('station-3');

assert.strictEqual(dirt.maxHP, 20, 'Dirt initial durability must be 20 HP');
assert.strictEqual(copper.maxHP, 40, 'Copper initial durability must be 40 HP (down from 80)');
assert.strictEqual(gold.maxHP, 75, 'Gold initial durability must be 75 HP (down from 300)');

// Test 1.14 cost formula: Math.floor(baseCost * 1.14^level)
dirt.level = 1;
assert.strictEqual(getStationUpgradeCost(dirt), Math.floor(10 * Math.pow(1.14, 1))); // 11
dirt.level = 10;
assert.strictEqual(getStationUpgradeCost(dirt), Math.floor(10 * Math.pow(1.14, 10))); // 37

// Test exponential ore value formula: baseOreValue * 1.08^(level - 1) * multiplier
dirt.level = 1;
assert.strictEqual(getStationOreValue(dirt), 1);
dirt.level = 10;
// At Lv 10: 1 * 1.08^9 * 2 = 1.999 * 2 = 3.998 -> 4
assert.strictEqual(getStationOreValue(dirt), 4);
dirt.level = 25;
// At Lv 25: 1 * 1.08^24 * 6 = 6.34 * 6 = 38.04 -> 38
assert.strictEqual(getStationOreValue(dirt), 38);

console.log('✓ Baseline durabilities and exponential cost/value curves verified');

console.log('--- TEST 6: Autonomous Worker Speeds & Rapid Turnaround ---');
const miner = new MinerAgent({
  startX: 0,
  startY: 0
});
assert.strictEqual(miner.moveSpeed, 220, 'Default miner moveSpeed must be doubled (220px/s)');

// Test deposit timer turnaround
miner.state = MinerState.MOVING_TO_SURFACE;
miner.targetX = 0;
miner.targetY = 0;
miner.update(0.016); // Arrives at target
assert.strictEqual(miner.state, MinerState.DEPOSITING);
assert.strictEqual(miner.depositTimer, 0.2, 'Deposit delay must be reduced to 0.2s for rapid turnaround');

// Test milestone hit frequency scaling
const stationLv25 = { id: 'station-1', level: 25, isUnlocked: true };
miner.state = MinerState.MINING;
miner.targetStation = stationLv25;
miner.chipCooldown = 0;
miner.update(0.016);
// Speed multiplier at Lv 25 is 1.5 -> chipCooldown set to 0.35 / 1.5 = 0.2333s
assert.ok(Math.abs(miner.chipCooldown - (0.35 / 1.5)) < 0.02, 'Chip cooldown must scale inversely with speed boost');

console.log('✓ Worker speeds, rapid deposit, and hit frequency acceleration verified');

console.log('--- TEST 7: Milestone Celebration Trigger on Level Up ---');
dirt.level = 9;
gameState.player.coins = 100000;
const upRes10 = upgradeStation('station-1');
assert.ok(upRes10.success);
assert.strictEqual(upRes10.newLevel, 10);
assert.ok(upRes10.milestone, 'Level 10 must return reached milestone');
assert.strictEqual(upRes10.milestone.banner, 'MILESTONE REACHED! 2x BOOST!');

console.log('✓ Milestone celebration event trigger verified');

console.log('\n🎉 ALL STATION MILESTONE & SPEED TESTS PASSED SUCCESSFULLY!');


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
assert.strictEqual(STATION_MILESTONES.length, 3, 'Must define 3 milestone tiers (10, 20, 25)');
assert.deepStrictEqual(
  STATION_MILESTONES.map(m => m.level),
  [10, 20, 25],
  'Milestone levels must be 10, 20, 25'
);
assert.strictEqual(STATION_MILESTONES[0].valueMultiplier, 2);
assert.strictEqual(STATION_MILESTONES[1].valueMultiplier, 2.5);
assert.strictEqual(STATION_MILESTONES[1].speedMultiplier, 1.2);
assert.strictEqual(STATION_MILESTONES[2].valueMultiplier, 4);
console.log('✓ Milestone definitions verified');

console.log('--- TEST 2: Compounding Milestone Multiplier ---');
assert.strictEqual(calculateStationMultiplier(1), 1, 'Lv 1 multiplier should be 1x');
assert.strictEqual(calculateStationMultiplier(9), 1, 'Lv 9 multiplier should be 1x');
assert.strictEqual(calculateStationMultiplier(10), 2, 'Lv 10 multiplier should be 2x');
assert.strictEqual(calculateStationMultiplier(19), 2, 'Lv 19 multiplier should be 2x');
assert.strictEqual(calculateStationMultiplier(20), 5, 'Lv 20 multiplier should compound to 2 * 2.5 = 5x');
assert.strictEqual(calculateStationMultiplier(24), 5, 'Lv 24 multiplier should be 5x');
assert.strictEqual(calculateStationMultiplier(25), 20, 'Lv 25 multiplier should compound to 5 * 4 = 20x');
assert.strictEqual(calculateStationMultiplier(50), 20, 'Lv > 25 multiplier should remain at 20x');
console.log('✓ Compounding multiplier math verified');

console.log('--- TEST 3: Station Speed Boost Multipliers ---');
assert.strictEqual(getStationSpeedMultiplier(1), 1.0, 'Lv 1 speed multiplier should be 1.0x');
assert.strictEqual(getStationSpeedMultiplier(10), 1.0, 'Lv 10 speed multiplier should be 1.0x');
assert.strictEqual(getStationSpeedMultiplier(19), 1.0, 'Lv 19 speed multiplier should be 1.0x');
assert.strictEqual(getStationSpeedMultiplier(20), 1.2, 'Lv 20 speed multiplier should be 1.2x (20% boost)');
assert.strictEqual(getStationSpeedMultiplier(25), 1.2, 'Lv 25 speed multiplier should remain 1.2x');
console.log('✓ Milestone speed boost verified');

console.log('--- TEST 4: Milestone Progress Info Formatter ---');
const infoLv1 = getMilestoneProgressInfo(1);
assert.strictEqual(infoLv1.text, 'Lv. 1 / 10 ➔ 2x Boost!');
assert.strictEqual(infoLv1.isMax, false);

const infoLv7 = getMilestoneProgressInfo(7);
assert.strictEqual(infoLv7.text, 'Lv. 7 / 10 ➔ 2x Boost!');

const infoLv10 = getMilestoneProgressInfo(10);
assert.strictEqual(infoLv10.text, 'Lv. 10 / 20 ➔ 2.5x + 20% Spd!');

const infoLv20 = getMilestoneProgressInfo(20);
assert.strictEqual(infoLv20.text, 'Lv. 20 / 25 ➔ 4x Boost!');

const infoLv25 = getMilestoneProgressInfo(25);
assert.ok(infoLv25.isMax);
assert.ok(infoLv25.text.includes('GOAL REACHED'));
console.log('✓ Milestone indicator text verified');

console.log('--- TEST 5: Baseline Durabilities & Cost / Value Scaling ---');
const dirt = getStation('station-1');
const copper = getStation('station-2');
const gold = getStation('station-3');

assert.strictEqual(dirt.maxHP, 15, 'Dirt initial durability must be 15 HP');
assert.strictEqual(copper.maxHP, 45, 'Copper initial durability must be 45 HP');
assert.strictEqual(gold.maxHP, 110, 'Gold initial durability must be 110 HP');

assert.strictEqual(copper.unlockCost, 280, 'Copper unlock cost must be 280');
assert.strictEqual(gold.unlockCost, 2200, 'Gold unlock cost must be 2200');

// Test 1.11 cost formula: Math.floor(baseCost * 1.11^level)
dirt.level = 1;
assert.strictEqual(getStationUpgradeCost(dirt), Math.floor(10 * Math.pow(1.11, 1))); // 11
dirt.level = 10;
assert.strictEqual(getStationUpgradeCost(dirt), Math.floor(10 * Math.pow(1.11, 10))); // 28

// Test exponential ore value formula: baseOreValue * 1.08^(level - 1) * multiplier
dirt.level = 1;
assert.strictEqual(getStationOreValue(dirt), 1);
dirt.level = 10;
// At Lv 10: 1 * 1.08^9 * 2 = 1.999 * 2 = 3.998 -> 4
assert.strictEqual(getStationOreValue(dirt), 4);
dirt.level = 20;
// At Lv 20: 1 * 1.08^19 * 5 = 4.3157 * 5 = 21.57 -> 22
assert.strictEqual(getStationOreValue(dirt), 22);
dirt.level = 25;
// At Lv 25: 1 * 1.08^24 * 20 = 6.341 * 20 = 126.8 -> 127
assert.strictEqual(getStationOreValue(dirt), 127);

console.log('✓ Baseline durabilities and exponential cost/value curves verified');

console.log('--- TEST 6: Autonomous Worker Speeds & Rapid Turnaround ---');
const miner = new MinerAgent({
  startX: 0,
  startY: 0
});
assert.strictEqual(miner.moveSpeed, 90, 'Default miner moveSpeed must be calibrated to 90px/s');

// Test deposit timer turnaround
miner.state = MinerState.MOVING_TO_SURFACE;
miner.targetX = 0;
miner.targetY = 0;
miner.update(0.016); // Arrives at target
assert.strictEqual(miner.state, MinerState.DEPOSITING);
assert.strictEqual(miner.depositTimer, 0.25, 'Deposit delay must be calibrated to 0.25s for rapid turnaround');

// Test milestone hit frequency scaling
const stationLv20 = { id: 'station-1', level: 20, isUnlocked: true };
miner.state = MinerState.MINING;
miner.targetStation = stationLv20;
miner.chipCooldown = 0;
miner.update(0.016);
// Speed multiplier at Lv 20 is 1.2 -> chipCooldown set to 0.35 / 1.2
assert.ok(Math.abs(miner.chipCooldown - (0.35 / 1.2)) < 0.02, 'Chip cooldown must scale inversely with speed boost');

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

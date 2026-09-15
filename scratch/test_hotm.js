/**
 * @file test_hotm.js
 * Comprehensive automated test suite for Heart of the Mountain (HOTM) Perk Tree system.
 * Tests perk registry, geometric cost scaling, stat multipliers, powder economy,
 * miner FSM integration, bounty powder buff, storage persistence, and Rebirth retention.
 */

import assert from 'assert';
import {
  HOTM_PERKS,
  hotmState,
  getPerk,
  getPerkCost,
  getPerkMultiplier,
  upgradePerk,
  getHotmSaveData,
  initHotmState
} from '../js/hotm.js';
import { gameState } from '../js/state.js';
import { MinerAgent, MinerState } from '../js/minerFSM.js';
import { initBounties, getActiveBounties, claimBounty } from '../js/commissions.js';
import { saveGame, loadGame } from '../js/storage.js';
import { performRebirth, canRebirth, rebirthState } from '../js/rebirth.js';
import { STATIONS } from '../js/stations.js';

console.log('--- TEST 1: HOTM Perk Registry & Definitions ---');
assert.strictEqual(HOTM_PERKS.length, 6, 'Should have exactly 6 HOTM perks defined');

const expectedPerks = [
  { id: 'mining_speed', max: 10 },
  { id: 'mining_fortune', max: 10 },
  { id: 'efficient_miner', max: 5 },
  { id: 'deep_pockets', max: 5 },
  { id: 'speedy_hauler', max: 10 },
  { id: 'powder_buff', max: 5 }
];

for (const exp of expectedPerks) {
  const perk = getPerk(exp.id);
  assert(perk, `Perk ${exp.id} must exist in registry`);
  assert.strictEqual(perk.maxLevel, exp.max, `Perk ${exp.id} max level must be ${exp.max}`);
}
console.log('✓ All 6 perks registered with correct caps');

console.log('\n--- TEST 2: Geometric Cost Scaling Formula ---');
// Formula: Math.floor(30 * Math.pow(1.35, level))
initHotmState({});
assert.strictEqual(getPerkCost('mining_speed'), 30, 'Lv 0 cost should be 30');

hotmState.mining_speed = 1;
assert.strictEqual(getPerkCost('mining_speed'), Math.floor(30 * 1.35), 'Lv 1 cost: floor(30 * 1.35) = 40');

hotmState.mining_speed = 2;
assert.strictEqual(getPerkCost('mining_speed'), Math.floor(30 * Math.pow(1.35, 2)), 'Lv 2 cost: floor(30 * 1.8225) = 54');

hotmState.mining_speed = 10;
assert.strictEqual(getPerkCost('mining_speed'), Infinity, 'Max level cost should be Infinity');
console.log('✓ Scaling cost formula matches Math.floor(30 * Math.pow(1.35, level))');

console.log('\n--- TEST 3: Multiplier Formulas ---');
initHotmState({});
// 1. mining_speed: +10% per level
hotmState.mining_speed = 5;
assert.strictEqual(getPerkMultiplier('mining_speed'), 0.50, '5 levels of mining_speed should be +50% (0.5)');

// 2. mining_fortune: +12% per level
hotmState.mining_fortune = 3;
assert.strictEqual(Math.round(getPerkMultiplier('mining_fortune') * 100) / 100, 0.36, '3 levels of mining_fortune = 36%');

// 3. efficient_miner: +15% per level
hotmState.efficient_miner = 2;
assert.strictEqual(getPerkMultiplier('efficient_miner'), 0.30, '2 levels of efficient_miner = 30%');

// 4. deep_pockets: +2 slots per level
hotmState.deep_pockets = 4;
assert.strictEqual(getPerkMultiplier('deep_pockets'), 8, '4 levels of deep_pockets = +8 capacity');

// 5. speedy_hauler: +15% per level
hotmState.speedy_hauler = 2;
assert.strictEqual(getPerkMultiplier('speedy_hauler'), 0.30, '2 levels of speedy_hauler = +30%');

// 6. powder_buff: +20% per level
hotmState.powder_buff = 3;
assert.strictEqual(Math.round(getPerkMultiplier('powder_buff') * 100) / 100, 0.60, '3 levels of powder_buff = +60%');
console.log('✓ Multiplier formulas accurately reflect spec');

console.log('\n--- TEST 4: Upgrading Mechanics & Powder Deductions ---');
initHotmState({});
gameState.player.powder = 100;

// Attempt upgrade with valid powder
const upg1 = upgradePerk('speedy_hauler');
assert.strictEqual(upg1.success, true, 'Upgrade 1 should succeed');
assert.strictEqual(upg1.newLevel, 1);
assert.strictEqual(upg1.cost, 30);
assert.strictEqual(gameState.player.powder, 70, 'Powder should be deducted 100 - 30 = 70');
assert.strictEqual(hotmState.speedy_hauler, 1);

// Upgrade again (cost: 40)
const upg2 = upgradePerk('speedy_hauler');
assert.strictEqual(upg2.success, true, 'Upgrade 2 should succeed');
assert.strictEqual(upg2.cost, 40);
assert.strictEqual(gameState.player.powder, 30, 'Powder should be 70 - 40 = 30');
assert.strictEqual(hotmState.speedy_hauler, 2);

// Attempt upgrade with insufficient powder (cost: 54, has: 30)
const upg3 = upgradePerk('speedy_hauler');
assert.strictEqual(upg3.success, false, 'Upgrade should fail with insufficient powder');
assert.strictEqual(hotmState.speedy_hauler, 2, 'Level should remain unchanged');
assert.strictEqual(gameState.player.powder, 30, 'Powder should not be deducted');

// Max level cap test
gameState.player.powder = 100000;
for (let i = 2; i < 10; i++) {
  upgradePerk('speedy_hauler');
}
assert.strictEqual(hotmState.speedy_hauler, 10, 'Should reach max level 10');
const upgMax = upgradePerk('speedy_hauler');
assert.strictEqual(upgMax.success, false, 'Cannot upgrade beyond max level');
console.log('✓ Upgrading deductions, failure checks, and max level cap verified');

console.log('\n--- TEST 5: Miner FSM Integration ---');
initHotmState({
  speedy_hauler: 4, // +60% speed
  deep_pockets: 3    // +6 capacity
});

const testMiner = new MinerAgent({
  id: 'test_miner_fsm',
  name: 'Test Miner',
  miningPower: 10,
  moveSpeed: 100,
  backpackCapacity: 5
});

// Effective move speed
assert.strictEqual(testMiner.getEffectiveMoveSpeed(), 160, 'Base speed 100 * (1 + 0.60) = 160');

// Effective backpack capacity
assert.strictEqual(testMiner.getEffectiveBackpackCapacity(), 11, 'Base capacity 5 + 6 = 11');
console.log('✓ MinerAgent reflects active HOTM perks on speed and capacity');

console.log('\n--- TEST 6: Commissions Powder Buff Integration ---');
initHotmState({
  powder_buff: 2 // +40% powder bonus
});

initBounties([{
  id: 'test_bounty_1',
  type: 'HAUL_CARTS',
  title: 'Deliver 1 Cart',
  current: 1,
  target: 1,
  isCompleted: true,
  rewardCoins: 200,
  rewardPowder: 50
}]);

const initialPowder = 500;
gameState.player.powder = initialPowder;

const claimRes = claimBounty('test_bounty_1');
assert.strictEqual(claimRes.success, true);
// 50 * (1 + 0.40) = 70 powder awarded
assert.strictEqual(gameState.player.powder, initialPowder + 70, 'Powder should include +40% bonus: 500 + 70 = 570');
console.log('✓ Powder Buff perk applies +20%/level bonus to claimed bounties');

console.log('\n--- TEST 7: Save Persistence & Rebirth Retention ---');
// Set custom HOTM perks
initHotmState({
  mining_speed: 7,
  mining_fortune: 5,
  efficient_miner: 3,
  deep_pockets: 4,
  speedy_hauler: 8,
  powder_buff: 5
});
gameState.player.powder = 1250;

// Save game
saveGame(gameState);

// Mutate in-memory state
initHotmState({});
gameState.player.powder = 0;
assert.strictEqual(hotmState.mining_speed, 0);

// Load game
const loaded = loadGame();
assert.strictEqual(loaded.success, true);
assert.strictEqual(gameState.player.powder, 1250, 'Player powder should restore from storage');
assert.strictEqual(hotmState.mining_speed, 7, 'mining_speed should restore');
assert.strictEqual(hotmState.mining_fortune, 5, 'mining_fortune should restore');
assert.strictEqual(hotmState.powder_buff, 5, 'powder_buff should restore');
console.log('✓ HOTM state persists and restores accurately via storage.js');

// Test Rebirth does not wipe HOTM state or powder
STATIONS.forEach(s => {
  s.unlocked = true;
  s.level = 25;
});
assert.strictEqual(canRebirth(), true);

await performRebirth();
assert.strictEqual(hotmState.mining_speed, 7, 'mining_speed must remain intact after Rebirth');
assert.strictEqual(hotmState.speedy_hauler, 8, 'speedy_hauler must remain intact after Rebirth');
assert.strictEqual(gameState.player.powder, 1250, 'Mithril powder must not be reset during Rebirth');
assert.strictEqual(gameState.player.coins, 0, 'Soft coins should be reset by Rebirth');
console.log('✓ Rebirth safely preserves HOTM perks and Mithril powder');

console.log('\n🎉 ALL HEART OF THE MOUNTAIN (HOTM) TESTS PASSED SUCCESSFULLY! 🎉');


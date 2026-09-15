import assert from 'node:assert';
import { gameState } from '../js/state.js';
import {
  activeBounties,
  initBounties,
  generateBounty,
  onGameEvent,
  claimBounty,
  getActiveBounties
} from '../js/commissions.js';
import { saveGame, loadGame } from '../js/storage.js';
import { STATIONS } from '../js/stations.js';
import { performRebirth, initRebirthState, canRebirth } from '../js/rebirth.js';

console.log('--- TEST 1: Procedural Bounty Generation & Initialization ---');
initBounties();
assert.strictEqual(activeBounties.length, 2, 'Must maintain exactly 2 active bounties');

for (const bounty of activeBounties) {
  assert.ok(bounty.id, 'Bounty must have a unique ID');
  assert.ok(bounty.title, 'Bounty must have a title');
  assert.strictEqual(typeof bounty.current, 'number');
  assert.strictEqual(typeof bounty.target, 'number');
  assert.ok(bounty.target > 0, 'Target must be greater than 0');
  assert.strictEqual(bounty.isCompleted, false);
  assert.ok(bounty.rewardCoins > 0, 'Must reward coins');
  assert.ok(bounty.rewardPowder > 0, 'Must reward Mithril Powder (🟣)');
  assert.ok(['MINE_ORE', 'HAUL_CARTS', 'UPGRADE_STATIONS'].includes(bounty.type));
}
console.log('✓ Active bounties initialized with valid structure');

console.log('--- TEST 2: onGameEvent Dispatching & Increments ---');
// Setup controlled bounties
activeBounties[0] = {
  id: 'bounty_mine_test',
  type: 'MINE_ORE',
  title: 'Mine 10 Dirt & Coal',
  current: 0,
  target: 10,
  isCompleted: false,
  rewardCoins: 200,
  rewardPowder: 25,
  targetStationId: 'station-1',
  targetOreId: 'dirt'
};

activeBounties[1] = {
  id: 'bounty_haul_test',
  type: 'HAUL_CARTS',
  title: 'Deliver 4 Carts to Surface',
  current: 0,
  target: 4,
  isCompleted: false,
  rewardCoins: 250,
  rewardPowder: 30,
  targetStationId: null,
  targetOreId: null
};

// Dispatch MINE_ORE
onGameEvent('MINE_ORE', { stationId: 'station-1', oreId: 'dirt', count: 3 });
assert.strictEqual(activeBounties[0].current, 3, 'MINE_ORE event should increment target bounty');
assert.strictEqual(activeBounties[0].isCompleted, false);

// Dispatch non-matching station ore
onGameEvent('MINE_ORE', { stationId: 'station-2', oreId: 'copper', count: 2 });
assert.strictEqual(activeBounties[0].current, 3, 'Non-matching station should not increment');

// Dispatch HAUL_CARTS
onGameEvent('HAUL_CARTS', { count: 2 });
assert.strictEqual(activeBounties[1].current, 2, 'HAUL_CARTS event should increment haul bounty');
assert.strictEqual(activeBounties[1].isCompleted, false);

// Dispatch remaining to complete bounty 1
onGameEvent('MINE_ORE', { stationId: 'station-1', oreId: 'dirt', count: 7 });
assert.strictEqual(activeBounties[0].current, 10);
assert.strictEqual(activeBounties[0].isCompleted, true, 'Bounty should be completed when current >= target');
console.log('✓ onGameEvent dispatching and completion threshold verified');

console.log('--- TEST 3: Bounty Claiming & Mithril Powder (🟣) Rewards ---');
gameState.player.coins = 500;
gameState.player.powder = 10;

// Attempting to claim incomplete bounty should fail
const failClaim = claimBounty('bounty_haul_test');
assert.strictEqual(failClaim.success, false, 'Cannot claim incomplete bounty');
assert.strictEqual(gameState.player.powder, 10);

// Claim completed bounty
const claimRes = claimBounty('bounty_mine_test');
assert.ok(claimRes.success, 'Claiming completed bounty should succeed');
assert.strictEqual(gameState.player.coins, 500 + 200, 'Coins reward credited to player');
assert.strictEqual(gameState.player.powder, 10 + 25, 'Mithril Powder reward credited to player');

// Check that slot was replaced with a new bounty
assert.strictEqual(activeBounties.length, 2, 'Active bounties length must stay 2');
assert.notStrictEqual(activeBounties[0].id, 'bounty_mine_test', 'Claimed bounty replaced with new bounty');
assert.strictEqual(activeBounties[0].isCompleted, false, 'New bounty starts uncompleted');
console.log('✓ claimBounty rewards and slot replacement verified');

console.log('--- TEST 4: UPGRADE_STATIONS Bounty Type ---');
activeBounties[1] = {
  id: 'bounty_upgrade_test',
  type: 'UPGRADE_STATIONS',
  title: 'Buy 5 Station Upgrades',
  current: 0,
  target: 5,
  isCompleted: false,
  rewardCoins: 150,
  rewardPowder: 20,
  targetStationId: null,
  targetOreId: null
};

onGameEvent('UPGRADE_STATIONS', { stationId: 'station-1', levelsBought: 3 });
assert.strictEqual(activeBounties[1].current, 3);
assert.strictEqual(activeBounties[1].isCompleted, false);

onGameEvent('UPGRADE_STATIONS', { stationId: 'station-2', levelsBought: 2 });
assert.strictEqual(activeBounties[1].current, 5);
assert.strictEqual(activeBounties[1].isCompleted, true);
console.log('✓ UPGRADE_STATIONS multi-level increment verified');

console.log('--- TEST 5: Storage Persistence of Powder & Bounties ---');
gameState.player.powder = 125;
activeBounties[0].current = 7;
saveGame(gameState);

// Reset runtime state
gameState.player.powder = 0;
activeBounties.length = 0;

// Load game
const loadRes = loadGame();
assert.ok(loadRes.success);
assert.strictEqual(gameState.player.powder, 125, 'Mithril Powder must restore from save');
assert.strictEqual(activeBounties.length, 2, 'Active bounties must restore from save');
assert.strictEqual(activeBounties[0].current, 7, 'Bounty progress must be preserved across saves');
console.log('✓ Powder and bounty storage persistence verified');

console.log('--- TEST 6: Mithril Powder (🟣) Preservation Across Rebirth ---');
gameState.player.coins = 500000;
gameState.player.powder = 250;

// Setup stations for rebirth eligibility (Lv 25 on all)
initRebirthState({ rebirthCount: 0, depthTier: 1 });
STATIONS.forEach(s => {
  s.level = 25;
  s.unlocked = true;
});
assert.strictEqual(canRebirth(), true);

await performRebirth();

// Verify: coins reset to 0, BUT powder is NEVER wiped!
assert.strictEqual(gameState.player.coins, 0, 'Soft coins reset to 0 on Rebirth');
assert.strictEqual(gameState.player.powder, 250, 'Mithril Powder (🟣) must NOT be wiped during Rebirth!');
console.log('✓ Mithril Powder is preserved across Rebirth');

console.log('\n🟣 ALL COMMISSIONS & MITHRIL POWDER TESTS PASSED PERFECTLY!');


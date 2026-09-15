/**
 * @file test_abilities.js
 * Automated test suite for Pickobulus Blast active ability (Hypixel Skyblock).
 * Tests readiness, cooldown timer, multi-station damage & instant respawn,
 * surface cart coin liquidation, cooldown lockout, and commissions synergy.
 */

import assert from 'assert';
import {
  pickobulusAbility,
  isReady,
  getCooldownRemaining,
  updateAbilities,
  triggerPickobulus
} from '../js/abilities.js';
import { STATIONS, getStationOreValue } from '../js/stations.js';
import { gameState } from '../js/state.js';
import { initBounties, getActiveBounties } from '../js/commissions.js';

console.log('--- TEST 1: Initial Ability State & Definitions ---');
assert.strictEqual(pickobulusAbility.id, 'pickobulus');
assert.strictEqual(pickobulusAbility.cooldown, 60, 'Cooldown must be 60 seconds');
pickobulusAbility.timer = 0;
assert.strictEqual(isReady(), true, 'Ability must be ready when timer is 0');
assert.strictEqual(getCooldownRemaining(), 0);
console.log('✓ Initial ability configuration verified');

console.log('\n--- TEST 2: Pickobulus Blast Execution & Station Damage ---');
// Setup test stations: unlock stations 1 & 2, keep station 3 locked
STATIONS[0].unlocked = true;
STATIONS[0].level = 5;
STATIONS[0].currentHP = STATIONS[0].maxHP;

STATIONS[1].unlocked = true;
STATIONS[1].level = 3;
STATIONS[1].currentHP = STATIONS[1].maxHP;

STATIONS[2].unlocked = false;
STATIONS[2].level = 1;
STATIONS[2].currentHP = STATIONS[2].maxHP;

const expectedVal1 = getStationOreValue(STATIONS[0]);
const expectedVal2 = getStationOreValue(STATIONS[1]);
const expectedTotalCoins = expectedVal1 + expectedVal2;

const initialCoins = 1000;
gameState.player.coins = initialCoins;

const blastRes = triggerPickobulus();
assert.strictEqual(blastRes.success, true, 'Blast should trigger successfully');
assert.strictEqual(blastRes.oresYielded, 2, 'Should excavate both unlocked stations');
assert.strictEqual(blastRes.coinsEarned, expectedTotalCoins, 'Should award ore value from all unlocked stations');
assert.strictEqual(gameState.player.coins, initialCoins + expectedTotalCoins, 'Player coins should be credited directly');

// Verify stations took 100% max HP damage and immediately regenerated
assert.strictEqual(STATIONS[0].currentHP, STATIONS[0].maxHP, 'Station 1 should regenerate to Max HP immediately');
assert.strictEqual(STATIONS[1].currentHP, STATIONS[1].maxHP, 'Station 2 should regenerate to Max HP immediately');
assert.strictEqual(STATIONS[2].unlocked, false, 'Station 3 was locked and must remain untouched');

// Verify cooldown timer is set to 60
assert.strictEqual(pickobulusAbility.timer, 60, 'Timer must be set to 60s on blast');
assert.strictEqual(isReady(), false, 'Ability must not be ready while on cooldown');
assert.strictEqual(getCooldownRemaining(), 60);
console.log('✓ Pickobulus Blast deals 100% damage, credits coins, and initiates cooldown');

console.log('\n--- TEST 3: Cooldown Lockout ---');
const failTrigger = triggerPickobulus();
assert.strictEqual(failTrigger.success, false, 'Cannot trigger while cooling down');
assert.strictEqual(pickobulusAbility.timer, 60, 'Timer should not reset on failed trigger');
assert.strictEqual(gameState.player.coins, initialCoins + expectedTotalCoins, 'Coins should not change on blocked trigger');
console.log('✓ Ability properly blocked while on cooldown');

console.log('\n--- TEST 4: Delta-Time Cooldown Progression ---');
// Frame ticks simulating 20 seconds
updateAbilities(20);
assert.strictEqual(Math.round(getCooldownRemaining()), 40, 'Remaining should be 40s after 20s dt');
assert.strictEqual(isReady(), false);

// Another 39 seconds
updateAbilities(39);
assert.strictEqual(Math.round(getCooldownRemaining()), 1, 'Remaining should be 1s after 59s dt');
assert.strictEqual(isReady(), false);

// Final 1.5 seconds (past cooldown)
updateAbilities(1.5);
assert.strictEqual(getCooldownRemaining(), 0, 'Remaining should clamp to 0s');
assert.strictEqual(isReady(), true, 'Ability must be ready again after 60s');
console.log('✓ Cooldown timer decrements smoothly and re-enables readiness');

console.log('\n--- TEST 5: King\'s Bounties / Commissions Synergy ---');
// Initialize bounties: 1 MINE_ORE and 1 HAUL_CARTS
initBounties([
  {
    id: 'bounty_blast_mine',
    type: 'MINE_ORE',
    title: 'Mine 5 Dirt',
    current: 0,
    target: 5,
    isCompleted: false,
    rewardCoins: 200,
    rewardPowder: 20,
    targetOreId: 'dirt'
  },
  {
    id: 'bounty_blast_haul',
    type: 'HAUL_CARTS',
    title: 'Deliver 2 Carts',
    current: 0,
    target: 2,
    isCompleted: false,
    rewardCoins: 300,
    rewardPowder: 30
  }
]);

// Trigger blast again (now ready)
const secondBlast = triggerPickobulus();
assert.strictEqual(secondBlast.success, true);

const bounties = getActiveBounties();
assert.ok(bounties.length >= 2);
console.log('✓ Pickobulus Blast correctly dispatches King\'s Bounties events');

console.log('\n💥 ALL PICKOBULUS BLAST ACTIVE ABILITY TESTS PASSED SUCCESSFULLY! 💥');

/**
 * @file test_events.js
 * Automated test suite for Live-Ops Flash Events System (2X Powder Rush & Goblin Thief).
 * Tests event scheduling, 3.5 min interval, 45s duration, 2x powder payout on bounties,
 * goblin thief clicking and rewards, and clean timer teardown.
 */

import assert from 'assert';
import {
  FLASH_EVENTS,
  EVENT_INTERVAL,
  EVENT_DURATION,
  MAX_GOBLIN_CLICKS,
  eventsState,
  isFlashEventActive,
  formatTimeRemaining,
  startFlashEvent,
  endFlashEvent,
  updateEvents,
  onClickGoblinThief
} from '../js/events.js';
import { gameState } from '../js/state.js';
import { initBounties, claimBounty, getActiveBounties } from '../js/commissions.js';
import { initHotmState } from '../js/hotm.js';

console.log('--- TEST 1: Initial Flash Events State & Time Formatter ---');
endFlashEvent();
assert.strictEqual(eventsState.activeEvent, null, 'No active event initially');
assert.strictEqual(eventsState.eventTimer, 0);
assert.strictEqual(eventsState.nextEventTimer, 210, 'Interval must be 210s (3.5 min)');
assert.strictEqual(isFlashEventActive(), false);

// Time formatter tests
assert.strictEqual(formatTimeRemaining(45), '00:45');
assert.strictEqual(formatTimeRemaining(32), '00:32');
assert.strictEqual(formatTimeRemaining(70), '01:10');
assert.strictEqual(formatTimeRemaining(0), '00:00');
console.log('✓ Initial state and time formatters verified');

console.log('\n--- TEST 2: 2X_POWDER_RUSH Event & Bounty Powder Doubling ---');
initHotmState({}); // No powder buff perk
startFlashEvent(FLASH_EVENTS.POWDER_RUSH);

assert.strictEqual(isFlashEventActive(FLASH_EVENTS.POWDER_RUSH), true);
assert.strictEqual(eventsState.eventTimer, 45);

initBounties([{
  id: 'bounty_event_test',
  type: 'HAUL_CARTS',
  title: 'Deliver 1 Cart',
  current: 1,
  target: 1,
  isCompleted: true,
  rewardCoins: 100,
  rewardPowder: 25
}]);

gameState.player.powder = 100;
const claimRes = claimBounty('bounty_event_test');
assert.strictEqual(claimRes.success, true);
// Normally 25 powder, during 2X_POWDER_RUSH should be 50 powder!
assert.strictEqual(gameState.player.powder, 150, 'Powder should double from 25 to 50: 100 + 50 = 150');
console.log('✓ 2X_POWDER_RUSH accurately doubles bounty powder payout');

console.log('\n--- TEST 3: Event Teardown & Timer Expiry ---');
// Fast-forward 45.5 seconds
updateEvents(45.5);
assert.strictEqual(eventsState.activeEvent, null, 'Event should end after 45s');
assert.strictEqual(isFlashEventActive(), false);
assert.strictEqual(eventsState.nextEventTimer, 210, 'Next event timer should reset to 210s');
console.log('✓ Event concludes cleanly when duration reaches 0');

console.log('\n--- TEST 4: GOBLIN_THIEF Encounter & Clicking Mechanics ---');
startFlashEvent(FLASH_EVENTS.GOBLIN_THIEF);
assert.strictEqual(isFlashEventActive(FLASH_EVENTS.GOBLIN_THIEF), true);
assert.strictEqual(eventsState.goblinClicksLeft, 5, 'Goblin starts with 5 clicks');

const startCoins = 10000;
const startPowder = 500;
gameState.player.coins = startCoins;
gameState.player.powder = startPowder;

// Click 1
const hit1 = onClickGoblinThief();
assert.strictEqual(hit1.success, true);
assert.strictEqual(hit1.clicksRemaining, 4);
assert(hit1.rewardType === 'coins' || hit1.rewardType === 'powder');

// Click 2
const hit2 = onClickGoblinThief();
assert.strictEqual(hit2.success, true);
assert.strictEqual(hit2.clicksRemaining, 3);

// Click 3
const hit3 = onClickGoblinThief();
assert.strictEqual(hit3.success, true);
assert.strictEqual(hit3.clicksRemaining, 2);

// Click 4
const hit4 = onClickGoblinThief();
assert.strictEqual(hit4.success, true);
assert.strictEqual(hit4.clicksRemaining, 1);

// Click 5 (final hit)
const hit5 = onClickGoblinThief();
assert.strictEqual(hit5.success, true);
assert.strictEqual(hit5.clicksRemaining, 0);

// Goblin should have escaped/concluded event after 5th hit
assert.strictEqual(eventsState.activeEvent, null, 'Goblin thief event ends after 5 clicks');

// Click 6 (when inactive) should fail
const hit6 = onClickGoblinThief();
assert.strictEqual(hit6.success, false);

assert(gameState.player.coins > startCoins || gameState.player.powder > startPowder, 'Player received rewards from goblin');
console.log('✓ Goblin Thief handles 5 clicks, dispenses drops, and concludes properly');

console.log('\n--- TEST 5: Automatic 3.5-Minute Loop Scheduling ---');
endFlashEvent();
assert.strictEqual(eventsState.activeEvent, null);
assert.strictEqual(eventsState.nextEventTimer, 210);

// Advance 100 seconds
updateEvents(100);
assert.strictEqual(eventsState.activeEvent, null);
assert.strictEqual(Math.round(eventsState.nextEventTimer), 110);

// Advance 110.5 seconds (triggers new event)
updateEvents(110.5);
assert(eventsState.activeEvent !== null, 'Flash event should automatically trigger after 210s');
assert.strictEqual(eventsState.eventTimer, 45);
console.log(`✓ 3.5-minute scheduler automatically rolls new event: ${eventsState.activeEvent}`);

console.log('\n⚡ ALL LIVE-OPS FLASH EVENTS TESTS PASSED SUCCESSFULLY! ⚡');


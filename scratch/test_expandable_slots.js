/**
 * @file test_expandable_slots.js
 * @description Verification suite for the Expandable Worker Slot System,
 * Cat Snack Bar dynamic worktop scaling, cart capacity scaling, and workforce distribution.
 */

import {
  getStationSlots,
  getTotalMaxSlots,
  getMaxWorkers,
  STATIONS,
  WORKER_HIRE_COSTS,
  getHireMinerCost,
  hireExtraMiner
} from '../js/stations.js';
import {
  gameState,
  getMaxStorage,
  isSurfaceStorageFull,
  addOreToInventory,
  getTotalStoredOres,
  setMinerCountProvider
} from '../js/state.js';
import {
  MinerAgent,
  MinerState,
  activeMinerAgents,
  getWorkersAtStation,
  getStationAvailableSlots,
  getAvailableStationSlotIndex,
  getStationWaypoint
} from '../js/minerFSM.js';
import { updateStationDigSlotsUI, updateStationButtonsState } from '../js/ui.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== RUNNING VERIFICATION SUITE: EXPANDABLE WORKER SLOTS (CAT SNACK BAR) ===\n');

// --------------------------------------------------------------------------
// TEST GROUP 1: Dynamic Station Slot Calculation
// --------------------------------------------------------------------------
console.log('--- Test Group 1: Dynamic Station Slot Calculation ---');

assert(getStationSlots(1) === 1, 'Level 1 has 1 worker slot');
assert(getStationSlots(5) === 1, 'Level 5 has 1 worker slot');
assert(getStationSlots(9) === 1, 'Level 9 has 1 worker slot');
assert(getStationSlots(10) === 2, 'Level 10 unlocks 2nd worker slot (Milestone!)');
assert(getStationSlots(15) === 2, 'Level 15 has 2 worker slots');
assert(getStationSlots(24) === 2, 'Level 24 has 2 worker slots');
assert(getStationSlots(25) === 3, 'Level 25 unlocks 3rd worker slot (Milestone!)');
assert(getStationSlots(50) === 3, 'Level 50 has 3 worker slots');

// Check station object getter
const dummyStation = { level: 1 };
assert(getStationSlots(dummyStation) === 1, 'Object with level 1 has 1 slot');
dummyStation.level = 10;
assert(getStationSlots(dummyStation) === 2, 'Object with level 10 has 2 slots');
dummyStation.level = 25;
assert(getStationSlots(dummyStation) === 3, 'Object with level 25 has 3 slots');

// --------------------------------------------------------------------------
// TEST GROUP 2: getTotalMaxSlots Progression (1 to 9)
// --------------------------------------------------------------------------
console.log('\n--- Test Group 2: getTotalMaxSlots Progression (1 to 9) ---');

// Reset stations to clean state
STATIONS[0].unlocked = true;
STATIONS[0].level = 1;

STATIONS[1].unlocked = false;
STATIONS[1].level = 1;

STATIONS[2].unlocked = false;
STATIONS[2].level = 1;

assert(getTotalMaxSlots() === 1, `Initially only Station 1 Lv 1 unlocked: total slots is 1 (got: ${getTotalMaxSlots()})`);
assert(getMaxWorkers() === 1, 'getMaxWorkers() matches getTotalMaxSlots()');

// Station 1 reaches Lv 10
STATIONS[0].level = 10;
assert(getTotalMaxSlots() === 2, `Station 1 Lv 10 has 2 slots (got: ${getTotalMaxSlots()})`);

// Station 1 reaches Lv 25
STATIONS[0].level = 25;
assert(getTotalMaxSlots() === 3, `Station 1 Lv 25 has 3 slots (got: ${getTotalMaxSlots()})`);

// Station 2 unlocks at Lv 1
STATIONS[1].unlocked = true;
STATIONS[1].level = 1;
assert(getTotalMaxSlots() === 4, `Station 1 Lv 25 + Station 2 Lv 1 = 4 slots (got: ${getTotalMaxSlots()})`);

// Station 2 reaches Lv 10
STATIONS[1].level = 10;
assert(getTotalMaxSlots() === 5, `Station 1 Lv 25 + Station 2 Lv 10 = 5 slots (got: ${getTotalMaxSlots()})`);

// Station 2 reaches Lv 25
STATIONS[1].level = 25;
assert(getTotalMaxSlots() === 6, `Station 1 Lv 25 + Station 2 Lv 25 = 6 slots (got: ${getTotalMaxSlots()})`);

// Station 3 unlocks at Lv 1
STATIONS[2].unlocked = true;
STATIONS[2].level = 1;
assert(getTotalMaxSlots() === 7, `All 3 stations unlocked (Lv 25, 25, 1) = 7 slots (got: ${getTotalMaxSlots()})`);

// Station 3 reaches Lv 10
STATIONS[2].level = 10;
assert(getTotalMaxSlots() === 8, `All 3 stations unlocked (Lv 25, 25, 10) = 8 slots (got: ${getTotalMaxSlots()})`);

// Station 3 reaches Lv 25
STATIONS[2].level = 25;
assert(getTotalMaxSlots() === 9, `All 3 stations maxed at Lv 25 = 9 slots (got: ${getTotalMaxSlots()})`);

// --------------------------------------------------------------------------
// TEST GROUP 3: Dynamic Cart Vault Capacity Scaling
// --------------------------------------------------------------------------
console.log('\n--- Test Group 3: Dynamic Cart Vault Capacity Scaling ---');

assert(getMaxStorage(0) === 20, '0 miners = 20 max storage');
assert(getMaxStorage(1) === 35, '1 miner = 35 max storage (20 + 1 * 15)');
assert(getMaxStorage(2) === 50, '2 miners = 50 max storage (20 + 2 * 15)');
assert(getMaxStorage(3) === 65, '3 miners = 65 max storage (20 + 3 * 15)');
assert(getMaxStorage(6) === 110, '6 miners = 110 max storage (20 + 6 * 15)');
assert(getMaxStorage(9) === 155, '9 miners = 155 max storage (20 + 9 * 15)');

// Provider integration test
let testMinerCount = 4;
setMinerCountProvider(() => testMinerCount);
assert(getMaxStorage() === 80, `Live provider with 4 miners returns 80 (got: ${getMaxStorage()})`);
assert(gameState.maxStorage === 80, `gameState.maxStorage getter returns 80 (got: ${gameState.maxStorage})`);

// Reset provider to live activeMinerAgents length
setMinerCountProvider(() => activeMinerAgents.length);

// --------------------------------------------------------------------------
// TEST GROUP 4: Workforce Assignment & Non-Crowding
// --------------------------------------------------------------------------
console.log('\n--- Test Group 4: Workforce Assignment & Non-Crowding ---');

activeMinerAgents.length = 0;
STATIONS[0].unlocked = true;
STATIONS[0].level = 10; // 2 slots: index 0 and index 1
STATIONS[1].unlocked = false;
STATIONS[2].unlocked = false;

assert(getStationAvailableSlots(STATIONS[0]) === 2, 'Station 1 at Lv 10 has 2 available slots initially');
assert(getAvailableStationSlotIndex(STATIONS[0]) === 0, 'First available slot index is 0');

// Worker 1 targets Station 1
const worker1 = new MinerAgent({ id: 'w1' });
worker1.targetStation = STATIONS[0];
worker1.assignedSlotIndex = 0;
worker1.state = MinerState.MINING;
activeMinerAgents.push(worker1);

assert(getWorkersAtStation('station-1').length === 1, '1 worker assigned to station-1');
assert(getStationAvailableSlots(STATIONS[0]) === 1, 'Station 1 has 1 available slot remaining');
assert(getAvailableStationSlotIndex(STATIONS[0]) === 1, 'Next available slot index is 1');

// Worker 2 targets Station 1
const worker2 = new MinerAgent({ id: 'w2' });
worker2.targetStation = STATIONS[0];
worker2.assignedSlotIndex = 1;
worker2.state = MinerState.MOVING_TO_STATION;
activeMinerAgents.push(worker2);

assert(getWorkersAtStation('station-1').length === 2, '2 workers assigned to station-1');
assert(getStationAvailableSlots(STATIONS[0]) === 0, 'Station 1 is now FULL (0 available slots)');
assert(getAvailableStationSlotIndex(STATIONS[0]) === -1, 'getAvailableStationSlotIndex returns -1 when full');

// Worker 3 in IDLE cannot crowd Station 1
const worker3 = new MinerAgent({ id: 'w3' });
worker3.state = MinerState.IDLE;
activeMinerAgents.push(worker3);

// Tick worker 3
worker3.update(0.1);
assert(worker3.state === MinerState.IDLE, 'Worker 3 remains in IDLE because all station slots are full');
assert(worker3.targetStation === null, 'Worker 3 has no targetStation (does not crowd node)');

// Worker 1 finishes and departs to surface
worker1.carriedOres = new Array(worker1.getEffectiveBackpackCapacity()).fill({ oreId: 'dirt', value: 1 });
worker1.update(0.1); // transitions to MOVING_TO_SURFACE
assert(worker1.state === MinerState.MOVING_TO_SURFACE, 'Worker 1 departs to surface');
assert(worker1.assignedSlotIndex === null, 'Worker 1 freed their slot index');
assert(worker1.targetStation === null, 'Worker 1 freed station assignment');

// Now slot 0 is free!
assert(getStationAvailableSlots(STATIONS[0]) === 1, 'Station 1 now has 1 slot available');
assert(getAvailableStationSlotIndex(STATIONS[0]) === 0, 'Available slot is 0');

// Worker 3 ticks and takes the newly opened slot
worker3.update(0.1);
assert(worker3.state === MinerState.MOVING_TO_STATION, 'Worker 3 now claims the opened slot and moves to station');
assert(worker3.assignedSlotIndex === 0, 'Worker 3 assigned to slot index 0');

// Clean up test workers
activeMinerAgents.length = 0;

// --------------------------------------------------------------------------
// TEST GROUP 5: Hiring Validation & Cap Messages
// --------------------------------------------------------------------------
console.log('\n--- Test Group 5: Hiring Validation & Cap Messages ---');

STATIONS[0].unlocked = true;
STATIONS[0].level = 1; // 1 slot
STATIONS[1].unlocked = false;
STATIONS[2].unlocked = false;

// Spawn 1 worker
const starterWorker = new MinerAgent({ id: 'starter' });
activeMinerAgents.push(starterWorker);

// Now slots are 1/1
const hireResult = hireExtraMiner();
assert(hireResult.success === false, 'Hiring is blocked when at total max slots');
assert(hireResult.reason === 'Slots Full (Reach Lv 10/25)', `Blocked reason is 'Slots Full (Reach Lv 10/25)' (got: '${hireResult.reason}')`);

// Clean up
activeMinerAgents.length = 0;

// --------------------------------------------------------------------------
// TEST GROUP 6: Slot Waypoint Offsets
// --------------------------------------------------------------------------
console.log('\n--- Test Group 6: Slot Waypoint Offsets ---');

const wp0 = getStationWaypoint('station-1', 0);
const wp1 = getStationWaypoint('station-1', 1);
const wp2 = getStationWaypoint('station-1', 2);

assert(wp1.x === STATIONS[0].workerSpotX, `Slot 1 is centered at baseX (got: ${wp1.x})`);
assert(wp0.x < wp1.x, `Slot 0 is shifted left of Slot 1 (wp0: ${wp0.x}, wp1: ${wp1.x})`);
assert(wp2.x > wp1.x, `Slot 2 is shifted right of Slot 1 (wp2: ${wp2.x}, wp1: ${wp1.x})`);
assert(wp0.y === wp1.y && wp1.y === wp2.y, 'All slots share identical Y coordinate along the platform');

// --------------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------------
console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL EXPANDABLE WORKER SLOT TESTS PASSED PERFECTLY!\n');
}

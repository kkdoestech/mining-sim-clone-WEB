// scratch/test_capacity_and_workers.js
// Node.js test suite for worker visuals, worker cap, and backpack capacity

// Setup mock DOM environment
const mockElements = new Map();
function createMockElement(tag, id = '') {
  const el = {
    tagName: tag.toUpperCase(),
    id,
    className: '',
    innerHTML: '',
    textContent: '',
    style: {
      setProperty(prop, val) { this[prop] = val; }
    },
    addEventListener(event, fn) {},
    removeEventListener(event, fn) {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c, val) {
        if (val === undefined) val = !this.contains(c);
        if (val) this.add(c); else this.remove(c);
        return val;
      }
    },
    children: [],
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      child.parentNode = null;
      return child;
    },
    querySelector(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        const search = (node) => {
          if (node.classList?.contains(cls) || (node.className && node.className.split(' ').includes(cls))) {
            return node;
          }
          for (const ch of (node.children || [])) {
            const found = search(ch);
            if (found) return found;
          }
          return null;
        };
        return search(this);
      }
      return null;
    },
    querySelectorAll(sel) {
      const res = [];
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        const search = (node) => {
          if (node.classList?.contains(cls) || (node.className && node.className.split(' ').includes(cls))) {
            res.push(node);
          }
          for (const ch of (node.children || [])) {
            search(ch);
          }
        };
        search(this);
      }
      return res;
    },
    setAttribute(attr, val) { this[attr] = val; },
    getAttribute(attr) { return this[attr]; },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 400, height: 600 };
    }
  };

  // Observe innerHTML assignments to parse mock child nodes
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _html; },
    set(val) {
      _html = val;
      el.children = [];
      // Basic regex parse of div children
      const regex = /<div class="([^"]+)"(?:\s+id="([^"]+)")?(?:\s+style="([^"]+)")?>([\s\S]*?)<\/div>/g;
      let match;
      while ((match = regex.exec(val)) !== null) {
        const child = createMockElement('div', match[2] || '');
        child.className = match[1];
        match[1].split(' ').forEach(c => child.classList.add(c));
        child.textContent = match[4].replace(/<[^>]+>/g, '').trim();
        child.innerHTML = match[4];
        child.parentNode = el;
        el.children.push(child);
      }
    }
  });

  if (id) mockElements.set(id, el);
  return el;
}

global.document = {
  getElementById(id) {
    if (!mockElements.has(id)) {
      const el = createMockElement('div', id);
      mockElements.set(id, el);
    }
    return mockElements.get(id);
  },
  createElement(tag) {
    return createMockElement(tag);
  },
  querySelectorAll(sel) {
    return [];
  }
};
global.window = global;

async function runTests() {
  console.log('=== RUNNING VERIFICATION SUITE: WORKER VISUALS, WORKER CAP & BACKPACK ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const { gameState, getTotalStoredOres, getMaxStorage, isSurfaceStorageFull, addOreToInventory } = await import('../js/state.js');
  const { STATIONS, getMaxWorkers, hireExtraMiner } = await import('../js/stations.js');
  const { MinerAgent, MinerState, activeMinerAgents, initTycoonWorkers } = await import('../js/minerFSM.js');
  const { triggerPickobulus } = await import('../js/abilities.js');
  const { sellAllOres } = await import('../js/economy.js');

  // ----------------------------------------------------
  // TEST GROUP 1: Worker Visuals & Template Structure
  // ----------------------------------------------------
  console.log('--- Test Group 1: Worker Visuals & DOM Template ---');
  const parent = createMockElement('div', 'workers-container');
  const miner = new MinerAgent({
    id: 'test_1',
    avatar: '⛏️',
    backpackCapacity: 5
  });

  miner.initDOM(parent);
  assert(miner.domElement !== null, 'Worker DOM element was instantiated');
  assert(miner.domElement.id === 'worker-test_1', `Worker ID set correctly (got: ${miner.domElement.id})`);
  assert(!miner.domElement.innerHTML.includes('undefined'), 'No "undefined" text rendered in worker HTML');
  assert(miner.visualElement !== null, '.worker-visual sprite element exists');
  assert(miner.badgeElement !== null, '.worker-backpack-badge element exists');

  // Direction flipping test
  miner.facing = -1; // Walking left
  miner.updateVisuals();
  assert(miner.visualElement.style.transform === 'scaleX(-1)', '.worker-visual is flipped with scaleX(-1)');
  assert(!miner.domElement.style.transform || !miner.domElement.style.transform.includes('scaleX(-1)'), 'Root .worker-agent is NOT flipped (badge remains upright)');

  // ----------------------------------------------------
  // TEST GROUP 2: Worker Cap & Station Slots
  // ----------------------------------------------------
  console.log('\n--- Test Group 2: Worker Cap Based on Station Slots ---');
  // Reset stations: Lv 1 = 1 slot, Lv 10 = 2 slots, Lv 25 = 3 slots
  STATIONS[0].unlocked = true;
  STATIONS[0].level = 1; // 1 slot
  STATIONS[1].unlocked = false;
  STATIONS[1].level = 10; // 2 slots when unlocked
  STATIONS[2].unlocked = false;
  STATIONS[2].level = 25; // 3 slots when unlocked

  activeMinerAgents.length = 0;
  gameState.player.coins = 100000;

  // Station 1 only: slots = 1, maxWorkers = 1
  assert(getMaxWorkers() === 1, `Max workers with Station 1 only is 1 (got: ${getMaxWorkers()})`);

  // Spawn 1 worker
  initTycoonWorkers(1);
  assert(activeMinerAgents.length === 1, `Spawned 1 worker (active: ${activeMinerAgents.length})`);

  // Attempting to hire beyond cap fails
  const hireRes1 = hireExtraMiner();
  assert(!hireRes1.success, `Hiring blocked when stations are full (reason: ${hireRes1.reason})`);
  assert(activeMinerAgents.length === 1, 'Active worker count remains 1');

  // Unlock Station 2 (+2 slots => 3 total)
  STATIONS[1].unlocked = true;
  assert(getMaxWorkers() === 3, `Max workers with Station 1 & 2 is 3 (got: ${getMaxWorkers()})`);

  const hireRes2 = hireExtraMiner();
  assert(hireRes2.success, `Hired 2nd worker successfully (now ${activeMinerAgents.length}/3)`);
  const hireRes3 = hireExtraMiner();
  assert(hireRes3.success, `Hired 3rd worker successfully (now ${activeMinerAgents.length}/3)`);

  const hireRes4 = hireExtraMiner();
  assert(!hireRes4.success, `Hiring 4th worker blocked (at cap 3/3)`);
  assert(activeMinerAgents.length === 3, 'Active worker count remains 3');

  // Unlock Station 3 (+3 slots => 6 total)
  STATIONS[2].unlocked = true;
  assert(getMaxWorkers() === 6, `Max workers with all 3 stations is 6 (got: ${getMaxWorkers()})`);

  hireExtraMiner(); // 4
  hireExtraMiner(); // 5
  hireExtraMiner(); // 6
  assert(activeMinerAgents.length === 6, `Hired up to 6 workers (active: ${activeMinerAgents.length})`);

  const hireRes7 = hireExtraMiner();
  assert(!hireRes7.success, `Hiring 7th worker blocked (capped at max 6)`);
  assert(activeMinerAgents.length === 6, 'Active worker count stays capped at 6');

  // ----------------------------------------------------
  // TEST GROUP 3: Personal Backpack Capacity Enforcement
  // ----------------------------------------------------
  console.log('\n--- Test Group 3: Strict Personal Backpack Capacity ---');
  const testWorker = new MinerAgent({
    id: 'pack_worker',
    backpackCapacity: 3
  });
  testWorker.initDOM(parent);

  // Fill worker's personal backpack to capacity (3/3)
  testWorker.carriedOres = [
    { oreId: 'dirt', value: 1 },
    { oreId: 'dirt', value: 1 },
    { oreId: 'dirt', value: 1 }
  ];
  testWorker.updateBackpackUI();
  assert(testWorker.badgeElement.textContent === '3/3', `Backpack badge shows 3/3 (got: ${testWorker.badgeElement.textContent})`);

  // In IDLE, worker cannot mine with full pack; must head to surface
  testWorker.state = MinerState.IDLE;
  testWorker.currentX = 180;
  testWorker.currentY = 250;
  testWorker.update(0.1);
  assert(testWorker.state === MinerState.MOVING_TO_SURFACE, `Worker with full pack transitions from IDLE to MOVING_TO_SURFACE (got: ${testWorker.state})`);

  // In MINING, if pack becomes full, worker diverts to surface
  testWorker.state = MinerState.MINING;
  testWorker.targetStation = STATIONS[0];
  testWorker.update(0.1);
  assert(testWorker.state === MinerState.MOVING_TO_SURFACE, `Worker in MINING diverts to MOVING_TO_SURFACE when pack is full`);

  // ----------------------------------------------------
  // TEST GROUP 4: Strict Surface Cart Storage (maxStorage = 20)
  // ----------------------------------------------------
  console.log('\n--- Test Group 4: Surface Storage & Cart Deposition ---');
  // Clear active miners for clean 20 base storage test
  activeMinerAgents.length = 0;
  // Reset inventory
  Object.keys(gameState.inventory).forEach(k => gameState.inventory[k] = 0);
  assert(getTotalStoredOres() === 0, 'Surface storage starts empty');
  assert(getMaxStorage(0) === 20, 'Max storage with 0 miners is 20');

  // Add 18 ores to surface storage
  addOreToInventory('dirt', 18);
  assert(getTotalStoredOres() === 18, `Surface storage has 18 ores (got: ${getTotalStoredOres()})`);
  assert(!isSurfaceStorageFull(), 'Surface storage is not full at 18/20');

  // Try adding 10 more ores -> should clamp to 20
  const added = addOreToInventory('dirt', 10);
  assert(added === 2, `addOreToInventory clamped addition to 2 (got: ${added})`);
  assert(getTotalStoredOres() === 20, `Surface storage capped at 20 (got: ${getTotalStoredOres()})`);
  assert(isSurfaceStorageFull(), 'isSurfaceStorageFull() is true at 20/20');

  // Worker arrives at surface cart with 3 carried ores while cart is full
  const { getSurfaceWaypoint } = await import('../js/minerFSM.js');
  const surfPt = getSurfaceWaypoint();
  testWorker.currentX = surfPt.x;
  testWorker.currentY = surfPt.y;
  testWorker.state = MinerState.DEPOSITING;
  testWorker.depositTimer = 0.05;
  testWorker.carriedOres = [
    { oreId: 'dirt', value: 1 },
    { oreId: 'dirt', value: 1 },
    { oreId: 'dirt', value: 1 }
  ];

  testWorker.update(0.1); // Finish deposit timer
  assert(getTotalStoredOres() === 20, 'Surface cart did NOT exceed 20');
  assert(testWorker.carriedOres.length === 3, `Worker kept 3 ores because surface cart was full (got: ${testWorker.carriedOres.length})`);
  assert(testWorker.state === MinerState.IDLE, 'Worker returned to IDLE');

  // In IDLE at surface while cart is full, worker waits at surface
  testWorker.update(0.1);
  assert(testWorker.state === MinerState.IDLE, 'Worker waits in IDLE at surface while cart is full');

  // Player clicks "Sell Ores" (sellAllOres)
  sellAllOres();
  assert(getTotalStoredOres() === 0, 'Cart emptied after selling all ores');
  assert(!isSurfaceStorageFull(), 'isSurfaceStorageFull() is false after sell');

  // Worker in IDLE now deposits remaining ores
  testWorker.update(0.1);
  assert(testWorker.state === MinerState.DEPOSITING, 'Worker transitions from IDLE to DEPOSITING now that cart has space');
  testWorker.depositTimer = 0.05;
  testWorker.update(0.1);
  assert(getTotalStoredOres() === 3, `Worker deposited 3 ores into empty cart (got: ${getTotalStoredOres()})`);
  assert(testWorker.carriedOres.length === 0, 'Worker backpack is now empty (0/3)');

  // Pickobulus Blast liquidates cart inventory
  addOreToInventory('copper', 15);
  assert(getTotalStoredOres() === 18, 'Added 15 copper ores to cart (now 18 total)');
  triggerPickobulus();
  assert(getTotalStoredOres() === 0, 'Pickobulus Blast successfully liquidated stored ores');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Error running test suite:', err);
  process.exit(1);
});

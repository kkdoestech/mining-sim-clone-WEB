// scratch/test_economy_pacing.js
// Discrete Event Pacing Simulation for Mining Sim Rebalance (11-13 minute target)

import { STATIONS, getStationUpgradeCost, calculateStationMultiplier, getStationSpeedMultiplier, getStationSlots, WORKER_HIRE_COSTS } from '../js/stations.js';
import { ORES } from '../js/data/ores.js';

console.log('=== RUNNING ECONOMIC PACING SIMULATION (11-13 MINUTE TARGET) ===\n');

// Station baselines calibrated for Tier 1 Surface Quarry
const stations = [
  { id: 'station-1', name: 'Station 1 (Dirt)', level: 1, unlocked: true, unlockCost: 0, baseCost: 10, baseOreValue: 1, maxHP: 15, currentHP: 15, dist: 140 },
  { id: 'station-2', name: 'Station 2 (Copper)', level: 1, unlocked: false, unlockCost: 280, baseCost: 35, baseOreValue: 5, maxHP: 45, currentHP: 45, dist: 219 },
  { id: 'station-3', name: 'Station 3 (Gold)', level: 1, unlocked: false, unlockCost: 2200, baseCost: 180, baseOreValue: 24, maxHP: 110, currentHP: 110, dist: 315 }
];

let playerCoins = 0;
const baseMiningPower = 10;
const moveSpeed = 90; // px/s
const depositDuration = 0.25; // 0.25s turnaround at surface

let timeElapsed = 0;
const dt = 0.1; // 100ms ticks

let station2UnlockTime = null;
let station3UnlockTime = null;
let allLevel25Time = null;
let bountyTimer = 0;

function getOreVal(station) {
  const milestoneMult = calculateStationMultiplier(station.level);
  const expGrowth = Math.pow(1.08, Math.max(0, station.level - 1));
  return Math.max(1, Math.round(station.baseOreValue * expGrowth * milestoneMult));
}

const workers = [
  { stationIndex: 0, state: 'MINING', timer: 0, carriedVal: 0, carriedCount: 0 }
];

function getMaxWorkerSlots() {
  return stations.filter(s => s.unlocked).reduce((sum, s) => sum + getStationSlots(s.level), 0);
}

function getHaulDuration(stationIndex) {
  return (stations[stationIndex].dist * 2 / moveSpeed) + depositDuration;
}

while (timeElapsed < 20 * 60) {
  timeElapsed += dt;

  // 1. Casual Pickobulus activation every 90 seconds
  if (Math.floor(timeElapsed) % 90 === 0 && Math.abs(timeElapsed - Math.floor(timeElapsed)) < 0.05) {
    for (const st of stations) {
      if (st.unlocked) playerCoins += getOreVal(st);
    }
  }

  // 2. Casual King's Bounty claim: ~1 completed bounty (200 coins) claimed every 75 seconds
  bountyTimer += dt;
  if (bountyTimer >= 75) {
    bountyTimer = 0;
    playerCoins += 200;
  }

  // 3. Casual tap input: ~1.2 DPS on deepest unlocked node
  const deepest = stations[stations[2].unlocked ? 2 : (stations[1].unlocked ? 1 : 0)];
  deepest.currentHP -= 1.2 * dt;
  if (deepest.currentHP <= 0) {
    deepest.currentHP = deepest.maxHP;
    playerCoins += getOreVal(deepest);
  }

  // 4. Worker excavation & hauling loop
  for (let w = 0; w < workers.length; w++) {
    const worker = workers[w];
    const targetSt = stations[worker.stationIndex];

    if (!targetSt.unlocked) {
      const unlockedIndices = stations.map((s, idx) => s.unlocked ? idx : -1).filter(idx => idx !== -1);
      worker.stationIndex = unlockedIndices[w % unlockedIndices.length];
      continue;
    }

    if (worker.state === 'MINING') {
      const spd = getStationSpeedMultiplier(targetSt.level);
      const dmg = (baseMiningPower + (w * 2)) * spd * dt;
      targetSt.currentHP -= dmg;

      if (targetSt.currentHP <= 0) {
        targetSt.currentHP = targetSt.maxHP;
        const oreVal = getOreVal(targetSt);
        worker.carriedVal += oreVal;
        worker.carriedCount = (worker.carriedCount || 0) + 1;

        if (worker.carriedCount >= 4) {
          worker.carriedCount = 0;
          worker.state = 'HAULING';
          worker.timer = getHaulDuration(worker.stationIndex);
        }
      }
    } else if (worker.state === 'HAULING') {
      worker.timer -= dt;
      if (worker.timer <= 0) {
        playerCoins += worker.carriedVal;
        worker.carriedVal = 0;
        worker.state = 'MINING';

        // Distribute workers across stations respecting unlocked slots
        const s3Slots = stations[2].unlocked ? getStationSlots(stations[2].level) : 0;
        const s2Slots = stations[1].unlocked ? getStationSlots(stations[1].level) : 0;
        if (stations[2].unlocked && w < s3Slots) {
          worker.stationIndex = 2;
        } else if (stations[1].unlocked && w < s3Slots + s2Slots) {
          worker.stationIndex = 1;
        } else {
          worker.stationIndex = 0;
        }
      }
    }
  }

  // 5. Strategic unlocks & upgrades
  if (!stations[1].unlocked && playerCoins >= stations[1].unlockCost) {
    playerCoins -= stations[1].unlockCost;
    stations[1].unlocked = true;
    station2UnlockTime = timeElapsed;
    console.log(`⏱️ [${formatTime(timeElapsed)}] UNLOCKED Station 2 (Copper)! Coins remaining: ${playerCoins}`);
  }

  if (stations[1].unlocked && !stations[2].unlocked && playerCoins >= stations[2].unlockCost) {
    playerCoins -= stations[2].unlockCost;
    stations[2].unlocked = true;
    station3UnlockTime = timeElapsed;
    console.log(`⏱️ [${formatTime(timeElapsed)}] UNLOCKED Station 3 (Gold)! Coins remaining: ${playerCoins}`);
  }

  const maxSlots = getMaxWorkerSlots();
  if (workers.length < maxSlots && workers.length < WORKER_HIRE_COSTS.length) {
    const hireCost = WORKER_HIRE_COSTS[workers.length];
    if (playerCoins >= hireCost) {
      playerCoins -= hireCost;
      const newWIdx = stations[2].unlocked ? 2 : (stations[1].unlocked ? 1 : 0);
      workers.push({ stationIndex: newWIdx, state: 'MINING', timer: 0, carriedVal: 0, carriedCount: 0 });
      console.log(`👷 [${formatTime(timeElapsed)}] HIRED Worker ${workers.length} for ${hireCost} coins! (Total: ${workers.length}/${maxSlots})`);
    }
  }

  // Save for next station unlocks once station reaches Lv 8+
  const savingForStation2 = !stations[1].unlocked && stations[0].level >= 8;
  const savingForStation3 = stations[1].unlocked && !stations[2].unlocked && stations[1].level >= 8;

  const eligibleStations = stations.filter(s => s.unlocked && s.level < 25);
  if (eligibleStations.length > 0 && !savingForStation2 && !savingForStation3) {
    eligibleStations.sort((a, b) => getStationUpgradeCost(a) - getStationUpgradeCost(b));
    const cheapest = eligibleStations[0];
    const cost = getStationUpgradeCost(cheapest);
    if (playerCoins >= cost) {
      playerCoins -= cost;
      cheapest.level++;
      if (cheapest.level === 10 || cheapest.level === 20 || cheapest.level === 25) {
        console.log(`⭐ [${formatTime(timeElapsed)}] ${cheapest.name} reached Milestone Level ${cheapest.level}! (Ore Value now: ${getOreVal(cheapest)})`);
      }
    }
  }

  if (!allLevel25Time && stations.every(s => s.unlocked && s.level >= 25)) {
    allLevel25Time = timeElapsed;
    console.log(`\n🎉 [${formatTime(timeElapsed)}] BIOME COMPLETE! All 3 stations reached Level 25! 🎉\n`);
    break;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

console.log('=== PACING VERIFICATION REPORT ===');
console.log(`- Station 1: Level ${stations[0].level}`);
console.log(`- Station 2: Level ${stations[1].level} (Unlocked at: ${station2UnlockTime ? formatTime(station2UnlockTime) : 'N/A'})`);
console.log(`- Station 3: Level ${stations[2].level} (Unlocked at: ${station3UnlockTime ? formatTime(station3UnlockTime) : 'N/A'})`);
console.log(`- Total Workers Hired: ${workers.length} / ${getMaxWorkerSlots()}`);
console.log(`- Biome Completion Time: ${allLevel25Time ? formatTime(allLevel25Time) : 'FAILED'}`);

const minutes = allLevel25Time ? allLevel25Time / 60 : 999;
if (minutes >= 11.0 && minutes <= 13.0) {
  console.log(`\n✅ TARGET MET: Biome completed in ${minutes.toFixed(1)} minutes (within 11-13 minute target window)!`);
  process.exit(0);
} else {
  console.error(`\n❌ TARGET OUT OF RANGE: Biome completed in ${minutes.toFixed(1)} minutes (Target: 11-13 mins)!`);
  process.exit(1);
}

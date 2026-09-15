/**
 * @file minerFSM.js
 * @description Autonomous worker Finite State Machine (FSM) inspired by the
 * ChefAI / Delivery worker loops in "Cat Snack Bar".
 * Controls miner movement, station excavation, ore hauling, surface depositing,
 * and triggers Game Feel & Juice feedback particles.
 */

import {
  gameState,
  getTotalStoredOres,
  getMaxStorage,
  isSurfaceStorageFull,
  setMinerCountProvider
} from './state.js';
import {
  STATIONS,
  damageStation,
  getStationOreValue,
  getStationSlots,
  getStation,
  unlockStation,
  upgradeStation,
  getMaxWorkers
} from './stations.js';
import {
  createFloatingText,
  createRockImpactParticles,
  triggerOreNodePunch,
  getStationRockCoords,
  getStationParticleColor
} from './juice.js';
import { onGameEvent } from './commissions.js';
import { getPerkMultiplier } from './hotm.js';
import { isFlashEventActive } from './events.js';

// Register live active miner count provider for dynamic cart capacity scaling
if (typeof setMinerCountProvider === 'function') {
  setMinerCountProvider(() => activeMinerAgents.length);
}

/**
 * Primary FSM State Enum for Autonomous Miner Agents
 * @readonly
 * @enum {string}
 */
export const MinerState = {
  IDLE: 'IDLE',
  MOVING_TO_STATION: 'MOVING_TO_STATION',
  MINING: 'MINING',
  MOVING_TO_SURFACE: 'MOVING_TO_SURFACE',
  DEPOSITING: 'DEPOSITING'
};

// Re-export STATIONS for external consumers
export { STATIONS };

/** Surface merchant cart waypoint position */
export const SURFACE_WAYPOINT = {
  x: 68,
  y: 72
};

/**
 * Returns active miners assigned to or currently digging at a station.
 * @param {string} stationId
 * @returns {MinerAgent[]}
 */
export function getWorkersAtStation(stationId) {
  return activeMinerAgents.filter(m =>
    m.targetStation &&
    m.targetStation.id === stationId &&
    (m.state === MinerState.MOVING_TO_STATION || m.state === MinerState.MINING)
  );
}

/**
 * Returns available unoccupied slot count for a station.
 * @param {MiningStation} station
 * @returns {number}
 */
export function getStationAvailableSlots(station) {
  const maxSlots = getStationSlots(station.level);
  const workers = getWorkersAtStation(station.id);
  return Math.max(0, maxSlots - workers.length);
}

/**
 * Finds the first unoccupied slot index (0, 1, or 2) for a station.
 * Returns -1 if all unlocked slots are currently occupied.
 * @param {MiningStation} station
 * @returns {number}
 */
export function getAvailableStationSlotIndex(station) {
  const maxSlots = getStationSlots(station.level);
  const occupiedSlots = new Set(
    getWorkersAtStation(station.id)
      .map(m => m.assignedSlotIndex)
      .filter(idx => typeof idx === 'number')
  );

  for (let i = 0; i < maxSlots; i++) {
    if (!occupiedSlots.has(i)) {
      return i;
    }
  }
  return -1;
}

/**
 * Computes destination waypoint coordinates for a station and specific slot,
 * querying live DOM positions if rendered, with reliable fallback.
 * @param {string} stationId
 * @param {number} [slotIndex=0]
 * @returns {{ x: number, y: number }}
 */
export function getStationWaypoint(stationId, slotIndex = 0) {
  const station = STATIONS.find(s => s.id === stationId);
  if (!station) return { x: 180, y: 156 };

  const slotIdx = Math.max(0, Math.min(2, Number(slotIndex) || 0));

  if (typeof document !== 'undefined') {
    const stage = document.getElementById('mine-stage');
    // Check for specific slot element first
    const slotEl = document.getElementById(`dig-slot-${stationId}-${slotIdx}`);
    if (stage && slotEl) {
      const stageRect = stage.getBoundingClientRect();
      const slotRect = slotEl.getBoundingClientRect();
      return {
        x: Math.round(slotRect.left - stageRect.left + (slotRect.width / 2) - 18),
        y: Math.round(slotRect.top - stageRect.top + (slotRect.height / 2) - 20)
      };
    }

    const spot = document.getElementById(`worker-spot-${stationId}`);
    if (stage && spot) {
      const stageRect = stage.getBoundingClientRect();
      const spotRect = spot.getBoundingClientRect();
      const offset = (slotIdx - 1) * 26;
      return {
        x: Math.round(spotRect.left - stageRect.left + (spotRect.width / 2) - 18 + offset),
        y: Math.round(spotRect.top - stageRect.top + (spotRect.height / 2) - 20)
      };
    }
  }

  const offset = (slotIdx - 1) * 26;
  return { x: station.workerSpotX + offset, y: station.workerSpotY };
}

/**
 * Computes destination waypoint for the surface merchant cart.
 * @returns {{ x: number, y: number }}
 */
export function getSurfaceWaypoint() {
  if (typeof document !== 'undefined') {
    const stage = document.getElementById('mine-stage');
    const cart = document.getElementById('merchant-cart-station');
    if (stage && cart) {
      const stageRect = stage.getBoundingClientRect();
      const cartRect = cart.getBoundingClientRect();
      return {
        x: Math.round(cartRect.left - stageRect.left + (cartRect.width / 2) - 18),
        y: Math.round(cartRect.top - stageRect.top + (cartRect.height / 2) - 16)
      };
    }
  }
  return { x: SURFACE_WAYPOINT.x, y: SURFACE_WAYPOINT.y };
}

/**
 * Autonomous Miner Agent Entity
 */
export class MinerAgent {
  /**
   * @param {Object} [config]
   * @param {string} [config.id]
   * @param {string} [config.name]
   * @param {string} [config.avatar]
   * @param {number} [config.miningPower]
   * @param {number} [config.moveSpeed]
   * @param {number} [config.backpackCapacity]
   * @param {number} [config.startX]
   * @param {number} [config.startY]
   */
  constructor(config = {}) {
    this.id = config.id || `miner_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.name = config.name || 'Novice Digger';
    this.avatar = config.avatar || '⛏️';
    this.miningPower = config.miningPower || 10; // Calibrated for ~1.8s block excavation on 15 HP node
    this.moveSpeed = config.moveSpeed || 90;     // Calibrated smooth 90px/sec movement speed
    this.backpackCapacity = config.backpackCapacity || 4; // Max carried ores (4 ores per miner)

    /** @type {{ oreId: string, value: number }[]} */
    this.carriedOres = [];

    // Spatial & movement coordinates
    this.currentX = config.startX ?? SURFACE_WAYPOINT.x;
    this.currentY = config.startY ?? SURFACE_WAYPOINT.y;
    this.targetX = this.currentX;
    this.targetY = this.currentY;
    this.facing = 1; // 1 = facing right, -1 = facing left

    // FSM State tracking
    this.state = MinerState.IDLE;
    this.targetStation = null;
    this.assignedSlotIndex = null;
    this.depositTimer = 0;
    this.chipCooldown = 0;

    // Visual DOM element
    /** @type {HTMLElement | null} */
    this.domElement = null;
    this.visualElement = null;
    this.badgeElement = null;
  }

  /**
   * Returns current effective move speed factored by HOTM 'speedy_hauler' perk.
   * @returns {number}
   */
  getEffectiveMoveSpeed() {
    const bonus = typeof getPerkMultiplier === 'function' ? getPerkMultiplier('speedy_hauler') : 0;
    return this.moveSpeed * (1 + bonus);
  }

  /**
   * Returns current effective backpack capacity factored by HOTM 'deep_pockets' perk.
   * @returns {number}
   */
  getEffectiveBackpackCapacity() {
    const bonus = typeof getPerkMultiplier === 'function' ? getPerkMultiplier('deep_pockets') : 0;
    return this.backpackCapacity + bonus;
  }

  /**
   * Instantiates and attaches the visual 2D miner sprite into the DOM.
   * Clean template with NO raw text fields or undefined properties.
   * @param {HTMLElement} parentContainer
   */
  initDOM(parentContainer) {
    if (typeof document === 'undefined' || !parentContainer) return;

    const el = document.createElement('div');
    el.className = 'worker-agent animated-miner';
    const idClean = String(this.id).replace(/^worker[-_]/, '');
    el.id = `worker-${idClean}`;
    const capacity = this.getEffectiveBackpackCapacity();
    const count = this.carriedOres ? this.carriedOres.length : 0;
    const badgeDisplay = count > 0 ? 'block' : 'none';

    el.innerHTML = `
      <div class="worker-visual">${this.avatar || '⛏️'}</div>
      <div class="worker-backpack-badge" style="display: ${badgeDisplay};">${count}/${capacity}</div>
    `;

    this.domElement = el;
    this.visualElement = el.querySelector('.worker-visual');
    this.badgeElement = el.querySelector('.worker-backpack-badge');

    parentContainer.appendChild(el);
    this.updateVisuals();
  }

  /**
   * Updates FSM behavior across a frame interval.
   * @param {number} deltaTime - Elapsed seconds since previous tick
   */
  update(deltaTime) {
    if (deltaTime <= 0) return;

    const capacity = this.getEffectiveBackpackCapacity();
    const surfacePos = getSurfaceWaypoint();
    const distToSurface = Math.hypot(surfacePos.x - this.currentX, surfacePos.y - this.currentY);
    const surfaceFull = isSurfaceStorageFull();
    const packFull = this.carriedOres.length >= capacity;

    switch (this.state) {
      // 1. IDLE: Evaluates unlocked stations and determines excavation target
      case MinerState.IDLE: {
        // A miner cannot mine if their personal pack is full
        if (packFull) {
          if (distToSurface > 8) {
            this.targetX = surfacePos.x;
            this.targetY = surfacePos.y;
            this.state = MinerState.MOVING_TO_SURFACE;
          } else if (!surfaceFull) {
            this.state = MinerState.DEPOSITING;
            this.depositTimer = 0.25;
          }
          // If at surface and surface cart is full, wait in IDLE at surface
          break;
        }

        // If surface vault/cart is full, miners wait in IDLE at the surface until player sells or triggers Pickobulus
        if (surfaceFull) {
          if (distToSurface > 8) {
            this.targetX = surfacePos.x;
            this.targetY = surfacePos.y;
            this.state = MinerState.MOVING_TO_SURFACE;
          }
          // Miner is at surface and cart is full -> wait in IDLE
          break;
        }

        // If miner has ores and is at surface, deposit first if space allows
        if (this.carriedOres.length > 0 && distToSurface <= 8) {
          this.state = MinerState.DEPOSITING;
          this.depositTimer = 0.25;
          break;
        }

        const unlocked = STATIONS.filter(s => s.unlocked || s.isUnlocked);
        if (unlocked.length === 0) break;

        // Choose station that has an available slot (do not crowd beyond available slots)
        const availableStations = unlocked.filter(s => getStationAvailableSlots(s) > 0);
        if (availableStations.length === 0) {
          // All station worktop slots currently full -> wait in IDLE
          break;
        }

        // Pick one among stations with open slots
        const chosen = availableStations[Math.floor(Math.random() * availableStations.length)];
        const slotIdx = getAvailableStationSlotIndex(chosen);
        if (slotIdx === -1) break;

        this.targetStation = chosen;
        this.assignedSlotIndex = slotIdx;

        const waypoint = getStationWaypoint(chosen.id, slotIdx);
        this.targetX = waypoint.x;
        this.targetY = waypoint.y;
        this.state = MinerState.MOVING_TO_STATION;
        break;
      }

      // 2. MOVING_TO_STATION: Paths toward designated station digging spot
      case MinerState.MOVING_TO_STATION: {
        // If pack became full or surface cart became full, divert to surface
        if (packFull || surfaceFull) {
          this.targetStation = null;
          this.assignedSlotIndex = null;
          this.targetX = surfacePos.x;
          this.targetY = surfacePos.y;
          this.state = MinerState.MOVING_TO_SURFACE;
          break;
        }

        const dx = this.targetX - this.currentX;
        const dy = this.targetY - this.currentY;
        const dist = Math.hypot(dx, dy);

        if (dist <= 4) {
          this.currentX = this.targetX;
          this.currentY = this.targetY;
          this.state = MinerState.MINING;
        } else {
          const step = Math.min(dist, this.getEffectiveMoveSpeed() * deltaTime);
          this.currentX += (dx / dist) * step;
          this.currentY += (dy / dist) * step;
          this.facing = dx >= 0 ? 1 : -1;
        }
        break;
      }

      // 3. MINING: Digs into ore node durability until backpack reaches capacity
      case MinerState.MINING: {
        // A miner cannot mine if their personal pack is full or surface cart is full
        if (packFull || surfaceFull) {
          this.targetStation = null;
          this.assignedSlotIndex = null;
          this.targetX = surfacePos.x;
          this.targetY = surfacePos.y;
          this.state = MinerState.MOVING_TO_SURFACE;
          break;
        }

        if (!this.targetStation || !(this.targetStation.unlocked || this.targetStation.isUnlocked)) {
          this.targetStation = null;
          this.assignedSlotIndex = null;
          this.state = MinerState.IDLE;
          break;
        }

        // Apply HOTM mining_speed boost
        const hotmSpeed = typeof getPerkMultiplier === 'function' ? getPerkMultiplier('mining_speed') : 0;
        const damage = this.miningPower * (1 + hotmSpeed) * deltaTime;
        const broke = damageStation(this.targetStation.id, damage);

        // Periodic rock hit juice feedback (frequency accelerates with station speed boost)
        this.chipCooldown -= deltaTime;
        if (this.chipCooldown <= 0) {
          this.chipCooldown = 0.35;
          triggerStationShake(this.targetStation.id);

          // Juice: rock impact particles & squash-and-stretch punch
          const rockCoords = getStationRockCoords(this.targetStation.id);
          const particleColor = getStationParticleColor(this.targetStation.id);
          createRockImpactParticles(rockCoords.x, rockCoords.y, particleColor);
          triggerOreNodePunch(this.targetStation.id);

          // HOTM 'efficient_miner': chance for a swing to spread 50% damage to an adjacent node
          const effChance = typeof getPerkMultiplier === 'function' ? getPerkMultiplier('efficient_miner') : 0;
          if (effChance > 0 && Math.random() < effChance) {
            const neighbors = STATIONS.filter(s => (s.unlocked || s.isUnlocked) && s.id !== this.targetStation.id);
            if (neighbors.length > 0) {
              const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
              const spreadDamage = damage * 0.5;
              const neighborBroke = damageStation(neighbor.id, spreadDamage);
              triggerStationShake(neighbor.id);
              const neighborCoords = getStationRockCoords(neighbor.id);
              createRockImpactParticles(neighborCoords.x, neighborCoords.y, '#c084fc');
              if (neighborBroke && this.carriedOres.length < capacity) {
                const neighborVal = getStationOreValue(neighbor);
                this.carriedOres.push({
                  oreId: neighbor.oreId,
                  value: neighborVal
                });
                onGameEvent('MINE_ORE', {
                  oreId: neighbor.oreId,
                  stationId: neighbor.id,
                  count: 1
                });
                createFloatingText(neighborCoords.x, neighborCoords.y - 20, 'CLEAVE! 💥', '#c084fc');
                this.updateBackpackUI();
              }
              updateStationHPUI(neighbor);
            }
          }
        }

        // Check if an excavation cycle completed
        if (broke) {
          const oreVal = getStationOreValue(this.targetStation);

          // HOTM 'mining_fortune': chance for double ore drops per swing
          const fortuneChance = typeof getPerkMultiplier === 'function' ? getPerkMultiplier('mining_fortune') : 0;
          let oreYield = 1;
          if (fortuneChance > 0 && Math.random() < fortuneChance) {
            oreYield = 2;
            const rockCoords = getStationRockCoords(this.targetStation.id);
            createFloatingText(rockCoords.x, rockCoords.y - 24, 'DOUBLE DROP! 💎', '#e879f9');
          }

          // Strict Backpack Capacity: Only collect up to capacity!
          const spaceLeftInPack = Math.max(0, capacity - this.carriedOres.length);
          const actualYield = Math.min(spaceLeftInPack, oreYield);

          // Add chipped ore(s) to carried inventory
          for (let i = 0; i < actualYield; i++) {
            this.carriedOres.push({
              oreId: this.targetStation.oreId,
              value: oreVal
            });
          }

          // Dispatch King's Bounty event for mining ore
          if (actualYield > 0) {
            onGameEvent('MINE_ORE', {
              oreId: this.targetStation.oreId,
              stationId: this.targetStation.id,
              count: actualYield
            });
          }

          // Extra burst of particles and punch feedback on node break
          const rockCoords = getStationRockCoords(this.targetStation.id);
          const particleColor = getStationParticleColor(this.targetStation.id);
          createRockImpactParticles(rockCoords.x, rockCoords.y, particleColor);
          triggerOreNodePunch(this.targetStation.id);

          // During 2X_POWDER_RUSH flash event, node breaks award Mithril Powder
          if (typeof isFlashEventActive === 'function' && isFlashEventActive('2X_POWDER_RUSH')) {
            const powderYield = 2;
            if (typeof gameState.addPowder === 'function') {
              gameState.addPowder(powderYield);
            } else {
              gameState.player.powder = (gameState.player.powder || 0) + powderYield;
            }
            createFloatingText(rockCoords.x + 16, rockCoords.y - 14, `+${powderYield} 🟣`, '#c084fc');
          }

          this.updateBackpackUI();

          // If backpack capacity reached, head to surface (factoring in HOTM deep_pockets)
          if (this.carriedOres.length >= capacity) {
            this.targetStation = null;
            this.assignedSlotIndex = null;
            const surfacePos = getSurfaceWaypoint();
            this.targetX = surfacePos.x;
            this.targetY = surfacePos.y;
            this.state = MinerState.MOVING_TO_SURFACE;
          }
        }

        updateStationHPUI(this.targetStation);
        break;
      }

      // 4. MOVING_TO_SURFACE: Paths back to the surface merchant cart
      case MinerState.MOVING_TO_SURFACE: {
        const dx = this.targetX - this.currentX;
        const dy = this.targetY - this.currentY;
        const dist = Math.hypot(dx, dy);

        if (dist <= 4) {
          this.currentX = this.targetX;
          this.currentY = this.targetY;
          this.state = MinerState.DEPOSITING;
          this.depositTimer = 0.25; // 0.25s turnaround for deposit
        } else {
          const step = Math.min(dist, this.getEffectiveMoveSpeed() * deltaTime);
          this.currentX += (dx / dist) * step;
          this.currentY += (dy / dist) * step;
          this.facing = dx >= 0 ? 1 : -1;
        }
        break;
      }

      // 5. DEPOSITING: Miner only deposits up to spaceLeft = maxStorage - currentStored, keeping remaining ores in backpack
      case MinerState.DEPOSITING: {
        this.depositTimer -= deltaTime;
        if (this.depositTimer <= 0) {
          const currentStored = getTotalStoredOres();
          const maxStorage = getMaxStorage();
          const spaceLeft = Math.max(0, maxStorage - currentStored);

          if (spaceLeft > 0 && this.carriedOres.length > 0) {
            // Deposit up to spaceLeft items
            const depositCount = Math.min(spaceLeft, this.carriedOres.length);
            const oresToDeposit = this.carriedOres.splice(0, depositCount);

            let totalCoinsEarned = 0;
            for (const item of oresToDeposit) {
              totalCoinsEarned += (item.value || 1);
              if (gameState.inventory[item.oreId] !== undefined) {
                gameState.inventory[item.oreId]++;
              } else {
                gameState.inventory[item.oreId] = 1;
              }
            }

            // Credit player wallet via gameState.addCoins
            if (totalCoinsEarned > 0) {
              if (typeof gameState.addCoins === 'function') {
                gameState.addCoins(totalCoinsEarned);
              } else {
                gameState.player.coins += totalCoinsEarned;
              }

              // Visual juice feedback: floating combat/economy text at the Surface Merchant Cart
              createFloatingText(this.currentX + 18, this.currentY - 14, `+${formatNumber(totalCoinsEarned)} 🪙`, '#f5a623');

              // Dispatch King's Bounty event for hauling carts to surface
              onGameEvent('HAUL_CARTS', { count: 1 });
            }
          }

          this.updateBackpackUI();

          // Loop back to IDLE
          // If cart is full or backpack still has ores, IDLE will hold miner at surface
          this.targetStation = null;
          this.assignedSlotIndex = null;
          this.state = MinerState.IDLE;
        }
        break;
      }

      default:
        this.state = MinerState.IDLE;
        break;
    }

    this.updateVisuals();
  }

  /**
   * Refreshes backpack badge display on the miner.
   */
  updateBackpackUI() {
    if (!this.badgeElement) {
      this.badgeElement = this.domElement ? this.domElement.querySelector('.worker-backpack-badge') : null;
    }
    if (!this.badgeElement) return;

    const capacity = this.getEffectiveBackpackCapacity();
    const count = this.carriedOres ? this.carriedOres.length : 0;
    if (count > 0) {
      this.badgeElement.style.display = 'block';
      this.badgeElement.textContent = `${count}/${capacity}`;
    } else {
      this.badgeElement.style.display = 'none';
      this.badgeElement.textContent = `0/${capacity}`;
    }
  }

  /**
   * Updates CSS position, classes, and flip transforms on the miner element.
   * Flips ONLY the .worker-visual icon so text and badges stay upright.
   */
  updateVisuals() {
    if (!this.domElement) return;

    this.domElement.style.left = `${Math.round(this.currentX)}px`;
    this.domElement.style.top = `${Math.round(this.currentY)}px`;

    // Flip ONLY the .worker-visual icon so text and badges stay upright
    const visual = this.visualElement || this.domElement.querySelector('.worker-visual');
    if (visual) {
      visual.style.transform = `scaleX(${this.facing})`;
    }

    // Toggle .mining-swing and .mining-fast-swing animation classes
    if (this.state === MinerState.MINING) {
      this.domElement.classList.add('mining-swing');
    } else {
      this.domElement.classList.remove('mining-swing', 'mining-fast-swing');
    }
  }
}

/** Active pool of MinerAgent instances */
export const activeMinerAgents = [];

/**
 * Adds an autonomous miner agent to the active pool.
 * @param {Object} [config]
 * @returns {MinerAgent}
 */
export function spawnMinerAgent(config = {}) {
  const agent = new MinerAgent(config);
  if (typeof document !== 'undefined') {
    const container = document.getElementById('workers-container');
    if (container) {
      agent.initDOM(container);
    }
  }
  activeMinerAgents.push(agent);
  return agent;
}

/**
 * Ticks all active MinerAgent instances across a frame.
 * @param {number} deltaTime
 */
export function updateAllMinerAgents(deltaTime) {
  for (const agent of activeMinerAgents) {
    agent.update(deltaTime);
  }
}

/**
 * Initializes the Tycoon Worker team in #workers-container.
 * Clamped by getMaxWorkers() so it never exceeds unlocked station capacity.
 * @param {number} [count=1] - Total worker count to spawn
 */
export function initTycoonWorkers(count = 1) {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('workers-container');
  if (!container) return;

  // Clear static placeholder markers from index.html
  container.innerHTML = '';
  activeMinerAgents.length = 0;

  const maxW = getMaxWorkers();
  const requested = typeof count === 'number' ? count : 1;
  const targetCount = Math.min(maxW, Math.max(1, requested));

  const avatars = ['👷‍♂️', '🧌', '🤖', '⚒️', '🧑‍🚀', '⛏️'];
  const names = ['Rookie Digger', 'Goblin Sifter', 'Steam Driller', 'Quarry Mason', 'Tunnel Runner', 'Core Specialist'];

  for (let i = 0; i < targetCount; i++) {
    spawnMinerAgent({
      id: `worker_${i + 1}`,
      name: names[i % names.length],
      avatar: avatars[i % avatars.length],
      miningPower: 10 + (i * 2),
      moveSpeed: 90,
      backpackCapacity: 4,
      startX: i === 0 ? 175 : SURFACE_WAYPOINT.x,
      startY: i === 0 ? 156 : SURFACE_WAYPOINT.y
    });
  }

  // Update status badge
  const statusCount = document.getElementById('mines-status-count');
  if (statusCount) {
    statusCount.textContent = `${STATIONS.length} Stations • ${activeMinerAgents.length} Workers`;
  }
}

/**
 * Updates a station's HP bar and numerical display.
 * @param {MiningStation} station
 */
export function updateStationHPUI(station) {
  if (typeof document === 'undefined' || !station) return;

  const fillEl = document.getElementById(`hp-fill-${station.id}`);
  const textEl = document.getElementById(`hp-text-${station.id}`);
  if (!fillEl) return;

  const maxHP = station.maxHP || 100;
  const currentHP = Math.max(0, station.currentHP ?? maxHP);
  const percent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  fillEl.style.width = `${percent.toFixed(1)}%`;

  if (textEl) {
    textEl.textContent = `${Math.ceil(currentHP)}/${maxHP} HP`;
  }
}

/** Cooldown tracker for station shakes to prevent screen-shake thrashing */
const lastShakeTimes = new Map();

/**
 * Retriggers the rock shake damage animation on a station.
 * Throttled to max once every 120ms per station.
 * @param {string} stationId
 */
export function triggerStationShake(stationId) {
  if (typeof document === 'undefined') return;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = lastShakeTimes.get(stationId) || 0;
  if (now - last < 120) return;
  lastShakeTimes.set(stationId, now);

  const rock = document.getElementById(`rock-${stationId}`);
  if (rock) {
    rock.classList.remove('chip-damage');
    void rock.offsetWidth;
    rock.classList.add('chip-damage');
  }
}

/**
 * Unlocks a station if player has sufficient funds.
 * Delegates to centralized unlockStation engine in stations.js.
 * @param {string} stationId
 * @returns {boolean} Success status
 */
export function unlockTycoonStation(stationId) {
  const result = unlockStation(stationId);
  return result.success;
}

/**
 * Levels up a station, boosting output and speed.
 * Delegates to centralized upgradeStation engine in stations.js.
 * @param {string} stationId
 * @returns {boolean}
 */
export function upgradeTycoonStation(stationId) {
  const result = upgradeStation(stationId);
  return result.success;
}


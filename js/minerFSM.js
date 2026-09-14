/**
 * @file minerFSM.js
 * @description Autonomous worker Finite State Machine (FSM) inspired by the
 * ChefAI / Delivery worker loops in "Cat Snack Bar".
 * Controls miner movement, station excavation, ore hauling, surface depositing,
 * and triggers Game Feel & Juice feedback particles.
 */

import { gameState } from './state.js';
import {
  STATIONS,
  damageStation,
  getStationOreValue,
  getStation,
  unlockStation,
  upgradeStation
} from './stations.js';
import {
  createFloatingText,
  createRockImpactParticles,
  triggerOreNodePunch,
  getStationRockCoords,
  getStationParticleColor
} from './juice.js';

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
 * Computes destination waypoint coordinates for a station,
 * querying live DOM positions if rendered, with reliable fallback.
 * @param {string} stationId
 * @returns {{ x: number, y: number }}
 */
export function getStationWaypoint(stationId) {
  const station = STATIONS.find(s => s.id === stationId);
  if (!station) return { x: 180, y: 156 };

  if (typeof document !== 'undefined') {
    const stage = document.getElementById('mine-stage');
    const spot = document.getElementById(`worker-spot-${stationId}`);
    if (stage && spot) {
      const stageRect = stage.getBoundingClientRect();
      const spotRect = spot.getBoundingClientRect();
      return {
        x: Math.round(spotRect.left - stageRect.left + (spotRect.width / 2) - 18),
        y: Math.round(spotRect.top - stageRect.top + (spotRect.height / 2) - 20)
      };
    }
  }

  return { x: station.workerSpotX, y: station.workerSpotY };
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
    this.avatar = config.avatar || '👷‍♂️';
    this.miningPower = config.miningPower || 25; // Damage per second
    this.moveSpeed = config.moveSpeed || 110;    // Pixels per second
    this.backpackCapacity = config.backpackCapacity || 5; // Max carried ores

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
    this.depositTimer = 0;
    this.chipCooldown = 0;

    // Visual DOM element
    /** @type {HTMLElement | null} */
    this.domElement = null;
    this.bubbleElement = null;
    this.badgeElement = null;
  }

  /**
   * Instantiates and attaches the visual 2D miner sprite into the DOM.
   * @param {HTMLElement} parentContainer
   */
  initDOM(parentContainer) {
    if (typeof document === 'undefined' || !parentContainer) return;

    const el = document.createElement('div');
    el.className = 'animated-miner';
    el.id = `agent-${this.id}`;
    el.innerHTML = `
      <div class="miner-bubble" style="display: none;">⛏️</div>
      <div class="miner-backpack-badge" style="display: none;">🪨 0/${this.backpackCapacity}</div>
      <div class="miner-sprite">${this.avatar}</div>
      <div class="miner-shadow"></div>
    `;

    this.domElement = el;
    this.bubbleElement = el.querySelector('.miner-bubble');
    this.badgeElement = el.querySelector('.miner-backpack-badge');

    parentContainer.appendChild(el);
    this.updateVisuals();
  }

  /**
   * Updates FSM behavior across a frame interval.
   * @param {number} deltaTime - Elapsed seconds since previous tick
   */
  update(deltaTime) {
    if (deltaTime <= 0) return;

    switch (this.state) {
      // 1. IDLE: Evaluates unlocked stations and determines excavation target
      case MinerState.IDLE: {
        const unlocked = STATIONS.filter(s => s.isUnlocked);
        if (unlocked.length === 0) return;

        // Choose station (prefers station with active need)
        const chosen = unlocked[Math.floor(Math.random() * unlocked.length)];
        this.targetStation = chosen;

        const waypoint = getStationWaypoint(chosen.id);
        this.targetX = waypoint.x;
        this.targetY = waypoint.y;
        this.state = MinerState.MOVING_TO_STATION;
        break;
      }

      // 2. MOVING_TO_STATION: Paths toward designated station digging spot
      case MinerState.MOVING_TO_STATION: {
        const dx = this.targetX - this.currentX;
        const dy = this.targetY - this.currentY;
        const dist = Math.hypot(dx, dy);

        if (dist <= 4) {
          this.currentX = this.targetX;
          this.currentY = this.targetY;
          this.state = MinerState.MINING;
        } else {
          const step = Math.min(dist, this.moveSpeed * deltaTime);
          this.currentX += (dx / dist) * step;
          this.currentY += (dy / dist) * step;
          this.facing = dx >= 0 ? 1 : -1;
        }
        break;
      }

      // 3. MINING: Digs into ore node durability until backpack reaches capacity
      case MinerState.MINING: {
        if (!this.targetStation) {
          this.state = MinerState.IDLE;
          break;
        }

        const damage = this.miningPower * deltaTime;
        const broke = damageStation(this.targetStation.id, damage);

        // Periodic rock hit juice feedback
        this.chipCooldown -= deltaTime;
        if (this.chipCooldown <= 0) {
          this.chipCooldown = 0.4;
          triggerStationShake(this.targetStation.id);

          // Juice: rock impact particles & squash-and-stretch punch
          const rockCoords = getStationRockCoords(this.targetStation.id);
          const particleColor = getStationParticleColor(this.targetStation.id);
          createRockImpactParticles(rockCoords.x, rockCoords.y, particleColor);
          triggerOreNodePunch(this.targetStation.id);
        }

        // Check if an excavation cycle completed
        if (broke) {
          const oreVal = getStationOreValue(this.targetStation);

          // Add chipped ore to carried inventory
          this.carriedOres.push({
            oreId: this.targetStation.oreId,
            value: oreVal
          });

          // Extra burst of particles and punch feedback on node break
          const rockCoords = getStationRockCoords(this.targetStation.id);
          const particleColor = getStationParticleColor(this.targetStation.id);
          createRockImpactParticles(rockCoords.x, rockCoords.y, particleColor);
          triggerOreNodePunch(this.targetStation.id);

          this.updateBackpackUI();

          // If backpack capacity reached, head to surface
          if (this.carriedOres.length >= this.backpackCapacity) {
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
          this.depositTimer = 0.5; // 0.5s pause to deposit
        } else {
          const step = Math.min(dist, this.moveSpeed * deltaTime);
          this.currentX += (dx / dist) * step;
          this.currentY += (dy / dist) * step;
          this.facing = dx >= 0 ? 1 : -1;
        }
        break;
      }

      // 5. DEPOSITING: Liquidates carried ores for coins and empties backpack
      case MinerState.DEPOSITING: {
        this.depositTimer -= deltaTime;
        if (this.depositTimer <= 0) {
          // Liquidate carried ores
          let totalCoinsEarned = 0;
          for (const item of this.carriedOres) {
            totalCoinsEarned += (item.value || 1);
            if (gameState.inventory[item.oreId] !== undefined) {
              gameState.inventory[item.oreId]++;
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
            createFloatingText(this.currentX + 18, this.currentY - 14, `+${totalCoinsEarned} 🪙`, '#f5a623');
          }

          // Empty backpack
          this.carriedOres = [];
          this.updateBackpackUI();

          // Loop back to IDLE
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
    if (!this.badgeElement) return;

    if (this.carriedOres.length > 0) {
      this.badgeElement.style.display = 'block';
      this.badgeElement.textContent = `🪨 ${this.carriedOres.length}/${this.backpackCapacity}`;
    } else {
      this.badgeElement.style.display = 'none';
    }
  }

  /**
   * Updates CSS position, classes, and flip transforms on the miner element.
   */
  updateVisuals() {
    if (!this.domElement) return;

    this.domElement.style.left = `${Math.round(this.currentX)}px`;
    this.domElement.style.top = `${Math.round(this.currentY)}px`;

    const sprite = this.domElement.querySelector('.miner-sprite');
    if (sprite) {
      sprite.style.transform = `scaleX(${this.facing})`;
    }

    // Toggle .mining-swing animation class
    if (this.state === MinerState.MINING) {
      this.domElement.classList.add('mining-swing');
      if (this.bubbleElement) this.bubbleElement.style.display = 'block';
    } else {
      this.domElement.classList.remove('mining-swing');
      if (this.bubbleElement) this.bubbleElement.style.display = 'none';
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
 * @param {number} [count=2] - Total worker count to spawn
 */
export function initTycoonWorkers(count = 2) {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('workers-container');
  if (!container) return;

  // Clear static placeholder markers from index.html
  container.innerHTML = '';
  activeMinerAgents.length = 0;

  const targetCount = Math.max(2, Number(count) || 2);

  // Spawn Worker 1: Veteran Digger
  spawnMinerAgent({
    id: 'worker_1',
    name: 'Rookie Digger',
    avatar: '👷‍♂️',
    miningPower: 30,
    moveSpeed: 110,
    backpackCapacity: 4,
    startX: 175,
    startY: 156
  });

  // Spawn Worker 2: Agile Hauler
  spawnMinerAgent({
    id: 'worker_2',
    name: 'Goblin Sifter',
    avatar: '🧌',
    miningPower: 22,
    moveSpeed: 135,
    backpackCapacity: 5,
    startX: SURFACE_WAYPOINT.x,
    startY: SURFACE_WAYPOINT.y
  });

  // Spawn any additional previously hired workers
  const avatars = ['🤖', '⚒️', '🧑‍🚀', '👷‍♂️', '🧌'];
  const names = ['Steam Driller', 'Quarry Mason', 'Tunnel Runner', 'Cyber Sifter', 'Core Specialist'];
  for (let i = 2; i < targetCount; i++) {
    spawnMinerAgent({
      id: `worker_${i + 1}`,
      name: names[(i - 2) % names.length],
      avatar: avatars[(i - 2) % avatars.length],
      miningPower: 25 + (i * 5),
      moveSpeed: 110 + (i * 5),
      backpackCapacity: 4 + (i % 3),
      startX: 75,
      startY: 45
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

/**
 * Retriggers the rock shake damage animation on a station.
 * @param {string} stationId
 */
export function triggerStationShake(stationId) {
  if (typeof document === 'undefined') return;

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


# Mining Simulator Web Tycoon

A web-based idle and tycoon mining game inspired by the progression loop of *Mining Simulator* and the autonomous worker dynamics of *Cat Snack Bar*[cite: 9]. Built with zero external dependencies using semantic HTML5, modern CSS3, and modular ES6 JavaScript.

---

## Current Implemented Features

### 1. 2D Cross-Section Quarry & Station Layout
* **Surface Merchant Cart:** Dedicated surface area housing the weigh station, coin vault, and deposit trigger[cite: 9].
* **Vertical Shaft & Ladders:** Physical transit paths connecting surface operations to underground mining veins[cite: 9].
* **Tiered Ore Stations:** Multi-tiered workstation nodes (Dirt & Coal, Copper, Gold) with integrated durability bars, level indicators, and assigned worker slots[cite: 9].
* **Responsive Mobile-First Shell:** Centered dark-themed interface (`#0e1015`) optimized for desktop and mobile viewports.

### 2. Autonomous Worker Finite State Machine (FSM)
* **Real-Time Entity State Tracking:** Independent miner units driven by a 5-state lifecycle:
  * `IDLE`: Scans and claims available, unlocked mining stations[cite: 9].
  * `MOVING_TO_STATION`: Navigates along platforms and climbs ladders toward target nodes[cite: 9].
  * `MINING`: Chips away at node durability using delta-time swing cycles[cite: 9].
  * `MOVING_TO_SURFACE`: Returns up the shaft when personal backpack capacity is reached[cite: 9].
  * `DEPOSITING`: Liquidates carried ores into player gold, triggers coin animations, and resets[cite: 9].
* **Tick-Based Engine Loop:** Decoupled `requestAnimationFrame` delta-time loop with frame-clamping to prevent browser lag spikes.

### 3. Economic Balancing & Station Upgrades
* **Geometric Cost Scaling:** Upgrade expenses scale dynamically using simulator progression curves:
  $$\text{Cost}(\text{level}) = \text{BaseCost} \times (1.15)^{\text{level}}$$
[cite: 9]
* **Node Enhancements:** Leveling up stations increases ore value multipliers and reduces node break intervals[cite: 9].
* **Workforce Expansion:** Ability to unlock new mining nodes and hire additional autonomous miners to scale throughput[cite: 9].

### 4. Dynamic Feedback & Visual Juice
* **Floating Text Engine:** Dynamic floating and fading indicators for currency payouts (`+X 🪙`) and critical actions[cite: 9].
* **Particle Impacts:** Procedural CSS particle bursts emitted upon tool impact[cite: 9].
* **Transform Animations:** Rock node recoil shakes on hit and bounce animations on currency updates[cite: 9].

### 5. Rebirth & Deep Shaft Expansion
* **Milestone Progression:** Unlocks elevator access to deeper geological mantles once workstation milestones are met[cite: 9].
* **Prestige Reset:** Clears soft coins and resets workstation levels in exchange for a permanent multiplicative boost[cite: 9]:
  $$\text{GlobalMultiplier} = 1.0 + (\text{RebirthCount} \times 1.5)$$
[cite: 9]

### 6. Persistence & Offline Calculations
* **Local Storage Integration:** Automatic state serialization to `localStorage` every 10 seconds and on window unload.
* **Offline Progress Simulator:** Calculates elapsed time upon return (up to 8 hours), simulates completed mining cycles, and deposits accumulated rewards.

---

## File Structure

```text
mining-sim-web/
├── index.html              # Core application DOM & stage container
├── css/
│   └── style.css           # Dark theme styling, animations & layouts
└── js/
    ├── main.js             # Game initialization & event orchestration
    ├── state.js            # Central reactive game state container
    ├── loop.js             # Delta-time requestAnimationFrame engine ticker
    ├── minerFSM.js         # Autonomous miner agent logic & state machine
    ├── stations.js         # Mining node definitions & upgrade calculations
    ├── rebirth.js          # Prestige multipliers & depth transitions
    ├── juice.js            # Particles & floating text visual feedback
    ├── storage.js          # LocalStorage persistence & offline progress
    └── data/
        ├── ores.js         # Ore definitions, rarities & values
        └── miners.js       # Recruitable miner stats & base powers
# AGENT GUIDELINES & GOVERNANCE SPECIFICATION
## Subterranean Extraction Terminal (Mining Sim Web)

> **Document Status**: `// ACTIVE GOVERNANCE // MANDATORY COMPLIANCE`  
> **Target Audience**: AI Coding Assistants, Pair-Programming Agents, and Automated Workflows  
> **Source of Truth for Design**: [`DESIGN.md`](file:///e:/miningsim-web/DESIGN.md)

---

## 1. Directive Overview & Core Mandate

This repository hosts a high-density, cyberpunk **"Industrial Telemetry & Automated Extraction Terminal"** web game built with Vanilla JavaScript (ES6 modules), HTML5, and CSS3.

All AI assistants and automated coding agents operating on this codebase must strictly observe the following operational guardrails. **No exceptions are granted without explicit, written user overrides.**

---

## 2. Rule 1: Visual Constraints & Aesthetic Guardrails

### 2.1 The Zero-Pill & Anti-Cartoon Rule
- **NEVER** use rounded pill buttons (`border-radius: 9999px` or `border-radius: 50px`).
- **NEVER** use soft pastel gradients, rounded fluffy cards (`border-radius: 16px+`), emoji-first cartoon badges, or playful bouncy animations.
- **NEVER** use generic light-mode backgrounds or warm cream tones.
- All containers and interactive elements must feature razor-sharp geometric corners: `border-radius: 0px` (or maximum `border-radius: 2px`).

### 2.2 Strict Adherence to `DESIGN.md`
- **Background**: Deep Obsidian `#060806` with subtle 24px $\times$ 24px coordinate grid lines (`rgba(0, 255, 102, 0.035)`).
- **Surface Panels**: `#0b0f0c` with 1px border `#16261a` (hover border: `#00ff6640`).
- **Accents**:
  - **Matrix Neon Green (`#00ff66`)**: Operational status, HP integrity, active progress, online indicators.
  - **Quant Gold (`#f59e0b`)**: Reserves, financial values, high-yield extractions, liquidation commands.
  - **Sub-Surface Cyan (`#06b6d4`)**: Mithril Powder (🟣), HOTM neural matrix firmware, cold diagnostics.
  - **Alert Crimson (`#ef4444`)**: System fault, buffer lockout, insufficient reserves.
  - **Warning Amber (`#f97316`)**: Near-capacity buffer alert, high-temperature load.

### 2.3 Typography & Terminal Prefixes
- **Font Stack**: Monospace strictly: `'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'SF Mono', monospace`.
- **Letter Spacing & Numeric Formatting**: Apply `font-feature-settings: "tnum" 1, "zero" 1;` to prevent layout jitter during numerical stream updates.
- **Terminal Prefixes & Uppercase Rule**:
  - All headings must use terminal syntax (e.g., `// TELEMETRY: SECTOR EXTRACTION`, `// BUFFER: SURFACE STORAGE LOGISTICS`, `// DIRECTIVES`).
  - Metric labels, table keys, and statuses must be uppercase (e.g., `YIELD_VAL`, `EST_CYCLE`, `ACTIVE_LVS`, `[ ONLINE ]`, `[ BUFFER FULL ]`).
  - Action buttons must be wrapped in command brackets (e.g., `[ OVERCLOCK // +1 LV ]`, `[ DISPATCH OPERATIVE ]`, `[ DISCHARGE SEISMIC BLAST ]`).

---

## 3. Rule 2: Code Architecture & Separation of Concerns

### 3.1 Non-Destructive UI Modifications
When refactoring HTML markup or CSS styling:
1. **Preserve DOM ID Contracts**: Existing IDs (e.g., `#station-1`, `#upgrade-btn-station-1`, `#player-coins`, `#workers-container`, `#bounties-bar`, `#btn-pickobulus`, `#elevator-descent-station`) are tightly coupled with event listeners and state synchronization loops. **Do NOT delete or rename IDs without updating all coupled JS modules.**
2. **Preserve Data Attributes**: Ensure `data-action`, `data-station`, `data-cost`, `data-mode`, and `data-perk-id` remain intact across template updates.
3. **Template Skeletons**: Update element structures within `index.html` and dynamic template strings in `js/ui.js` / `js/minerFSM.js` cleanly in sync.

### 3.2 Core Simulation Preservation
Do **NOT** alter the core mathematical and algorithmic foundations unless explicitly requested by the user:
- **Game Loop (`js/loop.js`)**: Delta-time accumulator and discrete update ticks.
- **Worker State Machine (`js/minerFSM.js`)**: FSM state transitions (`IDLE`, `MOVING_TO_STATION`, `MINING`, `MOVING_TO_SURFACE`, `DEPOSITING`), collision detection, waypoint routing, and capacity constraints.
- **Economic Math (`js/stations.js`, `js/data/ores.js`)**:
  - Cost ratio $r = 1.11$: `Math.floor(baseCost * Math.pow(1.11, currentLevel))`.
  - Compounding milestone multipliers (Lv 10: 2x, Lv 20: 2.5x + 20% speed, Lv 25: 4x -> 20x total boost).
  - Worker hire schedule: `[0, 60, 320, 1200, 4500, 8000, 14400, 25920, 46656]`.
- **Save State & Migration (`js/storage.js`)**: LocalStorage serialization, schema versioning, and soft-reset retention rules.

### 3.3 Zero Heavy External Dependencies
- Keep the codebase pure **Vanilla ES6 JavaScript**.
- Do not import React, Vue, Tailwind, Bootstrap, lodash, or heavy runtime bundlers. Keep all scripts natively executable in modern Evergreen browsers and testable in Node.js.

---

## 4. Rule 3: Testing & Verification Gate

Before concluding any user request or delivering code modifications, the agent **MUST** complete the following verification steps:

### 4.1 Automated Test Suite Execution
Run the full 13-suite automated test matrix located in `scratch/`:

```powershell
node -e "
const fs = require('fs');
const { execSync } = require('child_process');
const files = fs.readdirSync('./scratch').filter(f => f.startsWith('test_') && f.endsWith('.js'));
for (const file of files) {
  execSync('node ./scratch/' + file, { stdio: 'inherit' });
}
console.log('ALL TESTS PASSED!');
"
```

The 13 required test suites include:
1. `test_economy_pacing.js` (Pacing verification for 11–13 minute completion target)
2. `test_station_milestones.js` (Compounding multipliers, speed boosts, cost curves)
3. `test_multi_buy.js` (Geometric series multi-buy & MAX buy calculations)
4. `test_expandable_slots.js` (1–9 station worker slots & non-crowding logic)
5. `test_capacity_and_workers.js` (Worker visual templates & cart vault scaling)
6. `test_abilities.js` (Pickobulus seismic resonator activation & cooldowns)
7. `test_rebirth_biomes.js` (World-shift descent & global permanent multipliers)
8. `test_events.js` (Flash events: 2X Powder Rush & Goblin Thief runner)
9. `test_hotm.js` (Heart of the Mountain 6-perk matrix & powder deductions)
10. `test_commissions.js` (King's Bounties procedural generation & claiming)
11. `test_format_integration.js` (Numerical formatting, suffixes, string parsing)
12. `test_juice_and_stations.js` (Station durability regeneration & hiring costs)
13. `test_juice_dom.js` (DOM particle lifecycle & floating text cleanup)

### 4.2 Visual & Structural Verification
1. **Zero Browser Console Errors**: Verify all ES module imports, DOM queries, and listener attachments compile and execute without exceptions.
2. **Tabular Formatting & Zero Layout Shifts**: Validate that numbers formatted via `formatNumber()` in `js/utils/format.js` do not cause layout jumping or container expansion.
3. **Waypoint Alignment**: Ensure worker destination coordinates in `getStationWaypoint()` and `getSurfaceWaypoint()` align precisely with station platforms and surface cart hitboxes on the mine stage.

---

## 5. File & Module Reference Index

| File Path | Functional Responsibility |
| :--- | :--- |
| [`DESIGN.md`](file:///e:/miningsim-web/DESIGN.md) | Authoritative UI/UX Design System Specification |
| [`AGENT.md`](file:///e:/miningsim-web/AGENT.md) | AI Agent Rules, Governance & Verification Protocols |
| [`index.html`](file:///e:/miningsim-web/index.html) | Root application DOM structure & terminal layout shell |
| [`css/style.css`](file:///e:/miningsim-web/css/style.css) | Complete cyberpunk telemetry stylesheet & animation engine |
| [`js/main.js`](file:///e:/miningsim-web/js/main.js) | Main application entry point, lifecycle bootstrap & DOM wiring |
| [`js/state.js`](file:///e:/miningsim-web/js/state.js) | Central reactive state container (`gameState`) & vault storage |
| [`js/stations.js`](file:///e:/miningsim-web/js/stations.js) | Extraction sectors, upgrade formulas, multi-buy math & milestones |
| [`js/minerFSM.js`](file:///e:/miningsim-web/js/minerFSM.js) | Autonomous worker FSM, waypoint movement, and non-crowding bays |
| [`js/economy.js`](file:///e:/miningsim-web/js/economy.js) | Ore pricing, transactions, cart liquidation & conversions |
| [`js/commissions.js`](file:///e:/miningsim-web/js/commissions.js) | Procedural directives (King's Bounties) & Mithril powder rewards |
| [`js/abilities.js`](file:///e:/miningsim-web/js/abilities.js) | Active abilities (Pickobulus / Seismic Resonator) & cooldowns |
| [`js/rebirth.js`](file:///e:/miningsim-web/js/rebirth.js) | Biome cycling, borehole descent elevator & global multipliers |
| [`js/hotm.js`](file:///e:/miningsim-web/js/hotm.js) | Sub-surface neural matrix (Heart of the Mountain) skill tree |
| [`js/events.js`](file:///e:/miningsim-web/js/events.js) | Dynamic live-ops flash events & interactive runners |
| [`js/juice.js`](file:///e:/miningsim-web/js/juice.js) | High-velocity particle bursts, floating text & screen shake |
| [`js/storage.js`](file:///e:/miningsim-web/js/storage.js) | LocalStorage serialization, schema migrations & save resetting |
| [`js/ui.js`](file:///e:/miningsim-web/js/ui.js) | DOM rendering, sheet modals, HUD sync & buy mode toggles |
| [`js/utils/format.js`](file:///e:/miningsim-web/js/utils/format.js) | Monospace tabular numerical formatter (`1.23M`, `450.0K`) |

---
`// END OF GOVERNANCE SPECIFICATION // ALL FUTURE WORKFLOWS BOUND BY THIS PROTOCOL`


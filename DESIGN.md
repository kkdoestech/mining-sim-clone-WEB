# INDUSTRIAL TELEMETRY & AUTOMATED EXTRACTION TERMINAL
## Front-End Design System & Aesthetic Specification (v3.0)

> **Document Classification**: `// SYSTEM ARCHITECTURE // UX-UI SPECIFICATION`  
> **Target Architecture**: Mining Simulator Tycoon Web Front-End Overhaul  
> **Inspiration**: Financial & Quantitative Terminals (e.g., LIÊNG SCOPE, Bloomberg Terminal), Industrial SCADA systems, Hard Sci-Fi Sub-Surface Telemetry.

---

## 1. Architectural Philosophy & Vision

The objective of this design system is to completely replace the casual, cartoonish mobile-card paradigm with a **high-density, brutalist, cyberpunk industrial operations console**. 

Rather than presenting the user with cartoon rocks and smiling workers, the application is presented as an **Automated Subterranean Extraction & Sovereign Processing Terminal** operated by a deep-bore quarry engineer. Every UI element is treated as live telemetry, data streaming, or hardware actuation commands.

### Core Tenets:
1. **High Information Density**: No oversized fluffy cards, giant rounded bubbly corners, or cartoon avatars. Data is clean, monospace, tabular, and packed with operational value.
2. **Terminal-First Monospace Syntax**: All headers, labels, values, and interactive buttons adopt terminal syntax (`// DIRECTIVE`, `[ COMMAND ]`, `0x2F`, `STATUS: ONLINE`).
3. **Cyberpunk Industrial Palette**: Deep obsidian backgrounds with subtle CRT phosphor matrices, neon green telemetry pulses, quant gold financial data, and cyan sub-surface indicators.
4. **Actuation vs Clicking**: Buttons are not "tapped"; commands are "dispatched" and "actuated". Every interaction feels mechanical, sensory, and quantitative.

---

## 2. Design Tokens & Color Palette

### 2.1 Color Spectrum
The palette is engineered around dark-room terminal ergonomics with low ambient eye strain and pinpoint high-contrast alerts.

```
[ Deep Obsidian ]      #060806   Base terminal background & void
[ Terminal Surface ]   #0b0f0c   Primary container & operational modules
[ Sub-Surface Panel ]  #111712   Card layers, telemetry docks, modals
[ Matrix Grid Line ]   rgba(0, 255, 102, 0.03)  24px x 24px operational grid
[ Border Idle ]        #16261a   Standard structural panel seam
[ Border Active ]      #00ff6640 Hover & targeted sector boundary
[ Neon Green (Pri) ]   #00ff66   Active telemetry, system online, health
[ Terminal Gold ]      #f59e0b   Coin reserves, high-tier yield, transactional commands
[ Sub-Surface Cyan ]   #06b6d4   Mithril Powder, HOTM neural matrix, depth sensors
[ Alert Crimson ]      #ef4444   Critical fault, full buffer lockout, insufficient funds
[ Warning Amber ]      #f97316   High-load warnings, near-capacity alerts
[ Text Primary ]       #e6f4ea   High-luminance terminal text
[ Text Secondary ]     #6b7280   Metadata, labels, static identifiers
[ Text Muted ]         #374151   Disabled states, background counters, grid rules
```

### 2.2 CSS Variable Definitions (`tokens.css`)

```css
:root {
  /* --- BASE PALETTE & BACKGROUND --- */
  --term-bg-void: #060806;
  --term-surface-0: #0b0f0c;
  --term-surface-1: #111712;
  --term-surface-2: #162018;
  --term-grid-line: rgba(0, 255, 102, 0.035);

  /* --- BORDERS & SEAMS --- */
  --term-border-dim: #16261a;
  --term-border-mid: #223c28;
  --term-border-hover: rgba(0, 255, 102, 0.45);
  --term-border-active: #00ff66;

  /* --- ACCENT CODES --- */
  --term-neon-green: #00ff66;
  --term-neon-green-glow: 0 0 12px rgba(0, 255, 102, 0.28);
  --term-neon-green-dim: rgba(0, 255, 102, 0.12);
  
  --term-gold: #f59e0b;
  --term-gold-glow: 0 0 12px rgba(245, 158, 11, 0.28);
  --term-gold-dim: rgba(245, 158, 11, 0.12);

  --term-cyan: #06b6d4;
  --term-cyan-glow: 0 0 12px rgba(6, 182, 212, 0.28);
  --term-cyan-dim: rgba(6, 182, 212, 0.12);

  --term-crimson: #ef4444;
  --term-crimson-glow: 0 0 10px rgba(239, 68, 68, 0.35);

  --term-amber: #f97316;

  /* --- TEXT HIERARCHY --- */
  --term-text-bright: #e6f4ea;
  --term-text-body: #a3b899;
  --term-text-secondary: #6b7280;
  --term-text-muted: #374151;

  /* --- TYPOGRAPHY --- */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'SF Mono', monospace;

  /* --- GEOMETRY & CORNERS --- */
  --radius-none: 0px;
  --radius-sharp: 2px;

  /* --- SCANLINE & AMBIENT TEXTURE --- */
  --term-scanlines: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
}
```

---

## 3. Typography & Structural Monospace Conventions

### 3.1 Font Stack
All UI text utilizes strict monospace typography to ensure zero-jitter tabular alignments during high-frequency currency and durability updates.

```css
font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'SF Mono', monospace;
font-feature-settings: "tnum" 1, "zero" 1; /* Tabular numbers, slashed zero */
letter-spacing: -0.02em;
```

### 3.2 Terminal Structural Prefixes
Headers and group sections ditch natural-language titles in favor of machine telemetry prefixes:

| Traditional Title | Monospace Telemetry Heading | Description |
| :--- | :--- | :--- |
| Quarry & Extraction | `// TELEMETRY: SECTOR EXTRACTION` | Main mining view |
| King's Bounties | `// DIRECTIVES: HIGH-PRIORITY QUOTAS` | Commissions system |
| Storage & Cart | `// BUFFER: SURFACE STORAGE LOGISTICS` | Ore cart vault telemetry |
| Heart of the Mountain | `// FIRMWARE: SUB-SURFACE MATRIX (HOTM)` | Talent & perk tree |
| World Rebirth | `// PROTOCOL: BOREHOLE DEPRESSURIZATION` | Biome reset & descent |
| Station 1: Dirt & Coal | `// SECTOR_01 // CARBON_SURFACE` | Shallow quarry node |
| Station 2: Copper | `// SECTOR_02 // CUPRIC_VEIN` | Mid-strata node |
| Station 3: Gold | `// SECTOR_03 // AURIC_CORE` | Deep core node |
| Pickobulus Blast | `// ACTUATION: SEISMIC RESONATOR` | Active ability widget |

---

## 4. Component Architecture & Specifications

### 4.1 Status Badges & Telemetry Tags
All tags discard pill curves (`border-radius: 9999px`) in favor of sharp, solid-border tactical tags.

#### Syntax & Format
- `[ ONLINE ]`
- `[ BUFFER FULL ]`
- `[ TIER 01 ]`
- `[ SPEED: +20% ]`
- `[ 20x BOOST ]`
- `[ MK-III UNIT ]`

#### CSS Specification
```css
.telemetry-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--term-surface-1);
  border: 1px solid var(--term-border-dim);
  color: var(--term-text-body);
  border-radius: var(--radius-sharp);
}

.telemetry-tag.tag-success {
  border-color: var(--term-neon-green);
  color: var(--term-neon-green);
  background: var(--term-neon-green-dim);
  box-shadow: 0 0 6px rgba(0, 255, 102, 0.15);
}

.telemetry-tag.tag-gold {
  border-color: var(--term-gold);
  color: var(--term-gold);
  background: var(--term-gold-dim);
}

.telemetry-tag.tag-danger {
  border-color: var(--term-crimson);
  color: var(--term-crimson);
  background: rgba(239, 68, 68, 0.12);
}
```

---

### 4.2 Action Buttons / Actuation Commands
Commands are visually styled as physical or terminal commands surrounded by structural brackets.

#### Examples:
- `[ DISPATCH OPERATIVE // 60 🪙 ]`
- `[ OVERCLOCK // +10 LVS // 480 🪙 ]`
- `[ DISCHARGE SEISMIC BLAST ]`
- `[ LIQUIDATE RESERVES ]`
- `[ DEPRESSURIZE & DESCEND ]`

#### CSS Specification
```css
.btn-command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--term-surface-1);
  border: 1px solid var(--term-border-dim);
  color: var(--term-text-bright);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.12s ease;
  border-radius: var(--radius-sharp);
  position: relative;
}

.btn-command:hover:not(:disabled) {
  border-color: var(--term-neon-green);
  background: var(--term-neon-green-dim);
  color: #ffffff;
  box-shadow: var(--term-neon-green-glow);
}

.btn-command:active:not(:disabled) {
  transform: translateY(1px);
  background: rgba(0, 255, 102, 0.25);
}

.btn-command:disabled {
  border-color: var(--term-border-dim);
  background: var(--term-surface-0);
  color: var(--term-text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Primary High-Impact Command */
.btn-command.btn-primary {
  border-color: var(--term-neon-green);
  color: var(--term-neon-green);
}
```

---

### 4.3 Telemetry Progress Meters (Node Durability, Vault, XP)
Traditional rounded progress bars are replaced with ultra-slim, razor-sharp 4px high-contrast meters accompanied by real-time percentage figures (`60.0%`).

#### CSS Specification
```css
.telemetry-meter-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.telemetry-meter-header {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--term-text-secondary);
}

.telemetry-meter-value {
  color: var(--term-neon-green);
  font-weight: 700;
}

.telemetry-meter-track {
  width: 100%;
  height: 4px;
  background: rgba(22, 38, 26, 0.8);
  border: 1px solid var(--term-border-dim);
  border-radius: var(--radius-sharp);
  overflow: hidden;
  position: relative;
}

.telemetry-meter-fill {
  height: 100%;
  background: var(--term-neon-green);
  box-shadow: 0 0 8px rgba(0, 255, 102, 0.6);
  transition: width 0.15s linear;
}

/* Variant: Cyan for Mithril / HOTM */
.telemetry-meter-fill.meter-cyan {
  background: var(--term-cyan);
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.6);
}

/* Variant: Gold for Vault Capacity */
.telemetry-meter-fill.meter-gold {
  background: var(--term-gold);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}
```

---

### 4.4 Mining Nodes & Sector Modules (Replacing Casual Cards)

Instead of a playful floating card, each station is rendered as an **Industrial Extraction Bay** module with diagnostic rows.

#### Sector Data Grid Layout:
```
+-------------------------------------------------------------+
| // SECTOR_01 // DIRT_COAL                      [ OPERATIONAL ]|
+-------------------------------------------------------------+
| INTEGRITY: [||||||||||||||||||||||||] 15/15 HP       (100%) |
+-------------------------------------------------------------+
| YIELD/UNIT : 0004 🪙         CYCLE : ~1.50s                 |
| ACTIVE LVS : LV. 10         BOOST : 2.0x VALUE              |
| BAYS (SLOTS): [●] [●] [🔒]   MAX WORKERS : 2/2             |
+-------------------------------------------------------------+
| [ OVERCLOCK: +1 LV // 28 🪙 ]  [ MULTI: 10X // 418 🪙 ]     |
+-------------------------------------------------------------+
```

#### Monospace Slot Indicators (Worktops):
- Unlocked & Empty: `[ ◯ BAY_01 ]` (dashed matrix border)
- Occupied & Excavating: `[ ◉ OP_01 // 10 DPS ]` (neon green pulsing glow)
- Locked Milestone: `[ 🔒 LV_25 REQUIRED ]` (dim muted border)

---

### 4.5 Autonomous Workers as Tactical Operatives

Workers are no longer cartoon emojis floating on the screen. They are transformed into **Industrial Drone / Operative Vectors**:

#### Visual Model:
- **Identifier**: Tactical callsign `[MK-I]`, `[DRL-02]`, `[EX-03]`, `[HV-04]`.
- **Status Overlay**: Monospace badge indicating current state and buffer:
  - `EXCAVATING // SEC_01`
  - `TRANSIT -> SURFACE [3/4]`
  - `DEPOSITING // 0.25s`
- **Directional Flip**: The tactical drone silhouette flips horizontally while telemetry readouts remain strictly upright and readable.

#### Worker HUD Card Skeleton:
```html
<div class="worker-agent tactical-unit" id="worker-1">
  <div class="unit-reticle">
    <span class="unit-code">[DRL-01]</span>
    <span class="unit-status-dot"></span>
  </div>
  <div class="unit-payload-gauge">
    <span class="payload-text">PAYLOAD: 3/4</span>
    <div class="payload-micro-bar" style="width: 75%;"></div>
  </div>
</div>
```

---

## 5. Viewport Layout & High-Density UI Grid

The front-end retains a focused desktop/mobile-responsive shell centered in the viewport, surrounded by subtle CRT terminal scanlines and an obsidian grid.

```
+-------------------------------------------------------------------+
|  // LOGISTICS TERMINAL v3.0 // OPERATOR: MINER_GM   [ NET: SYNC ] |
|  COINS: 0048,290 🪙   |   POWDER: 001,420 🟣   |   GEMS: 00005 💎  |
+-------------------------------------------------------------------+
|  ⚡ [FLASH ALERT: 2X POWDER RUSH // 00:32 REMAINING]              |
+-------------------------------------------------------------------+
|  // ACTIVE DIRECTIVES                                             |
|  > EXTRACT 18 COPPER ORES               [||||||||||..] 14/18      |
|  > DEPOSIT 5 SURFACE CARTS              [||||||||||||] CLAIM 200🪙|
+-------------------------------------------------------------------+
|  // SUB-SURFACE EXTRACTION STAGE                                  |
|                                                                   |
|  [ SURFACE VAULT // BUFFER: 18/65 (27.6%) ]  [ LIQUIDATE ALL ]    |
|                                                                   |
|  --- LEVEL 01: SHALLOW ------------------------------------------ |
|  [SECTOR_01: DIRT]  Integrity: 15/15 HP  |  Bays: [●][○]          |
|                                                                   |
|  --- LEVEL 02: SUBTERRANEAN ------------------------------------- |
|  [SECTOR_02: COPPER] Integrity: 45/45 HP  |  Bays: [●][●]         |
|                                                                   |
|  --- LEVEL 03: DEEP CORE ---------------------------------------- |
|  [SECTOR_03: GOLD]  Integrity: 110/110 HP |  Bays: [●][○]         |
|                                                                   |
|  [ SEISMIC RESONATOR // READY ]      [ BUY MODE: [1X] [10X] [MAX] ]|
+-------------------------------------------------------------------+
|  [ // BOREHOLE DESCENT // TIER 1 -> TIER 2 // ELEVATOR READY ]    |
+-------------------------------------------------------------------+
|  NAV: [ // SECTORS ]  [ // BUFFER ]  [ // FIRMWARE ]  [ // CONFIG ]|
+-------------------------------------------------------------------+
```

---

## 6. Implementation Markup Skeletons

### 6.1 Terminal Header & Telemetry Bar
```html
<header class="terminal-header">
  <div class="terminal-meta-row">
    <div class="terminal-sys-info">
      <span class="sys-pulse-indicator"></span>
      <span class="sys-title">// LOGISTICS TERMINAL v3.0</span>
      <span class="telemetry-tag tag-success">[ OPERATIONAL ]</span>
    </div>
    <div class="terminal-operator">
      <span class="operator-callsign">OP: MINER_GM</span>
      <span class="telemetry-tag">[ TIER 1 ]</span>
    </div>
  </div>

  <!-- Real-Time Monospace Currency Telemetry Bar -->
  <div class="telemetry-currency-strip">
    <div class="telemetry-metric metric-gold">
      <span class="metric-label">RESERVES.COIN</span>
      <span class="metric-value" id="player-coins">0048,290</span>
    </div>
    <div class="telemetry-metric metric-cyan">
      <span class="metric-label">MITHRIL.POWDER</span>
      <span class="metric-value" id="player-powder">0001,420</span>
    </div>
    <div class="telemetry-metric metric-purple">
      <span class="metric-label">CORE.GEMS</span>
      <span class="metric-value" id="player-gems">00005</span>
    </div>
  </div>
</header>
```

### 6.2 Telemetry Sector Module (Station Card Replacement)
```html
<section class="telemetry-sector-module" id="station-1" data-station-id="dirt_coal">
  <!-- Module Terminal Header -->
  <div class="sector-header">
    <div class="sector-identity">
      <span class="sector-code">// SEC_01</span>
      <h3 class="sector-name">CARBON_EXTRACTION_BAY</h3>
    </div>
    <div class="sector-milestone-tag">
      <span class="telemetry-tag tag-success" id="milestone-station-1">[ LV.10 // 2X BOOST ]</span>
    </div>
  </div>

  <!-- Durability Telemetry Bar -->
  <div class="telemetry-meter-wrapper">
    <div class="telemetry-meter-header">
      <span>NODE_INTEGRITY</span>
      <span class="telemetry-meter-value" id="hp-text-station-1">15/15 HP</span>
    </div>
    <div class="telemetry-meter-track">
      <div class="telemetry-meter-fill" id="hp-fill-station-1" style="width: 100%;"></div>
    </div>
  </div>

  <!-- Sector Diagnostics Data Rows -->
  <div class="sector-diagnostics-grid">
    <div class="diagnostic-cell">
      <span class="diag-label">YIELD_VAL:</span>
      <span class="diag-val">0004 🪙</span>
    </div>
    <div class="diagnostic-cell">
      <span class="diag-label">EST_CYCLE:</span>
      <span class="diag-val">~1.50s</span>
    </div>
    <div class="diagnostic-cell">
      <span class="diag-label">ACTIVE_LVS:</span>
      <span class="diag-val" id="level-badge-station-1">LV. 10</span>
    </div>
    <div class="diagnostic-cell">
      <span class="diag-label">BAY_ALLOC:</span>
      <span class="diag-val">2/2 BAYS</span>
    </div>
  </div>

  <!-- Worktop Bays Telemetry Slots -->
  <div class="sector-bays-strip" id="dig-slots-station-1">
    <div class="bay-slot bay-occupied" id="dig-slot-station-1-0">
      <span class="bay-indicator">◉</span>
      <span class="bay-label">BAY_01</span>
    </div>
    <div class="bay-slot bay-empty" id="dig-slot-station-1-1">
      <span class="bay-indicator">◯</span>
      <span class="bay-label">BAY_02</span>
    </div>
    <div class="bay-slot bay-locked" id="dig-slot-station-1-2">
      <span class="bay-indicator">🔒</span>
      <span class="bay-label">REQ_LV25</span>
    </div>
  </div>

  <!-- Monospace Command Actuation -->
  <div class="sector-actuation-row">
    <button type="button" class="btn-command btn-primary" id="upgrade-btn-station-1">
      <span class="cmd-label">[ OVERCLOCK // +1 LV ]</span>
      <span class="cmd-cost">🪙 28</span>
    </button>
  </div>
</section>
```

### 6.3 Seismic Resonator Actuation Widget (Pickobulus Replacement)
```html
<div class="telemetry-resonator-widget" id="pickobulus-widget">
  <div class="resonator-info">
    <div class="resonator-title-group">
      <span class="resonator-prefix">// HARVEST_DEVICE:</span>
      <span class="resonator-name">SEISMIC RESONATOR</span>
    </div>
    <span class="telemetry-tag tag-success" id="pickobulus-status-badge">[ READY ]</span>
  </div>
  <button type="button" class="btn-command btn-gold" id="btn-pickobulus">
    <span class="cmd-icon">⚡</span>
    <span class="cmd-text">[ DISCHARGE SEISMIC BLAST // CLEAR ALL BAYS ]</span>
  </button>
</div>
```

---

## 7. Migration Roadmap

To transition the existing codebase cleanly into this design specification, execute across 3 systematic phases:

1. **Phase 1: Token & Theme Foundations**
   - Inject CSS variables, reset typography to monospace, apply `#060806` obsidian background and 24px grid overlay in `css/style.css`.
2. **Phase 2: Component & Layout Overhaul**
   - Refactor `.station-platform` cards into `.telemetry-sector-module` diagnostics blocks.
   - Restyle `.currency-pill` into `.telemetry-metric` numerical readouts.
   - Refactor `#bounties-bar` into `// DIRECTIVES` terminal feed.
3. **Phase 3: Worker & Particle Retrofitting**
   - Replace emoji miner visuals with tactical callsign vectors and telemetry payload badges in `js/minerFSM.js`.
   - Re-skin particle emissions to high-velocity neon laser sparks and digital fragmentation bursts in `js/juice.js`.

---
`// END OF SPECIFICATION // ARCHITECTURE RATIFIED`


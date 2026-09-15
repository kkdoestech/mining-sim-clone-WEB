The video showcases [Cat Snack Bar: Cat Food Games](https://www.youtube.com/watch?v=8DAfOXzEYME) by TREEPLLA, a popular mobile idle restaurant tycoon game.

To recreate this game in Unity, you need to break down its design into **Core Gameplay Loops**, **Entity State Machines**, **Progression Systems**, **Data Structures**, and **Technical Unity Architecture**.

---

## 1. Core Gameplay Loop & Lifecycle

The moment-to-moment loop consists of autonomous AI agents interacting with stations and counters in a cozy isometric/2.5D environment:

```
[Customer Spawns] ──> [Waits in Queue / Counter] ──> [Places Order Bubble]
                                                            │
[Customer Leaves] <── [Eats & Drops Coins] <── [Receives Food] <── [Worker Prepares Food]

```

### Customer Lifecycle

1. **Spawn & Pathfinding**: Customers spawn off-screen at a rate determined by stage upgrades and walk toward an open counter slot or waiting queue [[00:01](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D8DAfOXzEYME%26t%3D1)].
2. **Order Placement**: Once reaching the counter, an order speech bubble appears over the customer’s head showing the desired dish icon.
3. **Patience / Wait State**: The customer waits until a worker acknowledges the order.
4. **Food Consumption**: When the worker delivers the dish, an eating animation plays (or instant pickup).
5. **Payment & Tipping**: The customer drops coins (and potential bonus tips) on the counter [[01:53](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D8DAfOXzEYME%26t%3D113)], triggers a cute sound effect ("Thank you!"), and paths back off-screen to despawn.

### Worker / Chef Cat AI

1. **Order Detection**: Scans the order queue for unassigned customer orders.
2. **Task Assignment**: Claims the order and moves to the corresponding workstation.
3. **Preparation / Cooking**: Stays at the workstation while a radial or linear progress timer fills.
4. **Delivery**: Picks up the completed dish (food sprite floats above or beside the cat) and delivers it to the customer's counter [[02:53](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D8DAfOXzEYME%26t%3D173)].
5. **Clean / Rest**: Returns to the idle staging area if no orders are pending.

---

## 2. Workstation & Kitchen Mechanics

Each restaurant stage contains multiple workstations that must be unlocked and upgraded.

| Mechanic | How It Works | Programming Logic |
| --- | --- | --- |
| **Bouncing Box Unlocking** | New stations and hired cats appear as bouncing cardboard boxes [[03:16](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D8DAfOXzEYME%26t%3D196)]. Tapping them triggers an unbox burst animation (squash & stretch + confetti). | Lock station `GameObject` until purchased; spawn interactive unbox prefab with an `OnMouseDown` / raycast trigger. |
| **Timed Production** | Each station has a base prep time (e.g., 2s for sandwiches, 5s for coffee). A UI circular fill ring (`Image.fillAmount`) reflects progress. | `timer += Time.deltaTime * currentSpeedMultiplier;` |
| **Milestone Upgrades** | Leveling up stations (Lv 10, 25, 50, 100) grants instant 2x/3x speed or price multipliers instead of incremental bumps. | Trigger `OnMilestoneReached(level)` when `level % 25 == 0` to recalculate base multipliers. |
| **Parallel Worktops** | Upgrades unlock duplicate worktops for the same dish (e.g., 2 sandwich stations), allowing multiple cats to cook simultaneously [[07:01](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D8DAfOXzEYME%26t%3D421)]. | Station manager maintains a list of available `WorktopSlot` transforms. |

---

## 3. Mathematical Models & Economy

Idle tycoons rely on exponential curves to ensure balanced pacing:

### Upgrade Cost Formula

$$\text{Cost} = \text{BaseCost} \times (\text{CostMultiplier})^{\text{Level}}$$

* Typical $\text{CostMultiplier}$ ranges from `1.07` to `1.15`.

### Station Revenue Formula

$$\text{DishPrice} = \text{BasePrice} \times \text{Level} \times \prod \text{MilestoneMultipliers} \times \text{GlobalGearBonus}$$

### Offline / AFK Earnings

When launching the game, calculate elapsed time using UTC timestamps to prevent system clock exploits:


$$\text{AFK Coins} = \min(\text{TimeAwaySeconds}, \text{MaxOfflineCap}) \times \text{AvgRevenuePerSecond} \times \text{OfflineEfficiencyRate}$$

* Include a modal on launch: **"Claim"** (1x) or **"Watch Ad / Double"** (2x).

---

## 4. Meta-Progression & Long-Term Features

Beyond the local restaurant level, the game includes persistent global progression:

```
┌─────────────────────────────────────────────────────────────┐
│                    GLOBAL PERSISTENCE                       │
├───────────────────┬─────────────────────┬───────────────────┤
│  Costumes & Gear  │  Merchandise Vault  │     Marketing     │
│  (Hats/Outfits)   │  (Permanent Perks)  │ (Active Boosters) │
│  +Speed / +Profit │   Tip Jar, Ad Multi │  Promote Dish     │
└───────────────────┴─────────────────────┴───────────────────┘

```

1. **Costumes / Equipment**:
* **Slots**: Hat, Outfit, Accessory/Tool.
* **Rarity tiers**: Common, Rare, Epic, Legendary, Ultimate.
* **Merge / Fusion System**: Combine identical gear items of the same tier to upgrade rarity and level.
* **Stats**: Global walking speed boost, faster cooking, increased customer tip chance, chance to instantly produce "Perfect Food" (e.g., 5x value).


2. **Merchandise / Vault Upgrades**:
* Upgrades bought using hard currency (Gems).
* Permanent modifiers: Tip Jar (higher tip probability), Coffee Maker (offline cap extension), Marketing Megaphone (boost ad multiplier duration).


3. **Stage Prestige (Restaurant Expansion)**:
* When all workstations reach max level, the progress bar at the top hits 100%.
* Clicking **"Move to Next Stage"** packs up the truck and transitions to the next theme (Sandwich Stand $\rightarrow$ Donut Cart $\rightarrow$ Food Truck $\rightarrow$ Cafeteria $\rightarrow$ Taco Shop).
* Soft currency (Coins) resets for the new restaurant, while Costumes, Gems, and Vault passives persist.


4. **Meownager / Guest Cat**:
* A high-tier helper cat invited for a fixed duration (e.g., 5 minutes). After its shift expires, tapping it lets the player watch a rewarded video ad to extend it.


5. **Marketing Promotion (Megaphone)**:
* Activates a 5-minute promotion skewing customer order probabilities heavily toward your highest-profit dish.



---

## 5. Recommended Unity Architecture

### A. Data-Driven Design with `ScriptableObject`

Separate your game data from runtime logic:

```csharp
[CreateAssetMenu(fileName = "FoodItem", menuName = "Snack/FoodItem")]
public class FoodItemSO : ScriptableObject
{
    public string foodName;
    public Sprite icon;
    public double baseCost;
    public double baseRevenue;
    public float basePrepTime;
    public float costMultiplier = 1.07f;
}

```

### B. Finite State Machine (FSM) for Cats

Implement an explicit state interface to keep AI actions modular and debuggable:

```csharp
public interface ICatState
{
    void Enter(CatWorker worker);
    void Update(CatWorker worker);
    void Exit(CatWorker worker);
}

public class IdleState : ICatState { /* Scans for orders */ }
public class MoveToStationState : ICatState { /* Navigates via NavMesh2D or waypoints */ }
public class CookingState : ICatState { /* Runs workstation timer */ }
public class DeliverFoodState : ICatState { /* Moves to customer counter */ }

```

### C. Performance & Object Pooling

* **Object Pool (`UnityEngine.Pool`)**: Never use `Instantiate` and `Destroy` at runtime for Customers, Coins, Order Speech Bubbles, and Floating Text (`+$100`). Pre-allocate pools during scene load.
* **Large Number Handling**: Currency values will quickly exceed standard 32-bit integers (`int`). Store financial values as `double` or use a custom big-number struct formatted into `1K`, `1M`, `1B`, `1T`, `1aa`, `1ab`.

---

## 6. Audio-Visual "Juice" & Polish Checklist

* **Squash and Stretch**: Use tweening libraries (e.g., DOTween / PrimeTween) to animate cats walking (bouncy steps), boxes wiggling, and UI buttons reacting on tap.
* **Parabolic Coin Fly Effect**: When cash is collected, spawn coin sprites that follow a bezier curve into the top HUD coin counter, accompanied by sequential pitch-shifting coin sounds.
* **Floating Numbers**: World-space damage/income popups that fade out and float upward.
* **Camera Setup**: Orthographic 2D camera with an isometric angle (typically 30°–45° tilt) or 2.5D flat-shaded 3D models with unlit/cel-shaded pastel textures.

---




In *Cat Snack Bar*, stages and biomes follow a strictly paced progression curve.

---

### 1. How Many Workers at the End of the Tier?

In the gameplay video [[00:01](https://www.youtube.com/watch?v=8DAfOXzEYME&t=1)]:

* **Stage 1 (Sandwich Booth, 00:00 – 03:36)**:
* The player finishes with **2 workers** (1 Head Chef + 1 Part-timer) and 2 Sandwich worktops.


* **Stage 2 (Donut Stand, 03:36 – 11:00)**:
* By the time the player finishes Donut Stand around the **10 to 11-minute mark** [[09:21](https://www.youtube.com/watch?v=8DAfOXzEYME&t=561)] to move to the Food Truck, they have **3 to 4 workers** (1 Head Chef + 2 to 3 Part-timers) servicing 3 to 4 worktops (2 Donut stations + 1 to 2 Coffee makers).


* **Full Area/Biome (All 7 Stages of "Our Town")**:
* If you mean the entire regional biome (from Sandwich Booth all the way to the Grand Restaurant), the final stage maxes out at **6 to 8 workers**.



---

## 2. The Worker Balancing Rule (The 1:1 Bottleneck Principle)

To prevent idle workers or clogged stations, the worker economy follows a strict ratio:

```
Total Active Workers = Total Active Worktops (or Worktops - 1)

```

1. **Why not more workers than stations?**
If you have 4 workers but only 2 sandwich tables, 2 cats will stand around idling. In an idle tycoon, visible idle workers make the player feel their purchase was wasted.
2. **Why not fewer workers?**
If you have 4 stations and only 2 workers, half the stations sit unoperated, causing customer queues to back up and creating a painful pacing bottleneck.
3. **The Unlock Rhythm**:
* **Stage Start**: 1 Chef Cat + 1 Worktop.
* **Early Milestone (Lv 10)**: Station unlocks a second worktop slot $\rightarrow$ Research upgrade immediately offers **+1 Part-timer Cat**.
* **Mid Milestone**: New dish unlocked (e.g., Coffee) $\rightarrow$ Next upgrade offers **+1 Part-timer Cat**.



---

## 3. How to Mathematically Balance for a 10–11 Minute Playtime

To design a stage that takes **600 to 660 seconds (~10.5 minutes)** of active play, structure the pacing around **upgrade velocity**.

### Step 1: Target the "Upgrade Velocity" Curve

Players need dopamine hits at decreasing frequencies:

* **Minutes 0–2 (Hook Phase)**: 1 upgrade tap every **2–4 seconds** (instant gratification).
* **Minutes 2–7 (Flow Phase)**: 1 upgrade tap every **8–15 seconds** (steady cooking and collecting loop).
* **Minutes 7–11 (Climax / Final Push)**: 1 upgrade tap every **20–35 seconds** (saving up for final level milestones and next-stage ticket).

**Total Actions in Stage**: $\approx 60 \text{ to } 75$ total level purchases + 6 to 8 Research Upgrades.


$$\text{Average Wait Time} \approx 8.5\text{s} \implies 75 \times 8.5\text{s} \approx 637.5\text{s} \approx 10.6\text{ minutes}$$

### Step 2: Exponential Cost and Revenue Formulas

Use standard idle game exponential growth curves:

$$\text{LevelCost}(L) = C_{\text{base}} \times (r_{\text{cost}})^L \quad \text{where } r_{\text{cost}} \approx 1.07 \text{ to } 1.09$$

$$\text{DishPrice}(L) = P_{\text{base}} \times L \times 2^{\lfloor L / 25 \rfloor}$$

* **Milestone Multipliers ($2\times$ at Lv 10, 25, 50)**: Level-based price increases are linear ($P_{\text{base}} \times L$), but hitting milestone levels (Lv 10, 25, 50) doubles ($2\times$) the price instantly. This prevents the exponential cost curve from making progress grind to a halt.

### Step 3: Kitchen Throughput vs. Customer Arrival

* **Customer Arrival Rate ($\lambda$)**: 1 customer every 3.0 seconds (upgraded to 1 every 1.8 seconds).
* **Prep Time per Dish ($T_{\text{prep}}$)**: 4.0 seconds (reduced by upgrades to ~2.0 seconds).
* **Walk & Delivery Time ($T_{\text{walk}}$)**: $\approx 1.5$ seconds round-trip.
* **Throughput per Worker**:

$$\text{Dishes/sec per Worker} = \frac{1}{T_{\text{prep}} + T_{\text{walk}}} = \frac{1}{2.0 + 1.5} \approx 0.28 \text{ dishes/sec}$$


* With **3 workers**, total kitchen throughput is $3 \times 0.28 \approx 0.85$ dishes/sec, cleanly matching an incoming customer rate of ~1 customer every 1.2 to 1.5 seconds.

---

## 4. Interactive Stage Pacing & Worker Simulator

Use this tool to simulate stage completion time, tweak worker count, and test whether your cost and revenue curves hit the 10–11 minute sweet spot.

-
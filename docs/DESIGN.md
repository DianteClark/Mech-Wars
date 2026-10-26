# Mech Wars — Core Design

> Living document. Numbers are placeholders until playtesting.

## The pitch

Giant mech duels where every part matters. You start with a bare-bones Frame and rebuild it during the fight. Your deck is your crew's output.

## Deck identity: three layers

Every deck is defined by three choices:

| Layer | Role | Notes |
|---|---|---|
| **Frame** | The body — your mech | Each Frame is unique (trait + signature part) |
| **Pilot** | How you fight | Constant passive bonus; can issue Orders |
| **Crew Doctrine** | How you build | Changes build time and part quality |

## The Frame (your mech)

- Enters battle with a **base build**: basic limbs and Core, **no weapons**.
- Slots: **Head, Torso, Left Arm, Right Arm, Legs, Back** (TBD — exact slot list open).
- **Outer limbs shield the Core.** Attacks must break through limbs before reaching the Core (unless a keyword says otherwise).
- **When a limb is destroyed, everything mounted on it is lost.** Where you mount your best gear is a real decision.
- Parts add to the mech's overall stats, so losing limbs weakens you even before the Core is hit.

### Basic attacks

- **Punch and Kick** are always available from turn 1, so you're never just waiting on the crew.
- Damage scales with the stats of the limb used.
- Parts can enhance basics (e.g. leg boosters → stronger kicks, reinforced fists → heavier punches).

### Uniqueness: Trait + Signature Part

Every Frame must be unique. Two layers make that possible:

- **Trait** — small, always-on quirk. Examples: +1 Workshop slot; starts with extra leg armor; bonus energy every few turns.
- **Signature Part** — the Frame's defining ability, but it must be **built** like any other part, mounts on a limb, and can be destroyed and rebuilt. Examples: a sensor head that reveals the opponent's hand or Workshop; a Frame-exclusive shoulder cannon.

## The Core (HP + energy)

- The Core is both your **HP** and your **energy source**.
- **Core at 0 = mech destroyed = game over.**
- Energy output drops as the Core takes damage (thresholds, not 1:1):

| Core HP | Energy / turn |
|---|---|
| 20–15 | 4 |
| 14–8 | 3 |
| 7–1 | 2 |

### Overdrive

- Push the Core for **+2 energy this turn at the cost of 3 Core HP** (placeholder numbers).
- Built-in comeback lever against snowballing: a losing player can gamble HP for tempo.

## Weapons & keywords

- **All weapons must be produced** in the Workshop. Weapons carry the abilities.
- Starter keyword list:
  - **Pierce** — some damage passes through a limb to the Core
  - **Snipe** — choose which part you hit, ignoring the normal order
  - **Guard** — redirect hits to a shield/drone instead of the part
  - **Shred** — bonus damage to limbs, weak against the Core

## The Workshop (building)

- Parts, weapons, and extras (drones, repair pods, energy cells) are **queued in the Workshop** and complete after a build time.
- **3 Workshop slots** by default (some Frames get more).
- Filling a slot costs **energy**.
- **Minimum build time: 2 turns.** Nothing is instant — this prevents burst-damage rushes.
- Your mech **keeps fighting** while the crew builds.
- The queue is **hidden** from the opponent (intel abilities can reveal it).

## Crew Doctrines

The crew is mostly **flavor/explanation** for where parts come from — not units on the board and not attack targets. Their influence shows up as doctrines and card text (e.g. "Rush Order").

| Doctrine | Build time | Part quality |
|---|---|---|
| **Rush Crew** | 2 turns | −1 stat |
| **Standard** | 3 turns | Normal |
| **Master Crafters** | 4 turns | Boosted |
| **Specialists** | Normal | One stat always reinforced (armor / firepower / mobility) |

### Swapping doctrine: Pilot Orders

- The Pilot can issue an **Order** to change doctrine mid-match.
- Costs **energy** and the **Pilot's passive bonus is lost that turn**.
- Designed to be a big decision, not a routine move.

## Progression model: fighting-game style

- Players **unlock Frames** (mechs). Each Frame is a complete strategy, so every one must feel unique and be viable.
- Everyone starts with the same **3–4 starter Frames**. Long-term goal is **30–50**, released in waves (launch target: starters + 6–8 unlockables).
- Currency is earned from play and spent on new Frames.

## Game modes (planned)

### Battle Tower (offline, first)

- Pick a Frame and climb a series of AI battles. How far can your mech go?
- Each win earns currency, scaling with depth.
- **Twists** (floor modifiers) change the rules for a stretch, e.g. no healing for the next 2–3 battles, limited Core energy output.
- Gives players time to learn each Frame and develop strategy, without needing online lobbies.
- **Every battle starts fresh**: no damage or parts carry over. The run is a streak of standalone fights.
- Difficulty climbs through stronger/rarer enemy Frames, smarter AI, and harsher twists, not stat-inflated enemies.
- **Two modes:**
  - **Ranked Tower:** one loss ends the run; results go on the global leaderboard.
  - **Casual Tower:** unlimited retries for learning a Frame; no leaderboard.
- **Global leaderboard** (overall + per Frame) needs a backend for accounts and storage (e.g. Supabase or Firebase). Ranked runs should be verified by replaying the run's seed + action log, since the game runs in the browser. Plan: local-only leaderboard in the prototype, online later.

### PvP (later)

- The long-term goal. Battle Tower builds the player base and skills first.
- Rewards should not be win-only: every match earns some currency, wins earn more.

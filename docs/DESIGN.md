# Mech Wars — Core Design

> Living document. The numbers here match prototype v0.1 (`src/engine/data.js` is the source of truth). They were tuned with AI-vs-AI simulation and still need human playtesting.

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
- Limbs: **Head (6 HP), Left Arm (7), Right Arm (7), Legs (8)**. Each limb holds one mounted part plus one plating.
- **Outer limbs shield the Core.** The Core can only be targeted once **2 limbs are destroyed** (Pierce is the exception).
- Losing limbs costs function: arms are your punches, legs are your kick and your second action each turn, and losing the head gives weapons −1.
- **When a limb is destroyed, everything mounted on it is lost.** Where you mount your best gear is a real decision.
- Parts add to the mech's overall stats, so losing limbs weakens you even before the Core is hit.

### Basic attacks

- **Punch (2) and Kick (3)** are always available from turn 1, so you're never just waiting on the crew.
- **Actions:** 2 per turn (1 if your legs are down). Each limb acts once per turn: punch, kick, or fire its mounted weapon.
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

- **Energy ramps up:** 2 on your first turn, 3 on your second, then full output.
- **Going first** is an edge, so the opening turn gets 1 action and no draw, and the second player gets +1 energy on their first turn.

### Overdrive

- Push the Core for **+2 energy this turn at the cost of 3 Core HP**, once per turn.
- Built-in comeback lever against snowballing: a losing player can gamble HP for tempo.

## Weapons & keywords

- **All weapons must be produced** in the Workshop. Weapons carry the abilities.
- Starter keyword list:
  - **Pierce N** — N damage goes straight to the Core, even while it's shielded
  - **Snipe** — ignores Guard drones
  - **Guard drones** — each drone blocks 3 damage from one hit, then pops (max 4)
  - **Shred** — +2 vs limbs, −2 vs the Core
  - **Armor** (from plating) — reduces each hit on that limb (minimum 1 damage)

## The Workshop (building)

- Parts, weapons, and extras (drones, repair pods, energy cells) are **queued in the Workshop** and complete after a build time.
- **3 Workshop slots** by default (some Frames get more).
- Filling a slot costs **energy**.
- **Minimum build time: 2 turns.** Nothing is instant — this prevents burst-damage rushes.
- Your mech **keeps fighting** while the crew builds.
- The queue is **hidden** from the opponent (intel abilities can reveal it).

## Crew Doctrines

The crew is mostly **flavor/explanation** for where parts come from — not units on the board and not attack targets. Their influence shows up as doctrines and card text (e.g. "Rush Order").

Each card has a base build time (2–4 turns). Doctrines modify it:

| Doctrine | Build time | Part quality |
|---|---|---|
| **Standard** | Base | Normal |
| **Rush Crew** | −1 turn (min 2) | −1 step (only if it actually got faster) |
| **Master Crafters** | +1 turn | +1 step |
| **Specialists: Firepower** | Base | Weapons and strike boosts +1 step |
| **Specialists: Armor** | Base | Plating, repairs and drones +1 step |

A "step" is +1 damage, or +2 HP for plating and repairs.

### Swapping doctrine: Pilot Orders

- The Pilot can issue an **Order** to change doctrine mid-match.
- Costs **2 energy** and the **Pilot's passive bonus is lost that turn**. Builds already queued keep their plan.
- Designed to be a big decision, not a routine move.

## Starter roster (v0.1)

| Frame | Role | Trait | Signature part |
|---|---|---|---|
| **Brakka** | Brawler | Punches deal +1 | Wrecking Fists: punch +3 and Shred |
| **Longshot** | Gunner | Weapons build 1 turn faster and deal +1 | Rail Lance: 7 damage, Pierce 2, 1 energy to fire |
| **Bastion** | Tank | Limbs +1 HP | Aegis Dome: +1 Guard drone every turn |
| **Specter** | Trickster | Evasive: first hit each turn deals 1 less | Oracle Eye: see enemy hand and Workshop; all attacks Snipe |

Each Frame has a 20-card deck: 12 shared crew cards plus 8 of its own. Brakka, Longshot and Bastion are free; Specter unlocks for 200 scrap.

| Pilot | Style | Bonus |
|---|---|---|
| Vex "Redline" | Ace | Overdrive costs 1 less Core |
| Mara Okafor | Tactician | First card each turn costs 1 less |
| Old Gus | Mechanic | Finished builds repair their limb for 2 |
| Kai Tanaka | Duelist | First attack each turn deals +1 |

**Balance (v0.1):** over 600 AI-vs-AI games, each Frame wins 45–55% against the field. First player wins about 55%.

## AI

- Plans on **determinized** worlds: your hand, Workshop contents and deck order are re-sampled from what's possible. It never reads hidden info (unless it has an Oracle Eye mounted, same as you).
- Searches its whole turn (beam search) with a tuned evaluation, then tests top plans against sampled replies; the top tiers play each plan forward several turns (rollouts).
- Evaluation weights are tuned by self-play (`tools/tune.mjs`).
- Five skill tiers by floor: Rookie (1–2), Trained (3–4), Veteran (5–7), Ace (8–11), Relentless (12+). Bosses play one tier up. The top tier beats the lower tiers 65–80% of the time AI-vs-AI.

## Direction

- **Offline first.** Build and playtest the full offline game before any online work.
- **AI is the signature threat.** Higher Tower floors must punish mistakes: the climb becomes about game knowledge and skill, not luck. The AI must play fair (no peeking at hidden hands or Workshops); it reasons about what you *might* have.
- **Art: serious anime mecha, Block Dungeon-size stickers.** Clean vector art (SVG), real-robot proportions (V-fins, mono-eyes, armor panels), muted palettes per Frame. No pixel art.
  - Each mech is a **large dark silhouette** (rim tinted to the Frame) with **small die-cut part stickers** inside it: head, torso, each arm, legs. Stickers have a white die-cut and a thin dark rim.
  - **Items are small stickers too**, and the same sticker is the card in your hand and the attachment on your mech. Weapons, plating and upgrades stick onto the part sticker.
  - Hurt parts tilt and crack; destroyed parts peel off and leave a red dashed slot in the silhouette.
  - **Cards are stickers.** Tap to read; drag onto a glowing limb to build. A ghost of the item plus a countdown shows on that limb until it lands.
  - Display type: Oxanium; body type: Rubik. App icon: the Brakka V-fin head sticker (`tools/icons.mjs`).
- **Battle layout:** dark arena. Enemy top-right, you bottom-left, each on a lit platform. Part HP lives in a status rail beside each mech (Core first, then each limb), never on the art. Rails double as the attack and target controls.
- **UI polish is a priority**, not an afterthought. Mobile-friendly from day one.

## Progression model: fighting-game style

- Players **unlock Frames** (mechs). Each Frame is a complete strategy, so every one must feel unique and be viable.
- Everyone starts with the same **3–4 starter Frames**. Long-term goal is **30–50**, released in waves (launch target: starters + 6–8 unlockables).
- Currency is earned from play and spent on new Frames.

## Game modes (planned)

### Battle Tower (offline, first)

- Pick a Frame and climb a series of AI battles. How far can your mech go?
- Each win earns currency, scaling with depth.
- **Twists** (floor modifiers) land on every third floor from floor 3 and last two floors, announced a floor ahead: Brownout, No repairs, Parts shortage, Hot core, Armored foe, Ambush.
- **Boss floors** every 5th floor: enemy limbs +2 HP and the AI plays one tier up.
- **Scrap reward:** 10 + 4 × floor, doubled on bosses, halved in practice.
- Gives players time to learn each Frame and develop strategy, without needing online lobbies.
- **Every battle starts fresh**: no damage or parts carry over. The run is a streak of standalone fights.
- Difficulty climbs through stronger/rarer enemy Frames, smarter AI, and harsher twists, not stat-inflated enemies.
- **Two modes:**
  - **Ranked Tower:** one loss ends the run; results go on the global leaderboard.
  - **Practice Tower:** unlimited retries for learning a Frame; half scrap; no leaderboard.
- **Global leaderboard** (overall + per Frame) needs a backend for accounts and storage (e.g. Supabase or Firebase). Ranked runs should be verified by replaying the run's seed + action log, since the game runs in the browser. Plan: local-only leaderboard in the prototype, online later.

### PvP (later)

- The long-term goal. Battle Tower builds the player base and skills first.
- Rewards should not be win-only: every match earns some currency, wins earn more.

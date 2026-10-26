# Mech Wars — Design v2: the tactics board

> **Status: draft for review.** Nothing here is built yet. Numbers are starting points to tune with the simulator.
> v1 (alternating limb-punch battles) is archived in `docs/archive/DESIGN-v1.md`.

## The pitch

Giant-mech tactics on a destructible battlefield. You pilot one mech, build it mid-fight from a deck of parts, and out-position your opponent: lock them into a crossfire, shove them into a building, snipe their cannon arm off.

## What carries over from v1

- **Frame, Pilot, Crew doctrine**: the three layers of every deck.
- **The Core** is health and energy. A damaged Core makes less energy. Overdrive trades Core for energy.
- **Limbs**: head, left arm, right arm, legs. Two limbs down exposes the Core.
- **Cards are stickers.** Parts replace a limb's sticker; mods stick onto it.
- **Battle Tower** (ranked and practice), fair hidden-information AI, art style, settings.

---

## 1. The board

- **6 wide × 7 tall**, shared. Both mechs move anywhere.
- You start on the bottom row, the enemy on the top row.
- Each mech appears on the board as its **head sticker**. The full build lives on the **Build screen** (section 8).
- Every Tower floor has a generated map from a theme: **city, forest, canyon, river delta**. Maps are mirrored so neither side starts with better terrain.

## 2. Terrain

All terrain except rivers is destructible. These are giant mechs.

| Tile | HP | Movement | Line of sight | Destroyed becomes | Collision (pushed into it) |
|---|---|---|---|---|---|
| Open | — | 1 | Clear | — | — |
| **Forest** | 3 | Costs 2 | Clear, but **cover**: direct fire −2 damage | Open | No bonus damage, forest takes 2 |
| **Rubble** | 3 | Costs 2 | Clear | Open | +1 damage |
| **Building** | 6 | Blocked | **Blocks** | Rubble | **+3 damage**, building takes 3 |
| **Mountain** | 12 | Blocked | **Blocks** | Rubble | **+4 damage**, mountain takes 2 |
| **River** | — | Entering **ends your move** | Clear | — | **Stuck:** no Move next turn |

- Attacks that hit terrain damage it. Area attacks damage every terrain tile they cover.
- Hover parts can cross rivers freely; tread parts ignore rough terrain cost.

## 3. Your turn

You have **2 actions** (some Frames and parts change this). Each action is one of:

| Action | What it does |
|---|---|
| **Move** | Move up to your Mobility in tiles (base 2, orthogonal steps). Terrain costs apply. |
| **Attack** | Use one limb's attack. Each limb attacks at most once per turn. |
| **Prep** | **Brace** (the next hit on you is halved, until your next turn) or **Charge** (your next attack deals +50%). |
| **Workshop** | Open the Build screen and install as many cards as your energy allows. One action per visit. |

Free (no action): **Overdrive** once per turn, and your **Pilot Special** when its meter is full.

Actions can be in any order: move, attack, move is the classic hit-and-run.

**Action modifiers:** Specter has 3 actions. Legs destroyed: −1 action (minimum 1) and Mobility 1. Thruster Legs: Mobility 3.

## 4. Attacks

### Range types
- **Melee:** one of the 8 tiles around you. Often pushes.
- **Direct fire:** a straight line in one of 4 directions, up to its range. Stopped by buildings and mountains (it damages what it hits).
- **Artillery:** any tile within range, ignores line of sight. Usually an area.

### Quick vs heavy
- **Quick attacks** resolve immediately. Light to medium damage.
- **Heavy attacks** are **telegraphed**: they lock onto tiles, which glow on the board for both players, and fire at the **start of the attacker's next turn**. Anything standing there then takes the hit, including the attacker.

### Precise vs area
- **Precise** (a single tile): **big damage**, and the attacker **chooses which limb** it hits (or the Core, once exposed). For a heavy attack, the limb is chosen when the lock is placed.
- **Area** (row, column, plus shape, 2×2, 3×3): **less damage**, **split evenly across the target's intact limbs** (rounded up). Once the Core is exposed it takes a share too.

This is the core tension: a precise heavy lock is devastating but easy to dodge; an area lock is hard to escape but spreads thin.

### Damage scale (starting numbers)

| Attack | Damage |
|---|---|
| Base Jab (arm, melee) | 2 |
| Base Kick (legs, melee, push 1) | 2 |
| Base Vulcans (head, direct, range 3) | 1 |
| Quick weapon parts | 3–5 |
| Heavy precise | 8–10 |
| Heavy area | 4–6 total, split |

Weapons always beat base attacks. Base attacks keep you in the fight; parts win it.

## 5. Forced movement and control

- **Push X:** move the target X tiles straight away from the attacker.
  - Blocked by terrain: the target takes **+2 damage per tile it couldn't move**, plus that terrain's collision bonus, and the terrain takes damage.
  - Blocked by the other mech: both take +2 per blocked tile.
  - Pushed into a river: **Stuck** (no Move action next turn).
  - Collision damage is split like area damage.
- **Pull X:** drag the target X tiles toward the attacker. Same collision rules.
- **Lock:** the target can't take Move actions on its next turn.
- **Combo:** pushing or pulling a mech onto a telegraphed tile, or locking it there, is the main way to land heavy precise hits.

## 6. Mechs: limbs, parts and mods

| Limb | Base attack | Job | If destroyed |
|---|---|---|---|
| Head | Vulcans (1, direct 3) | Sensors | Direct fire range −2, lose Vulcans |
| Left / right arm | Jab (2, melee) | Weapon slots | Lose that attack |
| Legs | Kick (2, melee, push 1) | Movement | −1 action, Mobility 1 |

- Two limbs destroyed **exposes the Core**.
- **Parts** replace a limb entirely. The old sticker peels off and the new one slaps on. A part sets that limb's HP, armor and attack. Examples:
  - Arms: **Cannon Arm** (direct, quick 4, range 4), **Rail Arm** (direct, heavy precise 9, range 6), **Hammer Arm** (melee 4, push 2), **Harpoon Arm** (direct range 4, quick 2, pull 3), **Drill Arm** (melee 5, ignores brace), **Shield Arm** (no attack; brace is free once per turn), **Mortar Arm** (artillery, heavy area 5 in a plus, range 5).
  - Legs: **Thruster Legs** (Mobility 3), **Tread Legs** (ignore rough terrain, immune to push 1), **Hover Legs** (cross rivers), **Anchor Legs** (immune to push and pull, Mobility 1).
  - Heads: **Sensor Head** (+2 direct range, see enemy Workshop), **Command Head** (Pilot meter +50%), **Missile Crown** (artillery, quick area 3 in a 2×2, range 4).
- **Mods** stick onto a part: Plating (+HP, armor), Scope (+1 range), Spikes (+2 collision damage dealt), Coolant (heavy attacks cost 1 less energy), Booster (+1 Mobility).

## 7. Cards, energy and the crew

- Decks are **20 cards**: parts, mods and tactics. Each Frame has its own arsenal plus shared crew cards.
- Opening hand 5, draw 1 per turn, hand limit 8.
- **Energy** comes from the Core each turn (4 at 15+ Core, 3 at 8–14, 2 below). Energy ramps up over the first two turns.
- Cards cost energy to install. Firing heavy attacks may cost energy too.
- **Parts arrive on a countdown** (the crew builds them). The ghost sticker and countdown show on that limb, like now. **Mods and tactics are instant.**
- **Crew doctrine** changes part build times: Standard 1 turn, Rush 0 turns (instant, −1 quality), Master Crafters 2 turns (+1 quality), Specialists (one stat always reinforced).
- **Tactics** (instant cards): Repair, Rebuild limb, Guard drones, EMP net (lock), Smoke (cover on a tile), Rush order, Scavenge (draw), Demolition charge (damage terrain).

## 8. The Build screen

- Opened with the Workshop action. Shows your **full mech**: silhouette plus part stickers, the hand of card stickers, energy, and builds in progress.
- Drag stickers onto limbs to install, like now. Tap any sticker for details.
- **Back to the board** returns you to the battle with your remaining actions.
- You can also peek at the enemy's visible build (installed parts and mods only, never their hand or Workshop).

## 9. Pilots

Each pilot has a **passive** and a **Special**. The pilot's portrait sticker is always on the battle HUD; the passive glows when it triggers, and the Special meter fills as you deal damage, cause collisions and dodge telegraphed attacks.

| Pilot | Passive | Special (free, when meter is full) |
|---|---|---|
| Vex "Redline" | Overdrive costs 1 less Core | **Redline Rush:** move 3, then a quick attack with +3 damage |
| Mara Okafor | First card each turn costs 1 less | **Tactical Scan:** reveal the enemy hand and Workshop, +1 action this turn |
| Old Gus | Finished parts arrive with +2 HP | **Field Repair:** repair every limb for 4, or rebuild one destroyed limb |
| Kai Tanaka | First attack each turn +1 damage | **Iaido:** precise melee for 8 that ignores brace |

## 10. Frames (starter four)

| Frame | Actions | Mobility | Identity | Signature part |
|---|---|---|---|---|
| **Brakka** (Brawler) | 2 | 2 | Charge in, shove into walls | **Wrecking Hammer Arm:** melee 5, push 2, collisions +2 |
| **Longshot** (Gunner) | 2 | 2 | Hold sightlines, snipe parts off | **Rail Lance Arm:** direct heavy precise 10, range 6 |
| **Bastion** (Tank) | 2 | 1 | Hold ground, build cover | **Aegis Projector:** create a 6-HP wall on any open tile within 3 |
| **Specter** (Trickster) | 3 | 2 | Lock, pull and reposition | **Phase Drive Legs:** Move can teleport up to 3 tiles, ignoring terrain |

## 11. Winning

- Core to 0 destroys the mech.
- Turn limit (30 turns): higher Core wins, to stop stalemates.

## 12. The AI

- Plays fair: it plans on sampled versions of your hidden hand and Workshop, never the real ones.
- Searches its own turn (move, attack, prep combinations) and scores positions by damage, threats, cover, telegraphs, escape routes and collision setups.
- High floors predict where you'll run from a telegraph and lock your escape, and set up push-into-wall combos.
- Difficulty tiers by floor, as in v1: search depth, prediction, and mistake rate.

## 13. Battle Tower

- Fresh fight every floor on a new generated map.
- **Twists** become battlefield events too: Flooded (more rivers), Wildfire (forests burn each turn), Earthquake (random rubble), Fog (direct fire range −2), plus the v1 rule twists.
- Boss floors every 5th floor.
- Ranked (one loss ends the run) and Practice (retry, half scrap). Local leaderboard for now.

## 14. Screens

1. **Board:** the 6×7 map, head-sticker tokens, telegraph overlays, movement and attack previews, the action bar (Move, Attack, Prep, Workshop, End turn), the pilot portrait and Special meter, and compact limb-HP rails for both mechs.
2. **Build:** the full mech and your sticker hand (section 8).
3. Everything else stays: title, setup, versus intro, results, hangar, leaderboard, how to play, settings.

## 15. Build order

1. Review this doc (you are here).
2. New rules engine: board, terrain, movement, attacks, telegraphs, forced movement, parts and mods. Unit tests.
3. AI on the new engine, then balance the four Frames with the simulator.
4. Board and Build screen UI, terrain stickers, telegraph and push effects, new part and mod sticker art.
5. Tower maps and twists, then polish.

## Open questions

- [ ] Damage and HP numbers (to tune with the simulator).
- [ ] Should heavy attacks cost energy to fire, or only to install?
- [ ] Do parts wear out (limited uses), or last until destroyed?
- [ ] Can a mech move through the other mech? (Proposed: no.)
- [ ] Diagonal movement? (Proposed: no, orthogonal only, for readability.)
- [ ] Map themes beyond the first four.
- [ ] PvP later: alternating turns online (asynchronous play is possible).

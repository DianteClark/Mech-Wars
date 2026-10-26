# Mech Wars

A browser-based (HTML) trading card game where you don't summon an army — you **build one machine mid-battle**.

Each player brings a single **Frame** (their mech), a **Pilot** who shapes how it fights, and a **Crew** whose doctrine decides how parts get built. While your crew works in the Workshop, your mech is out there brawling — punching, kicking, and mounting new weapons as they come off the line. Break through the enemy's limbs, crack their Core, and the mech goes down.

## Status

🎮 **Prototype v0.5 is playable.** Four Frames, a fair-play AI with five skill tiers, Ranked and Practice Tower climbs, a local leaderboard, and scrap unlocks. Works offline once loaded, and installs to the iPhone Home Screen.

**New in v0.5:** mechs are loose part stickers inside a silhouette; cards are compact stickers you tap to read and drag onto a limb to build; build countdowns show right on the limb.

**v0.4:** redesigned battle arena: dark theme, diagonal layout with lit platforms, part status rails beside each mech (no numbers on the art), and Block Dungeon-style stickers with a dark rim.

**v0.3:** modular sticker mechs in a clean anime-mecha style. Every part is its own sticker, upgrades slap on, destroyed parts peel off. Sleeker type and finish, new app icon.

**v0.2:** clearer battle HUD (labeled Core, energy, actions, Workshop; Core shield status on each mech; damage previews), cel-shaded mech art, versus intro, turn banners, first-time tips, battle log, fight summaries, a card browser in the Hangar, and a Settings screen (callsign, tips, enemy speed, motion, and **Reset all data**).

## Play it

The game is plain HTML/JS with no build step, so GitHub Pages can host it directly:

1. In the repo on GitHub: **Settings → Pages**
2. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, then **Save**
3. After a minute it's live at `https://dianteclark.github.io/Mech-Wars/`
4. On iPhone, open that link in Safari → **Share → Add to Home Screen**

To run locally: `npm run serve`, then open http://localhost:8080.

## Developer tools

| Command | What it does |
|---|---|
| `node tools/test.mjs` | Engine tests (rules, replay determinism, AI fairness) |
| `node tools/sim.mjs [games] [level]` | AI-vs-AI matchup table for balance checks |
| `node tools/tune.mjs [iterations] [games]` | Self-play tuning of the AI's evaluation weights |

## Repo layout

| Path | What's there |
|---|---|
| `docs/DESIGN.md` | Core game design: rules, resources, card types, decisions so far |
| `docs/OPEN_QUESTIONS.md` | Things still being decided |
| `src/engine/` | Rules engine (`game.js`), card/frame data (`data.js`), AI (`ai.js`) |
| `src/ui/` | Screens, battle UI, sticker art (`art.js`), Tower logic, save data |
| `tools/` | Tests, balance simulator, AI tuner |
| `icons/`, `fonts/` | App icon and bundled fonts |

## Roadmap (rough)

1. ~~Finalize core rules~~
2. ~~Single-player prototype vs. AI~~ (v0.1)
3. Playtest and tune: balance, AI, UI feel
4. More Frames, pilot Orders, sound
5. Online leaderboard with replay-verified ranked runs
6. PvP (much later)

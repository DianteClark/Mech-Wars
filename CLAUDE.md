# Mech Wars — notes for Claude

Sticker-style mech TCG in plain HTML/JS (ES modules, no build step), hosted on GitHub Pages. Phone-first (iPhone Home Screen app).

- **Design source of truth:** `docs/DESIGN.md` (v2: tactics board, implemented in v0.7; open questions at the bottom). v1 is archived in `docs/archive/`.
- **Numbers live in `src/engine/data.js`.** Frame traits are data-driven via each Frame's `tune` object.
- **Engine (`src/engine/game.js`) must stay pure and deterministic:** all randomness through the seeded RNG in state. Matches are saved/replayed from `(setup, actions)`; ranked verification depends on this.
- **AI fairness:** the AI only plans on `determinize()`d states. Never let it read the human's hand, deck order or Workshop contents.
- After rule or card changes: run `node tools/test.mjs`, then check balance with the sweep/sim (`node tools/sim.mjs 12 2`). Target each Frame at 45–55% vs the field.
- **iPhone gotchas already handled** (keep them): safe-area insets, `100dvh`, fixed body (no rubber-band), `touch-action: manipulation`, no hover-only UI, inputs ≥16px, no long-press callouts, portrait lock hint, bundled fonts for offline.
- When changing cached files, bump `CACHE` in `sw.js`.
- Settings live in the save (`store.js` → `settings`); Settings → Reset all data wipes everything. Add new save fields to `DEFAULT` there.
- Battle readability rules: every number on screen gets a label; limb HP and Core status live in the mech bars (`mechBar()`/`limbChip()`), never on the art; coaching tips render in the midline (never over controls). Trays (weapon, aim, prep) overlay the bottom HUD in `.tray-layer` so the board never resizes.
- Theme is dark (`--bg`, `--panel*` tokens in styles.css). Grid columns holding mechs must use `minmax(0, …)` or the mech pushes rails off-screen. Never animate `transform` on rows (shifts the layout); pulse with box-shadow.
- Screenshot-check UI at 375×667 (SE) and 430×932 (Pro Max) before pushing.
- Mech art (`src/ui/art.js`): parts are drawn in local space in `HEADS/TORSOS/ARMS/LEGS` per Frame and placed by `LAYOUT` ([x, y, silhouette scale, sticker scale]); right arms mirror left. Items live in `ITEMS` and are used for hand cards and attachments alike. New Frames need all four part drawings, a `PAL` entry and a `LAYOUT` entry. Regenerate the icon with `node tools/icons.mjs`.
- Battle UI: the board (`boardHTML()`) is a 6×7 grid of `.tile` buttons with tokens on an overlay; animations use FLIP via `el.animate()` from engine events (`animate()`). Attack previews come from `simulate()` (applyAction on a clone), so they're exact. Undo replays `(setup, actions)` minus the last move/prep.
- Build screen: hand cards are draggable stickers (`[data-hand]`, pointer events in app.js). Drop detection is area-based over `#build-you .limb` and `.limb-row`; tap opens the card sheet, which keeps install buttons as a fallback. Never put a CSS animation on an SVG `<g>` that has a `transform` attribute (it overrides it); animate an inner `<g>`.
- Sound is synthesized in `src/ui/sfx.js` (Settings → Sound).
- Copy style: sentence case, plain verbs, no all-caps labels.

# Mech Wars — notes for Claude

Sticker-style mech TCG in plain HTML/JS (ES modules, no build step), hosted on GitHub Pages. Phone-first (iPhone Home Screen app).

- **Design source of truth:** `docs/DESIGN.md`; open items in `docs/OPEN_QUESTIONS.md`. Keep both current when rules change.
- **Numbers live in `src/engine/data.js`.** Frame traits are data-driven via each Frame's `tune` object.
- **Engine (`src/engine/game.js`) must stay pure and deterministic:** all randomness through the seeded RNG in state. Matches are saved/replayed from `(setup, actions)`; ranked verification depends on this.
- **AI fairness:** the AI only plans on `determinize()`d states. Never let it read the human's hand, deck order or Workshop contents.
- After rule or card changes: run `node tools/test.mjs`, then check balance with the sweep/sim (`node tools/sim.mjs 12 2`). Target each Frame at 45–55% vs the field.
- **iPhone gotchas already handled** (keep them): safe-area insets, `100dvh`, fixed body (no rubber-band), `touch-action: manipulation`, no hover-only UI, inputs ≥16px, no long-press callouts, portrait lock hint, bundled fonts for offline.
- When changing cached files, bump `CACHE` in `sw.js`.
- Settings live in the save (`store.js` → `settings`); Settings → Reset all data wipes everything. Add new save fields to `DEFAULT` there.
- Battle readability rules: every number on screen gets a label, the Core tag on each mech shows shield status, and coaching tips render in the midline (never over controls).
- Screenshot-check UI at 375×667 (SE) and 430×932 (Pro Max) before pushing.
- Mech art (`src/ui/art.js`): each part is its own sticker via `sticker()`; upgrades come from `mountShapes()` and are positioned at `BODIES[frame].mounts`. Right arms are auto-mirrored from left arms. New Frames need a body plan with pivot and mount points.
- Copy style: sentence case, plain verbs, no all-caps labels.

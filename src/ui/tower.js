// Battle Tower: floor generation, map themes, twists, rewards.
import { FRAME_ORDER, PILOT_ORDER, DOCTRINE_ORDER, TWIST_ORDER, THEME_ORDER } from '../engine/data.js';
import { createGame, makeMap } from '../engine/game.js';
import { levelForFloor, LEVELS } from '../engine/ai.js';

export const RUN_VERSION = 2;

function hash(a, b) {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export const isBoss = (floor) => floor % 5 === 0;

// A twist lands on every third floor from 3 on and lasts two floors. Known one floor ahead.
export function twistFor(run, floor) {
  if (floor < 3) return null;
  const start = floor % 3 === 0 ? floor : floor % 3 === 1 ? floor - 1 : null;
  if (start === null || start < 3) return null;
  return TWIST_ORDER[hash(run.seed, start) % TWIST_ORDER.length];
}

// Floors 1-4 walk through each map theme once, then it's random.
export function themeFor(run, floor) {
  if (floor <= THEME_ORDER.length) return THEME_ORDER[(floor - 1 + (run.seed % THEME_ORDER.length)) % THEME_ORDER.length];
  return THEME_ORDER[hash(run.seed, floor * 13) % THEME_ORDER.length];
}

export function enemyFor(run, floor) {
  const h = hash(run.seed, floor * 977);
  // Don't open the climb with a mirror match.
  let frame = FRAME_ORDER[h % FRAME_ORDER.length];
  if (floor === 1 && frame === run.frame) frame = FRAME_ORDER[(h + 1) % FRAME_ORDER.length];
  return {
    frame,
    pilot: PILOT_ORDER[(h >>> 8) % PILOT_ORDER.length],
    doctrine: floor < 4 ? 'standard' : DOCTRINE_ORDER[(h >>> 16) % DOCTRINE_ORDER.length],
  };
}

export function aiLevel(floor) {
  if (!isBoss(floor)) return levelForFloor(floor);
  const i = Math.min(LEVELS.length - 1, LEVELS.indexOf(levelForFloor(floor)) + 1);
  return LEVELS[i];
}

export function reward(run, floor) {
  let r = 10 + 4 * floor;
  if (isBoss(floor)) r *= 2;
  if (run.mode === 'casual') r = Math.round(r / 2);
  return r;
}

export function newRun(mode, frame, pilot, doctrine) {
  return {
    v: RUN_VERSION,
    mode, frame, pilot, doctrine,
    floor: 1,
    seed: (Math.random() * 2 ** 32) >>> 0,
    attempt: 0,
    earned: 0,
    battle: null,
    actions: [],
  };
}

// The exact setup for this floor and attempt (deterministic, so it can be previewed and replayed).
export function battleSetup(run) {
  const floor = run.floor;
  const twist = twistFor(run, floor);
  const enemy = enemyFor(run, floor);
  const theme = themeFor(run, floor);
  const youMods = {};
  const foeMods = {};
  const mapOpts = {};
  if (twist === 'brownout') youMods.brownout = true;
  if (twist === 'norepair') youMods.norepair = true;
  if (twist === 'hotcore') youMods.hotcore = true;
  if (twist === 'flooded') mapOpts.flooded = true;
  if (twist === 'fog') mapOpts.fog = true;
  if (twist === 'fortress') foeMods.fortress = true;
  if (twist === 'ambush') foeMods.startGuard = 2;
  if (isBoss(floor)) foeMods.limbBonus = (foeMods.limbBonus || 0) + 2;
  const seed = hash(run.seed, floor * 31 + run.attempt);
  return {
    setup: {
      players: [
        { frame: run.frame, pilot: run.pilot, doctrine: run.doctrine, mods: youMods },
        { ...enemy, mods: foeMods },
      ],
      seed,
      first: twist === 'ambush' ? 1 : 0,
      theme,
      mapOpts,
    },
    twist, enemy, theme,
  };
}

export function previewMap(run) {
  const { setup } = battleSetup(run);
  return makeMap(setup.seed ^ 0xA5A5, setup.theme, setup.mapOpts);
}

export function startBattle(run) {
  const b = battleSetup(run);
  run.battle = { setup: b.setup, twist: b.twist, enemy: b.enemy, theme: b.theme, aiSeed: hash(b.setup.seed, 7) };
  run.actions = [];
  return createGame(b.setup);
}

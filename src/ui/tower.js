// Battle Tower: floor generation, twists, rewards.
import { FRAME_ORDER, PILOT_ORDER, DOCTRINE_ORDER, TWIST_ORDER } from '../engine/data.js';
import { createGame } from '../engine/game.js';
import { levelForFloor, LEVELS } from '../engine/ai.js';

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

export function enemyFor(run, floor) {
  const h = hash(run.seed, floor * 977);
  return {
    frame: FRAME_ORDER[h % FRAME_ORDER.length],
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
    mode, frame, pilot, doctrine,
    floor: 1,
    seed: (Math.random() * 2 ** 32) >>> 0,
    attempt: 0,
    earned: 0,
    battle: null,
    actions: [],
  };
}

export function startBattle(run) {
  const floor = run.floor;
  const twist = twistFor(run, floor);
  const enemy = enemyFor(run, floor);
  const youMods = {};
  const foeMods = {};
  if (twist === 'brownout') youMods.brownout = true;
  if (twist === 'norepair') youMods.norepair = true;
  if (twist === 'shortage') youMods.shortage = true;
  if (twist === 'hotcore') youMods.hotcore = true;
  if (twist === 'armored') foeMods.limbBonus = 2;
  if (twist === 'ambush') foeMods.startGuard = 1;
  if (isBoss(floor)) foeMods.limbBonus = (foeMods.limbBonus || 0) + 2;
  const seed = hash(run.seed, floor * 31 + run.attempt);
  const setup = {
    players: [
      { frame: run.frame, pilot: run.pilot, doctrine: run.doctrine, mods: youMods },
      { ...enemy, mods: foeMods },
    ],
    seed,
    first: twist === 'ambush' ? 1 : 0,
  };
  run.battle = { setup, twist, enemy, aiSeed: hash(seed, 7) };
  run.actions = [];
  return createGame(setup);
}

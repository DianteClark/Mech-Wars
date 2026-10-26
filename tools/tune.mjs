// Self-play tuner for the AI evaluation weights.
// Hill-climbs: mutate a few weights, play the mutant against the current best,
// keep it only if it clearly wins. Prints the best weights as JSON at the end.
// Usage: node tools/tune.mjs [iterations] [games-per-test]
import { createGame, legalActions, applyAction, sameAction } from '../src/engine/game.js';
import { chooseTurn, W } from '../src/engine/ai.js';
import { FRAME_ORDER, PILOT_ORDER, DOCTRINE_ORDER } from '../src/engine/data.js';
import { writeFileSync } from 'node:fs';

const iters = Number(process.argv[2] || 100);
const games = Number(process.argv[3] || 64);
const base = { beam: 4, reply: 1, samples: 2, noise: 0, blunder: 0 };

function play(a, b, seed, wa, wb) {
  const s = createGame({ players: [a, b], seed, first: seed % 2, quiet: true });
  let n = 0;
  while (s.winner === null && n++ < 300) {
    const who = s.active;
    const plan = chooseTurn(s, { ...base, w: who === 0 ? wa : wb }, seed * 31 + s.turn);
    for (const act of plan) {
      if (s.winner !== null || s.active !== who) break;
      if (!legalActions(s).some((x) => sameAction(x, act))) break;
      applyAction(s, act);
    }
    if (s.winner === null && s.active === who) applyAction(s, { t: 'end' });
  }
  return s.winner;
}

function match(wNew, wOld, seed0) {
  let won = 0, n = 0;
  for (let g = 0; g < games / 2; g++) {
    const seed = seed0 + g;
    const A = { frame: FRAME_ORDER[g % 4], pilot: PILOT_ORDER[(g >> 2) % 4], doctrine: DOCTRINE_ORDER[g % 5] };
    const B = { frame: FRAME_ORDER[(g >> 1) % 4], pilot: PILOT_ORDER[(g + 1) % 4], doctrine: DOCTRINE_ORDER[(g + 2) % 5] };
    // Same setup and seed twice, with the two AIs swapping loadouts, so loadout and seat bias cancel out.
    if (play(A, B, seed, wNew, wOld) === 0) won++;
    if (play(A, B, seed, wOld, wNew) === 1) won++;
    n += 2;
  }
  return won / n;
}

let best = { ...W };
let rngS = 12345;
const rand = () => ((rngS = (rngS * 1103515245 + 12345) >>> 0) / 4294967296);
const keys = Object.keys(best);
for (let i = 0; i < iters; i++) {
  const cand = { ...best };
  const k = 1 + Math.floor(rand() * 3);
  for (let j = 0; j < k; j++) {
    const key = keys[Math.floor(rand() * keys.length)];
    cand[key] = +(cand[key] * (0.6 + rand() * 0.8)).toFixed(3);
  }
  const r = match(cand, best, 10000 + i * 1000);
  if (r >= 0.57) {
    // Confirm on fresh seeds to avoid lucky streaks.
    const r2 = match(cand, best, 900000 + i * 1000);
    if ((r + r2) / 2 >= 0.56) {
      best = cand;
      console.log(`iter ${i}: accepted (${(r * 100).toFixed(0)}%, ${(r2 * 100).toFixed(0)}%)`, JSON.stringify(best));
      writeFileSync(new URL('./tuned-weights.json', import.meta.url), JSON.stringify(best, null, 2));
      continue;
    }
  }
  if (i % 10 === 0) console.log(`iter ${i}: best holds (${(r * 100).toFixed(0)}%)`);
}
console.log('FINAL', JSON.stringify(best));

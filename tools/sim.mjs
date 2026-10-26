// AI-vs-AI simulator for balance testing.
// Usage: node tools/sim.mjs [games-per-matchup] [level 0-4]
import { createGame } from '../src/engine/game.js';
import { autoTurn, LEVELS } from '../src/engine/ai.js';
import { FRAME_ORDER, PILOT_ORDER, THEME_ORDER } from '../src/engine/data.js';

const games = Number(process.argv[2] || 6);
const level = LEVELS[Number(process.argv[3] ?? 2)];

export function playMatch(a, b, seed, lvA = level, lvB = level, theme = THEME_ORDER[seed % 4]) {
  const s = createGame({ players: [a, b], seed, first: seed % 2, quiet: true, theme });
  let guard = 0;
  while (s.winner === null && guard++ < 200) autoTurn(s, s.active === 0 ? lvA : lvB, seed * 7919 + s.turn);
  return { winner: s.winner, turns: s.turn, cores: s.players.map((p) => p.core), stats: s.players.map((p) => p.stats) };
}

if (process.argv[1].endsWith('sim.mjs')) {
  const t0 = Date.now();
  const wins = Object.fromEntries(FRAME_ORDER.map((f) => [f, 0]));
  const res = {};
  let n = 0, turns = 0, first = 0, crashes = 0, timeouts = 0;
  for (const fa of FRAME_ORDER) for (const fb of FRAME_ORDER) {
    if (fa >= fb) continue;
    let wa = 0;
    for (let g = 0; g < games; g++) {
      const seed = 1000 + g * 31 + fa.length * 7 + fb.length;
      const A = { frame: fa, pilot: PILOT_ORDER[g % 4] }, B = { frame: fb, pilot: PILOT_ORDER[(g + 1) % 4] };
      const swap = g % 2 === 1;
      const r = swap ? playMatch(B, A, seed) : playMatch(A, B, seed);
      const aWon = swap ? r.winner === 1 : r.winner === 0;
      if (aWon) { wa++; wins[fa]++; } else wins[fb]++;
      n++; turns += r.turns; if (r.winner === seed % 2) first++;
      crashes += r.stats[0].crashes + r.stats[1].crashes;
      if (r.turns >= 60) timeouts++;
    }
    res[`${fa} vs ${fb}`] = `${wa}/${games}`;
  }
  console.table(res);
  console.log(Object.entries(wins).map(([k, v]) => `${k} ${Math.round((100 * v) / (games * 3))}%`).join('  '));
  console.log(`avg turns ${(turns / n).toFixed(1)}, first-player wins ${first}/${n}, collisions/game ${(crashes / n).toFixed(1)}, timeouts ${timeouts}, ${((Date.now() - t0) / n).toFixed(0)}ms/game`);
}

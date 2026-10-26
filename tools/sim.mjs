// AI-vs-AI simulator for balance testing.
// Usage: node tools/sim.mjs [games-per-matchup] [level 0-4]
import { createGame, legalActions, applyAction, sameAction } from '../src/engine/game.js';
import { chooseTurn, LEVELS } from '../src/engine/ai.js';
import { FRAME_ORDER, PILOT_ORDER } from '../src/engine/data.js';

const games = Number(process.argv[2] || 10);
const level = LEVELS[Number(process.argv[3] ?? 2)];

export function playMatch(a, b, seed, lvA = level, lvB = level) {
  const s = createGame({ players: [a, b], seed, first: seed % 2, quiet: true });
  let guard = 0;
  while (s.winner === null && guard++ < 400) {
    const lv = s.active === 0 ? lvA : lvB;
    const plan = chooseTurn(s, lv, seed * 7919 + s.turn);
    const who = s.active;
    for (const act of plan) {
      if (s.winner !== null || s.active !== who) break;
      if (!legalActions(s).some((x) => sameAction(x, act))) break; // plan went stale
      applyAction(s, act);
    }
    if (s.winner === null && s.active === who) applyAction(s, { t: 'end' });
  }
  return { winner: s.winner, turns: s.turn, cores: s.players.map((p) => p.core) };
}

if (process.argv[1].endsWith('sim.mjs')) {
  const t0 = Date.now();
  const res = {};
  let totalTurns = 0, n = 0, firstWins = 0;
  for (const fa of FRAME_ORDER) {
    for (const fb of FRAME_ORDER) {
      if (fa >= fb) continue;
      let wa = 0;
      for (let g = 0; g < games; g++) {
        const seed = 1000 + g * 31 + fa.length * 7 + fb.length;
        const pa = PILOT_ORDER[g % 4], pb = PILOT_ORDER[(g + 1) % 4];
        const swap = g % 2 === 1;
        const A = { frame: fa, pilot: pa, doctrine: 'standard' };
        const B = { frame: fb, pilot: pb, doctrine: 'standard' };
        const r = swap ? playMatch(B, A, seed) : playMatch(A, B, seed);
        const aWon = swap ? r.winner === 1 : r.winner === 0;
        if (aWon) wa++;
        totalTurns += r.turns; n++;
        if (r.winner === (seed % 2)) firstWins++;
      }
      res[`${fa} vs ${fb}`] = `${wa}/${games}`;
    }
  }
  console.table(res);
  console.log(`avg turns ${(totalTurns / n).toFixed(1)}, first-player wins ${firstWins}/${n}, ${((Date.now() - t0) / n).toFixed(0)}ms/game`);
}

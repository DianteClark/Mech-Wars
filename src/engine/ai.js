// Mech Wars v2 — AI opponent for the tactics board.
//
// How it thinks:
// 1. It never looks at hidden info. It plans on "determinized" copies of the game where
//    your hand, Workshop contents and both deck orders are re-sampled from what's possible.
// 2. It searches its whole turn (moves, attacks, preps, installs) with a beam search,
//    scoring positions on damage, threat ranges, cover, and whether its heavy locks can be escaped.
// 3. Higher tiers also play out your best reply in several sampled worlds, so they see
//    where you'll run from a lock and punish standing in the open.

import {
  cloneState, legalActions, applyAction, determinize, activePlayer, opp, isExposed, energyOutput,
  attackOf, attackTargets, reachable, sameAction, mobility, apMax, destroyedCount, tileAt, cellsFor,
} from './game.js';
import { CARDS, LIMBS, TERRAIN, RULES } from './data.js';
import { nextRand } from './rng.js';

export const LEVELS = [
  { beam: 2, reply: 0, samples: 1, noise: 14, blunder: 0.25 }, // floors 1-2
  { beam: 3, reply: 0, samples: 1, noise: 7, blunder: 0.12 },  // floors 3-4
  { beam: 4, reply: 1, samples: 1, noise: 3, blunder: 0.04 },  // floors 5-7
  { beam: 5, reply: 2, samples: 2, noise: 1, blunder: 0 },     // floors 8-11
  { beam: 8, reply: 4, samples: 3, noise: 0, blunder: 0 },     // floors 12+
];

export function levelForFloor(floor) {
  if (floor <= 2) return LEVELS[0];
  if (floor <= 4) return LEVELS[1];
  if (floor <= 7) return LEVELS[2];
  if (floor <= 11) return LEVELS[3];
  return LEVELS[4];
}

export const W8 = {
  core: 10, energy: 5, limbAlive: 7, limbHp: 1.4, partAtk: 2.2, exposed: 25, oneDown: 6,
  guard: 4, hand: 1.8, workshop: 6, meter: 0.08, offense: 1.0, danger: 1.15, lockHit: 0.9,
  standInLock: 1.0, cover: 2, brace: 0.5, charge: 2,
};

// Best single-hit damage `p` could deal to `t` after one move, from its current state (rough).
function threat(state, p, t, moveFirst = true) {
  const tiles = [p.pos];
  if (moveFirst && !p.status.noMove) for (const v of reachable(state, p).values()) tiles.push(v);
  let best = 0;
  const save = p.pos;
  for (const k of LIMBS) {
    const a = attackOf(state, p, k);
    if (!a || a.wall || a.dmg <= 0) continue;
    let dmg = a.dmg * (a.heavy ? 0.45 : 1); // heavies can be dodged
    if (dmg <= best) continue;
    for (const pos of tiles) {
      p.pos = pos;
      const tg = attackTargets(state, p, a);
      if (tg.some((c) => a.shape === 'single' ? (c.x === t.pos.x && c.y === t.pos.y) : cellsFor(state, p, a, c.x, c.y).some((q) => q.x === t.pos.x && q.y === t.pos.y))) {
        let d = dmg;
        if (a.range === 'direct' && TERRAIN[tileAt(state, t.pos.x, t.pos.y).t].cover) d -= 2;
        if (t.status.brace) d *= 0.5;
        if (a.push && t.pos) d += 2; // shoves tend to crash
        best = Math.max(best, d);
        break;
      }
    }
  }
  p.pos = save;
  return best;
}

function sideScore(state, p, w) {
  let s = w.core * p.core + w.energy * energyOutput(p);
  if (p.core <= 6) s -= (7 - p.core) * 4;
  for (const k of LIMBS) {
    const l = p.limbs[k];
    if (!l.alive) continue;
    s += w.limbAlive + w.limbHp * l.hp;
    const a = attackOf(state, p, k);
    if (a && a.fromPart) s += w.partAtk * (a.dmg || 4) * (a.heavy ? 0.8 : 1) + (a.push || a.pull ? 3 : 0);
    if (k === 'legs') s += 3 * mobility(p);
  }
  if (isExposed(p)) s -= w.exposed; else if (destroyedCount(p) === 1) s -= w.oneDown;
  s += w.guard * p.guard + w.hand * Math.min(p.hand.length, 6) + w.meter * p.meter;
  for (const it of p.workshop) s += w.workshop + 1.5 * (CARDS[it.id]?.cost || 2);
  if (p.status.brace) s += w.brace;
  if (p.status.charge) s += w.charge;
  if (p.cells) s += 2 * p.cells;
  return s;
}

// Score from `me`'s point of view. Called at the end of a turn (the other side moves next).
export function evaluate(state, me, w = W8) {
  if (state.winner !== null) return state.winner === me ? 1e6 : -1e6;
  const a = state.players[me], b = state.players[1 - me];
  let s = sideScore(state, a, w) - sideScore(state, b, w);
  const toMove = state.players[state.active];
  const other = state.players[1 - state.active];
  // The side about to act threatens immediately; the other only after a reply.
  const tNow = threat(state, toMove, other, true);
  const tLater = threat(state, other, toMove, true) * 0.6;
  if (toMove === a) s += w.offense * tNow - w.danger * tLater;
  else s += w.offense * tLater - w.danger * tNow;
  // Heavy locks: those owned by the side NOT to move fire at the start of their next turn,
  // so the side to move gets one chance to escape.
  for (const tg of state.telegraphs) {
    const owner = state.players[tg.owner];
    const victim = state.players[1 - tg.owner];
    const onIt = tg.cells.some((c) => c.x === victim.pos.x && c.y === victim.pos.y);
    let v = 0;
    if (tg.owner === state.active) {
      // Fires before the victim can move again.
      if (onIt) v = tg.dmg;
    } else if (onIt) {
      const escape = victim.status.noMove ? 0 : [...reachable(state, victim).values()].filter((r) => !tg.cells.some((c) => c.x === r.x && c.y === r.y)).length;
      v = tg.dmg * (escape === 0 ? 1 : 0.25);
    } else v = tg.dmg * 0.08;
    s += (owner === a ? 1 : -1) * w.lockHit * v;
  }
  if (TERRAIN[tileAt(state, a.pos.x, a.pos.y).t].cover) s += w.cover;
  if (TERRAIN[tileAt(state, b.pos.x, b.pos.y).t].cover) s -= w.cover;
  return s;
}

function hashState(s) {
  const p = activePlayer(s), o = opp(s, p);
  let h = `${p.pos.x}${p.pos.y}|${p.ap}|${p.energy}|${p.core}|${o.core}|${o.pos.x}${o.pos.y}|${p.hand.length}|${p.status.brace ? 1 : 0}${p.status.charge ? 1 : 0}|${p.flags.workshop ? 1 : 0}|${s.telegraphs.length}|`;
  for (const k of LIMBS) h += `${p.limbs[k].hp}${p.limbs[k].part ? p.limbs[k].part.id[0] : ''}${p.flags.attacked[k] ? 1 : 0}${o.limbs[k].hp},`;
  h += p.workshop.map((w) => w.id + w.target).join('');
  return h;
}

// Plan one full turn for the active player in a (determinized) state.
export function planTurn(state, cfg, rng, evalFor = null) {
  const me = state.active;
  const who = evalFor ?? me;
  const scoreEnd = (s) => {
    const t = cloneState(s);
    applyAction(t, { t: 'end' });
    return evaluate(t, who, cfg.w || W8) + (cfg.noise ? (nextRand(rng) - 0.5) * 2 * cfg.noise : 0);
  };
  let beams = [{ s: state, acts: [], score: scoreEnd(state) }];
  const finished = [...beams.map((b) => ({ ...b, acts: [{ t: 'end' }] }))];
  for (let depth = 0; depth < 10 && beams.length; depth++) {
    const next = [];
    const seen = new Set();
    for (const b of beams) {
      const acts = legalActions(b.s, { lean: true });
      for (const a of acts) {
        if (a.t === 'end') continue;
        if (a.t === 'overdrive' && !b.s.players[me].hand.some((id) => CARDS[id].cost > b.s.players[me].energy)) continue;
        const s2 = applyAction(cloneState(b.s), a);
        if (s2.winner === me) return { candidates: [{ acts: [...b.acts, a, { t: 'end' }], score: 1e6, s: s2 }], actions: [...b.acts, a, { t: 'end' }], score: 1e6 };
        if (s2.winner !== null) continue;
        const h = hashState(s2);
        if (seen.has(h)) continue;
        seen.add(h);
        const sc = scoreEnd(s2);
        next.push({ s: s2, acts: [...b.acts, a], score: sc });
      }
    }
    next.sort((x, y) => y.score - x.score);
    beams = next.slice(0, cfg.beam);
    for (const b of beams) finished.push({ s: b.s, acts: [...b.acts, { t: 'end' }], score: b.score });
  }
  finished.sort((x, y) => y.score - x.score);
  return { candidates: finished, actions: finished[0].acts, score: finished[0].score };
}

function uniquePlans(cands) {
  const out = [], seen = new Set();
  for (const c of cands) {
    const key = c.acts.map((a) => JSON.stringify(a)).join(';');
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}

export function chooseTurn(realState, cfg, seed) {
  const rng = { rng: seed >>> 0 };
  const me = realState.active;
  const world = determinize(realState, me, rng);
  const plan = planTurn(world, cfg, rng);
  if (plan.score >= 1e6) return plan.actions;
  if (cfg.blunder && nextRand(rng) < cfg.blunder && plan.candidates.length > 2) {
    const i = 1 + Math.floor(nextRand(rng) * Math.min(4, plan.candidates.length - 1));
    return plan.candidates[i].acts;
  }
  if (!cfg.reply) return plan.actions;

  // Test the best few plans against the opponent's best reply in sampled worlds.
  const top = uniquePlans(plan.candidates).slice(0, cfg.reply + 1);
  let best = null;
  for (const cand of top) {
    let total = 0, worst = Infinity;
    for (let i = 0; i < cfg.samples; i++) {
      const w = determinize(realState, me, rng);
      let ok = true;
      for (const a of cand.acts) {
        if (!legalActions(w).some((b) => sameAction(a, b))) { ok = false; break; }
        applyAction(w, a);
        if (w.winner !== null) break;
      }
      let v;
      if (!ok) v = cand.score;
      else if (w.winner !== null) v = evaluate(w, me);
      else {
        const reply = planTurn(w, { beam: Math.max(2, cfg.beam - 2), noise: 0 }, rng);
        const after = cloneState(w);
        for (const a of reply.actions) { if (after.winner !== null) break; if (!legalActions(after).some((b) => sameAction(a, b))) break; applyAction(after, a); }
        v = evaluate(after, me);
      }
      total += v; worst = Math.min(worst, v);
    }
    const sc = 0.7 * (total / cfg.samples) + 0.3 * worst;
    if (!best || sc > best.score) best = { acts: cand.acts, score: sc };
  }
  return best.acts;
}

// Play a whole turn for the active player, replanning if the plan goes stale (e.g. after drawing cards).
export function autoTurn(state, cfg, seed) {
  const who = state.active;
  for (let tries = 0; tries < 6 && state.winner === null && state.active === who; tries++) {
    const plan = chooseTurn(state, cfg, (seed + tries * 7777) >>> 0);
    let stale = false;
    for (const a of plan) {
      if (state.winner !== null || state.active !== who) break;
      if (!legalActions(state).some((b) => sameAction(a, b))) { stale = true; break; }
      applyAction(state, a);
      if (a.t === 'install' && ['draw'].includes(CARDS[a.id].effect)) { stale = true; break; }
      if (a.t === 'special' && state.players[who].pilot === 'okafor') { stale = true; break; }
    }
    if (!stale) break;
  }
  if (state.winner === null && state.active === who) applyAction(state, { t: 'end' });
}

export { apMax, RULES };

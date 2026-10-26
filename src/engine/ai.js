// Mech Wars — AI opponent.
//
// How it thinks:
// 1. It never looks at hidden info. It plans on "determinized" copies of the game where
//    your hand, Workshop contents and both deck orders are re-sampled from what's possible.
// 2. It searches its own turn as a sequence of actions (beam search), scoring positions
//    with a hand-tuned evaluation.
// 3. At higher levels it also simulates your best reply across several sampled worlds
//    and picks the plan that holds up best (a 2-ply expectimax over hidden info).
//    The top levels play each candidate forward several turns (rollouts) instead.
// Difficulty = beam width, reply depth, samples, and how much noise/mistakes it makes.

import {
  cloneState, legalActions, applyAction, determinize, activePlayer, opp, isExposed,
  energyOutput, attackProfile, attackModes, statVal, apMax, destroyedCount, sameAction,
} from './game.js';
import { CARDS, LIMBS, RULES } from './data.js';
import { nextRand } from './rng.js';

export const LEVELS = [
  // floors 1–2: learning
  { beam: 2, reply: 0, samples: 1, noise: 10, blunder: 0.22 },
  // floors 3–4
  { beam: 3, reply: 0, samples: 1, noise: 5, blunder: 0.1 },
  // floors 5–7
  { beam: 5, reply: 1, samples: 2, noise: 2, blunder: 0.03 },
  // floors 8–11
  { beam: 8, reply: 4, samples: 4, noise: 0.5, blunder: 0, rollout: 3, rolloutBeam: 2 },
  // floors 12+: no mercy — plays each candidate plan forward several turns across sampled worlds
  { beam: 12, reply: 6, samples: 6, noise: 0, blunder: 0, rollout: 4, rolloutBeam: 2 },
];

export function levelForFloor(floor) {
  if (floor <= 2) return LEVELS[0];
  if (floor <= 4) return LEVELS[1];
  if (floor <= 7) return LEVELS[2];
  if (floor <= 11) return LEVELS[3];
  return LEVELS[4];
}

// ---------------------------------------------------------------- evaluation

function mountValue(p, k) {
  const l = p.limbs[k];
  if (!l.alive || !l.mount) return 0;
  const c = CARDS[l.mount.id];
  const mod = l.mount.mod;
  if (c.type === 'weapon') return 2.2 * statVal(l.mount.id, 'dmg', mod) + 2 * (c.pierce || 0) + (c.snipe ? 2 : 0) + (c.shred ? 2 : 0) + (c.emp ? 3 : 0) + (c.bash ? 1.5 * p.guard : 0) - (c.fire || 0);
  let v = 0;
  if (c.punch) v += 2 * statVal(l.mount.id, 'punch', mod) + (c.shred ? 2 : 0);
  if (c.kick) v += 2 * statVal(l.mount.id, 'kick', mod);
  if (c.ap) v += 8;
  if (c.guardGen) v += 10;
  if (c.guardBlock) v += 2 + 2 * p.guard;
  if (c.weaponBonus) {
    let w = 0;
    for (const j of LIMBS) if (p.limbs[j].alive && p.limbs[j].mount && CARDS[p.limbs[j].mount.id].type === 'weapon') w++;
    v += 2 + 3 * w;
  }
  if (c.oracle) v += 9;
  return v;
}

// Best single-hit damage this player threatens per action (rough tempo measure).
function strikePower(p) {
  const hits = [];
  for (const k of LIMBS) {
    const l = p.limbs[k];
    if (!l.alive) continue;
    const save = p.acted[k];
    p.acted[k] = false;
    for (const mode of attackModes(p, k)) hits.push(attackProfile(p, k, mode).dmg);
    p.acted[k] = save;
  }
  hits.sort((a, b) => b - a);
  const ap = apMax(p);
  let s = 0;
  for (let i = 0; i < Math.min(ap, hits.length); i++) s += hits[i];
  return s;
}

// Evaluation weights (tuned with tools/tune.mjs self-play).
export const W = {
  core: 9, energy: 6.15, lowCore: 4,
  legs: 14, head: 9, arm: 19.25, limbHp: 1.6, armor: 2.5,
  exposed: 22, oneDown: 6,
  guard: 4.5, cells: 2.8, hand: 2.5,
  buildBase: 6, buildCost: 1.2, buildMod: 2, buildSig: 6, buildDecay: 0.144,
  strike: 2.2, strikeExposed: 1.8, mount: 1,
};

function sideScore(p, foe, w = W) {
  let s = 0;
  // Core is everything: losing it ends the game, and it drives energy.
  s += w.core * p.core;
  s += w.energy * energyOutput(p);
  if (p.core <= 6) s -= (7 - p.core) * w.lowCore;

  const exposed = isExposed(p);
  for (const k of LIMBS) {
    const l = p.limbs[k];
    if (l.alive) {
      s += (k === 'legs' ? w.legs : k === 'head' ? w.head : w.arm) + w.limbHp * l.hp;
      if (l.plating) s += w.armor * CARDS[l.plating.id].armor;
      s += w.mount * mountValue(p, k);
    }
  }
  if (exposed) s -= w.exposed;
  else if (destroyedCount(p) === 1) s -= w.oneDown;

  s += w.guard * p.guard;
  s += w.cells * p.cells;
  s += w.hand * Math.min(p.hand.length, 6);

  // Builds in progress: worth more the closer they are.
  for (const it of p.workshop) {
    const c = CARDS[it.id];
    let v = w.buildBase + w.buildCost * c.cost + w.buildMod * (it.mod || 0);
    if (c.sig) v += w.buildSig;
    s += v * Math.max(0.2, 1 - w.buildDecay * Math.max(0, it.timer - 1));
  }

  const sp = strikePower(p);
  s += w.strike * sp;
  // Being able to hit an exposed Core is a big threat.
  if (isExposed(foe)) s += w.strikeExposed * sp;
  return s;
}

export function evaluate(state, me, w = W) {
  if (state.winner !== null) return state.winner === me ? 1e6 : -1e6;
  const a = state.players[me];
  const b = state.players[1 - me];
  return sideScore(a, b, w) - sideScore(b, a, w) - (a.flags.pilotOff ? 1 : 0);
}

// ---------------------------------------------------------------- search

function hashState(s) {
  const p = activePlayer(s);
  const o = opp(s, p);
  let h = `${p.core}|${p.energy}|${p.ap}|${p.guard}|${p.doctrine}|${o.core}|${o.guard}|${p.hand.join(',')}|`;
  for (const k of LIMBS) {
    const a = p.limbs[k], b = o.limbs[k];
    h += `${a.hp}${a.alive ? 1 : 0}${a.mount ? a.mount.id : ''}${p.acted[k] ? 1 : 0}${b.hp}${b.alive ? 1 : 0}|`;
  }
  for (const w of p.workshop) h += `${w.id}${w.timer}${w.target}`;
  for (const w of o.workshop) h += `${w.timer}`;
  return h;
}

// Attack ordering matters little: prune actions that are obviously pointless to keep beams useful.
function usefulActions(s) {
  const acts = legalActions(s);
  const p = activePlayer(s);
  const out = [];
  for (const a of acts) {
    if (a.t === 'overdrive') {
      // Only worth it if the extra energy unlocks something.
      if (!wouldUnlock(s, p)) continue;
    }
    out.push(a);
  }
  return out;
}

function wouldUnlock(s, p) {
  const e = p.energy + RULES.overdriveEnergy;
  for (const id of p.hand) {
    const c = CARDS[id];
    const cost = c.cost;
    if (cost > p.energy && cost <= e) return true;
  }
  for (const k of LIMBS) {
    const l = p.limbs[k];
    if (l.alive && l.mount && CARDS[l.mount.id].fire && !p.acted[k] && CARDS[l.mount.id].fire > p.energy) return true;
  }
  return false;
}

// Plan one full turn for the active player. Returns { actions, score, state }.
export function planTurn(state, cfg, rngHolder, evalFor = null) {
  const me = state.active;
  const scoreOf = (s) => evaluate(s, evalFor ?? me, cfg.w || W) + (cfg.noise ? (nextRand(rngHolder) - 0.5) * 2 * cfg.noise : 0);
  let beams = [{ s: state, acts: [], score: scoreOf(state) }];
  const finished = [];
  for (let depth = 0; depth < 14 && beams.length; depth++) {
    const next = [];
    const seen = new Set();
    for (const b of beams) {
      for (const a of usefulActions(b.s)) {
        if (a.t === 'end') {
          finished.push({ acts: [...b.acts, a], s: b.s, score: b.score });
          continue;
        }
        const s2 = applyAction(cloneState(b.s), a);
        const acts = [...b.acts, a];
        if (s2.winner === me) {
          const win = { acts: [...acts, { t: 'end' }], s: s2, score: 1e6 };
          return { candidates: [win], actions: win.acts, score: 1e6, state: s2 };
        }
        const h = hashState(s2);
        if (seen.has(h)) continue;
        seen.add(h);
        next.push({ s: s2, acts, score: scoreOf(s2) });
      }
    }
    next.sort((x, y) => y.score - x.score);
    beams = next.slice(0, cfg.beam);
  }
  for (const b of beams) finished.push({ acts: [...b.acts, { t: 'end' }], s: b.s, score: b.score });
  finished.sort((x, y) => y.score - x.score);
  return { candidates: finished, actions: finished[0].acts, score: finished[0].score, state: finished[0].s };
}

// Full decision for the AI player: returns a list of actions for this turn.
export function chooseTurn(realState, cfg, seed) {
  const rng = { rng: seed >>> 0 };
  const me = realState.active;
  const world = determinize(realState, me, rng);
  const plan = planTurn(world, cfg, rng);

  // Low levels: occasionally take a sloppy line instead of the best one.
  if (cfg.blunder && nextRand(rng) < cfg.blunder && plan.candidates.length > 1) {
    const pick = plan.candidates[1 + Math.floor(nextRand(rng) * Math.min(3, plan.candidates.length - 1))];
    return pick.acts;
  }
  if (!cfg.reply || plan.score >= 1e6) return plan.actions;

  // Look at the top candidate plans and test each against the opponent's best reply
  // in several sampled worlds.
  const top = uniquePlans(plan.candidates).slice(0, cfg.reply + 1);
  let best = null;
  for (const cand of top) {
    let total = 0;
    let worst = Infinity;
    for (let i = 0; i < cfg.samples; i++) {
      // Re-sample hidden info for each world, then replay our plan in it.
      let w = determinize(realState, me, rng);
      let ok = true;
      for (const a of cand.acts) {
        if (!legalActions(w).some((b) => sameAction(a, b))) { ok = false; break; }
        applyAction(w, a);
        if (w.winner !== null) break;
      }
      if (!ok) { total += cand.score; worst = Math.min(worst, cand.score); continue; }
      if (w.winner !== null) { total += evaluate(w, me, cfg.w || W); continue; }
      let v;
      if (cfg.rollout) {
        // Play the game forward a few turns with quick greedy plans for both sides.
        v = rollout(w, me, cfg, rng);
      } else {
        // Opponent replies with a solid greedy plan, scored from our side afterwards.
        const reply = planTurn(w, { beam: Math.max(2, Math.floor(cfg.beam / 2)), noise: 0, w: cfg.w }, rng);
        v = evaluate(reply.state, me, cfg.w || W);
      }
      total += v;
      worst = Math.min(worst, v);
    }
    const avg = total / cfg.samples;
    const score = 0.75 * avg + 0.25 * (worst === Infinity ? avg : worst);
    if (!best || score > best.score) best = { acts: cand.acts, score };
  }
  return best.acts;
}

function rollout(state, me, cfg, rng) {
  let s = state;
  for (let t = 0; t < cfg.rollout && s.winner === null; t++) {
    const r = planTurn(s, { beam: cfg.rolloutBeam || 2, noise: 0.5, w: cfg.w }, rng);
    s = cloneState(r.state);
    if (s.winner === null) applyAction(s, { t: 'end' });
  }
  return evaluate(s, me, cfg.w || W);
}

function uniquePlans(cands) {
  const out = [];
  const seen = new Set();
  for (const c of cands) {
    const key = c.acts.map((a) => `${a.t}${a.id || ''}${a.target || ''}${a.limb || ''}${a.mode || ''}${a.slot ?? ''}${a.doctrine || ''}`).sort().join(';');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

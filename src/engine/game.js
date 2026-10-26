// Mech Wars — rules engine.
// Pure and deterministic: all randomness comes from the seeded RNG stored in state,
// so any match can be replayed from (setup, seed, actions). Needed for ranked verification later.

import { CARDS, FRAMES, PILOTS, DOCTRINES, RULES, LIMBS, BASE_LIMB_HP } from './data.js';
import { shuffle, randInt } from './rng.js';

// ---------------------------------------------------------------- setup

export function createGame({ players, seed = 1, first = 0, quiet = false }) {
  const state = {
    rng: seed >>> 0,
    turn: 0,
    active: first,
    first,
    winner: null,
    quiet,
    log: [],
    players: players.map((cfg, i) => makePlayer(cfg, i)),
  };
  for (const p of state.players) {
    shuffle(state, p.deck);
    for (let i = 0; i < RULES.startHand; i++) draw(state, p);
  }
  startTurn(state);
  return state;
}

function makePlayer(cfg, idx) {
  const frame = FRAMES[cfg.frame];
  const mods = { ...(cfg.mods || {}) };
  const tune = frame.tune || {};
  const bonus = (tune.limbBonus || 0) + (mods.limbBonus || 0);
  const limbs = {};
  for (const k of LIMBS) {
    const max = BASE_LIMB_HP[k] + bonus;
    limbs[k] = { hp: max, max, base: max, alive: true, mount: null, plating: null };
  }
  return {
    idx,
    frame: cfg.frame,
    pilot: cfg.pilot,
    doctrine: cfg.doctrine || 'standard',
    mods,
    core: RULES.coreMax,
    energy: 0,
    ap: 0,
    guard: mods.startGuard || 0,
    cells: 0,
    turnsTaken: 0,
    limbs,
    acted: { head: false, armL: false, armR: false, legs: false },
    workshop: [],
    hand: [],
    deck: [...frame.deck],
    list: [...frame.deck],
    discard: [],
    flags: { overdrive: false, order: false, pilotOff: false, firstCard: false, firstAttack: false, evaded: false },
  };
}

// ---------------------------------------------------------------- helpers

export const opp = (state, p) => state.players[1 - p.idx];
export const tune = (p) => FRAMES[p.frame].tune || {};
export const activePlayer = (state) => state.players[state.active];

function ev(state, e) {
  if (!state.quiet) state.log.push(e);
}

function draw(state, p) {
  if (!p.deck.length || p.hand.length >= RULES.handLimit) return null;
  const c = p.deck.pop();
  p.hand.push(c);
  return c;
}

export function pilotOn(p, id) {
  return p.pilot === id && !p.flags.pilotOff;
}

export function energyOutput(p) {
  let out = 2;
  for (const [min, e] of RULES.energyTable) if (p.core >= min) { out = e; break; }
  if (p.mods.brownout) out -= 1;
  return Math.max(1, out);
}

export function slotCount(p) {
  return RULES.workshopSlots + (tune(p).extraSlot || 0) - (p.mods.shortage ? 1 : 0);
}

export function destroyedCount(p) {
  let n = 0;
  for (const k of LIMBS) if (!p.limbs[k].alive) n++;
  return n;
}

export const isExposed = (p) => destroyedCount(p) >= RULES.exposeAfter;

export function mountCard(p, limb) {
  const l = p.limbs[limb];
  return l.alive && l.mount ? CARDS[l.mount.id] : null;
}

function hasMount(p, id) {
  for (const k of LIMBS) {
    const l = p.limbs[k];
    if (l.alive && l.mount && l.mount.id === id) return true;
  }
  return false;
}

export const hasOracle = (p) => hasMount(p, 'oracle_eye');

// Stat value of a built card after doctrine steps.
export function statVal(id, key, mod) {
  const c = CARDS[id];
  let v = c[key] || 0;
  if (c.stat && c.stat[0] === key) v += mod * c.stat[1];
  return v;
}

export function apMax(p) {
  let ap = RULES.baseAP + (p.limbs.legs.alive ? 1 : 0);
  const m = mountCard(p, 'legs');
  if (m && m.ap) ap += m.ap;
  return ap;
}

export function guardBlock(p) {
  return hasMount(p, 'tower_shield') ? 5 : RULES.guardBlock;
}

export function overdriveCost(p) {
  return RULES.overdriveCost + (p.mods.hotcore ? 1 : 0) - (pilotOn(p, 'redline') ? 1 : 0);
}

export function cardCost(p, id) {
  const c = CARDS[id];
  let cost = c.cost;
  if (c.type === 'weapon' && tune(p).weaponDiscount) cost -= tune(p).weaponDiscount;
  if (pilotOn(p, 'okafor') && !p.flags.firstCard) cost -= 1;
  return Math.max(0, cost);
}

// Build time + stat steps if queued now under the current doctrine.
export function buildPlan(p, id) {
  const c = CARDS[id];
  const doc = DOCTRINES[p.doctrine];
  let time = c.build;
  if (tune(p).weaponHaste && c.type === 'weapon') time = Math.max(2, time - tune(p).weaponHaste);
  let mod = 0;
  if (doc.time < 0) {
    const t2 = Math.max(2, time + doc.time);
    if (t2 < time) { time = t2; mod += doc.mod; }
  } else if (doc.time > 0) {
    time += doc.time;
    mod += doc.mod;
  }
  if (doc.focus === 'fire' && (c.type === 'weapon' || c.punch || c.kick)) mod += 1;
  if (doc.focus === 'armor' && (c.type === 'plating' || ['repair', 'core', 'guard'].includes(c.effect))) mod += 1;
  return { time, mod };
}

// ---------------------------------------------------------------- turn flow

function startTurn(state) {
  const p = activePlayer(state);
  state.turn++;
  p.turnsTaken++;
  p.flags = { overdrive: false, order: false, pilotOff: false, firstCard: false, firstAttack: false, evaded: false };
  for (const k of LIMBS) p.acted[k] = false;

  // Workshop progress
  const done = [];
  for (const it of p.workshop) it.timer--;
  const keep = [];
  for (const it of p.workshop) (it.timer <= 0 ? done : keep).push(it);
  p.workshop = keep;
  for (const it of done) completeBuild(state, p, it);

  // Signature: Aegis Dome
  if (hasMount(p, 'aegis_dome')) p.guard = Math.min(RULES.guardMax, p.guard + 1);

  // Energy
  p.energy = Math.min(p.turnsTaken + 1, energyOutput(p));
  // The second player gets a little extra on their opening turn to offset going second.
  if (p.turnsTaken === 1 && p.idx !== state.first) p.energy += RULES.secondEnergy;
  if (p.cells > 0) { p.energy += 1; p.cells--; }

  p.ap = apMax(p);
  // Going first is an edge: the opening turn gets one action and no draw.
  if (state.turn === 1) p.ap = Math.min(p.ap, 1);

  const skipDraw = state.turn === 1;
  if (!skipDraw) {
    const c = draw(state, p);
    if (c) ev(state, { type: 'draw', p: p.idx });
  }
  ev(state, { type: 'turn', p: p.idx, turn: state.turn });
}

function completeBuild(state, p, it) {
  const c = CARDS[it.id];
  const l = it.target ? p.limbs[it.target] : null;
  const back = () => { p.hand.push(it.id); ev(state, { type: 'buildReturned', p: p.idx, id: it.id, target: it.target }); };

  if (c.type === 'weapon' || c.type === 'boost') {
    if (!l.alive) return back();
    if (l.mount) p.discard.push(l.mount.id);
    l.mount = { id: it.id, mod: it.mod };
  } else if (c.type === 'plating') {
    if (!l.alive) return back();
    if (l.plating) p.discard.push(l.plating.id);
    const hp = statVal(it.id, 'hp', it.mod);
    l.plating = { id: it.id, mod: it.mod };
    l.max += hp;
    l.hp += hp;
  } else if (c.effect === 'repair') {
    if (!l.alive) return back();
    l.hp = Math.min(l.max, l.hp + statVal(it.id, 'amount', it.mod));
    p.discard.push(it.id);
  } else if (c.effect === 'rebuild') {
    if (!l.alive) {
      l.alive = true;
      l.max = l.base;
      l.hp = l.base;
    } else {
      l.hp = Math.min(l.max, l.hp + 4);
    }
    p.discard.push(it.id);
  } else if (c.effect === 'core') {
    p.core = Math.min(RULES.coreMax, p.core + statVal(it.id, 'amount', it.mod));
    p.discard.push(it.id);
  } else if (c.effect === 'guard') {
    p.guard = Math.min(RULES.guardMax, p.guard + statVal(it.id, 'amount', it.mod));
    p.discard.push(it.id);
  } else if (c.effect === 'cell') {
    p.cells += statVal(it.id, 'amount', it.mod);
    p.discard.push(it.id);
  }
  if (l && l.alive && pilotOn(p, 'gus')) l.hp = Math.min(l.max, l.hp + 2);
  ev(state, { type: 'built', p: p.idx, id: it.id, target: it.target, mod: it.mod });
}

// ---------------------------------------------------------------- attacks

export function attackModes(p, limb) {
  const l = p.limbs[limb];
  if (!l.alive || p.acted[limb]) return [];
  const m = mountCard(p, limb);
  const modes = [];
  if (limb === 'armL' || limb === 'armR') modes.push('punch');
  if (limb === 'legs' && !(m && m.type === 'weapon')) modes.push('kick');
  if (m && m.type === 'weapon') modes.push('fire');
  return modes;
}

export function fireCost(p, limb) {
  const m = mountCard(p, limb);
  return m && m.fire ? m.fire : 0;
}

// Returns { dmg, pierce, snipe, shred, emp } for an attack (before defender effects).
export function attackProfile(p, limb, mode) {
  const l = p.limbs[limb];
  const m = mountCard(p, limb);
  const mod = l.mount ? l.mount.mod : 0;
  let dmg = 0;
  const kw = { pierce: 0, snipe: false, shred: false, emp: false };
  if (mode === 'punch') {
    dmg = RULES.punch + (m && m.type === 'boost' ? statVal(l.mount.id, 'punch', mod) : 0);
    if (m && m.type === 'boost' && m.shred) kw.shred = true;
  } else if (mode === 'kick') {
    dmg = RULES.kick + (m && m.type === 'boost' ? statVal(l.mount.id, 'kick', mod) : 0);
  } else {
    dmg = statVal(l.mount.id, 'dmg', mod);
    if (m.bash) dmg += p.guard;
    if (m.pierce) kw.pierce = m.pierce;
    if (m.snipe) kw.snipe = true;
    if (m.shred) kw.shred = true;
    if (m.emp) kw.emp = true;
    const head = mountCard(p, 'head');
    if (head && head.weaponBonus) dmg += head.weaponBonus;
    if (!p.limbs.head.alive) dmg -= 1;
    dmg += tune(p).weaponBonus || 0;
  }
  if (mode === 'punch') dmg += tune(p).punchBonus || 0;
  if (pilotOn(p, 'kai') && !p.flags.firstAttack) dmg += 1;
  if (hasOracle(p)) kw.snipe = true;
  if (kw.snipe) dmg += tune(p).snipeBonus || 0;
  return { dmg: Math.max(1, dmg), ...kw };
}

// Predict what a hit would do, without changing state.
export function previewHit(attacker, defender, target, prof) {
  let dmg = prof.dmg;
  let blocked = 0;
  const evade = tune(defender).evade && !defender.flags.evaded ? tune(defender).evade : 0;
  dmg = Math.max(1, dmg - evade);
  if (!prof.snipe && defender.guard > 0) {
    blocked = Math.min(dmg, guardBlock(defender));
    dmg -= blocked;
  }
  if (dmg <= 0) return { blocked, limb: 0, core: 0 };
  const pierce = Math.min(prof.pierce, dmg);
  let rest = dmg - pierce;
  if (target === 'core') {
    let core = rest + pierce;
    if (prof.shred) core += RULES.shredCore;
    return { blocked, limb: 0, core: Math.max(1, core) };
  }
  const l = defender.limbs[target];
  let limbDmg = 0;
  if (rest > 0) {
    const armor = l.plating ? CARDS[l.plating.id].armor : 0;
    limbDmg = Math.max(1, rest - armor) + (prof.shred ? RULES.shredLimb : 0);
  }
  return { blocked, limb: limbDmg, core: pierce };
}

function doAttack(state, p, limb, mode, target) {
  const d = opp(state, p);
  const prof = attackProfile(p, limb, mode);
  p.ap--;
  p.acted[limb] = true;
  p.flags.firstAttack = true;
  if (mode === 'fire') p.energy -= fireCost(p, limb);
  const res = previewHit(p, d, target, prof);
  if (tune(d).evade) d.flags.evaded = true;
  if (res.blocked) d.guard--;
  let destroyed = false;
  if (res.limb) {
    const l = d.limbs[target];
    l.hp -= res.limb;
    if (l.hp <= 0) {
      destroyed = true;
      l.hp = 0;
      l.alive = false;
      if (l.mount) d.discard.push(l.mount.id);
      if (l.plating) d.discard.push(l.plating.id);
      l.mount = null;
      l.plating = null;
      l.max = l.base;
    }
  }
  if (res.core) d.core -= res.core;
  ev(state, { type: 'attack', p: p.idx, limb, mode, target, dmg: prof.dmg, ...res, destroyed,
    weapon: mode === 'fire' ? p.limbs[limb].mount.id : null });
  if (prof.emp && (res.limb || res.core)) delaySoonest(state, d);
  if (d.core <= 0) {
    d.core = 0;
    state.winner = p.idx;
    ev(state, { type: 'win', p: p.idx });
  }
}

function delaySoonest(state, d) {
  if (!d.workshop.length) return;
  let best = 0;
  for (let i = 1; i < d.workshop.length; i++) if (d.workshop[i].timer < d.workshop[best].timer) best = i;
  d.workshop[best].timer++;
  ev(state, { type: 'delayed', p: d.idx, slot: best });
}

// ---------------------------------------------------------------- actions

// Action shapes:
//  { t:'end' } | { t:'overdrive' } | { t:'order', doctrine }
//  { t:'play', id, target? , slot? }   target = limb, slot = workshop index (Rush Order)
//  { t:'attack', limb, mode, target }  target = limb | 'core'

export function playTargets(state, p, id) {
  const c = CARDS[id];
  if (c.type === 'weapon' || c.type === 'boost' || c.type === 'plating') {
    return c.slots.filter((k) => p.limbs[k].alive);
  }
  if (c.effect === 'repair') return LIMBS.filter((k) => p.limbs[k].alive && p.limbs[k].hp < p.limbs[k].max);
  if (c.effect === 'rebuild') return LIMBS.filter((k) => !p.limbs[k].alive);
  return [null];
}

export function canPlay(state, p, id) {
  const c = CARDS[id];
  if (cardCost(p, id) > p.energy) return false;
  if (p.mods.norepair && ['repair', 'rebuild', 'core'].includes(c.effect)) return false;
  if (c.type !== 'order' && p.workshop.length >= slotCount(p)) return false;
  if (c.effect === 'rush' && !p.workshop.some((w) => w.timer > 1)) return false;
  if (c.effect === 'sabotage' && !opp(state, p).workshop.length) return false;
  if (c.effect === 'guardNow' && p.guard >= RULES.guardMax) return false;
  if (c.type !== 'order' && !playTargets(state, p, id).length) return false;
  return true;
}

export function attackTargets(state, p) {
  const d = opp(state, p);
  const t = LIMBS.filter((k) => d.limbs[k].alive);
  if (isExposed(d)) t.push('core');
  return t;
}

export function legalActions(state) {
  if (state.winner !== null) return [];
  const p = activePlayer(state);
  const acts = [{ t: 'end' }];
  if (!p.flags.overdrive && p.core > overdriveCost(p)) acts.push({ t: 'overdrive' });
  if (!p.flags.order && p.energy >= RULES.orderCost) {
    for (const d of Object.keys(DOCTRINES)) if (d !== p.doctrine) acts.push({ t: 'order', doctrine: d });
  }
  const seen = new Set();
  for (const id of p.hand) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!canPlay(state, p, id)) continue;
    const c = CARDS[id];
    if (c.effect === 'rush') {
      p.workshop.forEach((w, i) => { if (w.timer > 1) acts.push({ t: 'play', id, slot: i }); });
    } else {
      for (const target of playTargets(state, p, id)) acts.push({ t: 'play', id, target });
    }
  }
  if (p.ap > 0) {
    const targets = attackTargets(state, p);
    for (const limb of LIMBS) {
      for (const mode of attackModes(p, limb)) {
        if (mode === 'fire' && fireCost(p, limb) > p.energy) continue;
        for (const target of targets) acts.push({ t: 'attack', limb, mode, target });
      }
    }
  }
  return acts;
}

export function sameAction(a, b) {
  return a.t === b.t && a.id === b.id && a.target === b.target && a.slot === b.slot &&
    a.limb === b.limb && a.mode === b.mode && a.doctrine === b.doctrine;
}

export function isLegal(state, a) {
  return legalActions(state).some((b) => sameAction(a, b));
}

export function applyAction(state, a) {
  const p = activePlayer(state);
  switch (a.t) {
    case 'end':
      ev(state, { type: 'end', p: p.idx });
      state.active = 1 - state.active;
      if (state.turn >= 80) { // safety valve: very long stalemates go to higher Core
        const o = opp(state, p);
        state.winner = p.core === o.core ? state.first : (p.core > o.core ? p.idx : o.idx);
        ev(state, { type: 'win', p: state.winner, timeout: true });
        return state;
      }
      startTurn(state);
      break;
    case 'overdrive': {
      const cost = overdriveCost(p);
      p.core -= cost;
      p.energy += RULES.overdriveEnergy;
      p.flags.overdrive = true;
      ev(state, { type: 'overdrive', p: p.idx, cost });
      break;
    }
    case 'order':
      p.energy -= RULES.orderCost;
      p.doctrine = a.doctrine;
      p.flags.order = true;
      p.flags.pilotOff = true;
      ev(state, { type: 'order', p: p.idx, doctrine: a.doctrine });
      break;
    case 'play':
      playCard(state, p, a);
      break;
    case 'attack':
      doAttack(state, p, a.limb, a.mode, a.target);
      break;
  }
  return state;
}

function playCard(state, p, a) {
  const c = CARDS[a.id];
  p.energy -= cardCost(p, a.id);
  p.flags.firstCard = true;
  p.hand.splice(p.hand.indexOf(a.id), 1);
  if (c.type === 'order') {
    p.discard.push(a.id);
    if (c.effect === 'rush') p.workshop[a.slot].timer--;
    else if (c.effect === 'draw') for (let i = 0; i < c.amount; i++) draw(state, p);
    else if (c.effect === 'ap') p.ap += c.amount;
    else if (c.effect === 'guardNow') p.guard = Math.min(RULES.guardMax, p.guard + c.amount);
    else if (c.effect === 'sabotage') delaySoonest(state, opp(state, p));
    ev(state, { type: 'order-card', p: p.idx, id: a.id, slot: a.slot });
    return;
  }
  const plan = buildPlan(p, a.id);
  p.workshop.push({ id: a.id, target: a.target ?? null, timer: plan.time, total: plan.time, mod: plan.mod });
  ev(state, { type: 'queued', p: p.idx, id: a.id, target: a.target, time: plan.time });
}

// ---------------------------------------------------------------- cloning & hidden info

export function cloneState(s) {
  return {
    rng: s.rng, turn: s.turn, active: s.active, first: s.first, winner: s.winner,
    quiet: true, log: [],
    players: s.players.map(clonePlayer),
  };
}

function clonePlayer(p) {
  const limbs = {};
  for (const k of LIMBS) {
    const l = p.limbs[k];
    limbs[k] = { hp: l.hp, max: l.max, base: l.base, alive: l.alive,
      mount: l.mount && { id: l.mount.id, mod: l.mount.mod },
      plating: l.plating && { id: l.plating.id, mod: l.plating.mod } };
  }
  return {
    idx: p.idx, frame: p.frame, pilot: p.pilot, doctrine: p.doctrine, mods: p.mods,
    core: p.core, energy: p.energy, ap: p.ap, guard: p.guard, cells: p.cells, turnsTaken: p.turnsTaken,
    limbs, acted: { ...p.acted },
    workshop: p.workshop.map((w) => ({ ...w })),
    hand: p.hand.slice(), deck: p.deck.slice(), list: p.list, discard: p.discard.slice(),
    flags: { ...p.flags },
  };
}

// Build a plausible version of the state as `viewer` sees it: the opponent's hand,
// deck order and Workshop contents are re-sampled from what they could be.
// The viewer's own deck order is also unknown, so it is shuffled too.
export function determinize(state, viewerIdx, rngHolder) {
  const s = cloneState(state);
  const me = s.players[viewerIdx];
  const o = s.players[1 - viewerIdx];
  shuffle(rngHolder, me.deck);
  if (hasOracle(me)) {
    shuffle(rngHolder, o.deck);
    return s;
  }
  const pool = o.list.slice();
  const remove = (id) => { const i = pool.indexOf(id); if (i >= 0) pool.splice(i, 1); };
  for (const k of LIMBS) {
    const l = o.limbs[k];
    if (l.mount) remove(l.mount.id);
    if (l.plating) remove(l.plating.id);
  }
  for (const id of o.discard) remove(id);
  shuffle(rngHolder, pool);
  for (const w of o.workshop) {
    let i = pool.findIndex((id) => CARDS[id].type !== 'order');
    if (i < 0) i = 0;
    const id = pool.length ? pool.splice(i, 1)[0] : 'pulse_rifle';
    w.id = id;
    const c = CARDS[id];
    if (c.slots) {
      const ok = c.slots.filter((k) => o.limbs[k].alive);
      w.target = ok.length ? ok[randInt(rngHolder, ok.length)] : c.slots[0];
    } else if (c.effect === 'repair' || c.effect === 'rebuild') {
      w.target = 'legs';
    } else w.target = null;
  }
  const h = o.hand.length;
  o.hand = pool.splice(0, h);
  o.deck = pool;
  return s;
}

// What the given player is allowed to see of the opponent (used by UI and AI fairness checks).
export function canSeeHidden(state, viewerIdx) {
  return hasOracle(state.players[viewerIdx]);
}

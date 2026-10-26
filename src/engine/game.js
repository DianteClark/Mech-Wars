// Mech Wars v2 — rules engine for the tactics board.
// Pure and deterministic: all randomness comes from the seeded RNG stored in state,
// so any match can be replayed from (setup, actions). Needed for ranked verification later.

import {
  W, H, CARDS, FRAMES, DOCTRINES, RULES, LIMBS, BASE_LIMB_HP, BASE_ATTACKS, TERRAIN, MAP_THEMES,
} from './data.js';
import { shuffle, randInt, nextRand } from './rng.js';

// ---------------------------------------------------------------- board helpers

export const idx = (x, y) => y * W + x;
export const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const DIRS8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

export function tileAt(state, x, y) {
  return inBounds(x, y) ? state.board.tiles[idx(x, y)] : null;
}
export function terrainOf(state, x, y) {
  const t = tileAt(state, x, y);
  return t ? TERRAIN[t.t] : null;
}
export function mechAt(state, x, y) {
  for (const p of state.players) if (p.pos.x === x && p.pos.y === y) return p;
  return null;
}
export const opp = (state, p) => state.players[1 - p.idx];
export const activePlayer = (state) => state.players[state.active];
export const tune = (p) => FRAMES[p.frame].tune || {};

// ---------------------------------------------------------------- map generation

// Point-symmetric maps (rotated 180°) so neither side starts with better terrain.
export function makeMap(seed, themeId = 'city', opts = {}) {
  const rng = { rng: seed >>> 0 };
  const theme = MAP_THEMES[themeId];
  const tiles = Array.from({ length: W * H }, () => ({ t: 'open', hp: 0 }));
  const set = (x, y, t) => {
    tiles[idx(x, y)] = { t, hp: TERRAIN[t].hp };
    tiles[idx(W - 1 - x, H - 1 - y)] = { t, hp: TERRAIN[t].hp };
  };
  const starts = [{ x: 2, y: H - 1 }, { x: W - 3, y: 0 }];
  const reserved = new Set();
  for (const s of starts) for (const [dx, dy] of [[0, 0], ...DIRS4]) {
    const x = s.x + dx, y = s.y + dy;
    if (inBounds(x, y)) { reserved.add(idx(x, y)); reserved.add(idx(W - 1 - x, H - 1 - y)); }
  }
  if (theme.river || opts.flooded) {
    // A river across the middle row with two fords.
    const ford = 1 + randInt(rng, 2);
    for (let x = 0; x < W; x++) if (x !== ford && x !== W - 1 - ford) tiles[idx(x, 3)] = { t: 'river', hp: 0 };
  }
  if (opts.flooded) {
    for (let i = 0; i < 2; i++) {
      const x = randInt(rng, W), y = 1 + randInt(rng, 2);
      if (!reserved.has(idx(x, y))) set(x, y, 'river');
    }
  }
  const pool = Object.entries(theme.weights).flatMap(([t, w]) => Array(w).fill(t));
  const count = 4 + randInt(rng, 3); // placed in the top half, mirrored
  let placed = 0, guard = 0;
  while (placed < count && guard++ < 200) {
    const x = randInt(rng, W), y = randInt(rng, 3); // rows 0-2, mirrored to 4-6
    if (reserved.has(idx(x, y)) || tiles[idx(x, y)].t !== 'open') continue;
    const t = pool[randInt(rng, pool.length)];
    if (t === 'river') { if (y === 0) continue; }
    set(x, y, t);
    placed++;
  }
  // A couple of mirrored pieces on the middle row (unless it's the river).
  if (!(theme.river || opts.flooded)) {
    const x = randInt(rng, 3);
    const t = pool[randInt(rng, pool.length)];
    if (t !== 'river') { tiles[idx(x, 3)] = { t, hp: TERRAIN[t].hp }; tiles[idx(W - 1 - x, 3)] = { t, hp: TERRAIN[t].hp }; }
  }
  // Guarantee a walking path between the two starts.
  const passable = (i) => !TERRAIN[tiles[i].t].blocks;
  const reach = new Set([idx(starts[0].x, starts[0].y)]);
  const q = [starts[0]];
  while (q.length) {
    const c = q.shift();
    for (const [dx, dy] of DIRS4) {
      const x = c.x + dx, y = c.y + dy;
      if (!inBounds(x, y) || reach.has(idx(x, y)) || !passable(idx(x, y))) continue;
      reach.add(idx(x, y)); q.push({ x, y });
    }
  }
  if (!reach.has(idx(starts[1].x, starts[1].y))) {
    for (let y = 0; y < H; y++) { tiles[idx(2, y)] = tiles[idx(2, y)].t === 'river' ? tiles[idx(2, y)] : { t: 'open', hp: 0 }; tiles[idx(W - 3, y)] = tiles[idx(W - 3, y)].t === 'river' ? tiles[idx(W - 3, y)] : { t: 'open', hp: 0 }; }
  }
  return { tiles, theme: themeId, fog: !!opts.fog, starts };
}

// ---------------------------------------------------------------- setup

export function createGame({ players, seed = 1, first = 0, quiet = false, map = null, theme = 'city', mapOpts = {} }) {
  const board = map ? structuredCloneSafe(map) : makeMap(seed ^ 0xA5A5, theme, mapOpts);
  const state = {
    rng: seed >>> 0, turn: 0, active: first, first, winner: null, quiet, log: [],
    board, telegraphs: [], nextTg: 1,
    players: players.map((cfg, i) => makePlayer(cfg, i, board.starts[i])),
  };
  for (const p of state.players) {
    shuffle(state, p.deck);
    for (let i = 0; i < RULES.startHand; i++) draw(state, p);
    if (p.mods.fortress) for (const k of LIMBS) attachMod(p, k, 'heavy_plating');
  }
  startTurn(state);
  return state;
}

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

function makePlayer(cfg, i, pos) {
  const frame = FRAMES[cfg.frame];
  const mods = { ...(cfg.mods || {}) };
  const bonus = (frame.tune?.limbBonus || 0) + (mods.limbBonus || 0);
  const limbs = {};
  for (const k of LIMBS) {
    const base = Math.max(3, BASE_LIMB_HP[k] + bonus);
    limbs[k] = { hp: base, max: base, base, alive: true, part: null, mods: [] };
  }
  return {
    idx: i, frame: cfg.frame, pilot: cfg.pilot, doctrine: cfg.doctrine || 'standard', mods,
    core: RULES.coreMax, energy: 0, ap: 0, pos: { x: pos.x, y: pos.y },
    limbs, hand: [], deck: [...frame.deck], list: [...frame.deck], discard: [], workshop: [],
    guard: (mods.startGuard || 0) + (frame.tune?.startGuard || 0), cells: 0, meter: 0, turnsTaken: 0,
    status: { brace: false, charge: false, smoke: false, locked: false, stuck: false, noMove: false },
    flags: freshFlags(),
    stats: { dealt: 0, taken: 0, crashes: 0, broke: 0, installs: 0, dodges: 0 },
  };
}

function freshFlags() {
  return { overdrive: false, firstInstall: false, firstAttack: false, workshop: false, special: false, bonusNext: 0, ignoreBraceNext: false, attacked: {}, moves: 0 };
}

function ev(state, e) { if (!state.quiet) state.log.push(e); }

function draw(state, p) {
  if (!p.deck.length || p.hand.length >= RULES.handLimit) return null;
  const c = p.deck.pop();
  p.hand.push(c);
  return c;
}

// ---------------------------------------------------------------- derived stats

export const pilotOn = (p, id) => p.pilot === id;

export function energyOutput(p) {
  let out = 2;
  for (const [min, e] of RULES.energyTable) if (p.core >= min) { out = e; break; }
  if (p.mods.brownout) out -= 1;
  return Math.max(1, out);
}

export function destroyedCount(p) {
  let n = 0;
  for (const k of LIMBS) if (!p.limbs[k].alive) n++;
  return n;
}
export const isExposed = (p) => destroyedCount(p) >= RULES.exposeAfter;

export function partOf(p, k) {
  const l = p.limbs[k];
  return l.alive && l.part ? CARDS[l.part.id] : null;
}
function modsOf(p, k) {
  const l = p.limbs[k];
  return l.alive ? l.mods.map((m) => CARDS[m.id]) : [];
}
function hasPart(p, key) {
  for (const k of LIMBS) { const c = partOf(p, k); if (c && c[key]) return c; }
  return null;
}

export function apMax(p) {
  let ap = RULES.baseAP + (tune(p).ap || 0);
  if (!p.limbs.legs.alive) ap -= 1;
  return Math.max(1, ap);
}

export function mobility(p) {
  if (!p.limbs.legs.alive) return 1;
  const legs = partOf(p, 'legs');
  let m = legs && legs.mobility ? legs.mobility : (tune(p).mobility || RULES.baseMobility);
  return Math.max(1, m);
}

export function overdriveCost(p) {
  return RULES.overdriveCost + (p.mods.hotcore ? 1 : 0) - (pilotOn(p, 'redline') ? 1 : 0);
}

export function cardCost(p, id) {
  let c = CARDS[id].cost;
  if (pilotOn(p, 'okafor') && !p.flags.firstInstall) c -= 1;
  return Math.max(0, c);
}

function crashBonusOf(p) {
  let b = tune(p).crashBonus || 0;
  for (const k of LIMBS) for (const m of modsOf(p, k)) b += m.crashBonus || 0;
  return b;
}

function globalArmor(p) {
  let a = 0;
  for (const k of LIMBS) { const c = partOf(p, k); if (c && c.globalArmor) a += c.globalArmor; }
  return a;
}

function limbArmor(p, k) {
  let a = 0;
  const c = partOf(p, k);
  if (c && c.armor) a += c.armor;
  for (const m of modsOf(p, k)) a += m.armor || 0;
  return a;
}

// The attack a limb can make right now (null if none), with all bonuses applied.
export function attackOf(state, p, k) {
  const l = p.limbs[k];
  if (!l.alive) return null;
  const part = partOf(p, k);
  const base = part && part.attack ? part.attack : (part && k !== 'legs' && k !== 'head' ? null : BASE_ATTACKS[k]);
  if (!base) return null;
  const a = { ...base, limb: k, fromPart: !!(part && part.attack) };
  const q = part && part.attack ? (l.part.mod || 0) : 0;
  if (a.dmg > 0) a.dmg += q + (part && part.attack && l.part.fire ? 1 : 0);
  for (const m of modsOf(p, k)) { if (m.reach && a.range !== 'melee') a.reach += m.reach; if (m.dmgBonus && a.dmg > 0) a.dmg += m.dmgBonus; }
  if (a.range === 'melee' && a.dmg > 0) a.dmg += tune(p).meleeBonus || 0;
  if (a.range === 'direct') {
    a.reach += tune(p).directRange || 0;
    if (a.dmg > 0) a.dmg += tune(p).directBonus || 0;
    const sensor = hasPart(p, 'rangeBonus');
    if (sensor) a.reach += sensor.rangeBonus;
    if (!p.limbs.head.alive) a.reach -= 2;
    if (state.board.fog) a.reach -= 2;
    a.reach = Math.max(1, a.reach);
  }
  return a;
}

// Tiles an attack can target from the attacker's position.
export function attackTargets(state, p, a) {
  const out = [];
  const from = p.pos;
  if (a.range === 'melee') {
    for (const [dx, dy] of DIRS8) {
      const x = from.x + dx, y = from.y + dy;
      if (!inBounds(x, y)) continue;
      const m = mechAt(state, x, y);
      const t = TERRAIN[tileAt(state, x, y).t];
      if ((m && m !== p) || t.hp > 0) out.push({ x, y });
    }
  } else if (a.range === 'direct') {
    for (const [dx, dy] of DIRS4) {
      for (let s = 1; s <= a.reach; s++) {
        const x = from.x + dx * s, y = from.y + dy * s;
        if (!inBounds(x, y)) break;
        const m = mechAt(state, x, y);
        const t = TERRAIN[tileAt(state, x, y).t];
        if (a.heavy) out.push({ x, y });
        if (m || t.blocks) { if (!a.heavy) out.push({ x, y }); break; }
      }
    }
  } else {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = dist(from, { x, y });
      if (d === 0 || d > a.reach) continue;
      if (a.wall) {
        const t = tileAt(state, x, y);
        if (mechAt(state, x, y) || TERRAIN[t.t].blocks || t.t === 'river') continue;
      }
      out.push({ x, y });
    }
  }
  return out;
}

// Tiles covered by an attack aimed at (x, y).
export function cellsFor(state, p, a, x, y) {
  const c = [];
  const add = (cx, cy) => { if (inBounds(cx, cy)) c.push({ x: cx, y: cy }); };
  switch (a.shape) {
    case 'plus': add(x, y); for (const [dx, dy] of DIRS4) add(x + dx, y + dy); break;
    case 'sq2': add(x, y); add(x + 1, y); add(x, y + 1); add(x + 1, y + 1); break;
    case 'row': for (let i = 0; i < W; i++) add(i, y); break;
    default: add(x, y);
  }
  return c;
}

// ---------------------------------------------------------------- movement

// Tiles reachable with one Move action: Map idx -> { x, y, cost, path }.
export function reachable(state, p) {
  const res = new Map();
  const legs = partOf(p, 'legs');
  const mob = mobility(p);
  const other = opp(state, p);
  if (legs && legs.phase) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = dist(p.pos, { x, y });
      if (d === 0 || d > 3) continue;
      if (TERRAIN[tileAt(state, x, y).t].blocks || mechAt(state, x, y)) continue;
      res.set(idx(x, y), { x, y, cost: 1, path: [p.pos, { x, y }], phase: true });
    }
    return res;
  }
  const rough = legs && legs.rough;
  const hover = legs && legs.hover;
  const best = new Map([[idx(p.pos.x, p.pos.y), { x: p.pos.x, y: p.pos.y, cost: 0, path: [p.pos], stop: false }]]);
  const q = [best.get(idx(p.pos.x, p.pos.y))];
  while (q.length) {
    q.sort((a, b) => a.cost - b.cost);
    const c = q.shift();
    if (c.stop) continue;
    for (const [dx, dy] of DIRS4) {
      const x = c.x + dx, y = c.y + dy;
      if (!inBounds(x, y)) continue;
      const t = TERRAIN[tileAt(state, x, y).t];
      if (t.blocks || (other.pos.x === x && other.pos.y === y)) continue;
      const step = rough ? 1 : t.cost;
      const cost = c.cost + step;
      if (cost > mob) continue;
      const k = idx(x, y);
      if (best.has(k) && best.get(k).cost <= cost) continue;
      const n = { x, y, cost, path: [...c.path, { x, y }], stop: !!t.river && !hover };
      best.set(k, n);
      q.push(n);
    }
  }
  best.delete(idx(p.pos.x, p.pos.y));
  for (const [k, v] of best) res.set(k, v);
  return res;
}

// ---------------------------------------------------------------- damage

function damageTerrain(state, x, y, amount, by) {
  const tile = tileAt(state, x, y);
  if (!tile) return;
  const t = TERRAIN[tile.t];
  if (!t.hp || amount <= 0) return;
  tile.hp -= amount;
  if (tile.hp <= 0) {
    const was = tile.t;
    tile.t = t.becomes;
    tile.hp = TERRAIN[t.becomes].hp;
    ev(state, { type: 'terrain', x, y, from: was, to: tile.t, destroyed: true, p: by });
  } else ev(state, { type: 'terrain', x, y, from: tile.t, to: tile.t, destroyed: false, p: by, dmg: amount });
}

function destroyLimb(state, d, k) {
  const l = d.limbs[k];
  l.alive = false; l.hp = 0;
  if (l.part) d.discard.push(l.part.id);
  for (const m of l.mods) d.discard.push(m.id);
  l.part = null; l.mods = []; l.max = l.base;
}

function gainMeter(p, n) { p.meter = Math.min(RULES.meterMax, p.meter + n); }

// Apply a hit to a mech. opts: { precise, limb, direct, ignoreBrace, kind, noGuard }
// Returns a result object (also used by previewHit, which runs it on a copy).
function applyHit(state, attacker, d, amount, opts) {
  const res = { target: d.idx, amount, parts: [], core: 0, blocked: 0, braced: false, cover: false, kind: opts.kind || 'hit' };
  if (amount <= 0) return res;
  const tile = tileAt(state, d.pos.x, d.pos.y);
  if (opts.direct && (TERRAIN[tile.t].cover || d.status.smoke)) { amount = Math.max(1, amount - RULES.coverReduce); res.cover = true; }
  if (d.status.brace && !opts.ignoreBrace) { amount = Math.max(1, Math.ceil(amount * RULES.braceMult)); d.status.brace = false; res.braced = true; }
  if (!opts.noGuard && d.guard > 0) {
    const b = Math.min(RULES.guardBlock, amount);
    amount -= b; res.blocked = b; d.guard--;
  }
  const ga = globalArmor(d);
  if (amount > 0 && ga) amount = Math.max(1, amount - ga);
  if (amount <= 0) return res;

  const exposed = isExposed(d);
  const alive = LIMBS.filter((k) => d.limbs[k].alive);
  let total = 0;
  let spill = 0;
  const hitLimb = (k, n) => {
    const l = d.limbs[k];
    const dmg = Math.max(1, n - limbArmor(d, k));
    const before = l.hp;
    l.hp -= dmg; total += Math.min(dmg, before);
    const destroyed = l.hp <= 0;
    if (destroyed) { spill += -l.hp; destroyLimb(state, d, k); }
    res.parts.push({ limb: k, dmg: Math.min(dmg, before), destroyed });
    if (destroyed && attacker && attacker !== d) attacker.stats.broke++;
  };
  if (opts.kind === 'crash') {
    // Slamming into terrain or another mech jars the whole frame: straight to the Core.
    d.core -= amount; res.core = amount; total += amount;
  } else if (opts.precise) {
    let k = opts.limb;
    if (k === 'core' && !exposed) k = null;
    if (k && k !== 'core' && !d.limbs[k].alive) k = null;
    if (!k) k = exposed ? 'core' : alive.slice().sort((a, b) => d.limbs[a].hp - d.limbs[b].hp)[0];
    if (k === 'core') { d.core -= amount; res.core = amount; total += amount; }
    else hitLimb(k, amount);
  } else {
    const n = alive.length + (exposed ? 1 : 0);
    const share = Math.ceil(amount / Math.max(1, n));
    for (const k of alive) hitLimb(k, share);
    if (exposed) { d.core -= share; res.core = share; total += share; }
  }
  // Overkill on a destroyed limb spills into the Core.
  if (spill > 0) { d.core -= spill; res.core += spill; res.spill = spill; total += spill; }
  // Frame shock: any real hit on the limbs also jars the Core a little.
  if (opts.kind !== 'crash' && res.parts.length && RULES.shock) { d.core -= RULES.shock; res.core += RULES.shock; res.shock = RULES.shock; total += RULES.shock; }
  if (attacker && attacker !== d) { gainMeter(attacker, total * 4); attacker.stats.dealt += total; }
  gainMeter(d, total * 2);
  d.stats.taken += total;
  res.total = total;
  if (d.core <= 0) { d.core = 0; if (state.winner === null) { state.winner = 1 - d.idx; ev(state, { type: 'win', p: 1 - d.idx }); } }
  return res;
}

// Predicted result of hitting defender d with amount (no state change).
export function previewHit(state, attacker, d, amount, opts) {
  const s = cloneState(state);
  return applyHit(s, s.players[attacker.idx], s.players[d.idx], amount, opts);
}

// Push or pull. dir = [dx, dy] per step.
function forceMove(state, attacker, d, n, dir, kind) {
  const legs = partOf(d, 'legs');
  if (legs && legs.anchor) { ev(state, { type: 'anchored', p: d.idx }); return; }
  const resist = (tune(d).pushResist || 0) + (legs && legs.pushResist ? legs.pushResist : 0);
  n = Math.max(0, n - resist);
  const from = { ...d.pos };
  let crash = null;
  for (let i = 0; i < n; i++) {
    const x = d.pos.x + dir[0], y = d.pos.y + dir[1];
    const remaining = n - i;
    if (kind === 'pull' && x === attacker.pos.x && y === attacker.pos.y) break;
    if (!inBounds(x, y)) { crash = { what: 'edge', remaining }; break; }
    const t = TERRAIN[tileAt(state, x, y).t];
    const other = mechAt(state, x, y);
    if (t.blocks) { crash = { what: tileAt(state, x, y).t, remaining, x, y }; break; }
    if (other) { crash = { what: 'mech', remaining, other }; break; }
    d.pos = { x, y };
    if (t.river && !(legs && legs.hover)) { d.status.stuck = true; ev(state, { type: 'stuck', p: d.idx, x, y }); break; }
  }
  ev(state, { type: kind, p: attacker.idx, target: d.idx, from, to: { ...d.pos }, crash: crash ? crash.what : null });
  if (crash) {
    const bonus = attacker !== d ? crashBonusOf(attacker) : 0;
    let dmg = RULES.collision * crash.remaining + bonus;
    if (crash.what !== 'edge' && crash.what !== 'mech') {
      const t = TERRAIN[crash.what];
      dmg += t.crash || 0;
      damageTerrain(state, crash.x, crash.y, t.crashTake || 0, attacker.idx);
    }
    const r = applyHit(state, attacker, d, dmg, { kind: 'crash', noGuard: false });
    ev(state, { type: 'hit', p: attacker.idx, ...r, crash: crash.what, x: d.pos.x, y: d.pos.y });
    if (crash.what === 'mech' && crash.other) {
      const r2 = applyHit(state, attacker, crash.other, RULES.collision * crash.remaining, { kind: 'crash' });
      ev(state, { type: 'hit', p: attacker.idx, ...r2, crash: 'mech', x: crash.other.pos.x, y: crash.other.pos.y });
    }
    attacker.stats.crashes++;
    gainMeter(attacker, 15);
  }
}

// Resolve an attack (quick, or a heavy lock firing) on a set of cells.
function strike(state, p, a, cells, opts) {
  const precise = a.shape === 'single';
  const hits = [];
  for (const c of cells) {
    const m = mechAt(state, c.x, c.y);
    const t = tileAt(state, c.x, c.y);
    const terr = TERRAIN[t.t];
    if (a.wall) {
      if (!m && !terr.blocks && t.t !== 'river') { state.board.tiles[idx(c.x, c.y)] = { t: 'wall', hp: TERRAIN.wall.hp }; ev(state, { type: 'wall', p: p.idx, x: c.x, y: c.y }); }
      continue;
    }
    if (m) {
      if (opts.heavy && m.status.smoke) { ev(state, { type: 'smokeMiss', p: p.idx, target: m.idx, x: c.x, y: c.y }); continue; }
      const r = applyHit(state, p, m, opts.dmg, { precise, limb: opts.limb, direct: a.range === 'direct', ignoreBrace: opts.ignoreBrace, kind: opts.heavy ? 'heavy' : 'hit' });
      ev(state, { type: 'hit', p: p.idx, ...r, x: c.x, y: c.y, name: a.name, heavy: !!opts.heavy, from: { ...p.pos } });
      hits.push(m);
      if (state.winner !== null) return hits;
      if (m !== p) {
        if (a.lock) { m.status.locked = true; ev(state, { type: 'locked', p: m.idx }); }
        if (a.push || a.pull) {
          const dx = Math.sign(c.x - p.pos.x), dy = Math.sign(c.y - p.pos.y);
          if (a.push) forceMove(state, p, m, a.push, [dx, dy], 'push');
          else forceMove(state, p, m, a.pull, [-dx, -dy], 'pull');
        }
      }
    } else if (terr.hp > 0) {
      damageTerrain(state, c.x, c.y, Math.max(1, opts.dmg), p.idx);
    }
  }
  return hits;
}

// ---------------------------------------------------------------- turn flow

function startTurn(state) {
  const p = activePlayer(state);
  state.turn++;
  p.turnsTaken++;
  p.status.brace = false;
  p.status.smoke = false;
  p.status.noMove = p.status.locked || p.status.stuck;
  p.status.locked = false;
  p.status.stuck = false;
  p.flags = freshFlags();
  ev(state, { type: 'turn', p: p.idx, turn: state.turn });

  // Meltdown: late in the fight the arena overheats and every Core bleeds.
  if (state.turn > RULES.meltdownTurn) {
    p.core -= 1;
    ev(state, { type: 'meltdown', p: p.idx });
    if (p.core <= 0) { p.core = 0; state.winner = 1 - p.idx; ev(state, { type: 'win', p: 1 - p.idx }); return; }
  }

  // Heavy locks this player placed last turn fire now.
  const mine = state.telegraphs.filter((t) => t.owner === p.idx);
  state.telegraphs = state.telegraphs.filter((t) => t.owner !== p.idx);
  for (const tg of mine) {
    const a = tg.atk;
    const foe = opp(state, p);
    const wasTargeted = tg.cells.some((c) => c.x === foe.pos.x && c.y === foe.pos.y);
    ev(state, { type: 'fire', p: p.idx, cells: tg.cells, name: a.name });
    const hits = strike(state, p, a, tg.cells, { heavy: true, dmg: tg.dmg, limb: tg.limb, ignoreBrace: tg.ignoreBrace });
    if (!wasTargeted && tg.aimedAtFoe) { foe.stats.dodges++; gainMeter(foe, 20); ev(state, { type: 'dodge', p: foe.idx }); }
    if (state.winner !== null) return;
    void hits;
  }

  // Workshop: parts in progress tick down and land.
  for (const w of p.workshop) w.timer--;
  const landing = p.workshop.filter((w) => w.timer <= 0);
  p.workshop = p.workshop.filter((w) => w.timer > 0);
  for (const w of landing) installPart(state, p, w.target, w.id, w.mod, w.fire);

  p.energy = Math.min(p.turnsTaken + 1, energyOutput(p));
  if (p.turnsTaken === 1 && p.idx !== state.first) p.energy += RULES.secondEnergy;
  if (p.cells > 0) { p.energy += 1; p.cells--; }
  p.ap = apMax(p);
  if (state.turn === 1) p.ap = Math.min(p.ap, RULES.firstAP);
  if (state.turn > 1) draw(state, p);
}

function partQuality(p) {
  const d = DOCTRINES[p.doctrine];
  return { mod: d.mod, fire: d.focus === 'fire', armor: d.focus === 'armor' };
}

function installPart(state, p, k, id, mod, fire) {
  const c = CARDS[id];
  const l = p.limbs[k];
  if (l.part) p.discard.push(l.part.id);
  if (!l.alive) { for (const m of l.mods) p.discard.push(m.id); l.mods = []; }
  const doc = DOCTRINES[p.doctrine];
  let hp = c.hp + (tune(p).limbBonus || 0) + 2 * (mod || 0) + (doc.focus === 'armor' ? 3 : 0) + (pilotOn(p, 'gus') ? 2 : 0);
  for (const m of l.mods) hp += CARDS[m.id].hp || 0;
  l.alive = true;
  l.part = { id, mod: mod || 0, fire: !!fire };
  l.max = Math.max(3, hp);
  l.hp = l.max;
  p.stats.installs++;
  ev(state, { type: 'built', p: p.idx, id, target: k });
}

function attachMod(p, k, id) {
  const l = p.limbs[k];
  const c = CARDS[id];
  l.mods.push({ id });
  l.max += c.hp || 0;
  l.hp += c.hp || 0;
}

// ---------------------------------------------------------------- actions
// { t:'end' } | { t:'move', x, y } | { t:'attack', limb, x, y, part? } | { t:'prep', kind }
// { t:'workshop' } | { t:'install', id, target? } | { t:'overdrive' } | { t:'special' }

export function partSlots(p, id) {
  const c = CARDS[id];
  if (c.type === 'part') return c.slot === 'arm' ? ['armL', 'armR'] : [c.slot];
  if (c.type === 'mod') return c.slots.filter((k) => p.limbs[k].alive && p.limbs[k].mods.length < 2);
  return [];
}

export function installTargets(state, p, id) {
  const c = CARDS[id];
  if (c.type === 'part') return partSlots(p, id).filter((k) => !p.workshop.some((w) => w.target === k));
  if (c.type === 'mod') return partSlots(p, id);
  if (c.target === 'limb') return LIMBS.filter((k) => p.limbs[k].alive && p.limbs[k].hp < p.limbs[k].max);
  if (c.target === 'deadLimb') return LIMBS.filter((k) => !p.limbs[k].alive && !p.workshop.some((w) => w.target === k));
  if (c.target === 'tile') {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (dist(p.pos, { x, y }) <= c.range && TERRAIN[tileAt(state, x, y).t].hp > 0) out.push(`${x},${y}`);
    }
    return out;
  }
  return [null];
}

export function canInstall(state, p, id) {
  const c = CARDS[id];
  if (!p.flags.workshop) return false;
  if (cardCost(p, id) > p.energy) return false;
  if (p.mods.norepair && ['repair', 'rebuild', 'core'].includes(c.effect)) return false;
  if (c.type === 'part' && p.workshop.length >= 3) return false;
  if (c.effect === 'rush' && !p.workshop.length) return false;
  if (c.effect === 'guard' && p.guard >= RULES.guardMax) return false;
  if (c.effect === 'lockFoe' && dist(p.pos, opp(state, p).pos) > c.range) return false;
  if (c.effect === 'core' && p.core >= RULES.coreMax) return false;
  return installTargets(state, p, id).length > 0;
}

function canAttackWith(state, p, k) {
  if (p.ap <= 0 || p.flags.attacked[k]) return null;
  const a = attackOf(state, p, k);
  if (!a) return null;
  if ((a.energy || 0) > p.energy) return null;
  if (a.heavy && state.telegraphs.some((t) => t.owner === p.idx && t.limb0 === k)) return null;
  return a;
}

export function canMove(state, p) {
  return p.ap > 0 && !p.status.noMove;
}

export function legalActions(state, { lean = false } = {}) {
  if (state.winner !== null) return [];
  const p = activePlayer(state);
  const foe = opp(state, p);
  const acts = [{ t: 'end' }];
  if (!p.flags.overdrive && p.core > overdriveCost(p)) acts.push({ t: 'overdrive' });
  if (!p.flags.special && p.meter >= RULES.meterMax) acts.push({ t: 'special' });
  if (p.ap > 0) {
    if (canMove(state, p)) for (const v of reachable(state, p).values()) acts.push({ t: 'move', x: v.x, y: v.y });
    if (!p.status.brace) acts.push({ t: 'prep', kind: 'brace' });
    if (!p.status.charge) acts.push({ t: 'prep', kind: 'charge' });
    if (!p.flags.workshop && p.hand.length) acts.push({ t: 'workshop' });
    for (const k of LIMBS) {
      const a = canAttackWith(state, p, k);
      if (!a) continue;
      for (const c of attackTargets(state, p, a)) {
        if (lean && !a.wall) {
          // AI pruning: only aim at the enemy, tiles next to it, or terrain worth breaking.
          const near = cheb(c, foe.pos) <= (a.heavy ? 1 : 0) || (a.shape !== 'single' && cheb(c, foe.pos) <= 1);
          const terr = TERRAIN[tileAt(state, c.x, c.y).t];
          if (!near && !(terr.blocks && cheb(c, foe.pos) <= 1)) continue;
        }
        if (lean && a.wall && cheb(c, p.pos) > 1 && cheb(c, foe.pos) > 1) continue;
        const m = mechAt(state, c.x, c.y);
        if (m === foe && a.shape === 'single' && !a.wall) {
          const opts = LIMBS.filter((q) => foe.limbs[q].alive);
          if (isExposed(foe)) opts.push('core');
          for (const part of opts) acts.push({ t: 'attack', limb: k, x: c.x, y: c.y, part });
        } else if (m === p && !a.heavy) {
          continue;
        } else acts.push({ t: 'attack', limb: k, x: c.x, y: c.y });
      }
    }
  }
  if (p.flags.workshop) {
    const seen = new Set();
    for (const id of p.hand) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (!canInstall(state, p, id)) continue;
      for (const target of installTargets(state, p, id)) acts.push({ t: 'install', id, target });
    }
  }
  return acts;
}

export function sameAction(a, b) {
  return a.t === b.t && a.x === b.x && a.y === b.y && a.limb === b.limb && a.part === b.part &&
    a.kind === b.kind && a.id === b.id && (a.target ?? null) === (b.target ?? null);
}

export function isLegal(state, a) {
  return legalActions(state).some((b) => sameAction(a, b));
}

export function applyAction(state, a) {
  const p = activePlayer(state);
  const foe = opp(state, p);
  switch (a.t) {
    case 'end': {
      ev(state, { type: 'end', p: p.idx });
      state.active = 1 - state.active;
      if (state.turn >= RULES.turnLimit) {
        const w = p.core === foe.core ? state.first : (p.core > foe.core ? p.idx : foe.idx);
        state.winner = w;
        ev(state, { type: 'win', p: w, timeout: true });
        return state;
      }
      startTurn(state);
      break;
    }
    case 'move': {
      const r = reachable(state, p).get(idx(a.x, a.y));
      p.ap--; p.flags.moves++;
      const from = { ...p.pos };
      p.pos = { x: a.x, y: a.y };
      ev(state, { type: 'move', p: p.idx, from, to: { ...p.pos }, path: r ? r.path : [from, p.pos], phase: r && r.phase });
      break;
    }
    case 'prep':
      p.ap--;
      if (a.kind === 'brace') p.status.brace = true; else p.status.charge = true;
      ev(state, { type: 'prep', p: p.idx, kind: a.kind });
      break;
    case 'workshop':
      p.ap--;
      p.flags.workshop = true;
      ev(state, { type: 'workshop', p: p.idx });
      break;
    case 'install':
      install(state, p, a);
      break;
    case 'overdrive': {
      const cost = overdriveCost(p);
      p.core -= cost; p.energy += RULES.overdriveEnergy; p.flags.overdrive = true;
      ev(state, { type: 'overdrive', p: p.idx, cost });
      break;
    }
    case 'special':
      special(state, p);
      break;
    case 'attack':
      attack(state, p, a);
      break;
  }
  return state;
}

function attack(state, p, act) {
  const a = attackOf(state, p, act.limb);
  p.ap--;
  p.flags.attacked[act.limb] = true;
  p.energy -= a.energy || 0;
  let dmg = a.dmg;
  if (dmg > 0) {
    dmg += p.flags.bonusNext;
    if (pilotOn(p, 'kai') && !p.flags.firstAttack) dmg += 1;
    if (p.status.charge) dmg = Math.round(dmg * RULES.chargeMult);
  }
  const ignoreBrace = a.ignoreBrace || p.flags.ignoreBraceNext;
  if (dmg > 0) { p.flags.bonusNext = 0; p.flags.ignoreBraceNext = false; p.status.charge = false; }
  p.flags.firstAttack = true;
  const cells = cellsFor(state, p, a, act.x, act.y);
  if (a.heavy) {
    const foe = opp(state, p);
    state.telegraphs.push({ id: state.nextTg++, owner: p.idx, cells, atk: a, dmg, limb: act.part || null, limb0: act.limb, ignoreBrace,
      aimedAtFoe: cells.some((c) => c.x === foe.pos.x && c.y === foe.pos.y) });
    ev(state, { type: 'lock', p: p.idx, cells, name: a.name, limb: act.limb, dmg });
    return;
  }
  ev(state, { type: 'shot', p: p.idx, from: { ...p.pos }, to: { x: act.x, y: act.y }, range: a.range, name: a.name, limb: act.limb });
  strike(state, p, a, cells, { dmg, limb: act.part, ignoreBrace });
}

function install(state, p, a) {
  const c = CARDS[a.id];
  p.energy -= cardCost(p, a.id);
  p.flags.firstInstall = true;
  p.hand.splice(p.hand.indexOf(a.id), 1);
  if (c.type === 'part') {
    const doc = DOCTRINES[p.doctrine];
    const q = partQuality(p);
    if (doc.time <= 0) installPart(state, p, a.target, a.id, q.mod, q.fire);
    else {
      p.workshop.push({ id: a.id, target: a.target, timer: doc.time, total: doc.time, mod: q.mod, fire: q.fire });
      ev(state, { type: 'queued', p: p.idx, id: a.id, target: a.target, time: doc.time });
    }
    return;
  }
  if (c.type === 'mod') {
    attachMod(p, a.target, a.id);
    ev(state, { type: 'modded', p: p.idx, id: a.id, target: a.target });
    return;
  }
  p.discard.push(a.id);
  const foe = opp(state, p);
  switch (c.effect) {
    case 'repair': { const l = p.limbs[a.target]; l.hp = Math.min(l.max, l.hp + c.amount); break; }
    case 'rebuild': { const l = p.limbs[a.target]; l.alive = true; l.part = null; l.mods = []; l.max = l.base; l.hp = l.base; break; }
    case 'core': p.core = Math.min(RULES.coreMax, p.core + c.amount); break;
    case 'guard': p.guard = Math.min(RULES.guardMax, p.guard + c.amount); break;
    case 'cell': p.cells += c.amount; break;
    case 'draw': for (let i = 0; i < c.amount; i++) draw(state, p); break;
    case 'rush': {
      const all = p.workshop; p.workshop = [];
      for (const w of all) installPart(state, p, w.target, w.id, w.mod, w.fire);
      break;
    }
    case 'ap': p.ap += c.amount; break;
    case 'demolish': {
      const [x, y] = a.target.split(',').map(Number);
      damageTerrain(state, x, y, c.amount, p.idx);
      const m = mechAt(state, x, y);
      if (m) { const r = applyHit(state, p, m, 2, { kind: 'hit' }); ev(state, { type: 'hit', p: p.idx, ...r, x, y }); }
      break;
    }
    case 'lockFoe': foe.status.locked = true; ev(state, { type: 'locked', p: foe.idx }); break;
    case 'smoke': p.status.smoke = true; break;
  }
  ev(state, { type: 'tactic', p: p.idx, id: a.id, target: a.target });
}

function special(state, p) {
  p.meter = 0;
  p.flags.special = true;
  switch (p.pilot) {
    case 'redline': p.ap += 1; p.flags.bonusNext += 3; break;
    case 'okafor': p.ap += 1; draw(state, p); draw(state, p); break;
    case 'gus': {
      for (const k of LIMBS) { const l = p.limbs[k]; if (l.alive) l.hp = Math.min(l.max, l.hp + 4); }
      const dead = ['legs', 'armL', 'armR', 'head'].find((k) => !p.limbs[k].alive);
      if (dead) { const l = p.limbs[dead]; l.alive = true; l.part = null; l.mods = []; l.max = l.base; l.hp = l.base; }
      break;
    }
    case 'kai': p.flags.bonusNext += 6; p.flags.ignoreBraceNext = true; break;
  }
  ev(state, { type: 'special', p: p.idx, pilot: p.pilot });
}

// ---------------------------------------------------------------- cloning & hidden info

export function cloneState(s) {
  return {
    rng: s.rng, turn: s.turn, active: s.active, first: s.first, winner: s.winner, quiet: true, log: [],
    board: { tiles: s.board.tiles.map((t) => ({ t: t.t, hp: t.hp })), theme: s.board.theme, fog: s.board.fog, starts: s.board.starts },
    telegraphs: s.telegraphs.map((t) => ({ ...t, cells: t.cells.map((c) => ({ ...c })) })),
    nextTg: s.nextTg,
    players: s.players.map(clonePlayer),
  };
}

function clonePlayer(p) {
  const limbs = {};
  for (const k of LIMBS) {
    const l = p.limbs[k];
    limbs[k] = { hp: l.hp, max: l.max, base: l.base, alive: l.alive, part: l.part && { ...l.part }, mods: l.mods.map((m) => ({ ...m })) };
  }
  return {
    idx: p.idx, frame: p.frame, pilot: p.pilot, doctrine: p.doctrine, mods: p.mods,
    core: p.core, energy: p.energy, ap: p.ap, pos: { ...p.pos }, limbs,
    hand: p.hand.slice(), deck: p.deck.slice(), list: p.list, discard: p.discard.slice(),
    workshop: p.workshop.map((w) => ({ ...w })), guard: p.guard, cells: p.cells, meter: p.meter, turnsTaken: p.turnsTaken,
    status: { ...p.status }, flags: { ...p.flags, attacked: { ...p.flags.attacked } }, stats: { ...p.stats },
  };
}

// A plausible version of the state as `viewer` sees it: the opponent's hand, deck order and
// Workshop contents are re-sampled from what they could be. The viewer's own deck order is shuffled too.
export function determinize(state, viewerIdx, rngHolder) {
  const s = cloneState(state);
  const me = s.players[viewerIdx];
  const o = s.players[1 - viewerIdx];
  shuffle(rngHolder, me.deck);
  const pool = o.list.slice();
  const remove = (id) => { const i = pool.indexOf(id); if (i >= 0) pool.splice(i, 1); };
  for (const k of LIMBS) {
    const l = o.limbs[k];
    if (l.part) remove(l.part.id);
    for (const m of l.mods) remove(m.id);
  }
  for (const id of o.discard) remove(id);
  shuffle(rngHolder, pool);
  for (const w of o.workshop) {
    let i = pool.findIndex((id) => CARDS[id].type === 'part');
    if (i < 0) { w.timer = 99; continue; }
    const id = pool.splice(i, 1)[0];
    w.id = id;
    const slots = partSlots(o, id);
    w.target = slots[randInt(rngHolder, slots.length)];
  }
  const h = o.hand.length;
  o.hand = pool.splice(0, h);
  o.deck = pool;
  return s;
}

export { nextRand };

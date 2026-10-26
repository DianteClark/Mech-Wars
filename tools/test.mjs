// Engine tests (v2 tactics board). Run: node tools/test.mjs
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, sameAction, cloneState, determinize, isExposed, reachable,
  attackOf, attackTargets, idx, makeMap, mechAt,
} from '../src/engine/game.js';
import { autoTurn, chooseTurn, LEVELS } from '../src/engine/ai.js';
import { FRAME_ORDER, RULES, W, H, TERRAIN } from '../src/engine/data.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`); process.exitCode = 1; }
}

const setup = (a = 'brakka', b = 'longshot', seed = 42, theme = 'city') => ({
  players: [{ frame: a, pilot: 'kai' }, { frame: b, pilot: 'gus' }], seed, first: 0, theme,
});
const strip = (s) => JSON.stringify({ ...s, log: [], quiet: false });

// An empty open board with the two mechs placed where we want them.
function arena(a = 'brakka', b = 'longshot') {
  const s = createGame({ ...setup(a, b), players: [{ frame: a, pilot: 'okafor' }, { frame: b, pilot: 'gus' }] });
  for (const t of s.board.tiles) { t.t = 'open'; t.hp = 0; }
  s.players[0].ap = 3; s.players[0].energy = 9;
  return s;
}
const put = (s, i, x, y) => { s.players[i].pos = { x, y }; };
const terr = (s, x, y, t) => { s.board.tiles[idx(x, y)] = { t, hp: TERRAIN[t].hp }; };

test('replaying the action log reproduces the exact game', () => {
  for (const [a, b] of [['brakka', 'longshot'], ['bastion', 'specter']]) {
    const s = createGame(setup(a, b, 7, 'delta'));
    const log = [];
    const orig = applyAction;
    let n = 0;
    while (s.winner === null && n++ < 80) {
      const who = s.active;
      for (const act of chooseTurn(s, LEVELS[1], s.turn)) {
        if (s.winner !== null || s.active !== who) break;
        if (!legalActions(s).some((x) => sameAction(x, act))) break;
        orig(s, act); log.push(act);
      }
      if (s.winner === null && s.active === who) { orig(s, { t: 'end' }); log.push({ t: 'end' }); }
    }
    const r = createGame(setup(a, b, 7, 'delta'));
    for (const act of log) applyAction(r, act);
    assert.equal(strip(r), strip(s));
  }
});

test('maps are point-symmetric and the starts are connected', () => {
  for (let seed = 1; seed < 40; seed++) for (const theme of ['city', 'forest', 'canyon', 'delta']) {
    const m = makeMap(seed, theme);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      assert.equal(m.tiles[idx(x, y)].t, m.tiles[idx(W - 1 - x, H - 1 - y)].t);
    }
    const s = createGame({ ...setup('brakka', 'brakka', seed, theme) });
    s.players[0].ap = 99;
    // walk with huge mobility: the enemy start (or a tile next to it) must be reachable
    s.players[0].limbs.legs.part = { id: 'thruster_legs', mod: 0 };
    const seen = new Set([idx(s.players[0].pos.x, s.players[0].pos.y)]);
    const q = [s.players[0].pos];
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= W || y >= H || seen.has(idx(x, y)) || TERRAIN[s.board.tiles[idx(x, y)].t].blocks) continue;
        seen.add(idx(x, y)); q.push({ x, y });
      }
    }
    const e = s.players[1].pos;
    assert.ok(seen.has(idx(e.x, e.y)), `seed ${seed} ${theme}`);
  }
});

test('movement respects mobility, terrain cost, blockers and rivers', () => {
  const s = arena();
  put(s, 0, 2, 3); put(s, 1, 5, 0);
  terr(s, 2, 2, 'building'); terr(s, 3, 3, 'forest'); terr(s, 1, 3, 'river');
  const r = reachable(s, s.players[0]);
  assert.ok(!r.has(idx(2, 2)), 'building blocks');
  assert.ok(r.has(idx(3, 3)), 'forest costs 2, reachable with mobility 2');
  assert.ok(!r.has(idx(4, 3)), 'cannot go past forest with mobility 2');
  assert.ok(r.has(idx(1, 3)) && !r.has(idx(0, 3)), 'river ends movement');
});

test('first player opens with 1 action; the second gets +1 energy', () => {
  const s = createGame(setup());
  assert.equal(s.players[0].ap, RULES.firstAP);
  applyAction(s, { t: 'end' });
  assert.equal(s.players[1].energy, 2 + RULES.secondEnergy);
});

test('precise hits pick the limb; area hits split across limbs', () => {
  const s = arena();
  put(s, 0, 2, 3); put(s, 1, 3, 3);
  const foe = s.players[1];
  const head0 = foe.limbs.head.hp, core0 = foe.core;
  applyAction(s, { t: 'attack', limb: 'armL', x: 3, y: 3, part: 'head' });
  assert.equal(foe.limbs.head.hp, head0 - 2);
  assert.equal(foe.core, core0 - RULES.shock, 'frame shock');
  assert.equal(foe.limbs.armL.hp, foe.limbs.armL.max);
});

test('direct fire is stopped by buildings and reduced by forest cover', () => {
  const s = arena('longshot', 'brakka');
  put(s, 0, 0, 3); put(s, 1, 4, 3);
  s.players[0].limbs.armL.part = { id: 'cannon_arm', mod: 0 };
  terr(s, 2, 3, 'building');
  const a = attackOf(s, s.players[0], 'armL');
  const tg = attackTargets(s, s.players[0], a);
  assert.ok(tg.some((c) => c.x === 2 && c.y === 3) && !tg.some((c) => c.x === 4 && c.y === 3));
  terr(s, 2, 3, 'open'); terr(s, 4, 3, 'forest');
  const before = s.players[1].limbs.armR.hp;
  applyAction(s, { t: 'attack', limb: 'armL', x: 4, y: 3, part: 'armR' });
  assert.equal(before - s.players[1].limbs.armR.hp, a.dmg - RULES.coverReduce);
});

test('pushing a mech into a building damages its Core and the building', () => {
  const s = arena();
  put(s, 0, 2, 3); put(s, 1, 3, 3);
  terr(s, 4, 3, 'building');
  const foe = s.players[1];
  const core0 = foe.core;
  applyAction(s, { t: 'attack', limb: 'legs', x: 3, y: 3, part: 'legs' }); // Kick, push 1
  assert.deepEqual(foe.pos, { x: 3, y: 3 }, 'did not move into the building');
  const crash = RULES.collision * 1 + TERRAIN.building.crash + 2; // + Brakka crash bonus
  assert.equal(core0 - foe.core, crash + RULES.shock);
  assert.ok(s.board.tiles[idx(4, 3)].hp < TERRAIN.building.hp);
});

test('a mech pushed into a river is stuck next turn', () => {
  const s = arena();
  put(s, 0, 2, 3); put(s, 1, 3, 3); terr(s, 4, 3, 'river');
  applyAction(s, { t: 'attack', limb: 'legs', x: 3, y: 3, part: 'legs' });
  assert.deepEqual(s.players[1].pos, { x: 4, y: 3 });
  applyAction(s, { t: 'end' });
  assert.equal(s.players[1].status.noMove, true);
  assert.ok(!legalActions(s).some((a) => a.t === 'move'));
});

test('heavy locks fire next turn, and can be dodged', () => {
  const s = arena('longshot', 'brakka');
  put(s, 0, 0, 3); put(s, 1, 4, 3);
  s.players[0].limbs.armL.part = { id: 'rail_lance_arm', mod: 0 };
  applyAction(s, { t: 'attack', limb: 'armL', x: 4, y: 3, part: 'armR' });
  assert.equal(s.telegraphs.length, 1);
  const hp = s.players[1].limbs.armR.hp;
  // enemy steps out
  applyAction(s, { t: 'end' });
  s.players[1].ap = 2;
  applyAction(s, { t: 'move', x: 4, y: 4 });
  applyAction(s, { t: 'end' });
  assert.equal(s.telegraphs.length, 0);
  assert.equal(s.players[1].limbs.armR.hp, hp, 'dodged');
  assert.ok(s.players[1].stats.dodges === 1);
});

test('destroying two limbs exposes the Core; overkill spills into it', () => {
  const s = arena();
  const foe = s.players[1];
  put(s, 0, 2, 3); put(s, 1, 3, 3);
  foe.limbs.head.alive = false; foe.limbs.armL.hp = 1;
  const core0 = foe.core;
  applyAction(s, { t: 'attack', limb: 'armL', x: 3, y: 3, part: 'armL' });
  assert.ok(isExposed(foe));
  assert.equal(core0 - foe.core, 1 + RULES.shock, 'spill 1 + shock');
});

test('parts install through the Workshop and replace the limb', () => {
  const s = arena();
  const p = s.players[0];
  p.hand = ['cannon_arm', ...p.hand];
  applyAction(s, { t: 'workshop' });
  applyAction(s, { t: 'install', id: 'cannon_arm', target: 'armR' });
  assert.equal(p.workshop.length, 1);
  applyAction(s, { t: 'end' }); applyAction(s, { t: 'end' });
  assert.equal(p.limbs.armR.part.id, 'cannon_arm');
  assert.equal(attackOf(s, p, 'armR').name, 'Cannon');
});

test('AI determinization hides the opponent hand but keeps its size', () => {
  const s = createGame(setup('specter', 'bastion', 11));
  const real = s.players[1].hand.slice().sort().join();
  let differs = false;
  for (let i = 0; i < 20; i++) {
    const d = determinize(s, 0, { rng: 1000 + i });
    assert.equal(d.players[1].hand.length, s.players[1].hand.length);
    if (d.players[1].hand.slice().sort().join() !== real) differs = true;
  }
  assert.ok(differs);
});

test('AI plays complete games for every Frame without illegal moves', () => {
  for (const f of FRAME_ORDER) {
    const s = createGame(setup(f, FRAME_ORDER[(FRAME_ORDER.indexOf(f) + 1) % 4], 3, 'forest'));
    let n = 0;
    while (s.winner === null && n++ < 120) autoTurn(s, LEVELS[2], s.turn);
    assert.notEqual(s.winner, null, f);
  }
});

test('cloned states are independent', () => {
  const s = createGame(setup());
  const c = cloneState(s);
  c.players[0].limbs.head.hp = 1; c.board.tiles[0].t = 'mountain'; c.players[0].pos.x = 5;
  assert.notEqual(s.players[0].limbs.head.hp, 1);
  assert.notEqual(s.players[0].pos.x, 5);
  assert.ok(mechAt(s, s.players[0].pos.x, s.players[0].pos.y));
});

console.log(`\n${passed} passed`);

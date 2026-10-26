// Engine tests. Run: node tools/test.mjs
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, sameAction, cloneState, determinize, isExposed, attackProfile, previewHit,
} from '../src/engine/game.js';
import { chooseTurn, LEVELS } from '../src/engine/ai.js';
import { FRAME_ORDER, RULES } from '../src/engine/data.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
}

const setup = (a = 'brakka', b = 'longshot', seed = 42) => ({
  players: [{ frame: a, pilot: 'kai' }, { frame: b, pilot: 'gus' }], seed, first: 0,
});

function playOut(cfg, lv = LEVELS[1]) {
  const s = createGame(cfg);
  const log = [];
  let n = 0;
  while (s.winner === null && n++ < 300) {
    const who = s.active;
    for (const a of chooseTurn(s, lv, 99 + s.turn)) {
      if (s.winner !== null || s.active !== who) break;
      if (!legalActions(s).some((b) => sameAction(a, b))) break;
      applyAction(s, a); log.push(a);
    }
    if (s.winner === null && s.active === who) { const e = { t: 'end' }; applyAction(s, e); log.push(e); }
  }
  return { s, log };
}

const strip = (s) => JSON.stringify({ ...s, log: [], quiet: false });

test('replaying the action log reproduces the exact game', () => {
  for (const [a, b] of [['brakka', 'longshot'], ['bastion', 'specter'], ['specter', 'brakka']]) {
    const { s, log } = playOut(setup(a, b, 7));
    const r = createGame(setup(a, b, 7));
    for (const x of log) applyAction(r, x);
    assert.equal(strip(r), strip(s));
    assert.notEqual(s.winner, null);
  }
});

test('first player opens with one action and no draw; second gets +1 energy', () => {
  const s = createGame(setup());
  const p0 = s.players[0];
  assert.equal(p0.ap, 1);
  assert.equal(p0.hand.length, RULES.startHand);
  assert.equal(p0.energy, 2);
  applyAction(s, { t: 'end' });
  const p1 = s.players[1];
  assert.equal(p1.energy, 2 + RULES.secondEnergy);
  assert.equal(p1.hand.length, RULES.startHand + 1);
});

test('a 2-turn build lands at the start of the owner’s second turn after queuing', () => {
  const s = createGame(setup());
  const p = s.players[0];
  p.hand = ['scrap_plating', ...p.hand];
  applyAction(s, { t: 'play', id: 'scrap_plating', target: 'legs' });
  assert.equal(p.workshop[0].timer, 2);
  applyAction(s, { t: 'end' }); applyAction(s, { t: 'end' }); // P1 turn, back to P0
  assert.equal(p.workshop.length, 1);
  applyAction(s, { t: 'end' }); applyAction(s, { t: 'end' });
  assert.equal(p.workshop.length, 0);
  assert.equal(p.limbs.legs.plating.id, 'scrap_plating');
  assert.equal(p.limbs.legs.max, 8 + 3);
});

test('the Core is shielded until two limbs are down', () => {
  const s = createGame(setup());
  const foe = s.players[1];
  const hasCore = () => legalActions(s).some((a) => a.t === 'attack' && a.target === 'core');
  assert.equal(hasCore(), false);
  foe.limbs.head.alive = false;
  assert.equal(hasCore(), false);
  foe.limbs.armL.alive = false;
  assert.equal(isExposed(foe), true);
  assert.equal(hasCore(), true);
});

test('destroying a limb drops what was mounted on it', () => {
  const s = createGame(setup());
  const foe = s.players[1];
  foe.limbs.armR.mount = { id: 'pulse_rifle', mod: 0 };
  foe.limbs.armR.hp = 1;
  applyAction(s, { t: 'attack', limb: 'armL', mode: 'punch', target: 'armR' });
  assert.equal(foe.limbs.armR.alive, false);
  assert.equal(foe.limbs.armR.mount, null);
  assert.ok(foe.discard.includes('pulse_rifle'));
});

test('Guard drones block a hit; Snipe goes through', () => {
  const s = createGame(setup());
  const me = s.players[0], foe = s.players[1];
  foe.guard = 1;
  const prof = { dmg: 3, pierce: 0, snipe: false, shred: false };
  assert.equal(previewHit(me, foe, 'head', prof).limb, 0);
  assert.equal(previewHit(me, foe, 'head', { ...prof, dmg: 5 }).limb, 2); // blocks 3 of 5
  assert.equal(previewHit(me, foe, 'head', { ...prof, snipe: true }).limb, 3);
});

test('Pierce reaches a shielded Core', () => {
  const s = createGame(setup());
  const me = s.players[0], foe = s.players[1];
  const r = previewHit(me, foe, 'head', { dmg: 6, pierce: 2, snipe: false, shred: false });
  assert.equal(r.core, 2);
  assert.equal(r.limb, 4);
});

test('AI determinization hides the opponent hand but keeps its size', () => {
  const s = createGame(setup('specter', 'bastion', 11));
  const real = s.players[1].hand.slice().sort().join();
  let differs = false;
  for (let i = 0; i < 20; i++) {
    const d = determinize(s, 0, { rng: 1000 + i });
    assert.equal(d.players[1].hand.length, s.players[1].hand.length);
    assert.equal(d.players[1].hand.length + d.players[1].deck.length, s.players[1].hand.length + s.players[1].deck.length);
    if (d.players[1].hand.slice().sort().join() !== real) differs = true;
  }
  assert.ok(differs, 'samples should vary');
});

test('AI never plans an illegal first action', () => {
  for (const f of FRAME_ORDER) {
    const s = createGame(setup(f, 'bastion', 5));
    for (let i = 0; i < 6 && s.winner === null; i++) {
      const plan = chooseTurn(s, LEVELS[2], i);
      assert.ok(legalActions(s).some((b) => sameAction(plan[0], b)), `${f}: ${JSON.stringify(plan[0])}`);
      for (const a of plan) { if (!legalActions(s).some((b) => sameAction(a, b))) break; applyAction(s, a); if (s.winner !== null) break; }
    }
  }
});

test('cloned states are independent', () => {
  const s = createGame(setup());
  const c = cloneState(s);
  c.players[0].limbs.head.hp = 1;
  c.players[0].hand.pop();
  assert.notEqual(s.players[0].limbs.head.hp, 1);
  assert.equal(s.players[0].hand.length, RULES.startHand);
});

console.log(`\n${passed} passed`);

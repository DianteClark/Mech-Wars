// Mech Wars — app shell: screens, battle UI, Tower flow.
import {
  CARDS, FRAMES, FRAME_ORDER, PILOTS, PILOT_ORDER, DOCTRINES, DOCTRINE_ORDER, TWISTS, LIMBS, LIMB_NAMES,
  RULES, UNLOCK_COST,
} from '../engine/data.js';
import {
  createGame, applyAction, legalActions, isLegal, attackModes, attackProfile, previewHit, fireCost,
  canPlay, playTargets, cardCost, buildPlan, energyOutput, overdriveCost, slotCount, isExposed,
  hasOracle, apMax, statVal, destroyedCount,
} from '../engine/game.js';
import { chooseTurn, LEVELS } from '../engine/ai.js';
import { mechSVG, iconSVG, cardIcon, cardSticker, logoSVG, limbGlyph, TYPE_COLORS, TYPE_NAMES, INK } from './art.js';
import { load, save, update, resetAll } from './store.js';
import { newRun, startBattle, twistFor, enemyFor, aiLevel, reward, isBoss } from './tower.js';

const VERSION = '0.6';
const app = document.getElementById('app');
const fx = document.getElementById('fx');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));
const systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const settings = () => load().settings;
const speed = () => (settings().speed === 'fast' ? 0.5 : 1);
const calm = () => settings().motion === 'reduce' || (settings().motion === 'system' && systemReduced);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// iOS: block pinch-zoom gestures that slip past the viewport meta.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

const LEVEL_NAMES = ['Rookie', 'Trained', 'Veteran', 'Ace', 'Relentless'];

const KEYWORDS = {
  snipe: ['Snipe', 'Ignores Guard drones.'],
  pierce: ['Pierce', 'Some damage goes straight to the Core, even while it’s shielded.'],
  shred: ['Shred', '+2 damage to limbs, 2 less to the Core.'],
  armor: ['Armor', 'Reduces every hit on that limb (each hit still does at least 1).'],
  guard: ['Guard drones', 'Each drone blocks 3 damage from one hit, then pops.'],
};

const ui = {
  screen: 'title',
  sheet: null,
  mode: 'idle', // idle | pickmode | target
  sel: null,
  busy: false,
  ticker: '',
  tickerSide: '',
  pick: { frame: 'brakka', pilot: 'redline', doctrine: 'standard' },
  setupMode: 'ranked',
  boardTab: 'all',
  result: null,
  tipHidden: null,
};

let G = null;   // live game state
let logSeen = 0;

// ---------------------------------------------------------------- small art bits

const GEAR = `<svg class="gear" viewBox="0 0 24 24"><path d="M12 2l2 3 3.5-.8.6 3.5 3.2 1.6-1.6 3.2 1.6 3.2-3.2 1.6-.6 3.5L14 19l-2 3-2-3-3.5.8-.6-3.5L2.7 14.7l1.6-3.2-1.6-3.2 3.2-1.6.6-3.5L10 5z" fill="#FFC929" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.8"/></svg>`;
const BOLT = (off = false, cls = 'pip') => `<svg class="${cls} ${off ? 'off' : ''}" viewBox="0 0 15 20"><path d="M9 1L2 11h5l-2 8 8-11H8l1-7z" fill="#FFC929" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const FISTPIP = (off = false) => `<svg class="pip ${off ? 'off' : ''}" viewBox="0 0 18 18"><rect x="2.5" y="4" width="13" height="10" rx="3.5" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M6.5 4v6M9.5 4v6M12.5 4v6" stroke="${INK}" stroke-width="1.5"/></svg>`;
const SHIELD = `<svg class="arm" viewBox="0 0 12 12"><path d="M1.5 1.5h9v4.5Q10.5 10 6 11.2 1.5 10 1.5 6z" fill="#8FA3D9" stroke="${INK}" stroke-width="1.5"/></svg>`;
const LOCK = `<svg class="lk" viewBox="0 0 14 14"><rect x="2.5" y="6" width="9" height="7" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="#fff" stroke-width="1.8"/></svg>`;
const CLOCK = `<svg class="ck" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M6 3.6V6.2L7.6 7.2" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
const COG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.6 2.4 2.8-.6.5 2.8 2.6 1.3-1.3 2.6 1.3 2.6-2.6 1.3-.5 2.8-2.8-.6L12 21.5l-1.6-2.4-2.8.6-.5-2.8-2.6-1.3 1.3-2.6L4.5 10.4l2.6-1.3.5-2.8 2.8.6z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="#2546C8" stroke="${INK}" stroke-width="2"/></svg>`;
const scrapPill = () => `<span class="scrap" aria-label="${load().scrap} scrap">${GEAR}${load().scrap}</span>`;
const backBtn = (to = 'title') => `<button class="btn small white" data-act="go" data-to="${to}">Back</button>`;

// ---------------------------------------------------------------- AI worker

let worker = null;
const workerReqs = new Map();
let reqId = 0;
try {
  worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const r = workerReqs.get(e.data.id); if (r) { workerReqs.delete(e.data.id); r(e.data.actions); } };
  worker.onerror = () => { worker = null; };
} catch { worker = null; }

function think(state, cfg, seed) {
  const clean = { ...state, log: [] };
  if (worker) {
    return new Promise((resolve) => {
      const id = ++reqId;
      workerReqs.set(id, resolve);
      worker.postMessage({ id, state: clean, cfg, seed });
      // If the worker dies silently, fall back to the main thread.
      setTimeout(() => {
        if (workerReqs.has(id)) { workerReqs.delete(id); worker = null; resolve(chooseTurn(clean, cfg, seed)); }
      }, 12000);
    });
  }
  return new Promise((r) => setTimeout(() => r(chooseTurn(clean, cfg, seed)), 30));
}

// ---------------------------------------------------------------- routing

function go(screen, extra = {}) {
  ui.screen = screen;
  ui.sheet = null;
  Object.assign(ui, extra);
  render();
}

function render() {
  document.body.classList.toggle('calm', calm());
  const views = { title, setup, intro, battle: battleView, result: resultView, hangar, board: boardView, manual, settings: settingsView };
  app.innerHTML = views[ui.screen]() + (ui.sheet ? `<div class="sheet-wrap" data-act="closeSheet"><div class="sheet" data-stop role="dialog">${ui.sheet}</div></div>` : '');
  if (ui.screen === 'battle') decorateBattle();
}

function openSheet(html) { ui.sheet = html; render(); }
function closeSheet() { ui.sheet = null; render(); }

// ---------------------------------------------------------------- title

function title() {
  const s = load();
  const run = s.run;
  const parade = FRAME_ORDER.map((f, i) => `<div class="pm m${i}">${mechSVG(f)}</div>`).join('');
  const runBtn = run
    ? `<button class="btn" data-act="continue">Continue run<span class="sub">${run.mode === 'ranked' ? 'Ranked' : 'Practice'} · ${FRAMES[run.frame].name} · Floor ${run.floor}</span></button>
       <button class="btn-ghost" data-act="abandon">Abandon this run</button>`
    : `<button class="btn" data-act="setup" data-mode="ranked">Climb the Tower<span class="sub">Ranked · one loss ends the run</span></button>
       <button class="btn white" data-act="setup" data-mode="casual">Practice climb<span class="sub">Retry any floor · half scrap</span></button>`;
  return `<div class="screen title">
    <div class="title-top">${scrapPill()}<button class="icon-btn" data-act="go" data-to="settings" aria-label="Settings">${COG}</button></div>
    ${logoSVG()}
    <div class="parade">${parade}</div>
    <div class="menu">
      ${runBtn}
      <div class="menu-row">
        <button class="btn small white" data-act="go" data-to="hangar">Hangar</button>
        <button class="btn small white" data-act="go" data-to="board">Leaderboard</button>
        <button class="btn small white" data-act="go" data-to="manual">How to play</button>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- setup

function setup() {
  const s = load();
  const pk = ui.pick;
  const frames = FRAME_ORDER.map((f) => {
    const locked = !s.unlocked.includes(f);
    return `<button class="frame-card ${pk.frame === f ? 'selected' : ''} ${locked ? 'locked' : ''}" data-act="pickFrame" data-v="${f}" aria-pressed="${pk.frame === f}">
      <div class="fc-art" style="--fc:${FRAMES[f].color}">${mechSVG(f)}</div>
      ${locked ? `<span class="lock-tag">${GEAR}${UNLOCK_COST[f]}</span>` : ''}
      <h3>${FRAMES[f].name}</h3><div class="role">${FRAMES[f].role}</div>
    </button>`;
  }).join('');
  const fr = FRAMES[pk.frame];
  const sig = Object.values(CARDS).find((c) => c.frame === pk.frame && c.sig);
  const pilots = PILOT_ORDER.map((p) => `<button class="choice ${pk.pilot === p ? 'selected' : ''}" data-act="pickPilot" data-v="${p}" aria-pressed="${pk.pilot === p}">
    <strong>${PILOTS[p].name}</strong><span class="tag">${PILOTS[p].style}</span><p>${PILOTS[p].text}</p></button>`).join('');
  const docs = DOCTRINE_ORDER.map((d) => `<button class="choice ${pk.doctrine === d ? 'selected' : ''}" data-act="pickDoctrine" data-v="${d}" aria-pressed="${pk.doctrine === d}">
    <strong>${DOCTRINES[d].name}</strong><span></span><p>${DOCTRINES[d].text}</p></button>`).join('');
  const locked = !s.unlocked.includes(pk.frame);
  return `<div class="screen">
    <div class="topbar">${backBtn()}<h2 class="ink-text">${ui.setupMode === 'ranked' ? 'Ranked climb' : 'Practice climb'}</h2>${scrapPill()}</div>
    <div class="scroll stack">
      <div><div class="section-title ink-text">Choose your Frame</div><div class="frame-grid">${frames}</div></div>
      <div class="detail-panel">
        <div class="dp-head"><b>${fr.name}</b><span>${fr.role}</span></div>
        <p>${fr.blurb}</p>
        <div class="kv"><b>Trait</b><p>${fr.trait}</p></div>
        <div class="kv"><b>Signature</b><p>${sig.name}: ${sig.text.replace('Signature. ', '')}</p></div>
        <button class="btn-link" data-act="frameCards" data-v="${pk.frame}">See all ${fr.name} cards</button>
      </div>
      <div><div class="section-title ink-text">Pilot</div><p class="section-note">Your pilot’s bonus is always on, unless they give an order that turn.</p><div class="choice-list">${pilots}</div></div>
      <div><div class="section-title ink-text">Crew doctrine</div><p class="section-note">How your crew builds. You can switch mid-fight with a pilot order.</p><div class="choice-list">${docs}</div></div>
    </div>
    <div class="bottom-cta">${locked
      ? `<button class="btn" data-act="unlock" data-v="${pk.frame}" ${s.scrap < UNLOCK_COST[pk.frame] ? 'disabled' : ''}>Unlock ${fr.name}<span class="sub">${UNLOCK_COST[pk.frame]} scrap · you have ${s.scrap}</span></button>`
      : `<button class="btn" data-act="startRun">Start climb<span class="sub">${fr.name} · ${PILOTS[pk.pilot].name} · ${DOCTRINES[pk.doctrine].name}</span></button>`}</div>
  </div>`;
}

// ---------------------------------------------------------------- floor intro (versus card)

function intro() {
  const run = load().run;
  const floor = run.floor;
  const enemy = enemyFor(run, floor);
  const twist = twistFor(run, floor);
  const lvl = LEVEL_NAMES[LEVELS.indexOf(aiLevel(floor))];
  return `<div class="screen floor-intro">
    <div class="fi-head">
      <div class="floor-num ink-text"><small>Floor</small>${floor}</div>
      ${isBoss(floor) ? '<div class="boss-tag">Boss · enemy limbs +2 HP</div>' : ''}
    </div>
    <div class="versus">
      <div class="vs-side foe">
        <div class="vs-mech pop-in">${mechSVG(enemy.frame)}</div>
        <div class="vs-info"><span class="side-label foe">Enemy</span><b>${FRAMES[enemy.frame].name}</b><span>${FRAMES[enemy.frame].role}</span><span>Pilot ${PILOTS[enemy.pilot].name}</span><span>${DOCTRINES[enemy.doctrine].name}</span><span class="skill">Skill: ${lvl}</span></div>
      </div>
      <div class="vs-badge">VS</div>
      <div class="vs-side you">
        <div class="vs-info"><span class="side-label you">You</span><b>${FRAMES[run.frame].name}</b><span>${FRAMES[run.frame].role}</span><span>Pilot ${PILOTS[run.pilot].name}</span><span>${DOCTRINES[run.doctrine].name}</span></div>
        <div class="vs-mech pop-in">${mechSVG(run.frame)}</div>
      </div>
    </div>
    ${twist ? `<div class="twist-banner"><b>Twist: ${TWISTS[twist].name}</b>${TWISTS[twist].text}</div>` : ''}
    <div class="menu" style="width:min(100%,340px)">
      <button class="btn red" data-act="fight">Fight</button>
      <button class="btn-ghost" data-act="go" data-to="title">Back to title</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- battle view

function coreMeter(p, side) {
  const pct = Math.max(0, p.core / RULES.coreMax);
  const color = p.core >= 15 ? '#FFC929' : p.core >= 8 ? '#FF8A3D' : '#FF4F64';
  const C = 2 * Math.PI * 17;
  const ring = `<svg class="cm-ring" viewBox="0 0 44 44" aria-hidden="true">
    <circle cx="22" cy="22" r="17" fill="#0F2160" stroke="${INK}" stroke-width="9"/>
    <circle cx="22" cy="22" r="17" fill="none" stroke="#0F2160" stroke-width="5"/>
    <circle cx="22" cy="22" r="17" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 22 22)" class="cm-arc"/>
    <text x="22" y="27.5" text-anchor="middle" class="cm-num">${p.core}</text></svg>`;
  return `<button class="core-meter ${side}" data-act="coreInfo" data-side="${side}" aria-label="${side === 'you' ? 'Your' : 'Enemy'} Core ${p.core} of 20">
    ${ring}<span class="cm-text"><span class="res-label">Core</span><b>${energyOutput(p)}${BOLT(false, 'ib')}/turn</b></span></button>`;
}

function slotsView(p, enemy) {
  const n = slotCount(p);
  const see = !enemy || hasOracle(G.players[0]);
  let h = '';
  for (let i = 0; i < n; i++) {
    const it = p.workshop[i];
    const side = enemy ? 'e' : 'y';
    const rushT = ui.rushPick && !enemy && it && it.timer > 1;
    if (!it) { h += `<button class="slot" data-act="slotInfo" data-i="${i}" data-side="${side}" aria-label="Empty Workshop slot"></button>`; continue; }
    const prog = 1 - (it.timer - 1) / Math.max(1, it.total);
    const ringStyle = `style="--p:${Math.round(prog * 100)}"`;
    if (!see) h += `<button class="slot full hidden-item" ${ringStyle} data-act="slotInfo" data-i="${i}" data-side="e" aria-label="Hidden build, ${it.timer} turns"><span class="q">?</span><span class="t">${it.timer}</span></button>`;
    else h += `<button class="slot full ${rushT ? 'targetable' : ''}" ${ringStyle} data-act="${rushT ? 'rushSlot' : 'slotInfo'}" data-i="${i}" data-side="${side}" aria-label="${CARDS[it.id].name}, ${it.timer} turns">${cardIcon(it.id)}<span class="t">${it.timer}</span></button>`;
  }
  return `<div class="slots ${enemy ? 'enemy-slots' : ''}">${h}</div>`;
}

// The status rail beside each mech: Core, then one row per part. Keeps all numbers off the art.
const RAIL_NAMES = { head: 'Head', armL: 'L arm', armR: 'R arm', legs: 'Legs' };

function partRail(p, side) {
  const you = G.players[0];
  const isFoe = side === 'enemy';
  const targeting = isFoe && ui.mode === 'target';
  const prof = targeting ? attackProfile(you, ui.sel.limb, ui.sel.mode) : null;
  const left = RULES.exposeAfter - destroyedCount(p);

  // Core row
  let coreState, coreAct = `data-act="coreInfo" data-side="${isFoe ? 'foe' : 'you'}"`, coreCls = 'core-row';
  if (isExposed(p)) {
    coreCls += ' open';
    coreState = 'Core open';
    if (targeting) {
      const r = previewHit(you, p, 'core', prof);
      coreCls += ' target' + (r.core === 0 ? ' blocked' : '');
      coreState = r.core === 0 ? 'Blocked' : `Hit Core −${r.core}`;
      coreAct = 'data-act="hit" data-t="core"';
    }
  } else coreState = `${LOCK}Break ${left} to open`;
  const pct = Math.max(0, p.core / RULES.coreMax);
  const coreColor = p.core >= 15 ? '#FFC929' : p.core >= 8 ? '#FF8A3D' : '#FF4F64';
  let rows = `<button class="${coreCls}" ${coreAct} data-limb="core" aria-label="${isFoe ? 'Enemy' : 'Your'} Core ${p.core}">
    <span class="cr-ring" style="--p:${Math.round(pct * 100)};--c:${coreColor}"><b>${p.core}</b></span>
    <span class="cr-text"><span class="cr-title">Core <small>${energyOutput(p)}${BOLT(false, 'ib')}/turn</small></span><span class="cr-state">${coreState}</span></span></button>`;

  for (const k of LIMBS) {
    const l = p.limbs[k];
    const m = l.alive && l.mount ? CARDS[l.mount.id] : null;
    let cls = 'part-row';
    let act = `data-act="partInfo" data-side="${isFoe ? 'e' : 'y'}" data-limb="${k}"`;
    let right;
    if (!l.alive) {
      cls += ' dead';
      right = '<span class="pr-val">Down</span>';
    } else {
      const hp = Math.round((l.hp / l.max) * 100);
      if (l.hp <= l.max / 3) cls += ' low';
      right = `<span class="pr-bar"><i style="width:${hp}%"></i></span><span class="pr-val">${l.hp}${l.plating ? `<small>${SHIELD}${CARDS[l.plating.id].armor}</small>` : ''}</span>`;
    }
    if (targeting && l.alive) {
      const r = previewHit(you, p, k, prof);
      const blocked = r.limb === 0 && r.core === 0;
      const kill = r.limb >= l.hp;
      cls += ' target' + (blocked ? ' blocked' : '') + (kill ? ' kill' : '');
      right = `<span class="pr-hit">${blocked ? 'Blocked' : `−${r.limb}${kill ? ' · break' : ''}${r.core ? ` · core −${r.core}` : ''}`}</span>`;
      act = `data-act="hit" data-t="${k}"`;
    } else if (!isFoe && ui.mode === 'idle' && canAct(k)) {
      cls += ' act';
      act = `data-act="limb" data-limb="${k}"`;
      const modes = attackModes(you, k).filter((md) => md !== 'fire' || fireCost(you, k) <= you.energy);
      const best = modes.map((md) => attackProfile(you, k, md).dmg);
      right = `<span class="pr-go">${modes.includes('fire') ? 'Fire' : modes[0] === 'kick' ? 'Kick' : 'Punch'} ${Math.max(...best)}</span>`;
    } else if (!isFoe && ui.sel && ui.mode !== 'idle' && ui.sel.limb === k) cls += ' selected';
    const building = !isFoe ? p.workshop.find((w) => w.target === k) : null;
    const sub2 = building ? `<span class="pr-mount building">${CLOCK}${building.timer} · ${CARDS[building.id].name}</span>` : m ? `<span class="pr-mount">${m.name}</span>` : '';
    rows += `<button class="${cls}" ${act} data-limb="${k}" aria-label="${isFoe ? 'Enemy' : 'Your'} ${LIMB_NAMES[k]}">
      ${limbGlyph(k)}<span class="pr-name">${RAIL_NAMES[k]}${sub2}</span>${right}</button>`;
  }
  return `<div class="rail ${isFoe ? 'foe-rail' : 'you-rail'}">${rows}</div>`;
}

function mechPad(p, side) {
  const idx = side === 'you' ? 0 : 1;
  const opts = {};
  if (ui.fxSlap && ui.fxSlap.p === idx) { opts.slap = ui.fxSlap.limb; opts.slapKind = ui.fxSlap.kind; }
  if (ui.fxPeel && ui.fxPeel.p === idx) opts.peel = ui.fxPeel.limb;
  if (idx === 0) opts.pending = p.workshop.filter((w) => w.target);
  return `<div class="pad ${side}-pad"><div class="mech-box" id="box-${side}">${mechSVG(p.frame, p, opts)}</div></div>`;
}

function canAct(limb) {
  const you = G.players[0];
  if (G.active !== 0 || ui.busy || G.winner !== null || you.ap <= 0) return false;
  return attackModes(you, limb).some((m) => m !== 'fire' || fireCost(you, limb) <= you.energy);
}

function anyMoves() {
  if (G.active !== 0) return false;
  return legalActions(G).some((a) => a.t === 'play' || a.t === 'attack');
}

function handView() {
  const you = G.players[0];
  const myTurn = G.active === 0 && !ui.busy;
  const cards = you.hand.map((id, i) => {
    const c = CARDS[id];
    const ok = myTurn && canPlay(G, you, id);
    const t = c.type === 'order' ? '' : `<span class="hs-time">${CLOCK}${buildPlan(you, id).time}</span>`;
    return `<button class="hs t-${c.type} ${ok ? 'playable' : 'cant'} ${c.sig ? 'sig' : ''}" data-hand="${i}" aria-label="${c.name}, costs ${cardCost(you, id)}${ok ? '. Drag onto your mech or tap for details' : ''}">
      <span class="hs-disc" style="--tc:${TYPE_COLORS[c.type]}"></span>${cardSticker(id)}
      <span class="hs-cost">${cardCost(you, id)}</span>${t}${c.sig ? '<span class="hs-sig">★</span>' : ''}
    </button>`;
  }).join('');
  return `<div class="hand" id="hand">${cards || '<p class="muted empty-hand">Your hand is empty.</p>'}</div>`;
}

function trayView() {
  const you = G.players[0];
  if (ui.mode === 'pickmode') {
    const btns = attackModes(you, ui.sel.limb).map((m) => {
      const prof = attackProfile(you, ui.sel.limb, m);
      const fc = m === 'fire' ? fireCost(you, ui.sel.limb) : 0;
      const name = m === 'fire' ? CARDS[you.limbs[ui.sel.limb].mount.id].name : m === 'punch' ? 'Punch' : 'Kick';
      return `<button class="btn small ${m === 'fire' ? 'red' : ''}" data-act="mode" data-m="${m}" ${fc > you.energy ? 'disabled' : ''}>${name} · ${prof.dmg}${fc ? ` (${fc} energy)` : ''}</button>`;
    }).join('');
    return `<div class="tray"><div class="tray-title">${LIMB_NAMES[ui.sel.limb]}: pick an attack</div>
      <div class="tray-row">${btns}<button class="btn small white" data-act="cancel">Cancel</button></div></div>`;
  }
  if (ui.mode === 'target') {
    const prof = attackProfile(you, ui.sel.limb, ui.sel.mode);
    const kws = [prof.snipe && 'Snipe', prof.pierce && `Pierce ${prof.pierce}`, prof.shred && 'Shred'].filter(Boolean).join(' · ');
    const name = ui.sel.mode === 'fire' ? CARDS[you.limbs[ui.sel.limb].mount.id].name : ui.sel.mode === 'punch' ? 'Punch' : 'Kick';
    return `<div class="tray"><div class="tray-title"><b>${name}</b> for ${prof.dmg}${kws ? ` · ${kws}` : ''}<br>Tap a red row or enemy part to hit it</div>
      <div class="tray-row"><button class="btn small white" data-act="cancel">Cancel</button></div></div>`;
  }
  if (ui.rushPick) {
    return `<div class="tray"><div class="tray-title">Tap a glowing Workshop build to rush it</div>
      <div class="tray-row"><button class="btn small white" data-act="cancel">Cancel</button></div></div>`;
  }
  return '';
}

// One-time coaching tips, shown until dismissed (Settings can turn them off or bring them back).
const TIPS = [
  { id: 'attack', when: () => LIMBS.some(canAct) && you().turnsTaken <= 3, text: 'Tap a glowing row (or the part itself) to attack with that limb. Each limb acts once per turn.' },
  { id: 'build', when: () => you().hand.some((id) => CARDS[id].type !== 'order' && canPlay(G, you(), id)), text: 'Drag a glowing sticker onto your mech to build it. The countdown shows on the limb. Tap a sticker for details.' },
  { id: 'shield', when: () => !isExposed(G.players[1]), text: 'The enemy Core is shielded. Break any 2 of its limbs to open it up.' },
  { id: 'open', when: () => isExposed(G.players[1]), text: 'Their Core is open! Every hit on it brings you closer to the win.' },
  { id: 'mine-open', when: () => isExposed(you()), text: 'Your Core is exposed. Rebuild Kits and Guard drones buy you time.' },
  { id: 'end', when: () => !anyMoves(), text: 'Out of moves. Tap End turn and watch what the enemy does.' },
  { id: 'energy', when: () => you().core < 15, text: 'A damaged Core makes less energy. Overdrive trades Core for +2 energy right now.' },
];

function currentTip() {
  const s = load();
  if (!s.settings.hints || G.active !== 0 || ui.busy || ui.mode !== 'idle' || G.winner !== null) return null;
  return TIPS.find((t) => !s.seenTips.includes(t.id) && t.when()) || null;
}

function battleView() {
  const you = G.players[0], foe = G.players[1];
  const run = load().run;
  const myTurn = G.active === 0 && !ui.busy && G.winner === null;
  const tray = trayView();
  const energyMax = Math.max(you.energy, Math.min(you.turnsTaken + 1, energyOutput(you)));
  const energy = Array.from({ length: Math.max(energyMax, 1) }, (_, i) => BOLT(i >= you.energy)).join('');
  const actions = Array.from({ length: apMax(you) }, (_, i) => FISTPIP(i >= you.ap)).join('');
  const odOk = myTurn && legalActions(G).some((a) => a.t === 'overdrive');
  const stuck = myTurn && !anyMoves();
  const turnNo = Math.ceil(G.turn / 2);
  const tip = !tray && currentTip();
  return `<div class="screen battle ${G.active === 0 ? 'your-turn' : 'their-turn'}">
    <header class="bt-top">
      <button class="foe-id" data-act="foeInfo"><span class="side-label foe">Enemy</span><span class="fi-text"><b>${FRAMES[foe.frame].name}</b><span>${FRAMES[foe.frame].role} · ${PILOTS[foe.pilot].style}${isBoss(run.floor) ? ' · Boss' : ''}</span></span></button>
      <div class="foe-meta">
        <div class="fm-item"><span class="res-label">Workshop</span>${slotsView(foe, true)}</div>
        <div class="fm-item"><span class="res-label">Hand</span><span class="fm-hand"><span class="hand-backs">${'<i></i>'.repeat(Math.min(foe.hand.length, 3))}</span><b>${foe.hand.length}</b></span></div>
        ${foe.guard ? `<div class="fm-item"><span class="res-label">Drones</span><span class="fm-hand"><i class="drone-pip"></i><b>${foe.guard}</b></span></div>` : ''}
      </div>
    </header>
    <section class="stage foe-stage">${partRail(foe, 'enemy')}${mechPad(foe, 'enemy')}</section>
    <div class="midline">
      <span class="turn-chip ${G.active === 0 ? 'you' : 'foe'}">Turn ${turnNo}</span>
      ${tip
        ? `<div class="coach" role="note"><p><b>Tip</b> ${tip.text}</p><button class="coach-x" data-act="dismissTip" data-v="${tip.id}">Got it</button></div>`
        : `<button class="ticker ${G.active === 1 || ui.busy ? 'enemy' : ui.tickerSide === 'you' ? 'you' : ''}" data-act="log" aria-label="Battle log">${esc(ui.ticker || 'Your turn')}</button>`}
    </div>
    <section class="stage you-stage">${mechPad(you, 'you')}${partRail(you, 'you')}</section>
    <div class="dock">
      <div class="dock-res">
        <div class="res"><span class="res-label">Energy <b>${you.energy}</b></span><span class="pips">${energy}</span></div>
        <div class="res"><span class="res-label">Actions <b>${you.ap}</b></span><span class="pips">${actions}</span></div>
        ${you.guard ? `<div class="res"><span class="res-label">Drones <b>${you.guard}</b></span><span class="pips">${Array.from({ length: you.guard }, () => '<i class="drone-pip"></i>').join('')}</span></div>` : ''}
        <div class="res ws"><span class="res-label">Workshop</span>${slotsView(you, false)}</div>
      </div>
      <div class="dock-ctl">
        <button class="tool od" data-act="overdrive" ${odOk ? '' : 'disabled'}>${iconSVG('surge')}<span>Overdrive</span></button>
        <button class="tool" data-act="doctrine">${iconSVG('clock')}<span>${DOCTRINES[you.doctrine].short}</span></button>
        <button class="btn end-btn ${stuck ? 'nudge' : ''}" data-act="endTurn" ${myTurn ? '' : 'disabled'}>${G.active === 0 ? 'End turn' : 'Enemy turn'}</button>
      </div>
    </div>
    <div class="hand-zone">${tray || handView()}</div>
  </div>`;
}

function decorateBattle() {
  const boxY = document.getElementById('box-you');
  const boxE = document.getElementById('box-enemy');
  if (ui.mode === 'idle') {
    for (const k of LIMBS) if (canAct(k)) boxY.querySelector(`.limb[data-limb="${k}"]`)?.classList.add('can-act');
  }
  if (ui.sel && ui.mode !== 'idle') boxY.querySelector(`.limb[data-limb="${ui.sel.limb}"]`)?.classList.add('selected-src');
  if (ui.mode === 'target') {
    for (const k of LIMBS) if (G.players[1].limbs[k].alive) boxE.querySelector(`.limb[data-limb="${k}"]`)?.classList.add('targetable');
    if (isExposed(G.players[1])) boxE.querySelector('.core-gem')?.classList.add('targetable');
  }
  // Fit the hand: overlap cards only as much as needed.
  const hand = document.getElementById('hand');
  if (hand && hand.children.length > 1 && hand.children[0].classList.contains('hs')) {
    const cw = hand.children[0].getBoundingClientRect().width;
    const n = hand.children.length;
    const avail = hand.clientWidth - 8;
    const ov = Math.max(-8, (n * cw - avail) / (n - 1));
    hand.style.setProperty('--ov', `${ov}px`);
  }
}

// ---------------------------------------------------------------- battle flow

function you() { return G.players[0]; }

function step(a) {
  const run = load().run;
  applyAction(G, a);
  run.actions.push(a);
  save();
  const events = G.log.slice(logSeen);
  logSeen = G.log.length;
  ui.mode = 'idle';
  ui.sel = null;
  ui.rushPick = false;
  const t = events.filter((e) => e.type !== 'turn' && e.type !== 'draw' && e.type !== 'end').map(describe).filter(Boolean);
  if (t.length) { ui.ticker = t[t.length - 1]; ui.tickerSide = events[events.length - 1].p === 0 ? 'you' : ''; }
  else if (events.some((e) => e.type === 'turn')) ui.ticker = G.active === 0 ? 'Your turn' : 'Enemy turn';
  // Sticker effects: new upgrades slap on, destroyed parts peel off (played on this render only).
  ui.fxSlap = null; ui.fxPeel = null;
  for (const e of events) {
    if (e.type === 'built' && e.target) ui.fxSlap = { p: e.p, limb: e.target, kind: CARDS[e.id].type === 'plating' ? 'plating' : 'mount' };
    if (e.type === 'attack' && e.destroyed) ui.fxPeel = { p: 1 - e.p, limb: e.target };
  }
  render();
  ui.fxSlap = null; ui.fxPeel = null;
  animate(events);
  if (G.winner !== null) setTimeout(finishBattle, 1500 * speed());
}

function describe(e) {
  const me = e.p === 0;
  const who = me ? 'You' : 'Enemy';
  const their = me ? 'their' : 'your';
  const seeFoe = hasOracle(G.players[0]);
  switch (e.type) {
    case 'attack': {
      const verb = e.mode === 'punch' ? 'punched' : e.mode === 'kick' ? 'kicked' : `fired ${CARDS[e.weapon].name} at`;
      const tgt = e.target === 'core' ? `${their} Core` : `${their} ${LIMB_NAMES[e.target].toLowerCase()}`;
      if (!e.limb && !e.core) return `${who} ${verb} ${tgt}, but a Guard drone blocked it.`;
      const amount = e.target === 'core' ? `${e.core}` : `${e.limb}${e.core ? ` (+${e.core} to Core)` : ''}`;
      return `${who} ${verb} ${tgt} for ${amount}.${e.destroyed ? ' Limb destroyed!' : ''}${e.blocked ? ' A drone took some of it.' : ''}`;
    }
    case 'queued': return me ? `Your crew started ${CARDS[e.id].name}. Ready in ${plural(e.time, 'turn')}.` : (seeFoe ? `Enemy crew started ${CARDS[e.id].name}.` : 'Enemy crew started a hidden build.');
    case 'built': return `${me ? 'Your' : 'Enemy'} ${CARDS[e.id].name} is online${e.target ? ` on the ${LIMB_NAMES[e.target].toLowerCase()}` : ''}.`;
    case 'buildReturned': return `${me ? 'Your' : 'Enemy'} ${CARDS[e.id].name} had no limb to mount on and went back to hand.`;
    case 'overdrive': return `${who} overdrove the Core: +2 energy, −${e.cost} Core.`;
    case 'order': return `${who} ordered a crew change: ${DOCTRINES[e.doctrine].name}.`;
    case 'order-card': return `${who} used ${CARDS[e.id].name}.`;
    case 'delayed': return `${e.p === 0 ? 'Your' : 'Enemy'} build was delayed a turn.`;
    case 'turn': return e.p === 0 ? 'Your turn' : 'Enemy turn';
    case 'win': return e.p === 0 ? 'Enemy mech destroyed!' : 'Your mech was destroyed.';
    default: return '';
  }
}

function floatAt(el, text, cls = '') {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float ${cls}`;
  d.textContent = text;
  const x = Math.min(innerWidth - 70, Math.max(70, r.left + r.width / 2));
  const y = Math.min(innerHeight - 60, Math.max(90, r.top + r.height / 2));
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}

function sparks(el, color = '#FFC929') {
  if (!el || calm()) return;
  const r = el.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'burst';
  b.style.left = `${r.left + r.width / 2}px`;
  b.style.top = `${r.top + r.height / 2}px`;
  b.style.setProperty('--c', color);
  b.innerHTML = '<i></i>'.repeat(8);
  fx.appendChild(b);
  setTimeout(() => b.remove(), 600);
}

function banner(text, side, sub = '') {
  const d = document.createElement('div');
  d.className = `turn-banner ${side}`;
  d.innerHTML = `<div><b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1100 * speed());
}

function retrigger(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
}

function animate(events) {
  for (const e of events) {
    if (e.type === 'attack') {
      const atkBox = document.getElementById(e.p === 0 ? 'box-you' : 'box-enemy');
      const defBox = document.getElementById(e.p === 0 ? 'box-enemy' : 'box-you');
      if (!calm()) retrigger(atkBox, e.p === 0 ? 'lunge-up' : 'lunge-down');
      const part = defBox.querySelector(e.target === 'core' ? '.core-gem' : `.limb[data-limb="${e.target}"]`);
      const rail = document.querySelector(e.p === 0 ? '.foe-rail' : '.you-rail');
      const row = rail?.querySelector(`[data-limb="${e.target}"]`);
      retrigger(row, 'hit-flash');
      const chip = part || row;
      setTimeout(() => {
        retrigger(part, 'flash');
        if (!calm()) retrigger(defBox, 'shake');
        if (!e.limb && !e.core) { floatAt(chip, 'Blocked!', 'blocked'); sparks(chip, '#39E3A6'); }
        else {
          sparks(chip || part);
          if (e.limb) floatAt(chip, `−${e.limb}`);
          if (e.core) setTimeout(() => floatAt(defBox.querySelector('.core-gem'), `Core −${e.core}`, 'core'), e.limb ? 220 : 0);
          if (e.destroyed) setTimeout(() => floatAt(defBox, `${LIMB_NAMES[e.target]} down!`, 'big'), 320);
        }
      }, 140);
    } else if (e.type === 'built') {
      const box = document.getElementById(e.p === 0 ? 'box-you' : 'box-enemy');
      const part = e.target ? box.querySelector(`.limb[data-limb="${e.target}"]`) : null;
      floatAt(part || box, `${CARDS[e.id].name} on`, 'info');
    } else if (e.type === 'overdrive') {
      if (!calm()) retrigger(app, 'screen-shake');
      floatAt(document.querySelector(e.p === 0 ? '#box-you .core-gem' : '#box-enemy .core-gem'), 'Overdrive!', 'info');
    } else if (e.type === 'delayed') {
      floatAt(document.querySelector(e.p === 0 ? '.dock .slots' : '.enemy-slots'), '+1 turn', 'info');
    } else if (e.type === 'turn' && G.winner === null) {
      banner(e.p === 0 ? 'Your turn' : 'Enemy turn', e.p === 0 ? 'you' : 'foe', `Turn ${Math.ceil(e.turn / 2)}`);
    }
  }
}

async function enemyTurn() {
  if (ui.enemyRunning) return;
  ui.enemyRunning = true;
  ui.busy = true;
  render();
  const run = load().run;
  await sleep(700);
  let guard = 0;
  while (G.winner === null && G.active === 1 && guard++ < 8) {
    const cfg = aiLevel(run.floor);
    const seed = (run.battle.aiSeed + G.turn * 101 + run.actions.length) >>> 0;
    const plan = await think(G, cfg, seed);
    if (ui.screen !== 'battle') { ui.enemyRunning = false; return; }
    let replan = false;
    for (const a of plan) {
      if (G.winner !== null || G.active !== 1) break;
      if (!isLegal(G, a)) { replan = true; break; }
      if (a.t === 'end') await sleep(300);
      step(a);
      if (a.t !== 'end') await sleep(a.t === 'attack' ? 950 : 700);
      if (a.t === 'play' && CARDS[a.id].effect === 'draw') { replan = true; break; }
    }
    if (!replan && G.winner === null && G.active === 1) step({ t: 'end' });
  }
  if (G.winner === null && G.active === 1) step({ t: 'end' });
  ui.busy = false;
  ui.enemyRunning = false;
  if (ui.screen === 'battle') render();
}

function battleSummary() {
  const sum = { turns: 0, dealt: 0, taken: 0, broke: 0, lost: 0, built: 0 };
  for (const e of G.log) {
    if (e.type === 'turn' && e.p === 0) sum.turns++;
    if (e.type === 'attack') {
      const d = (e.limb || 0) + (e.core || 0);
      if (e.p === 0) { sum.dealt += d; if (e.destroyed) sum.broke++; } else { sum.taken += d; if (e.destroyed) sum.lost++; }
    }
    if (e.type === 'built' && e.p === 0) sum.built++;
  }
  return sum;
}

function finishBattle() {
  if (ui.screen !== 'battle') return;
  const s = load();
  const run = s.run;
  const win = G.winner === 0;
  const summary = battleSummary();
  if (win) {
    const r = reward(run, run.floor);
    s.scrap += r;
    run.earned += r;
    s.stats.wins++;
    if (run.mode === 'casual') s.bestCasual[run.frame] = Math.max(s.bestCasual[run.frame] || 0, run.floor);
    const cleared = run.floor;
    run.floor++;
    run.attempt = 0;
    run.battle = null;
    run.actions = [];
    save();
    go('result', { result: { win: true, reward: r, cleared, summary } });
  } else {
    s.stats.losses++;
    if (run.mode === 'ranked') {
      const entry = recordRanked(run);
      s.run = null;
      save();
      go('result', { result: { win: false, ranked: true, cleared: run.floor - 1, entry, frame: run.frame, earned: run.earned, summary } });
    } else {
      run.attempt++;
      run.battle = null;
      run.actions = [];
      save();
      go('result', { result: { win: false, ranked: false, floor: run.floor, frame: run.frame, summary } });
    }
  }
}

function recordRanked(run) {
  const s = load();
  const entry = { name: s.name || 'Pilot', frame: run.frame, pilot: run.pilot, floor: run.floor - 1, date: Date.now() };
  s.board.push(entry);
  s.board.sort((a, b) => b.floor - a.floor || a.date - b.date);
  s.board = s.board.slice(0, 50);
  return entry;
}

function startOrResumeBattle() {
  const run = load().run;
  const fresh = !run.battle;
  if (run.battle) {
    // Rebuild the exact match by replaying its action log (same seed → same game).
    G = createGame(run.battle.setup);
    for (const a of run.actions) applyAction(G, a);
  } else {
    G = startBattle(run);
    save();
  }
  logSeen = G.log.length;
  ui.mode = 'idle'; ui.sel = null; ui.busy = false; ui.rushPick = false; ui.enemyRunning = false;
  ui.ticker = G.active === 0 ? 'Your turn' : 'Enemy turn';
  ui.tickerSide = 'you';
  go('battle');
  banner(fresh ? 'Fight!' : 'Back in the fight', 'fight', `Floor ${run.floor} · ${G.active === 0 ? 'you go first' : 'enemy goes first'}`);
  if (G.winner !== null) setTimeout(finishBattle, 600);
  else if (G.active === 1) setTimeout(enemyTurn, 600 * speed());
}

// ---------------------------------------------------------------- results

function summaryView(sm) {
  if (!sm) return '';
  const cell = (n, l) => `<div class="sm-cell"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="summary">${cell(sm.turns, 'Turns')}${cell(sm.dealt, 'Damage dealt')}${cell(sm.taken, 'Damage taken')}${cell(sm.broke, 'Limbs broken')}${cell(sm.built, 'Builds finished')}</div>`;
}

function resultView() {
  const r = ui.result;
  const run = load().run;
  if (r.win) {
    const next = run.floor;
    const tw = twistFor(run, next);
    return `<div class="screen result">
      <div class="result-mech pop-in">${mechSVG(run.frame)}</div>
      <h1 class="ink-text">Floor ${r.cleared} cleared</h1>
      <div class="reward-pop pop-in">${GEAR}+${r.reward} scrap</div>
      ${summaryView(r.summary)}
      ${tw ? `<div class="twist-banner"><b>Next floor twist: ${TWISTS[tw].name}</b>${TWISTS[tw].text}</div>` : ''}
      ${isBoss(next) ? '<div class="boss-tag">Boss up next</div>' : ''}
      <div class="menu" style="width:min(100%,340px)">
        <button class="btn" data-act="nextFloor">Climb to floor ${next}</button>
        ${run.mode === 'casual' ? '<button class="btn-ghost" data-act="endCasual">Bank scrap and leave</button>' : '<button class="btn-ghost" data-act="go" data-to="title">Take a break</button>'}
      </div>
    </div>`;
  }
  if (r.ranked) {
    const board = load().board;
    const rank = board.findIndex((e) => e.date === r.entry.date) + 1;
    return `<div class="screen result">
      <div class="result-mech wrecked">${mechSVG(r.frame)}</div>
      <h1 class="ink-text">Mech down</h1>
      <p class="result-line">${FRAMES[r.frame].name} cleared <b>${plural(r.cleared, 'floor')}</b> · leaderboard rank ${rank || '—'}</p>
      <div class="reward-pop">${GEAR}${r.earned} scrap earned</div>
      ${summaryView(r.summary)}
      <div class="menu" style="width:min(100%,340px)">
        <button class="btn" data-act="go" data-to="board">View leaderboard</button>
        <button class="btn white" data-act="go" data-to="title">Back to title</button>
      </div>
    </div>`;
  }
  return `<div class="screen result">
    <div class="result-mech wrecked">${mechSVG(r.frame)}</div>
    <h1 class="ink-text">Knocked down</h1>
    <p class="result-line">Practice run: try floor ${r.floor} again with a new draw.</p>
    ${summaryView(r.summary)}
    <div class="menu" style="width:min(100%,340px)">
      <button class="btn" data-act="retry">Retry floor ${r.floor}</button>
      <button class="btn-ghost" data-act="endCasual">Leave the Tower</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- hangar

function hangar() {
  const s = load();
  const items = FRAME_ORDER.map((f) => {
    const fr = FRAMES[f];
    const locked = !s.unlocked.includes(f);
    const sig = Object.values(CARDS).find((c) => c.frame === f && c.sig);
    return `<div class="detail-panel hangar-card">
      <div class="hc-top">
        <div class="fc-art" style="--fc:${fr.color}">${mechSVG(f)}</div>
        <div><div class="dp-head"><b>${fr.name}</b><span>${fr.role}</span></div><p>${fr.blurb}</p>
        ${s.bestCasual[f] ? `<p class="note">Best practice floor: ${s.bestCasual[f]}</p>` : ''}</div>
      </div>
      <div class="kv"><b>Trait</b><p>${fr.trait}</p></div>
      <div class="kv"><b>Signature</b><p>${sig.name}: ${sig.text.replace('Signature. ', '')}</p></div>
      <div class="hc-actions">
        <button class="btn small white" data-act="frameCards" data-v="${f}">View cards</button>
        ${locked ? `<button class="btn small" data-act="unlock" data-v="${f}" ${s.scrap < UNLOCK_COST[f] ? 'disabled' : ''}>Unlock · ${UNLOCK_COST[f]} scrap</button>` : '<span class="owned">Unlocked</span>'}
      </div>
    </div>`;
  }).join('');
  return `<div class="screen">
    <div class="topbar">${backBtn()}<h2 class="ink-text">Hangar</h2>${scrapPill()}</div>
    <div class="scroll stack">${items}<p class="muted center">More Frames are on the way. Earn scrap in the Tower to unlock them.</p></div>
  </div>`;
}

function cardRow(id, count) {
  const c = CARDS[id];
  return `<div class="card-row">
    <span class="cr-icon" style="background:${TYPE_COLORS[c.type]}">${cardIcon(id)}</span>
    <div><b>${c.sig ? '★ ' : ''}${c.name}${count > 1 ? ` ×${count}` : ''}</b>
      <span class="cr-meta">${TYPE_NAMES[c.type]} · ${c.cost} energy · ${c.type === 'order' ? 'instant' : `builds in ${c.build}`}</span>
      <p>${c.text}</p></div></div>`;
}

function frameCardsSheet(f) {
  const counts = {};
  for (const id of FRAMES[f].deck) counts[id] = (counts[id] || 0) + 1;
  const own = Object.keys(counts).filter((id) => CARDS[id].frame === f);
  const shared = Object.keys(counts).filter((id) => !CARDS[id].frame);
  return `<h3>${FRAMES[f].name} deck</h3><div class="sub-line">20 cards · build times are before crew doctrine</div>
    <div class="section-mini">${FRAMES[f].name} only</div>${own.map((id) => cardRow(id, counts[id])).join('')}
    <div class="section-mini">Shared crew cards</div>${shared.map((id) => cardRow(id, counts[id])).join('')}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

// ---------------------------------------------------------------- leaderboard

function boardView() {
  const s = load();
  const tabs = ['all', ...FRAME_ORDER].map((t) => `<button class="tab ${ui.boardTab === t ? 'on' : ''}" data-act="boardTab" data-v="${t}">${t === 'all' ? 'All Frames' : FRAMES[t].name}</button>`).join('');
  const rows = s.board.filter((e) => ui.boardTab === 'all' || e.frame === ui.boardTab).slice(0, 25);
  const list = rows.length
    ? rows.map((e, i) => `<div class="board-row ${e.name === s.name ? 'me' : ''}"><span class="rank">${i + 1}</span>
        <span class="who"><b>${esc(e.name)}</b><span>${FRAMES[e.frame].name} · ${PILOTS[e.pilot].name} · ${new Date(e.date).toLocaleDateString()}</span></span>
        <span class="fl"><b>${e.floor}</b><small>floors</small></span></div>`).join('')
    : `<div class="empty"><p>No ranked runs yet.</p><p class="muted">Finish a ranked climb to get on the board.</p></div>`;
  return `<div class="screen">
    <div class="topbar">${backBtn()}<h2 class="ink-text">Leaderboard</h2><span class="spacer"></span></div>
    <div class="tabs">${tabs}</div>
    <div class="scroll"><div class="board">${list}</div>
      <p class="muted center small-note">Floors cleared in ranked climbs on this device. A global board comes with online play.</p></div>
  </div>`;
}

// ---------------------------------------------------------------- settings

function seg(name, value, options) {
  return `<div class="seg" role="radiogroup">${options.map(([v, label]) => `<button role="radio" aria-checked="${value === v}" class="${value === v ? 'on' : ''}" data-act="setOpt" data-k="${name}" data-v="${v}">${label}</button>`).join('')}</div>`;
}

function settingsView() {
  const s = load();
  const st = s.settings;
  return `<div class="screen">
    <div class="topbar">${backBtn()}<h2 class="ink-text">Settings</h2><span class="spacer"></span></div>
    <div class="scroll stack">
      <div class="detail-panel set-group">
        <h3>Pilot callsign</h3>
        <p>Shown on the leaderboard.</p>
        <div class="name-row"><input id="name-in" class="name-input" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Callsign" enterkeyhint="done" value="${esc(s.name)}">
        <button class="btn small" data-act="saveNameSettings">Save</button></div>
      </div>
      <div class="detail-panel set-group">
        <h3>Gameplay</h3>
        <div class="set-row"><div><b>Tips during battle</b><p>Short hints the first time something comes up.</p></div>${seg('hints', st.hints ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
        <button class="btn-link" data-act="resetTips">Show all tips again</button>
        <div class="set-row"><div><b>Enemy turn speed</b><p>How fast the AI’s moves play out.</p></div>${seg('speed', st.speed, [['normal', 'Normal'], ['fast', 'Fast']])}</div>
        <div class="set-row"><div><b>Motion</b><p>Screen shake, lunges and sparks.</p></div>${seg('motion', st.motion, [['system', 'Auto'], ['full', 'Full'], ['reduce', 'Less']])}</div>
      </div>
      <div class="detail-panel set-group danger">
        <h3>Data</h3>
        <p>Scrap: ${s.scrap} · Unlocked: ${s.unlocked.length} Frames · Leaderboard: ${plural(s.board.length, 'run')} · Record: ${s.stats.wins} wins, ${s.stats.losses} losses</p>
        <button class="btn red" data-act="resetAsk">Reset all data</button>
      </div>
      <p class="muted center small-note">Mech Wars v${VERSION}. Progress is saved on this device only. The Home Screen app and Safari keep separate saves.</p>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- manual

function manual() {
  return `<div class="screen">
    <div class="topbar">${backBtn()}<h2 class="ink-text">How to play</h2><span class="spacer"></span></div>
    <div class="scroll manual stack">
      <div class="detail-panel"><h3>Win the fight</h3><p>Destroy the enemy Core. It’s shielded by four limbs: head, two arms and legs. Break any two limbs and the Core opens up. The Core row beside each mech shows how many are left to break.</p></div>
      <div class="detail-panel"><h3>Your turn</h3><ul>
        <li><b>Attack:</b> tap a glowing row (or part) on your side, then a red row (or part) on the enemy. Each limb acts once per turn: arms punch, legs kick, mounted weapons fire.</li>
        <li><b>Actions:</b> you get 2 per turn (1 if your legs are down).</li>
        <li><b>Build:</b> drag a sticker from your hand onto a glowing limb. It costs energy, and the countdown on that limb shows when it lands. Tap any sticker to read it first.</li>
        <li>When you’re done, tap <b>End turn</b>.</li></ul></div>
      <div class="detail-panel"><h3>Your Core is your energy</h3><p>Each turn your Core makes energy for cards. A damaged Core makes less:</p>
        <ul><li>15–20 Core: 4 energy</li><li>8–14 Core: 3 energy</li><li>1–7 Core: 2 energy</li></ul>
        <p>Energy ramps up over your first turns. <b>Overdrive</b> gives +2 energy right now for 3 Core, once per turn.</p></div>
      <div class="detail-panel"><h3>Builds live on limbs</h3><p>Weapons and upgrades mount on a limb. If that limb is destroyed, whatever is on it is lost, so think about where your best gear goes.</p></div>
      <div class="detail-panel"><h3>Keywords</h3><ul>${Object.values(KEYWORDS).map(([k, t]) => `<li><b>${k}:</b> ${t}</li>`).join('')}</ul></div>
      <div class="detail-panel"><h3>Crew doctrine</h3><p>Your doctrine sets how builds come out: faster and weaker, slower and stronger, or specialized. Your pilot can order a change for 2 energy, but their bonus switches off for that turn.</p></div>
      <div class="detail-panel"><h3>The Battle Tower</h3><p>Every floor is a fresh fight against a tougher AI. Twists change the rules for a couple of floors, and every fifth floor is a boss. Ranked climbs end at your first loss and go on the leaderboard. Practice climbs let you retry for half the scrap.</p></div>
      <div class="detail-panel"><h3>Hidden info</h3><p>You can’t see what the enemy is building or holding, and the AI can’t see yours. It reads the board and plays the odds, just like you.</p></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- sheets

function keywordNotes(c) {
  const ks = [];
  if (c.snipe || c.oracle) ks.push('snipe');
  if (c.pierce) ks.push('pierce');
  if (c.shred) ks.push('shred');
  if (c.armor) ks.push('armor');
  if (c.effect === 'guard' || c.guardGen || c.guardBlock || c.effect === 'guardNow' || c.bash) ks.push('guard');
  return ks.length ? `<div class="kw-list">${ks.map((k) => `<p><b>${KEYWORDS[k][0]}:</b> ${KEYWORDS[k][1]}</p>`).join('')}</div>` : '';
}

function cardSheet(i) {
  const p = you();
  const id = p.hand[i];
  const c = CARDS[id];
  const cost = cardCost(p, id);
  const plan = c.type === 'order' ? null : buildPlan(p, id);
  const myTurn = G.active === 0 && !ui.busy;
  const ok = myTurn && canPlay(G, p, id);
  let reason = '';
  if (!myTurn) reason = 'Wait for your turn.';
  else if (cost > p.energy) reason = `Needs ${cost} energy. You have ${p.energy}.`;
  else if (p.mods.norepair && ['repair', 'rebuild', 'core'].includes(c.effect)) reason = 'Twist: no repairs this floor.';
  else if (c.type !== 'order' && p.workshop.length >= slotCount(p)) reason = 'Your Workshop is full. Wait for a build to finish.';
  else if (!ok) reason = c.effect === 'rebuild' ? 'No destroyed limb to rebuild.' : c.effect === 'repair' ? 'No damaged limb to repair.' : c.effect === 'rush' ? 'Nothing in the Workshop to rush.' : 'Can’t be played right now.';

  const stats = [`<span class="stat">${BOLT(false, 'ib')} ${cost} energy</span>`];
  if (plan) {
    stats.push(`<span class="stat">${CLOCK} Ready in ${plural(plan.time, 'turn')}</span>`);
    if (plan.mod) stats.push(`<span class="stat">${plan.mod > 0 ? '+' : ''}${plan.mod} quality (${DOCTRINES[p.doctrine].name})</span>`);
    if (c.stat && plan.mod) {
      const [k] = c.stat;
      stats.push(`<span class="stat">${k === 'dmg' ? 'Damage' : k === 'hp' ? 'HP' : k === 'punch' ? 'Punch bonus' : k === 'kick' ? 'Kick bonus' : 'Amount'} becomes ${statVal(id, k, plan.mod)}</span>`);
    }
  } else stats.push('<span class="stat">Instant</span>');
  if (c.slots) stats.push(`<span class="stat">Fits: ${c.slots.map((k) => LIMB_NAMES[k]).join(', ')}</span>`);

  let actions = '';
  if (ok) {
    if (c.effect === 'rush') {
      actions = `<button class="btn opt" data-act="startRush" data-id="${id}">Pick a build to rush</button>`;
    } else {
      const targets = playTargets(G, p, id);
      const verb = c.type === 'order' ? 'Use now' : c.effect === 'repair' ? 'Repair' : c.effect === 'rebuild' ? 'Rebuild' : (c.type === 'plating' ? 'Plate' : c.slots ? 'Mount on' : 'Start build');
      actions = targets.map((t) => {
        const l = t ? p.limbs[t] : null;
        const extra = !t ? '' : c.effect === 'repair' ? ` (${l.hp}/${l.max})` : (l.mount && c.type !== 'plating' ? ` · replaces ${CARDS[l.mount.id].name}` : '');
        return `<button class="btn opt" data-act="play" data-id="${id}" ${t ? `data-t="${t}"` : ''}>${verb}${t ? ` ${LIMB_NAMES[t].toLowerCase()}` : ''}<span class="sub">${extra.replace(/^ · /, '') || (c.type === 'order' ? `${cost} energy` : `${cost} energy · ready in ${plural(plan.time, 'turn')}`)}</span></button>`;
      }).join('');
    }
    actions = `<p class="note">Tip: you can also drag this sticker straight onto ${c.slots || ['repair', 'rebuild'].includes(c.effect) ? 'a glowing limb' : 'your mech'}.</p>` + actions;
  } else {
    actions = `<p class="note warn">${reason}</p>`;
  }
  return `<div class="big-card-art" style="--tc:${TYPE_COLORS[c.type]}">${cardSticker(id)}</div>
    <h3>${c.sig ? '★ ' : ''}${c.name}</h3><div class="sub-line">${TYPE_NAMES[c.type]}${c.frame ? ` · ${FRAMES[c.frame].name}` : ' · shared'}</div>
    <p>${c.text}</p><div class="stats">${stats.join('')}</div>
    ${keywordNotes(c)}
    ${actions}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function doctrineSheet() {
  const p = you();
  const myTurn = G.active === 0 && !ui.busy;
  const can = myTurn && !p.flags.order && p.energy >= RULES.orderCost;
  const list = DOCTRINE_ORDER.map((d) => {
    const cur = d === p.doctrine;
    return `<button class="choice ${cur ? 'selected' : ''}" data-act="${cur ? 'noop' : 'order'}" data-v="${d}" ${!cur && !can ? 'disabled' : ''}>
      <strong>${DOCTRINES[d].name}</strong><span class="tag">${cur ? 'Current' : `${RULES.orderCost} energy`}</span><p>${DOCTRINES[d].text}</p></button>`;
  }).join('');
  return `<h3>Crew doctrine</h3>
    <p>Switching is a pilot order: it costs ${RULES.orderCost} energy and ${PILOTS[p.pilot].name}’s bonus is off for the rest of this turn. Builds already in the Workshop keep their old plan.</p>
    ${p.flags.order ? '<p class="note warn">You already gave an order this turn.</p>' : ''}
    <div class="choice-list">${list}</div>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function foeSheet() {
  const f = G.players[1];
  const fr = FRAMES[f.frame];
  const sig = Object.values(CARDS).find((c) => c.frame === f.frame && c.sig);
  const run = load().run;
  const tw = run.battle.twist;
  const me = you();
  return `<h3>${fr.name}</h3><div class="sub-line">${fr.role} · ${PILOTS[f.pilot].name} (${PILOTS[f.pilot].style}) · skill ${LEVEL_NAMES[LEVELS.indexOf(aiLevel(run.floor))]}</div>
    <p><b>Trait:</b> ${fr.trait}</p>
    <p><b>Signature:</b> ${sig.name}. ${sig.text.replace('Signature. ', '')}</p>
    <p><b>Pilot:</b> ${PILOTS[f.pilot].text}</p>
    <p><b>Crew:</b> ${DOCTRINES[f.doctrine].name}. ${DOCTRINES[f.doctrine].text}</p>
    <p><b>Right now:</b> ${plural(f.guard, 'Guard drone')} · ${energyOutput(f)} energy per turn · ${plural(f.hand.length, 'card')} in hand</p>
    ${tw ? `<p><b>Twist: ${TWISTS[tw].name}.</b> ${TWISTS[tw].text}</p>` : ''}
    <p class="note">Your pilot: ${PILOTS[me.pilot].name}. ${PILOTS[me.pilot].text}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button>
      <button class="btn red" data-act="forfeit">Forfeit</button></div>`;
}

function slotSheet(i, side) {
  const p = side === 'e' ? G.players[1] : you();
  const it = p.workshop[i];
  if (!it) return `<h3>Empty Workshop slot</h3><p>${side === 'e' ? 'The enemy has room to build here.' : 'Play a card from your hand to start a build here.'}</p><div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
  if (side === 'e' && !hasOracle(you())) {
    return `<h3>Hidden build</h3><p>The enemy crew is building something. It lands in ${plural(it.timer, 'turn')}.</p><p class="note">An Oracle Eye would reveal it.</p><div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
  }
  const c = CARDS[it.id];
  return `<h3>${c.name}</h3><div class="sub-line">${side === 'e' ? 'Enemy' : 'Your'} Workshop · lands in ${plural(it.timer, 'turn')}${it.target ? ` · for the ${LIMB_NAMES[it.target].toLowerCase()}` : ''}</div>
    <p>${c.text}</p>${it.mod ? `<p class="note">Quality ${it.mod > 0 ? '+' : ''}${it.mod} from crew doctrine.</p>` : ''}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function partSheet(side, k) {
  const p = side === 'e' ? G.players[1] : you();
  const l = p.limbs[k];
  const whose = side === 'e' ? 'Enemy' : 'Your';
  const uses = { head: 'Holds head gear. If it’s destroyed, weapons deal 1 less.', armL: 'Punches, or fires a mounted weapon.', armR: 'Punches, or fires a mounted weapon.', legs: 'Kicks, and gives your second action each turn.' }[k];
  const m = l.alive && l.mount ? CARDS[l.mount.id] : null;
  const pl = l.alive && l.plating ? CARDS[l.plating.id] : null;
  return `<h3>${whose} ${LIMB_NAMES[k].toLowerCase()}</h3><div class="sub-line">${l.alive ? `${l.hp} / ${l.max} HP` : 'Destroyed'}</div>
    <p>${uses}</p>
    ${m ? `<p><b>Mounted:</b> ${m.name}. ${m.text.replace('Signature. ', '')}</p>` : l.alive ? '<p><b>Mounted:</b> nothing yet.</p>' : ''}
    ${pl ? `<p><b>Plating:</b> ${pl.name}, Armor ${pl.armor}.</p>` : ''}
    ${!l.alive ? '<p>A Rebuild Kit can bring it back. Anything mounted on it was lost.</p>' : ''}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function logSheet() {
  let html = '';
  let open = false;
  for (const e of G.log) {
    if (e.type === 'turn') {
      if (open) html += '</ul>';
      html += `<div class="log-turn ${e.p === 0 ? 'you' : 'foe'}">Turn ${Math.ceil(e.turn / 2)} · ${e.p === 0 ? 'You' : 'Enemy'}</div><ul class="log-list">`;
      open = true;
      continue;
    }
    if (['draw', 'end'].includes(e.type)) continue;
    const t = describe(e);
    if (t) html += `<li class="${e.p === 0 ? 'you' : 'foe'}">${esc(t)}</li>`;
  }
  if (open) html += '</ul>';
  return `<h3>Battle log</h3><div class="log">${html || '<p>Nothing has happened yet.</p>'}</div>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

// ---------------------------------------------------------------- input

const handlers = {
  go: (d) => go(d.to),
  closeSheet: () => closeSheet(),
  noop: () => {},
  setup: (d) => {
    const s = load();
    ui.setupMode = d.mode;
    if (!s.unlocked.includes(ui.pick.frame)) ui.pick.frame = s.unlocked[0];
    if (d.mode === 'ranked' && !s.name) {
      ui.screen = 'setup';
      openSheet(nameSheet());
      return;
    }
    go('setup');
  },
  pickFrame: (d) => { ui.pick.frame = d.v; render(); },
  pickPilot: (d) => { ui.pick.pilot = d.v; render(); },
  pickDoctrine: (d) => { ui.pick.doctrine = d.v; render(); },
  frameCards: (d) => openSheet(frameCardsSheet(d.v)),
  unlock: (d) => {
    const s = load();
    const cost = UNLOCK_COST[d.v];
    if (s.scrap < cost) return;
    update((x) => { x.scrap -= cost; x.unlocked.push(d.v); });
    render();
  },
  startRun: () => {
    const { frame, pilot, doctrine } = ui.pick;
    update((s) => { s.run = newRun(ui.setupMode, frame, pilot, doctrine); });
    go('intro');
  },
  continue: () => {
    const run = load().run;
    if (run.battle) startOrResumeBattle();
    else go('intro');
  },
  abandon: () => openSheet(`<h3>Abandon this run?</h3><p>${load().run.mode === 'ranked' ? 'Your ranked run ends here and is recorded at the floors you’ve cleared.' : 'Your practice run ends. Scrap you earned is kept.'}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Keep going</button><button class="btn red" data-act="confirmAbandon">Abandon</button></div>`),
  confirmAbandon: () => {
    const s = load();
    if (s.run && s.run.mode === 'ranked' && s.run.floor > 1) recordRanked(s.run);
    s.run = null;
    save();
    go('title');
  },
  fight: () => startOrResumeBattle(),
  nextFloor: () => go('intro'),
  retry: () => go('intro'),
  endCasual: () => { update((s) => { s.run = null; }); go('title'); },
  boardTab: (d) => { ui.boardTab = d.v; render(); },

  // settings
  setOpt: (d) => {
    update((s) => {
      if (d.k === 'hints') s.settings.hints = d.v === 'on';
      else s.settings[d.k] = d.v;
    });
    render();
  },
  resetTips: () => { update((s) => { s.seenTips = []; s.settings.hints = true; }); toast('Tips will show again.'); render(); },
  saveNameSettings: () => {
    const v = (document.getElementById('name-in')?.value || '').trim().slice(0, 16);
    if (!v) { document.getElementById('name-in')?.focus(); return; }
    update((s) => { s.name = v; });
    toast('Callsign saved.');
    render();
  },
  resetAsk: () => openSheet(`<h3>Reset all data?</h3>
    <p>This deletes your scrap, unlocked Frames, leaderboard, stats, settings and any run in progress. It can’t be undone.</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Cancel</button><button class="btn red" data-act="resetConfirm">Reset everything</button></div>`),
  resetConfirm: () => {
    resetAll();
    G = null;
    ui.pick = { frame: 'brakka', pilot: 'redline', doctrine: 'standard' };
    go('title');
    toast('All data reset.');
  },

  // battle
  card: (d) => { ui.mode = 'idle'; ui.sel = null; openSheet(cardSheet(Number(d.i))); },
  play: (d) => {
    const a = { t: 'play', id: d.id, target: d.t || null };
    ui.sheet = null;
    if (isLegal(G, a)) step(a); else render();
  },
  startRush: () => { ui.sheet = null; ui.rushPick = true; render(); },
  rushSlot: (d) => {
    const a = { t: 'play', id: 'rush_order', slot: Number(d.i) };
    if (isLegal(G, a)) step(a);
  },
  slotInfo: (d) => openSheet(slotSheet(Number(d.i), d.side)),
  partInfo: (d) => openSheet(partSheet(d.side, d.limb)),
  limb: (d) => selectLimb(d.limb),
  mode: (d) => { ui.sel.mode = d.m; ui.mode = 'target'; render(); },
  hit: (d) => {
    if (!ui.sel) return;
    const a = { t: 'attack', limb: ui.sel.limb, mode: ui.sel.mode, target: d.t };
    if (isLegal(G, a)) step(a);
  },
  cancel: () => { ui.mode = 'idle'; ui.sel = null; ui.rushPick = false; render(); },
  overdrive: () => {
    const p = you();
    const after = p.core - overdriveCost(p);
    openSheet(`<h3>Overdrive</h3><p>Push the Core for <b>+${RULES.overdriveEnergy} energy</b> right now. It costs <b>${overdriveCost(p)} Core</b>, once per turn.</p>
      <p class="note">Core ${p.core} → ${after}. Afterwards your Core makes ${energyOutput({ ...p, core: after })} energy per turn.</p>
      <div class="actions"><button class="btn white" data-act="closeSheet">Cancel</button><button class="btn red" data-act="doOverdrive">Overdrive</button></div>`);
  },
  doOverdrive: () => { ui.sheet = null; if (isLegal(G, { t: 'overdrive' })) step({ t: 'overdrive' }); else render(); },
  doctrine: () => openSheet(doctrineSheet()),
  order: (d) => { ui.sheet = null; const a = { t: 'order', doctrine: d.v }; if (isLegal(G, a)) step(a); else render(); },
  coreInfo: (d) => {
    const p = d.side === 'foe' ? G.players[1] : you();
    const whose = d.side === 'foe' ? 'The enemy Core' : 'Your Core';
    openSheet(`<h3>${whose}: ${p.core} / 20</h3><p>The Core is health and power plant in one. At 15+ it makes 4 energy a turn, at 8–14 it makes 3, and below 8 just 2. At 0 the mech is destroyed.</p>
      <p>${isExposed(p) ? '<b>It’s open:</b> two limbs are down, so attacks can hit it directly.' : `<b>It’s shielded</b> until ${plural(RULES.exposeAfter - destroyedCount(p), 'more limb')} ${RULES.exposeAfter - destroyedCount(p) === 1 ? 'is' : 'are'} destroyed. Pierce still gets through.`}</p>
      <div class="actions"><button class="btn white" data-act="closeSheet">Got it</button></div>`);
  },
  foeInfo: () => openSheet(foeSheet()),
  log: () => openSheet(logSheet()),
  dismissTip: (d) => { update((s) => { if (!s.seenTips.includes(d.v)) s.seenTips.push(d.v); }); render(); },
  forfeit: () => openSheet(`<h3>Forfeit this fight?</h3><p>${load().run.mode === 'ranked' ? 'This counts as a loss and ends your ranked run.' : 'You can retry the floor afterwards.'}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Keep fighting</button><button class="btn red" data-act="confirmForfeit">Forfeit</button></div>`),
  confirmForfeit: () => { ui.sheet = null; G.winner = 1; finishBattle(); },
  endTurn: () => {
    if (G.active !== 0 || ui.busy) return;
    step({ t: 'end' });
    if (G.winner === null) enemyTurn();
  },
};

function toast(text) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = text;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

function selectLimb(limb) {
  if (!canAct(limb)) return;
  const p = you();
  const modes = attackModes(p, limb).filter((m) => m !== 'fire' || fireCost(p, limb) <= p.energy);
  ui.sel = { limb, mode: modes[0] };
  ui.mode = modes.length === 1 ? 'target' : 'pickmode';
  render();
}

function nameSheet() {
  return `<h3>Pilot callsign</h3><p>This name goes on the leaderboard. You can change it in Settings.</p>
    <input id="name-in" class="name-input" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Callsign" enterkeyhint="done">
    <div class="actions"><button class="btn white" data-act="go" data-to="title">Cancel</button><button class="btn" data-act="saveNameGo">Save</button></div>`;
}
handlers.saveNameGo = () => {
  const v = (document.getElementById('name-in')?.value || '').trim().slice(0, 16);
  if (!v) { document.getElementById('name-in')?.focus(); return; }
  update((s) => { s.name = v; });
  go('setup');
};

// ---------------------------------------------------------------- drag stickers onto the mech

// Legal drops for a hand card: limb names, 'any' (cards with no target), or Workshop slot indexes (Rush Order).
function dropTargets(id) {
  const acts = legalActions(G).filter((a) => a.t === 'play' && a.id === id);
  return {
    limbs: new Set(acts.filter((a) => a.target).map((a) => a.target)),
    any: acts.some((a) => !a.target && a.slot === undefined) ? acts.find((a) => !a.target && a.slot === undefined) : null,
    slots: new Set(acts.filter((a) => a.slot !== undefined).map((a) => a.slot)),
  };
}

function dropElements() {
  return [...document.querySelectorAll('#box-you .limb[data-limb], .you-rail [data-limb]')];
}

function markDrops(t) {
  for (const el of dropElements()) {
    const k = el.dataset.limb;
    if (t.limbs.has(k)) el.classList.add('drop-ok');
  }
  if (t.any) document.querySelector('.you-stage')?.classList.add('drop-any');
  if (t.slots.size) {
    const you0 = you();
    t.slots.forEach((i) => {
      const w = you0.workshop[i];
      document.querySelectorAll('.dock .slot')[i]?.classList.add('drop-ok');
      if (w?.target) for (const el of dropElements()) if (el.dataset.limb === w.target) el.classList.add('drop-ok');
    });
  }
}

function clearDrops() {
  document.querySelectorAll('.drop-ok, .drop-hover, .drop-any').forEach((el) => el.classList.remove('drop-ok', 'drop-hover', 'drop-any'));
}

// What the finger is over: { limb } or { slot } or { any } or null.
function dropAt(x, y, t) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const slotEl = el.closest('.dock .slot');
  if (slotEl && t.slots.size) {
    const i = [...document.querySelectorAll('.dock .slot')].indexOf(slotEl);
    if (t.slots.has(i)) return { slot: i, el: slotEl };
  }
  // Match by area, not exact pixel: parts have gaps and the finger covers more than one point.
  let limbEl = el.closest('.you-rail [data-limb]');
  if (!limbEl) {
    let best = null, bestArea = Infinity;
    for (const c of document.querySelectorAll('#box-you .limb.drop-ok, #box-you .limb')) {
      const r = c.getBoundingClientRect();
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) {
        const area = r.width * r.height + (c.classList.contains('drop-ok') ? 0 : 1e6);
        if (area < bestArea) { best = c; bestArea = area; }
      }
    }
    limbEl = best;
  }
  if (limbEl) {
    const k = limbEl.dataset.limb;
    if (t.limbs.has(k)) return { limb: k, el: limbEl };
    if (t.slots.size) {
      const i = you().workshop.findIndex((w, j) => t.slots.has(j) && w.target === k);
      if (i >= 0) return { slot: i, el: limbEl };
    }
  }
  if (t.any && el.closest('.you-stage')) return { any: true, el: document.querySelector('.you-stage') };
  return null;
}

const drag = { start: null, active: false, ghost: null, targets: null, over: null, suppressClick: false };

app.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hand]');
  if (!el || ui.screen !== 'battle' || ui.sheet) return;
  drag.start = { x: e.clientX, y: e.clientY, i: Number(el.dataset.hand), el, id: e.pointerId };
});

app.addEventListener('pointermove', (e) => {
  if (!drag.start || e.pointerId !== drag.start.id) return;
  const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
  if (!drag.active) {
    if (Math.hypot(dx, dy) < 8) return;
    const id = you().hand[drag.start.i];
    if (G.active !== 0 || ui.busy || ui.mode !== 'idle' || !canPlay(G, you(), id)) { drag.start = null; return; }
    drag.active = true;
    drag.targets = dropTargets(id);
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.innerHTML = cardSticker(id);
    fx.appendChild(drag.ghost);
    drag.start.el.classList.add('lifted');
    document.body.classList.add('dragging');
    markDrops(drag.targets);
  }
  drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -70%) rotate(-6deg)`;
  const hit = dropAt(e.clientX, e.clientY, drag.targets);
  if (drag.over?.el !== hit?.el) {
    drag.over?.el?.classList.remove('drop-hover');
    hit?.el?.classList.add('drop-hover');
  }
  drag.over = hit;
  e.preventDefault();
}, { passive: false });

function endDrag(e, cancelled) {
  if (!drag.start) return;
  const wasActive = drag.active;
  if (wasActive) {
    const id = you().hand[drag.start.i];
    const hit = cancelled ? null : dropAt(e.clientX, e.clientY, drag.targets);
    drag.ghost?.remove();
    drag.start.el.classList.remove('lifted');
    document.body.classList.remove('dragging');
    clearDrops();
    drag.suppressClick = true;
    setTimeout(() => { drag.suppressClick = false; }, 50);
    if (hit) {
      let a;
      if (hit.slot !== undefined) a = { t: 'play', id, slot: hit.slot };
      else if (hit.limb) a = { t: 'play', id, target: hit.limb };
      else a = drag.targets.any;
      if (a && isLegal(G, a)) step(a);
    }
  }
  drag.start = null; drag.active = false; drag.ghost = null; drag.over = null; drag.targets = null;
}
app.addEventListener('pointerup', (e) => endDrag(e, false));
app.addEventListener('pointercancel', (e) => endDrag(e, true));

app.addEventListener('click', (e) => {
  const handEl = e.target.closest('[data-hand]');
  if (handEl && !ui.sheet) {
    if (!drag.suppressClick) { ui.mode = 'idle'; ui.sel = null; openSheet(cardSheet(Number(handEl.dataset.hand))); }
    return;
  }
  const stop = e.target.closest('[data-stop]');
  const el = e.target.closest('[data-act]');
  // Taps on the sheet body shouldn't close it.
  if (stop && el && !stop.contains(el)) return;
  // Tapping a mech part directly works the same as tapping its tag.
  if (ui.screen === 'battle' && !ui.sheet) {
    const part = e.target.closest('.limb, .core-gem, .pstk');
    if (part && !el) {
      const limb = part.dataset.limb;
      if (part.closest('#box-you') && ui.mode === 'idle' && limb !== 'core') { selectLimb(limb); return; }
      if (part.closest('#box-enemy') && ui.mode === 'target') { handlers.hit({ t: limb }); return; }
      if (part.closest('#box-you') && ui.mode !== 'idle' && limb !== ui.sel?.limb && limb !== 'core') { selectLimb(limb); return; }
    }
  }
  if (!el) return;
  const fn = handlers[el.dataset.act];
  if (fn) fn(el.dataset, el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.sheet) closeSheet();
  else if (e.key === 'Escape' && ui.mode !== 'idle') handlers.cancel();
  if (e.key === 'Enter' && document.activeElement?.id === 'name-in') (ui.screen === 'settings' ? handlers.saveNameSettings : handlers.saveNameGo)();
});

// Re-fit the hand when the viewport changes (rotation, Safari toolbar).
addEventListener('resize', () => { if (ui.screen === 'battle') decorateBattle(); });

// Offline support once installed.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Debug helper for testing in the browser console.
window.__mw = { get G() { return G; }, ui, load, resetAll, go, render, step, handlers };

render();

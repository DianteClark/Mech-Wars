// Mech Wars — app shell: screens, battle UI, Tower flow.
import {
  CARDS, FRAMES, FRAME_ORDER, PILOTS, PILOT_ORDER, DOCTRINES, DOCTRINE_ORDER, TWISTS, LIMBS, LIMB_NAMES,
  RULES, UNLOCK_COST,
} from '../engine/data.js';
import {
  createGame, applyAction, legalActions, isLegal, attackModes, attackProfile, previewHit, fireCost,
  canPlay, playTargets, cardCost, buildPlan, energyOutput, overdriveCost, slotCount, isExposed,
  hasOracle, apMax, statVal,
} from '../engine/game.js';
import { chooseTurn, LEVELS } from '../engine/ai.js';
import { mechSVG, iconSVG, cardIcon, logoSVG, chipPos, TYPE_COLORS, TYPE_NAMES, INK } from './art.js';
import { load, save, update, resetAll } from './store.js';
import { newRun, startBattle, twistFor, enemyFor, aiLevel, reward, isBoss } from './tower.js';

const app = document.getElementById('app');
const fx = document.getElementById('fx');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// iOS: block pinch-zoom gestures that slip past the viewport meta.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

const LEVEL_NAMES = ['Rookie', 'Trained', 'Veteran', 'Ace', 'Relentless'];

const ui = {
  screen: 'title',
  sheet: null,
  // battle
  mode: 'idle', // idle | pickmode | target
  sel: null,
  busy: false,
  ticker: '',
  tickerSide: '',
  // setup
  pick: { frame: 'brakka', pilot: 'redline', doctrine: 'standard' },
  setupMode: 'ranked',
  boardTab: 'all',
  result: null,
};

let G = null;   // live game state
let logSeen = 0;

// ---------------------------------------------------------------- small art bits

const GEAR = `<svg class="gear" viewBox="0 0 24 24"><path d="M12 2l2 3 3.5-.8.6 3.5 3.2 1.6-1.6 3.2 1.6 3.2-3.2 1.6-.6 3.5L14 19l-2 3-2-3-3.5.8-.6-3.5L2.7 14.7l1.6-3.2-1.6-3.2 3.2-1.6.6-3.5L10 5z" fill="#FFC929" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.8"/></svg>`;
const BOLT = (off) => `<svg class="pip ${off ? 'off' : ''}" viewBox="0 0 15 20"><path d="M9 1L2 11h5l-2 8 8-11H8l1-7z" fill="#FFC929" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const SHIELD = `<svg class="arm" viewBox="0 0 12 12"><path d="M1.5 1.5h9v4.5Q10.5 10 6 11.2 1.5 10 1.5 6z" fill="#8FA3D9" stroke="${INK}" stroke-width="1.5"/></svg>`;
const FIST = `<svg class="icon" viewBox="0 0 18 18"><rect x="2.5" y="4" width="13" height="10" rx="3.5" fill="#FFC929" stroke="${INK}" stroke-width="1.8"/><path d="M6.5 4v6M9.5 4v6M12.5 4v6" stroke="${INK}" stroke-width="1.5"/></svg>`;
const CLOCK = `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M6 3.6V6.2L7.6 7.2" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
const scrapPill = () => `<span class="scrap">${GEAR}${load().scrap}</span>`;

// ---------------------------------------------------------------- AI worker

let worker = null;
let workerReqs = new Map();
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
  const views = { title, setup, intro, battle: battleView, result: resultView, hangar, board: boardView, manual };
  app.innerHTML = views[ui.screen]() + (ui.sheet ? `<div class="sheet-wrap" data-act="closeSheet"><div class="sheet" data-stop>${ui.sheet}</div></div>` : '');
  if (ui.screen === 'battle') decorateBattle();
}

function openSheet(html) { ui.sheet = html; render(); }
function closeSheet() { ui.sheet = null; render(); }

// ---------------------------------------------------------------- title

function title() {
  const s = load();
  const run = s.run;
  const parade = FRAME_ORDER.map((f, i) => mechSVG(f).replace('class="mech-svg"', `class="mech-svg m${i}"`)).join('');
  const runBtn = run
    ? `<button class="btn" data-act="continue">Continue run<span class="sub">${run.mode === 'ranked' ? 'Ranked' : 'Practice'} · ${FRAMES[run.frame].name} · Floor ${run.floor}</span></button>
       <button class="btn-ghost" data-act="abandon">Abandon this run</button>`
    : `<button class="btn" data-act="setup" data-mode="ranked">Climb the Tower<span class="sub">Ranked · one loss ends the run</span></button>
       <button class="btn white" data-act="setup" data-mode="casual">Practice climb<span class="sub">Retry any floor · half scrap</span></button>`;
  return `<div class="screen title">
    ${logoSVG()}
    <div class="parade">${parade}</div>
    <div class="menu">
      ${runBtn}
      <div class="menu-row">
        <button class="btn small white" data-act="go" data-to="hangar">Hangar</button>
        <button class="btn small white" data-act="go" data-to="board">Leaderboard</button>
      </div>
      <div class="title-foot">${scrapPill()}<button class="btn-ghost" data-act="go" data-to="manual">How to play</button></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- setup

function setup() {
  const s = load();
  const pk = ui.pick;
  const frames = FRAME_ORDER.map((f) => {
    const locked = !s.unlocked.includes(f);
    return `<button class="frame-card ${pk.frame === f ? 'selected' : ''} ${locked ? 'locked' : ''}" data-act="pickFrame" data-v="${f}">
      <div class="fc-art">${mechSVG(f)}</div>
      ${locked ? `<span class="lock-tag">${GEAR}${UNLOCK_COST[f]}</span>` : ''}
      <h3>${FRAMES[f].name}</h3><div class="role">${FRAMES[f].role}</div>
    </button>`;
  }).join('');
  const fr = FRAMES[pk.frame];
  const sig = Object.entries(CARDS).find(([, c]) => c.frame === pk.frame && c.sig);
  const pilots = PILOT_ORDER.map((p) => `<button class="choice ${pk.pilot === p ? 'selected' : ''}" data-act="pickPilot" data-v="${p}">
    <strong>${PILOTS[p].name}</strong><span class="tag">${PILOTS[p].style}</span><p>${PILOTS[p].text}</p></button>`).join('');
  const docs = DOCTRINE_ORDER.map((d) => `<button class="choice ${pk.doctrine === d ? 'selected' : ''}" data-act="pickDoctrine" data-v="${d}">
    <strong>${DOCTRINES[d].name}</strong><span></span><p>${DOCTRINES[d].text}</p></button>`).join('');
  const locked = !s.unlocked.includes(pk.frame);
  return `<div class="screen">
    <div class="topbar"><button class="btn small white" data-act="go" data-to="title">Back</button>
      <h2 class="ink-text">${ui.setupMode === 'ranked' ? 'Ranked climb' : 'Practice climb'}</h2>${scrapPill()}</div>
    <div class="scroll stack">
      <div><div class="section-title ink-text">Frame</div><div class="frame-grid">${frames}</div></div>
      <div class="detail-panel">
        <p><b style="font-family:var(--display);font-weight:400;font-size:18px;color:var(--ink)">${fr.name}</b> · ${fr.blurb}</p>
        <div class="kv"><b>Trait</b><p>${fr.trait}</p></div>
        <div class="kv"><b>Signature</b><p>${sig[1].name}: ${sig[1].text.replace('Signature. ', '')}</p></div>
      </div>
      <div><div class="section-title ink-text">Pilot</div><div class="choice-list">${pilots}</div></div>
      <div><div class="section-title ink-text">Crew doctrine</div><div class="choice-list">${docs}</div></div>
    </div>
    <div class="bottom-cta">${locked
      ? `<button class="btn" data-act="unlock" data-v="${pk.frame}" ${s.scrap < UNLOCK_COST[pk.frame] ? 'disabled' : ''}>Unlock ${fr.name}<span class="sub">${UNLOCK_COST[pk.frame]} scrap · you have ${s.scrap}</span></button>`
      : `<button class="btn" data-act="startRun">Start climb</button>`}</div>
  </div>`;
}

// ---------------------------------------------------------------- floor intro

function intro() {
  const run = load().run;
  const floor = run.floor;
  const enemy = enemyFor(run, floor);
  const twist = twistFor(run, floor);
  const lvl = LEVEL_NAMES[LEVELS.indexOf(aiLevel(floor))];
  return `<div class="screen floor-intro">
    <div class="floor-num ink-text"><small>Floor</small>${floor}</div>
    ${isBoss(floor) ? '<div class="boss-tag">Boss floor · enemy limbs +2 HP</div>' : ''}
    <div class="intro-mech pop-in">${mechSVG(enemy.frame)}</div>
    <p class="versus-line"><b class="ink-text">${FRAMES[enemy.frame].name}</b><br>${FRAMES[enemy.frame].role} · pilot ${PILOTS[enemy.pilot].name}<br>${DOCTRINES[enemy.doctrine].name} crew</p>
    <p class="muted">Enemy skill: ${lvl}</p>
    ${twist ? `<div class="twist-banner"><b>Twist: ${TWISTS[twist].name}</b>${TWISTS[twist].text}</div>` : ''}
    <div class="menu" style="width:min(100%,320px)">
      <button class="btn red" data-act="fight">Fight</button>
      <button class="btn-ghost" data-act="go" data-to="title">Back to title</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- battle view

function coreGauge(p, side) {
  const pct = (p.core / RULES.coreMax) * 100;
  const color = p.core >= 15 ? 'var(--hazard)' : p.core >= 8 ? 'var(--orange)' : 'var(--alarm)';
  return `<div class="core-gauge" ${side === 'you' ? 'data-act="coreInfo"' : ''}>
    <span class="core-num ink-text">${p.core}</span>
    <div class="core-bar"><div class="core-fill" style="width:${pct}%;background:${color}"></div>
      <i class="core-mark" style="left:${(15 / 20) * 100}%"></i><i class="core-mark" style="left:${(8 / 20) * 100}%"></i></div>
    <span class="core-label">${energyOutput(p)}⚡/turn</span>
  </div>`;
}

function slotsView(p, enemy) {
  const n = slotCount(p);
  const see = !enemy || hasOracle(G.players[0]);
  let h = '';
  for (let i = 0; i < n; i++) {
    const it = p.workshop[i];
    const rushT = ui.rushPick && !enemy && it && it.timer > 1;
    if (!it) h += `<button class="slot" data-act="slotInfo" data-i="${i}" data-side="${enemy ? 'e' : 'y'}" aria-label="Empty Workshop slot"></button>`;
    else if (!see) h += `<button class="slot full hidden-item" data-act="slotInfo" data-i="${i}" data-side="e" aria-label="Hidden build">?<span class="t">${it.timer}</span></button>`;
    else h += `<button class="slot full ${rushT ? 'targetable' : ''}" data-act="${rushT ? 'rushSlot' : 'slotInfo'}" data-i="${i}" data-side="${enemy ? 'e' : 'y'}" aria-label="${CARDS[it.id].name}">${cardIcon(it.id)}<span class="t">${it.timer}</span></button>`;
  }
  return `<div class="slots ${enemy ? 'enemy-slots' : ''}">${h}</div>`;
}

function mechBox(p, side) {
  const you = G.players[0];
  const targeting = side === 'enemy' && ui.mode === 'target';
  let chips = '';
  let prof = null;
  if (targeting) prof = attackProfile(you, ui.sel.limb, ui.sel.mode);
  for (const k of LIMBS) {
    const l = p.limbs[k];
    const [x, y] = chipPos(p.frame, k);
    let cls = 'chip';
    let txt;
    if (!l.alive) { cls += ' dead'; txt = 'Down'; }
    else {
      txt = `${l.hp}/${l.max}${l.plating ? SHIELD + CARDS[l.plating.id].armor : ''}`;
      if (l.hp <= l.max / 3) cls += ' low';
    }
    let act = '';
    if (targeting && l.alive) {
      const r = previewHit(you, p, k, prof);
      cls += ' target' + (r.limb === 0 && r.core === 0 ? ' blocked' : '');
      txt = r.limb === 0 && r.core === 0 ? 'Blocked' : `−${r.limb}${r.core ? ` · core −${r.core}` : ''}`;
      act = `data-act="hit" data-t="${k}"`;
    }
    if (side === 'you' && ui.mode === 'idle' && canAct(k)) { cls += ' act'; act = `data-act="limb" data-limb="${k}"`; txt = FIST + txt; }
    chips += `<button class="${cls}" style="left:${x}%;top:${y}%" ${act} aria-label="${LIMB_NAMES[k]}">${txt}</button>`;
  }
  if (isExposed(p)) {
    const [x, y] = chipPos(p.frame, 'core');
    let cls = 'chip core-chip', txt = 'Core open', act = '';
    if (targeting) {
      const r = previewHit(you, p, 'core', prof);
      cls += ' target' + (r.core === 0 ? ' blocked' : '');
      txt = r.core === 0 ? 'Blocked' : `Core −${r.core}`;
      act = 'data-act="hit" data-t="core"';
    }
    chips += `<button class="${cls}" style="left:${x}%;top:${y}%" ${act}>${txt}</button>`;
  }
  const overlay = side === 'enemy'
    ? `<div class="foe-overlay"><div class="foe-col"><span class="ov-label">Workshop</span>${slotsView(p, true)}</div>
        <div class="foe-col right"><span class="ov-label">Hand</span><span class="hand-backs" aria-label="${p.hand.length} cards">${'<i></i>'.repeat(Math.min(p.hand.length, 8))}</span></div></div>`
    : '';
  return `<div class="mech-zone ${side}-zone">${overlay}<div class="mech-box" id="box-${side}">${mechSVG(p.frame, p)}${chips}</div></div>`;
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
  const n = you.hand.length;
  const cards = you.hand.map((id, i) => {
    const c = CARDS[id];
    const ok = G.active === 0 && !ui.busy && canPlay(G, you, id);
    const t = c.type === 'order' ? '' : `<span class="time" aria-label="turns to build">${CLOCK}${buildPlan(you, id).time}</span>`;
    return `<button class="card ${ok ? 'playable' : 'cant'} ${c.sig ? 'sig' : ''}" data-act="card" data-i="${i}" aria-label="${c.name}">
      <span class="cost">${cardCost(you, id)}</span>${t}
      <span class="band" style="background:${TYPE_COLORS[c.type]}">${cardIcon(id)}</span>
      <span class="nm">${c.name}</span><span class="ty">${TYPE_NAMES[c.type]}</span>
    </button>`;
  }).join('');
  return `<div class="hand" id="hand" data-n="${n}">${cards || '<p class="muted" style="align-self:center">Your hand is empty.</p>'}</div>`;
}

function trayView() {
  const you = G.players[0];
  if (ui.mode === 'pickmode') {
    const btns = attackModes(you, ui.sel.limb).map((m) => {
      const prof = attackProfile(you, ui.sel.limb, m);
      const fc = m === 'fire' ? fireCost(you, ui.sel.limb) : 0;
      const name = m === 'fire' ? CARDS[you.limbs[ui.sel.limb].mount.id].name : m === 'punch' ? 'Punch' : 'Kick';
      return `<button class="btn small ${m === 'fire' ? 'red' : ''}" data-act="mode" data-m="${m}" ${fc > you.energy ? 'disabled' : ''}>${name} · ${prof.dmg}${fc ? ` (${fc}⚡)` : ''}</button>`;
    }).join('');
    return `<div class="tray"><div class="tray-title">${LIMB_NAMES[ui.sel.limb]}: choose an attack</div>
      <div class="tray-row">${btns}<button class="btn small white" data-act="cancel">Cancel</button></div></div>`;
  }
  if (ui.mode === 'target') {
    const prof = attackProfile(you, ui.sel.limb, ui.sel.mode);
    const kws = [prof.snipe && 'Snipe', prof.pierce && `Pierce ${prof.pierce}`, prof.shred && 'Shred'].filter(Boolean).join(' · ');
    return `<div class="tray"><div class="tray-title">Tap an enemy part to hit it for ${prof.dmg}${kws ? ` (${kws})` : ''}</div>
      <div class="tray-row"><button class="btn small white" data-act="cancel">Cancel</button></div></div>`;
  }
  if (ui.rushPick) {
    return `<div class="tray"><div class="tray-title">Tap a glowing Workshop build to rush it</div>
      <div class="tray-row"><button class="btn small white" data-act="cancel">Cancel</button></div></div>`;
  }
  return '';
}

function battleView() {
  const you = G.players[0], foe = G.players[1];
  const myTurn = G.active === 0 && !ui.busy && G.winner === null;
  const tray = trayView();
  const ap = `<span class="mini-stat" title="Actions left">${FIST}${you.ap}/${apMax(you)}</span>`;
  const energy = `<span class="pips" aria-label="${you.energy} energy">${Array.from({ length: Math.max(you.energy, Math.min(you.turnsTaken + 1, energyOutput(you))) }, (_, i) => BOLT(i >= you.energy)).join('')}</span>`;
  const odOk = myTurn && legalActions(G).some((a) => a.t === 'overdrive');
  const stuck = myTurn && !anyMoves();
  const tickerCls = G.active === 1 || ui.busy ? 'enemy-turn' : (ui.tickerSide === 'you' ? 'you' : '');
  return `<div class="screen battle">
    <div class="side-bar enemy">
      <button class="nameplate" data-act="foeInfo"><b>${FRAMES[foe.frame].name}</b><span>Floor ${load().run.floor} · ${PILOTS[foe.pilot].style}</span></button>
      ${coreGauge(foe, 'enemy')}
    </div>
    ${mechBox(foe, 'enemy')}
    <div class="ticker ${tickerCls}" id="ticker">${esc(ui.ticker || 'Your turn')}</div>
    ${mechBox(you, 'you')}
    <div class="you-bar">
      <div class="you-row">${coreGauge(you, 'you')}${energy}${ap}</div>
      <div class="you-row">
        ${slotsView(you, false)}
        <button class="chip-btn od" data-act="overdrive" ${odOk ? '' : 'disabled'} aria-label="Overdrive">${iconSVG('surge')}OD</button>
        <button class="chip-btn" data-act="doctrine" aria-label="Crew doctrine">${DOCTRINES[you.doctrine].short}</button>
        <button class="btn end-btn ${stuck ? 'nudge' : ''}" data-act="endTurn" ${myTurn ? '' : 'disabled'}>${G.active === 0 ? 'End turn' : 'Enemy…'}</button>
      </div>
    </div>
    <div class="hand-zone">${tray || handView()}</div>
  </div>`;
}

function decorateBattle() {
  const you = G.players[0];
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
  if (hand && hand.children.length > 1) {
    const cw = hand.children[0].getBoundingClientRect().width;
    const n = hand.children.length;
    const avail = hand.clientWidth - 8;
    const ov = Math.max(-10, (n * cw - avail) / (n - 1));
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
  const t = events.map(describe).filter(Boolean);
  if (t.length) { ui.ticker = t[t.length - 1]; ui.tickerSide = events[events.length - 1].p === 0 ? 'you' : ''; }
  render();
  animate(events);
  if (G.winner !== null) setTimeout(finishBattle, 1400);
}

function describe(e) {
  const me = e.p === 0;
  const who = me ? 'You' : 'Enemy';
  const their = me ? 'enemy' : 'your';
  const seeFoe = hasOracle(G.players[0]);
  switch (e.type) {
    case 'attack': {
      const verb = e.mode === 'punch' ? 'punched' : e.mode === 'kick' ? 'kicked' : `fired ${CARDS[e.weapon].name} at`;
      const tgt = e.target === 'core' ? `${their} Core` : `${their} ${LIMB_NAMES[e.target].toLowerCase()}`;
      if (!e.limb && !e.core) return `${who} ${verb} ${tgt}. A Guard drone blocked it.`;
      const parts = [];
      if (e.limb) parts.push(`${e.limb}`);
      if (e.core && e.target !== 'core') parts.push(`${e.core} to Core`);
      if (e.target === 'core') parts.splice(0, parts.length, `${e.core}`);
      return `${who} ${verb} ${tgt} for ${parts.join(' + ')}.${e.destroyed ? ' Limb destroyed!' : ''}`;
    }
    case 'queued': return me ? `Crew started ${CARDS[e.id].name}. Ready in ${e.time} turns.` : (seeFoe ? `Enemy started ${CARDS[e.id].name}.` : 'Enemy crew started a hidden build.');
    case 'built': return `${me ? 'Your' : 'Enemy'} ${CARDS[e.id].name} is online${e.target ? ` on the ${LIMB_NAMES[e.target].toLowerCase()}` : ''}.`;
    case 'buildReturned': return `${me ? 'Your' : 'Enemy'} ${CARDS[e.id].name} had nowhere to go and went back to hand.`;
    case 'overdrive': return `${who} overdrove the Core: +2 energy, −${e.cost} Core.`;
    case 'order': return `${who} ordered the crew: ${DOCTRINES[e.doctrine].name}.`;
    case 'order-card': return `${who} used ${CARDS[e.id].name}.`;
    case 'delayed': return `${e.p === 0 ? 'Your' : 'Enemy'} build was delayed a turn.`;
    case 'turn': return e.p === 0 ? 'Your turn' : 'Enemy turn';
    default: return '';
  }
}

function floatAt(el, text, cls = '') {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float ${cls}`;
  d.textContent = text;
  // Keep stickers on screen (and clear of the notch).
  const x = Math.min(innerWidth - 70, Math.max(70, r.left + r.width / 2));
  const y = Math.min(innerHeight - 60, Math.max(90, r.top + r.height / 2));
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1100);
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
      retrigger(atkBox, e.p === 0 ? 'lunge-up' : 'lunge-down');
      const part = defBox.querySelector(e.target === 'core' ? '.core-gem' : `.limb[data-limb="${e.target}"]`);
      const chip = e.target === 'core' ? defBox.querySelector('.core-chip') || part : defBox.querySelector(`.chip[aria-label="${LIMB_NAMES[e.target]}"]`);
      setTimeout(() => {
        retrigger(part, 'flash');
        if (!reduced) retrigger(defBox, 'shake');
        if (!e.limb && !e.core) floatAt(chip, 'Blocked!', 'blocked');
        else {
          if (e.limb) floatAt(chip, `−${e.limb}`);
          if (e.core) setTimeout(() => floatAt(defBox.querySelector('.core-gem'), `Core −${e.core}`, 'core'), e.limb ? 220 : 0);
          if (e.destroyed) setTimeout(() => floatAt(defBox, 'Limb down!', 'big'), 300);
        }
        if (navigator.vibrate) navigator.vibrate(e.destroyed ? 60 : 20);
      }, 140);
    } else if (e.type === 'built') {
      const box = document.getElementById(e.p === 0 ? 'box-you' : 'box-enemy');
      const part = e.target ? box.querySelector(`.limb[data-limb="${e.target}"]`) : null;
      retrigger(part, 'pop-in');
      floatAt(part || box, `${CARDS[e.id].name}!`, 'info');
    } else if (e.type === 'overdrive') {
      if (!reduced) retrigger(app, 'screen-shake');
      floatAt(document.querySelector(e.p === 0 ? '#box-you .core-gem' : '#box-enemy .core-gem'), 'Overdrive!', 'info');
    } else if (e.type === 'delayed') {
      floatAt(document.querySelector(e.p === 0 ? '.you-bar .slots' : '.enemy-slots'), '+1 turn', 'info');
    }
  }
}

async function enemyTurn() {
  if (ui.enemyRunning) return;
  ui.enemyRunning = true;
  ui.busy = true;
  render();
  const run = load().run;
  await sleep(450);
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
      if (a.t === 'end') await sleep(250);
      step(a);
      if (a.t !== 'end') await sleep(a.t === 'attack' ? 900 : 650);
      if (a.t === 'play' && CARDS[a.id].effect === 'draw') { replan = true; break; }
    }
    if (!replan && G.winner === null && G.active === 1) step({ t: 'end' });
  }
  if (G.winner === null && G.active === 1) step({ t: 'end' });
  ui.busy = false;
  ui.enemyRunning = false;
  if (ui.screen === 'battle') render();
}

function finishBattle() {
  if (ui.screen !== 'battle') return;
  const s = load();
  const run = s.run;
  const win = G.winner === 0;
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
    go('result', { result: { win: true, reward: r, cleared } });
  } else {
    s.stats.losses++;
    if (run.mode === 'ranked') {
      const entry = recordRanked(run);
      s.run = null;
      save();
      go('result', { result: { win: false, ranked: true, cleared: run.floor - 1, entry, frame: run.frame, earned: run.earned } });
    } else {
      run.attempt++;
      run.battle = null;
      run.actions = [];
      save();
      go('result', { result: { win: false, ranked: false, floor: run.floor } });
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
  if (G.winner !== null) setTimeout(finishBattle, 600);
  else if (G.active === 1) enemyTurn();
}

// ---------------------------------------------------------------- results

function resultView() {
  const r = ui.result;
  const run = load().run;
  if (r.win) {
    const next = run.floor;
    const tw = twistFor(run, next);
    return `<div class="screen result">
      <div class="intro-mech result-mech pop-in">${mechSVG(run.frame)}</div>
      <h1 class="ink-text">Floor ${r.cleared}<br>cleared</h1>
      <div class="reward-pop pop-in">${GEAR}+${r.reward}</div>
      ${tw ? `<div class="twist-banner"><b>Next floor twist: ${TWISTS[tw].name}</b>${TWISTS[tw].text}</div>` : ''}
      ${isBoss(next) ? '<div class="boss-tag">Boss up next</div>' : ''}
      <div class="menu" style="width:min(100%,320px)">
        <button class="btn" data-act="nextFloor">Climb to floor ${next}</button>
        ${run.mode === 'casual' ? '<button class="btn-ghost" data-act="endCasual">Bank scrap and leave</button>' : '<button class="btn-ghost" data-act="go" data-to="title">Take a break</button>'}
      </div>
    </div>`;
  }
  if (r.ranked) {
    const rank = load().board.indexOf(load().board.find((e) => e.date === r.entry.date)) + 1;
    return `<div class="screen result">
      <div class="intro-mech result-mech wrecked">${mechSVG(r.frame)}</div>
      <h1 class="ink-text">Mech down</h1>
      <p style="font-size:18px">${FRAMES[r.frame].name} cleared <b>${r.cleared}</b> floor${r.cleared === 1 ? '' : 's'}.</p>
      <div class="reward-pop">${GEAR}${r.earned} earned</div>
      <p class="muted">Leaderboard rank: ${rank}</p>
      <div class="menu" style="width:min(100%,320px)">
        <button class="btn" data-act="go" data-to="board">View leaderboard</button>
        <button class="btn white" data-act="go" data-to="title">Back to title</button>
      </div>
    </div>`;
  }
  return `<div class="screen result">
    <div class="intro-mech result-mech wrecked">${mechSVG(run.frame)}</div>
    <h1 class="ink-text">Knocked<br>down</h1>
    <p style="font-size:17px">Practice run: try floor ${r.floor} again with a new draw.</p>
    <div class="menu" style="width:min(100%,320px)">
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
    const counts = {};
    for (const id of fr.deck) counts[id] = (counts[id] || 0) + 1;
    const unique = Object.keys(counts).filter((id) => CARDS[id].frame === f);
    return `<div class="detail-panel">
      <div style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:center">
        <div class="fc-art" style="border-radius:14px;background:var(--bp-deep)">${mechSVG(f)}</div>
        <div><h3 style="font-size:24px">${fr.name}</h3><p><b>${fr.role}.</b> ${fr.blurb}</p>
        ${s.bestCasual[f] ? `<p class="muted" style="color:#4A5374">Best practice floor: ${s.bestCasual[f]}</p>` : ''}</div>
      </div>
      <div class="kv"><b>Trait</b><p>${fr.trait}</p></div>
      <div class="kv"><b>Arsenal</b><p>${unique.map((id) => `${CARDS[id].sig ? '★ ' : ''}${CARDS[id].name}${counts[id] > 1 ? ` ×${counts[id]}` : ''}`).join(', ')}, plus 12 shared crew cards.</p></div>
      ${locked ? `<button class="btn small" style="margin-top:14px;width:100%" data-act="unlock" data-v="${f}" ${s.scrap < UNLOCK_COST[f] ? 'disabled' : ''}>Unlock for ${UNLOCK_COST[f]} scrap</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="screen">
    <div class="topbar"><button class="btn small white" data-act="go" data-to="title">Back</button><h2 class="ink-text">Hangar</h2>${scrapPill()}</div>
    <div class="scroll stack">${items}<p class="muted" style="text-align:center">More Frames are on the way. Earn scrap in the Tower to unlock them.</p></div>
  </div>`;
}

// ---------------------------------------------------------------- leaderboard

function boardView() {
  const s = load();
  const tabs = ['all', ...FRAME_ORDER].map((t) => `<button class="tab ${ui.boardTab === t ? 'on' : ''}" data-act="boardTab" data-v="${t}">${t === 'all' ? 'All Frames' : FRAMES[t].name}</button>`).join('');
  const rows = s.board.filter((e) => ui.boardTab === 'all' || e.frame === ui.boardTab).slice(0, 25);
  const list = rows.length
    ? rows.map((e, i) => `<div class="board-row ${e.name === s.name ? 'me' : ''}"><span class="rank">${i + 1}</span>
        <span class="who"><b>${esc(e.name)}</b><span>${FRAMES[e.frame].name} · ${PILOTS[e.pilot].name} · ${new Date(e.date).toLocaleDateString()}</span></span>
        <span class="fl">${e.floor}</span></div>`).join('')
    : `<div class="empty"><p>No ranked runs yet.</p><p class="muted">Finish a ranked climb to get on the board.</p></div>`;
  return `<div class="screen">
    <div class="topbar"><button class="btn small white" data-act="go" data-to="title">Back</button><h2 class="ink-text">Leaderboard</h2><span style="width:60px"></span></div>
    <div class="tabs">${tabs}</div>
    <div class="scroll"><div class="board">${list}</div>
      <p class="muted" style="text-align:center;margin-top:18px;font-size:13px">Floors cleared in ranked climbs on this device. A global board comes with online play.</p></div>
  </div>`;
}

// ---------------------------------------------------------------- manual

function manual() {
  return `<div class="screen">
    <div class="topbar"><button class="btn small white" data-act="go" data-to="title">Back</button><h2 class="ink-text">How to play</h2><span style="width:60px"></span></div>
    <div class="scroll manual">
      <div class="detail-panel"><h3>Win the fight</h3><p>Destroy the enemy Core. It’s shielded by four limbs: head, two arms and legs. Break any two limbs and the Core is open to attack.</p></div>
      <div class="detail-panel"><h3>Your Core is your energy</h3><p>Each turn your Core makes energy to spend on cards. A damaged Core makes less:</p>
        <ul><li>15–20 Core: 4 energy</li><li>8–14 Core: 3 energy</li><li>1–7 Core: 2 energy</li></ul>
        <p style="margin-top:6px">Energy ramps up over your first turns. <b>Overdrive</b> gives +2 energy now for 3 Core, once per turn.</p></div>
      <div class="detail-panel"><h3>Fight while the crew builds</h3><p>Your mech starts bare. Cards go into the <b>Workshop</b> and finish after a few turns (the number in the corner). Weapons and upgrades mount on a limb. If that limb is destroyed, whatever is on it is lost.</p>
        <p style="margin-top:6px">You start with 2 actions per turn (1 if your legs are down). Each limb can act once: punch with an arm, kick with your legs, or fire a mounted weapon.</p></div>
      <div class="detail-panel"><h3>Keywords</h3><ul>
        <li><b>Guard drones</b> block 3 damage from one hit, then pop.</li>
        <li><b>Snipe</b> ignores Guard drones.</li>
        <li><b>Pierce</b> sends some damage straight to the Core, even while it’s shielded.</li>
        <li><b>Shred</b> deals +2 to limbs but 2 less to the Core.</li>
        <li><b>Armor</b> on plating reduces each hit on that limb.</li></ul></div>
      <div class="detail-panel"><h3>Crew doctrine</h3><p>Your doctrine sets how builds come out: faster and weaker, slower and stronger, or specialized. Your pilot can order a doctrine change for 2 energy, but their bonus switches off for that turn.</p></div>
      <div class="detail-panel"><h3>The Battle Tower</h3><p>Every floor is a fresh fight against a tougher AI. Twists change the rules for a couple of floors, and every fifth floor is a boss. Ranked climbs end at your first loss and go on the leaderboard. Practice climbs let you retry for half the scrap.</p></div>
      <div class="detail-panel"><h3>Hidden info</h3><p>You can’t see what the enemy is building or holding, and the AI can’t see yours. It reads the board and plays the odds, just like you.</p></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- sheets

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
  else if (c.type !== 'order' && p.workshop.length >= slotCount(p)) reason = 'Your Workshop is full.';
  else if (!ok) reason = c.effect === 'rebuild' ? 'No destroyed limb to rebuild.' : c.effect === 'repair' ? 'No damaged limb to repair.' : c.effect === 'rush' ? 'Nothing in the Workshop to rush.' : 'Can’t be played right now.';

  const stats = [];
  stats.push(`<span class="stat">${cost} energy</span>`);
  if (plan) {
    stats.push(`<span class="stat">Ready in ${plan.time} turns</span>`);
    if (plan.mod) stats.push(`<span class="stat">${plan.mod > 0 ? '+' : ''}${plan.mod} quality (${DOCTRINES[p.doctrine].short})</span>`);
    if (c.stat && plan.mod) {
      const [k] = c.stat;
      stats.push(`<span class="stat">${k === 'dmg' ? 'Damage' : k === 'hp' ? 'HP' : k === 'punch' ? 'Punch bonus' : k === 'kick' ? 'Kick bonus' : 'Amount'}: ${statVal(id, k, plan.mod)}</span>`);
    }
  }
  if (c.slots) stats.push(`<span class="stat">Fits: ${c.slots.map((k) => LIMB_NAMES[k]).join(', ')}</span>`);

  let actions = '';
  if (ok) {
    if (c.effect === 'rush') {
      actions = `<button class="btn" data-act="startRush" data-id="${id}">Pick a build to rush</button>`;
    } else {
      const targets = playTargets(G, p, id);
      const verb = c.type === 'order' ? 'Use' : c.effect === 'repair' ? 'Repair' : c.effect === 'rebuild' ? 'Rebuild' : (c.type === 'plating' ? 'Plate' : c.slots ? 'Mount on' : 'Build');
      actions = targets.map((t) => `<button class="btn opt" data-act="play" data-id="${id}" ${t ? `data-t="${t}"` : ''}>${verb}${t ? ` ${LIMB_NAMES[t].toLowerCase()}${c.effect === 'repair' ? ` (${p.limbs[t].hp}/${p.limbs[t].max})` : ''}` : ''}</button>`).join('');
      if (c.slots && targets.some((t) => p.limbs[t].mount && c.type !== 'plating')) actions += `<p class="note">Mounting on a limb that already has a part replaces it.</p>`;
    }
  } else {
    actions = `<p class="note"><b>${reason}</b></p>`;
  }
  return `<div class="big-card-art" style="background:${TYPE_COLORS[c.type]}">${cardIcon(id)}</div>
    <h3>${c.sig ? '★ ' : ''}${c.name}</h3><div class="sub-line">${TYPE_NAMES[c.type]}${c.frame ? ` · ${FRAMES[c.frame].name}` : ''}</div>
    <p>${c.text}</p><div class="stats">${stats.join('')}</div>
    ${actions}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function doctrineSheet() {
  const p = you();
  const myTurn = G.active === 0 && !ui.busy;
  const can = myTurn && !p.flags.order && p.energy >= RULES.orderCost;
  const list = DOCTRINE_ORDER.map((d) => {
    const cur = d === p.doctrine;
    return `<button class="choice ${cur ? 'selected' : ''}" data-act="${cur ? 'noop' : 'order'}" data-v="${d}" ${!cur && !can ? 'disabled' : ''} style="margin-top:12px">
      <strong>${DOCTRINES[d].name}</strong><span class="tag">${cur ? 'Current' : `${RULES.orderCost}⚡`}</span><p>${DOCTRINES[d].text}</p></button>`;
  }).join('');
  return `<h3>Crew doctrine</h3>
    <p>Switching is a pilot order: it costs ${RULES.orderCost} energy and ${PILOTS[p.pilot].name}’s bonus is off for the rest of this turn. Builds already in the Workshop keep their old plan.${p.flags.order ? ' <b>You already gave an order this turn.</b>' : ''}</p>
    ${list}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function foeSheet() {
  const f = G.players[1];
  const fr = FRAMES[f.frame];
  const sig = Object.values(CARDS).find((c) => c.frame === f.frame && c.sig);
  const run = load().run;
  const tw = run.battle.twist;
  const me = you();
  return `<h3>${fr.name}</h3><div class="sub-line">${fr.role} · ${PILOTS[f.pilot].name} (${PILOTS[f.pilot].style})</div>
    <p><b>Trait:</b> ${fr.trait}</p>
    <p><b>Signature:</b> ${sig.name}. ${sig.text.replace('Signature. ', '')}</p>
    <p><b>Pilot:</b> ${PILOTS[f.pilot].text}</p>
    <p><b>Doctrine:</b> ${DOCTRINES[f.doctrine].name}. ${DOCTRINES[f.doctrine].text}</p>
    <p><b>Guard drones:</b> ${f.guard} · <b>Energy:</b> ${energyOutput(f)}/turn · <b>Hand:</b> ${f.hand.length} cards</p>
    ${tw ? `<p><b>Twist: ${TWISTS[tw].name}.</b> ${TWISTS[tw].text}</p>` : ''}
    <p class="note">Your pilot: ${PILOTS[me.pilot].name}. ${PILOTS[me.pilot].text}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button>
      <button class="btn red" data-act="forfeit">Forfeit</button></div>`;
}

function slotSheet(i, side) {
  const p = side === 'e' ? G.players[1] : you();
  const it = p.workshop[i];
  if (!it) return `<h3>Empty slot</h3><p>Play a card from your hand to start a build here.</p><div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
  if (side === 'e' && !hasOracle(you())) {
    return `<h3>Hidden build</h3><p>The enemy crew is building something. It finishes in ${it.timer} turn${it.timer === 1 ? '' : 's'}.</p><p class="note">An Oracle Eye would reveal it.</p><div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
  }
  const c = CARDS[it.id];
  return `<h3>${c.name}</h3><div class="sub-line">${side === 'e' ? 'Enemy' : 'Your'} Workshop · ready in ${it.timer} turn${it.timer === 1 ? '' : 's'}${it.target ? ` · for the ${LIMB_NAMES[it.target].toLowerCase()}` : ''}</div>
    <p>${c.text}</p>${it.mod ? `<p class="note">Quality ${it.mod > 0 ? '+' : ''}${it.mod} from crew doctrine.</p>` : ''}
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
  saveName: () => {
    const v = (document.getElementById('name-in')?.value || '').trim().slice(0, 16);
    if (!v) return;
    update((s) => { s.name = v; });
    closeSheet();
  },
  pickFrame: (d) => { ui.pick.frame = d.v; render(); },
  pickPilot: (d) => { ui.pick.pilot = d.v; render(); },
  pickDoctrine: (d) => { ui.pick.doctrine = d.v; render(); },
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
  limb: (d) => selectLimb(d.limb),
  mode: (d) => { ui.sel.mode = d.m; ui.mode = 'target'; render(); },
  hit: (d) => {
    const a = { t: 'attack', limb: ui.sel.limb, mode: ui.sel.mode, target: d.t };
    if (isLegal(G, a)) step(a);
  },
  cancel: () => { ui.mode = 'idle'; ui.sel = null; ui.rushPick = false; render(); },
  overdrive: () => {
    const p = you();
    openSheet(`<h3>Overdrive</h3><p>Push the Core for <b>+${RULES.overdriveEnergy} energy</b> right now. It costs <b>${overdriveCost(p)} Core</b> and can be done once per turn.</p>
      <p class="note">Your Core is at ${p.core}. After this: ${p.core - overdriveCost(p)} (${energyOutput({ ...p, core: p.core - overdriveCost(p) })} energy per turn).</p>
      <div class="actions"><button class="btn white" data-act="closeSheet">Cancel</button><button class="btn red" data-act="doOverdrive">Overdrive</button></div>`);
  },
  doOverdrive: () => { ui.sheet = null; if (isLegal(G, { t: 'overdrive' })) step({ t: 'overdrive' }); else render(); },
  doctrine: () => openSheet(doctrineSheet()),
  order: (d) => { ui.sheet = null; const a = { t: 'order', doctrine: d.v }; if (isLegal(G, a)) step(a); else render(); },
  coreInfo: () => openSheet(`<h3>Core</h3><p>Your Core is your health and your power plant. At 15+ it makes 4 energy a turn, at 8–14 it makes 3, and below 8 just 2. If it hits 0, your mech is destroyed.</p><div class="actions"><button class="btn white" data-act="closeSheet">Got it</button></div>`),
  foeInfo: () => openSheet(foeSheet()),
  forfeit: () => openSheet(`<h3>Forfeit this fight?</h3><p>${load().run.mode === 'ranked' ? 'This counts as a loss and ends your ranked run.' : 'You can retry the floor afterwards.'}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Keep fighting</button><button class="btn red" data-act="confirmForfeit">Forfeit</button></div>`),
  confirmForfeit: () => { ui.sheet = null; G.winner = 1; finishBattle(); },
  endTurn: () => {
    if (G.active !== 0 || ui.busy) return;
    step({ t: 'end' });
    if (G.winner === null) enemyTurn();
  },
};

function selectLimb(limb) {
  if (!canAct(limb)) return;
  const p = you();
  const modes = attackModes(p, limb).filter((m) => m !== 'fire' || fireCost(p, limb) <= p.energy);
  ui.sel = { limb, mode: modes[0] };
  ui.mode = modes.length === 1 ? 'target' : 'pickmode';
  render();
}

function nameSheet() {
  return `<h3>Pilot callsign</h3><p>This name goes on the leaderboard.</p>
    <input id="name-in" class="name-input" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Callsign" enterkeyhint="done">
    <div class="actions"><button class="btn white" data-act="go" data-to="title">Cancel</button><button class="btn" data-act="saveNameGo">Save</button></div>`;
}
handlers.saveNameGo = () => {
  const v = (document.getElementById('name-in')?.value || '').trim().slice(0, 16);
  if (!v) { document.getElementById('name-in')?.focus(); return; }
  update((s) => { s.name = v; });
  go('setup');
};

app.addEventListener('click', (e) => {
  const stop = e.target.closest('[data-stop]');
  const el = e.target.closest('[data-act]');
  // Taps on the sheet body shouldn't close it.
  if (stop && el && !stop.contains(el)) return;
  // Tapping a mech part directly works the same as tapping its chip.
  if (ui.screen === 'battle' && !ui.sheet) {
    const part = e.target.closest('.limb, .core-gem');
    if (part && !el?.classList.contains('chip')) {
      const limb = part.dataset.limb;
      if (part.closest('#box-you') && ui.mode === 'idle') { selectLimb(limb); return; }
      if (part.closest('#box-enemy') && ui.mode === 'target') { handlers.hit({ t: limb }); return; }
      if (part.closest('#box-you') && ui.mode !== 'idle' && limb !== ui.sel?.limb) { selectLimb(limb); return; }
    }
  }
  if (!el) return;
  const fn = handlers[el.dataset.act];
  if (fn) fn(el.dataset, el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.sheet) closeSheet();
  else if (e.key === 'Escape' && ui.mode !== 'idle') handlers.cancel();
  if (e.key === 'Enter' && document.activeElement?.id === 'name-in') handlers.saveNameGo();
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

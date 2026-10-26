// Mech Wars — app shell: screens, the tactics board, the Build screen, Tower flow.
import {
  CARDS, FRAMES, FRAME_ORDER, PILOTS, PILOT_ORDER, DOCTRINES, DOCTRINE_ORDER, TWISTS, LIMBS, LIMB_NAMES,
  RULES, UNLOCK_COST, TERRAIN, MAP_THEMES, W, H,
} from '../engine/data.js';
import {
  createGame, applyAction, legalActions, isLegal, attackOf, cellsFor, previewHit, cardCost, canInstall,
  installTargets, energyOutput, overdriveCost, isExposed, destroyedCount, apMax, mobility, cloneState, tileAt,
} from '../engine/game.js';
import { chooseTurn, LEVELS } from '../engine/ai.js';
import { mechSVG, cardSticker, logoSVG, limbGlyph, tokenSVG, tileSVG, pilotSVG, TYPE_COLORS, TYPE_NAMES, INK } from './art.js';
import { load, save, update, resetAll } from './store.js';
import { newRun, startBattle, twistFor, enemyFor, themeFor, previewMap, aiLevel, reward, isBoss } from './tower.js';
import { sfx } from './sfx.js';

const VERSION = '0.7';
const app = document.getElementById('app');
const fx = document.getElementById('fx');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));
const systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const settings = () => load().settings;
const speed = () => (settings().speed === 'fast' ? 0.55 : 1);
const calm = () => settings().motion === 'reduce' || (settings().motion === 'system' && systemReduced);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// iOS: block pinch-zoom gestures that slip past the viewport meta.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

const LEVEL_NAMES = ['Rookie', 'Trained', 'Veteran', 'Ace', 'Relentless'];
const SHORT = { head: 'Head', armL: 'L arm', armR: 'R arm', legs: 'Legs', core: 'Core' };
const SHAPES = { single: 'Precise', plus: 'Plus-shaped area', sq2: '2×2 area', row: 'Whole row' };

const ui = {
  screen: 'title',
  sheet: null,
  mode: 'idle',      // idle | weapon | aim | prep | shop | tile
  atk: null,         // limb whose attack is being aimed
  aim: null,         // { x, y } aimed tile
  quick: false,      // weapon tray opened by tapping the enemy
  tileCard: null,    // tactic card waiting for a tile pick
  busy: false,
  ticker: '',
  pick: { frame: 'brakka', pilot: 'redline', doctrine: 'standard' },
  setupMode: 'ranked',
  boardTab: 'all',
  buildTab: 'you',
  result: null,
  turnStart: 0,
  fxSlap: null,
};

let G = null;   // live game state
let logSeen = 0;

// ---------------------------------------------------------------- small art bits

const GEAR = `<svg class="gear" viewBox="0 0 24 24"><path d="M12 2l2 3 3.5-.8.6 3.5 3.2 1.6-1.6 3.2 1.6 3.2-3.2 1.6-.6 3.5L14 19l-2 3-2-3-3.5.8-.6-3.5L2.7 14.7l1.6-3.2-1.6-3.2 3.2-1.6.6-3.5L10 5z" fill="#FFC929" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.8"/></svg>`;
const BOLT = (off = false, cls = 'pip') => `<svg class="${cls} ${off ? 'off' : ''}" viewBox="0 0 15 20"><path d="M9 1L2 11h5l-2 8 8-11H8l1-7z" fill="#FFC929" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const DOT = (off = false) => `<svg class="pip ${off ? 'off' : ''}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#7DF9FF" stroke="${INK}" stroke-width="1.8"/><circle cx="6" cy="6" r="1.8" fill="#fff"/></svg>`;
const COG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.6 2.4 2.8-.6.5 2.8 2.6 1.3-1.3 2.6 1.3 2.6-2.6 1.3-.5 2.8-2.8-.6L12 21.5l-1.6-2.4-2.8.6-.5-2.8-2.6-1.3 1.3-2.6L4.5 10.4l2.6-1.3.5-2.8 2.8.6z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="#2546C8" stroke="${INK}" stroke-width="2"/></svg>`;
const CLOCK = `<svg class="ck" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M6 3.6V6.2L7.6 7.2" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
const ICON = {
  brace: `<svg viewBox="0 0 12 12"><path d="M1.5 1.5h9v4.5Q10.5 10 6 11.2 1.5 10 1.5 6z" fill="#8FA3D9" stroke="${INK}" stroke-width="1.4"/></svg>`,
  charge: `<svg viewBox="0 0 15 20"><path d="M9 1L2 11h5l-2 8 8-11H8l1-7z" fill="#FF8A3D" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  locked: `<svg viewBox="0 0 14 14"><rect x="2.5" y="6" width="9" height="7" rx="2" fill="#B57BFF" stroke="${INK}" stroke-width="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="${INK}" stroke-width="1.6"/></svg>`,
  stuck: `<svg viewBox="0 0 14 14"><path d="M1 8q3-3 6 0t6 0v5H1z" fill="#4EA8FF" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  smoke: `<svg viewBox="0 0 14 14"><circle cx="5" cy="8" r="3.5" fill="#C9CFDB" stroke="${INK}" stroke-width="1.3"/><circle cx="9" cy="6.5" r="3.5" fill="#E7EAF1" stroke="${INK}" stroke-width="1.3"/></svg>`,
  guard: `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="#39E3A6" stroke="${INK}" stroke-width="1.5"/><path d="M4.5 7h5" stroke="${INK}" stroke-width="1.5"/></svg>`,
};
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
  const views = { title, setup, intro, battle: battleView, build: buildView, result: resultView, hangar, board: boardView, manual, settings: settingsView };
  app.innerHTML = views[ui.screen]() + (ui.sheet ? `<div class="sheet-wrap" data-act="closeSheet"><div class="sheet" data-stop role="dialog">${ui.sheet}</div></div>` : '');
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
  const sig = Object.entries(CARDS).find(([, c]) => c.frame === pk.frame && c.sig);
  const pilots = PILOT_ORDER.map((p) => `<button class="choice pilot-choice ${pk.pilot === p ? 'selected' : ''}" data-act="pickPilot" data-v="${p}" aria-pressed="${pk.pilot === p}">
    <span class="pc-face">${pilotSVG(p)}</span>
    <span class="pc-body"><strong>${PILOTS[p].name}</strong><span class="tag">${PILOTS[p].style}</span>
    <p><b>Passive:</b> ${PILOTS[p].text}</p><p><b>${PILOTS[p].special}:</b> ${PILOTS[p].specialText}</p></span></button>`).join('');
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
        <div class="kv sig-kv"><span class="sig-art">${cardSticker(sig[0], pk.frame)}</span><div><b>Signature</b><p>${sig[1].name}: ${sig[1].text.replace('Signature. ', '')}</p></div></div>
        <button class="btn-link" data-act="frameCards" data-v="${pk.frame}">See all ${fr.name} cards</button>
      </div>
      <div><div class="section-title ink-text">Pilot</div><p class="section-note">Each pilot has a passive that’s always on, and a Special that charges as you fight.</p><div class="choice-list">${pilots}</div></div>
      <div><div class="section-title ink-text">Crew doctrine</div><p class="section-note">How your crew builds parts.</p><div class="choice-list">${docs}</div></div>
    </div>
    <div class="bottom-cta">${locked
      ? `<button class="btn" data-act="unlock" data-v="${pk.frame}" ${s.scrap < UNLOCK_COST[pk.frame] ? 'disabled' : ''}>Unlock ${fr.name}<span class="sub">${UNLOCK_COST[pk.frame]} scrap · you have ${s.scrap}</span></button>`
      : `<button class="btn" data-act="startRun">Start climb<span class="sub">${fr.name} · ${PILOTS[pk.pilot].name} · ${DOCTRINES[pk.doctrine].name}</span></button>`}</div>
  </div>`;
}

// ---------------------------------------------------------------- floor intro (versus card)

function miniMap(board) {
  let h = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = board.tiles[y * W + x];
    const start = board.starts.findIndex((s) => s.x === x && s.y === y);
    h += `<i class="mm t-${t.t}">${tileSVG(t.t, t.hp)}${start >= 0 ? `<b class="mm-start ${start === 0 ? 'you' : 'foe'}"></b>` : ''}</i>`;
  }
  return `<div class="minimap">${h}</div>`;
}

function intro() {
  const run = load().run;
  const floor = run.floor;
  const enemy = enemyFor(run, floor);
  const twist = twistFor(run, floor);
  const theme = themeFor(run, floor);
  const lvl = LEVEL_NAMES[LEVELS.indexOf(aiLevel(floor))];
  return `<div class="screen floor-intro">
    <div class="fi-head">
      <div class="floor-num ink-text"><small>Floor</small>${floor}</div>
      ${isBoss(floor) ? '<div class="boss-tag">Boss · enemy limbs +2 HP</div>' : ''}
    </div>
    <div class="versus">
      <div class="vs-side foe">
        <div class="vs-mech pop-in">${mechSVG(enemy.frame)}</div>
        <div class="vs-info"><span class="side-label foe">Enemy</span><b>${FRAMES[enemy.frame].name}</b><span>${FRAMES[enemy.frame].role}</span>
          <span class="vs-pilot">${pilotSVG(enemy.pilot)}${PILOTS[enemy.pilot].name}</span><span>${DOCTRINES[enemy.doctrine].name}</span><span class="skill">Skill: ${lvl}</span></div>
      </div>
      <div class="vs-badge">VS</div>
      <div class="vs-side you">
        <div class="vs-info"><span class="side-label you">You</span><b>${FRAMES[run.frame].name}</b><span>${FRAMES[run.frame].role}</span>
          <span class="vs-pilot">${pilotSVG(run.pilot)}${PILOTS[run.pilot].name}</span><span>${DOCTRINES[run.doctrine].name}</span></div>
        <div class="vs-mech pop-in">${mechSVG(run.frame)}</div>
      </div>
    </div>
    <div class="map-card">${miniMap(previewMap(run))}<div><b>${MAP_THEMES[theme].name}</b><p>You start at the bottom, the enemy at the top.</p></div></div>
    ${twist ? `<div class="twist-banner"><b>Twist: ${TWISTS[twist].name}</b>${TWISTS[twist].text}</div>` : ''}
    <div class="menu" style="width:min(100%,340px)">
      <button class="btn red" data-act="fight">Fight</button>
      <button class="btn-ghost" data-act="go" data-to="title">Back to title</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- battle helpers

const you = () => G.players[0];
const foe = () => G.players[1];
const myTurn = () => G && G.active === 0 && !ui.busy && G.winner === null;
const legal = () => legalActions(G);

function atkLine(a) {
  if (!a) return '';
  if (a.wall) return `Raises a 6 HP wall · range ${a.reach}`;
  const range = a.range === 'melee' ? 'Melee' : a.range === 'direct' ? `Direct fire, range ${a.reach}` : `Artillery, range ${a.reach}`;
  const bits = [`${a.dmg} damage`, range, SHAPES[a.shape]];
  if (a.heavy) bits.push('heavy');
  if (a.push) bits.push(`push ${a.push}`);
  if (a.pull) bits.push(`pull ${a.pull}`);
  if (a.lock) bits.push('locks');
  if (a.ignoreBrace) bits.push('ignores brace');
  if (a.energy) bits.push(`${a.energy} energy to fire`);
  return bits.join(' · ');
}

// The damage an attack would actually deal right now (pilot bonuses, charge).
function shotDamage(p, a) {
  let d = a.dmg;
  if (d > 0) {
    d += p.flags.bonusNext;
    if (p.pilot === 'kai' && !p.flags.firstAttack) d += 1;
    if (p.status.charge) d = Math.round(d * RULES.chargeMult);
  }
  return d;
}

function weaponState(k) {
  const p = you();
  const a = attackOf(G, p, k);
  if (!a) return null;
  let why = '';
  if (p.flags.attacked[k]) why = 'Used this turn';
  else if (p.ap <= 0) why = 'No actions left';
  else if ((a.energy || 0) > p.energy) why = `Needs ${a.energy} energy`;
  else if (a.heavy && G.telegraphs.some((t) => t.owner === 0 && t.limb0 === k)) why = 'Already locked on';
  else if (!legal().some((x) => x.t === 'attack' && x.limb === k)) why = 'Nothing in range';
  return { a, why };
}

function aimTiles(k) {
  const set = new Set();
  for (const x of legal()) if (x.t === 'attack' && x.limb === k) set.add(`${x.x},${x.y}`);
  return set;
}

// Run an action on a copy of the game and report what happens (exact, since attacks have no randomness).
function simulate(act) {
  const s = cloneState(G);
  s.quiet = false;
  s.log = [];
  applyAction(s, act);
  return s;
}

function hitSummary(act) {
  const s = simulate(act);
  const a = attackOf(G, you(), act.limb);
  const out = { lines: [], total: 0, kills: [] };
  if (a.heavy) {
    const tg = s.telegraphs[s.telegraphs.length - 1];
    const onFoe = tg && tg.cells.some((c) => c.x === foe().pos.x && c.y === foe().pos.y);
    if (onFoe) {
      const r = previewHit(G, you(), foe(), tg.dmg, { precise: a.shape === 'single', limb: act.part, direct: a.range === 'direct', ignoreBrace: tg.ignoreBrace, kind: 'heavy' });
      out.total = r.total || 0;
      out.lines.push(`If they stay put: ${describeParts(r)}`);
    } else out.lines.push('Locks these tiles. Anything there when it fires gets hit.');
    out.lines.push('Fires at the start of your next turn.');
    return out;
  }
  for (const e of s.log) {
    if (e.type === 'hit' && e.target === 1) {
      out.total += e.total || 0;
      if (e.crash) out.lines.push(`Crash into ${crashName(e.crash)}: Core −${e.core}`);
      else out.lines.push(describeParts(e));
      for (const q of e.parts || []) if (q.destroyed) out.kills.push(q.limb);
    } else if (e.type === 'hit' && e.target === 0) out.lines.push(`You take ${e.total} (${e.crash ? 'crash' : 'hit'})`);
    else if ((e.type === 'push' || e.type === 'pull') && e.target === 1) {
      const n = Math.abs(e.to.x - e.from.x) + Math.abs(e.to.y - e.from.y);
      if (n) out.lines.push(`${e.type === 'push' ? 'Pushed' : 'Pulled'} ${plural(n, 'tile')}`);
    } else if (e.type === 'terrain') out.lines.push(`${TERRAIN[e.from].name} ${e.destroyed ? 'destroyed' : `−${e.dmg}`}`);
    else if (e.type === 'stuck' && e.p === 1) out.lines.push('Stuck in the river next turn');
    else if (e.type === 'locked' && e.p === 1) out.lines.push('Locked: no Move next turn');
    else if (e.type === 'anchored') out.lines.push('Anchored: can’t be moved');
    else if (e.type === 'wall') out.lines.push('Raises a wall');
    else if (e.type === 'win' && e.p === 0) out.lines.push('Destroys the enemy mech!');
  }
  if (!out.lines.length) out.lines.push('No effect');
  return out;
}

function crashName(c) { return c === 'edge' ? 'the edge' : c === 'mech' ? 'your mech' : `a ${TERRAIN[c].name.toLowerCase()}`; }

function describeParts(r) {
  if (!r || (!r.parts?.length && !r.core)) return r?.blocked ? `Guard drone blocks ${r.blocked}` : 'No damage';
  const bits = (r.parts || []).map((q) => `${SHORT[q.limb]} −${q.dmg}${q.destroyed ? ' (breaks)' : ''}`);
  if (r.core) bits.push(`Core −${r.core}`);
  let s = bits.join(', ');
  if (r.blocked) s += ` · drone blocks ${r.blocked}`;
  if (r.braced) s += ' · braced';
  if (r.cover) s += ' · cover';
  return s;
}

function statusChips(p) {
  const s = [];
  if (p.status.brace) s.push(['brace', 'Braced']);
  if (p.status.charge) s.push(['charge', 'Charged']);
  if (p.status.smoke) s.push(['smoke', 'Smoke']);
  if (p.status.locked || (p.status.noMove && G.active === p.idx)) s.push(['locked', p.status.stuck ? 'Stuck' : 'Locked']);
  if (p.status.stuck) s.push(['stuck', 'Stuck']);
  if (p.guard) s.push(['guard', `Guard ${p.guard}`]);
  return s;
}

function passiveLit(p) {
  if (p.pilot === 'kai') return !p.flags.firstAttack;
  if (p.pilot === 'okafor') return !p.flags.firstInstall;
  return true;
}

// ---------------------------------------------------------------- battle view

function meterRing(p) {
  const pct = Math.min(1, p.meter / RULES.meterMax);
  const C = 2 * Math.PI * 21;
  const ready = pct >= 1 && !p.flags.special;
  return `<svg class="meter-ring ${ready ? 'ready' : ''}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4"/>
    <circle cx="24" cy="24" r="21" fill="none" stroke="${ready ? '#FFC929' : '#B57BFF'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 24 24)"/></svg>`;
}

function limbChip(p, k, side) {
  const l = p.limbs[k];
  const pct = l.alive ? Math.max(0, l.hp / l.max) : 0;
  const part = l.alive && l.part ? l.part.id : null;
  const mods = l.alive ? l.mods.length : 0;
  return `<button class="lchip ${l.alive ? '' : 'dead'} ${l.alive && pct <= 0.4 ? 'low' : ''}" data-act="limbInfo" data-side="${side}" data-limb="${k}" aria-label="${LIMB_NAMES[k]} ${l.alive ? `${l.hp} of ${l.max} HP` : 'destroyed'}">
    <span class="lc-top"><span class="lc-name">${SHORT[k]}</span>${part ? `<span class="lc-part">${cardSticker(part, p.frame)}</span>` : ''}${mods ? `<span class="lc-mods">+${mods}</span>` : ''}</span>
    <i class="lc-bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></i>
    <span class="lc-val">${l.alive ? `${l.hp}<small>/${l.max}</small>` : 'Down'}</span>
  </button>`;
}

function mechBar(p, side) {
  const exposed = isExposed(p);
  const left = RULES.exposeAfter - destroyedCount(p);
  const coreCls = p.core >= 15 ? 'hi' : p.core >= 8 ? 'mid' : 'lo';
  const chips = statusChips(p).map(([k, t]) => `<span class="st-chip">${ICON[k]}${t}</span>`).join('');
  const lit = passiveLit(p);
  const ready = p.meter >= RULES.meterMax && !p.flags.special;
  const meta = side === 'foe' ? `<span class="st-chip plain-chip">Hand ${p.hand.length}</span><span class="st-chip plain-chip">Building ${p.workshop.length}</span>` : '';
  return `<div class="mbar ${side} ${G.active === p.idx ? 'active' : ''}">
    <button class="pilot-chip ${ready ? 'ready' : ''}" data-act="pilot" data-side="${side}" aria-label="Pilot ${PILOTS[p.pilot].name}">
      ${meterRing(p)}<span class="pc-face">${pilotSVG(p.pilot)}</span>
      <span class="pc-passive ${lit ? 'lit' : ''}">${ready ? 'Special' : 'Passive'}</span>
    </button>
    <div class="mb-main">
      <div class="mb-top">
        <span class="side-label ${side}">${side === 'you' ? 'You' : 'Enemy'}</span><b class="mb-name">${FRAMES[p.frame].name}</b>
        <button class="core-tag ${coreCls} ${exposed ? 'open' : ''}" data-act="coreInfo" data-side="${side}">Core <b>${p.core}</b><small>/20</small> · ${exposed ? 'open' : `shielded ${left}`}</button>
      </div>
      <div class="mb-limbs">${LIMBS.map((k) => limbChip(p, k, side)).join('')}</div>
      ${chips || meta ? `<div class="mb-status">${chips}${meta}</div>` : ''}
    </div>
  </div>`;
}

function tileClasses(x, y, ctx) {
  const t = tileAt(G, x, y);
  const k = `${x},${y}`;
  const cls = ['tile', `t-${t.t}`, (x + y) % 2 ? 'odd' : 'even'];
  if (ctx.reach.has(k)) cls.push('reach');
  if (ctx.targets.has(k)) cls.push('tgt');
  if (ctx.aimCells.has(k)) cls.push('aimed');
  if (ctx.tileTargets.has(k)) cls.push('tgt');
  const tg = ctx.tg.get(k);
  if (tg) cls.push(tg.owner === 0 ? 'tg-mine' : 'tg-foe');
  return cls.join(' ');
}

function boardCtx() {
  const ctx = { reach: new Map(), targets: new Set(), aimCells: new Set(), tileTargets: new Set(), tg: new Map(), tgTag: new Map() };
  for (const tg of G.telegraphs) {
    for (const c of tg.cells) ctx.tg.set(`${c.x},${c.y}`, tg);
    const c0 = tg.cells[0];
    ctx.tgTag.set(`${c0.x},${c0.y}`, tg);
  }
  if (!myTurn()) return ctx;
  const p = you();
  if (ui.mode === 'idle') {
    for (const a of legal()) if (a.t === 'move') ctx.reach.set(`${a.x},${a.y}`, a);
  } else if (ui.mode === 'aim' && ui.atk) {
    ctx.targets = aimTiles(ui.atk);
    if (ui.aim) {
      const a = attackOf(G, p, ui.atk);
      for (const c of cellsFor(G, p, a, ui.aim.x, ui.aim.y)) ctx.aimCells.add(`${c.x},${c.y}`);
    }
  } else if (ui.mode === 'tile' && ui.tileCard) {
    for (const t of installTargets(G, p, ui.tileCard)) ctx.tileTargets.add(t);
  }
  return ctx;
}

function boardHTML() {
  const ctx = boardCtx();
  let tiles = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tileAt(G, x, y);
    const T = TERRAIN[t.t];
    const hpBar = T.hp && t.hp < T.hp ? `<i class="t-hp"><i style="width:${(100 * t.hp / T.hp).toFixed(0)}%"></i></i>` : '';
    const tg = ctx.tgTag.get(`${x},${y}`);
    const tag = tg ? `<span class="tg-tag ${tg.owner === 0 ? 'mine' : 'foe'}">${tg.atk.name} ${tg.dmg}</span>` : '';
    tiles += `<button class="${tileClasses(x, y, ctx)}" data-act="tile" data-x="${x}" data-y="${y}" aria-label="${T.name} ${x + 1},${y + 1}">${tileSVG(t.t, t.hp)}${hpBar}${tag}</button>`;
  }
  const tokens = G.players.map((p) => {
    const side = p.idx === 0 ? 'you' : 'foe';
    const badges = statusChips(p).map(([k]) => `<i class="tb">${ICON[k]}</i>`).join('');
    return `<div class="token ${side} ${G.active === p.idx ? 'active' : ''}" id="tok-${p.idx}" style="left:${(p.pos.x * 100 / W).toFixed(4)}%;top:${(p.pos.y * 100 / H).toFixed(4)}%">
      ${tokenSVG(p.frame, p, side)}${badges ? `<div class="tbadges">${badges}</div>` : ''}</div>`;
  }).join('');
  return `<div class="board ${G.board.fog ? 'fog' : ''} theme-${G.board.theme}" id="board">${tiles}<div class="tokens">${tokens}</div></div>`;
}

function turnLabel() {
  const n = Math.ceil(G.turn / 2);
  const max = RULES.turnLimit / 2;
  const melt = G.turn > RULES.meltdownTurn ? ' · Meltdown' : G.turn > RULES.meltdownTurn - 6 ? ` · Meltdown in ${Math.ceil((RULES.meltdownTurn - G.turn + 1) / 2)}` : '';
  return `Turn ${n}/${max}${melt}`;
}

function tipText() {
  if (G.winner !== null) return G.winner === 0 ? 'Enemy mech destroyed!' : 'Your mech is down.';
  if (G.active !== 0 || ui.busy) return ui.ticker || 'Enemy turn…';
  const p = you();
  const hints = settings().hints;
  if (ui.mode === 'aim') {
    if (!ui.aim) return 'Tap a red tile to aim.';
    return 'Check the preview, then confirm below.';
  }
  if (ui.mode === 'weapon') return 'Pick a weapon. Each limb attacks once per turn.';
  if (ui.mode === 'prep') return 'Prep costs 1 action.';
  if (ui.mode === 'shop') return 'The Workshop costs 1 action, then install as many cards as your energy allows.';
  if (ui.mode === 'tile') return 'Tap a highlighted tile.';
  const danger = G.telegraphs.some((t) => t.owner === 1 && t.cells.some((c) => c.x === p.pos.x && c.y === p.pos.y));
  if (danger) return p.status.noMove ? 'You’re locked inside an enemy target. Brace!' : 'You’re standing in an enemy target. Move out!';
  if (p.ap <= 0) return 'Out of actions. End your turn.';
  if (ui.ticker && !hints) return ui.ticker;
  if (p.status.noMove) return 'You can’t move this turn. Attack, prep or build.';
  if (!hints) return ui.ticker || 'Your move.';
  return 'Tap a lit tile to move, or tap the enemy to attack.';
}

function actionBar() {
  const p = you();
  const mine = myTurn();
  const L = mine ? legal() : [];
  const canAtk = L.some((a) => a.t === 'attack');
  const canPrep = L.some((a) => a.t === 'prep');
  const run = load().run;
  const undo = canUndo(run);
  const ready = p.meter >= RULES.meterMax && !p.flags.special;
  const res = `<div class="res-row">
    <div class="res" aria-label="${p.ap} actions left"><span class="res-label">Actions</span><span class="pips">${Array.from({ length: Math.max(p.ap, apMax(p)) }, (_, i) => DOT(i >= p.ap)).join('')}</span></div>
    <div class="res" aria-label="${p.energy} energy"><span class="res-label">Energy</span><span class="pips">${BOLT(false)}<b>${p.energy}</b></span></div>
    <span class="res-gap"></span>
    ${undo ? '<button class="mini-btn" data-act="undo">Undo</button>' : ''}
    <button class="mini-btn od" data-act="overdrive" ${mine && L.some((a) => a.t === 'overdrive') ? '' : 'disabled'}>Overdrive</button>
    ${ready ? `<button class="mini-btn sp ready" data-act="pilot" data-side="you">${PILOTS[p.pilot].special}</button>` : ''}
  </div>`;
  if (!mine) {
    return `<div class="dock">${res}<div class="act-row waiting"><div class="thinking">${G.winner !== null ? '' : '<span class="dots"><i></i><i></i><i></i></span> Enemy turn'}</div></div></div>`;
  }
  let row = '';
  if (ui.mode === 'weapon') row = weaponTray();
  else if (ui.mode === 'aim') row = aimTray();
  else if (ui.mode === 'prep') row = `<div class="tray"><div class="tray-row">
      <button class="btn small opt" data-act="prep" data-k="brace" ${L.some((a) => a.t === 'prep' && a.kind === 'brace') ? '' : 'disabled'}>Brace<span class="sub">Next hit on you is halved</span></button>
      <button class="btn small opt" data-act="prep" data-k="charge" ${L.some((a) => a.t === 'prep' && a.kind === 'charge') ? '' : 'disabled'}>Charge<span class="sub">Next attack +50% damage</span></button>
    </div><button class="btn-ghost" data-act="cancel">Back</button></div>`;
  else if (ui.mode === 'shop') row = `<div class="tray"><div class="tray-row">
      <button class="btn small opt" data-act="openShop">Open the Workshop<span class="sub">1 action · install cards</span></button>
      <button class="btn small white opt" data-act="viewBuild">Just look<span class="sub">See your full mech</span></button>
    </div><button class="btn-ghost" data-act="cancel">Back</button></div>`;
  else if (ui.mode === 'tile') row = `<div class="tray"><p class="tray-title"><b>${CARDS[ui.tileCard].name}</b> · pick a tile on the board</p><button class="btn-ghost" data-act="cancel">Cancel</button></div>`;
  const shopOpen = p.flags.workshop;
  const bar = `<div class="act-row" ${row ? 'aria-hidden="true" style="visibility:hidden"' : ''}>
      <button class="act-btn atk" data-act="attackMenu" ${canAtk ? '' : 'disabled'}><span class="ab-ico">${actIcon('atk')}</span>Attack</button>
      <button class="act-btn prep" data-act="prepMenu" ${canPrep ? '' : 'disabled'}><span class="ab-ico">${actIcon('prep')}</span>Prep</button>
      <button class="act-btn build ${shopOpen ? 'open' : ''}" data-act="buildMenu"><span class="ab-ico">${actIcon('build')}</span>${shopOpen ? 'Workshop' : 'Build'}</button>
      <button class="act-btn end ${p.ap <= 0 ? 'nudge' : ''}" data-act="endTurn"><span class="ab-ico">${actIcon('end')}</span>End turn</button>
    </div>`;
  return `<div class="dock">${res}${bar}</div>${row ? `<div class="tray-layer">${row}</div>` : ''}`;
}

function actIcon(k) {
  const s = {
    atk: `<path d="M3 17L13 7M11 5l4-2 2 4-2 2M5 13l2 2" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 7l2 2" stroke="#FF4F64" stroke-width="3" stroke-linecap="round"/>`,
    prep: `<path d="M4 3h12v6q0 6-6 8-6-2-6-8z" fill="#8FA3D9" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    build: `<path d="M5 15l6-6M11 3a4 4 0 0 0 4 6l2 2-3 3-2-2a4 4 0 0 0-6-4" fill="#FFC929" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    end: `<path d="M5 4l10 6-10 6z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  }[k];
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${s}</svg>`;
}

function weaponTray() {
  const p = you();
  const rows = LIMBS.map((k) => {
    const w = weaponState(k);
    if (!w) return '';
    const { a, why } = w;
    const part = p.limbs[k].part?.id;
    const reach = ui.quick && !why ? aimTiles(k).has(`${foe().pos.x},${foe().pos.y}`) : true;
    const reason = why || (!reach ? 'Can’t reach the enemy' : '');
    return `<button class="wpn ${reason ? 'off' : ''}" data-act="pickWeapon" data-k="${k}" ${why ? 'disabled' : ''}>
      <span class="w-ico">${part ? cardSticker(part, p.frame) : limbGlyph(k)}</span>
      <span class="w-body"><b>${a.name}${a.heavy ? ' <em>heavy</em>' : ''}</b><small>${SHORT[k]} · ${reason || atkLine({ ...a, dmg: shotDamage(p, a) })}</small></span>
    </button>`;
  }).join('');
  return `<div class="tray weapons">${rows}<button class="btn-ghost" data-act="cancel">Back</button></div>`;
}

function aimTray() {
  const p = you();
  const a = attackOf(G, p, ui.atk);
  const head = `<p class="tray-title"><b>${a.name}</b> · ${atkLine({ ...a, dmg: shotDamage(p, a) })}</p>`;
  if (!ui.aim) return `<div class="tray">${head}<button class="btn-ghost" data-act="cancel">Back</button></div>`;
  const acts = legal().filter((x) => x.t === 'attack' && x.limb === ui.atk && x.x === ui.aim.x && x.y === ui.aim.y);
  if (acts.some((x) => x.part)) {
    const btns = acts.map((x) => {
      const s = hitSummary(x);
      return `<button class="limb-pick ${s.kills.length ? 'kill' : ''}" data-act="fire" data-part="${x.part}">
        <b>${SHORT[x.part]}</b><span>${s.total ? `−${s.total}` : '0'}</span><small>${esc(s.lines[0])}</small></button>`;
    }).join('');
    return `<div class="tray">${head}<p class="tray-note">Precise hit: choose the limb.${a.heavy ? ' Heavy: it fires at the start of your next turn.' : ''}</p><div class="limb-picks">${btns}</div><button class="btn-ghost" data-act="cancel">Back</button></div>`;
  }
  const s = hitSummary(acts[0]);
  return `<div class="tray">${head}<ul class="preview">${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="tray-row"><button class="btn-ghost" data-act="cancel">Back</button><button class="btn small red" data-act="fire">${a.heavy ? 'Lock on' : a.wall ? 'Raise wall' : 'Fire'}</button></div></div>`;
}

function battleView() {
  return `<div class="screen battle ${G.active === 0 ? 'your-turn' : 'their-turn'}">
    ${mechBar(foe(), 'foe')}
    <div class="board-wrap">${boardHTML()}</div>
    <div class="midline"><span class="turn-chip ${G.active === 0 ? 'you' : 'foe'}">${turnLabel()}</span><span class="tip">${esc(tipText())}</span>
      <button class="mini-btn ghost" data-act="menu" aria-label="Battle menu">Menu</button></div>
    ${mechBar(you(), 'you')}
    ${actionBar()}
  </div>`;
}

// ---------------------------------------------------------------- build screen

function limbRow(p, k, side) {
  const l = p.limbs[k];
  const a = attackOf(G, p, k);
  const part = l.alive && l.part ? CARDS[l.part.id] : null;
  const pct = l.alive ? l.hp / l.max : 0;
  const pending = side === 'you' ? p.workshop.find((w) => w.target === k) : null;
  return `<button class="limb-row ${l.alive ? '' : 'dead'}" data-act="limbInfo" data-side="${side}" data-limb="${k}">
    ${limbGlyph(k)}
    <span class="lr-body"><b>${LIMB_NAMES[k]}${part ? ` · ${part.name}` : ''}</b>
      <small>${l.alive ? (a ? atkLine(a) : 'No attack') : 'Destroyed'}${l.mods.length ? ` · ${l.mods.map((m) => CARDS[m.id].name).join(', ')}` : ''}${pending ? ` · ${CARDS[pending.id].name} in ${plural(pending.timer, 'turn')}` : ''}</small></span>
    <span class="lr-hp"><i class="lc-bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></i><span>${l.alive ? `${l.hp}/${l.max} HP` : 'Down'}</span></span>
  </button>`;
}

function handView() {
  const p = you();
  const open = myTurn() && p.flags.workshop;
  if (!p.hand.length) return '<div class="hand empty-hand">No cards in hand</div>';
  return `<div class="hand">${p.hand.map((id, i) => {
    const c = CARDS[id];
    const ok = open && canInstall(G, p, id);
    return `<button class="hs ${ok ? 'playable' : 'cant'}" data-hand="${i}" aria-label="${c.name}, ${cardCost(p, id)} energy">
      <span class="hs-disc" style="--tc:${TYPE_COLORS[c.type]}">${cardSticker(id, p.frame)}</span>
      <span class="hs-cost">${cardCost(p, id)}</span>${c.sig ? '<span class="hs-sig">★</span>' : ''}
      <span class="hs-name">${c.name}</span></button>`;
  }).join('')}</div>`;
}

function queueView(p, side) {
  const slots = [0, 1, 2].map((i) => {
    const w = p.workshop[i];
    if (!w) return '<div class="qslot empty"><span>Empty</span></div>';
    if (side === 'foe') return `<div class="qslot hidden"><span class="q">?</span><span class="qt">${CLOCK}${w.timer}</span></div>`;
    return `<div class="qslot"><span class="qi">${cardSticker(w.id, p.frame)}</span><span class="qn">${CARDS[w.id].name}<small>${SHORT[w.target]}</small></span><span class="qt">${CLOCK}${w.timer}</span></div>`;
  }).join('');
  return `<div class="queue"><span class="q-label">Workshop</span>${slots}</div>`;
}

function buildView() {
  const side = ui.buildTab;
  const p = side === 'you' ? you() : foe();
  const me = you();
  const open = myTurn() && me.flags.workshop;
  const slap = ui.fxSlap && ui.fxSlap.p === p.idx ? ui.fxSlap : null;
  const title = side === 'you' ? (open ? 'Workshop' : 'Your build') : 'Enemy build';
  const tip = side === 'foe'
    ? `${PILOTS[p.pilot].name}: ${PILOTS[p.pilot].text} You can’t see their hand or what they’re building.`
    : open ? 'Drag a sticker onto a glowing limb, or tap it for details.' : myTurn() ? 'Open the Workshop from the board (1 action) to install cards.' : 'Wait for your turn to build.';
  return `<div class="screen build">
    <div class="topbar"><button class="btn small" data-act="toBoard">Back to board</button><h2 class="ink-text">${title}</h2>
      <span class="b-res"><span class="res-label">Energy</span>${BOLT(false)}<b>${me.energy}</b></span></div>
    <div class="tabs"><button class="tab ${side === 'you' ? 'on' : ''}" data-act="buildTab" data-v="you">Your mech</button><button class="tab ${side === 'foe' ? 'on' : ''}" data-act="buildTab" data-v="foe">Enemy mech</button></div>
    <div class="build-main">
      <div class="build-stage ${side}" id="build-${side}">${mechSVG(p.frame, p, { pending: side === 'you' ? p.workshop : [], slap: slap?.limb, slapKind: slap?.kind })}
        <div class="bs-core">Core <b>${p.core}</b>/20</div></div>
      <div class="limb-list">${LIMBS.map((k) => limbRow(p, k, side)).join('')}</div>
    </div>
    ${queueView(p, side)}
    <p class="build-tip">${esc(tip)}</p>
    ${side === 'you' ? handView() : `<div class="foe-hand"><span>Hand</span>${'<i></i>'.repeat(p.hand.length)}<b>${plural(p.hand.length, 'card')}</b></div>`}
  </div>`;
}

// ---------------------------------------------------------------- stepping & effects

function rebuild(run) {
  const g = createGame(run.battle.setup);
  for (const a of run.actions) applyAction(g, a);
  return g;
}

function canUndo(run) {
  if (!myTurn() || !run || run.actions.length <= ui.turnStart) return false;
  return ['move', 'prep', 'workshop'].includes(run.actions[run.actions.length - 1].t);
}

function step(a) {
  const run = load().run;
  const actor = G.players[G.active];
  const flags = { ...actor.flags };
  applyAction(G, a);
  run.actions.push(a);
  save();
  const events = G.log.slice(logSeen);
  logSeen = G.log.length;
  ui.mode = 'idle'; ui.atk = null; ui.aim = null; ui.quick = false;
  if (a.t !== 'install' || CARDS[a.id].effect === 'demolish') ui.tileCard = null;
  const t = events.map(describe).filter(Boolean);
  if (t.length) ui.ticker = t[t.length - 1];
  ui.fxSlap = null;
  for (const e of events) {
    if (e.type === 'built') ui.fxSlap = { p: e.p, limb: e.target, kind: 'part' };
    if (e.type === 'modded') ui.fxSlap = { p: e.p, limb: e.target, kind: 'mod' };
    if (e.type === 'turn' && e.p === 0) ui.turnStart = run.actions.length;
  }
  // Pilot passives, called out when they kick in.
  const passive = [];
  if (a.t === 'attack' && actor.pilot === 'kai' && !flags.firstAttack && attackOf(G, actor, a.limb)?.dmg !== 0) passive.push('Kai: +1 damage');
  if (a.t === 'install' && actor.pilot === 'okafor' && !flags.firstInstall && CARDS[a.id].cost > 0) passive.push('Okafor: 1 less energy');
  if (a.t === 'overdrive' && actor.pilot === 'redline') passive.push('Redline: 1 less Core');
  if (actor.pilot === 'gus' && events.some((e) => e.type === 'built' && e.p === actor.idx)) passive.push('Gus: +2 HP');
  render();
  ui.fxSlap = null;
  animate(events, passive.map((text) => ({ text, p: actor.idx })));
  if (G.winner !== null) setTimeout(finishBattle, 1700 * speed());
}

function describe(e) {
  const me = e.p === 0;
  const who = me ? 'You' : 'Enemy';
  switch (e.type) {
    case 'hit': {
      const victim = e.target === 0 ? 'you' : 'the enemy';
      if (e.crash) return `${e.target === 0 ? 'You' : 'The enemy'} crashed into ${e.crash === 'edge' ? 'the edge' : e.crash === 'mech' ? 'the other mech' : `a ${TERRAIN[e.crash].name.toLowerCase()}`}: Core −${e.core}.`;
      const dmg = describeParts(e);
      return `${e.name ? `${e.heavy ? 'Locked ' : ''}${e.name}` : 'Blast'} hit ${victim}: ${dmg}.`;
    }
    case 'lock': return `${who} locked on with ${e.name}. It fires at the start of ${me ? 'your' : 'their'} next turn.`;
    case 'fire': return `${me ? 'Your' : 'Enemy'} ${e.name} fired.`;
    case 'dodge': return `${me ? 'You' : 'The enemy'} dodged a heavy attack!`;
    case 'queued': return me ? `Your crew started ${CARDS[e.id].name} for the ${LIMB_NAMES[e.target].toLowerCase()}. Ready in ${plural(e.time, 'turn')}.` : 'The enemy crew started building a part.';
    case 'built': return `${me ? 'Your' : 'Enemy'} ${CARDS[e.id].name} is on the ${LIMB_NAMES[e.target].toLowerCase()}.`;
    case 'modded': return `${who} stuck ${CARDS[e.id].name} on the ${LIMB_NAMES[e.target].toLowerCase()}.`;
    case 'tactic': return `${who} used ${CARDS[e.id].name}.`;
    case 'overdrive': return `${who} overdrove the Core: +${RULES.overdriveEnergy} energy, −${e.cost} Core.`;
    case 'special': return `${who}: ${PILOTS[e.pilot].special}!`;
    case 'prep': return `${who} ${e.kind === 'brace' ? 'braced' : 'charged up'}.`;
    case 'workshop': return me ? 'Workshop open for this turn.' : 'The enemy opened their Workshop.';
    case 'push': case 'pull': {
      const n = Math.abs(e.to.x - e.from.x) + Math.abs(e.to.y - e.from.y);
      return n ? `${e.target === 0 ? 'You were' : 'The enemy was'} ${e.type === 'push' ? 'pushed' : 'pulled'} ${plural(n, 'tile')}.` : '';
    }
    case 'stuck': return `${me ? 'You’re' : 'The enemy is'} stuck in the river.`;
    case 'locked': return `${me ? 'You’re' : 'The enemy is'} locked: no Move next turn.`;
    case 'anchored': return `${me ? 'Your' : 'Enemy'} anchor legs held firm.`;
    case 'terrain': return e.destroyed ? `A ${TERRAIN[e.from].name.toLowerCase()} was destroyed.` : '';
    case 'wall': return `${who} raised an Aegis wall.`;
    case 'smokeMiss': return 'The heavy attack missed in the smoke.';
    case 'meltdown': return `Meltdown: ${me ? 'your' : 'enemy'} Core −1.`;
    case 'turn': return e.p === 0 ? 'Your turn' : 'Enemy turn';
    case 'win': return e.timeout ? `Time! ${e.p === 0 ? 'You win on Core.' : 'The enemy wins on Core.'}` : (e.p === 0 ? 'Enemy mech destroyed!' : 'Your mech was destroyed.');
    default: return '';
  }
}

function tileEl(x, y) { return document.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`); }

function floatAt(el, text, cls = '', dy = 0) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = `float ${cls}`;
  d.textContent = text;
  const x = Math.min(innerWidth - 70, Math.max(70, r.left + r.width / 2));
  const y = Math.min(innerHeight - 60, Math.max(70, r.top + r.height / 2 + dy));
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1300);
}

function sparks(el, color = '#FFC929', n = 8) {
  if (!el || calm()) return;
  const r = el.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'burst';
  b.style.left = `${r.left + r.width / 2}px`;
  b.style.top = `${r.top + r.height / 2}px`;
  b.style.setProperty('--c', color);
  b.innerHTML = '<i></i>'.repeat(n);
  fx.appendChild(b);
  setTimeout(() => b.remove(), 650);
}

function banner(text, side, sub = '') {
  const d = document.createElement('div');
  d.className = `turn-banner ${side}`;
  d.innerHTML = `<div><b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1150 * speed());
}

function retrigger(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}

// A projectile from one tile to another (fixed-position, in the fx layer).
function projectile(from, to, kind, delay) {
  const a = tileEl(from.x, from.y), b = tileEl(to.x, to.y);
  if (!a || !b || calm()) return 0;
  const p = center(a), q = center(b);
  const d = document.createElement('div');
  d.className = `shot ${kind}`;
  d.style.left = `${p.x}px`; d.style.top = `${p.y}px`;
  fx.appendChild(d);
  const dx = q.x - p.x, dy = q.y - p.y;
  const dur = kind === 'artillery' ? 520 : kind === 'rail' ? 160 : 230;
  const frames = kind === 'artillery'
    ? [{ transform: 'translate(-50%,-50%) translate(0,0) scale(.7)' }, { transform: `translate(-50%,-50%) translate(${dx / 2}px,${dy / 2 - 70}px) scale(1.3)` }, { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.9)` }]
    : [{ transform: 'translate(-50%,-50%) translate(0,0)' }, { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px)` }];
  if (kind !== 'artillery') d.style.setProperty('--ang', `${Math.atan2(dy, dx)}rad`);
  d.animate(frames, { duration: dur * speed(), delay: delay * speed(), easing: kind === 'artillery' ? 'ease-in-out' : 'linear', fill: 'both' })
    .finished.then(() => d.remove()).catch(() => d.remove());
  return dur;
}

function animate(events, passives = []) {
  if (ui.screen !== 'battle') {
    // Build screen: just float the news over the mech.
    const stage = document.querySelector('.build-stage');
    for (const e of events) {
      if (e.type === 'built' || e.type === 'modded') { floatAt(stage, `${CARDS[e.id].name} on`, 'info'); sfx('build'); }
      if (e.type === 'queued') { floatAt(stage, `Ready in ${plural(e.time, 'turn')}`, 'info'); sfx('build'); }
      if (e.type === 'tactic') { floatAt(stage, CARDS[e.id].name, 'info'); sfx(e.id === 'drone_escort' ? 'guard' : 'build'); }
    }
    passives.forEach((ps, i) => setTimeout(() => floatAt(stage, ps.text, 'pilot', 40), 300 + i * 200));
    return;
  }
  let t = 0;
  const later = (ms, fn) => setTimeout(fn, ms * speed());
  const tok = (i) => document.getElementById(`tok-${i}`);
  for (const e of events) {
    switch (e.type) {
      case 'move': {
        const el = tok(e.p);
        if (!el) break;
        const path = e.path || [e.from, e.to];
        const per = e.phase ? 260 : 120;
        if (!calm()) {
          const frames = e.phase
            ? [{ transform: `translate(${(e.from.x - e.to.x) * 100}%, ${(e.from.y - e.to.y) * 100}%)`, opacity: 1 }, { transform: `translate(${(e.from.x - e.to.x) * 100}%, ${(e.from.y - e.to.y) * 100}%) scale(.2)`, opacity: 0, offset: 0.45 }, { transform: 'translate(0,0) scale(.2)', opacity: 0, offset: 0.55 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }]
            : path.map((pt) => ({ transform: `translate(${(pt.x - e.to.x) * 100}%, ${(pt.y - e.to.y) * 100}%)` }));
          el.animate(frames, { duration: per * Math.max(1, path.length - 1) * speed(), delay: t * speed(), easing: 'ease-in-out', fill: 'backwards' });
        }
        later(t, () => sfx('move'));
        t += per * Math.max(1, path.length - 1);
        break;
      }
      case 'shot': {
        const kind = e.range === 'melee' ? 'melee' : e.range === 'artillery' ? 'artillery' : (e.name === 'Rail shot' ? 'rail' : 'direct');
        if (kind === 'melee') {
          const el = tok(e.p);
          if (el && !calm()) el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${(e.to.x - e.from.x) * 38}%, ${(e.to.y - e.from.y) * 38}%)` }, { transform: 'translate(0,0)' }], { duration: 260 * speed(), delay: t * speed() });
          later(t + 90, () => sfx('jab'));
          t += 130;
        } else {
          later(t, () => sfx(kind === 'rail' ? 'rail' : 'shot'));
          t += projectile(e.from, e.to, kind, t);
        }
        break;
      }
      case 'fire': {
        later(t, () => {
          for (const c of e.cells) retrigger(tileEl(c.x, c.y), 'boom');
          sfx('boom');
          if (!calm()) retrigger(document.getElementById('board'), 'quake');
        });
        t += 260;
        break;
      }
      case 'lock': {
        later(t, () => { sfx('lock'); for (const c of e.cells) retrigger(tileEl(c.x, c.y), 'lock-in'); floatAt(tileEl(e.cells[0].x, e.cells[0].y), 'Locked on', 'lock'); });
        t += 200;
        break;
      }
      case 'hit': {
        const at = t;
        later(at, () => {
          const el = tok(e.target);
          if (!el) return;
          if (!calm()) retrigger(el, 'shake');
          const total = e.total || 0;
          if (e.crash) { sfx('crash'); if (!calm()) retrigger(document.getElementById('board'), 'quake'); floatAt(el, `Crash! Core −${e.core}`, 'core big'); sparks(el, '#FF8A3D', 12); return; }
          if (!total && e.blocked) { floatAt(el, 'Blocked!', 'blocked'); sparks(el, '#39E3A6'); sfx('guard'); return; }
          sfx('hit');
          sparks(el);
          floatAt(el, `−${total}`, e.target === 0 ? 'hurt' : '');
          const parts = (e.parts || []).map((q) => `${SHORT[q.limb]} −${q.dmg}`).join(' · ');
          if (parts) floatAt(el, parts + (e.core ? ` · Core −${e.core}` : ''), 'small', 30);
          for (const q of e.parts || []) if (q.destroyed) later(260, () => { floatAt(el, `${LIMB_NAMES[q.limb]} down!`, 'big', -30); sfx('break'); });
          if (e.blocked) later(180, () => floatAt(el, `Drone −${e.blocked}`, 'blocked', -20));
        });
        t += 140;
        break;
      }
      case 'push': case 'pull': {
        const el = tok(e.target);
        const n = Math.abs(e.to.x - e.from.x) + Math.abs(e.to.y - e.from.y);
        if (el && n && !calm()) el.animate([{ transform: `translate(${(e.from.x - e.to.x) * 100}%, ${(e.from.y - e.to.y) * 100}%)` }, { transform: 'translate(0,0)' }], { duration: 110 * n * speed(), delay: t * speed(), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
        t += 110 * Math.max(1, n);
        break;
      }
      case 'terrain': {
        if (e.destroyed) later(t, () => { const el = tileEl(e.x, e.y); retrigger(el, 'crumble'); sparks(el, '#B9B4DE', 10); floatAt(el, `${TERRAIN[e.from].name} down`, 'info'); sfx('break'); });
        break;
      }
      case 'wall': later(t, () => { retrigger(tileEl(e.x, e.y), 'pop'); sfx('guard'); }); t += 120; break;
      case 'stuck': later(t, () => floatAt(tok(e.p), 'Stuck!', 'lock')); break;
      case 'locked': later(t, () => floatAt(tok(e.p), 'Locked!', 'lock')); break;
      case 'anchored': later(t, () => floatAt(tok(e.p), 'Anchored', 'info')); break;
      case 'dodge': later(t, () => { floatAt(tok(e.p), 'Dodged!', 'pilot'); sfx('dodge'); }); break;
      case 'smokeMiss': later(t, () => floatAt(tok(e.target), 'Missed in smoke', 'blocked')); break;
      case 'built': case 'modded': later(t, () => { floatAt(tok(e.p), `${CARDS[e.id].name} on`, 'info'); sfx('build'); }); t += 120; break;
      case 'queued': if (e.p === 1) later(t, () => floatAt(tok(1), 'Building…', 'info')); break;
      case 'tactic': later(t, () => { floatAt(tok(e.p), CARDS[e.id].name, 'info'); sfx(e.id === 'drone_escort' ? 'guard' : 'build'); }); t += 120; break;
      case 'prep': later(t, () => { floatAt(tok(e.p), e.kind === 'brace' ? 'Brace' : 'Charge', 'info'); sfx('guard'); }); break;
      case 'overdrive': later(t, () => { floatAt(tok(e.p), `Overdrive! Core −${e.cost}`, 'core'); sfx('special'); if (!calm()) retrigger(app, 'screen-shake'); }); break;
      case 'special': later(t, () => { banner(PILOTS[e.pilot].special, e.p === 0 ? 'you' : 'foe', PILOTS[e.pilot].name); sfx('special'); }); t += 300; break;
      case 'meltdown': later(t, () => floatAt(tok(e.p), 'Meltdown −1', 'core')); break;
      case 'turn':
        if (G.winner === null) later(t, () => { banner(e.p === 0 ? 'Your turn' : 'Enemy turn', e.p === 0 ? 'you' : 'foe', turnLabel()); sfx(e.p === 0 ? 'turn' : 'foeTurn'); });
        break;
      default: break;
    }
  }
  passives.forEach((ps, i) => later(t + 150 + i * 220, () => floatAt(tok(ps.p), ps.text, 'pilot', -36)));
}

async function enemyTurn() {
  if (ui.enemyRunning) return;
  ui.enemyRunning = true;
  ui.busy = true;
  render();
  const run = load().run;
  await sleep(750);
  let guard = 0;
  while (G.winner === null && G.active === 1 && guard++ < 8) {
    const cfg = aiLevel(run.floor);
    const seed = (run.battle.aiSeed + G.turn * 101 + run.actions.length) >>> 0;
    const plan = await think(G, cfg, seed);
    if (ui.screen !== 'battle' && ui.screen !== 'build') { ui.enemyRunning = false; ui.busy = false; return; }
    let replan = false;
    for (const a of plan) {
      if (G.winner !== null || G.active !== 1) break;
      if (!isLegal(G, a)) { replan = true; break; }
      if (a.t === 'end') await sleep(250);
      step(a);
      if (a.t !== 'end') await sleep(a.t === 'attack' ? 1050 : a.t === 'move' ? 650 : 750);
      if ((a.t === 'install' && CARDS[a.id].effect === 'draw') || (a.t === 'special' && foe().pilot === 'okafor')) { replan = true; break; }
    }
    if (!replan && G.winner === null && G.active === 1) step({ t: 'end' });
  }
  if (G.winner === null && G.active === 1) step({ t: 'end' });
  ui.busy = false;
  ui.enemyRunning = false;
  if (ui.screen === 'battle' || ui.screen === 'build') render();
}

function battleSummary() {
  const me = you();
  return { turns: me.turnsTaken, ...me.stats };
}

function finishBattle() {
  if (ui.screen !== 'battle' && ui.screen !== 'build') return;
  if (ui.finished) return;
  ui.finished = true;
  const s = load();
  const run = s.run;
  const win = G.winner === 0;
  const summary = battleSummary();
  sfx(win ? 'win' : 'lose');
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
  if (run.battle) G = rebuild(run);
  else { G = startBattle(run); save(); }
  logSeen = G.log.length;
  Object.assign(ui, { mode: 'idle', atk: null, aim: null, quick: false, tileCard: null, busy: false, enemyRunning: false, finished: false, buildTab: 'you', turnStart: run.actions.length });
  ui.ticker = '';
  go('battle');
  banner(fresh ? 'Fight!' : 'Back in the fight', 'fight', `Floor ${run.floor} · ${MAP_THEMES[G.board.theme].name}`);
  sfx('turn');
  if (G.winner !== null) setTimeout(finishBattle, 600);
  else if (G.active === 1) setTimeout(enemyTurn, 700 * speed());
}

// ---------------------------------------------------------------- results

function summaryView(sm) {
  if (!sm) return '';
  const cell = (n, l) => `<div class="sm-cell"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="summary">${cell(sm.turns, 'Turns')}${cell(sm.dealt, 'Damage dealt')}${cell(sm.taken, 'Damage taken')}${cell(sm.broke, 'Limbs broken')}${cell(sm.crashes, 'Crashes caused')}${cell(sm.dodges, 'Heavy hits dodged')}</div>`;
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
    const sig = Object.entries(CARDS).find(([, c]) => c.frame === f && c.sig);
    return `<div class="detail-panel hangar-card">
      <div class="hc-top">
        <div class="fc-art" style="--fc:${fr.color}">${mechSVG(f)}</div>
        <div><div class="dp-head"><b>${fr.name}</b><span>${fr.role}</span></div><p>${fr.blurb}</p>
        ${s.bestCasual[f] ? `<p class="note">Best practice floor: ${s.bestCasual[f]}</p>` : ''}</div>
      </div>
      <div class="kv"><b>Trait</b><p>${fr.trait}</p></div>
      <div class="kv sig-kv"><span class="sig-art">${cardSticker(sig[0], f)}</span><div><b>Signature</b><p>${sig[1].name}: ${sig[1].text.replace('Signature. ', '')}</p></div></div>
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

function cardMeta(c) {
  if (c.type === 'part') return `Part · replaces ${c.slot === 'arm' ? 'an arm' : c.slot === 'head' ? 'the head' : 'the legs'} · ${c.hp} HP`;
  if (c.type === 'mod') return 'Mod · sticks onto a limb, instant';
  return 'Tactic · instant';
}

function cardRow(id, count, frame) {
  const c = CARDS[id];
  return `<div class="card-row">
    <span class="cr-icon" style="--tc:${TYPE_COLORS[c.type]}">${cardSticker(id, frame)}</span>
    <div><b>${c.sig ? '★ ' : ''}${c.name}${count > 1 ? ` ×${count}` : ''}</b>
      <span class="cr-meta">${cardMeta(c)} · ${c.cost} energy</span>
      <p>${c.text}</p></div></div>`;
}

function frameCardsSheet(f) {
  const counts = {};
  for (const id of FRAMES[f].deck) counts[id] = (counts[id] || 0) + 1;
  const own = Object.keys(counts).filter((id) => CARDS[id].frame === f);
  const shared = Object.keys(counts).filter((id) => !CARDS[id].frame);
  return `<h3>${FRAMES[f].name} deck</h3><div class="sub-line">${FRAMES[f].deck.length} cards</div>
    <div class="section-mini">${FRAMES[f].name} only</div>${own.map((id) => cardRow(id, counts[id], f)).join('')}
    <div class="section-mini">Shared crew cards</div>${shared.map((id) => cardRow(id, counts[id], f)).join('')}
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
    <div class="scroll"><div class="board-list">${list}</div>
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
        <div class="set-row"><div><b>Tips during battle</b><p>Hints in the strip under the board.</p></div>${seg('hints', st.hints ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
        <div class="set-row"><div><b>Enemy turn speed</b><p>How fast the AI’s moves play out.</p></div>${seg('speed', st.speed, [['normal', 'Normal'], ['fast', 'Fast']])}</div>
        <div class="set-row"><div><b>Sound</b><p>Synthesized effects. Your phone’s silent switch mutes them too.</p></div>${seg('sound', st.sound ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
        <div class="set-row"><div><b>Motion</b><p>Screen shake, projectiles and sparks.</p></div>${seg('motion', st.motion, [['system', 'Auto'], ['full', 'Full'], ['reduce', 'Less']])}</div>
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
      <div class="detail-panel"><h3>Win the fight</h3><p>Bring the enemy Core to 0. Every hit on a limb also jars the Core for 1, crashes go straight into it, and once two limbs are destroyed the Core is open and you can aim at it directly.</p></div>
      <div class="detail-panel"><h3>Your turn</h3><p>You get 2 actions (Specter gets 3; destroyed legs cost you one). Spend them in any order, like move, attack, move:</p><ul>
        <li><b>Move:</b> tap a lit tile. Forests and rubble cost 2, rivers end your move, buildings and mountains block.</li>
        <li><b>Attack:</b> tap the enemy, or tap Attack. Each limb attacks once per turn. Aim, check the preview, then fire.</li>
        <li><b>Prep:</b> Brace halves the next hit on you. Charge makes your next attack deal 50% more.</li>
        <li><b>Build:</b> open the Workshop (1 action), then drag card stickers onto your mech as long as you have energy.</li></ul>
        <p>Moves and preps can be undone until you do something else.</p></div>
      <div class="detail-panel"><h3>Precise or area</h3><p>Precise attacks hit one tile hard and you pick the limb. Area attacks cover more tiles but split their damage across the target’s limbs.</p></div>
      <div class="detail-panel"><h3>Heavy attacks</h3><p>Heavy weapons lock onto tiles that glow on the board. They fire at the start of the attacker’s next turn, so the target gets one chance to get out. Dodging one charges your pilot’s Special.</p></div>
      <div class="detail-panel"><h3>Push, pull and lock</h3><p>Shove a mech into a building, mountain, the edge or the other mech and it crashes: +2 per tile it couldn’t move plus the terrain’s bonus, straight to the Core. Pushed into a river, it’s stuck next turn. Locked mechs can’t move on their next turn.</p></div>
      <div class="detail-panel"><h3>Terrain</h3><ul>${['forest', 'rubble', 'building', 'mountain', 'river'].map((t) => `<li><b>${TERRAIN[t].name}:</b> ${TERRAIN[t].text}</li>`).join('')}</ul><p>Everything except rivers can be destroyed.</p></div>
      <div class="detail-panel"><h3>Parts and mods</h3><p>Parts replace a whole limb, like a Cannon Arm for an arm, and arrive from your crew after a countdown. Mods stick onto a limb right away. If a limb is destroyed, its part and mods go with it.</p></div>
      <div class="detail-panel"><h3>Your Core is your energy</h3><ul><li>15–20 Core: 4 energy</li><li>8–14 Core: 3 energy</li><li>1–7 Core: 2 energy</li></ul>
        <p>Energy ramps up over your first turns. <b>Overdrive</b> gives +2 energy for 3 Core, once per turn.</p></div>
      <div class="detail-panel"><h3>Pilots</h3><p>Your pilot’s passive is always on and its label lights up while it’s ready. The ring around the portrait is the Special meter: it fills when you deal or take damage, cause crashes and dodge heavy attacks. A full Special is free to use.</p></div>
      <div class="detail-panel"><h3>The clock</h3><p>Fights last up to 30 turns each. After turn 18 the arena melts down and both Cores lose 1 at the start of each turn. If time runs out, the higher Core wins.</p></div>
      <div class="detail-panel"><h3>The Battle Tower</h3><p>Every floor is a fresh fight on a new map against a tougher AI. Twists change the rules for a couple of floors, and every fifth floor is a boss. Ranked climbs end at your first loss. Practice climbs let you retry for half the scrap.</p></div>
      <div class="detail-panel"><h3>Hidden info</h3><p>You can’t see the enemy’s hand or what they’re building, and the AI can’t see yours. It reads the board and plays the odds, just like you.</p></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- sheets

function cardSheet(i) {
  const p = you();
  const id = p.hand[i];
  const c = CARDS[id];
  const cost = cardCost(p, id);
  const mine = myTurn();
  const ok = mine && canInstall(G, p, id);
  let reason = '';
  if (!mine) reason = 'Wait for your turn.';
  else if (!p.flags.workshop) reason = p.ap > 0 ? 'Open the Workshop first (1 action, from the board).' : 'Open the Workshop next turn to install this.';
  else if (cost > p.energy) reason = `Needs ${cost} energy. You have ${p.energy}.`;
  else if (p.mods.norepair && ['repair', 'rebuild', 'core'].includes(c.effect)) reason = 'Twist: no repairs this floor.';
  else if (c.type === 'part' && p.workshop.length >= 3) reason = 'Your Workshop is full.';
  else if (!ok) reason = { rebuild: 'No destroyed limb to rebuild.', repair: 'No damaged limb to repair.', rush: 'Nothing in the Workshop to rush.', lockFoe: `The enemy is more than ${c.range} tiles away.`, guard: 'You already have the most drones.', core: 'Your Core is full.' }[c.effect] || 'Can’t be used right now.';

  const doc = DOCTRINES[p.doctrine];
  const stats = [`<span class="stat">${BOLT(false, 'ib')} ${cost} energy${cost < c.cost ? ' (Okafor −1)' : ''}</span>`];
  if (c.type === 'part') {
    stats.push(`<span class="stat">${CLOCK} ${doc.time ? `Ready in ${plural(doc.time, 'turn')}` : 'Instant'} (${doc.short})</span>`);
    stats.push(`<span class="stat">${c.hp} HP</span>`);
    if (c.mobility) stats.push(`<span class="stat">Mobility ${c.mobility}</span>`);
  } else stats.push('<span class="stat">Instant</span>');
  const atk = c.attack ? `<p class="atk-line"><b>${c.attack.name}:</b> ${atkLine(c.attack)}</p>` : '';

  let actions = '';
  if (ok) {
    const targets = installTargets(G, p, id);
    if (c.target === 'tile') {
      actions = '<button class="btn opt" data-act="pickTile" data-id="' + id + '">Pick a tile on the board</button>';
    } else {
      actions = targets.map((t) => {
        if (t === null) return `<button class="btn opt" data-act="install" data-id="${id}">Use now<span class="sub">${cost} energy</span></button>`;
        const l = p.limbs[t];
        const verb = c.type === 'part' ? (l.alive ? 'Replace' : 'Build on') : c.type === 'mod' ? 'Stick on' : c.effect === 'repair' ? 'Repair' : 'Rebuild';
        const extra = c.type === 'part' ? (l.part ? `swaps out ${CARDS[l.part.id].name}` : l.alive ? 'swaps out the base limb' : 'destroyed limb') : c.effect === 'repair' ? `${l.hp}/${l.max} HP` : c.type === 'mod' ? `${l.mods.length}/2 mods` : '';
        return `<button class="btn opt" data-act="install" data-id="${id}" data-t="${t}">${verb} ${LIMB_NAMES[t].toLowerCase()}<span class="sub">${extra}</span></button>`;
      }).join('');
      actions = `<p class="note">Tip: you can also drag the sticker onto your mech.</p>${actions}`;
    }
  } else actions = `<p class="note warn">${reason}</p>`;
  return `<div class="big-card-art" style="--tc:${TYPE_COLORS[c.type]}">${cardSticker(id, p.frame)}</div>
    <h3>${c.sig ? '★ ' : ''}${c.name}</h3><div class="sub-line">${cardMeta(c)}${c.frame ? ` · ${FRAMES[c.frame].name}` : ' · shared'}</div>
    <p>${c.text}</p>${atk}<div class="stats">${stats.join('')}</div>
    ${actions}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function limbSheet(side, k) {
  const p = side === 'foe' ? foe() : you();
  const l = p.limbs[k];
  const whose = side === 'foe' ? 'Enemy' : 'Your';
  const a = attackOf(G, p, k);
  const part = l.alive && l.part ? CARDS[l.part.id] : null;
  const job = { head: 'Sensors. Destroyed: direct fire −2 range.', armL: 'Weapon slot.', armR: 'Weapon slot.', legs: 'Movement. Destroyed: −1 action and Mobility 1.' }[k];
  return `<h3>${whose} ${LIMB_NAMES[k].toLowerCase()}</h3><div class="sub-line">${l.alive ? `${l.hp} / ${l.max} HP` : 'Destroyed'}${k === 'legs' && l.alive ? ` · Mobility ${mobility(p)}` : ''}</div>
    <p>${job}</p>
    ${part ? `<p><b>Part:</b> ${part.name}. ${part.text.replace('Signature. ', '')}</p>` : l.alive ? '<p><b>Part:</b> base limb.</p>' : '<p>A Rebuild Kit, or a new part, brings it back.</p>'}
    ${a ? `<p class="atk-line"><b>${a.name}:</b> ${atkLine(a)}</p>` : ''}
    ${l.mods.length ? `<p><b>Mods:</b> ${l.mods.map((m) => `${CARDS[m.id].name} (${CARDS[m.id].text.replace('Sticks onto a limb: ', '')})`).join(' ')}</p>` : ''}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button>${side === 'you' ? '<button class="btn" data-act="viewBuild">Open build</button>' : '<button class="btn" data-act="viewFoe">Enemy build</button>'}</div>`;
}

function pilotSheet(side) {
  const p = side === 'foe' ? foe() : you();
  const pi = PILOTS[p.pilot];
  const ready = p.meter >= RULES.meterMax && !p.flags.special;
  const can = side === 'you' && myTurn() && ready;
  return `<div class="pilot-head"><span class="ph-face">${pilotSVG(p.pilot)}</span><div><h3>${pi.name}</h3><div class="sub-line">${side === 'foe' ? 'Enemy pilot' : 'Your pilot'} · ${pi.style}</div></div></div>
    <p><b>Passive${passiveLit(p) ? ' (ready)' : ' (used this turn)'}:</b> ${pi.text}</p>
    <p><b>Special, ${pi.special}:</b> ${pi.specialText} It’s free and doesn’t cost an action.</p>
    <div class="meter-bar"><i style="width:${Math.min(100, p.meter)}%"></i><span>Special meter ${Math.floor(Math.min(100, p.meter))}%</span></div>
    <p class="note">The meter fills when you deal damage, take damage, cause crashes and dodge heavy attacks.</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button>${can ? `<button class="btn" data-act="special">Use ${pi.special}</button>` : ''}</div>`;
}

function foeSheet(note = '') {
  const f = foe();
  const rows = LIMBS.map((k) => {
    const l = f.limbs[k];
    const a = attackOf(G, f, k);
    return `<li><b>${LIMB_NAMES[k]}</b> ${l.alive ? `${l.hp}/${l.max} HP${l.part ? ` · ${CARDS[l.part.id].name}` : ''}${a ? ` · ${a.name} ${a.dmg || ''}` : ''}` : 'destroyed'}</li>`;
  }).join('');
  return `<h3>Enemy ${FRAMES[f.frame].name}</h3><div class="sub-line">Core ${f.core}/20 · ${isExposed(f) ? 'open' : 'shielded'} · Mobility ${mobility(f)} · ${plural(f.guard, 'Guard drone')}</div>
    ${note ? `<p class="note warn">${note}</p>` : ''}
    <ul class="plain">${rows}</ul>
    <p><b>Pilot:</b> ${PILOTS[f.pilot].name}. ${PILOTS[f.pilot].text}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button><button class="btn" data-act="viewFoe">Enemy build</button></div>`;
}

function tileSheet(x, y) {
  const t = tileAt(G, x, y);
  const T = TERRAIN[t.t];
  const tg = G.telegraphs.filter((g) => g.cells.some((c) => c.x === x && c.y === y));
  return `<h3>${T.name}</h3><div class="sub-line">${T.hp ? `${t.hp} / ${T.hp} HP` : t.t === 'river' ? 'Can’t be destroyed' : 'Clear ground'}</div>
    <p>${T.text || 'Costs 1 to move through.'}</p>
    ${tg.map((g) => `<p class="note ${g.owner === 1 ? 'warn' : ''}"><b>${g.owner === 0 ? 'Your' : 'Enemy'} ${g.atk.name} (${g.dmg})</b> is locked on here. It fires at the start of ${g.owner === 0 ? 'your' : 'their'} next turn.</p>`).join('')}
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function menuSheet() {
  const run = load().run;
  const f = foe();
  const tw = run.battle.twist;
  return `<h3>Floor ${run.floor} · ${MAP_THEMES[G.board.theme].name}</h3>
    <div class="sub-line">${FRAMES[f.frame].name} · ${PILOTS[f.pilot].name} · skill ${LEVEL_NAMES[LEVELS.indexOf(aiLevel(run.floor))]}</div>
    <p><b>Enemy trait:</b> ${FRAMES[f.frame].trait}</p>
    <p><b>Enemy crew:</b> ${DOCTRINES[f.doctrine].name}. ${DOCTRINES[f.doctrine].text}</p>
    ${tw ? `<p><b>Twist: ${TWISTS[tw].name}.</b> ${TWISTS[tw].text}</p>` : ''}
    <p><b>Your trait:</b> ${FRAMES[you().frame].trait}</p>
    <div class="actions wrap"><button class="btn white" data-act="log">Battle log</button><button class="btn white" data-act="viewFoe">Enemy build</button>
      <button class="btn white" data-act="go" data-to="manual">Rules</button><button class="btn red" data-act="forfeit">Forfeit</button></div>
    <div class="actions"><button class="btn" data-act="closeSheet">Back to the fight</button></div>`;
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
    if (['end', 'move'].includes(e.type)) continue;
    const t = describe(e);
    if (t) html += `<li class="${e.p === 0 ? 'you' : 'foe'}">${esc(t)}</li>`;
  }
  if (open) html += '</ul>';
  return `<h3>Battle log</h3><div class="log">${html || '<p>Nothing has happened yet.</p>'}</div>
    <div class="actions"><button class="btn white" data-act="closeSheet">Close</button></div>`;
}

function nameSheet() {
  return `<h3>Pilot callsign</h3><p>This name goes on the leaderboard. You can change it in Settings.</p>
    <input id="name-in" class="name-input" maxlength="16" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Callsign" enterkeyhint="done">
    <div class="actions"><button class="btn white" data-act="go" data-to="title">Cancel</button><button class="btn" data-act="saveNameGo">Save</button></div>`;
}

function toast(text) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = text;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

// ---------------------------------------------------------------- input

function tryStep(a) {
  if (isLegal(G, a)) { step(a); return true; }
  sfx('error');
  render();
  return false;
}

function onTile(x, y) {
  if (!G) return;
  const p = you();
  const atFoe = foe().pos.x === x && foe().pos.y === y;
  const atMe = p.pos.x === x && p.pos.y === y;
  const k = `${x},${y}`;
  if (!myTurn()) {
    if (atFoe) openSheet(foeSheet());
    else openSheet(tileSheet(x, y));
    return;
  }
  if (ui.mode === 'aim' && ui.atk) {
    const set = aimTiles(ui.atk);
    if (set.has(k)) {
      const a = attackOf(G, p, ui.atk);
      if (ui.aim && ui.aim.x === x && ui.aim.y === y && a.shape !== 'single') { handlers.fire({}); return; }
      ui.aim = { x, y };
      sfx('tap');
      render();
      return;
    }
    if (atMe) { handlers.cancel(); return; }
    ui.aim = null; render();
    return;
  }
  if (ui.mode === 'tile' && ui.tileCard) {
    if (installTargets(G, p, ui.tileCard).includes(k)) tryStep({ t: 'install', id: ui.tileCard, target: k });
    return;
  }
  if (ui.mode !== 'idle') { ui.mode = 'idle'; render(); return; }
  if (atFoe) {
    if (legal().some((a) => a.t === 'attack' && a.x === x && a.y === y)) { ui.mode = 'weapon'; ui.quick = true; sfx('tap'); render(); }
    else openSheet(foeSheet('None of your weapons can reach the enemy from here. Move closer or line up a straight shot.'));
    return;
  }
  const mv = legal().find((a) => a.t === 'move' && a.x === x && a.y === y);
  if (mv) { step(mv); return; }
  if (atMe) { ui.buildTab = 'you'; go('build'); return; }
  openSheet(tileSheet(x, y));
}

const handlers = {
  go: (d) => go(d.to),
  closeSheet: () => closeSheet(),
  noop: () => {},
  setup: (d) => {
    const s = load();
    ui.setupMode = d.mode;
    if (!s.unlocked.includes(ui.pick.frame)) ui.pick.frame = s.unlocked[0];
    if (d.mode === 'ranked' && !s.name) { ui.screen = 'setup'; openSheet(nameSheet()); return; }
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
  continue: () => { const run = load().run; if (run.battle) startOrResumeBattle(); else go('intro'); },
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
      if (d.k === 'hints' || d.k === 'sound') s.settings[d.k] = d.v === 'on';
      else s.settings[d.k] = d.v;
    });
    if (d.k === 'sound' && d.v === 'on') sfx('turn');
    render();
  },
  saveNameSettings: () => {
    const v = (document.getElementById('name-in')?.value || '').trim().slice(0, 16);
    if (!v) { document.getElementById('name-in')?.focus(); return; }
    update((s) => { s.name = v; });
    toast('Callsign saved.');
    render();
  },
  saveNameGo: () => {
    const v = (document.getElementById('name-in')?.value || '').trim().slice(0, 16);
    if (!v) { document.getElementById('name-in')?.focus(); return; }
    update((s) => { s.name = v; });
    go('setup');
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

  // battle: board
  tile: (d) => onTile(Number(d.x), Number(d.y)),
  attackMenu: () => { if (!myTurn()) return; ui.mode = 'weapon'; ui.quick = false; sfx('tap'); render(); },
  pickWeapon: (d) => {
    ui.atk = d.k;
    ui.mode = 'aim';
    ui.aim = null;
    const set = aimTiles(d.k);
    const fk = `${foe().pos.x},${foe().pos.y}`;
    if (set.has(fk)) ui.aim = { ...foe().pos };
    else if (set.size === 1) { const [x, y] = [...set][0].split(',').map(Number); ui.aim = { x, y }; }
    sfx('tap');
    render();
  },
  fire: (d) => {
    if (!ui.aim || !ui.atk) return;
    const a = { t: 'attack', limb: ui.atk, x: ui.aim.x, y: ui.aim.y };
    if (d.part) a.part = d.part;
    tryStep(a);
  },
  prepMenu: () => { ui.mode = 'prep'; sfx('tap'); render(); },
  prep: (d) => tryStep({ t: 'prep', kind: d.k }),
  buildMenu: () => {
    const p = you();
    if (p.flags.workshop || !myTurn() || p.ap <= 0 || !p.hand.length) { ui.buildTab = 'you'; go('build'); return; }
    ui.mode = 'shop'; sfx('tap'); render();
  },
  openShop: () => { if (tryStep({ t: 'workshop' })) { ui.buildTab = 'you'; go('build'); } },
  viewBuild: () => { ui.mode = 'idle'; ui.buildTab = 'you'; go('build'); },
  viewFoe: () => { ui.mode = 'idle'; ui.buildTab = 'foe'; go('build'); },
  toBoard: () => { ui.mode = ui.tileCard ? 'tile' : 'idle'; go('battle'); },
  buildTab: (d) => { ui.buildTab = d.v; render(); },
  cancel: () => { ui.mode = 'idle'; ui.atk = null; ui.aim = null; ui.quick = false; ui.tileCard = null; render(); },
  undo: () => {
    const run = load().run;
    if (!canUndo(run)) return;
    run.actions.pop();
    save();
    G = rebuild(run);
    logSeen = G.log.length;
    ui.mode = 'idle'; ui.ticker = 'Undone.';
    sfx('tap');
    render();
  },
  overdrive: () => {
    const p = you();
    const after = p.core - overdriveCost(p);
    openSheet(`<h3>Overdrive</h3><p>Push the Core for <b>+${RULES.overdriveEnergy} energy</b> right now. It costs <b>${overdriveCost(p)} Core</b>, once per turn, and doesn’t use an action.</p>
      <p class="note">Core ${p.core} → ${after}. Afterwards your Core makes ${energyOutput({ ...p, core: after })} energy per turn.</p>
      <div class="actions"><button class="btn white" data-act="closeSheet">Cancel</button><button class="btn red" data-act="doOverdrive">Overdrive</button></div>`);
  },
  doOverdrive: () => { ui.sheet = null; tryStep({ t: 'overdrive' }); },
  pilot: (d) => openSheet(pilotSheet(d.side)),
  special: () => { ui.sheet = null; tryStep({ t: 'special' }); },
  coreInfo: (d) => {
    const p = d.side === 'foe' ? foe() : you();
    const whose = d.side === 'foe' ? 'The enemy Core' : 'Your Core';
    const left = RULES.exposeAfter - destroyedCount(p);
    openSheet(`<h3>${whose}: ${p.core} / 20</h3><p>The Core is health and power plant in one. At 15+ it makes 4 energy a turn, at 8–14 it makes 3, and below 8 just 2. At 0 the mech is destroyed.</p>
      <p>Every limb hit also deals 1 to the Core, and crashes hit it directly.</p>
      <p>${isExposed(p) ? '<b>It’s open:</b> two limbs are down, so precise attacks can aim at it.' : `<b>It’s shielded</b> until ${plural(left, 'more limb')} ${left === 1 ? 'is' : 'are'} destroyed.`}</p>
      <div class="actions"><button class="btn white" data-act="closeSheet">Got it</button></div>`);
  },
  limbInfo: (d) => openSheet(limbSheet(d.side, d.limb)),
  menu: () => openSheet(menuSheet()),
  log: () => openSheet(logSheet()),
  forfeit: () => openSheet(`<h3>Forfeit this fight?</h3><p>${load().run.mode === 'ranked' ? 'This counts as a loss and ends your ranked run.' : 'You can retry the floor afterwards.'}</p>
    <div class="actions"><button class="btn white" data-act="closeSheet">Keep fighting</button><button class="btn red" data-act="confirmForfeit">Forfeit</button></div>`),
  confirmForfeit: () => { ui.sheet = null; G.winner = 1; finishBattle(); },
  endTurn: () => {
    if (!myTurn()) return;
    step({ t: 'end' });
    if (G.winner === null) enemyTurn();
  },

  // battle: build screen
  install: (d) => { ui.sheet = null; tryStep({ t: 'install', id: d.id, target: d.t ?? null }); },
  pickTile: (d) => { ui.sheet = null; ui.tileCard = d.id; ui.mode = 'tile'; go('battle'); },
};

// ---------------------------------------------------------------- drag stickers onto the mech (Build screen)

function dropTargets(id) {
  const acts = legal().filter((a) => a.t === 'install' && a.id === id);
  return { limbs: new Set(acts.filter((a) => a.target).map((a) => a.target)), any: acts.find((a) => a.target === null) || null };
}

function markDrops(t) {
  document.querySelectorAll('#build-you .limb[data-limb], .limb-row[data-limb]').forEach((el) => { if (t.limbs.has(el.dataset.limb)) el.classList.add('drop-ok'); });
  if (t.any) document.querySelector('#build-you')?.classList.add('drop-any');
}

function clearDrops() {
  document.querySelectorAll('.drop-ok, .drop-hover, .drop-any').forEach((el) => el.classList.remove('drop-ok', 'drop-hover', 'drop-any'));
}

function dropAt(x, y, t) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  let limbEl = el.closest('.limb-row[data-limb]');
  if (!limbEl) {
    let best = null, bestArea = Infinity;
    for (const c of document.querySelectorAll('#build-you .limb[data-limb]')) {
      const r = c.getBoundingClientRect();
      if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) {
        const area = r.width * r.height + (t.limbs.has(c.dataset.limb) ? 0 : 1e6);
        if (area < bestArea) { best = c; bestArea = area; }
      }
    }
    limbEl = best;
  }
  if (limbEl && t.limbs.has(limbEl.dataset.limb)) return { limb: limbEl.dataset.limb, el: limbEl };
  if (t.any && el.closest('#build-you')) return { any: true, el: document.querySelector('#build-you') };
  return null;
}

const drag = { start: null, active: false, ghost: null, targets: null, over: null, suppressClick: false };

app.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hand]');
  if (!el || ui.screen !== 'build' || ui.sheet) return;
  drag.start = { x: e.clientX, y: e.clientY, i: Number(el.dataset.hand), el, id: e.pointerId };
});

app.addEventListener('pointermove', (e) => {
  if (!drag.start || e.pointerId !== drag.start.id) return;
  const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
  if (!drag.active) {
    if (Math.hypot(dx, dy) < 8) return;
    const id = you().hand[drag.start.i];
    if (!myTurn() || !canInstall(G, you(), id) || CARDS[id].target === 'tile') { drag.start = null; return; }
    drag.active = true;
    drag.targets = dropTargets(id);
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.innerHTML = cardSticker(id, you().frame);
    fx.appendChild(drag.ghost);
    drag.start.el.classList.add('lifted');
    document.body.classList.add('dragging');
    markDrops(drag.targets);
  }
  drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -70%) rotate(-6deg)`;
  const hit = dropAt(e.clientX, e.clientY, drag.targets);
  if (drag.over?.el !== hit?.el) { drag.over?.el?.classList.remove('drop-hover'); hit?.el?.classList.add('drop-hover'); }
  drag.over = hit;
  e.preventDefault();
}, { passive: false });

function endDrag(e, cancelled) {
  if (!drag.start) return;
  if (drag.active) {
    const id = you().hand[drag.start.i];
    const hit = cancelled ? null : dropAt(e.clientX, e.clientY, drag.targets);
    drag.ghost?.remove();
    drag.start.el.classList.remove('lifted');
    document.body.classList.remove('dragging');
    clearDrops();
    drag.suppressClick = true;
    setTimeout(() => { drag.suppressClick = false; }, 50);
    if (hit) tryStep(hit.limb ? { t: 'install', id, target: hit.limb } : drag.targets.any);
  }
  drag.start = null; drag.active = false; drag.ghost = null; drag.over = null; drag.targets = null;
}
app.addEventListener('pointerup', (e) => endDrag(e, false));
app.addEventListener('pointercancel', (e) => endDrag(e, true));

app.addEventListener('click', (e) => {
  const handEl = e.target.closest('[data-hand]');
  if (handEl && !ui.sheet) {
    if (!drag.suppressClick) openSheet(cardSheet(Number(handEl.dataset.hand)));
    return;
  }
  const stop = e.target.closest('[data-stop]');
  const el = e.target.closest('[data-act]');
  if (stop && el && !stop.contains(el)) return;
  // Tapping a limb on the Build screen mech opens its details.
  if (ui.screen === 'build' && !ui.sheet && !el) {
    const part = e.target.closest('.limb[data-limb], .pstk[data-limb]');
    if (part && part.dataset.limb !== 'torso') { openSheet(limbSheet(ui.buildTab, part.dataset.limb)); return; }
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

// Offline support once installed.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Debug helper for testing in the browser console.
window.__mw = { get G() { return G; }, ui, load, resetAll, go, render, step, handlers, enemyTurn };

render();

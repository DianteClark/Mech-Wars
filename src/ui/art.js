// Sticker-style vector art, drawn in code. Everything is SVG: crisp at any size, no pixels.
//
// Mechs are modular: every part (head, torso, each arm, legs) is its own die-cut sticker
// with its own white border and drop shadow. Upgrades are smaller stickers slapped on top
// of a part. Hurt parts hang loose and get scuffed; destroyed parts peel off and leave a ghost.

import { CARDS, FRAMES } from '../engine/data.js';

export const INK = '#121633';
const LINE_W = 3;        // ink outline
const CUT_W = 10;        // white die-cut border (stroke width; half shows outside)
const RIM_W = CUT_W + 4.5; // thin dark rim around the die-cut, Block Dungeon style

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}

// ---- shape helpers: [tag, attrs, tone]
const P = (d, tone = 'main') => ['path', { d }, tone];
const C = (cx, cy, r, tone = 'main') => ['circle', { cx, cy, r }, tone];

// Mirror a path across x = 100 (paths here use absolute M/L/Q/Z only).
function mx(d) {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => (i++ % 2 === 0 ? String(200 - Number(n)) : n));
}
const both = (d, tone) => [P(d, tone), P(mx(d), tone)];

// Body plans in a 200x200 box.
// pivot: where a part hinges (for the loose "peeling" tilt). mounts: where upgrade stickers go.
const BODIES = {
  // Brawler: broad heavy-armor build, huge pauldrons and gauntlets.
  brakka: {
    legs: [
      ...both('M72 134 L92 134 L94 152 L74 152 Z', 'dark'),
      ...both('M70 150 L96 150 L95 164 L72 164 Z'),
      ...both('M68 164 L96 164 L99 186 L60 186 Z'),
      ...both('M72 152 L92 152', 'line'),
    ],
    torso: [
      P('M78 64 L122 64 L128 76 L72 76 Z', 'dark'),
      P('M64 74 L136 74 L130 110 L112 128 L88 128 L70 110 Z'),
      P('M70 78 L104 78 L98 88 L74 92 Z', 'shine'),
      P('M84 126 L116 126 L112 142 L88 142 Z', 'dark'),
      P('M100 108 L100 126 M80 112 L88 120 M120 112 L112 120', 'line'),
    ],
    armL: [
      P('M26 66 L64 58 L70 84 L34 92 L22 80 Z'),
      P('M30 68 L60 62 L58 70 L32 76 Z', 'shine'),
      P('M38 90 L60 86 L60 106 L40 108 Z', 'dark'),
      P('M28 104 L64 100 L66 132 L26 134 Z'),
      P('M32 132 L62 132 L60 152 L34 152 Z', 'dark'),
      P('M40 136 L40 148 M47 136 L47 148 M54 136 L54 148', 'line'),
    ],
    head: [
      P('M100 50 L82 32 L89 31 L100 42 L111 31 L118 32 Z', 'accent'),
      P('M86 44 L114 44 L119 56 L112 70 L88 70 L81 56 Z'),
      P('M88 47 L104 47 L101 52 L86 53 Z', 'shine'),
      P('M88 56 L112 56 L109 62 L91 62 Z', 'visor'),
      P('M93 66 L107 66 L104 73 L96 73 Z', 'dark'),
    ],
    core: [100, 95, 11],
    pivot: { head: [100, 72], armL: [60, 70], armR: [140, 70], legs: [100, 134] },
    mounts: { head: [100, 40], armL: [46, 150], armR: [154, 150], legs: [100, 178] },
  },
  // Gunner: tall and lean, sensor mono-eye, long antenna and backpack fins.
  longshot: {
    legs: [
      ...both('M82 126 L95 126 L95 148 L84 148 Z', 'dark'),
      ...both('M79 146 L97 146 L96 158 L80 158 Z'),
      ...both('M81 158 L96 158 L97 178 L83 178 Z', 'dark'),
      ...both('M74 177 L99 177 L101 188 L68 188 Z'),
    ],
    torso: [
      ...both('M72 66 L56 40 L63 38 L80 62 Z', 'accent'),
      P('M72 62 L128 62 L124 98 L108 114 L92 114 L76 98 Z'),
      P('M77 66 L106 66 L101 75 L79 78 Z', 'shine'),
      P('M88 112 L112 112 L110 130 L90 130 Z', 'dark'),
      P('M100 98 L100 112 M84 72 L84 92 M116 72 L116 92', 'line'),
    ],
    armL: [
      P('M50 64 L74 62 L76 80 L52 84 Z'),
      P('M53 66 L70 65 L68 71 L54 73 Z', 'shine'),
      P('M53 84 L67 82 L67 106 L55 108 Z', 'dark'),
      P('M48 106 L70 104 L72 136 L50 138 Z'),
      P('M52 138 L68 138 L66 150 L54 150 Z', 'dark'),
    ],
    head: [
      P('M110 40 L125 16 L129 18 L115 42 Z', 'accent'),
      P('M88 36 L112 36 L117 48 L110 60 L90 60 L83 48 Z'),
      P('M90 39 L104 39 L101 44 L88 45 Z', 'shine'),
      P('M89 47 L111 47 L109 53 L91 53 Z', 'visor'),
      C(103, 50, 3.2, 'ink'),
    ],
    core: [100, 86, 10],
    pivot: { head: [100, 62], armL: [70, 68], armR: [130, 68], legs: [100, 126] },
    mounts: { head: [100, 32], armL: [60, 148], armR: [140, 148], legs: [100, 182] },
  },
  // Tank: a walking fortress. Slab chest, shield pauldrons, wide stance.
  bastion: {
    legs: [
      ...both('M66 136 L92 136 L92 156 L68 156 Z', 'dark'),
      ...both('M60 152 L96 152 L94 166 L62 166 Z'),
      ...both('M54 166 L98 166 L100 188 L52 188 Z'),
      ...both('M58 177 L96 177', 'line'),
    ],
    torso: [
      P('M74 62 L126 62 L132 72 L68 72 Z', 'dark'),
      P('M54 70 L146 70 L140 114 L120 134 L80 134 L60 114 Z'),
      P('M60 74 L110 74 L104 84 L62 88 Z', 'shine'),
      P('M82 128 L118 128 L114 144 L86 144 Z', 'dark'),
      P('M66 112 L82 126 M134 112 L118 126 M100 116 L100 128', 'line'),
      C(64, 80, 2.2, 'ink'), C(136, 80, 2.2, 'ink'),
    ],
    armL: [
      P('M14 56 L58 52 L62 86 L26 94 L12 76 Z'),
      P('M18 58 L54 55 L52 63 L20 67 Z', 'shine'),
      P('M30 92 L52 90 L52 110 L32 112 Z', 'dark'),
      P('M22 108 L58 106 L60 140 L22 142 Z'),
      P('M28 140 L54 140 L52 156 L30 156 Z', 'dark'),
      P('M28 120 L52 119', 'line'),
    ],
    head: [
      P('M94 44 L100 32 L106 44 Z', 'accent'),
      P('M82 42 L118 42 L122 54 L117 66 L83 66 L78 54 Z'),
      P('M85 45 L106 45 L103 50 L84 51 Z', 'shine'),
      P('M85 52 L115 52 L113 58 L87 58 Z', 'visor'),
    ],
    core: [100, 96, 13],
    pivot: { head: [100, 66], armL: [56, 66], armR: [144, 66], legs: [100, 136] },
    mounts: { head: [100, 36], armL: [40, 156], armR: [160, 156], legs: [100, 180] },
  },
  // Trickster: slim and angular, wing fins, blade forearms.
  specter: {
    legs: [
      ...both('M84 126 L96 126 L94 150 L84 150 Z', 'dark'),
      ...both('M81 148 L97 148 L92 176 L84 176 Z'),
      ...both('M76 175 L96 175 L98 186 L70 188 Z', 'dark'),
    ],
    torso: [
      ...both('M72 72 L34 44 L44 42 L82 66 Z', 'accent'),
      P('M100 56 L132 70 L122 106 L106 120 L94 120 L78 106 L68 70 Z'),
      P('M100 61 L122 71 L104 78 L78 74 Z', 'shine'),
      P('M90 118 L110 118 L106 132 L94 132 Z', 'dark'),
      P('M100 96 L100 118', 'line'),
    ],
    armL: [
      P('M54 68 L74 68 L74 86 L56 90 Z'),
      P('M56 88 L69 88 L67 106 L58 106 Z', 'dark'),
      P('M50 104 L71 104 L67 136 L54 138 Z'),
      P('M52 72 L70 71 L69 77 L54 78 Z', 'shine'),
      P('M53 136 L65 136 L46 172 Z', 'accent'),
    ],
    head: [
      P('M100 26 L100 12 L104 26 Z', 'accent'),
      P('M100 26 L117 43 L112 58 L88 58 L83 43 Z'),
      P('M100 30 L111 41 L96 44 L88 42 Z', 'shine'),
      P('M89 45 L111 45 L107 51 L93 51 Z', 'visor'),
    ],
    core: [100, 88, 10],
    pivot: { head: [100, 58], armL: [70, 74], armR: [130, 74], legs: [100, 126] },
    mounts: { head: [100, 24], armL: [58, 140], armR: [142, 140], legs: [100, 180] },
  },
};
for (const b of Object.values(BODIES)) b.armR = b.armL.map(([tag, a, tone]) => (tag === 'path' ? P(mx(a.d), tone) : C(200 - a.cx, a.cy, a.r, tone)));

const GLOW = { brakka: '#FFE45C', longshot: '#7DF9FF', bastion: '#C8FFE9', specter: '#FF8CF2' };
const DECOR = ['line', 'shine', 'shineline', 'ink'];

function attrs(o) {
  return Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
}

function fillFor(tone, pal) {
  switch (tone) {
    case 'dark': return pal.dark;
    case 'light': return pal.light;
    case 'accent': return pal.accent;
    case 'visor': return pal.glow;
    case 'ink': return INK;
    case 'white': return '#fff';
    case 'steel': return '#C9D3EA';
    case 'steelDark': return '#8E9BC0';
    case 'gold': return '#FFC929';
    case 'red': return '#FF4F64';
    case 'mint': return '#39E3A6';
    case 'sky': return '#9FF3FF';
    default: return pal.main;
  }
}

// One die-cut sticker: soft shadow, white border, then the art with ink outlines.
function sticker(shapes, pal, { cls = '', attrsStr = '', ghost = false } = {}) {
  const solid = shapes.filter(([, , t]) => !DECOR.includes(t) && t !== 'visor-free');
  if (ghost) {
    const g = solid.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');
    return `<g class="ghost ${cls}" ${attrsStr} fill="#3A4775" fill-opacity=".35" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-dasharray="4 4" stroke-linejoin="round">${g}</g>`;
  }
  const outline = solid.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');
  let art = '';
  for (const [tag, a, tone] of shapes) {
    if (tone === 'line') art += `<${tag} ${attrs(a)} fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" opacity=".45"/>`;
    else if (tone === 'shine') art += `<${tag} ${attrs(a)} fill="#fff" fill-opacity=".45"/>`;
    else if (tone === 'shineline') art += `<${tag} ${attrs(a)} fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>`;
    else if (tone === 'ink') art += `<${tag} ${attrs(a)} fill="${INK}"/>`;
    else art += `<${tag} ${attrs(a)} fill="${fillFor(tone, pal)}" stroke="${INK}" stroke-width="${LINE_W}" stroke-linejoin="round"${tone === 'visor' ? ' class="visor"' : ''}/>`;
  }
  return `<g class="stk ${cls}" ${attrsStr}>
    <g class="stk-shadow" transform="translate(0 4)" fill="#05040F" stroke="#05040F" stroke-width="${RIM_W}" stroke-linejoin="round" opacity=".45">${outline}</g>
    <g class="stk-rim" fill="${INK}" stroke="${INK}" stroke-width="${RIM_W}" stroke-linejoin="round">${outline}</g>
    <g class="stk-cut" fill="#fff" stroke="#fff" stroke-width="${CUT_W}" stroke-linejoin="round">${outline}</g>
    ${art}</g>`;
}

// ---- Upgrade stickers. Shapes are relative to the mount anchor (0,0).
function mountShapes(id, limb) {
  const c = CARDS[id];
  const flip = limb === 'armR' ? -1 : 1;
  const X = (x) => x * flip;
  const poly = (pts, tone) => P('M' + pts.map(([x, y]) => `${X(x)} ${y}`).join(' L') + ' Z', tone);
  if (c.type === 'weapon') {
    if (limb === 'legs') { // hip missile pods
      return [poly([[-36, -26], [-20, -28], [-18, -8], [-34, -6]], 'steel'), poly([[36, -26], [20, -28], [18, -8], [34, -6]], 'steel'),
        C(-27, -20, 3.2, 'red'), C(-26, -12, 3.2, 'red'), C(27, -20, 3.2, 'red'), C(26, -12, 3.2, 'red')];
    }
    if (limb === 'head') {
      if (c.shred) return [poly([[-12, 4], [0, -14], [12, 4], [6, 8], [-6, 8]], 'gold'), P('M-5 1 L5 1', 'line')]; // headbutt crest
      if (c.emp) return [poly([[-4, 6], [-3, -12], [3, -12], [4, 6]], 'steel'), C(0, -14, 4.5, 'sky')];
      return [poly([[-16, 6], [-12, -4], [-6, -4], [-6, 8]], 'steel'), poly([[16, 6], [12, -4], [6, -4], [6, 8]], 'steel'), C(-10, 1, 2, 'ink'), C(10, 1, 2, 'ink')];
    }
    // Arm weapons: carried along the forearm, barrel pointing down.
    if (c.dmg >= 6 || c.pierce >= 2) { // rail lance: long barrel
      return [poly([[-8, -46], [6, -46], [8, -14], [-6, -14]], 'steel'), poly([[-4, -14], [4, -14], [3, 26], [-3, 26]], 'white'),
        poly([[-6, 22], [6, 22], [5, 30], [-5, 30]], 'sky'), P(`M${X(-6)} -36 L${X(6)} -36`, 'line')];
    }
    if (id === 'sniper_pistol') {
      return [poly([[-8, -22], [8, -22], [8, -8], [-8, -8]], 'steel'), poly([[-3, -8], [3, -8], [3, 12], [-3, 12]], 'white'), C(X(9), -18, 3, 'sky')];
    }
    if (id === 'ghost_blade') return [poly([[-6, -14], [6, -14], [3, 30], [-12, 40]], 'sky'), poly([[-8, -18], [8, -18], [8, -10], [-8, -10]], 'dark')];
    if (c.bash) return [poly([[-14, -34], [14, -34], [16, -6], [0, 6], [-16, -6]], 'mint'), P(`M0 -30 L0 0`, 'line')];
    const len = c.dmg >= 5 ? 22 : 16; // rifles and cannons
    return [poly([[-10, -30], [10, -30], [10, -10], [-10, -10]], 'steel'), poly([[-4, -10], [4, -10], [4, len], [-4, len]], 'white'),
      ...(c.dmg >= 5 ? [poly([[-9, -10], [-5, -10], [-5, len - 2], [-9, len - 2]], 'white')] : []), P(`M${X(-6)} -22 L${X(6)} -22`, 'line')];
  }
  if (c.type === 'boost') {
    if (c.punch) { // gauntlet sticker swaps over the fist
      const big = c.shred;
      return [poly([[-17, -20], [17, -20], [19, 6], [-19, 6]], big ? 'red' : 'gold'),
        poly([[-14, 6], [14, 6], [12, 14], [-12, 14]], 'dark'),
        ...(big ? [poly([[-12, 14], [-8, 22], [-4, 14]], 'white'), poly([[-2, 14], [2, 22], [6, 14]], 'white'), poly([[8, 14], [12, 22], [14, 14]], 'white')] : []),
        P('M-8 -14 L-8 2 M0 -14 L0 2 M8 -14 L8 2', 'line')];
    }
    if (c.kick && c.ap && id !== 'phase_treads') { // boot thrusters
      return [poly([[-40, -10], [-22, -12], [-20, 6], [-38, 8]], 'gold'), poly([[40, -10], [22, -12], [20, 6], [38, 8]], 'gold'),
        poly([[-36, 8], [-26, 8], [-31, 18]], 'red'), poly([[36, 8], [26, 8], [31, 18]], 'red')];
    }
    if (c.ap) { // phase treads: leg fins
      return [poly([[-30, -40], [-20, -38], [-24, -10], [-38, -16]], 'accent'), poly([[30, -40], [20, -38], [24, -10], [38, -16]], 'accent')];
    }
    if (c.oracle) return [poly([[-12, 6], [0, -8], [12, 6], [0, 14]], 'white'), C(0, 3, 5.5, 'accent'), C(0, 3, 2.2, 'ink')];
    if (c.weaponBonus) return [poly([[2, 0], [18, -4], [20, 6], [4, 10]], 'steel'), C(14, 3, 4.5, 'sky')];
    if (c.guardGen) return [poly([[-22, -18], [22, -18], [16, -4], [-16, -4]], 'steel'), P('M-14 -18 Q0 -38 14 -18 Z', 'mint')];
    if (c.guardBlock) return [poly([[-16, -44], [16, -44], [18, -12], [0, 2], [-18, -12]], 'mint'), poly([[-10, -38], [6, -38], [2, -30], [-10, -28]], 'white')];
  }
  return [];
}

function platingShapes(limb, body) {
  const at = { head: [100, 50], legs: [100, 158], armL: [body.mounts.armL[0], 116], armR: [body.mounts.armR[0], 116] }[limb];
  const [x, y] = at;
  const w = limb === 'head' ? 12 : 13, h = limb === 'head' ? 7 : 10;
  if (limb === 'legs') {
    return [P(`M${x - 34} ${y - h} L${x - 14} ${y - h} L${x - 15} ${y + h} L${x - 33} ${y + h} Z`, 'steel'),
      P(`M${x + 34} ${y - h} L${x + 14} ${y - h} L${x + 15} ${y + h} L${x + 33} ${y + h} Z`, 'steel'),
      C(x - 24, y, 1.8, 'ink'), C(x + 24, y, 1.8, 'ink')];
  }
  return [P(`M${x - w} ${y - h} L${x + w} ${y - h} L${x + w - 2} ${y + h} L${x - w + 2} ${y + h} Z`, 'steel'),
    C(x - w + 5, y - h + 4, 1.6, 'ink'), C(x + w - 5, y - h + 4, 1.6, 'ink'), P(`M${x - w + 4} ${y + 2} L${x + w - 4} ${y + 2}`, 'line')];
}

function scuffs(limb, body) {
  const [x, y] = { head: [106, 52], armL: [body.mounts.armL[0] + 4, 116], armR: [body.mounts.armR[0] - 4, 116], legs: [84, 160] }[limb];
  return `<g stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".7" fill="none">
    <path d="M${x - 6} ${y - 5} L${x + 1} ${y + 1} L${x - 2} ${y + 4} L${x + 6} ${y + 9}"/><path d="M${x + 4} ${y - 6} L${x + 8} ${y - 2}"/></g>`;
}

let uidCounter = 0;

// player: a game player object (or null for a clean showcase render)
// opts.slap = limb whose newest upgrade just landed; opts.peel = limb that was just destroyed
export function mechSVG(frameId, player = null, opts = {}) {
  const body = BODIES[frameId];
  const f = FRAMES[frameId];
  const uid = `m${++uidCounter}`;
  const pal = { main: f.color, dark: shade(f.color, -0.3), light: shade(f.color, 0.45), accent: f.accent, glow: GLOW[frameId] };
  const order = ['legs', 'torso', 'armL', 'armR', 'head'];
  let out = '';
  let clipDefs = '';

  for (const k of order) {
    const ls = player && k !== 'torso' ? player.limbs[k] : null;
    const destroyed = ls && !ls.alive;
    const isLimb = k !== 'torso';
    const [px, py] = body.pivot[k] || [100, 100];
    const loose = ls && ls.alive && ls.hp <= ls.max / 2;
    const tilt = loose ? ({ armL: -5, armR: 5, head: 4, legs: -2 }[k]) : 0;
    const tf = tilt ? `transform="rotate(${tilt} ${px} ${py})"` : '';
    const partCls = isLimb ? `part limb ${destroyed ? 'destroyed' : ''} ${loose ? 'loose' : ''}` : 'part torso';

    if (destroyed) {
      out += `<g class="${partCls}" data-limb="${k}">${sticker(body[k], pal, { ghost: true })}`;
      const [x, y] = body.mounts[k];
      const cy = k === 'legs' ? y - 22 : k === 'head' ? y + 14 : 112;
      out += `<g transform="translate(${x} ${cy})"><circle r="8" fill="${INK}"/><path d="M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5" stroke="#FF4F64" stroke-width="2.6" stroke-linecap="round"/></g></g>`;
      if (opts.peel === k) out += `<g class="peel" style="transform-origin:${px}px ${py}px">${sticker(body[k], pal)}</g>`;
      continue;
    }

    // Cel shade per part: a hard-edged dark band clipped to the part's shape.
    const clipId = `c${uid}${k}`;
    clipDefs += `<clipPath id="${clipId}">${body[k].filter(([, , t]) => !DECOR.includes(t)).map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('')}</clipPath>`;
    let inner = sticker(body[k], pal, { cls: 'part-stk' });
    inner += `<rect x="0" y="0" width="200" height="200" fill="url(#g${uid})" clip-path="url(#${clipId})" pointer-events="none"/>`;

    if (ls) {
      if (loose) inner += scuffs(k, body);
      if (ls.plating) inner += sticker(platingShapes(k, body), pal, { cls: `up plating ${opts.slap === k && opts.slapKind === 'plating' ? 'slap' : ''}` });
      if (ls.mount) {
        const [mxp, myp] = body.mounts[k];
        inner += sticker(mountShapes(ls.mount.id, k), pal, { cls: `up mount ${opts.slap === k && opts.slapKind !== 'plating' ? 'slap' : ''}`, attrsStr: `transform="translate(${mxp} ${myp})"` });
      }
    }
    if (k === 'torso') {
      const [cx, cy, r] = body.core;
      const pct = player ? player.core / 20 : 1;
      const glow = pct >= 0.75 ? '#FFC929' : pct >= 0.4 ? '#FF8A3D' : '#FF4F64';
      const exposed = player && ['head', 'armL', 'armR', 'legs'].filter((x) => !player.limbs[x].alive).length >= 2;
      inner += `<g class="core-gem ${exposed ? 'exposed' : ''}" data-limb="core">
        ${exposed ? `<circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="none" stroke="#FF4F64" stroke-width="2.5" stroke-dasharray="4 4" class="core-ring"/>` : ''}
        <circle cx="${cx}" cy="${cy}" r="${r + 3.5}" fill="${INK}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${glow}" class="core-glow"/>
        <path d="M${cx - r * 0.55} ${cy - r * 0.15} A${r * 0.6} ${r * 0.6} 0 0 1 ${cx + r * 0.1} ${cy - r * 0.6}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/></g>`;
    }
    out += `<g class="${partCls}" data-limb="${k}" ${tf}>${inner}</g>`;
  }

  let drones = '';
  if (player && player.guard > 0) {
    for (let i = 0; i < player.guard; i++) {
      const gx = 22 + i * 21, gy = 20;
      drones += `<g transform="translate(${gx} ${gy})"><g class="drone" style="animation-delay:${i * -0.4}s">${sticker([P('M-9 0 L0 -7 L9 0 L0 7 Z', 'mint'), C(0, 0, 2.4, 'ink')], pal)}</g></g>`;
    }
  }
  return `<svg class="mech-svg" viewBox="0 0 200 200" role="img" aria-label="${f.name}">
    <defs>${clipDefs}
      <linearGradient id="g${uid}" x1="0" x2="1" y1="0" y2="0.3">
        <stop offset="0.62" stop-color="${INK}" stop-opacity="0"/><stop offset="0.62" stop-color="${INK}" stop-opacity=".18"/>
      </linearGradient>
    </defs>
    <ellipse cx="100" cy="193" rx="56" ry="5" fill="#08123F" opacity=".35"/>
    <g class="bob">${out}</g>${drones}</svg>`;
}

// A single upgrade as a standalone sticker (Workshop slots, card art).
export function upgradeSticker(id) {
  const c = CARDS[id];
  if (!c.slots || (c.type !== 'weapon' && c.type !== 'boost')) return null;
  const limb = c.slots.includes('armL') ? 'armL' : c.slots[0];
  const shapes = mountShapes(id, limb);
  if (!shapes.length) return null;
  const pal = { main: '#C9D3EA', dark: '#4C5778', light: '#fff', accent: c.frame ? FRAMES[c.frame].color : '#FFC929', glow: '#9FF3FF' };
  return `<svg class="icon up-icon" viewBox="-50 -50 100 100" aria-hidden="true">${sticker(shapes, pal)}</svg>`;
}

// Where a limb's HP tag sits, as % of the mech box.
export function chipPos(frameId, limb) {
  const b = BODIES[frameId];
  const pos = {
    head: [100, Math.max(8, b.mounts.head[1] - 8)],
    armL: [Math.max(12, b.pivot.armL[0] - 34), b.pivot.armL[1] + 16],
    armR: [Math.min(188, b.pivot.armR[0] + 34), b.pivot.armR[1] + 16],
    legs: [100, 195],
    core: [b.core[0], b.core[1] + b.core[2] + 15],
  }[limb];
  return [pos[0] / 2, pos[1] / 2];
}

// ---------------------------------------------------------------- card icons

const ICONS = {
  gun: `<rect x="10" y="22" width="34" height="14" rx="4" fill="#fff"/><rect x="40" y="25" width="16" height="7" rx="3" fill="#fff"/><rect x="16" y="34" width="10" height="14" rx="3" fill="#FFC929"/>`,
  rail: `<rect x="6" y="24" width="52" height="10" rx="4" fill="#fff"/><rect x="12" y="20" width="18" height="18" rx="5" fill="#FFC929"/><path d="M58 29 L62 24 L62 34 Z" fill="#9FF3FF"/><path d="M36 20 L44 20 M36 38 L44 38" stroke="#121633" stroke-width="3"/>`,
  fist: `<rect x="14" y="16" width="36" height="30" rx="10" fill="#FFC929"/><path d="M23 16 L23 34 M32 16 L32 34 M41 16 L41 34" stroke="#121633" stroke-width="3"/><rect x="20" y="44" width="24" height="10" rx="4" fill="#fff"/>`,
  boot: `<path d="M18 10 L34 10 L34 36 L52 40 L52 52 L14 52 L14 40 Z" fill="#FFC929"/><path d="M14 46 L52 46" stroke="#121633" stroke-width="3"/>`,
  plate: `<rect x="12" y="12" width="40" height="40" rx="8" fill="#C9D3EA"/><circle cx="20" cy="20" r="3" fill="#121633"/><circle cx="44" cy="20" r="3" fill="#121633"/><circle cx="20" cy="44" r="3" fill="#121633"/><circle cx="44" cy="44" r="3" fill="#121633"/>`,
  wrench: `<path d="M18 46 L38 26 A10 10 0 1 1 44 32 L24 52 Z" fill="#fff"/><circle cx="44" cy="22" r="4" fill="#39E3A6"/>`,
  rebuild: `<rect x="22" y="10" width="20" height="30" rx="6" fill="#fff"/><path d="M14 46 L50 46 L44 56 L20 56 Z" fill="#39E3A6"/><path d="M32 16 L32 34 M24 25 L40 25" stroke="#121633" stroke-width="4" stroke-linecap="round"/>`,
  core: `<circle cx="32" cy="32" r="18" fill="#FFC929"/><circle cx="26" cy="26" r="5" fill="#fff"/><path d="M32 8 L32 14 M32 50 L32 56 M8 32 L14 32 M50 32 L56 32" stroke="#121633" stroke-width="4" stroke-linecap="round"/>`,
  drone: `<circle cx="22" cy="34" r="11" fill="#39E3A6"/><circle cx="42" cy="26" r="11" fill="#39E3A6"/><path d="M8 18 L20 22 M34 12 L44 14" stroke="#121633" stroke-width="3" stroke-linecap="round"/>`,
  cell: `<rect x="20" y="12" width="24" height="42" rx="6" fill="#fff"/><rect x="27" y="7" width="10" height="7" rx="2" fill="#fff"/><path d="M34 20 L26 34 L33 34 L29 46 L39 30 L32 30 Z" fill="#FFC929"/>`,
  clock: `<circle cx="32" cy="32" r="20" fill="#fff"/><path d="M32 20 L32 33 L41 38" stroke="#121633" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M48 10 L56 18 M50 18 L56 12" stroke="#FFC929" stroke-width="4" stroke-linecap="round"/>`,
  cards: `<rect x="12" y="16" width="24" height="34" rx="5" fill="#fff" transform="rotate(-12 24 33)"/><rect x="28" y="14" width="24" height="34" rx="5" fill="#FFC929" transform="rotate(10 40 31)"/>`,
  bolt: `<path d="M36 6 L16 36 L30 36 L24 58 L48 24 L34 24 Z" fill="#FFC929"/>`,
  crest: `<path d="M12 40 L32 12 L52 40 L42 50 L22 50 Z" fill="#FFC929"/><path d="M22 34 L42 34" stroke="#121633" stroke-width="3"/>`,
  scope: `<circle cx="32" cy="32" r="18" fill="#9FF3FF"/><path d="M32 8 L32 56 M8 32 L56 32" stroke="#121633" stroke-width="3"/><circle cx="32" cy="32" r="5" fill="#FF4F64"/>`,
  missile: `<rect x="10" y="18" width="44" height="28" rx="6" fill="#fff"/><circle cx="21" cy="32" r="6" fill="#FF4F64"/><circle cx="43" cy="32" r="6" fill="#FF4F64"/>`,
  pistol: `<rect x="12" y="20" width="36" height="12" rx="4" fill="#fff"/><rect x="16" y="30" width="10" height="18" rx="3" fill="#FFC929"/><path d="M48 26 L58 26" stroke="#9FF3FF" stroke-width="5" stroke-linecap="round"/>`,
  dome: `<path d="M8 46 Q32 0 56 46 Z" fill="#39E3A6"/><path d="M8 46 L56 46" stroke="#121633" stroke-width="4"/>`,
  shield: `<path d="M14 10 L50 10 L50 34 Q32 58 14 34 Z" fill="#39E3A6"/><path d="M32 14 L32 46" stroke="#121633" stroke-width="3"/>`,
  bash: `<path d="M10 14 L36 14 L36 32 Q23 50 10 32 Z" fill="#39E3A6"/><path d="M40 22 L56 18 M40 30 L58 30 M40 38 L56 42" stroke="#FFC929" stroke-width="4" stroke-linecap="round"/>`,
  brace: `<path d="M32 8 L52 16 L52 32 Q52 48 32 56 Q12 48 12 32 L12 16 Z" fill="#39E3A6"/><path d="M24 32 L30 38 L42 24" stroke="#121633" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  eye: `<path d="M6 32 Q32 6 58 32 Q32 58 6 32 Z" fill="#fff"/><circle cx="32" cy="32" r="11" fill="#B57BFF"/><circle cx="32" cy="32" r="4" fill="#121633"/>`,
  blade: `<path d="M14 50 L44 10 L50 16 L22 54 Z" fill="#E8F7FF"/><path d="M12 44 L22 54" stroke="#B57BFF" stroke-width="6" stroke-linecap="round"/>`,
  emp: `<circle cx="32" cy="32" r="10" fill="#9FF3FF"/><path d="M32 6 L36 22 L32 18 L28 22 Z M58 32 L42 36 L46 32 L42 28 Z M32 58 L28 42 L32 46 L36 42 Z M6 32 L22 28 L18 32 L22 36 Z" fill="#FFC929"/>`,
  treads: `<path d="M14 14 L30 14 L30 40 L50 44 L50 52 L14 52 Z" fill="#B57BFF"/><path d="M8 26 L2 26 M8 34 L0 34" stroke="#E8F7FF" stroke-width="4" stroke-linecap="round"/>`,
  sabotage: `<rect x="14" y="20" width="36" height="30" rx="6" fill="#fff"/><path d="M22 28 L42 44 M42 28 L22 44" stroke="#FF4F64" stroke-width="5" stroke-linecap="round"/><path d="M26 20 L26 12 M38 20 L38 12" stroke="#121633" stroke-width="3"/>`,
  surge: `<circle cx="32" cy="32" r="20" fill="#FF8A3D"/><path d="M34 14 L22 34 L31 34 L28 50 L42 28 L33 28 Z" fill="#fff"/>`,
};

const CARD_ICON = {
  pulse_rifle: 'gun', scrap_plating: 'plate', repair_pod: 'wrench', rebuild_kit: 'rebuild', core_patch: 'core',
  drone_escort: 'drone', energy_cell: 'cell', rush_order: 'clock', scavenge: 'cards',
  wrecking_fists: 'fist', hydraulic_fist: 'fist', piston_boots: 'boot', headbutt_crest: 'crest', adrenal_surge: 'surge',
  rail_lance: 'rail', twin_autocannon: 'gun', scope_visor: 'scope', missile_pod: 'missile', sniper_pistol: 'pistol',
  aegis_dome: 'dome', tower_shield: 'shield', reinforced_plating: 'plate', shield_bash: 'bash', brace: 'brace',
  oracle_eye: 'eye', ghost_blade: 'blade', emp_spike: 'emp', phase_treads: 'treads', sabotage: 'sabotage',
};

export function iconSVG(name, cls = '') {
  const inner = ICONS[name] || ICONS.bolt;
  // Die-cut layers: same shapes, no own colors, fat strokes (dark rim, then white).
  const bare = inner.replace(/\s(fill|stroke|stroke-width|stroke-linecap|fill-opacity)="[^"]*"/g, '');
  const cut = `<g fill="${INK}" stroke="${INK}" stroke-width="13" stroke-linejoin="round" stroke-linecap="round">${bare}</g><g fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">${bare}</g>`;
  // Ink outline pass: re-draw with stroke underneath for the sticker look.
  const outlined = inner.replace(/<(rect|circle|path)([^>]*?)\/>/g, (m, tag, a) =>
    /stroke=/.test(a) ? m : `<${tag}${a} stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);
  return `<svg class="icon ${cls}" viewBox="-6 -6 76 76" aria-hidden="true">${cut}${outlined}</svg>`;
}

export function cardIcon(id) {
  return iconSVG(CARD_ICON[id] || 'bolt');
}

export const TYPE_COLORS = {
  weapon: '#FF4F64', boost: '#FFC929', plating: '#8FA3D9', support: '#39E3A6', order: '#B57BFF',
};
export const TYPE_NAMES = { weapon: 'Weapon', boost: 'Upgrade', plating: 'Plating', support: 'Support', order: 'Order' };

// The logo: a die-cut wordmark.
export function logoSVG() {
  return `<svg class="logo" viewBox="0 0 360 160" role="img" aria-label="Mech Wars">
    <g font-family="Oxanium, 'Arial Black', sans-serif" font-weight="800" text-anchor="middle" stroke-linejoin="round" transform="skewX(-8) translate(12 0)">
      <text x="180" y="74" font-size="80" fill="#fff" stroke="#fff" stroke-width="22" letter-spacing="2">MECH</text>
      <text x="180" y="146" font-size="80" fill="#fff" stroke="#fff" stroke-width="22" letter-spacing="2">WARS</text>
      <text x="180" y="74" font-size="80" fill="#FFC929" stroke="${INK}" stroke-width="5" paint-order="stroke" letter-spacing="2">MECH</text>
      <text x="180" y="146" font-size="80" fill="#FF4F64" stroke="${INK}" stroke-width="5" paint-order="stroke" letter-spacing="2">WARS</text>
    </g></svg>`;
}

// Tiny glyphs for limb labels.
const LIMB_GLYPH = {
  head: '<rect x="3" y="3.5" width="10" height="9" rx="2.5" fill="#fff" stroke="#121633" stroke-width="1.6"/><rect x="5" y="6.5" width="6" height="2.4" rx="1.2" fill="#121633"/>',
  armL: '<rect x="4.5" y="2" width="7" height="8" rx="2.5" fill="#fff" stroke="#121633" stroke-width="1.6"/><rect x="3.5" y="9" width="9" height="5.5" rx="2" fill="#fff" stroke="#121633" stroke-width="1.6"/>',
  legs: '<rect x="3" y="2" width="4" height="9" rx="1.5" fill="#fff" stroke="#121633" stroke-width="1.6"/><rect x="9" y="2" width="4" height="9" rx="1.5" fill="#fff" stroke="#121633" stroke-width="1.6"/><path d="M2 14h6M8 14h6" stroke="#121633" stroke-width="2.4" stroke-linecap="round"/>',
};
LIMB_GLYPH.armR = LIMB_GLYPH.armL;
export function limbGlyph(k) {
  return `<svg class="lg" viewBox="0 0 16 16" aria-hidden="true">${LIMB_GLYPH[k]}</svg>`;
}

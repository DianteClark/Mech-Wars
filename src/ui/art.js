// Sticker-style vector art, drawn in code. Everything is SVG: crisp at any size, no pixels.
// Each mech is drawn twice: a fat white "die-cut" pass behind, then the colored pass with ink outlines.

import { CARDS, FRAMES } from '../engine/data.js';

export const INK = '#121633';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}

// ---- shape helpers: [tag, attrs, tone]
const R = (x, y, w, h, r, tone = 'main') => ['rect', { x, y, width: w, height: h, rx: r }, tone];
const C = (cx, cy, r, tone = 'main') => ['circle', { cx, cy, r }, tone];
const P = (d, tone = 'main') => ['path', { d }, tone];

// Body plans. Coordinates are in a 200x200 box. `mounts` are anchor points for attachments.
const BODIES = {
  // Brawler: hunched gorilla build, huge shoulders and fists, head sunk low.
  brakka: {
    torso: [
      P('M54 74 Q100 54 146 74 L138 132 Q100 146 62 132 Z'),
      P('M64 80 Q100 66 120 72 L114 84 Q92 80 70 90 Z', 'shine'),
      P('M78 116 L122 116 L116 134 L84 134 Z', 'dark'),
      P('M86 122 L114 122 M88 128 L112 128', 'line'),
      R(90, 132, 20, 12, 4, 'dark'),
    ],
    head: [P('M80 56 Q100 44 120 56 L118 76 L82 76 Z'), R(87, 61, 26, 8, 4, 'visor'), P('M84 56 Q92 50 100 49', 'shineline')],
    armL: [
      P('M22 70 Q40 52 64 66 L58 92 L28 96 Z'), P('M28 70 Q40 60 54 64', 'shineline'),
      R(28, 92, 30, 36, 10, 'dark'),
      R(16, 124, 46, 34, 13), P('M28 126 L28 140 M39 126 L39 140 M50 126 L50 140', 'line'),
    ],
    armR: [
      P('M178 70 Q160 52 136 66 L142 92 L172 96 Z'), P('M146 64 Q160 60 172 70', 'shineline'),
      R(142, 92, 30, 36, 10, 'dark'),
      R(138, 124, 46, 34, 13), P('M150 126 L150 140 M161 126 L161 140 M172 126 L172 140', 'line'),
    ],
    legs: [
      R(68, 138, 26, 30, 8, 'dark'), R(106, 138, 26, 30, 8, 'dark'),
      P('M58 182 L60 166 Q80 158 100 166 L100 182 Z'), P('M100 182 L100 166 Q120 158 140 166 L142 182 Z'),
    ],
    core: [100, 100, 13],
    mounts: { head: [100, 44], armL: [39, 160], armR: [161, 160], legs: [100, 180] },
  },
  // Gunner: tall and lean, long legs, antenna rig and backpack fins.
  longshot: {
    torso: [
      P('M64 62 L80 50 L84 64 Z', 'dark'), P('M136 62 L120 50 L116 64 Z', 'dark'),
      P('M70 64 L130 64 L124 124 L76 124 Z'),
      P('M76 70 L112 70 L108 80 L78 82 Z', 'shine'),
      R(82, 110, 36, 14, 5, 'dark'),
      P('M88 117 L112 117', 'line'),
    ],
    head: [P('M86 36 L114 36 L118 58 L82 58 Z'), R(88, 43, 24, 7, 3.5, 'visor'), C(108, 46.5, 5, 'accent'), P('M110 36 L118 16', 'line'), C(118, 15, 4, 'accent')],
    armL: [C(62, 70, 12, 'dark'), R(44, 76, 20, 34, 8), R(42, 106, 22, 30, 8, 'dark'), R(44, 132, 20, 12, 5)],
    armR: [C(138, 70, 12, 'dark'), R(136, 76, 20, 34, 8), R(136, 106, 22, 30, 8, 'dark'), R(136, 132, 20, 12, 5)],
    legs: [
      P('M80 124 L94 124 L92 150 L84 150 Z', 'dark'), P('M106 124 L120 124 L116 150 L108 150 Z', 'dark'),
      C(88, 152, 6), C(112, 152, 6),
      P('M82 156 L94 156 L92 178 L84 178 Z', 'dark'), P('M106 156 L118 156 L116 178 L108 178 Z', 'dark'),
      P('M72 188 L98 188 L94 176 L78 176 Z'), P('M102 188 L128 188 L122 176 L106 176 Z'),
    ],
    core: [100, 94, 11],
    mounts: { head: [100, 30], armL: [54, 146], armR: [146, 146], legs: [100, 182] },
  },
  // Tank: a walking bunker. Wide slab body, shoulder bunkers, tread feet.
  bastion: {
    torso: [
      R(46, 66, 108, 76, 16),
      P('M54 72 L120 72 L116 82 L56 86 Z', 'shine'),
      R(60, 122, 80, 18, 6, 'dark'),
      C(58, 130, 2.6, 'ink'), C(142, 130, 2.6, 'ink'), C(58, 76, 2.6, 'ink'), C(142, 76, 2.6, 'ink'),
    ],
    head: [P('M78 50 L122 50 L126 72 L74 72 Z'), R(82, 58, 36, 7, 3, 'visor'), P('M78 50 L84 44 L116 44 L122 50', 'dark')],
    armL: [R(14, 56, 44, 30, 10, 'dark'), P('M20 62 L50 62', 'shineline'), R(22, 84, 32, 48, 10), R(18, 128, 40, 24, 9, 'dark')],
    armR: [R(142, 56, 44, 30, 10, 'dark'), P('M150 62 L180 62', 'shineline'), R(146, 84, 32, 48, 10), R(142, 128, 40, 24, 9, 'dark')],
    legs: [
      R(58, 140, 34, 28, 8, 'dark'), R(108, 140, 34, 28, 8, 'dark'),
      R(48, 164, 52, 22, 10), R(100, 164, 52, 22, 10),
      P('M56 175 L92 175 M108 175 L144 175', 'line'),
    ],
    core: [100, 100, 15],
    mounts: { head: [100, 40], armL: [38, 150], armR: [162, 150], legs: [100, 182] },
  },
  // Trickster: slim and angular with fins like a cloak, blade forearms.
  specter: {
    torso: [
      P('M66 66 L40 48 L56 104 Z', 'dark'), P('M134 66 L160 48 L144 104 Z', 'dark'),
      P('M100 58 L136 76 L120 134 L80 134 L64 76 Z'),
      P('M100 64 L124 76 L102 82 L74 78 Z', 'shine'),
      P('M90 120 L110 120 L106 132 L94 132 Z', 'dark'),
    ],
    head: [P('M100 22 L124 50 L114 64 L86 64 L76 50 Z'), P('M86 48 L114 48 L108 55 L92 55 Z', 'visor'), P('M100 22 L100 40', 'line')],
    armL: [C(64, 80, 10, 'dark'), P('M56 86 L70 90 L58 132 L46 128 Z'), P('M46 128 L58 132 L40 168 Z', 'accent')],
    armR: [C(136, 80, 10, 'dark'), P('M144 86 L130 90 L142 132 L154 128 Z'), P('M154 128 L142 132 L160 168 Z', 'accent')],
    legs: [
      P('M84 132 L96 132 L90 156 L98 184 L76 184 L80 156 Z', 'dark'),
      P('M104 132 L116 132 L120 156 L124 184 L102 184 L110 156 Z', 'dark'),
    ],
    core: [100, 96, 11],
    mounts: { head: [100, 18], armL: [44, 160], armR: [156, 160], legs: [100, 182] },
  },
};

function attrs(o) {
  return Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
}

function toneFill(tone, pal) {
  switch (tone) {
    case 'dark': return pal.dark;
    case 'light': return pal.light;
    case 'accent': return pal.accent;
    case 'visor': return pal.glow || '#9FF3FF';
    case 'ink': return INK;
    case 'line': return 'none';
    default: return pal.main;
  }
}

function drawShapes(shapes, pal, pass) {
  return shapes.map(([tag, a, tone]) => {
    if (pass === 'back') {
      if (['line', 'shine', 'shineline', 'ink'].includes(tone)) return '';
      return `<${tag} ${attrs(a)} fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"/>`;
    }
    if (tone === 'line') return `<${tag} ${attrs(a)} fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    if (tone === 'shine') return `<${tag} ${attrs(a)} fill="#fff" fill-opacity=".38"/>`;
    if (tone === 'shineline') return `<${tag} ${attrs(a)} fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.5" stroke-linecap="round"/>`;
    if (tone === 'ink') return `<${tag} ${attrs(a)} fill="${INK}"/>`;
    if (tone === 'visor') return `<${tag} ${attrs(a)} fill="${pal.glow || '#9FF3FF'}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" class="visor"/>`;
    return `<${tag} ${attrs(a)} fill="${toneFill(tone, pal)}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  }).join('');
}

// Attachment art for mounted cards.
function mountArt(id, x, y, limb, pal) {
  const c = CARDS[id];
  const down = limb === 'armL' || limb === 'armR';
  const s = (inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
  const st = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  if (c.type === 'weapon') {
    if (limb === 'legs') {
      return s(`<rect x="-26" y="-12" width="52" height="16" rx="5" fill="#fff" ${st}/><circle cx="-14" cy="-4" r="4" fill="#FF4F64" ${st}/><circle cx="0" cy="-4" r="4" fill="#FF4F64" ${st}/><circle cx="14" cy="-4" r="4" fill="#FF4F64" ${st}/>`);
    }
    if (limb === 'head') {
      return s(`<rect x="-14" y="-10" width="28" height="12" rx="5" fill="#FFC929" ${st}/><rect x="-4" y="-22" width="8" height="14" rx="3" fill="#fff" ${st}/>`);
    }
    const long = c.dmg >= 5;
    const len = long ? 34 : 22;
    return s(`<rect x="-9" y="-6" width="18" height="16" rx="5" fill="#FFC929" ${st}/><rect x="-5" y="${down ? 8 : -len}" width="10" height="${len}" rx="4" fill="#fff" ${st}/>${c.snipe ? `<path d="M-5 ${8 + len} L0 ${16 + len} L5 ${8 + len} Z" fill="#9FF3FF" ${st}/>` : ''}`);
  }
  if (c.type === 'boost') {
    if (c.punch) return s(`<rect x="-16" y="-12" width="32" height="22" rx="8" fill="#FFC929" ${st}/><path d="M-8 -12 L-8 10 M0 -12 L0 10 M8 -12 L8 10" stroke="${INK}" stroke-width="2.5"/>`);
    if (c.oracle) return s(`<circle r="11" fill="#fff" ${st}/><circle r="6" fill="#B57BFF" ${st}/><circle r="2.2" fill="${INK}"/>`);
    if (c.weaponBonus) return s(`<rect x="-16" y="-8" width="32" height="12" rx="5" fill="#9FF3FF" ${st}/><circle cx="14" cy="-2" r="6" fill="#fff" ${st}/>`);
    if (c.guardGen) return s(`<path d="M-24 4 Q0 -26 24 4 Z" fill="#39E3A6" fill-opacity=".85" ${st}/>`);
    if (c.guardBlock) return s(`<path d="M-12 -16 L12 -16 L12 4 Q0 16 -12 4 Z" fill="#39E3A6" ${st}/>`);
    return s(`<path d="M-22 -2 L-10 -10 L10 -10 L22 -2 L10 4 L-10 4 Z" fill="#FFC929" ${st}/><path d="M-16 4 L-20 12 M16 4 L20 12" stroke="#FF8A3D" stroke-width="4" stroke-linecap="round"/>`);
  }
  return '';
}

function platingArt(limb, body) {
  const [x, y] = { head: [100, 60], armL: [body.mounts.armL[0], 110], armR: [body.mounts.armR[0], 110], legs: [100, 156] }[limb];
  return `<g transform="translate(${x} ${y})"><rect x="-13" y="-9" width="26" height="18" rx="4" fill="#C9D3EA" stroke="${INK}" stroke-width="2.5"/><circle cx="-7" cy="-3" r="1.8" fill="${INK}"/><circle cx="7" cy="-3" r="1.8" fill="${INK}"/><circle cx="-7" cy="4" r="1.8" fill="${INK}"/><circle cx="7" cy="4" r="1.8" fill="${INK}"/></g>`;
}

function crackArt(limb, body) {
  const [x, y] = { head: [100, 58], armL: [body.mounts.armL[0], 104], armR: [body.mounts.armR[0], 104], legs: [86, 152] }[limb];
  return `<path d="M${x - 8} ${y - 8} L${x - 1} ${y - 1} L${x - 5} ${y + 3} L${x + 7} ${y + 10}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Visor glow and torso emblem per Frame.
const GLOW = { brakka: '#FFE45C', longshot: '#7DF9FF', bastion: '#C8FFE9', specter: '#FF8CF2' };
const EMBLEM = {
  brakka: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-8" y="-5" width="16" height="10" rx="3" fill="#fff"/><path d="M-3 -5V2M2 -5V2" stroke="${INK}" stroke-width="1.6"/></g>`,
  longshot: (x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle r="5.5"/><path d="M0 -9V-3M0 3V9M-9 0H-3M3 0H9"/></g>`,
  bastion: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-7 -7H7V0Q7 6 0 8Q-7 6 -7 0Z" fill="#fff"/></g>`,
  specter: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-8 0Q0 -7 8 0Q0 7 -8 0Z" fill="#fff"/><circle r="2.4" fill="${INK}"/></g>`,
};
const EMBLEM_POS = { brakka: [124, 80], longshot: [116, 74], bastion: [128, 82], specter: [100, 70] };
let uidCounter = 0;
const DECOR = ['line', 'shine', 'shineline', 'ink', 'visor'];

// player: a game player object (or null for a clean showcase render)
export function mechSVG(frameId, player = null, opts = {}) {
  const body = BODIES[frameId];
  const f = FRAMES[frameId];
  const uid = `m${++uidCounter}`;
  const pal = { main: f.color, dark: shade(f.color, -0.28), light: shade(f.color, 0.45), accent: f.accent, glow: GLOW[frameId] };
  const order = ['legs', 'torso', 'armL', 'armR', 'head'];
  const limbState = (k) => (player && k !== 'torso' ? player.limbs[k] : null);

  let back = '', front = '', clip = '', details = '';
  for (const k of order) {
    const ls = limbState(k);
    const destroyed = ls && !ls.alive;
    const shapes = body[k];
    if (!destroyed) {
      back += drawShapes(shapes, pal, 'back');
      clip += shapes.filter(([, , t]) => !DECOR.includes(t)).map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');
    }
    const cls = k === 'torso' ? 'part torso' : `part limb ${destroyed ? 'destroyed' : ''}`;
    const drawn = destroyed
      ? shapes.filter(([, , t]) => !DECOR.includes(t)).map(([tag, a]) => `<${tag} ${attrs(a)} fill="#4C5778" fill-opacity=".45" stroke="#fff" stroke-opacity=".75" stroke-width="2.5" stroke-dasharray="5 4" stroke-linejoin="round"/>`).join('')
      : drawShapes(shapes, pal, 'front');
    front += `<g class="${cls}" data-limb="${k}">${drawn}</g>`;

    // Details sit above the cel shading so they stay crisp.
    let d = '';
    if (ls && ls.alive) {
      if (ls.plating) d += platingArt(k, body);
      if (ls.hp <= ls.max / 2) d += crackArt(k, body);
      if (ls.mount) d += mountArt(ls.mount.id, ...body.mounts[k], k, pal);
    }
    if (destroyed) {
      const [x, y] = body.mounts[k];
      const cy = k === 'legs' ? y - 20 : k === 'head' ? y + 18 : 110;
      d += `<g transform="translate(${x} ${cy})"><circle r="9" fill="${INK}"/><path d="M-4 -4L4 4M4 -4L-4 4" stroke="#FF4F64" stroke-width="3" stroke-linecap="round"/></g>`;
    }
    if (k === 'torso') {
      const [ex, ey] = EMBLEM_POS[frameId];
      d += EMBLEM[frameId](ex, ey);
      const [cx, cy, r] = body.core;
      const pct = player ? player.core / 20 : 1;
      const glow = pct >= 0.75 ? '#FFC929' : pct >= 0.4 ? '#FF8A3D' : '#FF4F64';
      const exposed = player && LIMB_KEYS.filter((x) => !player.limbs[x].alive).length >= 2;
      d += `<g class="core-gem ${exposed ? 'exposed' : ''}" data-limb="core">
        ${exposed ? `<circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="none" stroke="#FF4F64" stroke-width="3" stroke-dasharray="4 4" class="core-ring"/>` : ''}
        <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="${INK}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${glow}" class="core-glow"/>
        <circle cx="${cx - r / 3}" cy="${cy - r / 3}" r="${r / 3.2}" fill="#fff" opacity=".85"/></g>`;
    }
    if (d) details += `<g class="part-detail" data-limb="${k === 'torso' ? 'core' : k}">${d}</g>`;
  }

  let drones = '';
  if (player && player.guard > 0) {
    for (let i = 0; i < player.guard; i++) {
      const gx = 22 + i * 22, gy = 22;
      drones += `<g transform="translate(${gx} ${gy})"><g class="drone" style="animation-delay:${i * -0.4}s"><circle r="9" fill="#fff" stroke="#fff" stroke-width="8"/><circle r="9" fill="#39E3A6" stroke="${INK}" stroke-width="3"/><path d="M-4 0 L4 0" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g></g>`;
    }
  }
  return `<svg class="mech-svg" viewBox="0 0 200 200" role="img" aria-label="${f.name}">
    <defs>
      <clipPath id="c${uid}">${clip}</clipPath>
      <linearGradient id="g${uid}" x1="0" x2="1" y1="0" y2="0.25">
        <stop offset="0.6" stop-color="${INK}" stop-opacity="0"/><stop offset="0.6" stop-color="${INK}" stop-opacity=".2"/>
      </linearGradient>
    </defs>
    <ellipse cx="100" cy="193" rx="62" ry="6" fill="#08123F" opacity=".38"/>
    <g class="bob">
      <g class="sticker-back">${back}</g>
      <g class="sticker-front">${front}</g>
      <rect x="0" y="0" width="200" height="200" fill="url(#g${uid})" clip-path="url(#c${uid})" pointer-events="none"/>
      ${details}
    </g>${drones}</svg>`;
}

const LIMB_KEYS = ['head', 'armL', 'armR', 'legs'];

// Where a limb's HP chip sits, as % of the mech box.
export function chipPos(frameId, limb) {
  const b = BODIES[frameId];
  const pos = {
    head: [100, Math.max(8, b.mounts.head[1] - 4)],
    armL: [Math.max(12, b.mounts.armL[0] - 18), 100],
    armR: [Math.min(188, b.mounts.armR[0] + 18), 100],
    legs: [100, 194],
    core: [b.core[0], b.core[1] + b.core[2] + 17],
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
  // Ink outline pass: re-draw with stroke underneath for the sticker look.
  const outlined = inner.replace(/<(rect|circle|path)([^>]*?)\/>/g, (m, tag, a) =>
    /stroke=/.test(a) ? m : `<${tag}${a} stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);
  return `<svg class="icon ${cls}" viewBox="0 0 64 64" aria-hidden="true">${outlined}</svg>`;
}

export function cardIcon(id) {
  return iconSVG(CARD_ICON[id] || 'bolt');
}

export const TYPE_COLORS = {
  weapon: '#FF4F64', boost: '#FFC929', plating: '#8FA3D9', support: '#39E3A6', order: '#B57BFF',
};
export const TYPE_NAMES = { weapon: 'Weapon', boost: 'Upgrade', plating: 'Plating', support: 'Support', order: 'Order' };

// The logo: a chunky die-cut wordmark.
export function logoSVG() {
  return `<svg class="logo" viewBox="0 0 360 150" role="img" aria-label="Mech Wars">
    <g font-family="'Lilita One', 'Arial Black', sans-serif" font-size="74" text-anchor="middle" paint-order="stroke" stroke-linejoin="round">
      <text x="180" y="72" fill="#fff" stroke="#fff" stroke-width="26">MECH</text>
      <text x="180" y="138" fill="#fff" stroke="#fff" stroke-width="26">WARS</text>
      <text x="180" y="72" fill="#FFC929" stroke="${INK}" stroke-width="7">MECH</text>
      <text x="180" y="138" fill="#FF4F64" stroke="${INK}" stroke-width="7">WARS</text>
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

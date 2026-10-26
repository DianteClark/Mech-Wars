// Mech Wars — art. Everything is vector SVG drawn in code: crisp at any size, no pixels.
//
// Style: serious anime mecha (real-robot proportions, armor panels, V-fins, mono-eyes).
// Every mech is a large dark silhouette with small die-cut part stickers placed inside it,
// Block Dungeon style. Items and attachments are the same kind of small sticker.

import { CARDS, FRAMES } from '../engine/data.js';

export const INK = '#15172A';

// Sticker stroke sizes, in each sticker's local units.
const OUT = 1.15;            // ink outline on every shape
const CUT = 3.4;             // white die-cut (stroke width; half shows outside)
const RIM = CUT + 2.2;       // thin dark rim around the die-cut

// ---------------------------------------------------------------- helpers

const P = (d, t = 'arm') => ['path', { d }, t];
const C = (cx, cy, r, t = 'arm') => ['circle', { cx, cy, r }, t];
const R = (x, y, w, h, t = 'arm', rx = 1.2) => ['rect', { x, y, width: w, height: h, rx }, t];
// Polygon from a flat list of numbers.
const poly = (t, ...n) => { let d = `M${n[0]} ${n[1]}`; for (let i = 2; i < n.length; i += 2) d += ` L${n[i]} ${n[i + 1]}`; return P(d + ' Z', t); };
// Mirror a polygon across x = 0.
const mir = (t, ...n) => poly(t, ...n.map((v, i) => (i % 2 === 0 ? -v : v)));
const pair = (t, ...n) => [poly(t, ...n), mir(t, ...n)];
const line = (d) => P(d, 'line');

const DECOR = new Set(['line', 'hi', 'hiline', 'glow']);

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}

function attrs(o) {
  return Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
}

// Shared item palette (steel, gunmetal, beam colors).
const BASE = {
  steel: '#C9CFDB', steelS: '#8C95AA', gun: '#3B4058', gunS: '#272B3D',
  beam: '#7CFFB2', beamP: '#FF7AD9', warn: '#F2C230', red: '#E5484D', mint: '#3DDC97',
  white: '#F1F3F8', glass: '#9FE8FF', orange: '#FF8A3D', ink: INK,
};

function fillOf(t, pal) {
  return pal[t] ?? BASE[t] ?? pal.arm;
}

function bbox(shapes) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const [tag, a, t] of shapes) {
    if (DECOR.has(t)) continue;
    if (tag === 'circle') { add(a.cx - a.r, a.cy - a.r); add(a.cx + a.r, a.cy + a.r); continue; }
    if (tag === 'rect') { add(a.x, a.y); add(a.x + a.width, a.y + a.height); continue; }
    const n = (a.d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) add(n[i], n[i + 1]);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

const solidOf = (shapes) => shapes.filter(([, , t]) => !DECOR.has(t)).map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');

// One die-cut sticker: drop shadow, dark rim, white border, then the art with ink outlines.
function sticker(shapes, pal, extra = '') {
  const outline = solidOf(shapes);
  let art = '';
  for (const [tag, a, t] of shapes) {
    if (t === 'line') art += `<${tag} ${attrs(a)} fill="none" stroke="${INK}" stroke-width=".65" stroke-linecap="round" opacity=".55"/>`;
    else if (t === 'hi') art += `<${tag} ${attrs(a)} fill="#fff" opacity=".38"/>`;
    else if (t === 'hiline') art += `<${tag} ${attrs(a)} fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".6"/>`;
    else if (t === 'glow') art += `<${tag} ${attrs(a)} fill="${fillOf('eye', pal)}" opacity=".35"/>`;
    else art += `<${tag} ${attrs(a)} fill="${fillOf(t, pal)}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"${t === 'eye' ? ' class="eye"' : ''}/>`;
  }
  return `<g class="stk" ${extra}>
    <g transform="translate(0 1.6)" fill="#05040F" stroke="#05040F" stroke-width="${RIM}" stroke-linejoin="round" opacity=".55">${outline}</g>
    <g fill="${INK}" stroke="${INK}" stroke-width="${RIM}" stroke-linejoin="round">${outline}</g>
    <g fill="#fff" stroke="#fff" stroke-width="${CUT}" stroke-linejoin="round">${outline}</g>
    ${art}</g>`;
}

// ---------------------------------------------------------------- Frame palettes

const PAL = {
  // Brawler: crimson heavy armor, off-white trim, gold horns.
  brakka: { arm: '#D2463A', armS: '#9C3229', sec: '#E7E1D5', secS: '#B9B1A2', trim: '#E4B23C', frm: '#3B4058', frmS: '#272B3D', eye: '#FFE45C' },
  // Gunner: classic white armor with blue and yellow.
  longshot: { arm: '#E7EAF1', armS: '#B3BBCC', sec: '#3D6ED6', secS: '#2B52A6', trim: '#F0C238', frm: '#3B4058', frmS: '#272B3D', eye: '#7CFFB2' },
  // Tank: olive drab, sand panels, orange hazard trim, red mono-eye.
  bastion: { arm: '#6E875A', armS: '#526644', sec: '#CDBE8F', secS: '#A49668', trim: '#E39A2E', frm: '#3B4058', frmS: '#272B3D', eye: '#FF4F64' },
  // Trickster: dark violet stealth armor, purple panels, magenta blades.
  specter: { arm: '#433C68', armS: '#2E294A', sec: '#9B7BFF', secS: '#7457D6', trim: '#FF5C9A', frm: '#23253A', frmS: '#171827', eye: '#FF8CF2' },
};

// ---------------------------------------------------------------- part drawings
// Each part is drawn in its own local space, centered on (0, 0).

const HEADS = {
  // V-fin with twin eyes and a vented faceplate.
  brakka: () => [
    poly('trim', 0, -7, -15, -19, -12.5, -20, 0, -11, 12.5, -20, 15, -19),
    poly('arm', -9, -11, 9, -11, 11, -4, 10, 6, 6, 10, -6, 10, -10, 6, -11, -4),
    poly('armS', 2, -11, 9, -11, 11, -4, 10, 6, 6, 10, 2, 10),
    poly('sec', -3, -11, 3, -11, 2.2, -5.5, -2.2, -5.5),
    poly('red', -1.4, -10, 1.4, -10, 1.1, -7.5, -1.1, -7.5),
    poly('frm', -7.5, -3.5, 7.5, -3.5, 6.5, 2.5, -6.5, 2.5),
    ...pair('eye', -6.5, -2.5, -1.8, -1.5, -2.2, 1.2, -6, 0.8),
    poly('sec', -4.2, 3.8, 4.2, 3.8, 3.2, 9.2, -3.2, 9.2),
    line('M-1.6 5 L-1.6 8.2 M0 5 L0 8.2 M1.6 5 L1.6 8.2'),
    poly('hi', -8, -10, -1, -10, -2, -7, -8.5, -6.5),
  ],
  // Sniper goggle visor with a long side antenna.
  longshot: () => [
    poly('trim', 5.5, -9, 13, -21, 14.5, -20.2, 8, -8),
    poly('arm', -8, -11.5, 8, -11.5, 10, -4.5, 9, 7, 5, 10, -5, 10, -9, 7, -10, -4.5),
    poly('armS', 2, -11.5, 8, -11.5, 10, -4.5, 9, 7, 5, 10, 2, 10),
    poly('sec', -2.2, -11.5, 2.2, -11.5, 1.6, -5.5, -1.6, -5.5),
    poly('frm', -9.5, -3.5, 9.5, -3.5, 8.6, 2.8, -8.6, 2.8),
    poly('eye', -7.5, -2.2, 7.5, -2.2, 7, 1.6, -7, 1.6),
    poly('hi', -6.5, -1.8, -1, -1.8, -1.5, -0.2, -6.5, -0.2),
    C(-10.5, -0.5, 2.4, 'sec'),
    poly('sec', -4, 4.2, 4, 4.2, 3, 9.2, -3, 9.2),
    line('M-1.4 5.4 L-1.4 8.2 M1.4 5.4 L1.4 8.2'),
    poly('hi', -7, -10.8, -1, -10.8, -2, -7.5, -7.6, -7),
  ],
  // Heavy dome helmet with a mono-eye rail.
  bastion: () => [
    P('M-11.5 -5 Q-11.5 -13.5 0 -14.5 Q11.5 -13.5 11.5 -5 L12.5 4.5 L8 9.5 L-8 9.5 L-12.5 4.5 Z', 'arm'),
    P('M2 -14.3 Q11.5 -13.5 11.5 -5 L12.5 4.5 L8 9.5 L2 9.5 Z', 'armS'),
    poly('sec', -1.8, -14.4, 1.8, -14.4, 1.3, -8, -1.3, -8),
    poly('frm', -10.5, -4.5, 10.5, -4.5, 10.5, 1, -10.5, 1),
    C(3.5, -1.8, 4.6, 'glow'), C(3.5, -1.8, 2.6, 'eye'),
    poly('sec', -8, 3, 8, 3, 6, 9.5, -6, 9.5),
    line('M-4 4.4 L-4 8.6 M-1.3 4.4 L-1.3 8.6 M1.3 4.4 L1.3 8.6 M4 4.4 L4 8.6'),
    P('M-9 -9 Q-5 -12.6 0 -13', 'hiline'),
  ],
  // Sleek crested head with side fins and narrow eyes.
  specter: () => [
    poly('trim', -1.2, -10, -1.8, -24, 1.4, -24, 1.6, -10),
    ...pair('sec', -8.5, -6, -16, -11, -15.2, -6.4, -8.8, -2),
    poly('arm', 0, -12.5, 9, -6, 8, 4, 4, 9.5, -4, 9.5, -8, 4, -9, -6),
    poly('armS', 0, -12.5, 9, -6, 8, 4, 4, 9.5, 0, 9.5),
    poly('frm', -7.2, -2.4, 7.2, -2.4, 5.2, 2.2, -5.2, 2.2),
    ...pair('eye', -6.2, -1.5, -1.2, -1, -1.6, 1, -4.8, 1.2),
    poly('sec', -2.8, 5, 2.8, 5, 2, 9.5, -2, 9.5),
    poly('hi', -1, -11, -7.5, -6, -6.5, -4, -1, -8),
  ],
};

// Torsos: chest armor, collar, vents and the Core housing (Core sits at 0, -4).
const TORSOS = {
  brakka: () => [
    poly('frm', -7, -21, 7, -21, 8, -15.5, -8, -15.5),
    poly('arm', -23, -16, 23, -16, 25, -4, 18, 9, -18, 9, -25, -4),
    poly('armS', 4, -16, 23, -16, 25, -4, 18, 9, 4, 9),
    poly('sec', -7, -16, 7, -16, 6, 7, -6, 7),
    ...pair('trim', -20, -11.5, -10, -11.5, -10, -3.5, -19, -1.5),
    line('M-18 -9 L-11.5 -9 M-18 -6.5 L-11.5 -6.5 M11.5 -9 L18 -9 M11.5 -6.5 L18 -6.5'),
    poly('frm', -13, 9, 13, 9, 11, 17, -11, 17),
    line('M-6 10.5 L-6 15.5 M0 10.5 L0 15.5 M6 10.5 L6 15.5'),
    poly('sec', -16, 17, 16, 17, 13.5, 22.5, -13.5, 22.5),
    poly('hi', -22, -15, -8, -15, -9, -12, -22.5, -9),
  ],
  longshot: () => [
    poly('frm', -6, -21, 6, -21, 7, -15.5, -7, -15.5),
    poly('sec', -19, -16, 19, -16, 20.5, -5, 14, 7, -14, 7, -20.5, -5),
    poly('secS', 4, -16, 19, -16, 20.5, -5, 14, 7, 4, 7),
    poly('arm', -6, -16, 6, -16, 5, 6, -5, 6),
    ...pair('trim', -17, -12, -9, -12, -9, -5, -16, -3.5),
    line('M-15.5 -9.5 L-10.5 -9.5 M-15.5 -7 L-10.5 -7 M10.5 -9.5 L15.5 -9.5 M10.5 -7 L15.5 -7'),
    poly('frm', -11, 7, 11, 7, 9.5, 15, -9.5, 15),
    line('M-4.5 8.5 L-4.5 13.5 M0 8.5 L0 13.5 M4.5 8.5 L4.5 13.5'),
    poly('arm', -13.5, 15, 13.5, 15, 11.5, 21, -11.5, 21),
    poly('red', -2.2, 15.6, 2.2, 15.6, 1.8, 20, -1.8, 20),
    poly('hi', -18, -15, -7, -15, -8, -12, -19, -9),
  ],
  bastion: () => [
    poly('frm', -8, -21, 8, -21, 9, -15.5, -9, -15.5),
    poly('arm', -25, -16, 25, -16, 26, 4, 20, 11, -20, 11, -26, 4),
    poly('armS', 4, -16, 25, -16, 26, 4, 20, 11, 4, 11),
    ...pair('sec', -23, -13, -9, -13, -9, 2, -22, 2),
    line('M-21 -9 L-11 -9 M-21 -5 L-11 -5 M-21 -1 L-11 -1 M11 -9 L21 -9 M11 -5 L21 -5 M11 -1 L21 -1'),
    poly('frm', -7.5, -15, 7.5, -15, 7, 9, -7, 9),
    ...pair('trim', -24, 5, -18, 5, -18, 9, -22.5, 9),
    poly('frm', -14, 11, 14, 11, 12, 18, -12, 18),
    poly('sec', -17, 18, 17, 18, 14.5, 23, -14.5, 23),
    poly('hi', -24, -15, -10, -15, -10, -12.5, -24.5, -11),
  ],
  specter: () => [
    poly('frm', -5.5, -21, 5.5, -21, 6.5, -15.5, -6.5, -15.5),
    poly('arm', 0, -17, 20, -12, 15, 3, 6, 11, -6, 11, -15, 3, -20, -12),
    poly('armS', 0, -17, 20, -12, 15, 3, 6, 11, 0, 11),
    ...pair('sec', -18, -10.5, -7, -9, -8, -1, -14, 1),
    ...pair('trim', -6, -15, -2, -15.6, -3, 6, -4.6, 6),
    poly('frm', -9, 11, 9, 11, 7, 17, -7, 17),
    poly('sec', -10.5, 17, 10.5, 17, 6, 23, -6, 23),
    poly('hi', -1, -16, -18, -11.5, -16.5, -8.5, -1, -12),
  ],
};

// Left arms (right arms are mirrored): shoulder pauldron, upper arm, elbow, forearm, hand.
const ARMS = {
  brakka: () => [
    poly('arm', -14, -24, 10, -24, 14, -15, 11, -8, -11, -8, -15, -15),
    poly('armS', 0, -24, 10, -24, 14, -15, 11, -8, 0, -8),
    poly('sec', -13, -15.5, 13, -15.5, 12, -12, -13.5, -12),
    poly('frm', -5, -8, 5, -8, 4.5, 1, -4.5, 1),
    C(0, 2.5, 3.6, 'frmS'),
    poly('arm', -9, 4, 9, 4, 10.5, 17, -10.5, 17),
    poly('armS', 1.5, 4, 9, 4, 10.5, 17, 1.5, 17),
    poly('trim', -9.6, 9, 9.6, 9, 10, 11.5, -10, 11.5),
    poly('frm', -7, 17, 7, 17, 8, 25, -8, 25),
    line('M-3.5 19 L-3.5 23.5 M0 19 L0 23.5 M3.5 19 L3.5 23.5'),
    poly('hi', -13, -23, -1, -23, -2, -19, -14, -17),
  ],
  longshot: () => [
    poly('arm', -10.5, -24, 8, -24, 11, -16, 9, -9, -9, -9, -11.5, -16),
    poly('armS', 0, -24, 8, -24, 11, -16, 9, -9, 0, -9),
    poly('sec', -10.5, -16.5, 11, -16.5, 10.2, -13, -10.8, -13),
    poly('frm', -4, -9, 4, -9, 3.6, 1, -3.6, 1),
    C(0, 2.5, 3, 'frmS'),
    poly('arm', -6.5, 4.5, 6.5, 4.5, 7.5, 17, -7.5, 17),
    poly('armS', 1, 4.5, 6.5, 4.5, 7.5, 17, 1, 17),
    poly('sec', -7, 13, 7, 13, 7.4, 16, -7.4, 16),
    poly('frm', -5.5, 17, 5.5, 17, 6, 24, -6, 24),
    line('M-2 18.5 L-2 22.5 M1.4 18.5 L1.4 22.5'),
    poly('hi', -9.5, -23, -1, -23, -2, -19.5, -10.5, -18),
  ],
  bastion: () => [
    poly('arm', -16, -25, 12, -25, 15, -12, 11, -6, -13, -6, -17, -12),
    poly('armS', 0, -25, 12, -25, 15, -12, 11, -6, 0, -6),
    ...[-12, -4, 4].map((x) => R(x, -21, 5, 3, 'sec', 0.8)),
    poly('trim', -16.5, -10, 15, -10, 14, -7.5, -15.5, -7.5),
    poly('frm', -5.5, -6, 5.5, -6, 5, 2, -5, 2),
    C(0, 3.5, 3.8, 'frmS'),
    poly('arm', -9.5, 5, 9.5, 5, 10.5, 18, -10.5, 18),
    poly('armS', 1.5, 5, 9.5, 5, 10.5, 18, 1.5, 18),
    line('M-8 11 L8 11'),
    poly('frm', -7.5, 18, 7.5, 18, 8.5, 25.5, -8.5, 25.5),
    poly('hi', -15, -24, -1, -24, -2, -19, -16, -16),
  ],
  specter: () => [
    poly('arm', -10, -23, 7, -24, 12, -17, 9, -10, -8, -10, -12, -16),
    poly('armS', 0, -23.6, 7, -24, 12, -17, 9, -10, 0, -10),
    poly('sec', -13, -19, -19, -25, -17, -19, -12, -14),
    poly('frm', -3.6, -10, 3.6, -10, 3.2, 1, -3.2, 1),
    C(0, 2.5, 2.8, 'frmS'),
    poly('arm', -6, 4.5, 6, 4.5, 6, 17, -6, 17),
    poly('armS', 1, 4.5, 6, 4.5, 6, 17, 1, 17),
    poly('trim', -6, 6, -11, 26, -8.5, 26, -3.5, 12),
    poly('frm', -5, 17, 5, 17, 5.5, 23.5, -5.5, 23.5),
    poly('hi', -9, -22.5, -1, -23, -2, -19.5, -10, -18),
  ],
};

// Legs: hip, thighs, knees, shins and feet as a single sticker.
function legPair({ w = 7, foot = 10, knee = 'arm', thighW = 5.5, stance = 9.5 }) {
  const leg = (s) => {
    const X = (v) => s * stance + s * v;
    return [
      poly('frm', X(-thighW), -20, X(thighW), -20, X(thighW - 0.8), -7, X(-thighW + 0.8), -7),
      poly(knee, X(-w - 0.5), -8, X(w + 0.5), -8, X(w - 0.5), -1, X(-w + 0.5), -1),
      poly('arm', X(-w), -1, X(w), -1, X(w + 1), 16, X(-w - 1), 16),
      poly('armS', X(1), -1, X(w), -1, X(w + 1), 16, X(1), 16),
      poly('sec', X(-w + 0.5), 6, X(w - 0.5), 6, X(w - 0.2), 9, X(-w + 0.2), 9),
      poly('frmS', X(-w - 1.5), 16, X(w + 0.5), 16, X(foot), 23, X(-foot + 1), 23),
      poly('hi', X(-w + 0.5), 0, X(-1), 0, X(-1.4), 5, X(-w), 5),
    ];
  };
  return [poly('frm', -9, -25, 9, -25, 10, -19, -10, -19), ...leg(-1), ...leg(1)];
}
const LEGS = {
  brakka: () => legPair({ w: 8, foot: 11.5, knee: 'sec', thighW: 6, stance: 10.5 }),
  longshot: () => legPair({ w: 6.5, foot: 9.5, knee: 'sec', thighW: 5, stance: 8.5 }),
  bastion: () => legPair({ w: 8.5, foot: 12.5, knee: 'trim', thighW: 6.5, stance: 11 }),
  specter: () => legPair({ w: 5.5, foot: 8.5, knee: 'sec', thighW: 4.5, stance: 7.5 }),
};

// Where each part sits in the 200x200 mech box: [x, y, silhouette scale, sticker size within the slot].
const LAYOUT = {
  brakka: { head: [100, 32, 1.25, 0.9], torso: [100, 76, 1.75, 0.6], armL: [44, 84, 1.7, 0.62], legs: [100, 148, 1.75, 0.58] },
  longshot: { head: [100, 30, 1.2, 0.9], torso: [100, 74, 1.75, 0.62], armL: [50, 82, 1.7, 0.64], legs: [100, 148, 1.85, 0.58] },
  bastion: { head: [100, 34, 1.2, 0.9], torso: [100, 78, 1.75, 0.58], armL: [40, 84, 1.7, 0.62], legs: [100, 150, 1.7, 0.58] },
  specter: { head: [100, 30, 1.2, 0.9], torso: [100, 74, 1.8, 0.6], armL: [50, 80, 1.75, 0.62], legs: [100, 148, 1.9, 0.58] },
};

function partShapes(frame, k) {
  if (k === 'head') return HEADS[frame]();
  if (k === 'torso') return TORSOS[frame]();
  if (k === 'legs') return LEGS[frame]();
  return ARMS[frame]();
}

function slotOf(frame, k) {
  const L = LAYOUT[frame];
  if (k === 'armR') { const [x, y, s, kk] = L.armL; return [200 - x, y, s, kk, -1]; }
  const [x, y, s, kk] = L[k];
  return [x, y, s, kk, 1];
}

// ---------------------------------------------------------------- items & attachments
// Items are drawn in a local box roughly -16..16. Weapons point down (held along the forearm).

const ITEMS = {
  pulse_rifle: () => [
    poly('gun', -3, -15, 3, -15, 3.5, -4, -3.5, -4),
    poly('steel', -5, -6, 5, -6, 5, 6, -5, 6),
    poly('steelS', 1.5, -6, 5, -6, 5, 6, 1.5, 6),
    R(-7.5, -3, 3, 6, 'gun', 0.6),
    poly('gun', -2, 6, 2, 6, 2, 17, -2, 17),
    R(-2.8, 15, 5.6, 3, 'warn', 0.6),
    poly('sec', 5, -2, 9, -1, 9, 3, 5, 3),
    line('M-3 -1 L3 -1 M-3 2 L3 2'),
  ],
  twin_autocannon: () => [
    poly('gun', -7, -14, 7, -14, 7, -3, -7, -3),
    C(0, -8.5, 4.2, 'steel'), C(0, -8.5, 1.6, 'gunS'),
    poly('steel', -7.5, -3, 7.5, -3, 7, 5, -7, 5),
    poly('steelS', 1, -3, 7.5, -3, 7, 5, 1, 5),
    poly('gun', -5.5, 5, -2, 5, -2, 18, -5.5, 18),
    poly('gun', 2, 5, 5.5, 5, 5.5, 18, 2, 18),
    R(-6, 16, 4.5, 2.6, 'warn', 0.5), R(1.5, 16, 4.5, 2.6, 'warn', 0.5),
  ],
  rail_lance: () => [
    poly('gun', -4, -18, 4, -18, 4.5, -8, -4.5, -8),
    poly('sec', -5.5, -9, 5.5, -9, 5.5, -3, -5.5, -3),
    poly('steel', -3, -3, 3, -3, 2.4, 20, -2.4, 20),
    poly('steelS', 0.6, -3, 3, -3, 2.4, 20, 0.6, 20),
    ...[1, 6, 11].map((y) => R(-4.2, y, 8.4, 2.4, 'gun', 0.6)),
    poly('beam', -1.4, 20, 1.4, 20, 0, 24),
    line('M-2 -14 L2 -14'),
  ],
  sniper_pistol: () => [
    poly('gun', -4.5, -12, 4.5, -12, 4.5, -2, -4.5, -2),
    poly('gun', 1, -2, 5, -2, 6, 5, 2, 5),
    poly('steel', -2, -2, 1.5, -2, 1.5, 15, -2, 15),
    poly('steelS', -9, -11, -4.5, -11, -4.5, -7, -9, -7),
    C(-6.5, -9, 2.6, 'glass'),
    line('M-3 -8 L3 -8'),
  ],
  missile_pod: () => [
    poly('steel', -13, -9, 13, -9, 12, 9, -12, 9),
    poly('steelS', 4, -9, 13, -9, 12, 9, 4, 9),
    ...[-8, 0, 8].flatMap((x) => [C(x, -3.5, 2.8, 'gunS'), C(x, -3.5, 1.5, 'red'), C(x, 4, 2.8, 'gunS'), C(x, 4, 1.5, 'red')]),
    poly('warn', -13, -9, -7, -9, -9, -6, -13, -6),
  ],
  headbutt_crest: () => [
    poly('trim', 0, -4, -13, -15, -10.5, -16, 0, -8, 10.5, -16, 13, -15),
    poly('steel', -6, -5, 6, -5, 4.5, 6, -4.5, 6),
    poly('red', -2, -3, 2, -3, 1.4, 3, -1.4, 3),
  ],
  emp_spike: () => [
    poly('gun', -4, 2, 4, 2, 5, 9, -5, 9),
    poly('steel', -1.6, -13, 1.6, -13, 2.2, 2, -2.2, 2),
    C(0, -14, 3.4, 'glass'),
    P('M-7 -14 Q0 -21 7 -14', 'hiline'),
  ],
  ghost_blade: () => [
    poly('gun', -3, -16, 3, -16, 3, -6, -3, -6),
    R(-4.5, -7.5, 9, 3, 'trim', 0.6),
    poly('beamP', -2, -4.5, 2, -4.5, 1.2, 20, -1.2, 20),
    P('M-0.4 -3 L-0.2 17', 'hiline'),
  ],
  shield_bash: () => [
    ...[-7, 0, 7].map((x) => poly('steel', x - 1.6, -13, x + 1.6, -13, x, -19)),
    poly('sec', -10, -14, 10, -14, 11, 2, 0, 12, -11, 2),
    poly('secS', 1, -14, 10, -14, 11, 2, 1, 11),
    poly('steel', -4, -9, 4, -9, 3, 4, -3, 4),
  ],
  tower_shield: () => [
    poly('sec', -11, -18, 11, -18, 12, 6, 0, 18, -12, 6),
    poly('secS', 1, -18, 11, -18, 12, 6, 1, 17),
    poly('trim', -2, -14, 2, -14, 2, 10, -2, 10),
    poly('trim', -8, -4, 8, -4, 8, -0.5, -8, -0.5),
    poly('hi', -10, -17, -2, -17, -2.5, -13, -10.5, -12),
  ],
  aegis_dome: () => [
    P('M-13 2 Q-13 -13 0 -14 Q13 -13 13 2 Z', 'glass'),
    P('M-9 -6 Q-4 -11 2 -11', 'hiline'),
    poly('steel', -15, 2, 15, 2, 13, 8, -13, 8),
    poly('steelS', 2, 2, 15, 2, 13, 8, 2, 8),
    C(0, 5, 1.6, 'mint'),
  ],
  wrecking_fists: () => [
    ...[-6, 0, 6].map((x) => poly('steel', x - 2, 11, x + 2, 11, x, 18)),
    poly('arm', -9, -12, 9, -12, 11, 4, -11, 4),
    poly('armS', 1, -12, 9, -12, 11, 4, 1, 4),
    poly('frm', -10, 4, 10, 4, 9, 12, -9, 12),
    line('M-5 -9 L-5 1 M0 -9 L0 1 M5 -9 L5 1'),
  ],
  hydraulic_fist: () => [
    R(-12, -8, 3, 9, 'warn', 0.6), R(9, -8, 3, 9, 'warn', 0.6),
    poly('steel', -9, -11, 9, -11, 10, 3, -10, 3),
    poly('steelS', 1, -11, 9, -11, 10, 3, 1, 3),
    poly('gun', -8, 3, 8, 3, 7, 11, -7, 11),
    line('M-4 4.5 L-4 9.5 M0 4.5 L0 9.5 M4 4.5 L4 9.5'),
  ],
  piston_boots: () => [
    poly('orange', -9, 11, -3, 11, -6, 17),
    poly('orange', 1, 11, 7, 11, 4, 17),
    poly('steel', -9, -10, 6, -10, 7, 6, -10, 6),
    poly('steelS', 0, -10, 6, -10, 7, 6, 0, 6),
    poly('gun', -12, 6, 9, 6, 12, 12, -12, 12),
    R(-7, -6, 10, 2.5, 'warn', 0.5),
  ],
  phase_treads: () => [
    poly('sec', -2, -14, 12, -8, 9, -4, -2, -7),
    poly('sec', -2, -4, 12, 2, 9, 6, -2, 3),
    poly('beamP', -7, 11, -1, 11, -4, 17),
    poly('gun', -8, -12, 0, -12, 0, 12, -8, 12),
  ],
  scope_visor: () => [
    poly('gun', -13, -4, 13, -4, 11, 5, -11, 5),
    poly('glass', -11, -2.5, 11, -2.5, 9.5, 3.5, -9.5, 3.5),
    poly('hi', -9.5, -2, -1, -2, -1.5, 0, -9.5, 0),
    C(13, -6, 3, 'sec'), C(13, -6, 1.2, 'red'),
  ],
  oracle_eye: () => [
    poly('steel', -3, -12, 3, -12, 2, -8, -2, -8),
    poly('gun', -12, 0, 0, -9, 12, 0, 0, 9),
    C(0, 0, 5.5, 'sec'), C(0, 0, 3, 'beamP'), C(0, 0, 1.2, 'ink'),
  ],
  scrap_plating: () => [
    poly('steel', -12, -9, 12, -10, 11, 9, -11, 10),
    poly('steelS', 2, -9.6, 12, -10, 11, 9, 2, 9.6),
    ...[[-8, -6], [8, -6.5], [-7.5, 6.5], [7.5, 6]].map(([x, y]) => C(x, y, 1.2, 'gun')),
    line('M-9 0 L9 -0.5'),
  ],
  reinforced_plating: () => [
    poly('steel', -12, -11, 12, -11, 12, 11, -12, 11),
    poly('steelS', 2, -11, 12, -11, 12, 11, 2, 11),
    poly('warn', -12, -11, -4, -11, -12, -3),
    poly('warn', 4, 11, 12, 11, 12, 3),
    ...[[-8, 7], [8, -7]].map(([x, y]) => C(x, y, 1.3, 'gun')),
    poly('gun', -3, -3, 3, -3, 3, 3, -3, 3),
  ],
  repair_pod: () => [
    P('M-9 -4 Q-9 -12 0 -12 Q9 -12 9 -4 L9 6 Q9 12 0 12 Q-9 12 -9 6 Z', 'white'),
    P('M1 -12 Q9 -12 9 -4 L9 6 Q9 12 1 12 Z', 'steel'),
    poly('mint', -2, -7, 2, -7, 2, -2, 7, -2, 7, 2, 2, 2, 2, 7, -2, 7, -2, 2, -7, 2, -7, -2, -2, -2),
  ],
  rebuild_kit: () => [
    poly('gun', -4, -11, 4, -11, 4, -6, -4, -6),
    poly('warn', -12, -6, 12, -6, 12, 11, -12, 11),
    poly('orange', 3, -6, 12, -6, 12, 11, 3, 11),
    poly('gun', -12, -6, 12, -6, 12, -2, -12, -2),
    C(0, 4.5, 4, 'gun'), C(0, 4.5, 1.6, 'steel'),
  ],
  core_patch: () => [
    poly('gun', -6, -13, 6, -13, 6, -9, -6, -9),
    poly('glass', -7, -9, 7, -9, 7, 9, -7, 9),
    C(0, 0, 4.5, 'warn'), C(-1.4, -1.4, 1.4, 'white'),
    poly('gun', -6, 9, 6, 9, 6, 13, -6, 13),
  ],
  drone_escort: () => [
    R(-15, -7, 8, 2.4, 'gun', 1), R(7, -7, 8, 2.4, 'gun', 1),
    poly('gun', -8, -5, -6, -5, -6, -2, -8, -2), poly('gun', 6, -5, 8, -5, 8, -2, 6, -2),
    poly('gun', -3, 3, 3, 3, 2, 8, -2, 8),
    poly('steel', -6, -4, 6, -4, 8, 3, -8, 3),
    poly('steelS', 1, -4, 6, -4, 8, 3, 1, 3),
    C(0, 0, 2.2, 'mint'),
  ],
  energy_cell: () => [
    poly('gun', -3.5, -14, 3.5, -14, 3.5, -11, -3.5, -11),
    poly('steel', -7, -11, 7, -11, 7, 13, -7, 13),
    poly('steelS', 2, -11, 7, -11, 7, 13, 2, 13),
    poly('warn', 1.5, -7, -4, 2, -0.5, 2, -2, 9, 4, -0.5, 0.5, -0.5),
  ],
  rush_order: () => [
    poly('gun', -2, -13, 2, -13, 2, -10, -2, -10),
    poly('warn', 8, -12, 14, -8, 11, -5),
    C(0, 1, 11, 'white'), C(0, 1, 8, 'steel'),
    P('M0 1 L0 -5 M0 1 L4.5 3.5', 'line'),
  ],
  scavenge: () => [
    poly('steelS', -12, 2, 4, -6, 12, 2, -4, 10),
    poly('gun', -10, -2, -2, -10, 4, -6, -4, 2),
    C(6, -6, 4.5, 'warn'), C(6, -6, 1.6, 'gun'),
    poly('steel', -6, 4, 2, 0, 6, 4, -2, 8),
  ],
  adrenal_surge: () => [
    poly('red', -8, -6, 0, -14, 8, -6, 4, -6, 4, 2, -4, 2, -4, -6),
    poly('orange', -8, 4, 0, -4, 8, 4, 4, 4, 4, 12, -4, 12, -4, 4),
  ],
  brace: () => [
    poly('mint', -10, -12, 10, -12, 10, 2, 0, 12, -10, 2),
    poly('gun', -5, -6, 5, -6, 5, -2, -5, -2),
    poly('gun', -2, -9, 2, -9, 2, 1, -2, 1),
  ],
  sabotage: () => [
    poly('warn', -10, 7, -4, 7, -7, 13), poly('warn', 4, 7, 10, 7, 7, 13),
    poly('gun', -10, -8, 10, -8, 10, 8, -10, 8),
    C(0, 0, 4.5, 'red'),
    P('M-3 -3 L3 3 M3 -3 L-3 3', 'line'),
  ],
};

// UI-only icons (tool buttons).
const UI_ICONS = { surge: ITEMS.adrenal_surge, clock: ITEMS.rush_order };

function itemPalette(id) {
  const c = id && CARDS[id];
  return c && c.frame ? PAL[c.frame] : PAL.longshot;
}

function fitted(shapes, pad = 6) {
  const b = bbox(shapes);
  const size = Math.max(b.w, b.h) + pad * 2;
  return `${(b.cx - size / 2).toFixed(1)} ${(b.cy - size / 2).toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`;
}

// A card as a compact sticker.
export function cardSticker(id) {
  const shapes = (ITEMS[id] || ITEMS.scavenge)();
  return `<svg class="icon item" viewBox="${fitted(shapes)}" aria-hidden="true">${sticker(shapes, itemPalette(id))}</svg>`;
}
export const cardIcon = cardSticker;
export const upgradeSticker = cardSticker;

export function iconSVG(name, cls = '') {
  const shapes = (UI_ICONS[name] || ITEMS.scavenge)();
  return `<svg class="icon ${cls}" viewBox="${fitted(shapes, 5)}" aria-hidden="true">${sticker(shapes, PAL.longshot)}</svg>`;
}

// Where an attachment sticker goes on a limb, in the 200-box.
function attachPoint(frame, k) {
  const [x, y, , , dir] = slotOf(frame, k);
  if (k === 'head') return [x + 20 * dir, y - 4, 0.8];
  if (k === 'legs') return [x, y + 4, 0.95];
  return [x + 4 * dir, y + 30, 0.95];
}
function platePoint(frame, k) {
  const [x, y, , , dir] = slotOf(frame, k);
  if (k === 'head') return [x - 16 * dir, y + 6, 0.55];
  if (k === 'legs') return [x - 24, y - 16, 0.7];
  return [x - 10 * dir, y - 22, 0.7];
}

function itemAt(id, x, y, s, extra = '', flipX = false) {
  const shapes = (ITEMS[id] || ITEMS.scavenge)();
  return `<g transform="translate(${x} ${y}) scale(${flipX ? -s : s} ${s})" ${extra}>${sticker(shapes, itemPalette(id))}</g>`;
}

function countdownBadge(x, y, n) {
  return `<g class="cd-badge" transform="translate(${x} ${y})"><circle r="10.5" fill="${INK}"/><circle r="8.6" fill="#fff"/>
    <circle r="6.9" fill="#F2C230" stroke="${INK}" stroke-width="1.2"/><text y="3.6" text-anchor="middle" font-family="Oxanium, sans-serif" font-weight="800" font-size="10" fill="${INK}">${n}</text></g>`;
}

// ---------------------------------------------------------------- the mech

// player: a game player object (or null for a showcase render)
// opts.slap = limb whose newest upgrade just landed; opts.peel = limb just destroyed
// opts.pending = this player's Workshop builds aimed at limbs (ghost sticker + countdown)
export function mechSVG(frameId, player = null, opts = {}) {
  const pal = PAL[frameId];
  const f = FRAMES[frameId];
  const order = ['legs', 'armL', 'armR', 'torso', 'head'];
  const pending = opts.pending || [];
  let sil = '', parts = '', attach = '';
  const rim = mix(pal.sec, '#2B2858', 0.72);

  for (const k of order) {
    const shapes = partShapes(frameId, k);
    const [x, y, s, kk, dir] = slotOf(frameId, k);
    const ls = player && k !== 'torso' ? player.limbs[k] : null;
    const destroyed = ls && !ls.alive;
    const loose = ls && ls.alive && ls.hp <= ls.max / 2;
    const place = `translate(${x} ${y}) scale(${s * dir} ${s})`;
    const solid = solidOf(shapes);

    // The silhouette slot doubles as the tap / drop target for this part.
    const cls = k === 'torso' ? 'part torso' : `part limb ${destroyed ? 'destroyed' : ''} ${loose ? 'loose' : ''}`;
    sil += `<g class="${cls}" data-limb="${k}">
      <g transform="${place}" class="slot-shape ${destroyed ? 'empty' : ''}">
        <g fill="${rim}" stroke="${rim}" stroke-width="${(5 / s).toFixed(2)}" stroke-linejoin="round">${solid}</g>
        <g fill="#1B1938" stroke="#1B1938" stroke-width="${(1.4 / s).toFixed(2)}" stroke-linejoin="round">${solid}</g>
        ${destroyed ? `<g fill="none" stroke="#E5484D" stroke-opacity=".55" stroke-width="${(1.2 / s).toFixed(2)}" stroke-dasharray="${(3 / s).toFixed(2)} ${(3 / s).toFixed(2)}">${solid}</g>` : ''}
      </g>`;

    if (destroyed) {
      sil += `<g transform="translate(${x} ${y})"><circle r="6.5" fill="${INK}" stroke="#E5484D" stroke-width="1.4"/><path d="M-2.6 -2.6L2.6 2.6M2.6 -2.6L-2.6 2.6" stroke="#E5484D" stroke-width="1.8" stroke-linecap="round"/></g>`;
      for (const w of pending.filter((p) => p.target === k)) sil += countdownBadge(x + 12, y - 10, w.timer);
      sil += '</g>';
      if (opts.peel === k) parts += `<g class="peel" style="transform-origin:${x}px ${y}px"><g transform="translate(${x} ${y}) scale(${s * kk * dir} ${s * kk})">${sticker(shapes, pal)}</g></g>`;
      continue;
    }
    sil += '</g>';

    // The part sticker, small inside its slot.
    const tilt = loose ? ({ armL: -7, armR: 7, head: 6, legs: -3 }[k]) : 0;
    let inner = sticker(shapes, pal);
    if (loose) inner += `<g stroke="${INK}" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".75"><path d="M-4 -6 L0 -1 L-2 2 L3 7"/><path d="M3 -7 L5 -4"/></g>`;
    if (k === 'torso') {
      const pct = player ? player.core / 20 : 1;
      const glow = pct >= 0.75 ? '#F2C230' : pct >= 0.4 ? '#FF8A3D' : '#E5484D';
      const exposed = player && ['head', 'armL', 'armR', 'legs'].filter((q) => !player.limbs[q].alive).length >= 2;
      inner += `<g class="core-gem ${exposed ? 'exposed' : ''}" data-limb="core">
        ${exposed ? '<circle cx="0" cy="-4" r="9.5" fill="none" stroke="#E5484D" stroke-width="1.4" stroke-dasharray="2.5 2.5" class="core-ring"/>' : ''}
        <circle cx="0" cy="-4" r="5.6" fill="${INK}"/><circle cx="0" cy="-4" r="4.4" fill="#fff"/>
        <circle cx="0" cy="-4" r="4.4" fill="${glow}" class="core-glow"/><circle cx="-1.5" cy="-5.5" r="1.3" fill="#fff" opacity=".9"/></g>`;
    }
    parts += `<g class="pstk" data-limb="${k}" transform="translate(${x} ${y}) scale(${(s * kk * dir).toFixed(3)} ${(s * kk).toFixed(3)})${tilt ? ` rotate(${tilt})` : ''}">${inner}</g>`;

    // Attachments: upgrade and plating stickers stuck onto the part sticker.
    if (ls) {
      if (ls.plating) {
        const [px, py, ps] = platePoint(frameId, k);
        attach += itemAt(ls.plating.id, px, py, ps, `class="up ${opts.slap === k && opts.slapKind === 'plating' ? 'slap' : ''}"`);
      }
      if (ls.mount) {
        const [ax, ay, as] = attachPoint(frameId, k);
        attach += itemAt(ls.mount.id, ax, ay, as, `class="up ${opts.slap === k && opts.slapKind !== 'plating' ? 'slap' : ''}"`, dir < 0);
      }
      pending.filter((p) => p.target === k).forEach((w) => {
        const c = CARDS[w.id];
        const [ax, ay, as] = c.type === 'plating' ? platePoint(frameId, k) : attachPoint(frameId, k);
        if (c.type === 'weapon' || c.type === 'boost' || c.type === 'plating') attach += `<g class="pending-up" opacity=".45">${itemAt(w.id, ax, ay, as, '', dir < 0)}</g>`;
        attach += countdownBadge(ax + 9, ay - 9, w.timer);
      });
    }
  }

  let drones = '';
  if (player && player.guard > 0) {
    for (let i = 0; i < player.guard; i++) drones += `<g transform="translate(${18 + i * 18} 16)"><g class="drone" style="animation-delay:${i * -0.4}s">${itemAt('drone_escort', 0, 0, 0.55)}</g></g>`;
  }
  return `<svg class="mech-svg" viewBox="0 0 200 200" role="img" aria-label="${f.name}">
    <g class="bob">${sil}${parts}${attach}</g>${drones}</svg>`;
}

// ---------------------------------------------------------------- misc UI art

export const TYPE_COLORS = {
  weapon: '#E5484D', boost: '#F2C230', plating: '#8C95AA', support: '#3DDC97', order: '#9B7BFF',
};
export const TYPE_NAMES = { weapon: 'Weapon', boost: 'Upgrade', plating: 'Plating', support: 'Support', order: 'Order' };

export function logoSVG() {
  const t = (y, txt, fill, stroke, w, extra = '') => `<text x="180" y="${y}" font-size="72" letter-spacing="6" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}>${txt}</text>`;
  return `<svg class="logo" viewBox="0 0 360 150" role="img" aria-label="Mech Wars">
    <g font-family="Oxanium, 'Arial Black', sans-serif" font-weight="800" text-anchor="middle" stroke-linejoin="round" transform="skewX(-10) translate(14 0)">
      ${t(68, 'MECH', INK, INK, 15)}${t(136, 'WARS', INK, INK, 15)}
      ${t(68, 'MECH', '#fff', '#fff', 9.5)}${t(136, 'WARS', '#fff', '#fff', 9.5)}
      ${t(68, 'MECH', '#E7EAF1', INK, 2.4, 'paint-order="stroke"')}${t(136, 'WARS', '#E5484D', INK, 2.4, 'paint-order="stroke"')}
    </g>
    <g transform="translate(40 78)"><rect width="280" height="5" rx="2.5" fill="#3D6ED6"/><rect x="214" width="66" height="5" rx="2.5" fill="#F2C230"/></g></svg>`;
}

// Tiny glyphs for status rows.
const LIMB_GLYPH = {
  head: '<path d="M4 3h8l1.5 4-1 5H3.5l-1-5z" fill="#C9CFDB" stroke="#15172A" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 7h6" stroke="#7CFFB2" stroke-width="1.6" stroke-linecap="round"/>',
  armL: '<path d="M3 2h9l1 4H3z" fill="#C9CFDB" stroke="#15172A" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 6h4v4H6z" fill="#3B4058" stroke="#15172A" stroke-width="1.3"/><path d="M5 10h6l.5 4h-7z" fill="#C9CFDB" stroke="#15172A" stroke-width="1.3" stroke-linejoin="round"/>',
  legs: '<path d="M3 2h4v8H3zM9 2h4v8H9z" fill="#C9CFDB" stroke="#15172A" stroke-width="1.3"/><path d="M2 10h6v4H2zM8 10h6v4H8z" fill="#3B4058" stroke="#15172A" stroke-width="1.3"/>',
};
LIMB_GLYPH.armR = LIMB_GLYPH.armL;
export function limbGlyph(k) {
  return `<svg class="lg" viewBox="0 0 16 16" aria-hidden="true">${LIMB_GLYPH[k]}</svg>`;
}

// Head sticker markup for the app icon generator (tools/icons.mjs).
export function headSticker(frame = 'longshot') {
  const shapes = HEADS[frame]();
  return { svg: sticker(shapes, PAL[frame]), box: bbox(shapes) };
}

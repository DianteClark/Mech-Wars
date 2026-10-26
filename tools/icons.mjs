// Builds icons/icon.svg from the game's own head sticker art, then renders the PNG sizes.
// Usage: node tools/icons.mjs   (PNG rendering needs @resvg/resvg-js installed)
import { writeFileSync } from 'node:fs';
import { headSticker } from '../src/ui/art.js';

const { svg, box } = headSticker(process.env.HEAD || 'brakka');
const scale = 560 / Math.max(box.w, box.h);
const tx = 512 - box.cx * scale, ty = 530 - box.cy * scale;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%"><stop offset="0" stop-color="#2A2660"/><stop offset=".62" stop-color="#16142F"/><stop offset="1" stop-color="#0D0B1E"/></radialGradient>
    <pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#7DF9FF" stroke-opacity=".06" stroke-width="3"/></pattern>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <ellipse cx="512" cy="860" rx="300" ry="40" fill="#3D6ED6" opacity=".28"/>
  <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(3)})">${svg}</g>
</svg>`;
writeFileSync(new URL('../icons/icon.svg', import.meta.url), icon);

let Resvg;
try { ({ Resvg } = await import(process.env.RESVG || '@resvg/resvg-js')); } catch { console.log('icon.svg written; install @resvg/resvg-js to render PNGs'); process.exit(0); }
const dir = new URL('../icons/', import.meta.url);
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-1024.png', 1024]]) {
  writeFileSync(new URL(name, dir), new Resvg(icon, { fitTo: { mode: 'width', value: size } }).render().asPng());
}
const mask = icon.replace(/<g transform="translate\(([^)]*)\) scale\(([^)]*)\)">/, (m, t, s) => `<g transform="translate(512 512) scale(.8) translate(-512 -512)"><g transform="translate(${t}) scale(${s})">`).replace('</svg>', '</g></svg>');
writeFileSync(new URL('icon-maskable-512.png', dir), new Resvg(mask, { fitTo: { mode: 'width', value: 512 } }).render().asPng());
console.log('icons rendered');

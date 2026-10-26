// Tiny synthesized sound effects (WebAudio, no files). iOS only allows audio after a user tap,
// so the context is created lazily on the first sound after an interaction.
import { load } from './store.js';

let ctx = null;
let master = null;

function ac() {
  if (!load().settings.sound) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

// Unlock audio on the first touch (iOS needs this inside a gesture).
addEventListener('pointerdown', () => { ac(); }, { once: true, passive: true });

function tone(c, { f = 440, f2 = null, t = 0.12, type = 'square', vol = 0.5, at = 0 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  const now = c.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + t);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  o.connect(g); g.connect(master);
  o.start(now); o.stop(now + t + 0.02);
}

function noise(c, { t = 0.2, vol = 0.5, at = 0, freq = 1200, q = 0.8 }) {
  const len = Math.floor(c.sampleRate * t);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain();
  const now = c.currentTime + at;
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  s.connect(bp); bp.connect(g); g.connect(master);
  s.start(now);
}

const SOUNDS = {
  tap: (c) => tone(c, { f: 660, t: 0.05, type: 'triangle', vol: 0.25 }),
  move: (c) => { tone(c, { f: 140, f2: 90, t: 0.12, type: 'sawtooth', vol: 0.18 }); noise(c, { t: 0.1, vol: 0.15, freq: 300 }); },
  jab: (c) => { noise(c, { t: 0.09, vol: 0.5, freq: 900 }); tone(c, { f: 180, f2: 70, t: 0.1, type: 'square', vol: 0.25 }); },
  shot: (c) => { tone(c, { f: 900, f2: 200, t: 0.14, type: 'square', vol: 0.22 }); noise(c, { t: 0.08, vol: 0.3, freq: 2400 }); },
  rail: (c) => { tone(c, { f: 1600, f2: 120, t: 0.35, type: 'sawtooth', vol: 0.25 }); noise(c, { t: 0.3, vol: 0.35, freq: 3000, q: 2 }); },
  boom: (c) => { noise(c, { t: 0.45, vol: 0.7, freq: 220, q: 0.5 }); tone(c, { f: 90, f2: 35, t: 0.4, type: 'sine', vol: 0.5 }); },
  hit: (c) => { noise(c, { t: 0.12, vol: 0.45, freq: 1400 }); tone(c, { f: 220, f2: 110, t: 0.1, type: 'square', vol: 0.2 }); },
  crash: (c) => { noise(c, { t: 0.5, vol: 0.8, freq: 160, q: 0.4 }); tone(c, { f: 70, f2: 30, t: 0.45, type: 'sine', vol: 0.6 }); },
  lock: (c) => { tone(c, { f: 880, t: 0.07, type: 'square', vol: 0.2 }); tone(c, { f: 880, t: 0.07, type: 'square', vol: 0.2, at: 0.12 }); tone(c, { f: 1320, t: 0.12, type: 'square', vol: 0.2, at: 0.24 }); },
  build: (c) => { tone(c, { f: 440, f2: 880, t: 0.12, type: 'triangle', vol: 0.3 }); tone(c, { f: 1320, t: 0.08, type: 'triangle', vol: 0.2, at: 0.1 }); },
  guard: (c) => tone(c, { f: 520, f2: 1040, t: 0.18, type: 'sine', vol: 0.3 }),
  break: (c) => { noise(c, { t: 0.35, vol: 0.6, freq: 700, q: 0.6 }); tone(c, { f: 300, f2: 60, t: 0.3, type: 'sawtooth', vol: 0.25 }); },
  turn: (c) => { tone(c, { f: 523, t: 0.08, type: 'triangle', vol: 0.25 }); tone(c, { f: 784, t: 0.12, type: 'triangle', vol: 0.25, at: 0.09 }); },
  foeTurn: (c) => { tone(c, { f: 392, t: 0.08, type: 'triangle', vol: 0.22 }); tone(c, { f: 311, t: 0.12, type: 'triangle', vol: 0.22, at: 0.09 }); },
  special: (c) => { [523, 659, 784, 1046].forEach((f, i) => tone(c, { f, t: 0.12, type: 'square', vol: 0.18, at: i * 0.06 })); },
  dodge: (c) => tone(c, { f: 300, f2: 1200, t: 0.2, type: 'sine', vol: 0.3 }),
  win: (c) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, { f, t: 0.18, type: 'triangle', vol: 0.3, at: i * 0.1 })); },
  lose: (c) => { [392, 330, 262, 196].forEach((f, i) => tone(c, { f, t: 0.25, type: 'triangle', vol: 0.3, at: i * 0.14 })); },
  error: (c) => tone(c, { f: 160, t: 0.12, type: 'square', vol: 0.18 }),
};

export function sfx(name) {
  const c = ac();
  if (!c || !SOUNDS[name]) return;
  try { SOUNDS[name](c); } catch { /* ignore */ }
}

// Local save data. Home-screen apps on iPhone keep their own storage, separate from Safari,
// so progress made in Safari won't show up in the home-screen app (and vice versa).

const KEY = 'mechwars.save.v1';

const DEFAULT = {
  name: '',
  scrap: 0,
  unlocked: ['brakka', 'longshot', 'bastion'],
  board: [],            // ranked runs: { name, frame, pilot, floor, date }
  bestCasual: {},       // frame -> highest floor cleared
  run: null,            // run in progress (includes mid-battle state)
  seenManual: false,
  stats: { wins: 0, losses: 0 },
  settings: { hints: true, speed: 'normal', haptics: true, motion: 'system', sound: true },
  seenTips: [],
};

let cache = null;

export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...structuredClone(DEFAULT), ...JSON.parse(raw) } : structuredClone(DEFAULT);
    // Older saves may be missing newer nested settings.
    cache.settings = { ...DEFAULT.settings, ...(cache.settings || {}) };
    cache.stats = { ...DEFAULT.stats, ...(cache.stats || {}) };
    // Runs saved by the v1 card battler can't be resumed on the v2 board.
    if (cache.run && cache.run.v !== 2) cache.run = null;
  } catch {
    cache = structuredClone(DEFAULT);
  }
  return cache;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable (private mode / full). The game still runs, it just won't persist.
  }
}

export function update(fn) {
  fn(load());
  save();
}

// Wipes everything: progress, unlocks, leaderboard, settings and any run in progress.
export function resetAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  cache = structuredClone(DEFAULT);
  save();
}

// Small seeded RNG (mulberry32). State lives in the game state so matches replay exactly.
export function nextRand(holder) {
  let t = (holder.rng = (holder.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(holder, n) {
  return Math.floor(nextRand(holder) * n);
}

export function shuffle(holder, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(holder, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeRng(seed) {
  return { rng: seed >>> 0 };
}

// Runs the AI search off the main thread so the UI never freezes while it thinks.
import { chooseTurn } from './engine/ai.js';

self.onmessage = (e) => {
  const { id, state, cfg, seed } = e.data;
  const actions = chooseTurn(state, cfg, seed);
  self.postMessage({ id, actions });
};

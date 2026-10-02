import { readFileSync, writeFileSync } from 'node:fs';

const STATE_PATH = '.gitmon-state.json';

export function loadState(path = STATE_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(state, path = STATE_PATH) {
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n');
}

export function ensureEntry(state, name) {
  state[name] ??= {};
  return state[name];
}

export function isDue(lastCheck, intervalMs, now = new Date()) {
  return !lastCheck || now - new Date(lastCheck) >= intervalMs;
}

export function pruneState(state, names) {
  let pruned = false;
  for (const key of Object.keys(state)) {
    if (!names.has(key)) {
      delete state[key];
      pruned = true;
    }
  }
  return pruned;
}

import { loadConfig } from './lib/config.mjs';
import { loadState, saveState, ensureEntry, isDue, pruneState } from './lib/state.mjs';
import { notify } from './lib/notify.mjs';

const monitors = loadConfig();
const state = loadState();
const now = new Date();
let dirty = pruneState(state, new Set(monitors.map((m) => m.name)));

const due = [];
for (const m of monitors) {
  if (!m.checks.includes('http')) continue;
  if (!isDue(state[m.name]?.http?.last_check, m.http.interval_minutes * 60_000, now)) {
    console.log(`[skip] ${m.name} - checked recently`);
    continue;
  }
  due.push(m);
}

await Promise.all(due.map(async (m) => {
  const entry = ensureEntry(state, m.name);
  const prev = entry.http;
  const result = await checkHttp(m);
  const prevStatus = prev?.status ?? 'up';
  console.log(`[${result.status}] ${m.name}${result.reason ? ` - ${result.reason}` : ''}`);

  if (result.status !== prevStatus) {
    if (result.status === 'down') {
      await notify(`[DOWN] ${m.name} - ${result.reason}`);
    } else {
      const elapsed = prev?.since ? now - new Date(prev.since) : 0;
      await notify(`[UP] ${m.name} - recovered after ${formatDuration(elapsed)}`);
    }
  }

  entry.http = {
    status: result.status,
    since: result.status !== prevStatus ? now.toISOString() : (prev?.since ?? now.toISOString()),
    last_check: now.toISOString(),
  };
}));

dirty = dirty || due.length > 0;
if (dirty) saveState(state);

async function checkHttp(m) {
  try {
    const res = await fetch(m.url, {
      signal: AbortSignal.timeout(m.http.timeout_seconds * 1000),
      redirect: 'follow',
    });
    const up = m.http.expect_status != null
      ? res.status === m.http.expect_status
      : res.status >= 200 && res.status < 400;
    return up ? { status: 'up' } : { status: 'down', reason: `HTTP ${res.status}` };
  } catch (err) {
    const reason = err.name === 'TimeoutError'
      ? `timeout after ${m.http.timeout_seconds}s`
      : 'connection failed';
    return { status: 'down', reason };
  }
}

function formatDuration(ms) {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins ? `${hours}h${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d${remHours}h` : `${days}d`;
}

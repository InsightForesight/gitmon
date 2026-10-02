import tls from 'node:tls';
import { loadConfig } from './lib/config.mjs';
import { loadState, saveState, ensureEntry, isDue, pruneState } from './lib/state.mjs';
import { notify } from './lib/notify.mjs';

const monitors = loadConfig();
const state = loadState();
const now = new Date();
const today = now.toISOString().slice(0, 10);
let dirty = pruneState(state, new Set(monitors.map((m) => m.name)));

const due = [];
for (const m of monitors) {
  if (!m.checks.includes('ssl')) continue;
  if (!isDue(state[m.name]?.ssl?.last_check, m.ssl.interval_hours * 3_600_000, now)) {
    console.log(`[skip] ${m.name} - checked recently`);
    continue;
  }
  due.push(m);
}

await Promise.all(due.map(async (m) => {
  const entry = ensureEntry(state, m.name);
  const prev = entry.ssl;
  const result = await checkSsl(m);
  console.log(`[${result.status}] ${m.name}${result.daysLeft != null ? ` - ${result.daysLeft} days left` : ''}${result.error ? ` - ${result.error}` : ''}`);

  let alertMessage = null;
  if (result.status === 'expiring') {
    alertMessage = `[SSL] ${m.name} - certificate expires in ${pluralDays(result.daysLeft)} (${result.expiryDate})`;
  } else if (result.status === 'expired') {
    alertMessage = `[SSL] ${m.name} - certificate EXPIRED ${pluralDays(-result.daysLeft)} ago`;
  } else if (result.status === 'error') {
    alertMessage = `[SSL] ${m.name} - failed to read certificate (${result.error})`;
  }

  // At most one alert per site per day per status; a status change (e.g. expiring -> expired) re-alerts same day.
  const alreadyAlerted = prev?.last_alert_date === today && prev?.status === result.status;
  let alerted = false;
  if (alertMessage && !alreadyAlerted) {
    alerted = await notify(alertMessage);
  }

  entry.ssl = {
    status: result.status,
    days_left: result.daysLeft ?? null,
    last_check: now.toISOString(),
    last_alert_date: alerted ? today : (prev?.last_alert_date ?? null),
  };
}));

dirty = dirty || due.length > 0;
if (dirty) saveState(state);

async function checkSsl(m) {
  try {
    const host = new URL(m.url).hostname;
    const { expiry } = await readCertificate(host, m.ssl.timeout_seconds * 1000);
    const daysLeft = Math.floor((expiry - now) / 86_400_000);
    const status = daysLeft < 0 ? 'expired' : daysLeft < m.ssl.warn_days ? 'expiring' : 'ok';
    return { status, daysLeft, expiryDate: expiry.toISOString().slice(0, 10) };
  } catch (err) {
    return { status: 'error', daysLeft: null, error: err.message };
  }
}

function readCertificate(host, timeoutMs) {
  return new Promise((resolve, reject) => {
    // rejectUnauthorized: false — an expired cert must still be readable so we can report it
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) return reject(new Error('no certificate presented'));
      resolve({ expiry: new Date(cert.valid_to) });
    });
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error(`timeout after ${timeoutMs / 1000}s`)));
    socket.on('error', reject);
  });
}

function pluralDays(n) {
  return n === 1 ? '1 day' : `${n} days`;
}

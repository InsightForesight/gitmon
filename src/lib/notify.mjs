import { createHmac } from 'node:crypto';

const NOTIFY_TIMEOUT_MS = 10_000;

// Returns true if at least one channel delivered (or none are configured),
// so callers only record "alert sent" state on real delivery.
export async function notify(message) {
  const sends = [];
  if (process.env.NTFY_TOPIC) sends.push(sendNtfy(message));
  if (process.env.FEISHU_WEBHOOK) sends.push(sendFeishu(message));

  if (sends.length === 0) {
    console.log(`[notify skipped: no channel configured] ${message}`);
    return true;
  }

  const results = await Promise.allSettled(sends);
  let delivered = false;
  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn(`notify failed: ${r.reason?.message ?? r.reason}`);
    } else {
      delivered = true;
    }
  }
  return delivered;
}

async function sendNtfy(message) {
  const base = (process.env.NTFY_URL ?? 'https://ntfy.sh').replace(/\/+$/, '');
  const headers = { Title: 'GitMon', Priority: '4' };
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  const res = await fetch(`${base}/${process.env.NTFY_TOPIC}`, {
    method: 'POST',
    headers,
    body: message,
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ntfy responded ${res.status}`);
}

async function sendFeishu(message) {
  const body = { msg_type: 'text', content: { text: `GitMon: ${message}` } };
  if (process.env.FEISHU_SECRET) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const stringToSign = `${timestamp}\n${process.env.FEISHU_SECRET}`;
    body.timestamp = timestamp;
    body.sign = createHmac('sha256', stringToSign).update('').digest('base64');
  }
  const res = await fetch(process.env.FEISHU_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`feishu responded ${res.status}`);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`feishu error ${data.code}: ${data.msg}`);
}

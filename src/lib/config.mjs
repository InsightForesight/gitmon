import { readFileSync } from 'node:fs';

const VALID_CHECKS = ['http', 'ssl'];

export function loadConfig(path = 'monitors.json') {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`config file not found: ${path}`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    throw new Error(`config is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(config.monitors) || config.monitors.length === 0) {
    throw new Error('config must contain a non-empty "monitors" array');
  }

  const names = new Set();
  return config.monitors.map((m, i) => {
    const label = m?.name ? `"${m.name}"` : `monitors[${i}]`;
    if (!m || typeof m.name !== 'string' || m.name.length === 0) {
      throw new Error(`monitors[${i}]: "name" is required`);
    }
    if (names.has(m.name)) {
      throw new Error(`duplicate monitor name: "${m.name}"`);
    }
    names.add(m.name);

    let url;
    try {
      url = new URL(m.url);
    } catch {
      throw new Error(`${label}: "url" is not a valid URL`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`${label}: "url" must start with http:// or https://`);
    }

    if (!Array.isArray(m.checks) || m.checks.length === 0 || m.checks.some((c) => !VALID_CHECKS.includes(c))) {
      throw new Error(`${label}: "checks" must be a non-empty subset of ${JSON.stringify(VALID_CHECKS)}`);
    }

    const http = {
      timeout_seconds: m.http?.timeout_seconds ?? 10,
      expect_status: m.http?.expect_status ?? null,
      interval_minutes: m.http?.interval_minutes ?? 5,
    };
    if (http.interval_minutes % 5 !== 0) {
      throw new Error(`${label}: "http.interval_minutes" must be a multiple of 5`);
    }

    const ssl = {
      timeout_seconds: m.ssl?.timeout_seconds ?? 10,
      warn_days: m.ssl?.warn_days ?? 14,
      interval_hours: m.ssl?.interval_hours ?? 24,
    };

    return { name: m.name, url: m.url, checks: m.checks, http, ssl };
  });
}

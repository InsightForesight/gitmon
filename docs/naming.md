# GitMon Naming Specification

Frozen: 2026-10-02. All docs and code must use the names defined here. Any change must edit this file first.

## Project

- Name: **gitmon** (all lowercase). Repository name matches.
- One-line description: *Monitor websites on GitHub Actions.*

## File Layout

```
.github/workflows/
  http-check.yml        # workflow name: "HTTP Check"
  ssl-check.yml         # workflow name: "SSL Check"
src/
  check-http.mjs        # HTTP check entry point
  check-ssl.mjs         # SSL check entry point
  lib/
    config.mjs          # loads and validates MONITORS_CONFIG
    state.mjs           # state file read/write
    notify.mjs          # NTFY / Feishu senders
monitors.example.json   # committed sample config (placeholders only)
monitors.json           # generated at runtime from secret (gitignored)
.gitmon-state.json      # runtime state (gitignored, stored in Actions Cache)
```

## Config Schema (monitors.json)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes | — | Unique display name; used in state and alerts |
| `url` | string | yes | — | Must start with `http://` or `https://` |
| `checks` | array | yes | — | Non-empty subset of `["http", "ssl"]` |
| `http.timeout_seconds` | number | no | 10 | Request timeout |
| `http.expect_status` | number | no | — | Expected status code; if absent, 200–399 = up |
| `http.interval_minutes` | number | no | 5 | Must be a multiple of 5 (cron granularity) |
| `ssl.timeout_seconds` | number | no | 10 | TLS handshake timeout |
| `ssl.warn_days` | number | no | 14 | Alert when remaining days fall below this |
| `ssl.interval_hours` | number | no | 24 | SSL check interval |

## State Enums

- HTTP status: `up` / `down`
- SSL status: `ok` / `expiring` / `expired` / `error` (certificate unreadable)

State file `.gitmon-state.json` (Actions Cache, key `gitmon-state-v1`):

```json
{
  "<name>": {
    "http": { "status": "up", "since": "<ISO8601>", "last_check": "<ISO8601>" },
    "ssl":  { "status": "ok", "days_left": 80, "last_check": "<ISO8601>", "last_alert_date": null }
  }
}
```

- `since`: when the current HTTP status began (used to compute outage duration).
- `last_alert_date`: UTC date (`YYYY-MM-DD`) of the last SSL alert. At most one alert per site per day **per status**; a status change (e.g. `expiring` → `expired`) re-alerts on the same day. The date is only recorded when a notification was actually delivered.

The cache uses save key `gitmon-state-v1-<run_id>` with restore prefix `gitmon-state-v1-` (Actions cache keys are immutable, so a fixed save key would never update).

## GitHub Secrets

| Secret | Purpose |
|---|---|
| `MONITORS_CONFIG` | Full JSON content of `monitors.json` |
| `NTFY_TOPIC` | NTFY topic name |
| `NTFY_URL` | NTFY server base URL; defaults to `https://ntfy.sh` when unset (set this for self-hosted servers) |
| `NTFY_TOKEN` | NTFY access token; required only when the server enforces auth |
| `FEISHU_WEBHOOK` | Feishu custom-bot webhook URL |
| `FEISHU_SECRET` | Feishu custom-bot signature secret; required only when the bot uses 加签 (sign) security |

A missing notify secret disables that channel silently (single-channel setups are valid).

## Alert Copy (English, single line)

| Scenario | Format |
|---|---|
| HTTP down | `[DOWN] example-site - HTTP 503` |
| HTTP timeout | `[DOWN] example-site - timeout after 10s` |
| HTTP connection failure | `[DOWN] example-site - connection failed` |
| HTTP recovered | `[UP] example-site - recovered after 25m` |
| SSL expiring | `[SSL] example-site - certificate expires in 12 days (2026-10-14)` |
| SSL expired | `[SSL] example-site - certificate EXPIRED 3 days ago` |
| SSL unreadable | `[SSL] example-site - failed to read certificate (tls timeout)` |

Sender identity: NTFY `Title: GitMon`; Feishu message text prefixed with `GitMon:`.

Duration format: `25m`, `2h5m`, `1d3h` (largest two non-zero units).

## Banned Words

- No coined compound names (e.g. "certwatch", "sitemon"); use plain terms: `ssl check`, `http check`.
- Do not use `healthy`/`unhealthy`, `alive`/`dead` for statuses; use the enums above.
- Alert copy is English only; no exclamation marks; no emoji.
- Examples and committed files must use placeholder domains (`example.com`), never real monitored targets.

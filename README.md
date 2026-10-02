# GitMon

Monitor websites on GitHub Actions: HTTP availability every ~5 minutes, SSL certificate expiry daily, alerts via NTFY and Feishu.

## How It Works

- **HTTP Check** workflow runs every 5 minutes. Alerts only on status flips — one `[DOWN]` when a site breaks, one `[UP]` when it recovers.
- **SSL Check** workflow runs daily. Alerts when a certificate expires in fewer than `warn_days` days (default 14), at most once per site per day.
- State (statuses, timestamps) is kept in GitHub Actions Cache, so nothing is committed back to the repo.

GitHub Actions cron is best-effort: a 5-minute schedule may actually run every 5–20 minutes under load.

## Setup

1. Push this repository to GitHub as a **public** repo (free unlimited Actions minutes).
2. Add secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `MONITORS_CONFIG` | Full JSON content of your monitor list (see `monitors.example.json`) |
| `NTFY_TOPIC` | Your NTFY topic name (optional) |
| `NTFY_URL` | NTFY server base URL for self-hosted servers; defaults to `https://ntfy.sh` (optional) |
| `NTFY_TOKEN` | NTFY access token if your server requires auth (optional) |
| `FEISHU_WEBHOOK` | Your Feishu custom-bot webhook URL (optional) |
| `FEISHU_SECRET` | Bot signature secret, only if the bot uses 加签 security (optional) |

At least one notify channel (`NTFY_TOPIC` or `FEISHU_WEBHOOK`) should be set; a missing one simply disables that channel.

Notes:

- **NTFY**: for a self-hosted server, set `NTFY_URL` (e.g. `https://ntfy.example.com`) and `NTFY_TOKEN` if auth is enabled. On public ntfy.sh, the topic name is the access control — pick an unguessable topic (e.g. `gitmon-x7k2p`) and subscribe to it in the ntfy app.
- **Feishu**: all three bot security modes work. For keyword mode, set the keyword to `GitMon` (every message starts with `GitMon:`). For 加签 mode, also set `FEISHU_SECRET`.

3. Go to the **Actions** tab and enable workflows, then run **HTTP Check** and **SSL Check** once manually (`Run workflow`) to seed the state cache.

Because the repo is public, keep the real monitor list only in `MONITORS_CONFIG` — never commit `monitors.json`.

## Monitor Config

```json
{
  "monitors": [
    {
      "name": "example-site",
      "url": "https://example.com",
      "checks": ["http", "ssl"]
    }
  ]
}
```

| Field | Required | Default | Notes |
|---|---|---|---|
| `name` | yes | — | Unique name, shown in alerts |
| `url` | yes | — | `http://` or `https://` |
| `checks` | yes | — | Subset of `["http", "ssl"]` |
| `http.timeout_seconds` | no | 10 | Request timeout |
| `http.expect_status` | no | — | Expected status code; if absent, 200–399 = up |
| `http.interval_minutes` | no | 5 | Multiple of 5 |
| `ssl.timeout_seconds` | no | 10 | TLS handshake timeout |
| `ssl.warn_days` | no | 14 | Alert threshold for days until expiry |
| `ssl.interval_hours` | no | 24 | SSL check interval |

## Alert Examples

```
[DOWN] example-site - HTTP 503
[DOWN] example-site - timeout after 10s
[UP] example-site - recovered after 25m
[SSL] example-site - certificate expires in 12 days (2026-10-14)
[SSL] example-site - certificate EXPIRED 3 days ago
```

## Local Development

No dependencies to install. Node.js 20+ required.

```bash
cp monitors.example.json monitors.json
node src/check-http.mjs
node src/check-ssl.mjs
cat .gitmon-state.json
```

Without `NTFY_TOPIC` / `FEISHU_WEBHOOK` set, alerts are printed to stdout instead of sent.

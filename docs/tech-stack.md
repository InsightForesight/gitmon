# GitMon Technology Selection

Frozen: 2026-10-02. One choice per layer, one reason each. Any change must edit this file first.

| Layer | Choice | Reason | Key limits |
|---|---|---|---|
| Runtime | Node.js 20 (via `actions/setup-node@v4`) | Built-in `fetch`, `tls`, `AbortSignal.timeout` cover every need | LTS; ESM (`"type": "module"`) |
| Dependencies | **Zero npm dependencies** | No install step → ~10–20s job runs, no supply-chain surface | Use only Node standard library |
| Config format | JSON (`monitors.json`) | Parses with `JSON.parse`, zero deps | Real config lives in `MONITORS_CONFIG` secret, never committed |
| State storage | GitHub Actions Cache | No git-history pollution; worst case on cache eviction is one duplicate alert | Cache is 10 GB/repo, 7-day eviction for unused entries |
| Cache action | `actions/cache/restore@v4` + `actions/cache/save@v4`, save key `gitmon-state-v1-<run_id>`, restore prefix `gitmon-state-v1-` | Cache keys are immutable — a fixed save key silently never updates after the first save | Save step runs `if: always()` |
| Scheduler | Two workflows: `HTTP Check` (`*/5 * * * *`) and `SSL Check` (daily at `17 3 * * *`) | Independent cadences; off-:00 minute dodges GHA load spikes | GHA cron is best-effort; 5-min interval may stretch to 5–20 min — accepted |
| Notify: NTFY | `POST $NTFY_URL/$NTFY_TOPIC` (`NTFY_URL` defaults to `https://ntfy.sh`); optional Bearer `NTFY_TOKEN` | One HTTP call, no SDK; works with self-hosted servers | Topic name is the access control on public ntfy.sh |
| Notify: Feishu | `POST $FEISHU_WEBHOOK`, `msg_type: text`; optional HMAC-SHA256 sign via `FEISHU_SECRET` | One HTTP call, no SDK; supports all three bot security modes (none / keyword `GitMon` / sign) | Keyword mode requires bot keyword set to `GitMon` |
| Hosting | GitHub public repository | Free unlimited Actions minutes | Monitor list must stay in secrets (public repo) |
| Permissions | `permissions: {}` on every workflow | Read-only job needs no token scope | — |

## Cost Arithmetic

- HTTP check: ~8,640 runs/month × ~20 s ≈ 2,880 min — free on public repos (unlimited minutes for `ubuntu-latest`).
- SSL check: 30 runs/month, negligible.
- On a **private** repo the same volume (~4,300 billable min) would exceed the 2,000 free minutes; hence public repo + secrets-based config.

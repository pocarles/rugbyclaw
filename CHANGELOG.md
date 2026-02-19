# Changelog

All notable changes to **RugbyClaw** will be documented in this file.

Format: **Keep a Changelog** (https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Added
- Global `--agent` mode for strict one-line automation envelopes (`ok`, `exit_code`, `error_type`, `data`, `trace_id`).
- New `rugbyclaw openclaw init` command to emit copy/paste-safe OpenClaw bootstrap + health-check commands.
- New scheduled GitHub workflow: `Monitor Proxy Health` (checks `/health`, `/status`, `/games`, flags latency spikes, opens/updates alert issue).
- New CI guard script (`scripts/check-contract-note.sh`) to require a changelog/version note when JSON-contract-facing files change.

### Changed
- Worker now returns request tracing headers (`X-Request-Id`) and exposes trace IDs in status JSON.
- CLI JSON outputs now surface `trace_id`, plus `stale` / `cached_at` when stale cache fallback is used.
- Free-mode fallback UX now prints: “Live data unavailable, showing last update …” when stale cache is served.

### Security
- Worker request hardening:
  - strict endpoint/query validation and size limits,
  - user-agent sanity checks + scanner denylist,
  - per-endpoint burst rate limits in addition to global per-minute/day limits.

## [0.1.3] - 2026-02-05

### Added
- New `rugbyclaw doctor` command — checks proxy /health, proxy /status, and API-Sports direct connectivity.
- Maintainer guide: releasing checklist (npm publish).

### Fixed
- Doctor validation and diagnostics output.

### Changed
- Free mode now shows quota info in JSON and prints a quota line when proxy status is reachable.
- Top 14 placeholder kickoff times now show **Coming Soon** instead of **TBD**.
- Exported API-Sports base URL constant (internal refactor).

## [0.1.2] - 2026-02-05

### Added
- `rugbyclaw version` command.
- Timezone support:
  - timezone selection in `rugbyclaw config`
  - `--tz <IANA>` override for commands (ex: `America/New_York`).
- “Free mode” support utilities (proxy mode helpers).
- Cloudflare Worker deploy workflow (CI) for the proxy.
- Expanded docs: command pages + guides (calendar export, following teams, automation) and configuration reference.

### Changed
- Improved free-mode `status` output.
- Better handling of placeholder kickoff times (show **TBD / Coming Soon** instead of misleading times).
- Updated worker tooling (wrangler + lockfile).

## [0.1.1] - 2026-02-04

### Changed
- CI/worker deploy logging: surface Cloudflare KV/deploy errors more clearly.

## [0.1.0] - 2026-02-02

### Added
- Initial public release.
- CLI commands: scores, fixtures, results, team, config, calendar.
- Default proxy/free mode (no API key) + direct mode (API key).

[0.1.3]: https://github.com/pocarles/rugbyclaw/releases/tag/v0.1.3
[0.1.2]: https://github.com/pocarles/rugbyclaw/releases/tag/v0.1.2

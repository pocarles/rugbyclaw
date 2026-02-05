# Changelog

All notable changes to **RugbyClaw** will be documented in this file.

Format: **Keep a Changelog** (https://keepachangelog.com/en/1.1.0/)

## [0.1.3] - 2026-02-05

### Added
- New `rugbyclaw doctor` command — checks proxy /health, proxy /status, and API-Sports direct connectivity.
- Free mode now shows quota info in JSON and prints a quota line when proxy status is reachable.

### Changed
- Top 14 placeholder kickoff times now show **Coming Soon** instead of **TBD**.

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

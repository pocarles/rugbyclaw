# Changelog

All notable changes to **RugbyClaw** will be documented in this file.

Format: **Keep a Changelog** (https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

## [0.1.7] - 2026-02-20

### Added
- Official fallback kickoff sources now cover more competitions when API-Sports kickoff data is placeholder/TBD:
  - Premiership
  - Six Nations
  - Super Rugby Pacific
  - Champions Cup
  - Challenge Cup
- New docs page for agent-friendly contracts and machine-readable endpoints:
  - `llms.txt`
  - `llms-full.txt`
  - `docs/agent.json`
  - `docs/updates.xml`

### Changed
- Time fallback matching now applies across supported fallback leagues (LNR + URC + InCrowd-backed competitions).
- CLI `--tz` parsing now validates early and returns clear Commander validation errors for invalid values.
- Release process docs now include website/agent-doc sync steps and feed checks.

### Security
- Reduced attack surface in dev toolchain by removing eslint/typescript-eslint from dependencies.
- `npm audit` now reports zero vulnerabilities in both root and worker workspaces after lockfile refresh.

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
[0.1.7]: https://github.com/pocarles/rugbyclaw/releases/tag/v0.1.7

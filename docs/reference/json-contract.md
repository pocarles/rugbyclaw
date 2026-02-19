---
title: JSON Output Contract
description: Stable machine-readable output and exit-code rules
category: reference
tags: [json, automation, api-contract]
updated: 2026-02-19
---

# JSON Output Contract

Use `--json` when Rugbyclaw is called by scripts or agents.

## Global Rules

- `--json` means stdout is JSON only.
- Human text is not mixed with JSON.
- Validation/runtime errors return:
  - stdout: `{ "error": "..." }`
  - exit code: non-zero (usually `1`)
- Success returns command-specific JSON with exit code `0`.

## Exit Codes

- `0`: command completed (including empty result cases represented in JSON)
- `1`: invalid input, unavailable mode/resource, or runtime failure

## Command Outputs

### `rugbyclaw scores --json`

Returns `ScoresOutput`:
- `matches[]`
- `generated_at`
- `rate_limit` (free mode only)

### `rugbyclaw fixtures [league] --json`

Returns `FixturesOutput`:
- `league` (optional)
- `matches[]`
- `generated_at`
- `rate_limit` (free mode only)

With `--ics --json`, returns export metadata:
- `exported`
- `out` (file path or `null`)
- optional `warning`
- optional `generated_at`

### `rugbyclaw results [league] --json`

Returns `ResultsOutput`:
- `league` (optional)
- `matches[]`
- `generated_at`
- `rate_limit` (free mode only)

### `rugbyclaw team search <query> --json`

Returns:
- `query`
- `teams[]` (empty list when no match)

### `rugbyclaw team next <name> --json`
### `rugbyclaw team last <name> --json`

Returns:
- `action`: `"next"` or `"last"`
- `query`: original input
- `team_id`: resolved team id or `null`
- `match`: match object or `null`
- optional `reason` when `match` is `null`
- `generated_at`

### `rugbyclaw calendar <matchId> --json`

Returns:
- `match_id`
- `out`
- `home`
- `away`
- `date`
- `venue`
- `generated_at`

`--json` and `--stdout` are mutually exclusive.
When `--out` points to an existing file, command returns JSON error unless `--force` is set.

### `rugbyclaw notify --json`

Returns `NotifyOutput`:
- `type`: `weekly | daily | live | all`
- `notifications[]`
- `generated_at`

### `rugbyclaw status --json`

Returns current runtime mode/config snapshot:
- mode, timezone, leagues, proxy status, and free-mode rate limit info.

### `rugbyclaw doctor --json`

Returns diagnostic report:
- top-level `ok`
- environment metadata
- detailed check results
- `generated_at`

### `rugbyclaw config --json`

Returns saved config summary:
- `config`
- `mode`
- `api_key_saved`

---
*Last updated: 2026-02-19*

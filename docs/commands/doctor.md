---
title: rugbyclaw doctor
description: Diagnose proxy, API, and configuration issues
category: commands
tags: [doctor, troubleshooting, status]
updated: 2026-02-19
---

# rugbyclaw doctor

> Diagnose proxy, API, and configuration issues

## Usage

```bash
rugbyclaw doctor [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output as JSON | false |
| `--quiet` | Minimal output | false |
| `--strict` | Exit non-zero when checks fail | false |

## Examples

```bash
rugbyclaw doctor
rugbyclaw doctor --json
rugbyclaw doctor --json --strict
```

## Notes

- In free mode, Rugbyclaw depends on the proxy Worker. `doctor` checks if it is reachable.
- If you have an API key configured, `doctor` also checks direct API-Sports connectivity.
- `--strict` makes `doctor` fail CI/automation when checks fail (non-zero exit code).
- `doctor` now includes a **scores probe** for your configured timezone/date/leagues:
  - timezone used
  - date queried for `scores`
  - leagues queried
  - per-league API result counts
- `doctor` shows how many kickoff overrides are loaded and which override file path is in use.

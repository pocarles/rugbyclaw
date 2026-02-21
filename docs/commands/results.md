---
title: rugbyclaw results
description: Show recent results
category: commands
tags: [results, scores, history]
updated: 2026-02-21
---

# rugbyclaw results

> Show recent results

## Usage

```bash
rugbyclaw results [league] [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --limit <number>` | Number of matches to show | 15 |
| `--json` | Output as JSON | false |
| `--quiet` | Minimal output | false |
| `--no-followups` | Disable next-step command hints | false |

## Free mode notes

- Without an API key, only default leagues are available.
- If a league is blocked in free mode, add your own API key via `rugbyclaw config`.
- If no results are returned, Rugbyclaw prints a quick explanation (mode/timezone/leagues).

## Examples

```bash
# All effective leagues
rugbyclaw results

# Specific league
rugbyclaw results top14

# Last 5 matches
rugbyclaw results -n 5
```

## Related

- `rugbyclaw fixtures` for upcoming games
- `rugbyclaw doctor` for API/proxy diagnostics

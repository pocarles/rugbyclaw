---
title: rugbyclaw standings
description: Show league standings table
category: commands
tags: [standings, table, rankings]
updated: 2026-03-08
---

# rugbyclaw standings

> Show league standings table

## Usage

```bash
rugbyclaw standings [league] [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output as JSON | false |
| `--agent` | Strict one-line JSON envelope | false |
| `--quiet` | Minimal output | false |
| `--no-followups` | Disable next-step command hints | false |

## Free mode notes

- Without an API key, standings are available for default free leagues only.
- If a league is blocked in free mode, add your own API key via `rugbyclaw config`.
- Output may include additive enrichment fields when available.

## Examples

```bash
# Standings across your effective leagues
rugbyclaw standings

# Specific league
rugbyclaw standings top14

# Automation output
rugbyclaw standings --json
rugbyclaw standings --agent
```

## Related

- `rugbyclaw fixtures` for upcoming matches
- `rugbyclaw results` for recent results
- `rugbyclaw doctor` for proxy/API diagnostics

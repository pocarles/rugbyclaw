---
title: rugbyclaw results
description: Show recent results
category: commands
tags: [results, scores, history]
updated: 2026-02-04
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

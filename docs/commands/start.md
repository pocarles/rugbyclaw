---
title: rugbyclaw start
description: Beginner-first setup (quick mode)
category: commands
tags: [start, setup, onboarding]
updated: 2026-02-21
---

# rugbyclaw start

> Fast onboarding with minimal prompts

## Usage

```bash
rugbyclaw start [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--guided` | Use full guided setup | false |
| `--yes` | Non-interactive mode (accept defaults) | false |
| `--mode <proxy\|direct>` | Set mode in non-interactive mode | auto |
| `--api-key-env <name>` | Env var name for API key in direct mode | API_SPORTS_KEY |

## What it does

- Runs setup in quick mode by default
- Uses free mode if no API key exists
- Applies recommended leagues
- Skips optional team selection
- Confirms timezone
- Runs a mini post-setup check (`proxy/API + one data probe`)

Use `rugbyclaw start --guided` if you want full control over mode, leagues, teams, and timezone.

## Agent-Friendly Examples

```bash
# Non-interactive free mode
rugbyclaw start --yes --tz America/New_York --mode proxy

# Non-interactive direct mode (reads API key from env var)
export API_SPORTS_KEY="..."
rugbyclaw start --yes --mode direct --api-key-env API_SPORTS_KEY
```

When using `--json`, also use `--yes` so output stays machine-safe (pure JSON, no onboarding text).

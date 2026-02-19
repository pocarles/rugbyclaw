---
title: rugbyclaw config
description: Interactive setup wizard (free mode or API key)
category: commands
tags: [config, setup, preferences]
updated: 2026-02-19
---

# rugbyclaw config

> Interactive setup wizard

## Usage

```bash
rugbyclaw config [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output as JSON | false |
| `--quiet` | Minimal output | false |
| `--quick` | Force quick setup (few prompts) | false |
| `--guided` | Force full guided setup | false |
| `--yes` | Non-interactive mode (accept defaults) | false |
| `--mode <proxy\|direct>` | Set mode in non-interactive mode | auto |
| `--api-key-env <name>` | Env var name for API key in direct mode | API_SPORTS_KEY |

## What it configures

- Mode: free mode (no API key) or API key (optional)
- Favorite leagues
- (Optional) favorite teams
- Timezone (used for displaying match times; selected from a menu)

## Quick vs Guided

- Quick mode (`rugbyclaw start` or `rugbyclaw config --quick`) is beginner-first:
  - Free mode by default
  - Recommended leagues auto-selected
  - Team selection skipped
  - Timezone confirmation
- Guided mode (`rugbyclaw config --guided`) lets you choose every detail.
- Non-interactive mode (`rugbyclaw config --yes`) applies defaults with no prompts.

Example:

```bash
rugbyclaw config --yes --mode proxy --tz America/New_York
```

## Files written

- `~/.config/rugbyclaw/config.json` — leagues/teams/timezone
- `~/.config/rugbyclaw/secrets.json` — API key (mode 600) if provided

You can override the default location with `--config`:

```bash
rugbyclaw --config ./my-rugbyclaw-config config
```

You can also override the timezone at runtime with `--tz`:

```bash
rugbyclaw --tz America/New_York fixtures
```

## Tips

- Free mode is limited to default leagues (Top 14, Premiership, URC, Champions Cup, Six Nations).
- Verify your setup any time:

```bash
rugbyclaw status --json
```

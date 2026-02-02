---
title: rugbyclaw scores
description: Show today's matches across your favorite leagues
category: commands
tags: [scores, live, matches]
updated: 2026-02-02
---

# rugbyclaw scores

> Show today's matches across your favorite leagues

## Usage

```bash
rugbyclaw scores [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output as JSON | false |
| `--quiet` | Minimal output | false |

## Examples

### View today's matches

```bash
rugbyclaw scores
```

**Output:**
```
🏉 Rugby Scores - Sunday, Feb 2, 2026

Top 14
  Toulouse vs Racing 92          15:00
  Lyon vs Bordeaux              17:00

Premiership  
  Saracens vs Leicester         14:30
  Bath vs Harlequins            16:45
```

### JSON output

```bash
rugbyclaw scores --json
```

Returns structured JSON for scripts/automation.

## How It Works

- Shows matches happening today
- Only displays leagues you selected in config
- Times shown in your configured timezone
- Updates when you run the command (not live-updating)

## Tips

- Run this command in the morning to see today's schedule
- Combine with `watch` for live updates: `watch -n 60 rugbyclaw scores`
- Use `--json` for integration with other tools

## Related Commands

- [fixtures](./fixtures.md) - Upcoming matches
- [results](./results.md) - Recent results

---
*Last updated: 2026-02-02*

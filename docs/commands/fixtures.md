---
title: rugbyclaw fixtures
description: View upcoming matches
category: commands
tags: [fixtures, upcoming, schedule]
updated: 2026-02-02
---

# rugbyclaw fixtures

> View upcoming matches

## Usage

```bash
rugbyclaw fixtures [options] [league]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `league` | Filter to specific league (optional) |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --limit <number>` | Number of matches to show | 15 |
| `--ics` | Export to .ics calendar file | false |
| `--show-ids` | Show match IDs for calendar export | false |
| `--json` | Output as JSON | false |

## Examples

### All your leagues

```bash
rugbyclaw fixtures
```

Shows next 15 matches across all your favorite leagues.

### Specific league

```bash
rugbyclaw fixtures top14
```

Shows next 15 Top 14 matches only.

### Limit results

```bash
rugbyclaw fixtures -n 5
```

Shows only next 5 matches.

### Export to calendar

```bash
rugbyclaw fixtures --ics
```

Creates `fixtures.ics` file you can import to your calendar app.

### Show match IDs

```bash
rugbyclaw fixtures --show-ids
```

Displays match IDs (useful for `rugbyclaw calendar <id>`).

## Supported Leagues

Use these slugs as the `[league]` argument:

- `top14` - Top 14 (France)
- `premiership` - Premiership Rugby (England)
- `urc` - United Rugby Championship
- `pro_d2` - Pro D2 (France)
- `super_rugby` - Super Rugby Pacific
- `champions_cup` - European Rugby Champions Cup
- `challenge_cup` - European Rugby Challenge Cup
- `six_nations` - Six Nations

[See all leagues](../reference/leagues.md)

## Tips

- Use `--ics` to sync entire schedule to your calendar
- Check specific leagues during tournament weeks
- Combine with `--json` for custom scripts

## Related Commands

- [scores](./scores.md) - Today's matches
- [calendar](./calendar.md) - Export single match
- [results](./results.md) - Past results

---
*Last updated: 2026-02-02*

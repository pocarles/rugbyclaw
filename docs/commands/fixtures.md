---
title: rugbyclaw fixtures
description: View upcoming matches
category: commands
tags: [fixtures, upcoming, schedule]
updated: 2026-02-21
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
| `--explain` | Explain empty output context | false |
| `--no-followups` | Disable next-step command hints | false |
| `--json` | Output as JSON | false |

## Examples

### All your leagues

```bash
rugbyclaw fixtures
```

Shows next 15 matches across your effective leagues:
- If you added an API key: your configured favorites
- In free mode: default leagues only

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

### Disable follow-up hints

```bash
rugbyclaw fixtures --no-followups
```

Hides the contextual **Next steps** block.

### Explain empty output

```bash
rugbyclaw fixtures --explain
```

Rugbyclaw now prints a short no-match explanation by default.  
Use `--explain` for full context (mode, timezone, queried leagues, and limit).

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

## Free Mode Notes

Without an API key, Rugbyclaw is limited to a default set of leagues (Top 14, Premiership, URC, Champions Cup, Six Nations).

If a kickoff time is known to be a provider placeholder, JSON output includes:
- `time_tbd: true`
- `time_confidence: "pending"` (otherwise `"exact"`)
- `time_source: "provider"` (or `"secondary"` if verified by kickoff overrides)

When `time_confidence` is `"pending"`, kickoff date/time can still change upstream.  
CLI output groups these matches under **Coming Soon** to avoid showing misleading kickoff details.
When a kickoff is verified from fallback data, CLI marks it with `*`.

To apply trusted corrections, add optional overrides in:
- `~/.config/rugbyclaw/kickoff-overrides.json`

## Tips

- Use `--ics` to sync entire schedule to your calendar
- Check specific leagues during tournament weeks
- Combine with `--json` for custom scripts

## Related Commands

- [scores](./scores.md) - Today's matches
- [calendar](./calendar.md) - Export single match
- [results](./results.md) - Past results

---
*Last updated: 2026-02-21*

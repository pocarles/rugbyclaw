---
title: rugbyclaw calendar
description: Export a match to an ICS calendar file
category: commands
tags: [calendar, ics, export]
updated: 2026-02-19
---

# rugbyclaw calendar

> Export a match to an ICS calendar file

## Usage

```bash
rugbyclaw calendar <matchId> [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--stdout` | Print ICS to stdout | false |
| `-o, --out <file>` | Output file path | `match-<id>.ics` |
| `-f, --force` | Overwrite output file if it already exists | false |
| `--json` | Output JSON metadata | false |
| `--quiet` | Minimal output | false |

## Tips

- Use `rugbyclaw fixtures --show-ids` to find match IDs.
- ICS timestamps are exported in UTC; calendar apps typically display them in your local timezone.
- When kickoff time is unknown (`time_tbd`), Rugbyclaw exports an all-day event for that date.
- `--stdout` and `--json` are mutually exclusive.
- Existing files are protected by default; use `--force` to replace one explicitly.

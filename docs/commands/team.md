---
title: rugbyclaw team
description: Query specific teams - search, next match, last result
category: commands
tags: [team, search, tracking]
updated: 2026-02-02
---

# rugbyclaw team

> Query specific teams - search, next match, last result

## Commands

### rugbyclaw team search

Find a team by name.

```bash
rugbyclaw team search <query>
```

**Example:**
```bash
rugbyclaw team search toulouse
```

**Output:**
```
Found teams matching "toulouse":
  - Stade Toulousain (ID: 107)
  - Toulouse Olympique (ID: 892)
```

### rugbyclaw team next

Show team's next match.

```bash
rugbyclaw team next <name>
```

**Example:**
```bash
rugbyclaw team next toulouse
```

**Output:**
```
Stade Toulousain - Next Match

Sat, Feb 15, 2026 at 15:00
Stade Toulousain vs Stade Français Paris
Competition: Top 14
Venue: Stade Ernest-Wallon, Toulouse
```

**Options:**
- `--ics` - Export match to calendar file

### rugbyclaw team last

Show team's last result.

```bash
rugbyclaw team last <name>
```

**Example:**
```bash
rugbyclaw team last toulouse
```

**Output:**
```
Stade Toulousain - Last Result

Sat, Feb 8, 2026
Stade Toulousain 38 - 12 Racing 92
Competition: Top 14

Match Summary:
Absolute clinic. Toulouse dominated every aspect of the game.
Dupont orchestrated a masterclass, Ntamack finished brilliantly.
Racing never looked like competing.
```

## Tips

- Use partial names: `toulouse` matches `Stade Toulousain`
- Search first if unsure of exact name
- Add `--ics` to next matches to sync to calendar
- Team names are case-insensitive

## Troubleshooting

**"No team found"?**
- Try `rugbyclaw team search <query>` first
- Use partial name (e.g., "toulouse" not "Stade Toulousain")
- Check spelling

**Wrong team showing up?**
- Be more specific in your query
- Use the team ID: `rugbyclaw team next 107`

## Related Commands

- [fixtures](./fixtures.md) - View all upcoming matches
- [results](./results.md) - View recent results
- [calendar](./calendar.md) - Export to calendar

---
*Last updated: 2026-02-02*

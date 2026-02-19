---
title: Getting Started
description: Install RugbyClaw and start using it in 30 seconds
category: getting-started
tags: [setup, installation, quickstart]
updated: 2026-02-18
---

# Getting Started with RugbyClaw

> Works out of the box — no API key required (free mode)

## Installation

```bash
npm install -g rugbyclaw
```

That's it! You can start using RugbyClaw immediately.

## First Commands

Try it now:

### Check today's scores

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
```

### View upcoming fixtures

```bash
rugbyclaw fixtures
```

Shows next 15 matches from your default leagues (Top 14, Premiership, URC, Champions Cup, Six Nations).

### Follow your team

```bash
rugbyclaw team next toulouse
```

Shows when Toulouse plays next.

## Two Operating Modes

RugbyClaw works in two modes:

### Proxy Mode (Default)
- **No API key needed** — works immediately after install
- Uses shared API access (limited requests)
- Perfect for casual users
- Default leagues: Top 14, Premiership, URC, Champions Cup, Six Nations

### Direct Mode (Optional)
- Higher limits with your own API key
- Unlock more leagues
- For power users who check scores daily

## Recommended: Configure (Free or Direct)

Run:

```bash
rugbyclaw config
```

You'll be asked to:
1. Choose free mode (default) or add an API key (optional)
2. Select favorite leagues (free mode is limited to default leagues)
3. (Optional) add favorite teams
4. Set your timezone

Verify your setup any time:

```bash
rugbyclaw status
rugbyclaw status --json
```

## What's Next?

- [Commands Reference](./commands/) - Learn all available commands
- [Following Teams](./guides/following-teams.md) - Track specific teams
- [Calendar Export](./guides/calendar-export.md) - Sync to your calendar

## Troubleshooting

**"Rate limit exceeded"?**
→ You've used your 50 daily requests. Run `rugbyclaw config` to add your own API key for unlimited access.

**Want more leagues?**
→ Add your own API key via `rugbyclaw config`

---
*Last updated: 2026-02-18*

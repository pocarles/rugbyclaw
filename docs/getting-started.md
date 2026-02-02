---
title: Getting Started
description: Install RugbyClaw and start using it in 30 seconds
category: getting-started
tags: [setup, installation, quickstart]
updated: 2026-02-02
---

# Getting Started with RugbyClaw

> Works out of the box — no setup required

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
rugbyclaw team toulouse next
```

Shows when Toulouse plays next.

## Two Operating Modes

RugbyClaw works in two modes:

### Proxy Mode (Default)
- **No configuration needed** — works immediately after install
- Uses shared API access (50 requests/day)
- Perfect for casual users
- Default leagues: Top 14, Premiership, URC, Champions Cup, Six Nations

### Direct Mode (Optional)
- **Unlimited requests** with your own API key
- Customize leagues and favorite teams
- For power users who check scores daily

## Optional: Configure (Direct Mode)

Want unlimited requests? Run:

```bash
rugbyclaw config
```

You'll be asked to:
1. Enter your API key (get one free at [api-sports.io](https://api-sports.io))
2. Select favorite leagues
3. Add favorite teams
4. Set your timezone

## What's Next?

- [Commands Reference](./commands/) - Learn all available commands
- [Following Teams](./guides/following-teams.md) - Track specific teams
- [Calendar Export](./guides/calendar-export.md) - Sync to your calendar

## Troubleshooting

**"Rate limit exceeded"?**
→ You've used your 50 daily requests. Run `rugbyclaw config` to add your own API key for unlimited access.

**Want more leagues?**
→ Run `rugbyclaw config` to customize your league selection

---
*Last updated: 2026-02-02*

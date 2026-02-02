---
title: Getting Started
description: Install and configure RugbyClaw in 5 minutes
category: getting-started
tags: [setup, installation, quickstart]
updated: 2026-02-02
---

# Getting Started with RugbyClaw

> Install and configure RugbyClaw in 5 minutes

## Installation

```bash
npm install -g rugbyclaw
```

## Get an API Key

RugbyClaw uses [API-Sports Rugby API](https://api-sports.io) for data.

1. Go to [api-sports.io](https://api-sports.io)
2. Sign up for a free account
3. Get your API key (100 requests/day free)

## Configure

Run the interactive setup wizard:

```bash
rugbyclaw config
```

You'll be asked to:
1. Enter your API key
2. Select favorite leagues (Top 14, Premiership, URC, etc.)
3. Add favorite teams
4. Set your timezone

## First Commands

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
rugbyclaw fixtures top14
```

Shows next 15 Top 14 matches with dates and times.

### Follow your team

```bash
rugbyclaw team toulouse next
```

Shows when Toulouse plays next.

## What's Next?

- [Commands Reference](./commands/) - Learn all available commands
- [Following Teams](./guides/following-teams.md) - Track specific teams
- [Calendar Export](./guides/calendar-export.md) - Sync to your calendar

## Troubleshooting

**"Not configured" error?**
→ Run `rugbyclaw config` first

**"API error" or "Rate limit"?**
→ Check [API Limits](./reference/api-limits.md)

---
*Last updated: 2026-02-02*

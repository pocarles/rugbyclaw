---
title: Supported Leagues
description: All rugby competitions supported by RugbyClaw
category: reference
tags: [leagues, competitions, reference]
updated: 2026-02-20
---

# Supported Leagues

> 8 rugby competitions supported by RugbyClaw

## Free Mode (No API Key)

In free mode, Rugbyclaw is limited to a default set of leagues:

- `top14`
- `premiership`
- `urc`
- `champions_cup`
- `six_nations`

Add your own API key via `rugbyclaw config` to unlock all currently supported leagues listed below (8 total).

## Club Competitions

### Top 14 (France)
- **Slug:** `top14`
- **Teams:** 14
- **Season:** September - June
- **Format:** Regular season + playoffs

### Premiership Rugby (England)
- **Slug:** `premiership`
- **Teams:** 10
- **Season:** September - June
- **Format:** Regular season + playoffs

### United Rugby Championship (URC)
- **Slug:** `urc`
- **Teams:** 16 (Ireland, Scotland, Wales, Italy, South Africa)
- **Season:** September - June
- **Format:** Multi-nation league

### Pro D2 (France)
- **Slug:** `pro_d2`
- **Teams:** 16
- **Season:** August - June
- **Format:** Second division of French rugby

### Super Rugby Pacific
- **Slug:** `super_rugby`
- **Teams:** 12 (Australia, New Zealand, Pacific Islands)
- **Season:** February - July
- **Format:** Southern Hemisphere competition

## European Competitions

### European Rugby Champions Cup
- **Slug:** `champions_cup`
- **Teams:** 24
- **Season:** December - May
- **Format:** Top European club competition

### European Rugby Challenge Cup
- **Slug:** `challenge_cup`
- **Teams:** 18
- **Season:** December - May
- **Format:** Secondary European competition

## International

### Six Nations
- **Slug:** `six_nations`
- **Teams:** 6 (England, France, Ireland, Italy, Scotland, Wales)
- **Season:** February - March
- **Format:** Annual international tournament

## Planned Competitions (Coming Soon)

These competitions are planned but not selectable yet in current CLI commands:

- Women's Six Nations
- Rugby Championship
- Currie Cup
- NPC
- MLR
- Rugby World Cup

## Usage

Use league slugs in commands:

```bash
# View Top 14 fixtures
rugbyclaw fixtures top14

# Recent Champions Cup results
rugbyclaw results champions_cup

# Six Nations fixtures
rugbyclaw fixtures six_nations
```

## Adding Leagues to Config

During `rugbyclaw config`, you can select which leagues to follow. Only selected leagues appear in:
- `rugbyclaw scores`
- `rugbyclaw fixtures` (without league argument)
- `rugbyclaw results` (without league argument)

## Notes

- All times shown in your configured timezone
- Data powered by API-Sports Rugby API
- Coverage: Rugby Union only (no Rugby League)
- If a competition is not listed in supported sections above, treat it as not available yet

---
*Last updated: 2026-02-20*

# Rugbyclaw

Rugby scores, fixtures, and results CLI tool.

## Architecture

- **CLI-first** — Standalone Node.js/TypeScript tool
- **OpenClaw skill layer** — Wraps CLI for natural language (in `skill/`)
- **SWR caching** — `~/.cache/rugbyclaw/` with SHA-256 hashed filenames

## Commands

```bash
rugbyclaw config              # Setup wizard
rugbyclaw scores              # Today's matches
rugbyclaw fixtures [league]   # Upcoming (--ics, --show-ids)
rugbyclaw results [league]    # Recent results
rugbyclaw team search <query> # Find teams
rugbyclaw team next <name>    # Next match (--ics)
rugbyclaw team last <name>    # Last result
rugbyclaw calendar <matchId>  # Export to .ics
rugbyclaw notify              # Notifications (--weekly, --daily, --live)
```

## Configuration

- Config: `~/.config/rugbyclaw/config.json`
- Secrets: `~/.config/rugbyclaw/secrets.json`
- State: `~/.config/rugbyclaw/state.json`
- Cache: `~/.cache/rugbyclaw/`

## Supported League IDs

| League | ID | Slug |
|--------|-----|------|
| French Top 14 | 4430 | top14 |
| English Premiership | 4414 | premiership |
| United Rugby Championship | 4446 | urc |
| Pro D2 | 5172 | pro_d2 |
| Champions Cup | 4550 | champions_cup |
| Challenge Cup | 5418 | challenge_cup |
| Six Nations | 4714 | six_nations |
| Rugby Championship | 4986 | rugby_championship |
| Super Rugby Pacific | 4551 | super_rugby |
| Currie Cup | 5069 | currie_cup |
| NPC (Bunnings) | 5278 | npc |
| Major League Rugby | 5070 | mlr |
| Rugby World Cup | 4574 | rugby_world_cup |
| Women's Six Nations | 5563 | womens_six_nations |

## Known Issues & Fixes

### Cache key collision (fixed)
- **Problem:** Truncated base64 caused different leagues to share cache files
- **Fix:** Use SHA-256 hash in `src/lib/cache.ts:keyToFilename()`

### Team next/last "not found" (fixed)
- **Problem:** Search results didn't match fixture team IDs
- **Fix:** Check if search results appear in league fixtures before using

### Wrong league IDs (fixed)
- URC was 4654 (Mexican football) → 4446
- Premiership was 4413 (WEC motorsport) → 4414
- Super Rugby was 4717 → 4551
- Rugby Championship was 4421 → 4986

## Development

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run tests
```

## GitHub

Repository: https://github.com/pocarles/rugbyclaw

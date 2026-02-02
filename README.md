# Rugbyclaw 🏉

A CLI tool for rugby scores, fixtures, and results powered by [API-Sports Rugby API](https://api-sports.io).

Clean architecture, reliable data, Rugby Union focus.

## Features

- **Live scores** — Today's matches across your favorite leagues
- **Fixtures** — Upcoming matches with dates and times
- **Results** — Recent results with personality-driven summaries
- **Team tracking** — Follow specific teams across competitions
- **Calendar export** — Add matches to your calendar (ICS format)

## Documentation

📖 **[Full Documentation](./docs/)** - Command reference, guides, and troubleshooting

- [Getting Started](./docs/getting-started.md) - Install and configure in 5 minutes
- [Commands Reference](./docs/commands/) - Detailed command documentation
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## Installation

```bash
npm install -g rugbyclaw
```

## Quick Start

```bash
# Configure your preferences
rugbyclaw config

# Check today's scores
rugbyclaw scores

# Upcoming Top 14 fixtures
rugbyclaw fixtures top14

# Toulouse's next match
rugbyclaw team toulouse next

# Recent Champions Cup results
rugbyclaw results champions_cup
```

## Setup

Run `rugbyclaw config` to configure your preferences:
- Enter your API-Sports Rugby API key (get yours at [api-sports.io](https://api-sports.io))
- Select favorite leagues
- Search and add favorite teams
- Set your timezone

API key is stored securely in `~/.config/rugbyclaw/secrets.json` (mode 600).

## Commands

### `rugbyclaw config`

Interactive setup wizard:
- Enter your API-Sports Rugby API key
- Select favorite leagues
- Search and add favorite teams
- Set your timezone

### `rugbyclaw scores`

Show today's matches across your favorite leagues.

```bash
rugbyclaw scores
rugbyclaw scores --json  # JSON output for scripts
```

### `rugbyclaw fixtures [league]`

List upcoming matches.

```bash
rugbyclaw fixtures              # All favorites
rugbyclaw fixtures top14        # Specific league
rugbyclaw fixtures -n 10        # Limit to 10 matches
```

### `rugbyclaw results [league]`

Show recent results with personality-driven summaries.

```bash
rugbyclaw results
rugbyclaw results premiership
```

### `rugbyclaw team <name> <action>`

Query a specific team.

```bash
rugbyclaw team toulouse next    # Next match
rugbyclaw team toulouse last    # Last result
rugbyclaw team search racing    # Find team ID
```

### `rugbyclaw calendar <match_id>`

Export a match to ICS calendar format.

```bash
rugbyclaw calendar 123456 --stdout > match.ics
rugbyclaw calendar 123456 --out ~/Desktop/match.ics
```

### `rugbyclaw notify`

_Planned for future release._ Live score alerts and proactive notifications will be added in a future update.

## Supported Leagues

**8 competitions covered:**

### Club Competitions (5)
| Slug | League |
|------|--------|
| `top14` | Top 14 (France) |
| `premiership` | Premiership Rugby (England) |
| `urc` | United Rugby Championship (Multi-nation) |
| `pro_d2` | Pro D2 (France) |
| `super_rugby` | Super Rugby Pacific (Southern Hemisphere) |

### European Cups (2)
| Slug | League |
|------|--------|
| `champions_cup` | European Rugby Champions Cup |
| `challenge_cup` | European Rugby Challenge Cup |

### International (1)
| Slug | League |
|------|--------|
| `six_nations` | Six Nations |

## OpenClaw Integration

Rugbyclaw includes an [OpenClaw](https://openclaw.ai) skill for AI-powered natural language queries and proactive notifications.

See [skill/SKILL.md](skill/SKILL.md) for integration details.

## JSON Output

All commands support `--json` for machine-readable output:

```bash
rugbyclaw scores --json | jq '.matches[0]'
```

## Configuration Files

- `~/.config/rugbyclaw/config.json` — User preferences (leagues, teams, timezone)
- `~/.config/rugbyclaw/secrets.json` — API key (mode 600)
- `~/.cache/rugbyclaw/` — Response cache (SWR caching for performance)

## Technical Details

- **Data Provider:** API-Sports Rugby API (sole provider)
- **Architecture:** TypeScript, ES modules, Commander.js CLI
- **Caching:** SWR (stale-while-revalidate) for performance
- **Season Detection:** Smart season detection per competition type
- **Focus:** Rugby Union only

## License

MIT

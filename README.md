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
# Beginner setup (recommended)
rugbyclaw start

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

Run `rugbyclaw start` for the fastest setup:
- No API key required (free mode)
- Uses recommended leagues automatically
- Skips optional team picking
- Confirms timezone from a menu

Need full control? Run `rugbyclaw config --guided`.

`rugbyclaw config` also supports advanced setup:
- No API key required (free mode uses a proxy with limits)
- (Optional) add your API-Sports Rugby API key (get yours at [api-sports.io](https://api-sports.io))
- Select favorite leagues (free mode is limited to default leagues)
- (Optional) pick favorite teams
- Set your timezone (IANA name like `America/New_York`)

Tip (automation/agents): override timezone per command:

```bash
rugbyclaw --tz America/New_York fixtures
```

API key is stored securely in `~/.config/rugbyclaw/secrets.json` (mode 600).

## Commands

### `rugbyclaw start`

Beginner-first setup wizard:
- Quick mode by default (few prompts)
- Use `--guided` for full customization

```bash
rugbyclaw start
rugbyclaw start --guided
# non-interactive (for agents/OpenClaw)
rugbyclaw start --yes --tz America/New_York --mode proxy
```

### `rugbyclaw config`

Interactive setup wizard:
- Choose free mode (default) or add an API key (optional)
- Select favorite leagues
- (Optional) add favorite teams
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

Generate notifications for cron/OpenClaw integration.

```bash
rugbyclaw notify --weekly   # Weekly digest
rugbyclaw notify --daily    # Day/hour reminders
rugbyclaw notify --live     # Live score updates
```

### `rugbyclaw status`

Show current mode (free vs API key), timezone, and effective leagues.

```bash
rugbyclaw status
rugbyclaw status --json
```

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

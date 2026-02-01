# Rugbyclaw 🏉

A CLI tool for rugby scores, fixtures, and results — with optional OpenClaw integration for AI-powered notifications.

## Features

- **Live scores** — Today's matches across your favorite leagues
- **Fixtures** — Upcoming matches with dates and times
- **Results** — Recent results with personality-driven summaries
- **Team tracking** — Follow specific teams across competitions
- **Calendar export** — Add matches to your calendar (ICS format)
- **Proactive notifications** — Weekly digest, day-before, hour-before, and live score alerts

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

## API Key

Rugbyclaw uses [TheSportsDB](https://www.thesportsdb.com/api.php) for data.

- **Free tier**: Use API key `123` for testing (30 req/min, limited features)
- **Premium**: $9/month for higher limits and live scores

The `rugbyclaw config` wizard will guide you through setup.

## Commands

### `rugbyclaw config`

Interactive setup wizard:
- Enter your API key
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

Generate notifications for cron/OpenClaw integration.

```bash
rugbyclaw notify --weekly   # Monday digest
rugbyclaw notify --daily    # Day/hour reminders
rugbyclaw notify --live     # Live score updates
```

## Supported Leagues

| Slug | League |
|------|--------|
| `top14` | French Top 14 |
| `premiership` | English Premiership |
| `urc` | United Rugby Championship |
| `champions_cup` | Champions Cup |
| `six_nations` | Six Nations |
| `pro_d2` | Pro D2 |
| `super_rugby` | Super Rugby Pacific |
| `rugby_championship` | The Rugby Championship |

## OpenClaw Integration

Rugbyclaw includes an [OpenClaw](https://openclaw.ai) skill for AI-powered natural language queries and proactive notifications.

See [skill/SKILL.md](skill/SKILL.md) for integration details.

## JSON Output

All commands support `--json` for machine-readable output:

```bash
rugbyclaw scores --json | jq '.matches[0]'
```

## Configuration Files

- `~/.config/rugbyclaw/config.json` — User preferences
- `~/.config/rugbyclaw/secrets.json` — API key (mode 600)
- `~/.config/rugbyclaw/state.json` — Notification state
- `~/.cache/rugbyclaw/` — Response cache

## License

MIT

---
title: rugbyclaw market-pulse
description: Polymarket implied probabilities for a rugby match
category: commands
tags: [market-pulse, polymarket, probabilities]
updated: 2026-02-24
---

# rugbyclaw market-pulse

> Fetch Polymarket implied probabilities for a given game (read-only, quality-gated).

## Usage

```bash
rugbyclaw market-pulse [options]
```

## Options

| Option | Description | Required |
|--------|-------------|----------|
| `--match-id <id>` | API-Sports match ID to resolve teams | one of `--match-id` or `--home/--away` |
| `--home <team>` | Home team name | yes (when not using `--match-id`) |
| `--away <team>` | Away team name | yes (when not using `--match-id`) |
| `--league <slug>` | Optional league hint (slug or name) | no |
| `--date <YYYY-MM-DD>` | Optional date hint | no |
| `--include-low-confidence` | Emit low-confidence markets (otherwise suppressed) | no |
| `--json` | Output as JSON | no |
| `--agent` | Strict one-line envelope for automation | no |
| `--quiet` | Minimal terminal output | no |

## Examples

### Resolve by match ID

```bash
rugbyclaw market-pulse --match-id 991
```

### Resolve by team names

```bash
rugbyclaw market-pulse --home Toulouse --away Bordeaux
```

### Structured output

```bash
rugbyclaw market-pulse --home Toulouse --away Bordeaux --json
```

### Inspect gated markets

```bash
rugbyclaw market-pulse --home Toulouse --away Bordeaux --include-low-confidence
```

## Confidence & quality gates

Market Pulse is read-only and applies several guardrails before emitting probabilities:

- Freshness check (`updated_at` within ~8 hours)
- Minimum liquidity and 24h volume
- Bid/ask spread ceiling
- Complete 3-way market required (home / draw / away with deterministic ordering)

The command emits `confidence: high|medium|low`. Low-confidence markets are suppressed unless you pass `--include-low-confidence`.

## Output

- Terminal view: probabilities for home / draw / away, liquidity, 24h volume, spread, and confidence label.
- JSON / Agent: machine-readable contract with `match`, `market_name`, `outcomes`, `confidence`, `liquidity`, `volume_24h`, `spread`, `updated_at`, and optional `quality_warnings`.

---
*Last updated: 2026-02-24*

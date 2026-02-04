---
name: rugbyclaw
description: Follow rugby scores, fixtures, and results. Get live updates for your favorite teams.
---

# Rugbyclaw

Rugby scores, fixtures, and results for OpenClaw.

## Prerequisites

Install the rugbyclaw CLI:

```bash
npm install -g rugbyclaw
```

No API key is required (free mode uses a proxy with limits).

Optional but recommended setup:

```bash
rugbyclaw config
rugbyclaw status --json
```

The config wizard can:
1. Keep you on free mode (default) or let you add an API key (optional)
2. Let you select favorite leagues (free mode is limited to default leagues)
3. Optionally pick favorite teams
4. Set your timezone

## Commands

Use these CLI commands with `--json` for structured output:

| User Query | Command |
|------------|---------|
| "Rugby scores" / "What's happening in rugby?" | `rugbyclaw scores --json` |
| "Top 14 fixtures" / "Upcoming matches" | `rugbyclaw fixtures [league] --json` |
| "Recent results" / "Who won?" | `rugbyclaw results [league] --json` |
| "Toulouse next match" / "When do they play?" | `rugbyclaw team <name> next --json` |
| "How did Toulouse do?" / "Last result" | `rugbyclaw team <name> last --json` |
| "Find team Racing" | `rugbyclaw team search <query> --json` |

### League Slugs

- `top14` — French Top 14
- `premiership` — English Premiership
- `urc` — United Rugby Championship
- `champions_cup` — Champions Cup
- `six_nations` — Six Nations
- `super_rugby` — Super Rugby Pacific
- `rugby_championship` — The Rugby Championship

## Response Style

When presenting match results, use the personality-driven summaries from the JSON output.

Keep responses casual and fun:
- For wins: "Toulouse demolished Racing 38-12. Absolute clinic."
- For close matches: "Heart attack rugby. Toulouse takes it 24-22."
- For losses: "Ugh. So close. Toulouse falls 18-21."

Use emoji sparingly (🏉 for scores, 🔥 for big wins).

## Proactive Notifications

The skill supports proactive notifications via cron:

```bash
# Weekly digest (Monday 9am)
rugbyclaw notify --weekly --json

# Day-before and hour-before reminders
rugbyclaw notify --daily --json

# Live score updates (poll during match windows)
rugbyclaw notify --live --json
```

Each returns a JSON array of notifications to send to the user.

## Calendar Export

To add a match to calendar:

```bash
rugbyclaw calendar <match_id> --stdout
```

This outputs an .ics file the user can import into any calendar app.

## Error Handling

If commands fail, the JSON output includes an `error` field. Common issues:
- "Rate limit exceeded" — Wait a bit, or add an API key for higher limits
- "No matches found" — Check league slug or try different search

## Agent Setup Checklist

If you're unsure how Rugbyclaw is configured, run:

```bash
rugbyclaw status --json
```

Then:
- If `mode` is `proxy`, stick to default leagues and keep calls minimal.
- Prefer `scores --json`, `fixtures --json`, `results --json`, `team ... --json` for structured output.
- Team search is scoped to Rugby Union teams in `effective_leagues` (to avoid irrelevant matches).

## Examples

**User:** "Rugby scores"
**Agent:** Runs `rugbyclaw scores --json`, presents today's matches

**User:** "When does Toulouse play next?"
**Agent:** Runs `rugbyclaw team toulouse next --json`, presents next fixture

**User:** "How did Racing do?"
**Agent:** Runs `rugbyclaw team racing last --json`, presents result with personality summary

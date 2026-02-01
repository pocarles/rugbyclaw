---
name: rugbyclaw
description: Follow rugby scores, fixtures, and results. Get live updates for your favorite teams.
---

# Rugbyclaw

Rugby scores, fixtures, and results for OpenClaw.

## Prerequisites

Install and configure the rugbyclaw CLI:

```bash
npm install -g rugbyclaw
rugbyclaw config
```

The config wizard will:
1. Ask for your TheSportsDB API key (free at thesportsdb.com, use "123" for testing)
2. Let you select favorite leagues (Top 14, Premiership, URC, Champions Cup, etc.)
3. Let you search and add favorite teams
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
- "Not configured" — User needs to run `rugbyclaw config`
- "Rate limit exceeded" — Wait a minute, or upgrade API key
- "No matches found" — Check league slug or try different search

## Examples

**User:** "Rugby scores"
**Agent:** Runs `rugbyclaw scores --json`, presents today's matches

**User:** "When does Toulouse play next?"
**Agent:** Runs `rugbyclaw team toulouse next --json`, presents next fixture

**User:** "How did Racing do?"
**Agent:** Runs `rugbyclaw team racing last --json`, presents result with personality summary

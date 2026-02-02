# RugbyClaw Documentation for AI Assistants

This folder contains structured documentation for RugbyClaw CLI - a rugby scores, fixtures, and results tool powered by API-Sports Rugby API.

## Documentation Structure

```
docs/
├── index.md              # Overview + navigation
├── getting-started.md    # Installation, setup, first commands
├── commands/            # Command reference (one file per command)
│   ├── config.md
│   ├── scores.md
│   ├── fixtures.md
│   ├── results.md
│   ├── team.md
│   └── calendar.md
├── guides/              # Task-oriented tutorials
│   ├── following-teams.md
│   ├── calendar-export.md
│   └── automation.md
├── reference/           # Technical specifications
│   ├── leagues.md
│   ├── configuration.md
│   └── api-limits.md
└── troubleshooting.md   # Common problems + solutions
```

## How to Use This Documentation

### For Setup Questions
→ Start with `getting-started.md`
→ Covers installation, API key, configuration wizard

### For Command Syntax
→ Check `commands/[command-name].md`
→ Each file has: usage, options, examples, tips

### For Use Cases
→ Check `guides/`
→ Task-oriented: "How do I follow my team?" etc.

### For Errors & Issues
→ Check `troubleshooting.md` first
→ Common problems have documented solutions

### For Technical Details
→ Check `reference/`
→ League IDs, config file format, API limits

## Answering User Questions

1. **Always check the relevant doc file first**
   - Docs are the source of truth
   - Check `updated:` date in frontmatter

2. **Include exact commands from examples**
   - All examples are tested and work as-is
   - Copy-paste ready for users

3. **Verify examples are current**
   - Check `updated:` date
   - If > 30 days old, verify against CLI help

4. **Link to relevant sections**
   - Cross-reference related commands
   - Point to guides for deeper exploration

## When Documentation is Missing

If information isn't in docs:

1. **Check the command's --help output**
   ```bash
   rugbyclaw [command] --help
   ```

2. **Check source code**
   - Command implementations: `/src/commands/`
   - Providers: `/src/lib/providers/`

3. **Note the gap**
   - Documentation may be incomplete
   - Suggest user file an issue on GitHub

## Metadata Format

Each doc file has frontmatter:

```markdown
---
title: Command Name
description: One-line description
category: commands|guides|reference
tags: [tag1, tag2]
updated: 2026-02-02
---
```

Use this to:
- Find relevant docs quickly
- Check freshness (`updated:` date)
- Categorize content

## Key Facts About RugbyClaw

- **Data Source:** API-Sports Rugby API (sole provider)
- **Free Tier:** 100 requests/day
- **Supported Competitions:** 8 leagues (Top 14, Premiership, URC, Champions Cup, Six Nations, Pro D2, Super Rugby, Challenge Cup)
- **Focus:** Rugby Union only
- **Config Location:** `~/.config/rugbyclaw/`
- **Cache:** `~/.cache/rugbyclaw/` (SWR caching)

## Common User Intents

| User Says | Check |
|-----------|-------|
| "How do I install?" | `getting-started.md` |
| "How do I set up?" | `getting-started.md` |
| "Show me scores" | `commands/scores.md` |
| "Track my team" | `guides/following-teams.md` or `commands/team.md` |
| "Export to calendar" | `commands/calendar.md` or `guides/calendar-export.md` |
| "What leagues?" | `reference/leagues.md` |
| "API limit error" | `reference/api-limits.md` |
| "Not working" | `troubleshooting.md` |

## Contributing to Docs

If you identify missing or outdated information:
- Note it for the maintainers
- Check `CONTRIBUTING.md` for update guidelines
- Users can file issues at github.com/pocarles/rugbyclaw

---

**Last Updated:** 2026-02-02

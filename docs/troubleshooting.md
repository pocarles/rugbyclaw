---
title: Troubleshooting
description: Common problems and solutions
category: troubleshooting
tags: [errors, problems, help]
updated: 2026-02-19
---

# Troubleshooting

> Common problems and solutions

## Installation Issues

### "command not found: rugbyclaw"

**Problem:** RugbyClaw not in PATH after `npm install -g`

**Solution:**
```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH in ~/.bashrc or ~/.zshrc
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

### npm install fails

**Problem:** Permission errors during global install

**Solution:**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g rugbyclaw

# Option 2: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g rugbyclaw
```

## Configuration Issues

### Setup confusion (mode/timezone/leagues)

If you're not sure what RugbyClaw is using (free mode vs API key), run:

```bash
rugbyclaw status
rugbyclaw status --json
rugbyclaw doctor
```

### "Invalid API key" error

**Problem:** API key incorrect or expired

**Solution:**
1. Get new key from [api-sports.io](https://api-sports.io)
2. Run `rugbyclaw config` again
3. Enter the new key

### Can't find config file

**Location:** `~/.config/rugbyclaw/config.json`

**To reset:**
```bash
rm ~/.config/rugbyclaw/config.json
rugbyclaw config
```

## API Errors

### "Rate limit exceeded"

**Problem:** Exceeded free mode proxy limits

**Solutions:**
- Wait until tomorrow (resets daily)
- Upgrade to paid plan at api-sports.io
- Use `--json` + cache results locally

### "API returned 404"

**Problem:** League or match not found

**Solution:**
- Check league slug is correct: [Supported Leagues](./reference/leagues.md)
- Verify match ID if using calendar export
- Some leagues may be off-season

### Connection timeout

**Problem:** Network issues or API down

**Solution:**
- Check internet connection
- Check API-Sports status: https://api-sports.io
- Try again in a few minutes

## Team Commands

### "No team found"

**Problem:** Team name not matching

**Solutions:**
1. **Try `team search` first:**
   ```bash
   rugbyclaw team search toulouse
   ```

2. **Use partial names:**
   - ✅ `toulouse` (works)
   - ❌ `Stade Toulousain Rugby Club` (too specific)

3. **Check spelling**

4. **Use team ID:**
   ```bash
   rugbyclaw team next 107
   ```

### Wrong team showing up

**Problem:** Multiple teams match query

**Solution:**
- Be more specific: `"toulouse"` → `"stade toulousain"`
- Use team ID from search results
- Put name in quotes if it has spaces

## Display Issues

### Colors not showing

**Problem:** Terminal doesn't support colors

**Solution:**
```bash
# Disable colors
rugbyclaw scores --no-color
```

### Times in wrong timezone

**Problem:** Timezone not configured correctly (or you're running on a server/agent with a different timezone)

**Solution:**
```bash
# Check what timezone Rugbyclaw is using
rugbyclaw status

# Set your preferred timezone (saved)
rugbyclaw config
# Select correct timezone in wizard

# Or override for one command (useful for automation/agents)
rugbyclaw --tz America/New_York fixtures
```

### "No matches today"

**Problem:** `rugbyclaw scores` returns no matches and you want to know why.

**Solution:**
```bash
rugbyclaw scores --explain
rugbyclaw doctor
```

`--explain` prints timezone/date/leagues context for the query.  
`doctor` adds per-league API result counts for today.

### Fixtures show "Coming Soon"

**Problem:** API-Sports sometimes publishes placeholder kickoff date/time values for upcoming fixtures until closer to match day.

**Solution:**
- Wait for API-Sports to update the official kickoff details
- RugbyClaw shows `Coming Soon` to avoid displaying incorrect kickoff date/time
- In JSON output, look for `time_confidence: "pending"` (`time_tbd: true`)
- If you have trusted times, add a manual override in `~/.config/rugbyclaw/kickoff-overrides.json`

## Developer / Proxy Issues

### Free mode fails (proxy unavailable)

If you're developing RugbyClaw and free mode calls fail, the proxy Worker may not be deployed.

- Deploy instructions: `worker/README.md`
- For local dev: set `RUGBYCLAW_PROXY_URL` to your `wrangler dev` URL

## Cache Issues

### Old data showing

**Problem:** Cached responses not refreshing

**Solution:**
```bash
# Clear cache
rm -rf ~/.cache/rugbyclaw/

# Next command will fetch fresh data
rugbyclaw scores
```

## Still Having Issues?

1. **Check recent changes:**
   - [GitHub Issues](https://github.com/pocarles/rugbyclaw/issues)
   - [Recent Releases](https://github.com/pocarles/rugbyclaw/releases)

2. **File a bug report:**
   - Go to [GitHub Issues](https://github.com/pocarles/rugbyclaw/issues/new)
   - Include:
     - Command you ran
     - Error message
     - Your OS
     - RugbyClaw version (`rugbyclaw --version` or `rugbyclaw version`)

3. **Check API-Sports status:**
   - https://api-sports.io
   - Their API might be having issues

---
*Last updated: 2026-02-19*

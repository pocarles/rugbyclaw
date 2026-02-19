---
title: Configuration Files
description: Where Rugbyclaw stores preferences and state
category: reference
tags: [config, files, paths]
updated: 2026-02-19
---

# Configuration Files

Rugbyclaw stores user data under:

- `~/.config/rugbyclaw/`
- `~/.cache/rugbyclaw/`

## Custom config path

For testing (or when running as an OpenClaw skill), you can override where Rugbyclaw reads/writes config files:

```bash
# Use a custom directory (writes config.json/secrets.json/state.json inside it)
rugbyclaw --config ./my-rugbyclaw-config status --json

# Use a specific config.json path (secrets/state stored next to it)
rugbyclaw --config ./examples/config.json fixtures top14
```

## Custom timezone

If your machine/server timezone is different from what you want (common for automation/agents), you can override the timezone at runtime:

```bash
rugbyclaw --tz America/New_York fixtures
```

Timezone values must be valid IANA names (examples: `America/New_York`, `Europe/Paris`).

## Environment overrides

Use env vars for CI/automation when needed:

- `RUGBYCLAW_PROXY_URL` — override the default proxy base URL
- `RUGBYCLAW_HTTP_TIMEOUT_MS` — HTTP timeout in milliseconds (default: `10000`)
- `RUGBYCLAW_HTTP_RETRIES` — transient retry count for upstream 5xx/network failures (default: `1`)

## `config.json`

Preferences (timezone, leagues, teams).

## `secrets.json`

API key (if provided). Written with file mode `600`.

## `state.json`

Notification state used by `rugbyclaw notify` to dedupe messages.

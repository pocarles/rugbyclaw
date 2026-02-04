---
title: Configuration Files
description: Where Rugbyclaw stores preferences and state
category: reference
tags: [config, files, paths]
updated: 2026-02-04
---

# Configuration Files

Rugbyclaw stores user data under:

- `~/.config/rugbyclaw/`
- `~/.cache/rugbyclaw/`

## `config.json`

Preferences (timezone, leagues, teams).

## `secrets.json`

API key (if provided). Written with file mode `600`.

## `state.json`

Notification state used by `rugbyclaw notify` to dedupe messages.


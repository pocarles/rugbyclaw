---
title: rugbyclaw notify
description: Generate notification payloads for cron/OpenClaw
category: commands
tags: [notify, automation, openclaw]
updated: 2026-02-04
---

# rugbyclaw notify

> Generate notifications for cron/OpenClaw integration

## Usage

```bash
rugbyclaw notify [--weekly|--daily|--live] [--json]
```

## Modes

- `--weekly`: weekly digest of upcoming matches
- `--daily`: day-before and hour-before reminders
- `--live`: live score updates (polling)

## Output

Use `--json` to get structured output:

```bash
rugbyclaw notify --live --json
```

Returns:

- `notifications[]` with `type`, `message`, and optional `match` payload


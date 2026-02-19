---
title: Automation
description: Using Rugbyclaw with cron/OpenClaw
category: guides
tags: [automation, cron, openclaw]
updated: 2026-02-18
---

# Automation

Use `--json` to integrate with agents or scripts.

## Recommended Baseline

```bash
# Always start by checking mode + effective leagues
rugbyclaw status --json

# When debugging flaky data, check proxy/API connectivity
rugbyclaw doctor --json
```

## Notify (Cron / Agent Polling)

```bash
rugbyclaw notify --weekly --json
rugbyclaw notify --daily --json
rugbyclaw notify --live --json
```

## JSON Contract

- When `--json` is set, commands should only print JSON (no extra human text).
- Errors are printed as JSON with an `error` field and a non-zero exit code.

## Timezone For Determinism

On servers/agents, don’t assume local timezone. Override per command:

```bash
rugbyclaw --tz America/New_York fixtures --json
```

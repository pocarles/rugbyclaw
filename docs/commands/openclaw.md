---
title: OpenClaw
description: Emit OpenClaw bootstrap and health-check instructions
category: commands
tags: [openclaw, automation, json]
updated: 2026-02-19
---

# `rugbyclaw openclaw init`

Emit copy/paste-safe setup for OpenClaw agents.

## Usage

```bash
rugbyclaw openclaw init
rugbyclaw openclaw init --json
rugbyclaw openclaw init --agent
```

## Output

- Install commands (`npm install -g ...`, `npx ...`)
- Bootstrap command order (`start`, `status`, `doctor`)
- Health check commands
- Command map for scores/fixtures/results/team/notify

## Automation Tip

Use `--agent` for strict one-line envelopes:

```bash
rugbyclaw openclaw init --agent
```

Envelope fields are always:
- `ok`
- `exit_code`
- `error_type`
- `data`
- `trace_id`

---
title: Automation
description: Using Rugbyclaw with cron/OpenClaw
category: guides
tags: [automation, cron, openclaw]
updated: 2026-02-19
---

# Automation

Use `--json` to integrate with agents or scripts:

```bash
rugbyclaw notify --weekly --json
rugbyclaw notify --daily --json
rugbyclaw notify --live --json
```

For fixture data, check kickoff reliability with:
- `time_confidence: "exact"` when kickoff is reliable
- `time_confidence: "pending"` (and `time_tbd: true`) when the provider still has placeholder kickoff data

Treat `time_confidence: "pending"` as unfinalized kickoff info (date/time may shift).

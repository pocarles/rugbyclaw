---
title: rugbyclaw status
description: Show current mode, timezone, and effective leagues
category: commands
tags: [status, config, setup]
updated: 2026-02-04
---

# rugbyclaw status

> Show current mode, timezone, and effective leagues

## Usage

```bash
rugbyclaw status [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output as JSON | false |
| `--quiet` | Minimal output | false |

## Examples

```bash
rugbyclaw status
rugbyclaw status --json
```

## Notes

- In free mode (no API key), Rugbyclaw uses a proxy with limits and default leagues only.
- This command is useful for OpenClaw/automation to understand the current setup.


---
title: rugbyclaw doctor
description: Diagnose proxy, API, and configuration issues
category: commands
tags: [doctor, troubleshooting, status]
updated: 2026-02-05
---

# rugbyclaw doctor

> Diagnose proxy, API, and configuration issues

## Usage

```bash
rugbyclaw doctor [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--json` | Output as JSON | false |
| `--quiet` | Minimal output | false |

## Examples

```bash
rugbyclaw doctor
rugbyclaw doctor --json
```

## Notes

- In free mode, Rugbyclaw depends on the proxy Worker. `doctor` checks if it is reachable.
- If you have an API key configured, `doctor` also checks direct API-Sports connectivity.


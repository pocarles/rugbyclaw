# AI & Agent-Friendly Docs

RugbyClaw is designed to be usable by humans and personal AI agents (OpenClaw, scripts, automations).

## Runtime Output Contracts

- Use `--json` for structured output.
- Use `--agent` for strict one-line envelopes:
  - `ok`
  - `exit_code`
  - `error_type`
  - `data`
  - `trace_id`

Example:

```bash
rugbyclaw doctor --agent
rugbyclaw scores --json
```

## Stable Machine-Readable Docs

These are the canonical agent entry points:

- Website LLM index: `https://rugbyclaw.com/llms.txt`
- Full agent context: `https://rugbyclaw.com/llms-full.txt`
- JSON capability manifest: `https://rugbyclaw.com/docs/agent.json`
- Docs update feed (RSS): `https://rugbyclaw.com/docs/updates.xml`

## Change Tracking Feeds

- GitHub releases feed (Atom): `https://github.com/pocarles/rugbyclaw/releases.atom`
- GitHub commits feed (Atom): `https://github.com/pocarles/rugbyclaw/commits/main.atom`

Use releases for behavior changes and commits for implementation-level changes.

## Best-Practice Notes

- Changelog format follows Keep a Changelog.
- Versioning follows SemVer.
- Agent docs prioritize:
  - stable URLs
  - machine-readable formats (JSON/RSS/llms.txt)
  - explicit command contracts

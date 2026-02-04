# Rugbyclaw Proxy Worker

This Cloudflare Worker powers Rugbyclaw **free mode** (no API key required) by proxying requests to the API-Sports Rugby API with strict limits.

## Prerequisites

- Cloudflare account
- `wrangler` (already in `worker/package.json`)
- An API-Sports Rugby API key

## Setup

From the repo root:

```bash
npm --prefix worker install
```

Create a KV namespace for rate limiting:

```bash
npx --prefix worker wrangler kv:namespace create RATE_LIMITS
```

Copy the generated KV namespace id into `worker/wrangler.toml` under:

```toml
[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "..."
```

Set the API key secret (stored in Cloudflare, not in git):

```bash
npx --prefix worker wrangler secret put API_SPORTS_KEY
```

Deploy:

```bash
npx --prefix worker wrangler deploy
```

## Local dev

```bash
npx --prefix worker wrangler dev
```

To point the CLI at a custom proxy URL during development:

```bash
RUGBYCLAW_PROXY_URL="http://127.0.0.1:8787" rugbyclaw scores
```

## Free mode limits

Configured in `worker/wrangler.toml`:

- `RATE_LIMIT_PER_DAY` (default: 50/day per IP)
- `RATE_LIMIT_PER_MINUTE` (default: 10/min per IP)
- `DEFAULT_LEAGUES` (default leagues allowed in free mode)


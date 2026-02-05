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

## GitHub Actions deploy (recommended)

This repo includes a workflow that can deploy the proxy Worker on pushes to `main` (and via manual dispatch).

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN` — API token with **Workers Scripts:Edit** and (optionally) **Workers KV Storage:Edit**
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account id
- `API_SPORTS_KEY` — your API-Sports Rugby API key (stored as a Worker secret)

Optional GitHub secrets:

- `CF_KV_RATE_LIMITS_ID` — KV namespace id for the `RATE_LIMITS` binding
  - If omitted, the workflow will create (or reuse) a KV namespace titled `rugbyclaw-rate-limits`.
  - If your API token does **not** have KV permissions, set this secret to skip KV namespace creation in CI.

Once those are set, go to GitHub → Actions → **Deploy Proxy Worker**.

If your deployed Worker URL does not resolve (e.g. `*.workers.dev` DNS errors), enable **Workers.dev** for your Cloudflare account (Workers & Pages → Overview), or bind the Worker to a custom domain.

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

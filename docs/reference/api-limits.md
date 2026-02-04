---
title: API Limits
description: Free mode proxy limits and best practices
category: reference
tags: [limits, rate-limit, proxy]
updated: 2026-02-04
---

# API Limits

## Free mode (no API key)

Rugbyclaw uses a shared proxy with strict limits (per IP):

- Daily limit (default: 50/day)
- Per-minute burst limit (default: 10/min)

Repeated requests may be served from edge cache, which reduces quota consumption.

## Direct mode (API key)

Uses your API-Sports key directly. API-Sports limits depend on your plan.


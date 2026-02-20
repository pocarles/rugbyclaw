---
title: Releasing Rugbyclaw
description: How to publish a new npm version and keep website/docs in sync
category: contributing
tags: [release, npm, publishing]
updated: 2026-02-20
---

# Releasing Rugbyclaw

This project is published to npm as `rugbyclaw`.

## Requirements

- npm account with publish access to the `rugbyclaw` package
- Node.js 18+

## Release Steps (Maintainer)

1. Update your local repo:

```bash
git pull
```

2. Install dependencies cleanly and run tests:

```bash
npm ci
npm test
```

3. Bump the version (choose one):

```bash
npm version patch
# or: npm version minor
# or: npm version major
```

This creates a git commit and a tag like `v0.1.3`.

4. Publish to npm:

```bash
npm publish --access public
```

5. Push commits and tags to GitHub:

```bash
git push
git push --tags
```

6. Update the website repo (`rugbyclaw-website`) in the same pass:

- bump docs/app version markers
- update docs/changelog highlights
- verify agent endpoints:
  - `/llms.txt`
  - `/llms-full.txt`
  - `/docs/agent.json`
  - `/docs/updates.xml`

7. Verify feeds are alive:

- `https://github.com/pocarles/rugbyclaw/releases.atom`
- `https://github.com/pocarles/rugbyclaw/commits/main.atom`

## Notes

- If `npm publish` fails with auth errors, re-authenticate with `npm login` (do not paste tokens into chat).
- If you need to test a command before publishing, run from the repo:

```bash
npm run build
node dist/cli.js --version
node dist/cli.js doctor
```

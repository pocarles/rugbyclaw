#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
  git fetch --no-tags --depth=1 origin "${GITHUB_BASE_REF}"
  RANGE="origin/${GITHUB_BASE_REF}...HEAD"
elif [[ -n "${CI:-}" ]] && git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  RANGE="HEAD^...HEAD"
else
  RANGE=""
fi

if [[ -n "${RANGE}" ]]; then
  CHANGED="$(git diff --name-only "${RANGE}")"
else
  CHANGED="$(git diff --name-only HEAD)"
fi

if [[ -z "${CHANGED}" ]]; then
  exit 0
fi

CONTRACT_RELATED_REGEX='^(src/commands/|src/render/terminal\.ts|src/types/index\.ts|src/lib/(command-error|output)\.ts|src/cli\.ts|test/(json-contract|agent-flow-contract)\.test\.ts)'

if ! echo "${CHANGED}" | grep -Eq "${CONTRACT_RELATED_REGEX}"; then
  echo "No contract-related files changed."
  exit 0
fi

if echo "${CHANGED}" | grep -Eq '^(CHANGELOG\.md|package\.json)$'; then
  echo "Contract-related changes include changelog/version update. Gate passed."
  exit 0
fi

echo "Contract-related files changed without CHANGELOG.md or package.json update."
echo "Changed files:"
echo "${CHANGED}"
exit 1

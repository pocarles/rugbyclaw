# Rugbyclaw CLI Review Report

## 1) Silent failure masks upstream outages as "no matches"
- **File/line:** `src/lib/providers/apisports.ts:872`, `src/lib/providers/apisports.ts:902`
- **Severity:** high
- **What happens:** `getToday()` and `getLive()` swallow all per-league errors (`catch {}`) and continue. If all league calls fail, callers receive an empty list, which is indistinguishable from a legitimate no-match day. This creates silent data loss and incorrect user output.
- **Suggested fix:** Accumulate per-league errors and fail when all leagues fail (or expose partial-failure metadata). At minimum, emit a structured warning/error when `0 matches` is caused by request failures.

## 2) API contract bug in `notify`: default path labels output type incorrectly
- **File/line:** `src/commands/notify.ts:381`
- **Severity:** high
- **What happens:** When no flag is provided, command runs weekly + daily + live checks, but `output.type` is set to `'live'`. JSON/agent consumers get incorrect metadata.
- **Suggested fix:** Introduce an explicit type for combined mode (for example `'all'`) or emit per-source buckets. Update `NotifyOutput` type and downstream contract tests accordingly.

## 3) Cache key does not include provider mode/base URL
- **File/line:** `src/lib/providers/apisports.ts:457`, `src/lib/cache.ts:215`
- **Severity:** medium
- **What happens:** Cache key is only `endpoint + params`. Proxy-mode and direct-mode responses for same query share cache entries, causing stale/mixed data across modes and invalid cache reuse.
- **Suggested fix:** Include mode and source host (and optionally key fingerprint) in the cache key namespace.

## 4) Cache index is not concurrency-safe
- **File/line:** `src/lib/cache.ts:34-50`, `src/lib/cache.ts:100-129`, `src/lib/cache.ts:173-199`
- **Severity:** medium
- **What happens:** Multiple concurrent writers can load stale index state and overwrite each other (lost entries, wrong `total_size`, inconsistent eviction), because writes are unsynchronized.
- **Suggested fix:** Add file locking or atomic compare-and-swap strategy for index writes. Consider per-process mutex + atomic rename-based commit.

## 5) Standings draw/loss parsing assumes nested object shape
- **File/line:** `src/lib/providers/apisports.ts:629-630`
- **Severity:** medium
- **What happens:** Parser reads `row.games?.draw?.total` / `lose?.total`, but provider payloads may return numeric values (`draw: 0`). In that case draws/losses are parsed as `0` silently.
- **Suggested fix:** Accept both shapes (`number` and `{ total: number }`) with a normalization helper.

## 6) Date validation accepts impossible dates
- **File/line:** `src/commands/market-pulse.ts:37-40`
- **Severity:** medium
- **What happens:** `validateDate()` only checks `YYYY-MM-DD` regex. Values like `2026-99-99` pass and can degrade matching logic and API behavior.
- **Suggested fix:** Parse and validate actual calendar date (and round-trip check formatted result).

## 7) Potential path traversal / unsafe filename construction in team ICS export
- **File/line:** `src/commands/team.ts:401-402`
- **Severity:** high
- **What happens:** Filename is built from upstream team names with only whitespace replacement. If names contain `/`, `..`, or other path separators, command can write unexpected paths.
- **Suggested fix:** Strictly sanitize to a safe filename character set (for example `[a-z0-9-]`), collapse others, and enforce basename-only output.

## 8) Terminal control-sequence injection risk from upstream strings
- **File/line:** `src/render/terminal.ts:127`, `src/render/terminal.ts:417`, `src/render/terminal.ts:485`
- **Severity:** medium
- **What happens:** Team/league/market names are printed raw. If upstream data includes ANSI/control sequences, output can be manipulated (spoofed lines, cursor movement, etc.).
- **Suggested fix:** Strip/escape control characters before rendering user-visible terminal output.

## 9) Config/secrets/state loaders hide corruption and permission errors
- **File/line:** `src/lib/config.ts:165-167`, `src/lib/config.ts:197-199`, `src/lib/config.ts:260-262`
- **Severity:** medium
- **What happens:** Broad `catch` returns defaults/null for any read/parse error. Invalid JSON or permission failures become silent fallback, risking unintended resets and difficult diagnosis.
- **Suggested fix:** Distinguish `ENOENT` from parse/permission errors. Surface non-ENOENT errors to caller (or at least warn in structured metadata).

## 10) Follow-up hints generate invalid CLI syntax
- **File/line:** `src/commands/fixtures.ts:193`, `src/commands/results.ts:149`
- **Severity:** low
- **What happens:** Hints output `rugbyclaw team "Name" next` instead of `rugbyclaw team next "Name"`.
- **Suggested fix:** Reorder generated command strings to match CLI contract.

## 11) Dead/unreachable personality path
- **File/line:** `src/lib/personality.ts:6`, `src/lib/personality.ts:90-95`
- **Severity:** low
- **What happens:** `ResultType` includes `nail_biter`, but `getResultType()` never returns it. This is dead branch/data not reachable at runtime.
- **Suggested fix:** Either remove `nail_biter` templates or add explicit logic to emit it.

## 12) Notification schema includes unused halftime state/type path
- **File/line:** `src/types/index.ts:79`, `src/types/index.ts:213`, `src/commands/notify.ts` (no halftime emitter)
- **Severity:** low
- **What happens:** State and type definitions include `halftime`, but live notification logic never emits it. Contract advertises behavior not implemented.
- **Suggested fix:** Implement halftime transition detection or remove halftime fields from schema/types.

## 13) Test coverage gap: smoke tests are non-behavioral
- **File/line:** `src/__tests__/smoke.test.ts:4-11`
- **Severity:** low
- **What happens:** Tests only assert `true === true` and `1 + 1 === 2`; they do not protect runtime behavior.
- **Suggested fix:** Replace with integration smoke checks of real command paths (`scores`, `fixtures`, envelope output, error paths).

## 14) Test coverage gap: no guard for `notify` contract mismatch and silent provider-failure behavior
- **File/line:** `test/` suite (missing targeted tests)
- **Severity:** medium
- **What happens:** Current tests do not assert default `notify` type semantics (weekly+daily+live) and do not fail when all-league failures are silently converted to empty results in `getToday/getLive`.
- **Suggested fix:** Add command-level tests that:
  - assert default `notify` output contract explicitly;
  - simulate all-league failures and require non-empty error signaling instead of empty-success output.

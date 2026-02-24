# Market Pulse Security Review (2026-02-24)

## Findings
- CLI inputs for market pulse accepted unbounded team/league names and match IDs, allowing oversized/unsafe queries and potential control characters to reach providers.
- Polymarket provider lacked request timeouts, search/slug length bounds, and safe URL construction, and could surface malformed outcome payloads without guarding.
- Error paths could bubble provider internals, and low-confidence suppression relied on loose truthy checks for the opt-in flag.

## Mitigations
- Added strict length and control-character validation for `--home/--away/--league` and numeric-only `--match-id`, plus combined search-length enforcement.
- Hardened Polymarket provider with safe URL building, bounded query/slug lengths, AbortController timeouts, and tolerant normalization for non-array outcome payloads.
- Sanitized provider error surfaces in the command, kept low-confidence gating explicitly opt-in, and ensured messages remain user-safe while preserving trace IDs.
- Confirmed integration remains read-only with no new write paths or dynamic execution.

## Verification
- [x] npm run lint
- [x] HOME=/root/rugbyclaw/.home npm test
- [x] HOME=/root/rugbyclaw/.home npm run build

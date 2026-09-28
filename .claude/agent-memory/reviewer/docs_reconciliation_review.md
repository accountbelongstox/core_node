---
name: docs-reconciliation-review
description: Reviewing a group lead's own doc-reconciliation and asset-generator items (codemart-lead-G1) - concurrent member landings make status rows stale, Vite inline vs "hashed names", re-dispatched verdict files
metadata:
  type: feedback
---

Lead-owned "match every open row to the code" items go stale within minutes, because members land code in parallel user commits (codemart-lead-G1: U30 "missing" at 2f31f9cd3, but cmgap-U30 landed at 7a23f57d0 two minutes later; "D9-01 not landed", but it landed in the same commit as the docs).

**Why:** judging the doc against HEAD alone would wrongly fail true-at-write claims. Judging it only at write time would hide stale statuses that the next reader trusts.

**How to apply:**
- Spot-check each file:line claim at the commit that holds the doc edit. Then run `git log -- <cited file>` after that commit, and list any status change as a non-blocking follow-up. It becomes blocking only if it was already wrong at write time.
- A "versioned / bundled with hashed names" claim for small assets: check `build.assetsInlineLimit` in vite.config.ts. Vite 6 defaults to 4096 B and inlines anything smaller as a data: URI; `?no-inline` fixes it.
- A verdict file can already exist from an earlier dispatch of the same task id and round. Re-verify independently, overwrite it, and state in `head` that it supersedes the earlier file.
- Generator scripts: re-run `--help` / `--dry-run` / the error paths with `python -B`, and check the output assets with PIL (format, size, bytes) plus git ls-files/check-ignore. A scratchpad contact sheet shows weak icons.

Related: [[ui-review-patterns]], [[laravel-schema-review-checklist]].

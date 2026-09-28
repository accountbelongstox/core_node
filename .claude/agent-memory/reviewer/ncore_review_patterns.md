---
name: ncore-review-patterns
description: ncore/apps review checklist — throw-to-return conversions skipping catch cleanup, ignored boolean results, module-load validators, contract #paths literal sweeps, proxy-module caller claims
metadata:
  type: feedback
---

Recurring ncore defects (seen in ncore-G1, 2026-09-27):

- **Throw -> log+return that skips catch-side cleanup.** A `return false` added inside a `try` bypasses cleanup code that lived in the `catch` (e.g. temp-file unlink). For each converted throw, read the enclosing catch and check that its side effects still run.
- **Caller ignores the new boolean.** The owner may claim "no call site treats false as success". Grep every caller of each converted function, including in-module wrappers such as replaceImage -> resizeAndCropImage. Pre-existing ignores count too, because the item requires caller updates.
- **Module-load validators.** A `validateConfig(x)` at module level that now returns false has no caller to check it, so an invalid config is silently exported. Require an exported flag that the entry point checks.
- **Contract `#paths` "no literals" sweeps.** Owners check only the item's file or the section named in the task (drive_layout). Grep ncore/ for every paths value: `/var/_core_node` (pathtool.js), `'/www'` (globaldir.js), `'D:\\'` (downloader.js). system_paths.js exports the resolved constants.
- **Proxy-module caller claims.** `ncore/utils/db_tool/*.js` proxy to `ncore/utils/memory_db`, not to `foundation/db_utils`. Verify which module a claimed "real caller" actually reaches.
- **Widened "kept by design" throw sets.** NODE_NCORE_GUIDE.md:7 says never throw new Error. Any exemption beyond the item's stated allowance (17 RPC client rejections) needs an orchestrator ruling. Do not accept it as settled.

**Why:** The G1 conversions passed node --check but introduced or kept silent-success paths. The owner's report asserted that the checks were done.
**How to apply:** For every ncore throw sweep or contract-reader task, run the per-site catch/caller read and the ncore-wide literal grep before approving. Isolate hunks with 5bbb23682-style backup-commit parents, as in [[pycore-line-ending-gate]].

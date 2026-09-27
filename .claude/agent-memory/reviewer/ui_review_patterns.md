---
name: ui-review-patterns
description: Recurring defect and review patterns in the UI roles (codemart, vortex, wordnew, laravel-manager, pycore-manager) under poly_apps/pycore_laravel_wordnew_ui
metadata:
  type: feedback
---

UI tasks often share files with a later task of the same role (for example wordnew FU-031 edits sit in the same transport files as FU-019/FU-032; vortex OkxQuantPanel carries the FU-042 locale migration and the reveal removal). Review hunk by hunk and state in the verdict which hunks are NOT covered.

**Why:** a verdict on a file-level diff would silently approve unreviewed, sometimes not-yet-compiling work (for example MasterApiClient errors pending a RequestQueue.ts B2 assignment).

**How to apply:**
- In every UI verdict, list any out-of-task hunks in `issues` and point them to the owning task id.
- Check line endings on every role, not just UI. Whole-file CRLF→LF conversions recurred in codemart, pycore-manager, mcp-chrome and pycore (35 files). Compare `git diff --stat` with `--ignore-space-at-eol` and ask for per-line restoration from HEAD. Review with `--ignore-space-at-eol` in the meantime.
- Stale-response fixes are usually a sequence ref. Verify that every command path bumps it, including unmount or cleanup and mode switches, and that `loading` is only cleared by the newest request.
- Shared-layer (B2) writes must match requirements §6 or an orchestrator assignment. Otherwise send them to the orchestrator; never approve an unassigned shared-layer write.

Related: [[client-key-review-checklist]]

---
name: gitsync-conflict-recurrence
description: pycore auto-gitsync re-creates docs_fix/GITSYNC_MERGE_CONFLICT.md + a README marker line and can start a second merge while you resolve the first
metadata:
  type: feedback
---

While resolving a gitsync conflict, the pycore auto-gitsync (every few minutes) may commit your half-done tree and open a NEW merge (2026-10-03: settings.local.json, then windows_startup_manager.py).

**Why:** the conflict doc and README marker line are working-tree files that auto-gitsync commits; the marker leaves a stray blank first line in docs_fix/README.md.

**How to apply:** after `git commit --no-edit`, restore README with `git checkout origin/main -- docs_fix/README.md`, delete the conflict doc, and re-check `git ls-files -u` before running gitsync. .claude/settings.local.json conflicts: keep both permission lists (add the comma at the join). When two AIs wrote competing designs, keep the newer one that matches the documented goal and drop the leftover tail/imports of the other.

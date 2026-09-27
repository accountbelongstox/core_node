---
name: pycore-line-ending-gate
description: Orchestrator rule from 2026-09-27 - pycore approvals require per-line endings restored to HEAD; satisfied at pycore-4, keep checking every later pycore task
metadata:
  type: project
---

On 2026-09-27 the orchestrator ruled that no pycore task (pycore-4 and later) may be approved until pycore restores the original per-line endings of the 35+ files it had converted from CRLF to LF. pycore-1/-2/-3 were approved before the ruling, with the churn noted as non-blocking. At pycore-4 (15:4x) the gate passed: 0 unchanged lines had a flipped EOL across 154 files.

**Why:** Whole-file endings churn hides the real changes. For example, relay_transport.py showed 411 changed lines for a 2-line edit. `core.autocrlf=true` here. A file whose HEAD blob contains CRLF is not normalized, so any EOL flip shows up in a plain diff.

**How to apply:** On every pycore task:
1. Compare `git diff --numstat` with `--ignore-space-at-eol` over pycore/, pymain.py and pyservice.*.
2. Run a scratchpad difflib scan of HEAD versus the working tree. Count lines that are equal after rstrip but differ in ending, and check whether a uniform-EOL file became mixed.
3. If either check fails, the verdict is changes_requested.

Related: [[ui-review-patterns]], [[pycore-review-patterns]].

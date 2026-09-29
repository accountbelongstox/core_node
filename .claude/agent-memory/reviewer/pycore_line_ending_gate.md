---
name: pycore-line-ending-gate
description: Orchestrator rule from 2026-09-27 - pycore approvals require per-line endings restored to HEAD; passed at pycore-4 r1 and r2, keep checking; scan raw blob bytes against the pre-capture base when a foreign commit captured the tree
metadata:
  type: project
---

On 2026-09-27 the orchestrator ruled that no pycore task (pycore-4 and later) may be approved until pycore restores the original per-line endings of the 35+ files it had converted from CRLF to LF. pycore-1/-2/-3 were approved before the ruling, with the churn noted as non-blocking. The gate passed at pycore-4 round 1 (15:4x) and again at round 2 (16:04): 0 flipped lines.

**Why:** Whole-file endings churn hides the real changes. For example, relay_transport.py showed 411 changed lines for a 2-line edit. `core.autocrlf=true` here. A file whose HEAD blob contains CRLF is not normalized, so any EOL flip shows up in a plain diff.

**How to apply:** On every pycore task:
1. Compare `git diff --numstat` with `--ignore-space-at-eol` over pycore/, pymain.py, pyservice.* and pyapps.
2. Run a scratchpad difflib scan of raw base blob bytes (`git show <base>:<path>`) against working-tree bytes. Count lines that are equal after rstrip but differ in ending. Check whether a uniform-EOL file became mixed.
3. If either check fails, the verdict is changes_requested.

If a non-agent commit captures the working tree (for example f4f2234 'CodeHeaderCleanerBak' at 15:57 on 2026-09-27), diff against its parent (`74e7770`), not HEAD. Use `find -newer <previous verdict file>` to isolate the round's edits.

Related: [[ui-review-patterns]], [[pycore-review-patterns]].

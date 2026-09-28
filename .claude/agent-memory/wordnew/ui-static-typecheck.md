---
name: ui-static-typecheck
description: How to statically verify wordnew/shared UI changes without building (tsc --noEmit writes nothing)
metadata:
  type: reference
---

In `poly_apps/pycore_laravel_wordnew_ui`, `node_modules/.bin/tsc --noEmit -p tsconfig.json` is a write-free static check (tsconfig sets `noEmit`, no incremental output). It takes a few minutes on the whole project. Filter the output to `apps/wordnew` and any shared file you touched, and diff it against a baseline run: other roles edit concurrently, so project-wide counts drift.

**Why:** team rules forbid builds and tests unless asked. This check found real runtime ReferenceErrors (undeclared imports) in wordnew on 2026-09-27.

**How to apply:** run it before submitting a wordnew task to the reviewer, and report the before/after error count for `apps/wordnew`. See [[crlf-mixed-line-endings]] for editing safely.

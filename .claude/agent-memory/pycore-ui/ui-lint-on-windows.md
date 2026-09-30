---
name: ui-lint-on-windows
description: `bun run lint` in pycore_laravel_wordnew_ui fails on Windows (tsc not found); run the same tsc --noEmit through node instead
metadata:
  type: feedback
---

On this Windows checkout, `bun run lint` (script `tsc --noEmit`) in `poly_apps/pycore_laravel_wordnew_ui` fails with `bun: command not found: tsc`. The type-check never runs. Run the same command through node from the UI directory: `node node_modules/typescript/bin/tsc --noEmit`.

**Why:** the entries in `node_modules/.bin` are POSIX symlinks, probably from a WSL/Linux install, and Windows bun does not resolve them.

**How to apply:** when a task says "bun run lint passes", run the node form. Report both results: bun's shim error and the tsc exit code. Check free RAM first (3 GB guard); a whole-project tsc run took about 30 s on 2026-09-30 (a scoped tsconfig extending the root one took about 15 s).

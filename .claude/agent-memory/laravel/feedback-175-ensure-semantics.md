---
name: feedback-175-ensure-semantics
description: User ruling 2026-09-27 on the 175 laravel_main deploy script and sys:init - ensure/repair, never reset; skip initialized items; step-testable; small changes only
metadata:
  type: feedback
---

The 175 deploy script (and `sys:init` it runs) is an **ensure** script: idempotent repair and initialization, never a reset. An installed service is started, not reinstalled (e.g. PostgreSQL); already-initialized items are skipped (judged by real state, not a status file alone). It must expose a parameter interface to run and test a single step. Keep changes small; no big refactor of the script.

**Why:** the user wants to run 175 on the live server safely and repeatedly; earlier diagnostics showed 175 could stop the live PG cluster and disable the FrankenPHP unit.

**How to apply:** Laravel-side init steps must be no-ops on a converged system and never overwrite operator data (upsert-if-missing). CodeMart seeded-account password is generated per 175 run (prompt "regenerate? [Y/n]" when one exists), stored in RuntimeConfigurationStore, applied to the DB and printed, viewable later. `sys:init` prints the admin invite code. See [[feedback-laravel-no-env]].

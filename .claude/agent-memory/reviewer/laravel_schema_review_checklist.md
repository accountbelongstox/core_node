---
name: laravel-schema-review-checklist
description: Reviewing laravel_main schema/initializer fixes (SafeMigrationHelper, sys:init) - what to probe and recurring defects seen in laravel-T11
metadata:
  type: project
---

In laravel_main, schema drift is repaired by sys:init. sys:init runs migrate first and stops on the first failure; the app initializers (CodeMartV1Initializer and others) run last. They go through SafeMigrationHelper::alignTableStructureFromArray, which is the one shared path, and migrations use it too. A `*_init_status.json` "fully_initialized" marker is not evidence that the DB was aligned.

**Why:** laravel-T11 (2026-09-27): public/home returned 500 because the initializer had never run against the DB. Also, before the fix, unnamed index specs added `idx_<table>_<cols>` duplicates next to Blueprint's `<table>_<cols>_index`.

**How to apply:**
- Local FrankenPHP is usually stopped (curl 000). Verify with read-only scratch PHP scripts:
  - information_schema and pg_indexes SELECTs.
  - An in-process HTTP kernel GET. Bind `$app->instance('request', $req)` before `$kernel->bootstrap()`, then set cache/session to array.
  - A declared-vs-live diff over `contractTableStructures()` to prove a rerun adds nothing.
- Recurring defects:
  - column normalization duplicated between index helpers;
  - getIndexes() ignores partial-index predicates;
  - composite types (timestamps/morphs) keyed by pseudo column names;
  - residue lists in the owner's report that miss duplicates on pre-existing tables.
- Related: [[client-key-review-checklist]].

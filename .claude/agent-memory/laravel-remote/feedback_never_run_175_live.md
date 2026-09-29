---
name: never-run-175-live
description: Do not run 175_laravel_main_start.sh (or sys:init unguarded) on the live laravel-main host; it causes a web outage, restarts PG15 and seeds demo admin data
metadata:
  type: feedback
---

Do not run `scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh` on the live laravel-main server to fix something small. Run the single artisan command instead, and only with the user's explicit request relayed by the orchestrator.

**Why:** a read-only trace on 2026-09-27 showed several problems:
- While phpredis is missing, 175 runs 93 → `fm_unlink_frankenphp_runtime`, which `disable --now`s `ncore-laravel-frankenphp`. That is a web outage for the whole run, and it becomes boot-persistent on early returns.
- The 75 drift check stops the live PG15 cluster on every run.
- `sys:init` seeds CodeMart demo data, including an admin account, unless `CODEMART_SEED_DEMO=false`.

**How to apply:**
- Before any server-side sys:init or 175 request, re-check whether shell fixed the unlink discriminator and the 75 drift check, and whether the CodeMart demo-seed guard landed.
- Point out these risks again when a task asks for either.

Related: [[server-layout]]

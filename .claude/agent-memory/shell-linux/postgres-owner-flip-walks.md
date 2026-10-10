---
name: postgres-owner-flip-walks
description: Recursive owner-only/777 permission walks over /www/wwwroot re-own the PostgreSQL data/log dirs to debian; fs_perm_helpers now prunes them
metadata:
  type: project
---

Laravel 500s with "global/pg_filenode.map: Permission denied" = a permission walk re-owned `/www/wwwroot/postgresql/{data,logs}` to debian while Postgres runs. Culprit: `repair_owned_tree_owner_only` (fs_perm_helpers.sh) reached via `pyservice_www_permissions.sh` tier 1b (`$WWW_ROOT/wwwroot`), run by owner_guard's 30-min full sweep and install-step runners. Fixed 2026-10-11 by `fs_perm_service_prune_args` (data_directory/log_directory read from /etc/postgresql/*/*/postgresql.conf, pruned in owner_only and 777 walks).

**Why:** the older uid<1000 prune in the 777 walk only protected dirs that were still postgres-owned, so one flip made it permanent.

**How to apply:** recover with `systemctl stop postgresql@15-main` then step 75 (it repairs only when no cluster runs; a running cluster leaves the flip). Do not wait on a background run with `pgrep -f <name>` inside a `bash -c` that contains that name (matches itself).

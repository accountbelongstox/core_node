---
name: backlog_ui_laravel_manager_d7
description: pre-R2 D22 lane task "ui-laravel-manager-D7" (9 data-sync/i18n/contract items) — unimplemented as of 2026-09-28, now under pycore-ui by default
metadata:
  type: project
---

`.claude/agents_shared/d22/items_pycore.json` has an entry `{"old_role": "ui-laravel-manager", "task_id": "ui-laravel-manager-D7", "done_before_outage_unreviewed": false}` with 9 items, none implemented as of 2026-09-28 (verified against the working tree: `DATA_SYNC_PROTOCOL_VERSION = 5`, `ACTIVE_STATUSES`, `HISTORY_LIMIT`, `normalizeAdhocAddress` literals all still present in `apps/laravel-manager`). Temporary B2 writer grant for this task: `vite.config.ts`, `core/contracts/ServiceContract.ts`.

Items and dependency status observed 2026-09-28:
- `MDSR-26-ts` (add `data_sync` exports to `ServiceContract.ts` from `config/service_contract.json#data_sync`, which already exists) — unblocked.
- `MDSR-11` (per-node terminal_retention history limit) — depends on `MDSR-26-ts` (mine) + laravel-api `MDSR-26-php` (already **approved**, see `reviews/laravel-api-D7.json`) — unblocked once MDSR-26-ts lands.
- `MDSR-02` (remove hard Start block, show inline supersede warning) — no dependency, unblocked.
- `MDSR-13` (drop local `normalizeAdhocAddress`, use backend-normalized probe target) — backend side (`DataSyncService::probeTarget`, `DataSyncService.php:46-47`) already returns the normalized target — unblocked.
- `MDSR-25` (detail_code/params i18n via `dbSync.*`, drop dead step keys) — depends on laravel-api `MDSR-24`, which was **not started** as of `reports/pycore-lead.md` ("stays in G3") — blocked.
- `MDSR-15` (skip reasons via `dbSync.skipReasons.*`, row-conflict samples split out) — depends on `MDSR-24` — blocked, same as above.
- `MCHR-28` (i18n `VocabularyCoverManagerMenu.tsx`, drop stale pull-only hint) — no dependency, unblocked.
- `MCHR-31-lm` (adopt `shared/library-cover` presenter in `LibraryCoverTaskControls.tsx`) — depends on `ui-pycore-manager` `MCHR-31`, which per `reports/ui-pycore-manager.md` was only "started" (presenter not built, `shared/library-cover/` has only `LibraryCoverTaskModel.ts`, no presenter file) — blocked.
- `CKA-9` (vite.config.ts's WWW-base/legacy-dir/NTFS-type literals move into `ServiceContract.ts` exports) — the source contract keys already exist (`config/service_contract.json#paths.windows_data_drive_root/www_dir_name/linux_www_root/linux_ntfs_nested_www_root/legacy_linux_data_dir/ntfs_fs_types`, pre-dating the D24-D30 `drive_layout` freeze) — unblocked; not affected by the `drive_layout` freeze since it only reads existing keys.

**Why kept:** re-deriving this dependency analysis from scratch (walking reviews/reports/contract) is expensive; if `ui-laravel-manager` is later named temporary writer for these files, start from this map but re-verify freshness first (docs/state drift — see [[ownership_r2_pycore_ui]]).

**How to apply:** Do not self-start this backlog. If a task later assigns these item ids (or apps/laravel-manager DataSync/i18n work in general) to `ui-laravel-manager`, re-check `MDSR-24`/`MCHR-31` status fresh before assuming they're still blocked.

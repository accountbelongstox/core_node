# pycore-laravel report

## pycore-laravel-G1

- Group: pycore (leader: pycore-lead). Released by `reviews/laravel-D7.json` (approved, landed subset).
- Diff base: 74e7770. The user's periodic `win0.0.1` commits already carry part of this work (for example 2f31f9cd3 holds the QueueCenterContract and ContractDocument edits), so use 74e7770 to review, not HEAD.
- Git: read-only, except one `git update-index --refresh -q` I ran to refresh the index stat cache. That is the same refresh `git status` does; it changes no content.
- EOL: every file I touched was LF with a trailing newline before and after. No AI rules header was re-added.
- Local runtime: the FrankenPHP workers were restarted (`POST :2019/frankenphp/workers/restart` returned 200). Afterwards `GET http://127.0.0.1:9000/api/health` returned 200 three out of three times, with header `X-Core-Node-Server-Id: cbb90c975961547ab50158bdc04a0649`. `GET /api/codemart/v1/public/home` returned 200, and `X-Ratelimit-Remaining` counted down through the failover store.
- RAM: free RAM moved between 1.4 and 3.9 GB. I ran each Laravel boot (verify script, `route:list`, `config:show`) only after a reading of at least 3 GB. The other checks are small autoload-only scripts.
- Scratch scripts (scratchpad of this session): `g1_verify.php` (53 checks), `pathmapper_snapshot.php` (before/after JSON), `program_drive_probe.php`.

### contract-readers: done
Files:
- `app/Support/QueueCenterContract.php`
- `app/Support/ServiceContract.php`
- `app/Support/ContractDocument.php`
- `app/Http/Middleware/ServerIdentityHeader.php`
- `routes/api.php` (one line: the health route used the removed `ServerIdentityHeader::HEADER` constant)

Changes:
- **QueueCenterContract** now reads through ContractDocument (`LABEL` constant). Typed readers: `string()`, `positiveInt()`, `stringList()`, `section()`. Named accessors:
  - `wordIdentityFallback()` (the whole `word_identity.fallback_when_md5_absent` block), `wordIdentityFallbackKeyFormat()`, `wordIdentityFallbackRejectionCode()`;
  - `delivery()` (the whole `delivery` block), `deliveryServerIdentityHeader()`, `deliveryServerIdentityBodyField()`;
  - `libraryCoverMaxIds()`.
  - A missing or mistyped key throws. There are no `?? default` reads.
- **ServiceContract**:
  - `section()`, and `dataSync()` now goes through `section('data_sync')`. I corrected its docblock: DataSyncProtocol does not call it.
  - Path bases: `wwwDirName()`, `coreNodeDataDirName()`, `globalVarDirName()`, `linuxWwwRoot()`, `linuxNtfsNestedWwwRoot()`, `legacyLinuxDataDir()`.
  - Drive layout: `driveLayout()` (`paths.drive_layout`), `windowsProgramDriveFallback()`, `linuxToolBase()` (the parent directory of `drive_layout.tool_root.linux`).
  - `globalVarDirectory()` now uses `globalVarDirName()`.
- **ContractDocument**: `value()` is now private, which resolves the laravel-D7 non_blocking item. Its docblock now names both consumers and says the public readers throw.
- **ServerIdentityHeader**: `public static function header()` returns `QueueCenterContract::deliveryServerIdentityHeader()`. It replaces the hardcoded `HEADER` constant, which had no other user after the `routes/api.php` fix (a grep of the whole repo confirms it).

Verification:
- `php -l` passes on all five files.
- `g1_verify.php` compares each new accessor with a raw `json_decode` of `config/queue_center_contract.json` or `config/service_contract.json`. All match: `wordIdentityFallback`, key_format `<lang>:text:<cleaned_word>`, rejection_code `WORD_NOT_FOUND`, `delivery`, header `X-Core-Node-Server-Id`, body_field `server_id`, `max_ids` 200, the typed reads, `dataSync`, `section`, `driveLayout`, `program_drive_fallback` `D:`, `linuxToolBase`, and the six path bases. A missing key throws `RuntimeException`.
- The middleware stamps the response. An in-process `GET /api/health` returns 200 with the header.
- `php artisan route:list --json` (exit 0, 1086 routes): all 7 machine routes carry `ServerIdentityHeader` and `ClientKeyOnly`. Those are the 5 delivery routes (`info`, `diff`, `batch`, `batch/{batchId}`, `batch/{batchId}/content`) and the 2 orch-audio ingest routes (`ingest/tasks`, `ingest/segment-audio`).
- The 2 `GET app_qy_v1/orch_audio/tasks[/{taskKey}]` routes are the UI's `auth:sanctum` read surface (`AppQyV1OrchAudio.php:21-25`, unchanged). They are not machine routes.

Announcement to wordnew-laravel (via wordnew-lead) and codemart-laravel (via codemart-lead). No lead session was reachable through ListAgents, so this report and the G1 result carry the announcement:
- `QueueCenterContract::delivery()`, `::positiveInt('delivery.batch_limits.items')` and the other typed reads replace delivery literals in the `AppQyV1Delivery*` services. `::deliveryServerIdentityBodyField()` replaces the `'server_id'` literal at `AppQyV1DeliveryCtl.php:40` and `AppQyV1DeliveryDiffService.php:49`.
- `::wordIdentityFallback*()` serve the LDRI-11/CKA-22 resolver.
- `::libraryCoverMaxIds()` serves the cover-task request validation.
- `ServiceContract::section($path)` replaces the raw `document()[...]` reads, for example `CodeMartV1AdminPassword.php:30` (codemart).
- `ServerIdentityHeader::HEADER` is gone. Use `ServerIdentityHeader::header()`.

Deferred (not in this assignment's file list; my scope):
- `ClientKeyAuthService.php:254` and `DingDuoDuoV1SuperCodeService.php:124` should adopt `ServiceContract::section()`.

### CKA-08: done (behavior unchanged)
File: `app/Providers/PathMapper.php`.

Changes:
- Removed the constants `WINDOWS_DATA_DRIVE_ROOT`, `WWW_DIR_NAME`, `LINUX_WWW_ROOT`, `CORE_NODE_DATA_DIR_NAME`, `LEGACY_LINUX_DATA_DIR` and `NTFS_FILE_SYSTEMS`. I also removed `GLOBAL_VAR_DIR_NAME`, because the contract has `global_var_dir_name` and ServiceContract already read it.
- `LEGACY_WINDOWS_PROGRAMING_USERS_DIR` became `legacyWindowsProgramingUsersDir()`, built on a private `programing\Users` subpath.
- Every former use now goes through ServiceContract: `windowsWwwBase`, `linuxWwwBase` (with `linux_ntfs_nested_www_root`), `mapWebPath` Linux base, `getCoreNodeRuntimeDir` (home fallback through `homeDataDirFallback()`), `globalVarDirectories`, `wwwNtfsRootMounted` (`ntfsFileSystemTypes()`), `linuxCrossOsCacheDir`, `readPersistedBase`, `detectLargestDiskBase`, `getBaseTempDir` and `getSharedDownloadCacheDir`.
- Nothing outside PathMapper used these constants (checked by grep).
- There is no recursion: `ServiceContract::document()` resolves the repo root through the `__FILE__`-based `getCoreNodeDir()`, and `FileSystemManager::readFile(..., false)` is plain PHP.

Verification:
- `php -l` passes.
- `pathmapper_snapshot.php` records 45 values before and after the change, each run with and without the exported `CORE_NODE_DATA_DIR`. The values include `getCoreNodeRuntimeDir` = `D:\www\core_node`, the launcher dir, the shared cache, all 24 `mapWebPath` keys (among them `laravel_data_dir` = `D:\www\wwwroot\laravel_db`, `logs`, `postgresql` and `compile_dir` = `D:\_win10`), `laravel_data_dir/.core_node_secrets`, the global var dirs, `D:\.tmp` and `osVarTag` WIN10. A `diff` of the before and after files is empty for both runs.
- A comment-stripped grep of PathMapper code lines finds no `/var/_core_node` and no `ntfs3`.

Decision (recommended option; flagged to the orchestrator): the Linux data-dir candidate order stays the current one: `<linuxWwwBase>/core_node`, then the legacy dir, then home.
- The contract's D24 list, read by `ServiceContract::linuxDataDirCandidates()`, drops `/www/www/core_node` on a dual-boot NTFS `/www`.
- Two other ends still resolve `/www/www/core_node`:
  - shell `runtime_environment.sh:27-44`;
  - pycore `core_node_dirs.get_core_node_data_dir:166`.
- Switching only PHP would split the var store (global_var) on a dual-boot Linux whenever `CORE_NODE_DATA_DIR` is not exported.
- The D24 data-dir move has to happen in lockstep: shell-linux, pycore-lead and pycore-laravel, scheduled by the orchestrator (P1b). When it lands, PathMapper switches to `linuxDataDirCandidates()`, which stays in place for that step.

### DRIVE-LAYOUT-php: done
File: `app/Providers/PathMapper.php` (`getDevCompileParts`, plus `isWindowsDriveSpec`).

Changes:
- **Linux** (WSL included): `[ServiceContract::linuxToolBase(), <os>_<ver>]`. There is no `getBaseDataDirectory` fallback, no free-space switch and no sticky `/opt` probe. `rootHasSufficientFreeSpace()` was deleted, since it had no other caller.
- **Windows**: the drive comes from the var-center key `WINDOWS_PROGRAM_DRIVE_ROOT` (read through `readPersistedVar`, so the `WIN10_`-tagged file or the bare file). If that value, trimmed, is a bare drive spec, it is used. Otherwise the drive is `drive_layout.program_drive_fallback`. The suffix stays `win{ver}`. E: is never probed.
- The result is memoized per process. Before, `mapWebPath` recomputed it on every call; now a var read happens once per worker.

Verification:
- `php -l` passes.
- Through reflection, `getDevCompileParts(true)` returns `["D:","win10"]`, the same as before, and `mapWebPath('compile_dir')` returns `D:\_win10`, the same as before.
- `program_drive_probe.php` uses a scratch `CORE_NODE_DATA_DIR` var store, so the real one is never touched:
  - a recorded `E:\` gives `["E:","win10"]` and `E:\_win10`; `e:` gives `E:`;
  - `garbage` and no record both give `D:`.
- `getDevCompileParts(false)` returns `[linuxToolBase(), ...]`. Reading the code confirms that the Linux branch has no other return.
- Workers restarted, health 200.

Contract drift found during the run:
- The orchestrator revised `paths.drive_layout` while I worked (user D27/D28/D30, `DIRECTORY_NAMESPACE_RULES.md`). `tool_root.linux` is now `/opt/core_node/_<os>_<ver>`, so `linuxToolBase()` = `/opt/core_node` and the PHP Linux `compile_dir` = `/opt/core_node/_<os>_<ver>`. PHP follows the contract with no literal.
- Lockstep gap:
  - The fenced `gvar_storage_common.sh:362-380` `get_dev_compile_base` (core-node-e9) still echoes a literal `/opt`.
  - pycore `system_paths.py:214-238` (pycore-lead) is unchanged.
  - Both must converge on the contract key. PHP's `compile_dir` consumers (`getGoBinaryPath` and `getPnpmBinaryPath`) fall back to symlinks and `which`, so a legacy `/opt/_<os>_<ver>` install still resolves.
- New var key for shell-windows (SPW-035 follow-up): once SharedCacheEnv.ps1 (fenced for core-node-e9) or its installer has settled the program drive, it should persist `$Global:WINDOWS_PROGRAM_DRIVE_ROOT` into the var center under the key `WINDOWS_PROGRAM_DRIVE_ROOT`. Until then PHP uses the contract fallback `D:`. pycore-lead should read the same key in `system_paths.py` to stay in lockstep.

Deviation from the literal verify (recommended option):
- The comment-stripped grep for `/opt` still finds 3 PathMapper code lines. None of them is the tool root:
  - `:182` `app_manager_logs` `/opt/_core_node/logs`;
  - `:183` `app_manager_logs_old` `/opt/core_node_unified_manager/logs`;
  - `:844` the third-party nginx conf search path `/opt/nginx/conf`.
- The first two mirror the literals at `gvar_common.sh:380-385` and `system_paths.py:917-918/981-982`. D30 keeps legacy top-level dirs in place until the user approves a migration.
- I tried deriving them from `linuxToolBase()`. This run proved that wrong: the D30 contract revision would have moved them to `/opt/core_node/...`. So they stay literals.
- To remove them, the orchestrator adds a contract key for the App Manager log roots, and all three ends (gvar_common.sh, system_paths.py, PathMapper) switch to it together.

### D9-01 (merged D9-01 and CKA-35): done
Files: `app/Constants/LaravelConfig.php`, `config/cache.php`.

Changes:
- `LaravelConfig::CACHE_STORE` = `failover`, and a new `CACHE_FAILOVER_STORES = ['redis', 'database']`.
- `config/cache.php` gains the store `'failover' => ['driver' => 'failover', 'stores' => LaravelConfig::CACHE_FAILOVER_STORES]`. It uses the framework `FailoverStore` (Laravel 13.25), so there is no second abstraction.
- `SESSION_DRIVER` stays `database`.
- CodeMart keeps `lockForUpdate` in 19 places under `app/Apps/CodeMartV1`, with no change.

Verification:
- `php -l` passes.
- In-process:
  - `config('cache.default') === 'failover'`, and the stores are `[redis, database]`;
  - `session.driver` is `database`;
  - `extension_loaded('redis')` is false on this host.
- Inside a rolled-back transaction on the cache store's `main` connection, all of these work:
  - `Cache::put` and `Cache::get`, and the row lands in the database store;
  - `CacheFailedOver` fired for `redis`;
  - `Cache::lock()->get()` acquires;
  - `RateLimiter` `hit` and `attempts` count 1 under `codemart_public|...`;
  - `ThrottleRequests` resolves.
- After the rollback, the probe key is gone.
- Live after the worker restart: the throttled CodeMart home returns 200, and `X-Ratelimit-Remaining` is 118.

Notes:
- `QueueCenterCacheStore` (database), the `file` users and the `octane` users pin their own stores and are unaffected.
- Follow-up in my scope, outside this file list:
  - Give the `cache` Redis connection in `config/database.php:128-139` a short `timeout` and `max_retries` 0, as the `resource_index` connection has. Then a host with phpredis loaded but Redis down fails over fast.
  - The comment at `TaskManagerService.php:53-56` is stale. It says CACHE_STORE=database and that there is no cache-table migration, but `2025_12_01_080227_create_cache_table.php` exists.

### USER175-11 (merged USER175-11, CMGAP-U21, CKA-40, D9-03): done (landed in laravel-D7; closed here with no code change)
Files (checked, not changed):
- `config/services.php`
- `config/logging.php`
- `app/Constants/LaravelConfig.php`
- `app/Support/RuntimeConfigurationStore.php`
- `app/Providers/RuntimeConfigurationServiceProvider.php`

Verification:
- A grep for `env(` over config, app, routes and bootstrap finds only the two `Process::...->env([...])` calls (`DatabaseManagerService.php:412,481`).
- In-process:
  - `services.codemart_seed_demo === true`;
  - `codemart_bank_transfer` has the keys `bank_name, account_name, account_number, branch, swift_code`. Each is null, the empty default; RuntimeConfigurationServiceProvider fills them from the per-install `CODEMART_BANK_*` store keys;
  - `logging.default` is `stack`, which routes to `[daily]`, and the daily level is `LaravelConfig::LOG_LEVEL` = `warning`;
  - the daily path equals `PathMapper::mapWebPath('logs','laravel.log')` = `D:\www\wwwroot\laravel_db\logs\laravel.log`.
- `php artisan config:show services` (read-only) shows the same values.
- No `.env` key was added, and the tracked `.env` was not deleted.

**laravel-remote handoff (CKA-40):**
- Laravel errors and warnings on the server land in the size-capped daily file under `PathMapper::mapWebPath('logs','laravel.log')`, that is `<www base>/wwwroot/laravel_db/logs/laravel-YYYY-MM-DD.log`. The path runs through the `stack` channel, then `daily` (`App\Logging\CreateSizeCappedDailyLogger`), at level `warning`.
- Nothing goes to syslog. `LOG_CHANNEL=syslog` and `LOG_LEVEL=debug` in `.env` are inert, because Laravel reads config files only (D17).
- This corrects `reports/laravel.md:233` ("syslog on the server"): read the daily laravel log for the SafeMigrationHelper added-column warnings.

Open for an orchestrator ruling, unchanged: the `getenv` reads of launcher and OS context listed in `laravel-D7.json` non_blocking.

### AHSC-35-relay (merged AHSC-35-relay and D7 M-5): done
Files:
- `app/Apps/Relay/RelayServices/RelayContract.php`
- `app/Apps/Relay/RelayServices/RelayDeviceService.php`

Changes:
- One list, `RelayContract::DEVICE_EVENT_NAMES`: terminal_changed, agent_history_prompt_new, agent_history_prompt_derived and agent_history_config_changed.
- It is spread into `$requiredEvents`, so a contract without the event fails to load, and it is exposed as `RelayContract::deviceEvents()` (the wire values through `event()`).
- `RelayDeviceService::event` checks against `deviceEvents()`. That drops the second hardcoded list (`:60-64`).
- The generic outbox forwarder (`RelayOutboxRepository::append`) already resolves every contract event and its payload profile, so it needed no change.

Verification:
- `php -l` passes.
- In-process:
  - the contract lists `agent_history_config_changed` = `agent_history.config.changed`, and `deviceEvents()` includes it;
  - `RelayContract::digest()` = `498009255be2c7ae…eb93`, equal to the sha256 of `git show HEAD:config/pycore_relay_contract.json`, so the digest is unchanged;
  - on the container-built `RelayDeviceService`, inside a rolled-back relay-connection transaction, a probe with a random uuid device:
    - event `agent_history.config.changed` → `device_not_found`, so it passed the allowlist and is no longer `device_event_invalid`;
    - control `g1.bogus.event` → `device_event_invalid`.
- Workers restarted.
- pycore's device event no longer gets 422 `device_event_invalid` once it runs against this code.

### Summary
- Changed files (under `poly_apps/laravel_main/`):
  - `app/Support/QueueCenterContract.php`, `app/Support/ServiceContract.php`, `app/Support/ContractDocument.php`;
  - `app/Http/Middleware/ServerIdentityHeader.php`, `routes/api.php`;
  - `app/Providers/PathMapper.php`;
  - `app/Constants/LaravelConfig.php`, `config/cache.php`;
  - `app/Apps/Relay/RelayServices/RelayContract.php`, `app/Apps/Relay/RelayServices/RelayDeviceService.php`.
- Status: all 6 items are done. The G1 verify script passed 53 of 53 checks.
- Blockers: none.
- Next owners:
  - pycore-lead: verdict `reviews/pycore-laravel-G1.json`, plus the `system_paths.py` lockstep (tool root from the contract; `WINDOWS_PROGRAM_DRIVE_ROOT` var key).
  - shell-windows: persist `WINDOWS_PROGRAM_DRIVE_ROOT`.
  - core-node-e9 / shell-linux: `get_dev_compile_base` onto `tool_root.linux`.
  - orchestrator:
    - rule on the D24 data-dir lockstep;
    - rule on a contract key for the App Manager log roots.
  - wordnew-lead / codemart-lead: adopt the announced accessors.

## laravel-api-D7-fix (item laravel-api-D7-B1; re-routed to pycore-laravel after pycore-lead's correct deferral)

- Scope: `app/Utils/FileSystemManager.php:602-641`, `delete()`'s Windows branch. Patch spec: `reports/pycore-lead.md:298-332`; round-1 review `reviews/laravel-api-D7-fix.json` (verdict `changes_requested`, owner pycore-laravel).
- Finding: at HEAD (`24674d1a6`), the file already carries the exact validated patch, byte-for-byte:
  - `delete()` branches to `self::deleteNative($mappedPath)` under `\App\Providers\PathMapper::isWindows()`, right after the `!file_exists` early return (:606-612), leaving the POSIX sudo path untouched below it.
  - `deleteNative()` (:643-664) walks `RecursiveIteratorIterator(RecursiveDirectoryIterator(..., SKIP_DOTS), CHILD_FIRST)` only when `@filetype($path) === 'dir'`, wrapped in `try/catch (\UnexpectedValueException)`, then removes the root entry and returns `!file_exists($path)`. This is the lstat-based guard the leader's prototype required (a junction/symlink reports `filetype() !== 'dir'`, so the walk never descends into one).
  - `removeNativeEntry()` (:666-676) does `unlink||rmdir`, and on failure retries `chmod(0666)` followed by **both** `unlink||rmdir` again — the round-1 review's non-blocking refinement ("retry `if (@unlink($path) || @rmdir($path))` after the chmod as well," `reviews/laravel-api-D7-fix.json` non_blocking #2) is already folded in, not just the file-only retry the report described.
  - `git diff HEAD -- app/Utils/FileSystemManager.php` is empty; no edit was needed or made. Per AGENTS.md (reuse before rewriting), I verified the existing code against the spec instead of reapplying a no-op patch.
  - The internal `self::delete()` call sites the review flagged as non-blocking (`:460`, `:471`, `:480` inside `concatenateFiles`, plus `:408` in `writeFileAtomic`) are unchanged call sites that automatically inherit the native branch; no separate change needed there.
- Verification (in-process, scratch-only; PHP 8.5.2 CLI):
  - `php -l app/Utils/FileSystemManager.php`: clean.
  - Ran the prepared scratch script `d7fix_verify/verify.php` (this session's scratchpad). All 28 checks passed:
    - Part A (isolated OS-temp sandbox, unrelated to any Laravel path): a tree with a plain file, a read-only-attribute file, a nested directory, a top-level and a nested NTFS junction (`mklink /J`), a top-level and nested directory symlink, and a top-level and nested file symlink, each pointing outside the tree. `FileSystemManager::delete()` on the tree root returned `true`, the tree is gone, and the junction/symlink targets outside the tree (a canary file and its directory) are byte-identical afterward — the walk removed the junction/symlink entries themselves without descending into or touching their targets. A lone scratch file and a missing path also delete correctly (`true` both times).
    - Part B (real `D:/www/backup/data-sync` tree, scratch session ids only): a scratch session's terminal `save()` removed its `artifacts/` and `incoming/` directories (`DataSyncArtifactStore::forgetSession`, reached through the fixed `delete()`), resolving the review's MDSR-09 "a terminal save deletes it" failure. Back-dating the scratch session's `updated_at` to `2000-01-01T00:00:00+00:00` (direct on-disk rewrite, since `save()` always stamps "now") and then completing a second scratch session triggered `pruneTerminal()`, which evicted only the back-dated scratch session; the 4 real terminal sessions were SHA-256-hashed before and after and are byte-identical, and the job/lock file counts are unchanged after cleanup. No scratch file was left behind afterward (confirmed both by the script's own checks and a directory listing).
  - Not separately re-exercised: `ResourceSyncService::completeArchive` staging/`.7z.part` cleanup (the report's "if it can be reached" item). It is another caller of the same `delete()`/`deleteNative()` mechanics Part A already proves; `SystemArchiveManager.php`/`ResourceSyncService.php` are out of this task's file list (`app/Utils/FileSystemManager.php` only), so I did not touch them to build a harness for it.
  - `POST http://localhost:2019/frankenphp/workers/restart` → 200; `GET http://127.0.0.1:9000/api/health` → 200.
  - `git status --short` shows no change to `FileSystemManager.php` and nothing else of mine touched; the other modified/untracked paths in the tree belong to concurrent pycore-lead/pycore-runtime/shell-linux/shell-windows/wordnew-lead work (G1-G4 and others running in parallel), not this task.
- Decision (recommended option, no question asked): treat "implement the patch" as "verify the already-landed patch matches the validated spec and prove it live," since the code already matches the spec exactly, including the reviewer's non-blocking rmdir-retry refinement; rewriting identical code would violate the reuse/no-duplicate rule for no benefit.
- Changed files (this round): none in `poly_apps/laravel_main/` (the file already matched the validated patch). This report only.

### Round 3 follow-up (post usage-limit resume, 2026-09-28): the second native-delete blocker, now closed

The round-1 verification above checked only `FileSystemManager.php`. The `reviewer` service's round-3 verdict (`reviews/laravel-api-D7-fix.json`, `changes_requested`, `checked_at 2026-09-27T21:56`) correctly reopened the item: `app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1ElevatedAccess.php` still had its own recursive `nativeRmdir()` (a **second**, independently-hazardous native delete used by `deletePathWithSudo()`'s Windows branch, reached from the site-purge path `NginxManagerCtl.php:632-651`), which recurses on `is_dir() && !is_link()` and so still follows junctions on Windows — the exact class of bug `FileSystemManager::deleteNative()` was fixed to avoid (it guards on `filetype() === 'dir'`, which is false for a junction, so it never descends into one).

File: `app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1ElevatedAccess.php`.

Changes (matches the round-3 review's required `ea.diff`, applied from spec since the leader's scratchpad diff file was session-local and not reachable from this session — `.claude/agents_shared/d7/` had no `ea.diff`/`fsm.diff` copy):
- `deletePathWithSudo()`'s Windows branch (`:202`) now calls `\App\Utils\FileSystemManager::delete($path)` instead of `self::nativeRmdir($path)`. Return-shape (`success`/`error`/`code`) is unchanged.
- `nativeRmdir()` (formerly `:238-263`) is removed entirely — no other caller existed (grep).
- `FileSystemManager.php:666-676` (`removeNativeEntry`, the "fsm.diff" half of the round-3 issue) needed no change: it already retries `@unlink($path) || @rmdir($path)` after the `chmod(0666)`, confirmed identical in this round and in the round-1 check above. `TASKS.md:169`'s "no-op final if" backlog wording is stale against the current tree; the fix is already landed.

Verification (this host is Linux-only for this session — no Windows/PowerShell reachable, so the Windows branch cannot be exercised live here; verified statically plus by direct autoload/reflection, and the underlying `FileSystemManager::delete()`/`deleteNative()` junction-safety was already proven live in the round-1 verification above and in the leader's round-3 artifacts, `out_cli.json`/`out_frankenphp.json`, 26/26 passing):
- `php -l` on the changed file: clean.
- `grep -rn nativeRmdir app/`: no hits (was 3).
- `git diff --numstat` and `--ignore-space-at-eol` both `1 28` for the file: no whitespace-only churn; 0 CR bytes before and after.
- Plain-autoload reflection (`vendor/autoload.php`, no Laravel kernel boot — the live `ncore-laravel-frankenphp` service on this host was mid-restart-loop under another session's work and its data dir is root-owned/unwritable to this user, so a kernel boot or live HTTP health check was not reachable this round): `\App\Utils\FileSystemManager::delete` exists, `public static`, 1 parameter, return type `bool` — matches the call site exactly. `ServerManagerV1ElevatedAccess` has no method with `rmdir` in its name anymore.
- Not repeated this round (already proven and unaffected by this change): `deleteNative()`'s junction/symlink walk safety (round-1 Part A, 28/28) and the live worker-restart/health check (round-1, both 200).
- Changed files (this round): `app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1ElevatedAccess.php`.
- Blockers: none. The live-service verification gap (health check unreachable) is an environment/infra state on this host at the time of the check, not caused by this change — it touches no boot path, no service file, no config.
- Next owner: pycore-lead, to re-review and flip `reviews/laravel-api-D7-fix.json` and the B1 entry of `reviews/laravel-api-D7.json` to `approved`; when a Windows or live-FrankenPHP host is available, re-run the round-1 `d7fix_verify/verify.php`-style junction probe once more against this delegation as a final live confirmation (optional — the delegation is a direct call substitution to already-proven code).

## pycore-laravel-G2

Scope: srv-06, T12, CKA-13, USER175-07, USER175-09, D9-09. All paths are under `poly_apps/laravel_main/`. I ran no git writes. The user's own sync commit `93f8de054` ("win0.0.1") picked up these working-tree changes. Line endings are unchanged: every touched file is LF, before and after, and for each file `git diff --numstat 74e7770` equals the `--ignore-space-at-eol` numstat. The `-8/-9` header hunks at the tops of files are D18 header-cleaner removals, not mine.

### srv-06 (merged srv-06, srv-02, USER175-12, D9-10): done
Files:
- `app/Apps/McpV1/McpV1Utils/McpV1Initializer.php`
- `app/Apps/McpV1/McpV1Models/McpV1PlaceholderImageModel.php`
- `app/Apps/McpV1/McpV1Utils/McpV1PlaceholderUtil.php`
- `database/migrations/mcpv1_placeholder_images_table.php`
- `app/Console/Commands/McpV1PlaceholderCleanupCommand.php`
- `app/Console/Commands/InitializeApps.php`
- `app/Services/InviteCodeInitializer.php`
- `app/Models/InviteCode.php`
- `lang/{en,zh_CN}/mcp_v1.php` (new)
- `lang/{en,zh_CN}/runtime.php`

Changes:
- **Root cause of the server's daily `mcpv1:placeholder-cleanup` failure.** `McpV1PlaceholderImageModel` extended `AppModel` with no app key, so it queried the default connection `main` (`core_node_main`, where there is no `placeholder_images`). The migration and the initializer create the table on `mcpv1` (`mcp_v1_database`). The model now extends `McpV1Model`, so it uses the `mcpv1` connection.
- **Single schema source.** The table structure now lives in `McpV1PlaceholderImageModel::tableStructure()`, following the AppQyV1 TTS model pattern. Both the migration and the initializer use it.
- **Schema check.** A new `schemaReady()` runs `Schema::hasTable` plus `hasColumns` over every declared column.
- **Initializer no longer trusts the status file alone.** A step is skipped only when `completed_steps` says it is done **and** `stepStateHolds()` confirms the real state:
  - `create_placeholder_table` and `verify_tables` check `schemaReady()`;
  - `create_storage_directory` checks `is_dir`;
  - if the check itself throws, the step re-runs.
- **Table creation.** `createPlaceholderTable` now runs `ensureTableAligned(tableStructure())`, the add-only SafeMigrationHelper path, instead of `Artisan::call('migrate', --path)`. The old call did nothing once the migrations repository recorded the file, even with the table gone. `verify_tables` uses `schemaReady()`.
- **Storage directory.** `McpV1PlaceholderUtil::storageDirectory()` is now the one definition of the storage dir, used by the util and the initializer.
- **Cleanup command.** When the table is absent, `mcpv1:placeholder-cleanup` returns 0 with a `Log::warning` line and the localized `mcp_v1.cleanup.table_missing` line.
  - Choice (recommended, literal reading): the whole command is skipped, including the orphan-file sweep. So an in-process test run could not delete the one real file older than a day in `static/mcp_placeholders`.
- **Invite codes.**
  - `InviteCode::codesByType` became `activeCodesByType`: the newest active, unexpired code per type, through a shared private `activeUnexpiredQuery()` that `publicCodes()` now reuses. Its only caller, `InviteCodeInitializer`, was updated.
  - sys:init keeps printing the admin invite code. The print block moved into `InitializeApps::displayInviteCodeResults()` so it can be tested in-process.
  - When no active, unexpired admin code exists, sys:init prints `runtime.invite_code_none_active` instead of an empty header.
- **env() reads.** The touched files contain no `env(` read. `InitializeApps.php` still reads `getenv('LARAVEL_SERVICE_RUN')`. That is a launcher-context signal, not a `.env` key, and it is already listed for an orchestrator ruling (laravel-D7 non_blocking), so it is unchanged.

Verification (`scratchpad/g2_verify.php`: in-process, with transactions opened on mcpv1, codemartv1, appqyv1 and main and all rolled back; 32 of 32 checks passed):
- `php -l`: every changed PHP file is clean.
- The model connection is `mcpv1`.
- The initializer ran against a scratch copy of the real `mcp_v1_init_status.json`, where every step is `completed_steps: true`. With `placeholder_images` dropped inside the transaction:
  - run 1 re-ran `create_placeholder_table` and returned `{"status":"success","table_status":"created"}`, and `schemaReady()` was true afterwards;
  - run 2 in the same transaction returned every step `skipped`, so no change.
- With the table dropped again, `Artisan::call('mcpv1:placeholder-cleanup')` returned 0 and printed "Placeholder cleanup skipped: table placeholder_images is missing on connection mcpv1 (run php artisan sys:init)." No "Deleted" line appeared.
- After the rollback, `placeholder_images` exists again (0 rows before and after).
- Invite codes:
  - `displayInviteCodeResults` prints `Generated Invite Codes:` and `• admin: <code>` (the code is redacted in the log; it is 26 characters);
  - with every row set `is_active=false`, or with every row expired, `activeCodesByType('admin')` is `[]`, and the block prints "No active, unexpired admin invite code exists." (rolled back).
- `php artisan schedule:list` still lists `0 3 * * * php artisan mcpv1:placeholder-cleanup`.
- Workers restarted (`POST :2019/frankenphp/workers/restart` → 200), and `GET http://127.0.0.1:9000/api/health` → 200.

### T12 (merged T12, CKA-32): done
File: `app/Services/SafeMigrationHelper.php`.

Changes:
- One `normalizeIndexColumns()` (lower-case strings, declared order) is used by both `findEquivalentIndex()` (ordered compare) and `indexMatches()` (sorted compare).
- `findEquivalentIndex()` skips pgsql partial indexes. The new `pgPartialIndexNames()` reads `pg_index.indpred IS NOT NULL` for the table in `current_schema()` (the same scope as Laravel's `compileIndexes`) and returns `[]` on other drivers.
- `'morphs'` gets the NOT NULL relax:
  - it left `COMPOSITE_COLUMN_TYPES`, so `isNotNullWithoutDefault()` treats it like any NOT NULL column without a default;
  - the `morphs` branch of `applyColumnDefinition()` now emits `nullableMorphs()` when the relax set `nullable`.
- The three whitespace-only lines (`:276`, `:843` and `:1482` in T11's numbering) are restored to their base content of 8 spaces.

Verification:
- `php -l` is clean.
- The whitespace churn is gone. `git diff --numstat 74e7770` and `--ignore-space-at-eol` are both 191/31, and a hunk scan finds 0 whitespace-only hunks. No `-` line is whitespace-only.
- In rolled-back PostgreSQL transactions:
  - CodeMartV1: `alignTableStructureFromArray` over all 17 `CodeMartV1Initializer::contractTableStructures()` tables, with the initializer's options, reports `aligned` for every table, so zero changes;
  - AppQyV1 (87 tables): `AppQyV1ArticleLibraryInitializer`, `UserInitializationTableService`, `BookReadingProgressTableService` and `ClientDeviceSettingsTableService` all report `exists`, and the TTS engine-config and variant-spec `ensureTableAligned` both report `aligned`, so zero changes;
  - the `idx_*` snapshot of codemartv1 and appqyv1 is identical before and after, so no new `idx_*`.
- Partial-index skip: on main, `pgPartialIndexNames` finds `idx_global_tasks_live_group_key` (`UNIQUE (task_type, group_key) WHERE group_key IS NOT NULL AND status IN (pending, assigned, processing)`). `findEquivalentIndex(main, global_tasks, [task_type, group_key])` returns null, so the partial index no longer satisfies a full-table spec.
- A `morphs` definition with `nullable` builds `owner_type` and `owner_id`, both nullable.
- **Residue list (no drop; harmless duplicates left by T11 run 1):**
  - `codemart_v1_projects.idx_codemart_v1_projects_client_id` duplicates `codemart_v1_projects_client_id_index` (client_id);
  - `codemart_v1_projects.idx_codemart_v1_projects_status` duplicates `codemart_v1_projects_status_index` (status);
  - `codemart_v1_code_reviews.idx_codemart_v1_code_reviews_reviewer_id` duplicates `codemart_v1_code_reviews_reviewer_id_index` (reviewer_id).
- Note, outside the item: the composite types (`timestamps`, `softDeletes`, `morphs`) have a pseudo column name that `getColumnListing()` never returns, so `addMissingColumns()` would retry them on each run. No table definition uses these types today.

Foundation announcement (wordnew-laravel, codemart-laravel):
- On an aligned schema, SafeMigrationHelper behaves as before.
- The one semantic change: a pgsql partial index no longer satisfies an unnamed index spec with the same columns.

### CKA-13: done (ncore CKA-14 can proceed)
Files:
- `app/Apps/DingDuoDuoV1/DingDuoDuoV1Services/DingDuoDuoV1LicenseService.php`
- `lang/en/ding_duo_duo.php`
- `lang/zh_CN/ding_duo_duo.php`

Changes:
- The super-code payload moved into `superPayload()`, next to `lockedPayload()`. It returns `label: null`, and the extension localizes from mode `super`.
- `ding_duo_duo.super_code_label` is removed from en and zh_CN.

Verification:
- `php -l` is clean.
- In-process, `superPayload('DDK2.scratch.sig', {exp, tier, features})` returns `mode: super`, `label: null`.
- `resolveByToken('')` is still `locked`.
- `Lang::has('ding_duo_duo.super_code_label')` is false in both locales.
- A repo-wide grep for `super_code_label` finds only the records under `.claude/agents_shared/`, so there is no dangling reader.

### USER175-07: done
Files:
- `app/Console/Commands/CodeMartV1SeedDemoData.php`
- `lang/en/codemart.php`
- `lang/zh_CN/codemart.php`
- `app/Providers/AppServiceProvider.php`: confirmed, not changed.

Changes:
- Registration confirmed: `AppServiceProvider.php:30,104` registers `CodeMartV1AdminPasswordCommand`.
- `sys:codemartinit` no longer prints a password inline in hardcoded English. It prints:
  - `codemart.cli.seed.password_file`, the secret file path;
  - `codemart.cli.seed.password_current`, the password read from the contract secret file (the seeder summary comes from `CodeMartV1AdminPassword::ensure`);
  - the new `initialized`, `account_list` and `description` keys (en and zh_CN).
- The seeder change that applies a generated password to existing accounts is codemart-laravel's. It has landed: `CodeMartV1DemoSeeder.php:758-762` calls `CodeMartV1AdminPassword::apply()` when it generates the file.

Verification:
- `php -l` is clean.
- `php artisan list` shows `codemart:admin-password` and `sys:codemartinit` with the localized description.
- `codemart:admin-password --help` shows `--file=FILE`.
- Grep for `Codemart#2026` over `poly_apps/laravel_main`: 0 files.
- All new keys resolve in en and zh_CN (`Lang::has` with no fallback), and the codemart, mcp_v1, runtime and ding_duo_duo lang files have full en/zh_CN key parity.
- `displayPassword()`, run against a scratch path, printed both lines, and no secret file was created. The real secret file was only checked for existence, never written.

### USER175-09: done, except the shared-helper call (blocked on USER175-08)
File: `scripts/start.ps1`.

Changes:
- **Blocked:** the call to the shell-windows codemart-admin-password helper (USER175-08) after sys:init. That helper has not landed; a grep over every `*.ps1/psm1/cmd/bat` finds no codemart-admin-password code outside start.ps1. So start.ps1 does not call it yet, and start.ps1 has **no** password generator.
  - "A single generator on Windows" holds today: the only one is Laravel's `CodeMartV1AdminPassword::generate()` through the sys:init seeder.
  - When USER175-08 lands, its win_common helper must be dot-sourced and called right after the sys:init block (`start.ps1`, after "Initializing system"). `--show-codemart-password` may then delegate to the helper's show step.
- **`--show-codemart-password`:** a read-only early exit next to `--show-super-code`, with a usage line.
  - `Get-CodemartAdminPasswordFile` asks Laravel for the contract path (`CodeMartV1AdminPassword::defaultPath()`, kernel bootstrapped, last non-empty output line).
  - `Show-CodemartAdminPassword` prints the file and the password, or "not generated yet (file: …)".
- **Resource index:** after sys:init, `Invoke-LaravelResourceIndexEnsure` mirrors the Linux `ensure_laravel_redis_index`.
  - With phpredis loaded: `app_qy_v1:resource-index status`; if it is not `resource_index_built=yes`, then `rebuild`, then re-check.
  - Otherwise it logs the database fallback.
- **D7 bring-up defect fixed:** the `php -r` helpers no longer contain inner double quotes, which Windows PowerShell 5.1 strips.
  - `New-SecureRuntimeValue` app-key now uses `'base64:'`;
  - `Get-StoredInstallationAccessCode` now uses `get('INSTALLATION_ACCESS_CODE')`;
  - the new helper uses single quotes only.

Verification (`scratchpad/g2_start_verify.ps1`, run with `powershell.exe` 5.1.19041):
- `Parser::ParseFile`: 0 errors for start.ps1 and deploy.ps1.
- Helper functions extracted from the AST and called in a scratch session:
  - the old app-key `php -r` exits 255 (the defect reproduced);
  - `New-SecureRuntimeValue app-key` → `base64:…`, 51 characters; `reverb-key` → 32;
  - `Get-StoredInstallationAccessCode` → 24 characters (value not printed);
  - `Get-RuntimeConfigurationValue` runs with exit 0 (`REVERB_APP_ID` is null in the local store, which is not from this change);
  - `Get-CodemartAdminPasswordFile` → `D:\www\wwwroot\laravel_db\.core_node_secrets\CODEMART_ADMIN_PASSWORD`.
- `Show-CodemartAdminPassword` against a scratch secret file prints its password; against a missing scratch file it prints the not-generated notice. The scratch file was removed.
- The real `start.ps1 --show-codemart-password` run printed the file path and the password (redacted in the log, 24 characters) and exited 0 in 0.9 s. There was no sys:init, no service and no runtime output.
- `--help` lists the new option.
- The resource-index path was checked statically only. phpredis is not loaded on this host, so the runtime branch that runs here is the database-fallback log line; a full start.ps1 run was not repeated.

### D9-09: done
Files: `scripts/deploy.sh`, `scripts/deploy.ps1`.

Changes:
- **deploy.sh.** `run_artisan_sys_init` and `install_laravel_services` are removed.
  - The latter registered the legacy `app-manager-laravel_main` start_service.sh unit, which would compete with 175's `ncore-laravel-<plane>` service on the same port.
  - After `check_initialization` and `run_all_ups`, the main flow calls `run_canonical_start "$@"`, which is `bash "$CANONICAL_START" "$@"`. `CANONICAL_START` is `…/scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh`, the same target as start.sh.
  - 175 ignores unknown args such as `--full-deploy`. Its service prompt defaults to Y without a TTY, so the non-interactive ServerManager `bash deploy.sh` still ends as a service.
- **deploy.ps1.** `Initialize-LaravelRuntime` (config:clear + sys:init) is removed.
  - The main flow runs `& $POWERSHELL_EXE -NoProfile -ExecutionPolicy Bypass -File $CANONICAL_START_PS1` (start.ps1) in its own process, the way start.ps1 runs Step175, and exits 1 on a non-zero exit.
  - The post-start hint points at start.ps1 instead of `php artisan serve`.
  - The variables are declared at the top.
- Discovery is unchanged: both files keep their names and locations (`unified_manager.ps1:83`, `unified_config.sh:47`/`unified_core.py:307`, `systemd_service_manager.sh:208` working-dir rule, ServerManagerV1 `scripts/deploy.sh`).

Verification:
- `bash -n deploy.sh` (wsl -d Debian): exit 0.
- PowerShell parse of deploy.ps1: 0 errors.
- `grep -c sys:init`: deploy.sh 0, deploy.ps1 0.
- Both reference the canonical script: deploy.sh:40 `175_laravel_main_start.sh`; deploy.ps1:24 and :1019 `start.ps1`.
- Scratch call of the extracted `run_canonical_start --help` in Debian: `CANONICAL_START` resolves to `/mnt/d/programing/core_node/scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh`, the args pass through, and 175 printed its usage.

### Cross-scope notes
- **shell-windows (USER175-08):** land the win_common codemart-admin-password helper. pycore-laravel then adds the call after the sys:init block of start.ps1 (see USER175-09).
- **shell-linux (observed during the `--help` delegation check in WSL Debian):**
  - sourcing 175's libraries creates `/opt/core_node/_debian_13`;
  - it prints `[sc] [FAIL] service contract value empty` for `versions.mercure`, `php_runtime.upload_max_filesize`, `post_max_size`, `max_execution_time_seconds` and `max_input_time_seconds`, plus "FrankenPHP root is absent from the service contract".
  - This comes from the contract readers of 175/common. It is not caused by this change.
- **laravel-remote / shell-linux:** a server that ran the old deploy.sh may still have the `app-manager-laravel_main` unit. 175 removes only `ncore-laravel-main` and the opposite plane's unit.
- **CKA-25 (McpV1 i18n):** the remaining English literals in `McpV1Initializer` (for example "Already completed", "Table placeholder_images created successfully") are left for that item. The new messages already go through `mcp_v1.*`.

### Summary
- Status: all 6 items done. USER175-09's helper call is blocked on USER175-08 (shell-windows).
- Next owner: pycore-lead, verdict `reviews/pycore-laravel-G2.json`.
- Scratch files, all in this session's scratchpad: `g2_verify.php`, `g2_start_verify.ps1`, `deploy_fn_check.sh`, `dupidx.php`, `probe1.php`, `probe2.php`.

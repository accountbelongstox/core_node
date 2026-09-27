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

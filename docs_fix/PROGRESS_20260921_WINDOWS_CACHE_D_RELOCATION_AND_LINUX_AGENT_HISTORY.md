# Windows C: Cache Relocation, Unified core_node Data Root, OS-Tagged Var Center — Requirements & Final State

Date: 2026-09-21 (final revision)
Scope: `pycore`, `poly_apps/laravel_main`, `scripts/shells` (sh + ps1), Windows/Linux dual-boot path layout, agent_history service.

## 1. Requirements

1. **Derive and fix every Windows cache/data location that lands on C:.** All caches must relocate to the shared D: layout so a Windows boot loads them correctly.
2. **Share the Windows user-data directories when the NTFS disks are mounted under Linux.** The Linux side must see the Windows agent home slots (kimi/codex/pi/claude) directly.
3. **Fix kimi (and other agent) prompt extraction + real-time monitoring on Linux.** The agent_history service (extract + livePromptMonitor) was down on minimal Linux environments.
4. **C: → D: data migration on the dual-boot machine.** Mount points: `/mnt/dev_nvme0n1p1` = D: (also bound at `/www`), `/mnt/dev_nvme1n1p3` = original C:.
5. **Unify both OSes' `~/.core_node` under `<www>/core_node`** (no dot-prefixed names), with one constants library per language (no duplicate definitions), all shell scripts updated, and data migrated in place. The already-adapted pyservice large-model path mapping must NOT be broken.
6. **Isolate same-key/different-value var-center entries per OS.** On the shared var center, Windows and Linux must not overwrite each other (e.g. `NODE_BIN` = `D:\...` vs `/opt/...`): per-OS subfolders or per-OS key prefixes (`WIN10_`, `DEBIAN_13_`, `UBUNTU_26_`).

## 2. Unified runtime data root: `<www>/core_node`

Both OSes' runtime data (historically `~/.core_node` on Windows, `/var/_core_node` on Linux) now live under ONE no-dot root so a dual-boot machine shares a single tree:

| Environment | Resolved root |
|---|---|
| Windows | `D:\www\core_node` |
| Linux, NTFS D: root mounted at `/www` (dual-boot) | `/www/www/core_node` (== `D:\www\core_node`) |
| Linux, native `/www` | `/www/core_node` |

Single definition per language (all others import/source, never redefine):

- **Python**: `pycore/pyfoundations/core_node_dirs.py` (stdlib-only) — `get_core_node_data_dir()` (env `CORE_NODE_DATA_DIR` wins; Linux fallback chain www → legacy `/var/_core_node` → `~/core_node`), `get_global_var_dir()`, `iter_global_var_dirs()`, `read_global_var()`.
- **Shell**: `scripts/shells/linux/common/runtime_environment.sh` — `CORE_NODE_DATA_DIR` (+ `LEGACY_CORE_NODE_DATA_DIR=/var/_core_node`).
- **PowerShell**: `scripts/shells/win/win_common/GlobalVars.ps1` — `$Global:USER_DIR` / `$Global:GLOBAL_VAR_DIR`.
- **PHP**: `poly_apps/laravel_main/app/Providers/PathMapper.php` — `getCoreNodeRuntimeDir()`; `ServiceContract::globalVarDirectory()` routes through it; contract keys in `config/service_contract.json` (`core_node_data_dir_name`, `global_var_dir_name`).

Deliberately NOT moved (pyservice stability):

- **Shared MODEL cache**: Windows `D:\www\cache`, Linux dual-boot `/www/www/cache`, Linux native `/var/_core_node/cache` (`shared_cache_env.sh` pins `LEGACY_CORE_NODE_DATA_DIR`; `SharedCacheEnv.ps1` sets `HF_HOME`/`HF_HUB_CACHE`/`TORCH_HOME`/`PIP_CACHE_DIR`/`XDG_CACHE_HOME`; py `system_paths.get_shared_download_cache_dir`).
- **POSIX scratch temp**: Linux `/var/_core_node/_tmp`, Windows `D:\.tmp` (unix sockets / flock keep working).

## 3. Var center OS isolation (`<TAG>_<KEY>`)

The shared var center (`<root>/global_var`, one plain-text file per key) is written by both OSes of a dual-boot machine. Rule:

- **Write**: shared-whitelist keys keep their bare name; every other key is stored as `<OS_VAR_TAG>_<KEY>`.
- **Read**: candidates in order `<TAG>_<KEY>` → bare `<KEY>` → same pair under the legacy dirs. The bare fallback keeps unmigrated machines and pre-tagging values working.
- **Tag format**: `ID_MAJOR` from `/etc/os-release` on Linux (`DEBIAN_13`, `UBUNTU_26`; mirrors `dd_helper/system_functions.sh` CURRENT_SYSTEM); `WIN10`/`WIN11` on Windows (kernel build >= 22000 → WIN11).

Shared whitelist (secrets + cross-OS contract/selector values, identical list in all four languages):
`POSTGRES_PASSWORD MERCURE_PUBLISHER_JWT MERCURE_SUBSCRIBER_JWT DNSPOD_API_TOKEN DNSPOD_EMAIL TAILSCALE_DOMAIN_1 DOMAIN_API_REGION_PREFIX DOMAIN_UI_BINDING START_WEB_SERVER WEB_SERVER_PLANE PHP_RUNTIME_PLANE SELECTED_REGION GIT_PUSH_BRANCH GIT_UPDATE_TYPE`

Implementation points:

| Language | File | What changed |
|---|---|---|
| sh | `runtime_environment.sh` | `OS_VAR_TAG` detection, `CORE_NODE_SHARED_GVAR_KEYS`, `gvar_is_shared_key()`, `gvar_write_key()` (exported) |
| sh | `global_var_store.sh` | `set_global_var` writes `gvar_write_key` name; `get_global_var` tries tagged→bare→legacy; `remove_global_vars` removes both variants |
| sh | `gvar_storage_common.sh` | `BASE_DATA_DIR_FILE` uses `gvar_write_key BASE_DATA_DIR` |
| sh | `step_state.sh` | `STEP_STATE_DIR=$GLOBAL_VAR_DIR/step_state/$OS_VAR_TAG` |
| sh | 5 install scripts (155/157/161/167/169) | `APP_VERSIONS_DIR=$GLOBAL_VAR_DIR/app_versions/$OS_VAR_TAG` |
| py | `core_node_dirs.py` | `_SHARED_GVAR_KEYS`, `get_os_var_tag()`, `global_var_write_name()`, `global_var_read_names()`; `read_global_var` searches names × dirs |
| py | `pygvar.py` | `GlobalVarManager.set/get/clear/file_path` route through the write/read name helpers |
| php | `PathMapper.php` | `SHARED_GVAR_KEYS` const, `osVarTag()`, `persistedVarReadNames()`; `readPersistedVar` tries tagged→bare per dir |
| ps1 | `CommonFunc.ps1`, `GlobalVarStoreCommon.ps1` | `Get-OsVarTag`, `$script:SharedGlobalVarKeys`, `Get-GlobalVarWriteName`/`Get-GlobalVarReadNames`; `Get-GlobalVar`/`Set-GlobalVar` use them |
| ps1 | `dd.ps1` | `Store-GlobalPaths` writes `SCRIPT_ROOT_DIR` under its OS-tagged name |

Shared (untagged) by design: `secret_cache/`, `web_access_config.json`, `CODEX_REMOTE_HOST_MAP`, plus the whitelist keys. `dir_processing_cache/` and `file_cache/` are regenerable caches and were left as-is.

## 4. Full path flow map (all classes × definitions × environments)

| Path class | Definition (single source) | Windows | Linux dual-boot (NTFS at /www) | Linux native |
|---|---|---|---|---|
| Runtime data root | `core_node_dirs.get_core_node_data_dir` / `runtime_environment.sh CORE_NODE_DATA_DIR` / `GlobalVars.ps1 USER_DIR` / `PathMapper::getCoreNodeRuntimeDir` | `D:\www\core_node` | `/www/www/core_node` | `/www/core_node` |
| Var center | `get_global_var_dir` / `gvar_system_common.sh GLOBAL_VAR_DIR` / `GlobalVars.ps1 GLOBAL_VAR_DIR` / `ServiceContract::globalVarDirectory` | `D:\www\core_node\global_var` | `/www/www/core_node/global_var` | `/www/core_node/global_var` |
| Var-center legacy read fallback | `core_node_dirs.iter_global_var_dirs` / `LEGACY_GLOBAL_VAR_DIR` / PHP `globalVarDirectories()` | `D:\programing\Users\<U>\.core_node\.global_vars`, `~\.core_node\.global_vars` | `/var/_core_node/global_var` (symlink → new), `~/.core_node/{global_var,.global_vars}` | same |
| Step state | `step_state.sh STEP_STATE_DIR` | — | `…/global_var/step_state/DEBIAN_13` | same |
| App version flags | `APP_VERSIONS_DIR` in install scripts | — | `…/global_var/app_versions/DEBIAN_13` | same |
| Shared MODEL cache | `shared_cache_env.sh` / `SharedCacheEnv.ps1` / `system_paths.get_shared_download_cache_dir` | `D:\www\cache` | `/www/www/cache` | `/var/_core_node/cache` |
| HF / Torch / pip caches | `HF_HOME` / `TORCH_HOME` / `PIP_CACHE_DIR` (SharedCacheEnv) | `D:\www\cache\{huggingface,torch,pip}` | `/www/www/cache/...` | `/var/_core_node/cache/...` |
| OCR models (CnSTD/CnOCR) | `_ocr_models.py` (`CNSTD_HOME`/`CNOCR_HOME` setdefault) | `D:\www\cache\ocr\{cnstd,cnocr}` | same tree | same |
| Scratch temp | `pygvar.TMP_DIR` / `PathMapper::getBaseTempDir` | `D:\.tmp` | `/var/_core_node/_tmp` | `/var/_core_node/_tmp` |
| App config/data/logs/cache/ui_state | `app_config_path.py` under `<root>/{config,data,logs,cache,ui_state}` | `D:\www\core_node\...` | `/www/www/core_node/...` | `/www/core_node/...` |
| Device sync state | device_sync `config.py` | `…\core_node\device_sync` | `…/core_node/device_sync` | same |
| File locks | `file_lock.py` | `<root>`-derived | `<root>`-derived | same |
| Installer scripts dir | `pygvar.INSTALLER_SCRIPTS_DIR` | `…\core_node\installer_scripts` | `…/core_node/installer_scripts` | same |
| Build var files | `build_py_tools/file_var_handler.py`, `scripts/unified_manager/utils/global_variables.py` | `…\core_node\build_global_vars` | `…/core_node/build_global_vars` | same |
| Agent user homes (Pi slots) | `GlobalVars.ps1 PROGRAMING_USERS_DIR` + `system_paths.get_shared_windows_users_roots` / `agent_home_scanner.py` | `D:\programing\Users\{PiKimi,PiCodex,PiClaudeCode,...}` | visible via `/www/programing/Users` (== `D:\programing\Users`) | n/a |
| Migrated per-user data | `<root>/Users/<name>` | `D:\www\core_node\Users\...` | `/www/www/core_node/Users/...` | same |
| Web access config | `ServiceContract::webAccessConfigPath` | `…\global_var\web_access_config.json` (shared) | same | same |
| Secret cache | `<root>/global_var/secret_cache` (shared) | same | same | same |

## 5. Verification (this machine, Debian 13, NTFS dual-boot, 2026-09-21)

- sh roundtrip: `set_var ROUNDTRIP_TEST_KEY` → wrote `DEBIAN_13_ROUNDTRIP_TEST_KEY`, `get_var` read it back; `get_var WWW_PATH` → `/www/www` (bare fallback); `get_var SELECTED_REGION` → `Global` (shared bare); `remove_global_vars` cleans both variants. `STEP_STATE_DIR=…/step_state/DEBIAN_13`; `BASE_DATA_DIR_FILE=…/DEBIAN_13_BASE_DATA_DIR`; `get_base_data_directory` → `/mnt/dev_nvme0n1p1`.
- py: `get_os_var_tag()` = `DEBIAN_13`; `global_var_write_name('BASE_DATA_DIR')` = `DEBIAN_13_BASE_DATA_DIR`, `('POSTGRES_PASSWORD')` = bare; `read_global_var` for `WWW_PATH`/`BASE_DATA_DIR`/`SELECTED_REGION`/`POSTGRES_PASSWORD`/`NODE_BIN` all correct; `GlobalVarManager` set/get/clear roundtrip uses the tagged name.
- php: `PathMapper::getCoreNodeRuntimeDir()` = `/www/www/core_node`, `osVarTag()` = `DEBIAN_13`, `readPersistedVar` resolves `WWW_PATH`/`BASE_DATA_DIR`/`SELECTED_REGION`/`POSTGRES_PASSWORD` correctly (via reflection on the real class with the project autoloader).
- Syntax: `bash -n` on all touched sh files OK; `php -l` OK; `py_compile` OK; pwsh `Parser::ParseFile` OK on `CommonFunc.ps1`, `GlobalVarStoreCommon.ps1`, `dd.ps1`.

## 6. Data migration (executed on this machine)

Phase A (`~/.core_node` → `<www>/core_node`): `/var/_core_node` subdirs (except `cache`/`_tmp`) moved to `/www/www/core_node`; `.build_global_vars` → `build_global_vars`; `D:\programing\Users\mpc\.core_node` (2.9 GB) merged no-clobber with dot-subdirs renamed; `/home/debian/.core_node` and `/root/.core_node` merged then replaced by symlinks; `/var/_core_node` subdirs replaced by symlinks to the new tree (`cache`/`_tmp` kept as real dirs). File-count checks all matched.

Phase B (OS tagging): 120 top-level var-center files renamed to `DEBIAN_13_<KEY>` (none held Windows-format values — the earlier no-clobber merge had kept the Linux values; Windows-side values regenerate under `WIN10_` on next Windows run, which is exactly the conflict this phase eliminates). `step_state/acme_sh_install` → `step_state/DEBIAN_13/`; `app_versions/*.version` → `app_versions/DEBIAN_13/`. Whitelist keys, `CODEX_REMOTE_HOST_MAP`, `secret_cache/`, `web_access_config.json`, and the regenerable cache dirs untouched.

## 7. Earlier requirements (1-3) — resolved

- **Req 1 (C: caches)**: OCR models → `D:\www\cache\ocr\*` via `CNSTD_HOME`/`CNOCR_HOME` (`_ocr_models.py`, upstream `data_dir()` env support verified); Laravel temp → `D:\.tmp` via `PathMapper::getBaseTempDir()`; var center C: location superseded by the unified root (section 2).
- **Req 2 (NTFS-shared Windows user dirs)**: `system_paths.get_shared_windows_users_roots()` scans `/proc/mounts` NTFS mounts and maps `<mount>/programing/Users`, `<mount>/.tmp/Users`; `agent_home_scanner.py` includes them in the Linux scan roots.
- **Req 3 (agent_history on minimal Linux)**: `_getters_core.py` converted to true lazy imports (pip auto-install retained); `pycore/database/__init__.py` converted to PEP 562 lazy exports so `sqlite_readonly` no longer drags in SQLAlchemy. Verified: 7 agent_history modules import OK; real extraction 143 sessions / 998 prompts / 5 tools; `live_scan(['kimi'])` OK.

Side note from the verification environment: its disk hit 96% and pip auto-install failed for space; pip cache was cleaned (freed ~2.7 GB). Watch disk headroom when re-running installs.

## 8. Single path-map library per language + stray `/www` dir cleanup (2026-09-21, phase C)

**Requirement**: `/www/wwwroot`, `/www/var`, `/www/_debian_13` on an NTFS dual-boot mount were offset by one level (correct: `/www/www/...`); every language must have exactly ONE path-map definition, no inline re-implementations.

**Single definitions (everything else delegates/reads)**:

- sh: `runtime_environment.sh` computes and exports `CORE_NODE_WWW_BASE` (`/www/www` when `/www` is a mounted disk root ≠ rootfs device, else `/www`). Readers converted: `gvar_common.sh::www_ntfs_root_mounted` (thin reader), `shared_cache_env.sh` (dropped its inline findmnt fallback), `nginx_manager.sh` + `permissions_fixer_lib.sh` (now source `runtime_environment.sh` directly; `nm_web_path` fallback and `PERMISSIONS_FIXER_WWW_BASE` read the variable), `octane_service_manager.sh` (ReadWritePaths check maps `laravel_db`). Remaining `findmnt` uses elsewhere are distinct predicates (FSTYPE checks, mount-target lookups, `_is_real_distinct_mount`), not the www-base rule.
- pycore: `core_node_dirs.www_data_root_mounted()` / `get_linux_www_base()` is the single definition; `system_paths._www_ntfs_root_mounted()` now delegates (its own `_is_real_distinct_mount` stays for persisted-base revalidation only).
- Laravel: `PathMapper::wwwNtfsRootMounted()` private single definition; `CheckCertbotCommand` now resolves the certbot script via `PathMapper::getWwwRoot(...)`; unused deprecated constants `WWW_ROOT`/`DEFAULT_SITE_DIR`/`SSL_BASE_DIR`/`SSL_CREDENTIALS_DIR` removed from `ServerManagerV1PathConfig` (getters already mapped via PathMapper).
- js: `globaldir.js` (`#@global_dir`) gained the single JS definition (`WWW_BASE`, `mapWebPath`, `wwwDataRootMounted` via `/proc/mounts` longest-prefix source compare); `DATA_DIR` fixed to the NTFS-aware wwwroot. `StaticPathResolver.js` production branches and `VoiceClientAndCaddy config CADDY_WEBSITE_ROOT` now read `mapWebPath`/`WWW_BASE` instead of hardcoded `/www/...`.
- py tools: `sync_mcp_servers_linux.py` fallback tries `core_node_dirs.get_linux_www_base()` then both literal candidates; `file_sync_tool.py` `SERVER_ROOT` resolved via the same helper at load.

**Stray-dir migration (executed, all content verified before deletion)**: `/www/var/_core_node/certs/local/*` (4 mkcert files, only copy) merged into `/www/www/core_node/certs/local/` (`diff -r` identical); `/www/var/_core_node/global_var/POSTGRES_PASSWORD` byte-identical to canonical and legacy copies; `/www/wwwroot/pycore_db/dictionaries/stardict.db` md5-identical to `/www/www/wwwroot/...`; `/www/_debian_13` empty; `/www/var/_core_node/mcp_chrome` empty. Then `/www/wwwroot`, `/www/var`, `/www/_debian_13` deleted — `/www` (D:\) now contains only `www/` as the web tree.

**Phase C verification (this machine)**: `bash -n` all 6 touched sh OK; `py_compile` OK; `php -l` OK; `node --check` OK. Live resolution: sh `map_web_path wwwroot` → `/www/www/wwwroot`; py `map_web_path('pycore_db'|'laravel_db')` → `/www/www/wwwroot/...`; PHP `PathMapper::mapWebPath('wwwroot')` → `/www/www/wwwroot` (real autoloader); js `mapWebPath('wwwroot')`/`DATA_DIR` → `/www/www/wwwroot`; `shared_cache_env.sh` → `SHARED_CACHE_DIR=/www/www/cache` (cross-OS); `permissions_fixer_lib` base = `/www/www`; `nm_web_path wwwroot` = `/www/www/wwwroot`.

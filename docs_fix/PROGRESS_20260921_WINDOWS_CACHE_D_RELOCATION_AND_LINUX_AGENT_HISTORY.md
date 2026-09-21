# Windows C: Cache Relocation, NTFS Shared User Dirs, Linux Agent-History Fix — Requirements & Progress

Date: 2026-09-21
Scope: `pycore`, `poly_apps/laravel_main`, Windows/Linux dual-boot path layout, agent_history service.

## 1. Requirements

1. **Derive and fix every Windows cache/data location that lands on C:.** All caches must relocate to the shared D: layout so a Windows boot loads them correctly.
2. **Share the Windows user-data directories when the NTFS disks are mounted under Linux.** The Linux side must see the Windows agent home slots (kimi/codex/pi/claude) directly.
3. **Fix kimi (and other agent) prompt extraction + real-time monitoring on Linux.** The agent_history service (extract + livePromptMonitor) was down on minimal Linux environments.
4. **C: → D: data migration on the dual-boot machine.** Mount points: `/mnt/dev_nvme0n1p1` = D: (also bound at `/www`), `/mnt/dev_nvme1n1p3` = original C:. Derive the post-migration Windows user-data and cache directories, verify against the Windows-side path rules, then migrate data so Windows boots with correct loading.

## 2. Canonical path mapping (verified on this machine, 2026-09-21)

Mounts (`/proc/mounts`):

- `/dev/nvme0n1p1` → `/mnt/dev_nvme0n1p1` and `/www` (ntfs3, same device) — the Windows **D:** drive. `D:\` == `/www`.
- `/dev/nvme1n1p3` → `/mnt/dev_nvme1n1p3` (ntfs3) — the original Windows **C:** drive.

Windows-side definitions (shell var center, verified in source):

| Item | Windows path | Source |
|---|---|---|
| Shared cache root | `D:\www\cache` | `scripts/shells/win/win_common/SharedCacheEnv.ps1:20` (`$Global:WWW_CACHE_DIR`, `$Global:CORE_NODE_CACHE_DIR`) |
| HF cache | `D:\www\cache\huggingface` (`HF_HOME` / `HF_HUB_CACHE`) | SharedCacheEnv.ps1:72 |
| Torch cache | `D:\www\cache\torch` (`TORCH_HOME`) | SharedCacheEnv.ps1:97 |
| pip cache | `D:\www\cache\pip` (`PIP_CACHE_DIR`) | SharedCacheEnv.ps1:100 |
| Migrated user-data root | `D:\programing\Users` | `scripts/shells/win/win_common/GlobalVars.ps1:165` (`$Global:PROGRAMING_USERS_DIR`) |
| Per-user core dir | `D:\programing\Users\<USERNAME>\.core_node` | GlobalVars.ps1:167 (`$Global:USER_DIR`) |
| Shell var center | `D:\programing\Users\<USERNAME>\.core_node\.global_vars` | GlobalVars.ps1:215 (`$Global:GLOBAL_VAR_DIR`) |
| Agent slot homes | `D:\programing\Users\{PiYolo,PiKimi,PiClaudeCode,PiCodex,PiVolcAgent,PiVolcCoding}` | GlobalVars.ps1:168-173 |
| Temp | `D:\.tmp` | `pycore/pyfoundations/pygvar.py` (`TMP_DIR`) |
| OCR models | `D:\www\cache\ocr\cnstd` / `D:\www\cache\ocr\cnocr` | via `CNSTD_HOME` / `CNOCR_HOME` env |

Linux-side equivalents (same machine): var center `/var/_core_node/global_var`, cache `/var/_core_node/cache`, www root `/www`. The NTFS D: mount exposes the Windows layout as `/www/programing/Users`, `/www/.tmp`, `/www/www/cache`.

## 3. Progress — requirement 1 (Windows C: cache derivation & fixes)

Reported complete and verified (on the Debian 13 working copy):

- **OCR models (CnSTD/CnOCR, hundreds of MB)**: were under `%APPDATA%\cnstd|cnocr` (C:). Changed to `D:\www\cache\ocr\cnstd|cnocr` in `pycore/pyfoundations/third_party/_ocr_models.py` (~line 149). Upstream support for `CNSTD_HOME`/`CNOCR_HOME` verified in cnstd `utils.py` and cnocr `utils.py` (`data_dir()`). Set via `os.environ.setdefault`, so pre-existing directories keep being used and no re-download is triggered.
- **Laravel temp files** (edge-tts and other media previously wrote to `C:\Users\mpc\AppData\Local\Temp`): `PathMapper` gained `getBaseTempDir()` (Windows → `D:\.tmp`, consistent with pygvar `TMP_DIR`) at `poly_apps/laravel_main/app/Providers/PathMapper.php` (~line 674); `getExternalStoragePath('temp')`, log fallback, and `PycoreEdgeTTSUtil` all route through it.
- **Global variable center**: pygvar `GLOBAL_VARS_DIR` was `~/.core_node/.global_vars` (C: on Windows, and wrongly `/usr/.core_node` on Linux). Aligned with the service contract and `gvar_system_common.sh`: Windows `D:\programing\Users\<USERNAME>\.core_node\.global_vars` (mirrors GlobalVars.ps1 `$Global:GLOBAL_VAR_DIR`), Linux `/var/_core_node/global_var`. This also fixes the `runtime_policy.py` vs shell var-center location mismatch.
- Stale C: path comments in `file_lock` / `window_state` corrected (code already used D:, comments were outdated).

## 4. Progress — requirement 2 (NTFS-shared Windows user dirs under Linux)

- `pycore/pyfoundations/system_paths.py` gained `get_shared_windows_users_roots()` (~line 499): scans `/proc/mounts` for all NTFS mounts (`ntfs3`/`fuseblk`, including the case where `3_setting_base.sh` bind-mounts the D: root at `/www`), and maps out `<mount>/programing/Users` and `<mount>/.tmp/Users` (i.e. `D:\programing\Users`, `D:\.tmp\Users`); under WSL it uses `/mnt/<drive>` and includes `<drive>/Users`.
- `pycore/pyfoundations/agent_home_scanner.py` (~line 27): Linux scan roots automatically include these directories, so on dual-boot machines the Linux side can monitor the Windows-side kimi/codex/pi/claude slot histories directly.
- Model-cache sharing (`D:\www\cache` ↔ `/www/www/cache`) was already covered by the existing `_linux_cross_os_cache_dir`; untouched.

## 5. Progress — requirement 3 (Linux agent prompt extraction + live monitor fix)

Root cause: `pycore/pyfoundations/third_party/_getters_core.py` eagerly imported `aiohttp`/`PIL`/`googletrans`/`docx`/`bs4`/`fastmcp`/`google-genai` at module top. On a minimal Linux box, any one missing package crashed the whole `third_party.api`, which broke the chain `cursor_extractor → pycore.database → sqlalchemy`, taking down the agent_history service (extraction + livePromptMonitor).

Fixes:

- `_getters_core.py`: converted to true lazy loading — each package imports on first getter call (pip auto-install retained); `pystray`/`pythoncom` failures return `None`.
- `pycore/database/__init__.py`: converted to PEP 562 lazy exports; `sqlite_readonly` (stdlib `sqlite3` only) no longer drags in the SQLAlchemy chain. `from pycore.database import database_manager` behavior unchanged (submodule shadowing handled).

Verification reported (Debian 13):

- All 7 agent_history-related modules import OK (previously all `ModuleNotFoundError: aiohttp`).
- Real extraction ran: 143 sessions / 998 prompts / 5 tools; `live_scan(['kimi'])` OK; kimi `wire.jsonl` prompt parsing correct.
- All touched `.py` files pass `py_compile`; both PHP files pass `php -l`.
- Path regression: www=`/www`, cache=`/var/_core_node/cache`, var center=`/var/_core_node/global_var` all correct; shared roots empty when no NTFS mounts exist.

## 6. C: → D: migration derivation (dual-boot machine)

Derivation (Windows-side rules from section 2, applied to the mounted disks):

| Source on C: (`/mnt/dev_nvme1n1p3`) | Target on D: (`/www` == `D:\`) |
|---|---|
| `C:\Users\<USERNAME>\.cache\pip` | `D:\www\cache\pip` |
| `C:\Users\<USERNAME>\.cache\torch` | `D:\www\cache\torch` |
| `C:\Users\<USERNAME>\.cache\huggingface` | `D:\www\cache\huggingface` |
| `C:\Users\<USERNAME>\.cache\*` (remainder) | `D:\www\cache\*` (subpaths unchanged, per SharedCacheEnv.ps1) |
| `%APPDATA%\cnstd`, `%APPDATA%\cnocr` | `D:\www\cache\ocr\cnstd`, `D:\www\cache\ocr\cnocr` |
| `C:\Users\<USERNAME>\.core_node` | `D:\programing\Users\<USERNAME>\.core_node` |
| `C:\Users\<USERNAME>\AppData\Local\Temp` (app temp) | `D:\.tmp` |

Post-migration Windows loading is guaranteed by: `SharedCacheEnv.ps1` setting `HF_HOME`/`TORCH_HOME`/`PIP_CACHE_DIR`/`XDG_CACHE_HOME` (respects caller overrides, idempotent), `CNSTD_HOME`/`CNOCR_HOME` via `_ocr_models.py` setdefault, and GlobalVars.ps1 user-dir globals. Existing directories are reused — no model re-download.

Status: path derivation verified against source on this machine; **data copy not yet executed**.

## 7. Outstanding / sync status

- The section 3-5 code changes were implemented and verified on a separate Debian 13 working copy. As of 2026-09-21 they are **not yet present in this checkout** (`/www/programing/core_node` == `/mnt/dev_nvme0n1p1/programing/core_node`): `pygvar.py` still derives `GLOBAL_VARS_DIR` from `~/.core_node`, `_getters_core.py` still has the eager top-level imports, `system_paths.py` has no `get_shared_windows_users_roots()`, `PathMapper.php` has no `getBaseTempDir()`, `_ocr_models.py` has no `CNSTD_HOME`/`CNOCR_HOME` handling. Sync or re-apply is pending.
- C: → D: data copy (section 6) pending execution on this machine.
- Side note from the verification environment: its disk hit 96% and pip auto-install failed for space; pip cache was cleaned (freed ~2.7 GB). Watch disk headroom when re-running installs.

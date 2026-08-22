<!-- Project root is ../ ; laravel_main = ../poly_apps/laravel_main -->
# Laravel Aggregated Application — Core Development Guide

Core rules for `laravel_main`. Follow the existing code style; English only; reuse before adding.

## 1. Framework & boot
- **Runtime upgrade override:** `laravel_main` runs as a FrankenPHP worker with HTTPS/HTTP/3 and 103 Early Hints; `wordnew`, the shared Pycore UI, `pycore-manager`, and `laravel-manager` must consume this capability through centralized contracts and transports; this supersedes the Swoole runtime references below.
- Laravel 13 on PHP 8.4+, pure headless API on port **9000**. `routes/web.php` is the immutable debug entry (`/`, `/api_info`) — never modify it, `app/Console`, or `app/Events`.
- Follow the Laravel 13 upgrade contract: use `PreventRequestForgery`, keep cache unserialization disabled unless classes are explicitly allow-listed, provide non-empty `uniqueBy` values to `upsert`, and never instantiate a model from its own boot cycle.
- **All of Laravel's pre-logic is owned by SHELL scripts and runs under root**: `dd.sh`/`dd.cmd` (installer) → `scripts/shells/.../install_shells` provision PHP/Swoole/Node/PostgreSQL → `poly_apps/laravel_main/scripts/start.sh` boots Octane (Swoole) as systemd unit `ncore-laravel-main`; `pyservice.sh` runs pycore. Migrations/init happen ONLY via `php artisan sys:init` — never `Artisan::call('migrate')`.

## 2. System paths & filesystem (MANDATORY)
- Every system directory goes through `App\Providers\PathMapper` (merged DatabasePathHelper/ExternalStorageHelper/WebPathHelper) and `App\Utils\FileSystemManager`. **Search the code for an existing getter first**; never native `file_*`/`mkdir`/`scandir` or hardcoded paths.
- PathMapper mirrors shell `gvar_common.sh::map_web_path()` and pycore `pyfoundations/system_paths.py`; all three read the persisted `/var/_core_node/global_var/BASE_DATA_DIR`, so shell/PHP/Python resolve the **same** disks — consistent with the dd.sh/dd.cmd/pycore side.
- Cross-OS (scan code for the exact branch): WSL → `/mnt/d`; Linux (Ubuntu/Debian/Kali) → POSIX disk, NTFS/drvfs coerced to `/www` (PG/Laravel need POSIX chown); Desktop Windows mount → `D:\www`; the source tree may stay on NTFS via `getCoreNodeDir()`. PostgreSQL data is pinned to native `/var/lib/postgresql/d`.
- FileSystemManager wraps all fs ops, auto-chowns to the real desktop user via `SystemUserDetector` (root service), and symlinks external paths into `storage/external/` (Swoole-sandbox workaround).

## 3. Database — PostgreSQL only
- PostgreSQL is the **only** active engine (Linux+Windows); driver/host/port/user are fixed in `config/database.php`, password comes from the shell secret store — never read DB config from `.env`. MySQL/SQLite entries are inert stubs.
- One database per sub-app on `localhost:5432` (shared `core_node_main` + `app_qy_v1`, …). Resolve via `AppTablePrefixServiceProvider::getConnection()/buildTableName()` + `App\Constants\AppKeys`; never hardcode connection/table strings (use `{app}TablesMaps` / `GlobalTablesMap`).
- Idempotent never-rebuild migrations: `SafeMigrationHelper::alignTableStructureFromArray()` (create-if-missing + add columns; never drop/truncate in `up()`), enforced by `CheckMigrationSafety`, executed only by `sys:init`. `global_*` files use the default connection; `{appNameWithVersion}_*` files set their own app connection.
- Idempotent extensions may only add/modify table structure & data — never drop or delete columns or data.

## 4. Multi sub-app model framework
- Each app lives in `app/Apps/{appNameWithVersion}/` (version-pinned `{Vx}`); **every filename carries `{appNameWithVersion}`**. Controllers use the **`Ctl`** suffix under `{app}Controllers/`; per-app `{app}Models`/`{app}Services`/`{app}Utils`/`{app}Gvar`. Shared code only in `app/Utils`, `app/Providers`, `app/Helpers` (don't grow Helpers).
- Routes per app in `routes/{appNameWithVersion}Router/`, aggregated by `routes/api.php`. Each app exposes `{app}ApiInfo.php`; all metadata is surfaced at `/api_info`.
- Controllers MUST use `App\Traits\ApiResponse` + `App\Helpers\AuthHelper`; no try-catch; error messages must state the exact cause.

## 5. Data-processing model — Octane + pycore + chrome-mcp
- Octane (Swoole, :9000) is the **sole** task driver: `OctaneTimerServiceProvider` ticks 1s and runs `TimerTasks/*`; no `queue:listen`/scheduler.
- The `global_tasks` table is the **single source of truth**; **pycore** (RPC `:59000`) and **chrome-mcp** (`apps/mcp-chrome`) are pull workers that claim tasks atomically (`lockForUpdate`) by `execution_type` lane + capability. PHP→pycore bridges live in `app/CallPycoreUtils/Pycore{Feature}Util.php` (Process/RPC, JSON in/out, always a `success` field).

## 6. UI end
- The UI is `poly_apps/pycore_laravel_wordnew_ui` (React/Vite shell wrapping laravel-manager); it calls Laravel `:9000` with stored-first multi-endpoint health-check failover. The frontend goes through TypeScript data models — components never call APIs directly.
- Build/run any `poly_apps/*` frontend only via its `scripts/start.sh` (pnpm + Vite; `-f` recreates `node_modules`). The installed pnpm is **v11**: each native/postinstall dep must be approved as `allowBuilds: { dep: true }` in that project's `pnpm-workspace.yaml`, else `pnpm install` aborts with `ERR_PNPM_IGNORED_BUILDS`. `onlyBuiltDependencies` and the `package.json` `packageManager` pin are dead (corepack off — global v11 runs).

# Plan: path-mapping consistency, open_basedir fix, CUDA resolver unification

Three threads from the `35_PHP85_CONFIG` log + the "unify CUDA / packages, keep idempotent + kali/debian/ubuntu" request. All changes reuse existing distro-agnostic helpers (`map_web_path`, `nvidia-smi`); no new distro branches.

## Thread A — path-mapping consistency (Windows-disk mounts)

`34_configure_php85.sh` itself is correct (uses `map_web_path "wwwroot"` → `/mnt/dev_nvme1n1p1/www/wwwroot`, the right mapped path). The inconsistency is in sibling scripts that hardcode `/www/wwwroot/...` and break when the data disk is a Windows/NTFS mount at `/mnt/...`.

1. **`common/permissions_fixer_lib.sh:135`** — REAL BUG: `map_web_path "laravel_data_dir"` uses a non-existent key (correct key is `"laravel_db"`, gvar_common.sh:1222). The wrong key falls through to the `*)` default → returns the literal `"laravel_data_dir"` (a bogus relative path), so the `:137` `/www/wwwroot/laravel_db` fallback is dead code and the function chmods a non-existent dir. Fix: `"laravel_data_dir"` → `"laravel_db"`. Keep `:137` as last-resort fallback (only reached if `map_web_path` returns empty).
2. **`dd_helper/permissions_repair_menu.sh:69`** — `laravel_db_dir="/www/wwwroot/laravel_db"` hardcoded → `$(map_web_path "laravel_db")` (with the same `/www/wwwroot/laravel_db` fallback for safety).
3. Leave as-is (verified already correct/path-agnostic):
   - `octane_service_manager.sh:151` — grep regex `.*/www/wwwroot/laravel_db` already matches any base.
   - `install_dictionaries.sh:46-48` — already tries `map_web_path('pycore_db')` via Python first; `$REPO_ROOT/www/...` is only the defensive fallback.
   - `permissions_fixer_lib.sh:125-127` — `wwwroot` key is correct; `:127` `/www/wwwroot` is the unreachable fallback.

## Thread A2 — open_basedir false WARNING (the actual log noise)

`debian_com/php_common_functions.sh:400` parses `php -i | grep open_basedir | cut -d'>' -f2` → yields `no value =` (fragile), so the `= "no value"` equality at `:408` fails → false "CLI open_basedir is still restricted" warning. CLI open_basedir is actually disabled (the log shows `no value`). Also `:404` queries `php-fpm8.4` while the script targets PHP 8.5 (FPM is moot anyway — Swoole).

Fix `verify_open_basedir_config_from_php_common` (lines 400, 404, 408, 414):
- CLI: replace with `php -r 'echo ini_get("open_basedir");'` (authoritative; empty = unrestricted). Treat empty / `none` / `no value` as disabled.
- FPM: use `php -c /etc/php/${PHP_VERSION}/fpm/php.ini -r 'echo ini_get("open_basedir");'` (correct version, tolerant of FPM-not-installed via `2>/dev/null` + empty=disabled). `PHP_VERSION` is sourced from `php_common_vars.sh` (8.5).
- Idempotent: verify is read-only; the existing `configure_php_for_laravel_from_php_common` (remove `^open_basedir` then append `open_basedir = none`) is already idempotent and unchanged.

## Thread B — unify the two CUDA resolvers into ONE

`torch_cuda_index.sh` and `paddle_cuda_index.sh` duplicate the `nvidia-smi` → `cv` parse; only the tag table + base URL differ (torch: cu118/121/124/126/128/130 @ pytorch.org; paddle: cu118/126/129/130 @ paddlepaddle.org.cn — paddle has NO cu124/cu120 cp313 wheel, so its table must stay distinct; cu118 stays correct on a 12.4 driver, per the `paddle-cu118-forced-py313` memory).

1. Create **`common/base_libs/cuda_index.sh`** (single source) containing:
   - `cuda_driver_cv()` — shared `nvidia-smi` parse → numeric (e.g. `1204`). Single source of truth for the driver CUDA version.
   - `torch_cuda_index_url()` — torch tag table + `https://download.pytorch.org/whl/$tag` (default cu124). Uses `cuda_driver_cv`. Preserves the "mirrors `third_party.py::_resolve_pytorch_cuda_index_url`" parity comment.
   - `paddle_cuda_index_url()` — paddle tag table + `https://www.paddlepaddle.org.cn/packages/stable/$tag/` (default cu126). Uses `cuda_driver_cv`.
   - Respects existing env overrides `PYTORCH_CUDA_INDEX_URL` / `PADDLE_CUDA_INDEX_URL`.
2. Update 6 `source` paths → `base_libs/cuda_index.sh`:
   - `common/torch_cpu_guard.sh:45` (also covers `97_install_deepseek_ocr.sh`, which sources the guard transitively)
   - `common/paddle_cpu_guard.sh:38`
   - `common/iniscripts/install_gptsovits.sh:55`
   - `common/iniscripts/install_melotts.sh:50`
   - `debian/install_shells/96_install_deepseek.sh:27`
   - `debian/install_shells/98_install_qwen25.sh:26`
3. Delete `base_libs/torch_cuda_index.sh` + `base_libs/paddle_cuda_index.sh`.
4. Keep each caller's inline `command -v … >/dev/null 2>&1 || <name>() { … }` fallback (default cu124/cu126) — only fires if sourcing fails.
5. No behavior change: torch still resolves cu124 on a 12.4 driver; paddle still resolves cu118. Idempotent + cross-distro (nvidia-smi is universal).

## Thread C — idempotency + cross-distro (verification lens, no separate work)
- All edits use existing helpers (`map_web_path`, `get_base_data_directory`, `nvidia-smi`, `ini_get`) that are already kali/debian/ubuntu-agnostic via `SYSTEM_NAME`/`SYSTEM_VERSION` and `/etc/os-release`.
- No new install/force-reinstall patterns introduced (the prior paddle `--force-reinstall` removal stands).
- After edits: `bash -n` syntax-check every touched file; re-run `14_install_python_prereq_packages.sh` guard probe (no-op) and the PHP verify to confirm the WARNING is gone.

## Files touched (9)
Edit: `permissions_fixer_lib.sh`, `permissions_repair_menu.sh`, `php_common_functions.sh`, `torch_cpu_guard.sh`, `paddle_cpu_guard.sh`, `install_gptsovits.sh`, `install_melotts.sh`, `96_install_deepseek.sh`, `98_install_qwen25.sh`.
Create: `base_libs/cuda_index.sh`. Delete: `base_libs/torch_cuda_index.sh`, `base_libs/paddle_cuda_index.sh`.

## Out of scope
- Python counterpart `pycore/pyfoundations/third_party.py` (shell parity comment preserved; no behavior change needed).
- "搜索文档所有包能否统一" beyond CUDA: the cross-script package/dep-map alignment is already tracked by the `prereq-thirdparty-dep-alignment` memory; the only live churn (paddle `--force-reinstall`) was fixed last turn. No further package unification needed unless you name a specific conflict.

# Shell Layer and Hosts

Scope: `dd.sh`/`dd.cmd` startup and prerequisite steps, repository sync (`gitsync`), the dual-boot drive layout, domains and tailnet HTTPS, service convergence, SSH, host resources and GPU policy, the pycore process on desktop hosts (service, log, terminal backup, terminal control), LAN access, and pycore on a notebook host (Colab/Kaggle).

Authority: code > config/*_contract.json > this document.

Shell rules that also apply: `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`, `development-guides/LINUX_SHELL_RULES.md`, `development-guides/DIRECTORY_NAMESPACE_RULES.md`. Linux and Windows features stay in parity (Debian 13, Ubuntu 26.04, Kali; Windows 10/11 PowerShell 5.1).

## 1. Hosts

- Machine and endpoint lists come from live discovery (`tailscale status`), never from static lists.
- Kinds of host:
  - Dual-boot desktops (Windows + Debian on the same disks; e.g. `debian-gpu`).
  - Linux-only desktops (e.g. `debian-cpu`, Intel iGPU only).
  - The Laravel server `laravel-main` (Debian VM, 2 vCPU, 3.7 GB RAM): FrankenPHP plane (`PHP_RUNTIME_PLANE=frankenphp`), PostgreSQL 15, Redis.
  - Notebook hosts (Colab/Kaggle), section 15.
- A pycore node is either a GPU node or a CPU node: the `compute_class` (`gpu` | `cpu_only`) of its worker registration. A host that can act on windows, terminals and the clipboard advertises the relay capability `desktop_session` (`config/pycore_relay_contract.json` `host_capabilities`).

## 2. dd.sh / dd.cmd startup

### 2.1 Entry points
- `dd.cmd` bootstraps Windows: it runs the local `scripts/shells/win/dd.ps1`, or downloads `WinScriptsInstaller.ps1` from Gitee into `D:\programing\Users\<user>\.core_node\` and runs the downloaded `dd.ps1`.
- `dd.sh` (repo root; linked to `/usr/local/bin/dd.sh`) runs `main` with no arguments, else `dd_dispatch_arguments`.

### 2.2 Load chains (`dd.sh`)
- `DD_CORE_FILES`: `gvar_common.sh`, `dd_helper/constants.sh`, `common/arrow_menu.sh`, `dd_helper/system_functions.sh`.
- `DD_HELPER_FILES` (startup chain): cache_functions, file_validation, file_download, file_processing, secret_functions, smart_permissions, dev_cache_cleanup, linuxenvs_sync, `common/git_sync_common.sh`, main_execution.
- `DD_MENU_FILES` (menu chain, loaded by `load_dd_menu_helpers` right before the countdown): main_functions, git_functions, menu_functions, management_and_backup, natgateway_helper, linux_management, menu_display (fallback menu).
- One definition per function: `check_and_install_sudo` (gvar), `check_and_install_dos2unix`, `manage_natgateway` (`natgateway_helper.sh`). Helpers never re-source constants. `dd_helper/constants.sh` owns `DD_SH_TARGET_DIRS`, `DD_MENU_COUNTDOWN_SECONDS=5`, `RESOURCE_LIMITER_SCRIPT_RELATIVE` (`common/resource_limiter_common.sh`).

### 2.3 Startup order (`main`)
FILE CHECK → SMART SETUP (environment in the foreground; project/data-root permission repair detached) → SECRETS (detection only, queued) → directory-cache cleanup → FILE PROCESSING (CRLF→LF, +x) → script paths into the var store → PROJECT VALIDATION (`PROJECT_VALIDATOR_MODE=defer`) → BASE SETUP → entry-point links → system detection + `smart_permissions_report` + `[STARTUP] Ready in Ns` → menu chain → one stacked prompt (5 s) → menu.

Rules:
- Startup never stops for Y/n. Every confirmation goes through the queue in `common/prompt_common.sh`:
  - `prompt_queue_add id default text accept_fn [decline_fn]`, `prompt_queue_commit`, `prompt_queue_flush timeout`; `PROMPT_QUEUE_DEFERRED=true` during startup.
  - Answers: Enter/timeout = each item's default; `y` = all; `n` = none; `1,3` = listed only. Decline handlers receive `declined` or `default`.
  - `prompt_countdown_read` shows the live countdown; the first key stops it. If an accepted action printed output, a second 5 s countdown keeps it on screen.
  - Menu actions (e.g. Clear and Re-decrypt Secret Keys) flush immediately.
- Secrets: one item decrypts missing/changed files, one re-encrypts raw files newer than their encrypted copy. Mode menus and passwords run only after acceptance. An explicit decline of changed files refreshes the hash baseline.
- Project validator: `defer` records `PROJECT_RESTORE_PENDING`; accepting the queued item runs `PROJECT_VALIDATOR_MODE=restore`.
- `.sh` processing: one `find -printf` per directory; candidates are files with a ctime newer than the last run or without exec; the whole directory is re-verified every 24 h; CR fix and chmod run in batches.
- Permission repair: `repair_owned_tree_777` walks once and repairs only mismatched entries. As root the dd.sh repair runs detached under `flock`; its log is `$CORE_NODE_INSTALLER_STATE_DIR/dd_startup/permissions.log`.
- Log limits, dev-cache and `/var/log` cleanup are not startup steps: Linux System Tools → Slim & Disk Cleanup (`dev_cache_cleanup_menu`, `system_log_limits_menu`). Dev-cache sizes are measured in parallel.
- linuxenvs sync relinks only wrong links.

### 2.4 Repository sync and deploy (`gitsync`)
- `gitsync` is the sync and deploy path for every host: `scripts/linuxenvs/gitsync.sh` (on PATH), `dd.sh gitsync [--dry-run] [-m <description>] [description...]` (`common/git_sync_common.sh::git_sync_cli`; `-m` skips the 3s prompt for AI commits), Windows `scripts/winenvs/gitsync.ps1`. One implementation per OS: `common/git_sync_common.sh::git_sync_run`, `win_common/GitSyncCommon.ps1`.
- Flow: resolve the project root (`CORE_NODE_PROJECT_ROOT`, never hardcoded) → ensure `origin` is the GitHub SSH remote (never Gitee; `scripts/git/git_remotes.conf`) → clear stale git locks (older than 60 s) and resume a pending merge state → `git add .` → commit with a generated message `<system><version>[VM]<YYYY-MM-DD-HH-MM-SS>[-description]` (skipped when nothing is staged) → `git pull --no-rebase origin main` → `git push origin main`. A failed pull or a conflict skips the push and lists the conflicted paths. `--dry-run` runs only read-only git commands.
- A host deploys new code by running `gitsync`, then the step that owns the changed runtime (e.g. 175 for laravel_main).
- Code Sync (`pyservice codesync`, `common/codesync_service.sh`) is retired and frozen and is not started by default; `service_slimming_common.sh` offers to disable a running `codesync.service`.

## 3. Prerequisite steps

### 3.1 Step 175 (laravel_main start)
`scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh` (Windows `Step175_LaravelMainStart.ps1`) is the single canonical laravel_main start and a heavy provisioning script; it is not run for small fixes. `poly_apps/laravel_main/scripts/start.sh` delegates to it.

Order: PHP and extensions → composer → SSH server (`23_setup_ssh_remote.sh`, skipped with `--skip-ssh`) → runtime dirs → PostgreSQL (probe-first) → 7z, ECDICT → book seed corpus → Node.js → shared client key → data-dir ownership → `php artisan sys:init` → Redis index → optional CodeMart data (`CODEMART_INIT=yes|no`) → public-reachability probe → plane web/domain phases → optional nexus-dash UI service → declarative unit convergence → port check → optional service registration → runtime start.

Modes: `--domains-only`, `--ssl-only`, `--no-domains`, `--skip-ssh`.

- PostgreSQL: skipped when the cluster accepts connections, every app DB in `APP_DB_NAMES` exists and no database shows collation drift (`PG_COLLATION_DRIFT`; `PG_ENSURE_FORCE=yes` overrides). `75_install_postgresql.sh::pg_refresh_collation_versions` heals glibc collation drift (e.g. after a point upgrade): each database whose `datcollversion` differs from `pg_database_collation_actual_version` gets `REINDEX DATABASE` then `ALTER DATABASE ... REFRESH COLLATION VERSION` (a database that accepts no connections is only stamped); in-sync databases are untouched. `75_install_postgresql.sh` never re-points a cluster that holds user databases; relocation needs `PG_RECONCILE_DATA_DIR=yes`. Adopting a data dir enforces `postgres:postgres 0700`.
- Book seed corpus (`ensure_book_seed_corpus`; Windows `Ensure-LaravelBookSeedExtracted` in `FrankenPhpManager.ps1`): contract `book_seed` (`archive_subpath`, `archive_name` = `bible-corpus.unique.tar.xz.js`, `top_dir` = `zeoinjesus-bible`, `target_subpath` = `seed_data/books`). It extracts into a same-filesystem temp dir under `<laravel_db>/seed_data` and moves the top dir into place, so a partial extract never passes the presence check (`*.json` in the corpus dir = skip). Linux installs `xz-utils` only when xz/tar are missing; Windows uses `System32\tar.exe -xJf`, else 7z. Ownership follows `laravel_db`.
- `sys:init` prerequisites: Laravel's `sys:init` (`AppQyV1BookSeedImporter`) only reads the extracted corpus and runs no tar/xz/apt; a missing corpus is a warning that names step 175 (lang `book_seed_corpus_missing`). Run 175 once before the first `sys:init` that seeds books.
- Secret masking: `global_var_store.sh` prints a changed value as `******` when the key matches `*TOKEN*|*PASSWORD*|*SECRET*|*PASSWD*|*_KEY|*APIKEY*|*CREDENTIAL*`, so 175/Step175 logs never show secrets or access values.
- Laravel `SystemInfoService` caches each tool-version probe for 24 h (`system_info:tool_version:<tool>`).

### 3.2 Step 197 / Step69 (frontend packages)
- `197_install_frontend_packages.sh` (prerequisite key `frontend_packages`; Windows `Step69_InstallFrontendPackages.ps1`; `--force` → `start.sh --force-install`; 193 is the window launcher shortcut) installs the one bun workspace `poly_apps/pycore_laravel_wordnew_ui` (`callmodule_config.FRONTEND_DIR`) through the UI's own `scripts/start.sh --prepare --dev` / `start.ps1 -Prepare` (node + bun, `bun install` against `bun.lock`, vite verified, no server started).
- Linux on an NTFS checkout binds `<trees_root.linux>/<ns>/node_modules` over the in-repo mount point with `project_tree_ensure`; Windows junctions to the E: trees root through `Invoke-ProjectTreeLinks` (section 4.4).

### 3.3 Prerequisite runner
- One manifest: `config/service_contract.json` `prerequisites` (`linux_script_dir`, `windows_script_dir`, ordered `steps`: `id`, `linux[]`, `windows[]`, `skip_env`, `mode`, `full`, optional `provides`). Readers: `prepare_pycore_prerequisites.sh` (Linux rows), `PycorePrerequisitesList.ps1` + `PreparePycorePrerequisites.ps1` (Windows rows in `windows[]` order; a step with no Windows script is skipped; any pending script marks the step pending), `pycore/pyutils/common/prerequisite_steps.py` (missing-prerequisite report). No script keeps its own step list. `device_tools` = Linux 149 / Windows Step27 (adb) + Step68 (scrcpy), `provides` adb, scrcpy; `dictionaries` has no Windows step.
- `scripts/shells/linux/common/prepare_pycore_prerequisites.sh`: a step that fails or exceeds `PYCORE_PREREQ_STEP_TIMEOUT_SECONDS` (`timeout --kill-after=30`; unset = unlimited; exit 124 and the KILL exit 137 both count as timeout) prints `[skip] ...` and is retried on the next run; a summary lists skipped steps.
- HF repo installs walk the catalog once (`install_hf_repo_flat`). `ensure_pip_for_base` adds `python<ver>-venv` for an interpreter without ensurepip, then falls back to get-pip.py.

### 3.4 Model-weight and binary installers
- Shared helpers (both OSes, run with the installer's interpreter): `pycore/tts_install_assets/hf_prefetch.py` (`snapshot_download` into the HF hub cache runtime reads offline; `--check` is cache-only and prints `__HF_READY__` / `__HF_MISSING__`), `nltk_prefetch.py` (downloads only absent resources into one dir; fails when a resource is still absent), `ocr_models_prefetch.py` (`cn [--gpu]`, `easyocr`). Wrappers: Linux `tts_install_assets_common.sh` (`hf_hub_cache_prefetch`, `nltk_data_prefetch`); Windows `TtsInstallAssetsCommon.ps1` (`Invoke-InstallerPython` — non-zero exit is an error, `Test-HfHubFilesCached`, `Invoke-InstallerPythonHfEndpoints`, `Install-HfHubCacheRepo`, `Install-NltkDataResources`). HF downloads try the official Hub first, the mirror only as fallback; errors are printed, never swallowed.
- Weight paths come only from the shared cache (section 4.3): installers source `shared_cache_env.sh` and require `CORE_NODE_CACHE_DIR`; staging = `<shared cache>/pycore/<engine>` = Python `get_local_data_dir()/<engine>`. No repo, `$HOME` or `%USERPROFILE%` fallback; the docker runner fails with `staging_unresolved` instead. NLTK data lives in `NLTK_DATA` = `<shared cache>/nltk_data` (melotts, gptsovits); the TTS launcher checks the same root.
- Per step (installed-skip and status-only exits require verified weights, not only a sentinel):
  - cosyvoice 133 / Step52: `FunAudioLLM/<leaf of cosyvoice_model_dir>` → `<staging>/pretrained_models/<leaf>`; sentinel `<staging>/pretrained_models/.<leaf>.model_installed` plus non-empty `cosyvoice2.yaml`, `llm.pt`, `flow.pt`, `hift.pt` (same as `cosyvoice_engine.model_ready`).
  - f5tts 135 / Step53: `SWivid/F5-TTS` `F5TTS_v1_Base/model_1250000.safetensors` and `charactr/vocos-mel-24khz` `config.yaml` + `pytorch_model.bin` in the HF cache, gated by `hf_prefetch.py --check`.
  - melotts 139 / Step55: NLTK `averaged_perceptron_tagger`, `averaged_perceptron_tagger_eng`, `cmudict`; `myshell-ai/MeloTTS-<lang>` `config.json` + `checkpoint.pth` and the BERT repo of each language; tokenizer files of all six BERT repos always (`melo.text.cleaner` imports every language). Runs on the provisioned fast path too.
  - bark 141 / Step59 and parler 181 / Step60: `install_hf_repo_flat` into `<staging>/weights` with the `tts_model_tiers.HF_ALLOW` allow-lists.
  - sherpa 31 / Step70 (`SHERPA_SKIP`): `sherpa-onnx` plus the Kokoro multi-lang model (`tts_model_tiers.kokoro_url`: GPU full, CPU int8) into `SHERPA_TTS_MODEL_DIR`, else `<shared cache>/tts/sherpa`; `.model_installed` sentinel plus onnx and `tokens.txt`; resumable download with a Content-Length check.
  - whisper 127 / Step42: URL only from the installed `whisper._MODELS`, file named after the URL leaf in `WHISPER_CACHE_DIR`, sha256 from the URL verified. faster-whisper 151 / Step11: `faster_whisper.download_model` of the tier model on every run (HF hub cache).
  - ocr 125 / Step46: `ocr_models_prefetch.py cn` (CPU set) and `cn --gpu` on GPU hosts into `CNSTD_HOME`/`CNOCR_HOME`; EasyOCR `Reader(download_enabled=True)` into `EASYOCR_MODULE_PATH/model`.
  - ffmpeg 115 / Step67: Linux apt (visible errors, failure = exit 1 so the runner retries); Windows catalog entry `FFmpeg` (winget `Gyan.FFmpeg`); check `ffmpeg` + `ffprobe` on PATH.
  - device tools 149 / Step27 + Step68: adb (apt / platform tools) and the official Genymobile scrcpy release (version `versions.scrcpy`, dir `paths.drive_layout.scrcpy_bundle_dir`; sha256 from the release `SHA256SUMS.txt`) into Linux ext4 `<cache_root.linux>/scrcpy` or Windows `<CN_TOOL_ROOT>\scrcpy`; both export `SCRCPY_HOME`. The scrcpy-based device apps `pyapps/matrix` and `apps/matrix` are archived by user decision (no feature work); the install step stays.

## 4. Dual-boot drive layout

Contract: `config/service_contract.json` `paths` (`linux_ntfs_policy`, `linux_data_dir_candidates`, `linux_data_dir_selection`, `drive_layout`). Shell centers: `SharedCacheEnv.ps1` (loaded first by `GlobalVars.ps1`) and `shared_cache_env.sh` / `gvar_common.sh` / `runtime_environment.sh`. Literals are never redeclared.

### 4.1 Drive roles and namespaces
- Windows: C: system; D: data (`D:\www`); E: programs, toolchains, caches, build output (`E:\core_node_compiler`). Linux: ext4 `/opt/core_node`; NTFS shared data `/www/www` (= `D:\www`); `/www/core_node_compiler` holds only the empty trees mount point.
- One namespace directory per drive/filesystem; no new top-level dirs. Legacy top-level dirs stay until a user-approved migration (an existing `/opt/<SYS_DIR>` stays sticky).
- E: qualifies only when it is ready, Fixed, NTFS/ReFS, its PARTUUID matches the recorded one (global vars, never committed), and `E:\core_node_compiler\.cn_volume` exists. While E: does not qualify, callers print an explicit notice that these files belong on E: and use the D: fallback (`tool_root` `D:\www\.dev_<sys>`, `cache_root` `D:\www\cache`, no trees).
- Linux never mounts E: (`linux_mounts_program_drive=false`): every disk selector skips its PARTUUID, and `mount_common.sh` ensures a udev `UDISKS_IGNORE` rule.

### 4.2 Linux NTFS policy (`linux_ntfs_policy = code_and_shared_data`)
- An NTFS mount on Linux holds source code and data both OSes share. Never on NTFS: install paths, package caches/stores, build output, compile bases, temp, node_modules/vendor/.venv, Linux-only service state (database clusters), Linux-only desktop caches, recycle bins.
- Data dir: an exported `CORE_NODE_DATA_DIR` wins; else `/www/www/core_node` (dual-boot rule), `/www/core_node` (non-NTFS `/www`), `/var/_core_node`, `~/core_node`.
- Tool root: `get_dev_compile_base` returns the legacy `/opt` when `/opt/<SYS_DIR>` exists, else `/opt/core_node`; low `/opt` space only warns, it never falls back to NTFS.
- Toolchain caches (`cache_root.linux` = `/opt/core_node/cache`, `cache_subdirs`): `BUN_INSTALL_CACHE_DIR`, `npm_config_cache`, `UV_CACHE_DIR`, `COMPOSER_CACHE_DIR`, `COREPACK_HOME`; the pnpm store stays in its existing ext4 location.
- Scripts never move or delete existing NTFS files.

### 4.3 One shared model-weight cache
- `D:\www\cache` = Linux `/www/www/cache` on a dual-boot host; Linux-only hosts use `/var/_core_node/cache`. Both OSes download every model once into this tree; weights are device-agnostic (GPU and CPU).
- `shared_cache_env.sh` exports `HF_HOME`, `HF_HUB_CACHE`, `HUGGINGFACE_HUB_CACHE`, `TORCH_HOME`, `PIP_CACHE_DIR`, `WHISPER_CACHE_DIR`, `EASYOCR_MODULE_PATH`, `NLTK_DATA`, `HF_HUB_DISABLE_SYMLINKS=1`, and `XDG_CACHE_HOME` (the cache root on the cross-OS tree, mirroring `SharedCacheEnv.ps1`; `<cache>/xdg` otherwise). pycore resolves every weight path through `get_shared_download_cache_dir()` or these variables, with no `~` fallback.

### 4.4 Project trees (`node_modules`, `vendor`, `.venv`)
- Each OS needs its own trees (native addons, `.bin` shims, store layout); sharing them corrupted NTFS.
- Windows owns every link (`ProjectTreeCommon.ps1`). With a qualifying E:, each tree is a junction `cmd /d /c mklink /J <repo>\<rel>\<dir> <trees_root>\<ns>\<rel>\<dir>` (never `New-Item -ItemType Junction`; its empty PrintName is unreadable by ntfs3). States: missing → create; correct → no-op; foreign/dangling → delete the link only; empty real dir → remove; real dir with content → rename into a quarantine, never auto-deleted. `Remove-Item -Recurse` / `rd /s` are never used near links. Without E: the normal in-repo directory stays.
- Linux makes zero reparse writes on NTFS (`project_tree_common.sh`): ext4 `<trees_root.linux>` is bind-mounted once onto the empty mount point `/www/core_node_compiler/trees` (written only after `mountpoint -q`); for a plain in-repo directory a per-project runtime bind from `<trees_root.linux>/<ns>/<dir>` is used (needs sudo).
- After an OS switch, `php artisan optimize:clear` runs for Laravel (vendor is per OS). `.gitignore` carries `**/node_modules`, `**/vendor`, `**/.venv`.
- Namespace: repo-relative path, `/` → `__`, lowercase. `toolchain_env_file`: Windows `<tool_root>\bin\toolchain.env`, Linux `/opt/core_node/toolchain.env`.
- Target wrap-type toolchains: node, npm, pnpm, bun and composer reached only through static wrappers that read `toolchain.env` (`KEY=VALUE`, no PATH). Install verbs refuse to run on Linux unless the tree mount is ext4. Not yet implemented (Open items).

### 4.5 NTFS dirty-volume root cause and mount hardening
- Root cause: Linux toolchains hard-linked caches from `D:\www\cache` (via `XDG_CACHE_HOME`) into in-repo node_modules on the same NTFS volume through ntfs3, which wrote Win32-illegal names and bad reparse entries. Windows did not repair it because a data volume in "Online Scan Needed" is not repaired at boot, `pagefile.sys` on D: blocks `chkdsk D: /f` until the next Windows boot, and the firmware boots Debian first.
- `mount_common.sh`: `windows_names` (kernel 6.2+) and `x-gvfs-notrash` on every NTFS mount; NTFS fsck pass 0; a dirty volume stays read-write through a runtime-only `ntfs-3g` fallback (never persisted), prints a warning, and schedules one Windows boot with `grub-reboot` (only with `GRUB_DEFAULT=saved`); never `force`, never `ntfsfix`. Boot convergence runs every boot (`core-node-ntfs-converge.service`). Services that write `/www` carry `RequiresMountsFor=/www`.
- No recycle bin on an NTFS mount: no `gio trash`/`trash-put`/`send2trash`; `mount_common.sh` places an empty root-owned `.Trash-<uid>` file at the mount root when none exists and reports an existing trash dir without touching it.
- Windows: `menu_itemshells/DiskRepairManager.ps1` ("Repair Disk (chkdsk /f)", `chkdsk <Drive>: /f`), `DualBootReadinessManager.ps1` + `win_common/DiskReadinessCommon.ps1` (Fast Startup off, BitLocker limited to fixed internal volumes, health-state detection, restart prompts default Y/n with a one-time UEFI BootNext into Windows).
- RTC: Windows `Step2_SetBaseSettings.ps1::Set-RtcUniversalTime` sets `RealTimeIsUniversal=1` and the shared var `WINDOWS_RTC_UTC=1`; Linux `desktop_system_policy.sh::ensure_rtc_utc` switches the RTC to UTC only after that var exists.

## 5. Permissions

- `fs_perm_helpers.sh::repair_owned_tree_777` prunes directories owned by service accounts (1 ≤ uid < `FS_PERM_REGULAR_UID_MIN`, or `FS_PERM_NOBODY_UID`) and never takes over their files; root remnants are repaired. `FS_PERM_PRIVATE_TREE_NAMES` (incl. `.acme.sh`) stay owner-only 0700.
- Per-user state (certificates, trust stores, profiles) goes to every real user and root through `list_real_users_and_root`, written as that user and skipped when present; service accounts are excluded. Windows uses `LocalMachine`.
- `global_var_store.sh` writes directly when writable; sudo is only the fallback (a service user has no TTY).
- Idempotent replace writes (`write_file_if_changed`, `domain_state_set`) end with mode 777 (no-op on NTFS).

## 6. Domains, web planes and tailnet HTTPS

### 6.1 Public domains
- `domain_setup_common.sh` reads `.secret_keys/.secret_ignore/{DNSPOD_EMAILS, DNS_DNSPOD_API_TOKENS, DOMAINS_LISTS}`; the API region prefix (contract `access.default_api_region_prefix` `si`) is asked once and stored as `DOMAIN_API_REGION_PREFIX` in the var store. Service domains come from contract `access.service_domains` (e.g. `api.<region>.<root>`).
- Every `api.*` host reverse-proxies to Laravel `127.0.0.1:9000` (`ports.laravel_api_backend`) on both :80 and :443; apex hosts keep the 301 to HTTPS. The api/apex rule has one copy per end: shell `nginx_is_api_fqdn`, Laravel `ServerManagerV1NginxConfigBuilder`.
- After the web access config changes, `domain_setup_restart_ui_service` restarts the UI, because Vite reads `server.allowedHosts` once at startup. `service_contract_common.sh` consumers use `sc_require` (fails loud), and the UI `start.sh` refuses to start Vite on an unreadable contract.

### 6.2 FrankenPHP plane
- `frankenphp_domain_common.sh` renders Caddy routes; the admin `/load` outcome decides the action: 200 → snapshot last-known-good; 4xx → roll files back, no restart; no reply → restart only a unit proven wedged (past 180 s grace, admin and backend dead for 3 probes).
- `frankenphp_manager.sh::fm_caddy_config_guard` validates, snapshots or rolls back (rejected copy quarantined in `storage/frankenphp/lkg/rejected`).
- Workers restart only when code is newer than the later of unit activation and the last graceful workers restart.
- ACME timer: `systemd_scheduler.sh::create_systemd_timer` with `RandomizedDelaySec=6h` + `FixedRandomDelay=true` (`frankenphp_acme_sh_install.sh`).

### 6.3 nginx plane (multi-end management)
- One truth, two implementations changed together (each file carries a `SYNC CONTRACT` header): shell `nginx_common.sh`, `nginx_manager.sh`, `nginx_vhost_common.sh`, `domain_setup_common.sh`; Laravel `ServerManagerV1NginxConfigBuilder.php`, `ServerManagerV1NginxManagerCtl.php`, `ServerManagerV1CertificateManager.php`. The UI (`apps/laravel-manager/api/modules/ServerManagerV1.ts`) maps 1:1 to `servermanager/v1` routes.
- `nginx_manager.sh` holds one idempotent primitive per subcommand (`install`, `repair`, `http3-migrate`, `verify`, `status --json`, `site-add|remove|list`, `domains-sync`, `cert-ensure|renew`, ...); `33_install_nginx.sh` wraps each in one `step_run`. `status --json` mirrors `ServerManagerV1NginxManagerCtl::statusOverview`.
- Install coverage (Debian/Ubuntu/Kali; Kali uses the Debian nginx.org repo): in-place upgrade when the apt candidate is newer (sites kept), `migrate-legacy`, `purge-legacy` (distro nginx variants), `replace-foreign` (quarantines `/usr/local/nginx`, `/opt/nginx`, openresty; our source build carries `.core_node_source_build` and is kept), `unify-binaries` (every known nginx path links to one binary). Loading `nginx_manager.sh` has no side effects; directories resolve `map_web_path` → var store → `/etc/nginx`.
- Domain state lives in the var store (`domain_state_get`/`domain_state_set`).
- Certbot (`35_install_certbot.sh`) is pipx-isolated with plugins injected (dnspod, cloudflare, route53, nginx); `/etc/letsencrypt` is preserved.
- Certificates: `php artisan servermanager:certificate add <domain> --prefixes=<region> --provider=dnspod`; wildcard prefixes `ServerManagerV1CertificateManager::SUBDOMAIN_PREFIXES`.
- HTTPS vhosts: `http2 on;`, `listen 443 quic`, `http3 on;`, `quic_retry on;`, a fixed `quic_host_key`, `Alt-Svc`, `ssl_early_data on;`; `nm_main_config` enables `quic_bpf on;` on Linux ≥ 5.7.
- After a reload, `nginx_listeners_audit` compares declared listeners (tcp 80/443, udp 443 with QUIC) with the live socket table and prints `[FAIL]` for a foreign holder or a missing bind. UDP/443 must not be held by another daemon (e.g. hysteria) while QUIC vhosts are enabled.

### 6.4 Tailnet HTTPS (driven by Tailscale detection; additive to public domains)
Rendered only when `tailscale status` succeeds. Contract `access.tailnet` (`dns_suffix` `ts.net`, `api_label` `api`, `api_path` `/laravel-api`, `pycore_path` `/pycore-api`, `source_ranges`).

| URL | Upstream | TLS |
|---|---|---|
| `https://<machine>.<tailnet>.ts.net/` | UI 13054 | tailscale cert |
| `https://<machine>.<tailnet>.ts.net/laravel-api/…` | Laravel 9000 (prefix stripped, `X-Forwarded-Prefix`); requests whose `Referer` is under the prefix go unstripped | tailscale cert |
| `https://<machine>.<tailnet>.ts.net/pycore-api/…` | loopback pycore 59000, tailnet source ranges only | tailscale cert |
| `https://api.<machine>.<tailnet>.ts.net` | Laravel 9000; needs the tailnet attribute `dns-subdomain-resolve` | mkcert local CA |
| `https://127.0.0.1` | Laravel 9000 | mkcert local CA |

- `tailscale cert` issues only `<machine>.<tailnet>.ts.net` (no subdomains).
- Linux: `domain_setup_tailnet_certificates`, `domain_setup_mkcert_trust_all_users`, `fm_domain_tailnet_site_ensure`, `fm_caddy_path_mount_render`. Windows: `FrankenPhpManager.ps1` (`Test-FrankenPhpTailnetConnected`, `Get-FrankenPhpPathMountHandlers`, `Ensure-FrankenPhpMkcertMachineTrust`); `Step175_LaravelMainStart.ps1` accepts a LAN host or a tailnet member.
- Vite `allowedHosts` and CORS also carry this machine's identity (hostname, MagicDNS full/short name, Tailscale IPv4): `web_access_common.sh::web_access_local_hosts`, Windows `Get-FrankenPhpLocalAccessHosts`. `tailscale_common.sh::ts_self_dnsname` is the single MagicDNS lookup.
- Laravel `bootstrap/app.php` trusts `X-Forwarded-Prefix` from the loopback proxy only. UI: `BackendApiEndpoint.basePath`; a `.ts.net` origin maps to the same host + `/laravel-api`.

## 7. Service convergence and host resources

### 7.1 Declarative convergence
Principle: probe → plan → smallest action → verify → record. A running process restarts only when the process itself must change; every restart is recorded in `ncore_service_actions.log` and the journal tag `ncore-service-converge`.

- `systemd_service_manager.sh::converge_systemd_service`: fingerprint of restart-relevant lines (ExecStart/ExecStop/User/WorkingDirectory/Type/Environment). Mode `exec` restarts only on a fingerprint change, else `daemon-reload` applies limits live. Behaviour-neutral env keys are deferred; `reset-failed` runs before start; `systemd_property_overrides_clear` removes `set-property` drop-ins for keys the unit declares; backoff via `RestartSteps`/`RestartMaxDelaySec` (systemd ≥ 254). Default mode stays `unit`.
- `laravel_main_runtime_common.sh`: `register_laravel_service` converges (no unconditional restart); `laravel_runtime_live_apply` plans extension-set change → recorded unit restart, else Caddy `/load`, else a staleness-gated workers restart.
- The Laravel unit uses the `interactive` resource profile (CPUWeight/IOWeight, RAM-relative MemoryMax, no CPUQuota, no MemoryHigh), backoff 10 s → 300 s in 6 steps; `PHP_BIN` is never pinned (resolved from PATH each start).
- `laravel_runtime_frankenphp.sh` removes the route cache as a file (no PHP boot) and runs the config guard before launch.
- Windows `Step175` follows the same probe-first, no-blind-restart rules.

### 7.2 Resource watchdog
- `scripts/services/resource_watchdog.sh` `--scan-once | --daemon | --stop`. The daemon loops every 30 s, writes one `[ALERT]` line per breach to `/logs/debug.log` (300 s cooldown per alert signature; the log is cut to the last 256 KB above 512 KB), PID in `/logs/resource_watchdog.pid`.
- It is not registered with systemd or cron and dies at reboot by design. Restart: `resource_watchdog.sh --stop; setsid nohup resource_watchdog.sh --daemon >/dev/null 2>&1 &`.
- Thresholds (env): `WATCHDOG_LOAD_PER_CORE_MAX` 1.5, `WATCHDOG_MEM_AVAIL_PCT_MIN` 10, `WATCHDOG_SWAP_USED_PCT_MAX` 85, `WATCHDOG_PROC_CPU_PCT_MAX` 150, `WATCHDOG_FRANKENPHP_COUNT_MAX` 30, `WATCHDOG_FRANKENPHP_RSS_MB_MAX` 1024.
- Query: `grep ALERT /logs/debug.log | tail -50`. Reading: `SWAP`/`MEM` with rising `frankenphp_rss` → workers leak or are over-provisioned (worker count in `storage/frankenphp/Caddyfile`); `PROC_CPU` on frankenphp/php-zts → runaway worker or overlapping `schedule:run` (`withoutOverlapping()`); `top_mem` led by node/codex/postgres → contention from other services.

### 7.3 laravel-main load facts
- PostgreSQL 15 dominates CPU through sequential scans driven by Laravel timers; memory and swap pressure come from co-resident processes (vite dev server, AI CLIs).
- Timer task status uses `last_error !== ''` (most recent run), not the lifetime error count (`OctaneTaskStatusService::determineTaskStatus`).

## 8. SSH

- `ssh_server_common.sh` (driven by `23_setup_ssh_remote.sh`): `ClientAliveInterval 60`, `ClientAliveCountMax 0` (sshd never drops unresponsive clients), `TCPKeepAlive no`, `ChannelTimeout none`, `UnusedConnectionTimeout none`, `LoginGraceTime 30`, `MaxStartups 100:30:200`, `PerSourceMaxStartups 10`; stale pre-auth holders are reaped each run; convergence is reload-only.
- Session persistence (`ssh_server_ensure_session_persistence`): `/etc/profile.d/ncore_ssh_tmux_persistence.sh` attaches interactive SSH logins (`SSH_CONNECTION`, no `TMUX`, tty on stdin/stdout) to the first tmux session `main`, `main-2`, ... that is missing or has no attached client, so a reconnect resumes a dropped session and a second window gets its own session. Opt-out per user `~/.ncore-no-auto-tmux`; env `SSH_SERVER_TMUX_PERSISTENCE_ENABLED`, `SSH_SERVER_TMUX_SESSION_NAME`. A tmux failure falls through to a plain shell. Non-interactive ssh/sftp/scp never source the hook. On laravel-main, root has the opt-out file (plain shell for root).
- Drops on unstable public routes are client-side (CGNAT rebinding). Client guidance: `ServerAliveInterval 30`; prefer the Tailscale address.
- Client keepalive (requirement, met): `config/service_contract.json` `ssh_client` holds the one value set (`ServerAliveInterval=30`, `ServerAliveCountMax=3`, `TCPKeepAlive=no`; a cut path is detected within ~90 s). Generated connection scripts (`ssh_command_generator.py` → `scripts/winenvs/ssh<N>.ps1`, `scripts/linuxenvs/ssh<N>.sh`) embed it at generation time on every `ssh` run line (key, password and fallback branches) and print a reconnect tip after the session (the server tmux session persists). Team launchers read the same values at load time (`claude_team_common.sh` via `sc_get`, `ClaudeTeamCommon.ps1` via `Get-ServiceContractValue`).

## 9. dd menus: Tailscale, OS upgrade, AI tools

- "[T] Tailscale" (Linux System Tools; Windows `WindowsManagementManager.ps1`): Install/Repair, Settings (`tailscale set`; never `up --reset` without confirmation; hostname, accept-routes, exit node, Tailscale SSH, shields-up, operator=<real user>), Open UI (admin console, `tailscale web` as the desktop user), All IPs (`tailscale status --json`), Status, Restart, Logout/Login, Help. Shared libraries: `common/tailscale_common.sh`, `97_install_tailscale.sh`, `win_common/TailscaleCommon.ps1` (winget `Tailscale.Tailscale`).
- OS upgrade: `install_shells/upgrade_os_to_latest.sh`, shown only for Debian < 13 or Ubuntu < 26.04. Debian hops one major at a time per the release notes; Ubuntu uses `do-release-upgrade` (`Prompt=lts` on LTS hosts). Reboots resume through the one-shot `ncore-os-upgrade-resume.service`, which is removed when done. State `/var/lib/core_node/os-upgrade/state`, log `/var/log/core_node-os-upgrade.log`. Windows: `WSLDebianManager.ps1` runs the same upgrader inside WSL Debian.
- AI tools: Linux `install_shells/99_install_ai_tools.sh` owns every AI CLI; run alone it first runs its prerequisite steps (node/pnpm/bun, python venv, uv, git, pnpm globals, chrome), each of which skips finished work (catalog `AI_TOOLS_CATALOG`, root install linked into `/usr/local/bin`, shared login through each tool's official config-dir variable such as `CLAUDE_CONFIG_DIR`/`CODEX_HOME`, mcp-chrome built and installed as the `ncore-mcp-chrome` service with bun dev watch, native-host manifest for the real user and system-wide, chrome MCP entry synced into every installed tool). Menu "AI Tools & MCP": ensure all, per-tool install/upgrade, status table (installed, version, linked, login shared), shared-login setup, mcp-chrome build/service, MCP sync. Windows `Step65_InstallAiTools.ps1` + `win_common/AiToolsCatalog.ps1`. `ai_cli_provision_common.sh` reads the catalog.

## 10. GPU and display policy

- No repo script touches i915/xe parameters or GRUB; Intel heartbeat/hangcheck defaults stay (compute > ~4 s is preempted so the display survives).
- CUDA tiers are declared only in `scripts/shells/ai_runtime_policy.env` (`AI_CUDA_TIERS`). `11_cuda_nvidia_prereq.sh` upgrades a driver below every tier without rebooting (CPU wheels until reboot); after the reboot rerun `183_install_qwen3tts`.
- Model paths detect NVIDIA/CUDA only. `compute_caps.py` ignores CUDA env vars alone, and `CUDA_VISIBLE_DEVICES=-1` means no GPU (same rule as `lib_gpu.sh::gpu_hardware_present`, which also requires "nvidia" on a VGA/3D/Display lspci line). `tts_service_manager._gpu_device_or_fallback` returns engine-auto when VRAM is unreadable.
- Qt WebEngine (`webengine_config.py`, aligned with `app_resource_limit.sh::resolve_browser_gpu_flags`): zero-copy and native GPU memory buffers only with `PYCORE_WEBENGINE_ZEROCOPY=1`; hidden/occluded windows may stop painting (only timer throttling stays disabled).
- Port guard: `port_guard_common.sh::pg_system_unit_for_pid` resolves only the cgroup leaf under `/system.slice/`; user-session processes resolve to empty, so freeing a port never stops `user@<uid>.service` (used by `pg_holder_identify` and `9_fix_dns.sh`).

## 11. pycore process on desktop hosts

### 11.1 Restart, port and tray
- Tray Restart and dev hot-reload share `request_restart(execute_handlers=True)` → shutdown stack → `os.execv`.
- Nothing slow runs before the RPC server binds :59000:
  - the audio-lane boot chain runs as `AudioLaneBootChainThread`;
  - queue restore uses the single-transaction `AudioTaskQueue.push_many()`;
  - the TTS runtime profile is pinned by `TtsRuntimeProfilePinThread`;
  - agent-history operation recovery runs in the background runtime step (`pyctl/agent_history/heartbeat.py`).
- `dev_reload.PROCESS_IMAGE_STARTED_NS`: files saved during boot trigger a reload on the first scan.

### 11.2 Background service (Linux + Windows)
- Linux: systemd unit `pycore` (`pyservice.sh install` → `common/pycore_service.sh`), `User=<desktop user>` with the session env, `ExecStart=pyservice.sh run --no-ui --no-install`, no tray (`PYCORE_NO_TRAY=1` / `--no-tray`, `service_config.NO_TRAY_ENV`). The tray stays for foreground runs.
- Windows: `pyservice.ps1 install|uninstall|start|stop|restart|status` (implemented, unverified on a real Windows host) on `Register-NssmService` (same manager as `ncore-nexus-dash`), service command `pyservice.ps1 run -NoUi -NoInstall -NoServicePrompt`, self-elevating. A Windows service runs in session 0, so a logon-started session agent (`pycore.pylauncher.session_agent`, no tray icon, started through `windows_startup_manager`) provides every desktop-dependent feature.
- Parity: `install|uninstall|start|stop|restart|status` have the same meaning and help text on `pyservice.sh` and `pyservice.ps1` (prerequisites alone: `--only` / `-Only`); `--no-service-prompt` / `-NoServicePrompt` skip the prompt; both `help` outputs list them.
- Prompt: the first interactive run without the service asks "Install pycore as a background service? [Y/n]" (default Yes, timed, `ask_yes_no_timed`; shells `prompt_read_default` / `Read-YesNoDefaultYes`). No TTY, `INVOCATION_ID`, or `--no-service-prompt` → no prompt. An installed service is ensured enabled and running without a prompt; a decline runs the foreground worker and asks again next time.
- One mechanism: a `pycore` `BackgroundServiceSpec` in `service_orchestrator.build_service_specs()`; `launch_pycore_module()` / `is_pycore_module_running()` treat a running service as running; `system_service_manager.py` is the cross-platform facade behind the tray "Run as system service" toggle.

### 11.3 Live service log
- The LOG panel (`PcLogPanel`) subscribes `pycore_log` on the existing global WebSocket (`ReconnectingWebSocket` via `PycoreEventClient`); no new transport.
- `pyfoundations/console_log_journal.py`:
  - delivery to the ring and to sinks never depends on disk (a failed file write reopens once and still delivers; one failing sink never blocks others); works headless (`sys.stdout` may be `None`);
  - file `<data root>/logs/pycore_console.jsonl`, at most 100 MB in two 50 MB segments, the newest always kept;
  - `ui/console_log/history` pages forward (`since_seq`) or backward (`before_seq`, `has_older`) through ring and file; `replay_lost` only when the file no longer holds the gap.
- `PycoreConsoleLogStore` shows at most 1000 lines: live tail, `loadOlder()` slides the window back and pauses live insertion, `backToLive()` re-syncs. Service restart shows the `serverRestarted` note. The panel shows a service badge (from instance info) and the global WS state; an optional live topic `terminal_backup` (last backup, count, bytes, status) uses the same socket. Strings in the `pc` i18n namespace. NSSM stdout/stderr files are only a secondary sink.

### 11.4 Terminal backup and restore
- Limits in `config/pycore_relay_contract.json` `limits`: `terminal_backup_interval_seconds` 120, `terminal_backup_retain_count` 200, `terminal_backup_retain_seconds` 259200, `terminal_backup_low_battery_percent` 10, `terminal_backup_min_idle_seconds` 5.
- Store `pyctl/terminal/terminal_backup_store.py`: `<APP_DATA_DIR>/terminal_backup/<YYYYMMDD-HHMMSS>/terminal-<n>.txt` + `manifest.json` (`created_at`, `terminal_count`, `total_bytes`, per terminal `{number, name, bytes, sha256}`, `inputs`, failed terminals with `error_code`).
- Content is the terminal text exported through one shared `export_text(window_id, terminal_number)` core (select all + copy via the clipboard sentinel, clipboard restored), never screenshots. Unchanged terminals (same sha256) are not rewritten; a pass with nothing changed and no forced reason writes nothing and notifies nothing; a written pass shows a system notification ("Backed up {count} terminals, {kb} K"). Passes defer while the user is typing (`pyutils/common/user_idle.py`).
- Forced passes: battery low while discharging (`pyfoundations/power_state.py`; no battery → never), shutdown/suspend, service stop.
- Exactly one scheduler per machine and desktop session (lock under `APP_DATA_DIR`): the Linux unit process (headless Linux reports `no_display`), the Windows foreground process, or the Windows session agent (the service reports `needs_session_agent`).
- Restore: at interactive launcher start, the newest folder with a manifest is offered ("Open the last terminal backup? [Y/n]", date, count, K); Yes opens each `.txt` with `open_file_with_notepad(path, text_editor_finder.find())`. Headless runs never prompt. Strings `launcher_i18n/{en,zh}/main.json` `launcher.main.restore_*`.

- Timing: a pass deferred because the user is typing retries every `terminal_backup_defer_retry_seconds` (3) until idle for `terminal_backup_min_idle_seconds`; after `terminal_backup_max_defer_seconds` (300) it runs anyway. The last-pass time is persisted (`<APP_DATA_DIR>/terminal_backup/schedule.json`), so a hot-restarted process waits only the remaining interval and runs an overdue pass after `terminal_backup_settle_seconds` (10).
- Focus: every pass (and `capture_text`) saves the focused window and pointer before exporting and restores them afterwards, also when an export fails (`pyutils/window/focus_guard.py` over `TerminalWindowBackend.focused_window/focus_window/pointer_position/move_pointer`). Linux: GNOME bridge `ListWindows.focused` + `Activate` (native Wayland), else X11 `_NET_ACTIVE_WINDOW`/`XGetInputFocus` + verified activation, else introspect (read-only: logged `focus_not_restorable`); Windows: foreground window with the AttachThreadInput/ALT-tap restore. The restore re-reads the focus and retries once; failures only log `[TerminalBackup] focus ...` and never fail the pass.

### 11.4a Backup history in the web UI
- Routes (local RPC and relay, same pattern as `ui/terminal/*`): `ui/terminal/backups/list` (paged, newest first, optional `query`), `.../read` (one terminal text, size-capped), `.../open` (open on the host desktop editor), `.../delete`. One backup-history service in the `terminal_backup_*` family owns folder and manifest parsing; ids are validated folder names (no traversal, no symlinks).
- Search is a case-insensitive substring over terminal text and folder date; hits carry terminal number, line and snippet, with scan caps.
- Delete (a backup or one terminal) requires typing `DEL`: the UI confirm button stays disabled until the input equals `DEL`, and the server rejects any `confirm` that is not exactly `DEL` (`delete_confirmation_required`).
- UI: `PcTerminalBackupPanel` on the pycore-manager Terminal Control page (history list, search with matches, text viewer, open-on-host, copy, delete dialog); en/zh strings in the `pc` namespace.

### 11.5 Launcher apps on Linux
- The code-editor slot is `vscode`, then `codex` (Windows and Linux; cursor is now an alternative that is not launched). `vscode` starts as the desktop user on Linux (VS Code refuses root). A one-shot migration (`code_editor_default_vscode`) enables vscode and disables cursor in saved launcher configs.
- WeChat and Remmina start by default in `EXTRA_APPS` (`pyutils/launcher/app_slots.py`) as the desktop user, skipped when running.
- An app that does not resolve runs its installer once (`app_catalog.LINUX_PREREQUISITE_INSTALLERS`, non-interactive `DD_AUTO_CONTINUE=1`): chrome `41_install_browsers.sh --only chrome`, vscode `155_install_ides.sh --only vscode`, cursor `155_install_ides.sh --only cursor`, codex `99_install_ai_tools.sh --only codex`, wechat `167_install_wechat.sh`, remmina `195_install_remmina.sh`. Headless hosts skip GUI installers.
- `195_install_remmina.sh` is the one owner of the Remmina package list; Windows has no Remmina.

### 11.6 Remote control with simultaneous local and remote use
- Facts: before this change the dd.ps1/dd.cmd Remote Control menu had RDP and SSH only (no VNC). Windows RDP takes over the console and locks the local screen. Debian's `gnome-remote-desktop` is built without VNC (`grdctl` has only `rdp`), and `x11vnc` does not work under Wayland, so a Linux host shares its live session through RDP in GNOME user mode (Desktop Sharing), not VNC. `grdctl --system` remote login opens a separate GDM session (not shared).
- Windows host (default): TightVNC (`GlavSoft.TightVNC`) as a service shares the real console, including Windows Home. Inbound tcp/5900 is allowed only from the tailnet (`100.64.0.0/10`, rule `CoreNode-RemoteControl-VNC-Tailscale`); the VNC password (at most 8 characters) is entered or generated once, written DES-encoded to the TightVNC registry (not through MSI properties, which winget logs and which cannot reset it), and never stored in the repo or logs. The Windows client defaults to VNC for Windows peers (`tvnviewer.exe -host=<ip>::5900`, with RDP/SSH as alternatives and a port probe first). Unverified on a real Windows host: winget id, `--custom` pass-through, install paths, registry value names and the password encoding. RDP stays as the secondary channel (`RemoteControlCommon.ps1 -Action Vnc|Host`).
- Linux host (default): `rc_rdp_backend` picks `gnome-user` (shared session) when the user has a running GNOME session, else `gnome-system`, else `xrdp`; `RC_RDP_MODE=system` forces the remote-login mode. Enabling user mode disables the system-mode RDP daemon so port 3389 serves the shared desktop.
- Linux client (default): `remote_control_common.sh` `rc_connect_peer` opens Remmina on a saved per-peer profile: VNC `ip:5900` for a Windows peer (falls back to RDP with a notice when only 3389 answers), RDP for a Linux peer; `x` suffix = xfreerdp RDP, `s` = SSH. `195_install_remmina.sh` installs `remmina-plugin-vnc` with the other plugins.

## 12. Linux terminal control (X11, Xwayland, GNOME, portal)

Targets: Debian 13 GNOME 48 (Wayland and Xorg), Ubuntu 26.04 GNOME 50 (Wayland only), other X11 desktops; Windows behaviour unchanged.

- Shared libraries, one per concern:
  - `pyfoundations/desktop_session.py` (session/distro detection, `has_graphical_display()`, the only reader of `XDG_SESSION_TYPE`/`WAYLAND_DISPLAY`);
  - `pyutils/common/x11_display.py` (python-xlib EWMH, activation, XTEST, per-window `XGetImage`; the only user of window-control tools; normalizes mutter Xwayland cookies and falls back to the newest session cookie);
  - `session_dbus.py` (jeepney; errors as `DBusReply`);
  - `gnome_shell_dbus.py` (bridge + introspect);
  - `xdg_desktop_portal.py` (RemoteDesktop+ScreenCast input, Screenshot crop, restore token at `APP_DATA_DIR/desktop_portal/remote_desktop_restore_token`);
  - `clipboard_text.py` (Win32 → xclip → xsel → wl-copy → pyperclip → PowerShell; can own PRIMARY).
- GNOME Shell extension `pycore/static/gnome_shell_extensions/pycore-window-bridge@core-node/` (GNOME 45–50, D-Bus `org.corenode.PycoreWindowBridge`: `ListWindows`, async `Activate`, `PointerClick`/`Scroll`/`KeyCombo`, `CaptureWindow`).
- Backends: `pyutils/window/terminal_backend.py::TerminalWindowBackend` owns the operation flow; platforms implement primitives only; `UnsupportedTerminalBackend` replaces `None` checks; `terminal_platform.py` is the single selector. Linux window ids: `x11:0x…` (`control` `x11`/`xwayland`), `gnome:<id>` (`gnome_bridge`; X11 duplicates dropped), `introspect:<id>` (view only). Wayland input/capture fall back to the portal.
- Linux paste sets CLIPBOARD and PRIMARY, then sends `Shift+Insert` (never a right click).
- Snapshot reports `platform_profile`, `control_modes`, `capabilities.{x11,gnome_bridge,gnome_introspect,portal}`, per-window `control`/`controllable`, and `notice_code`; all codes translated (en/zh).
- RPC `ui/terminal/desktop_integration` (`status`, `install_bridge`, `enable_bridge`, `disable_bridge`, `authorize_portal`, `revoke_portal`), relay profile `terminal_integration` (150 s). UI `PcTerminalDesktopIntegration`.
- `TerminalStateRepository.reconcile_windows` reserves numbers of live windows before handing out new slots.
- Installers: `119_install_launcher.sh` adds `xclip`, `wl-clipboard`; `python-xlib` and `jeepney` are in `python_package_policy.DEPENDENCY_MAP`.
- Testing nested GNOME shells: export `XDG_CONFIG_HOME` before `dbus-run-session`, else dconf writes into the real user database.

## 13. Native UI host lifecycle (PySide6 + WebEngine)

- `shell/ShellRuntime.tsx` is the only owner of `TaskPersistenceProvider`, `BrowserRouter`, `ShellProvider`, `AppToaster` and `GlobalLoginHost`; `ShellApp` and `StandaloneApp` supply only route content; lazy routes share the translated `ShellRouteFallback`. The Context/`useShell` module holds no component.
- `index.tsx` unmounts the single React root on `pagehide` before WebEngine discards the page.
- `PySide6Framework.quit()` (`native_ui/step5_main_ui/pyside6/framework.py`) is the idempotent cleanup (`_quit_started`) for title bar, Ctrl+C, direct use and THREAD_BUS shutdown; the shutdown handler (priority 0) emits the Qt close signal and never touches widgets from a background thread.

## 14. LAN phone access

- pycore binds loopback unless `rpcLanBind` is on (`local_rpc_guard.py`); a non-loopback caller needs a K3 client-key signature (K7), so a phone without a key gets 401.
- Working paths: the tailnet `/pycore-api` mount (section 6.4) and the relay.
- Planned (opt-in): device pairing that gives the phone a scoped client key (`DESIGN_AUTH_IDENTITY.md`), or a default-off LAN read policy that admits unsigned LAN callers only to `api/status`, `ui/audio_orch/resource/lookup` and `ui/audio_orch/resource/chunk`.

## 15. pycore on a notebook host (Colab/Kaggle)

A notebook host runs an ordinary GPU or CPU node; there is no notebook node kind.

### 15.1 Launch
- Cells (root `README.md`): clone or fast-forward `core_node` (GitHub or Gitee) into `/content/core_node` (Colab) or `/tmp/core_node` (Kaggle), assert `pycore/bootstrap/notebook_boot.py` exists, then `%run <repo>/pycore/bootstrap/notebook_boot.py colab|kaggle`. Re-running is idempotent.
- `notebook_boot.py` (stdlib only, never imports pycore) prints a 7-step flow (platform, repository, Python, internet, accelerator, Google Drive, secret password), mounts Drive on Colab, resolves the password (`CORE_NODE_SECRET_PASSWORD` env → Colab/Kaggle notebook secret → getpass), passes `NOTEBOOK_PLATFORM_DETECTED` / `NOTEBOOK_ACCELERATOR` and runs `bash pyservice.sh <platform>`; the password lives only in the child environment; interrupting the cell sends SIGINT.
- `./pyservice.sh colab|kaggle` (`common/pyservice_entry.sh`; Linux only, `pyservice.ps1` prints a notice) implies mode 2 (outbound-only relay agent), `--no-ui`, `--no-reload`. TPU runtimes have no backend; inference runs on CPU.
- Detection: Kaggle only by `KAGGLE_KERNEL_RUN_TYPE`; Colab by `import google.colab` or `COLAB_*`.
- `scripts/shells/linux/common/notebook_runtime.sh` (`notebook_prepare_environment`):
  - persist root: Colab `/content/drive/MyDrive/core_node_notebook` (ephemeral `/content/core_node_notebook` without Drive), Kaggle `/kaggle/working/core_node_notebook` (kept only with Persistence = Files), override `NOTEBOOK_PERSIST_DIR`;
  - `CORE_NODE_DATA_DIR` under it, `CORE_NODE_DATA_OWNER=root`, `PROMPT_TTY_DISABLED=1`, `NONINTERACTIVE=1`, uv/npm caches, `HF_HUB_DISABLE_SYMLINKS=1`, `UV_LINK_MODE=copy`;
  - installers run only inside pyservice (`prepare_pycore_prerequisites.sh`); `DEVICE_TOOLS_SKIP`, `FRONTEND_PACKAGES_SKIP`, `SHERPA_SKIP` are set; offline VMs skip installers (`NOTEBOOK_INTERNET_OK`); `NEURAL_TTS_INSTALL` defaults to 0; `notebook_inactive_plan_engines` sets the manifest skip variable of every engine contract `tts_runtime_plan` uses only in the other mode (GPU/CPU by `notebook_accelerator_kind`; `DESIGN_TTS_AI_RUNTIME.md`); caller exports always win; `PYCORE_LOCAL_AI_INSTALL=1` unless the caller set it;
  - `PYCORE_PREREQ_STEP_TIMEOUT_SECONDS` defaults to `NOTEBOOK_PREREQ_STEP_TIMEOUT_SECONDS` 1800 (section 3.3).
- Idempotency: VM marker `notebook_vm_ready` (the first run on a VM always installs; `--no-install` is ignored then) and persist marker `.cache_initialized`, written only after a complete save (`NOTEBOOK_COPY_INCOMPLETE`); a new persist root seeds from an earlier one when found.
- Summary (`notebook_print_summary`): platform, accelerator, persist root, data dir, cache state, installers, encrypted secrets left, relay identity, Laravel API, AI services state.

### 15.2 Queue assist on by default
- Contract `notebook_defaults`: `assist_default_env` = `PYCORE_ASSIST_DEFAULT_ON`, `assist_default_capabilities` = translation, tts, sentence_audio.
- `notebook_runtime.sh` exports the env as 1 unless the caller set it; `pyctl/assist/assist_settings.py` then treats those capabilities as enabled while the user has no stored `assist_laravel` section; a stored value always wins.

### 15.3 Model-cache sync and free-space guard
- Drive FUSE lacks symlink/chmod semantics, so Colab uses sync mode: local cache, copy-missing restore (rsync/tar), periodic save every `NOTEBOOK_CACHE_SAVE_SECONDS` 600, final save on exit through `notebook_run_worker`; partial files `*.incomplete|*.lock|*.part|*.tmp` are excluded.
- Free-space guard: the missing bytes from an rsync dry run plus `NOTEBOOK_CACHE_MIN_FREE_MB` (default 1024) must fit the destination filesystem, else nothing is written and one warning gives needed vs free MB; the next run retries. `rsync --delay-updates` avoids partial files. The same guard covers persist-root seeding.
- Kaggle uses link mode (downloads write straight into `/kaggle/working`, unguarded).

### 15.4 Secrets and relay identity
- Encrypted store `.secret_keys/already_encrypted/*.js` is decrypted to `.secret_keys/.secret_ignore/` through `secret_password_runner.js` (password via stdin/env, never argv); only still-encrypted files are decrypted, with a 15 s heartbeat.
- Password split: names encrypted with a second password are listed in `.secret_keys/password_mismatch.list`; every encrypt path verifies the main password first (`secret_confirm_main_password` / `Confirm-SecretMainPassword` / `password_is_main`); dd offers "re-encrypt from .secret_ignore" once (default yes), after which the names leave the list.
- Relay identity restore (`notebook_restore_relay_identity`): `$CORE_NODE_DATA_DIR/config/pycore_relay_identity.json` lives under the persist root and always wins (it can hold a rotated key). Only when it is missing is it seeded from the secret `PYCORE_RELAY_DEVICE_IDENTITY_1` (base64), and only if the decoded JSON has `device_id`, `private_key` and `credential_id`; otherwise the VM enrolls as a new device.
- Over the relay (`DESIGN_RELAY.md`): a machine call with the shared client key (resolved even under local-models-only) is auto-approved, otherwise the console prints a claim code for the Relay device roster; the label is the hostname. A VM restart reloads the identity without re-enrolling; after a VM sleep the request clock is re-measured. Available on a headless VM: audio orchestration, dictionary, translator/TTS/STT/OCR, queue center and delivery status, status/info/routes, agent history reads, the `pycore.events` tunnel. Not available: `code_sync/*`, desktop dialogs, endpoint binding/probe routes (configure through the environment), `video/background_import`; terminal and machine-send routes do nothing without a desktop. Relayed multipart uploads are limited to 64 MiB per request.
- Work leases (queue assist across nodes, `DESIGN_QUEUE_PIPELINE.md`): a recycled VM stops renewing, its leases expire and rows return to the pool; a new VM claims again; worker ids derive from the relay device identity (`pyctl/laravel/worker/registration.py`), so they stay stable across VMs.
- After claiming a new device in Laravel: `./pyservice.sh colab --export-identity` (or the README `--export-identity` cell) encrypts the identity into `.secret_keys/already_encrypted/PYCORE_RELAY_DEVICE_IDENTITY_1.js` for commit. Run one VM per identity at a time; relay session fencing (`DESIGN_RELAY.md`) stops the older session.

## 16. Verification

- Shell: `bash -n <file>`; PowerShell `[System.Management.Automation.Language.Parser]::ParseFile`; re-running an installer must be a no-op.
- Startup: `dd.sh` reaches `[STARTUP] Ready in Ns` and the countdown without any prompt.
- Drive layout: `findmnt -T /www/core_node_compiler/trees`, `lsblk -o NAME,PARTUUID,FSTYPE`, `readlink -f /var/_core_node; findmnt -T /var/_core_node`.
- Services: `systemctl show -p NRestarts,CPUQuotaPerSecUSec <unit>`; `tail ncore_service_actions.log`; `journalctl -t ncore-service-converge`.
- Tailnet: `curl -sI https://<machine>.<tailnet>.ts.net/laravel-api/api/health` → 200.
- SSH: `sshd -T | grep -E 'clientalive|tcpkeepalive|unusedconnectiontimeout|maxstartups'`.
- Terminal control: `ui/terminal/windows` returns `supported=true` with `control` per window.

## 17. Open items

- Wrap-type toolchain shims (node/npm/pnpm/bun/composer reading `toolchain.env`, install-verb gate) are not implemented; `25_install_uv.sh` still sets a global `UV_PROJECT_ENVIRONMENT` instead of the per-project `<trees_root>/<ns>/.venv`.
- `XDG_CACHE_HOME` and `PIP_CACHE_DIR` still point at the shared NTFS cache (`shared_cache_env.sh:295,308`); moving them to ext4 needs `pip` in `drive_layout.cache_subdirs` and no shared-model consumer that reads only `XDG_CACHE_HOME`.
- `ProjectTreeCommon.ps1` is missing from the `WinScriptsInstaller.ps1` file list.
- The Windows junction path (E: present) must be proven on real dual-boot Linux (ntfs3 junction translation, pnpm/bun on a linked node_modules, E: exclusion) before it is relied on.
- Migration of existing trees to E:/`/opt` and cleanup of Linux-written D: artifacts need user approval and a read-only `chkdsk D: /scan` first; E: (≈350–400 GB) will be allocated by shrinking D:.
- Windows host gaps (optional): pagefile on D:, power button set to Sleep, missing Automatic Maintenance tasks.
- pycore background service: `pyservice.ps1` service commands were never run on Windows; the `pycore` `BackgroundServiceSpec` and the cross-platform `system_service_manager.py` are not done; the Windows session agent (R5.4/R5.5) does not exist, and a Windows service-mode worker has no session-0 check, so it would try to run the backup scheduler; the `terminal_backup` UI status topic is not published.
- LAN phone access (section 14) is not implemented.
- Wiring of the shared tree ensure into every start script (`apps/mcp-chrome/scripts/start.*`, `poly_apps/laravel_main/scripts/start.*`, `poly_apps/pycore_laravel_wordnew_ui/scripts/start.*`, linuxenvs launchers) is incomplete; only 197/Step69 call it.
- debian-gpu: pull and rerun 175 / Step175; run Windows Step2, then set `WINDOWS_RTC_UTC=1` on Linux.
- Portal input on the Debian 13 desktop needs the UI "Authorize portal input" action plus a desktop click; the GNOME bridge becomes active after the next login.
- laravel-main: move the DB-backed cache table to Redis; reduce journal noise (per-second scheduler line, `.part` removal) and the daily `vacuum-size=100M` cron; remove the stale PG15 copy at `/www/wwwroot/postgresql/data` and the broken PG17 cluster by hand; PostgreSQL restart for `shared_buffers`.
- Every Linux host: rerun `175 --domains-only`; explain the 30.9 s server delay seen in laravel.log.
- Resource watchdog memory thresholds are not sized for laravel-main yet (section 7.2).
- Not run on real hosts: the Linux and Windows installers of section 3.4 (only `bash -n` / the PowerShell parser and the helpers were exercised), the OCR/EasyOCR weight helpers, the Windows book-seed extraction in Step175, and the machine-send OS paths (opener, notification, clipboard).
- Notebook hosts: not yet run end to end on a real Colab/Kaggle VM (installers, Drive-backed identity, suspend/resume); faster-whisper/whisper are skipped by the free-disk policy on Colab (Drive free tier 15 GB); secrets listed in `.secret_keys/password_mismatch.list` on the Windows host wait for the dd re-encryption there (the list is not present on this Linux checkout).

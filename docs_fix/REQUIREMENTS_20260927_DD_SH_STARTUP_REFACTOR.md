# dd.sh Startup Refactor — Dedup, Single Confirmation, Fast Start

Date: 2026-09-27
Status: binding requirement list
Scope: `dd.sh`, `scripts/shells/linux/dd_helper/`, `scripts/shells/linux/common/{prompt_common,fs_perm_helpers}.sh`,
`scripts/shells/linux/debian/install_shells/7_project_validator.sh`.
Guide: `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

## 1. Measured facts (this machine, ntfs3 project disk, ~340k entries)

- Full-tree permission scan of the project root (`repair_owned_tree_777`): 7m12s cold, 3.5s warm.
  After finding one mismatch it ran `chown -R` + `chmod -R` over the whole tree, a second full walk.
- `.sh` processing: 5-9s per directory. Every file cost ~5 forks (`sha256sum`, `cut`, `cat`, `stat`).
  The directory cache check walked the same tree a second time.
- Dev-cache scan: serial `du` over a 13 GB pip cache on NTFS plus `pip`/`npm` startups.
- Startup Y/n prompts: skip-scan [Y/n], dev-cache [N/y], secret re-decrypt (blocking), secret cache update
  (blocking), secret decrypt (blocking), secret re-encrypt, project restore (validator), menu pause.
- Duplicates: `check_and_install_sudo` (system_functions vs gvar_common, the latter silently overrides),
  `ensure_dos2unix`/`check_and_install_dos2unix`, `print_color` (conflicts with AI menu signature),
  `manage_natgateway` (linux_management vs natgateway_helper), menu pause (dd.sh vs menu_display),
  `main_functions.sh` (only re-sources constants), unused dd.sh path constants, per-file + per-dir caches.

## 2. Requirements

- R1 Remove duplicate functions/files; dd.sh sources one ordered list; helpers do not re-source constants.
- R2 Startup never stops for Y/n. Every confirmation is queued and shown once, as one stacked prompt.
- R3 The prompt appears only right before the menu, with a 5s auto-continue (defaults). Earlier output stays on screen.
- R4 Log limits and dev-cache/`/var/log` cleanup leave startup; they live in
  Linux System Tools → Slim & Disk Cleanup. (Supersedes the 24h snooze asked earlier: no startup cache prompt remains.)
- R5 Faster startup without dropping steps: every step still runs.

## 3. Design

- Confirmation queue (`prompt_common.sh`): `prompt_queue_add id default text accept_fn [decline_fn]`,
  `prompt_queue_commit` (flush now unless `PROMPT_QUEUE_DEFERRED=true`), `prompt_queue_flush timeout`.
  Answer: Enter/timeout = each item's default; `y` = all; `n` = none; `1,3` = listed only.
  Decline handlers receive `declined` (explicit) or `default` (Enter/timeout).
  `prompt_countdown_read` renders the live countdown; the first key stops it.
- dd.sh sets `PROMPT_QUEUE_DEFERRED=true` during startup and flushes the queue at the menu point.
  Menu actions (e.g. Clear and Re-decrypt Secret Keys) flush immediately.
- Secrets: detection runs at startup. One item covers missing and changed files (decrypt). Another covers
  raw files newer than their encrypted copies (re-encrypt). Mode menus and passwords run only after acceptance.
  An explicit decline of changed files refreshes the hash baseline, the same as the old "update cache" default.
- Project validator: `PROJECT_VALIDATOR_MODE=defer` records `PROJECT_RESTORE_PENDING` in the var store instead
  of prompting. dd.sh queues the restore; accepting it runs `PROJECT_VALIDATOR_MODE=restore`.
- `.sh` processing: one `find -printf` per directory. Candidates are files whose ctime is newer than the last run
  (this also catches copied files that keep an old mtime) or files without exec. The whole directory is re-verified
  every 24h. CR fix and chmod run in batches.
- Permissions: `repair_owned_tree_777` does one walk and repairs only mismatched entries.
  As root, the dd.sh project/data-root repair runs detached (flock-guarded) and logs to
  `$CORE_NODE_DATA_DIR/logs/dd_permissions.log`. Its status is printed before the menu.
  Environment setup stays in the foreground.
- Dev-cache sizes are measured in parallel.
- linuxenvs sync relinks only links that are wrong.

## 4. Acceptance

- Startup prints every step and reaches the countdown without any prompt. The countdown lists pending items.
- `n` on the queue does not change other items; secret prompts reappear next start unless they were explicitly declined.
- Log limits / dev cache are reachable only from Slim & Disk Cleanup.

## 5. Implementation record (2026-09-27)

Startup order (`dd.sh main`): FILE CHECK → SMART SETUP (env in the foreground; tree repair detached) → SECRETS (queue) →
cache cleanup + unwanted paths → FILE PROCESSING → GLOBAL VARS → PROJECT VALIDATION (defer) → BASE SETUP → links →
system detection + permission report + `[STARTUP] Ready in Ns` → the single stacked prompt (5s) → menu.
If an accepted action produced output, a second 5s countdown keeps it on screen before the menu clears it.

| File | Change |
|---|---|
| `dd.sh` | One ordered load list: `DD_CORE_FILES` (gvar_common, constants, arrow_menu, system_functions) and `DD_HELPER_FILES`. Removed unused path constants, `menu_items`, `sudo`, the skip-scan prompt, the dead installation-mode branches and the `menu_display` fallback. Installation mode is unchanged. |
| `common/prompt_common.sh` | `prompt_auto_continue`, `prompt_tty_foreground` (shared probe), `prompt_countdown_read`, `prompt_queue_add/commit/flush`. |
| `common/fs_perm_helpers.sh` | `repair_owned_tree_777`: one walk; only mismatched entries get `chown`/`chmod` (xargs). |
| `dd_helper/constants.sh` | Single definition: `DD_SH_TARGET_DIRS`, `DD_MENU_COUNTDOWN_SECONDS=5`, `RESOURCE_LIMITER_SCRIPT_RELATIVE` (now `common/resource_limiter_common.sh`; the old path no longer existed). |
| `dd_helper/system_functions.sh` | `dd_prepare_privileges` uses gvar `check_and_install_sudo` (duplicate removed). `check_and_install_dos2unix` replaces dd.sh `ensure_dos2unix`. `make_sh_executable` reuses `process_project_sh_files`. |
| `dd_helper/cache_functions.sh` | Keeps the directory processing cache (`directory_processing_since`) and the legacy migration. Removed the per-file and behavior caches (no callers). Secret caches moved to `secret_functions.sh`. |
| `dd_helper/file_processing.sh` | `process_sh_files` (ctime/exec candidates, batched grep/sed/chmod) and `process_project_sh_files`. |
| `dd_helper/secret_functions.sh` | Detection vs queued handlers. Self-sufficient when sourced alone (by `scripts/shells/linux/dd.sh`). Bundle count read with grep instead of node. The batch decrypt also refreshes per-file baselines. |
| `dd_helper/smart_permissions.sh` | Debug output removed. `perms` worker mode (flock), `smart_permissions_report`, log at `$CORE_NODE_INSTALLER_STATE_DIR/dd_startup/permissions.log`. |
| `dd_helper/dev_cache_cleanup.sh` | Parallel measurement. Per-item stacked confirmation. `dev_cache_cleanup_menu`, `system_log_limits_menu`. |
| `dd_helper/linux_management.sh` | Slim & Disk Cleanup: + Dev Cache & /var/log Cleanup, + System Log Size Limits. |
| `dd_helper/menu_functions.sh` | Only real actions remain (`show_ai_mcp_management` replaces the dead `handle_menu_action`). |
| `dd_helper/linuxenvs_sync.sh` | Relinks only wrong links. |
| `dd_helper/file_download.sh` | `is_file_valid` merged in; the three copy-pasted checks became one loop. |
| `dd_helper/main_execution.sh` | Removed `print_color`, which conflicted with the AI menu's `print_color(msg, type)`. |
| `dd_helper/permissions_repair_menu.sh` | No longer overwrites dd.sh `SCRIPT_DIR` when sourced. |
| `7_project_validator.sh` | `PROJECT_VALIDATOR_MODE=defer|restore`, var `PROJECT_RESTORE_PENDING`. |
| removed | `main_functions.sh`, `menu_display.sh`, `natgateway_helper.sh`, `file_validation.sh`. |

Measured (read-only): ctime scan of 602 `.sh` files ≈2.5s including the cold `apps/` walk; CR grep 0.4s.
Every `.sh` currently shows a new ctime because the previous run's `chmod -R` touched them; this happens once.
Obsolete cache dirs (`installer/file_cache`, `installer/behavior_cache`) are no longer written; they were left in place.

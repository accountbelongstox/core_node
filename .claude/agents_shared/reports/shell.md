# shell report (client key auth + audit fixes, 2026-09-27)

No TaskCreate tool in this session; task ids are my own (reviewer writes `reviews/<id>.json`).

| Task | Scope | Status |
|---|---|---|
| shell-1 | K2 client key lifecycle (Linux + Windows), IS-008, IS-010 | approved |
| shell-2 | IS-001 (+IS-012), IS-002, IS-003, IS-004 | approved |
| shell-3 | IS-005, IS-006, IS-007, IS-009, IS-011, IS-013 | approved |
| shell-4 | IS-014..IS-021, IS-023..IS-030 | approved |
| shell-5 | PR-034 script order; requirements §2 follow-ups | approved |
| shell-6 | IS-022 sweep | approved |
| shell-7 | IS-005 class masking sweep (other launchers, generators) | approved |
| shell-8 | K7a pyservice_entry bind default (pycore request) | approved |
| shell-9 | postgres password mirror mode (review follow-up) + shell-5 guard list | approved |

## shell-1

- K2 fixed. Linux `secret_ensure_client_key` (dd_helper/secret_functions.sh) runs inside `ensure_secret_keys_ready` after the decrypt scan and before the re-encrypt scan. Name and length come from `service_contract.json#client_key_auth` (`secret_key_sign_name`, `key_min_bytes`) through `sc_get`. It generates only when there is no non-empty raw file, no `<name>.js` / `.JS` encrypted copy and no `"filename": "<name>"` entry in `already_batch_encrypted/*.js`. The value is base64url without padding, written through mktemp (0600) plus mv; the private-tree repair sets the owner; the value is never printed. The existing re-encrypt prompt picks it up. Windows `Initialize-ClientKeySecret` (SecretManager.ps1) runs at the start of SecretEncryptionCheck.ps1, which dd.ps1 runs after SecretDecryptionCheck.ps1. It applies the same three checks with the same contract values (ServiceContract.ps1). It uses RandomNumberGenerator, writes UTF-8 without BOM and no newline, and sets an ACL for the current user, SYSTEM and Administrators only.
- IS-008 fixed. `repair_owned_tree_777` (common/fs_perm_helpers.sh) now prunes `.secret_keys`, `.secrets` and `.git` from the 777 walk for every caller (dd.sh worker, bootstrap, validator, codesync, repair menu, webpath). Pruned trees get their own policy:
  - secret stores via `repair_private_tree`: dirs 0700, decrypted files (`.secret_ignore/`, `raw/`) 0600, git-tracked encrypted copies go-rwx with the owner bits kept, so git sees no mode change;
  - `.git` via `repair_owned_tree_no_shared_write`: chown plus go-w;
  - both skip mount-fixed filesystems.

  The decrypt, re-encrypt and generate paths also call `repair_private_tree` right away.
- IS-010 fixed. There is one runner, `scripts/encryption_tools/secret_password_runner.js`. It reads the password from stdin, replaces the `--password-stdin` placeholder in the tool's in-memory argv, sets umask 077 and runs the tool as main, so encrypted files and bundles already committed keep working.
  - Shell side: `secret_tool_run` and `secret_read_hidden` in the new `common/secret_tool_common.sh`. Callers: secret_functions.sh, 27_install_git_ssh.sh (the password is no longer echoed; it used to go through `prompt_read_default`), gitput_security_common.sh and gitput_unified.sh (both used to echo with `read -r`), secret_manager.sh.
  - Removed duplicate readers: `read_secret_input`, `read_password_with_asterisks`, `read_masked_password`.
  - Python callers: gitput_unified_modules/encryption.py and special_software_env_manager secret_manager.py.
  - Windows: `Invoke-SecretPasswordTool` (GlobalVarStoreCommon.ps1) with the `$Global:SECRET_PASSWORD_*` constants (GlobalVars.ps1). Callers: SecretManager.ps1 (4 sites), SecretEncryptionCheck.ps1, GlobalVarStoreCommon.ps1 Get-SecretContent, gitput_unified.ps1.
  - Deferred: `scripts/shells/secret_manager/test_decrypt.sh` is a test script (AGENTS.md: do not modify tests unless asked).
  - Handed off: `pycore/pyfoundations/secret_manager.py:193` → pycore, with the runner interface.

Changed files:
- scripts/encryption_tools/secret_password_runner.js (new)
- scripts/shells/linux/common/secret_tool_common.sh (new)
- scripts/shells/linux/common/fs_perm_helpers.sh
- scripts/shells/linux/dd_helper/secret_functions.sh
- scripts/shells/linux/debian/install_shells/27_install_git_ssh.sh
- scripts/shells/secret_manager/secret_manager.sh
- scripts/git/gitput_security_common.sh
- scripts/git/gitput_unified.sh
- scripts/git/gitput_unified.ps1
- scripts/git/gitput_unified_modules/encryption.py
- scripts/pytools/special_software_env_manager/config/path_config.py
- scripts/pytools/special_software_env_manager/utils/secret_manager.py
- scripts/shells/win/win_common/GlobalVars.ps1
- scripts/shells/win/win_common/GlobalVarStoreCommon.ps1
- scripts/shells/win/win_common/SecretManager.ps1
- scripts/shells/win/win_common/SecretEncryptionCheck.ps1

Checks:
- `bash -n`, `node --check`, `ast.parse` and the pwsh parser pass on every changed file.
- Scratchpad probes with dummy data only:
  - the runner round-trips disguise.js, a single encrypted file and a bundle (valid HMAC; output 0600; empty stdin gives exit 1);
  - the generator writes 43 chars that decode to 32 bytes, 0600/0700, owned by the permission user; a second run is a no-op; an encrypted copy or a bundle entry blocks generation;
  - the pruned 777 walk on a scratch tree leaves `.git` at 755/444 and `.secret_keys` at 700, with the raw file 600.

Next owner: pycore (the secret_manager.py stdin switch).

## shell-2

- IS-001 fixed (75_install_postgresql.sh). configure_postgresql keeps the configured cluster and prints ACTION REQUIRED with rsync relocation steps instead of `pg_dropcluster`. This happens when the target dir holds no cluster and the current data dir either holds user databases (numeric dirs under `base/` beyond the 3 system DBs, counted without the server) or is missing (disk not mounted, WSL image not mounted). A fresh default cluster with system DBs only is still recreated at the mapped dir, as the design intends. `pg_config_value` now parses the `data_directory = '...'  # comment` lines that pg_createcluster writes; the old sed returned the whole line there, which forced `need_recreate`.
- IS-012 fixed. `pg_resolve_target_dirs` is the one resolver for configure_postgresql and `pg_expected_data_dir`: WSL image or native, else the mapped POSIX path, else compile_dir. `pg_data_dir_drifted` reports drift only when the reconcile loses nothing. A kept cluster prints ACTION REQUIRED and is not restarted on every run.
- IS-002 fixed. Step93/94/96 use `"Step ${STEP_NUMBER}: ..."`; the pwsh parser passes.
- IS-003 fixed (gitput_security_common.sh). Step 6 (sharing the key with logged-in users) is now opt-in: `GITPUT_SHARE_SSH_KEY_WITH_USERS=true`, declared in gitput_unified.sh. It copies only where the user has no key of that name; an existing different key is kept and reported. Step 3's `--force` decrypt now backs up the `$SSH_DIR` key pair it overwrites on every path, including the network-error path; before, only the permission-denied path made a backup.
- IS-004 fixed (PathMappingLib.ps1). `Remove-PathMappingJunction` calls `[System.IO.Directory]::Delete(path, $false)` and removes only the link; `Remove-PathMappingLinkLocation` routes reparse points to it. A stale junction first merges the old target into the new one with the non-overwriting robocopy (`Copy-MissingPathMappingContent`). `Test-PathMappingLocationsNested` skips the merge when either path contains the other. Also replaced the two BOM-less em dashes in double-quoted strings (the IS-006 class).

Changed files:
- scripts/shells/linux/debian/install_shells/75_install_postgresql.sh
- scripts/shells/win/install_powershells/Step93_InstallFrankenPHP.ps1
- scripts/shells/win/install_powershells/Step94_InstallComposer.ps1
- scripts/shells/win/install_powershells/Step96_ConfigurePHP85.ps1
- scripts/git/gitput_security_common.sh
- scripts/git/gitput_unified.sh
- scripts/shells/win/win_common/PathMappingLib.ps1

Checks:
- `bash -n` and the pwsh parser pass.
- Scratch probes:
  - `pg_config_value` on quoted-with-comment, unquoted-with-comment and absent settings;
  - `pg_data_dir_user_databases` / `pg_keep_existing_cluster` on fresh (0), used (1) and missing data dirs against an empty target and an initialized one;
  - `Test-PathMappingLocationsNested` in both directions and on disjoint paths.

Observation (not in the audit, not changed): `setup_postgresql_user` passes the postgres password in `psql -c` argv and mirrors it to a `chmod 666` file for open_basedir hosts.

## shell-3

- IS-005 fixed.
  - Generator (special_software_env_manager/managers/script_manager.py): `SECRET_NAME_MARKERS` (TOKEN/KEY/SECRET/PASSWORD) with `_is_secret_name`. The sh summary prints `$(ai_cli_mask_secret "$X")`, the ps1 summary `$(Get-AiCliMaskedSecret -Value $env:X)`.
  - Shared helpers, using the ark masking rule (<=4 all `*`, <=8 keep 1, else keep 4): `ai_cli_mask_secret` in ai_cli_provision_common.sh and `Get-AiCliMaskedSecret` in AiCliProvisionCommon.ps1 (a CRLF file; CRLF kept). The launchers already source these files before the summary.
  - claude1-5 .sh/.ps1: the summary line is now the generator's output. A full rerun of today's generator would also add its not-yet-rolled-out "AI CLI Provisioning" region and the ps1 AskUserQuestion args to these files, so I only updated the changed summary lines.
  - Same leak class outside the finding, not changed: `API Key: $X (loaded)` in claudevolc/zhipu/alibaba/deepseek (.sh/.ps1), the Volcengine key in piark1-7/piyolo (pi_launcher_section generator), OPENAI_API_KEY in codex1/codex2/openai1, KIMI_API_KEY in kimi1/kimi2/kimiyolo.ps1 (partly the intended "paste this key" flow), and the SSH password in ssh1/2/3.ps1. Listed as IS-005-class follow-ups.
- IS-006 fixed. The em dashes in double-quoted strings are now ASCII in TtsInstallAssetsCommon.ps1, PythonPrereqInstallCommon.ps1, CursorAgentPostInstallProcessor.ps1 and capture-chrome-tamper.ps1. The ark ps1 generator template (ark_launcher_section.py, a CRLF file; CRLF kept) is now ASCII only:
  - dashes are ASCII;
  - the Chinese arkcli-output patterns are .NET regex escapes `\u672A\u627E\u5230` and `\u5DF2\u8DF3\u8FC7`, verified to match in pwsh.

  ark1-7.ps1 were regenerated from the generator; before the change they matched it byte for byte. A cp1252 decode + re-parse of every BOM-less .ps1 now fails only on postinstall/TestSwooleInstall.ps1, which is deferred: it is a test script with no callers (AGENTS.md: do not modify tests).
- IS-007 fixed. 3_setting_base.sh no longer sets `http.sslVerify false` and unsets a global `false` left by earlier runs. scripts/git/auto_commit.py no longer sets it either.
- IS-009 fixed via the finding's third option. `ClientAliveCountMax` is `$SSH_SERVER_CLIENT_ALIVE_COUNT_MAX` (default 4; with the 15 s interval, sshd closes a dead peer after about 60 s). The effective-config check compares against the same variable. TCPKeepAlive stays no. The tmux session survives, and the dead client detaches, so a reconnect after the reap resumes `main`. `-D` was rejected because it would break the "second window gets its own session" design (FIX_20260918).
- IS-011 fixed: `import platform` in webtools/file_server.py.
- IS-013 fixed (9_fix_dns.sh). There is no `chattr +i` any more. `release_static_resolv_conf` clears the immutable bit of our own static file (the marker line) on every run. The static fallback now needs an explicit `[y/N]` answer (prompt_read_default, 30 s, default n).

Changed files:
- scripts/pytools/special_software_env_manager/managers/script_manager.py
- scripts/pytools/special_software_env_manager/script_sections/ark_launcher_section.py
- scripts/shells/linux/common/ai_cli_provision_common.sh
- scripts/shells/win/win_common/AiCliProvisionCommon.ps1
- scripts/linuxenvs/claude1-5.sh
- scripts/winenvs/claude1-5.ps1
- scripts/winenvs/ark1-7.ps1
- scripts/shells/win/win_common/TtsInstallAssetsCommon.ps1
- scripts/shells/win/win_common/PythonPrereqInstallCommon.ps1
- scripts/shells/win/install_powershells/postinstall/CursorAgentPostInstallProcessor.ps1
- scripts/chromefix/capture-chrome-tamper.ps1
- scripts/shells/linux/debian/install_shells/3_setting_base.sh
- scripts/git/auto_commit.py
- scripts/shells/linux/common/ssh_server_common.sh
- scripts/webtools/file_server.py
- scripts/shells/linux/debian/install_shells/9_fix_dns.sh

Checks:
- `bash -n`, `ast.parse`, and the pwsh parser (UTF-8 and cp1252) pass.
- The mask helpers return the same output in both shells for "", "abc", "abcdefg" and an 18-char token.
- The generator-vs-file diff for ark1-7.ps1 is 0 after regeneration.

## shell-4

- IS-014 fixed.
  - The generator produces `claude{N}` only for secret numbers that exist; the store has `_1`..`_5` only, and every committed version of claude6.sh since it was added fails `bash -n`. So `scripts/linuxenvs/claude6.sh`, `claude9.sh` and `scripts/winenvs/claude6.ps1`, `claude9.ps1` are deleted rather than restored. Their blocks are removed from `create_symlinks.sh` (it runs with `set -e`).
  - `sync_linuxenvs_to_bin` (dd_helper/linuxenvs_sync.sh) now prunes `/usr/local/bin` links that point into linuxenvs but resolve to nothing, so the /usr/local/bin/claude6 and claude9 links go away on the next dd.sh run.
- IS-015 fixed. No committed version of the .sh/.js files was clean, so the corrupted strings were rewritten in ASCII English (AGENTS.md: shell in English):
  - node-upgrade-manager.sh: banner, section titles (the swallowed `${NC}` restored), markers;
  - dev/caddy/start_scanner.sh and docker_compose/nvm/run_script.sh: rewritten;
  - dev/caddy/caddy_scanner.js: shebang moved to line 1;
  - build_scripts/poly_app_manager.ps1, build_py_tools/validation_helper.ps1 and cleanup/cleanup_mcp_backends.ps1: U+FFFD banners/icons replaced with ASCII rules and `[OK]`/`[FAIL]`/`[WARN]`; the remaining box-drawing characters in poly_app_manager.ps1 are ASCII now (the IS-006 class).
- IS-016 fixed. The log lines of `fm_dnspod_candidate_install` go to stderr; stdout carries only the path.
- IS-017 fixed. `${USE_SUDO:-}` added to stop/disable/rm/daemon-reload (175_laravel_main_start.sh).
- IS-018 fixed. `Add-AiCliUserPath` reads HKCU\Environment Path with `DoNotExpandEnvironmentNames` and writes it back as `ExpandString`. It then broadcasts WM_SETTINGCHANGE (`Send-AiCliEnvironmentChange`).
- IS-019 fixed. `Get-AiCliUltracodeArgs` writes only when the content differs. On an IOException from a parallel writer it falls back to a per-PID file.
- IS-020 partly fixed, partly refuted. `--daemon` refuses when PID_FILE holds a live resource_watchdog.sh (checked via /proc cmdline), `--stop` uses the same check, and an unwritable LOG_DIR fails once with a message. Refuted: moving the log under CORE_NODE_DATA_DIR. The user requirement docs_fix/RESOURCE_WATCHDOG_FRANKENPHP_FREEZE.md (2026-09-25) fixes `/logs/debug.log` and `/logs/resource_watchdog.pid`.
- IS-021 fixed. The unused `mount_additional_disk` (mkfs without prompt, fstab without nofail) is removed from gvar_system_common.sh; nothing calls it.
- IS-023 fixed. unified_core.py logs `', '.join(domains)`.
- IS-024 fixed. `import sys` added to launch_multiple_terminals.py; the file is kept.
- IS-025 fixed. Step34 uses `& $windowsPathFuncPath "add" $qtBinPath`, the form the same file uses earlier.
- IS-026 fixed.
  - dd.sh startup no longer calls `system_unwanted_paths_cleanup`.
  - The cleanup is a new Slim & Disk Cleanup item, `system_unwanted_paths_menu`, which asks y/N first.
  - Before deleting a path, the cleanup runs `systemctl disable --now` on every .service unit in /etc/systemd/system, /lib/systemd/system or /usr/lib/systemd/system that references it, then daemon-reload.
- IS-027 fixed. 119_install_launcher filters NEED through `apt-cache show` (as 153 does) and installs only available packages; skipped names are reported. The new variables are declared at the top (the script uses `set -u`).
- IS-028 fixed.
  - 17_install_node_toolchain_26: `cleanup_wrong_install_locations` only reports other Node trees and never removes them.
  - nginx_manager `nm_conflicts_clear`: stops and disables Caddy (the port conflict); removes the package (apt remove, no purge) only after a y/N prompt with default n; never deletes /etc/caddy, /var/lib/caddy or /var/log/caddy. nginx_manager.sh now sources prompt_common.sh.
- IS-029 fixed. `Get-ClaudeTeamLiveProcess` also requires `process.StartTime <= pid-file LastWriteTime + 1 s`: a role writes its own PID right after it starts, so a process that started later reuses a stale PID.
- IS-030 fixed in scripts. The catalog `permission_mode` is no longer parsed or logged (claude_team_common.sh, ClaudeTeamCommon.ps1); per ROLES_V2 B8 the mode stays hardcoded `auto` in claudeteam.sh/.ps1. Removing the key from `config/claude_team_roles.json` belongs to the orchestrator (config is not in my scope); requested.

Changed files:
- scripts/linuxenvs/claude6.sh, claude9.sh, scripts/winenvs/claude6.ps1, claude9.ps1 (deleted)
- scripts/linuxenvs/create_symlinks.sh
- scripts/shells/linux/dd_helper/linuxenvs_sync.sh
- scripts/node-upgrade/node-upgrade-manager.sh
- scripts/dev/caddy/start_scanner.sh, scripts/dev/caddy/caddy_scanner.js
- scripts/shells/docker_compose/nvm/run_script.sh
- scripts/build_scripts/poly_app_manager.ps1, scripts/build_scripts/build_py_tools/validation_helper.ps1
- scripts/cleanup/cleanup_mcp_backends.ps1
- scripts/shells/linux/common/frankenphp_runtime_common.sh
- 175_laravel_main_start.sh
- scripts/shells/win/win_common/AiCliProvisionCommon.ps1
- scripts/services/resource_watchdog.sh
- scripts/shells/linux/common/gvar_system_common.sh
- scripts/unified_manager/core/unified_core.py
- scripts/shells/win/tools/launch_multiple_terminals.py
- Step34_InstallQt.ps1
- dd.sh, dd_helper/dev_cache_cleanup.sh, dd_helper/linux_management.sh
- 119_install_launcher.sh, 17_install_node_toolchain_26.sh
- scripts/shells/linux/common/nginx_manager.sh
- scripts/shells/win/win_common/ClaudeTeamCommon.ps1
- scripts/shells/linux/common/claude_team_common.sh

Checks: `bash -n`, `node --check`, `ast.parse` and the pwsh parser pass on all 79 changed files. CRLF parity with the working tree is kept.

## shell-5

- PR-034 (script half) fixed. `pycore_service_uninstall` (common/pycore_service.sh) now runs disable → rm unit → daemon-reload → `stop --no-block` last, so an uninstall started inside the pycore unit leaves nothing enabled even when the stop kills it. pycore was told about its half (run the uninstall via a systemd-run --scope escape).
- Requirements §2, what set the server `/` to 0777: not found, so the helpers are hardened instead.
  - Read-only sweep of every chmod 777 / a+rwx / 1777 site in scripts/ and dd.sh, plus pycore, ncore, apps, and the Laravel PHP chmod/ensureDirectory callers. No code path chmods a literal `/`.
    - The pycore Python helpers set 1777 (sticky), but the server `/` had no sticky bit.
    - The Laravel PathMapper helpers default to 0755.
    - ncore pathtool and mcp-chrome touch only fixed log/download dirs.
    - gvar_common `map_web_path` chmods only newly created dirs.
  - The one mechanism that reaches `/` is in our 777 helpers. Their guards compared only the literal string, so `//`, `/.`, `/www/..` passed, and `repair_owned_entry_777` chowns and chmods a symlink's target (a symlink's own mode reads 777, so the owner mismatch triggered it). A `/www` or data-base symlink pointing at `/` would have made `/` root-owned-by-user and 0777 without the sticky bit.
  - Hardening: `fs_perm_target_safety` (fs_perm_helpers.sh) checks both the literal path and `readlink -f` against the system-path list. `repair_owned_tree_777`, `ensure_owned_tree_777` and `repair_owned_entry_777` use it, so every caller is covered (runtime_helpers, webpath_permissions, 3_setting_base, dd.sh worker). Probe: `/`, `//`, `/.`, `/www/..` and a symlink to `/` are all refused; `/usr/local/bin` and `/www/core_node` stay safe.
  - Suggested server check (user/lead, read-only): `ls -ld /www /www/*`, `readlink -f /www`, and `stat -c '%U %a' /`. The owner of `/` shows whether our permission user was the chown target, which would confirm this path.
- Requirements §2 launcher hint fixed. `claude_team_remote_control_hint` (Linux: the lead's tmux `#{pane_start_command}`) and `Show-ClaudeTeamRemoteControlHint` (Windows: decodes the lead shell's `-EncodedCommand`) run after the role start loop. They print `run /remote-control <lead session> in the lead once` when a remote role is configured and the running lead started without `--remote-control`.
- Requirements §2 `command:` log line fixed. Remote rows now log the ssh form (`ssh <options> <secret NAME> bash -lc '... tmux -L <socket> new-session -A -s <session> ... claudeteam --agent R --name S --remote-control S <kickoff>'`); the target is never resolved or printed. The local lead row also shows `--remote-control` when a remote role exists. Both launchers are covered.

Changed files:
- scripts/shells/linux/common/pycore_service.sh
- scripts/shells/linux/common/fs_perm_helpers.sh
- scripts/shells/linux/common/claude_team_common.sh
- scripts/shells/win/win_common/ClaudeTeamCommon.ps1

Checks: `bash -n` and the pwsh parser pass; the guard probe is listed above.

## shell-6

- IS-022 fixed: 113 sites converted.
  - GlobalVars.ps1 constants first: all 22 `"$Global:X\..."` / `"$X\..."` constants, plus the `-like` pattern.
  - The named sites next:
    - CommonFunc.ps1 (13: `$env:` lists and the `"$cachePath\*"` / `"$foundInstallDir\*"` deletes and copies);
    - PackageManagerInvokes.ps1 (9);
    - PostInstallCallbackProcessor.ps1 (dot-sources plus the Gemini paths);
    - Step21 (7 `..\win_common` dot-sources, via one `$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"`);
    - Step18 (the relative `..\win_common` path and `${env:SystemRoot}`).
  - The remaining 78 sites across 36 files: every `. "$PSScriptRoot\..\win_common\X.ps1"` / `. "$parentDir\win_common\X.ps1"` dot-source, the ApplicationsList/dd.ps1/PostgresqlManager/WindowsPathFunction/Step6/Step7/DevInstaller paths, and the dev_tools/video_tools/analysis helpers.
  - Kept on purpose, 3 sites: AndroidEmulatorWorker.ps1:608 is a regex (`\s+`), not a path; Step1:92 and Step7:258 are separator-bounded `StartsWith` prefix checks.
- Join-Path fails loudly on an empty parent or a missing drive. Before, a string silently turned into `\Weixin`, which is what the finding asks to remove. No new drive dependency: every D: base in GlobalVars.ps1 (TEMP_DIR, APP_INSTALL_DIR, LANG_COMPILER_DIR) was already passed to Join-Path before this change. The hashtable form `Key = Join-Path ...` was checked in pwsh.

Changed files: GlobalVars.ps1, CommonFunc.ps1, PackageManagerInvokes.ps1, PostInstallCallbackProcessor.ps1, ApplicationsList.ps1, PostgresqlManager.ps1, WindowsPathFunction.ps1 (all win_common); dd.ps1; Step1/3/5/6/7/14/16/18/19/21/22/25/26/27/28/29/31/32/62; postinstall Go/Java/Node/Php/Ruby/Rust processors; menu_itemshells/DevInstaller.ps1; scripts/analysis/scan-large-files.ps1; scripts/dev_tools/flutter_scan_and_fix.ps1; scripts/video_tools/extract_audio.ps1.

Checks: the pwsh parser passes on every changed .ps1. Line endings match the working tree.

## Review round 1 fixes

- shell-1:
  - (blocking) Step5_InstallGitSSH.ps1: both decrypts go through `Invoke-SecretPasswordTool` (`pwd`, `$Global:SECRET_PASSWORD_ARG`, SSH_DIR), and the plain passwords are cleared on every exit path. A sweep of scripts/ for `pwd <password>` now finds only the deferred test_decrypt.sh.
  - (non-blocking) `Initialize-ClientKeySecret` writes an empty file, applies `Protect-SecretFile`, then writes the key, so the key never sits under the inherited ACL.
  - (non-blocking) `secret_read_hidden` has a scoped INT trap that restores echo; the caller's previous INT trap is restored afterwards.
  - (non-blocking, not changed) `--password-stdin` is the runner's CLI constant. It is declared once per language layer: the runner, bash secret_tool_common.sh, PowerShell GlobalVars.ps1, and once in each of the two independent Python tools, which share no module.
- shell-2:
  - (blocking) The Case 1 adopt test is `$USE_SUDO test -f` (as in `pg_keep_existing_cluster`).
  - (blocking) Case 2 calls `pg_dropcluster` only when `pg_data_dir_user_databases` of the current dir is exactly `0`. Otherwise it prints ACTION REQUIRED, restarts the stopped service and returns.
  - (non-blocking) The Case 1 adopt prints a NOTICE with the user-database count when it switches away from a current dir that has user databases (kept on disk).
  - (observation) `setup_postgresql_user` feeds the ALTER USER SQL to psql on stdin (no `-c` argv), and the open_basedir mirror file is now 644 instead of 666 (still readable by a panel PHP user, no longer world-writable).
- shell-3 (blocking): the ark generator's embedded `Get-MaskedSecret`/`mask_secret` are removed; its calls use the shared `Get-AiCliMaskedSecret`/`ai_cli_mask_secret` (the launchers source the common files earlier). ark1-7.ps1 and ark1-2.sh (ark3-7.sh do not exist) are regenerated; all matched the generator byte for byte before.

## Review round 2 (IS-001, lead request)

- The user-database count is taken once, before `pg_service stop`. `pg_data_dir_user_databases` asks a running cluster through the privileged psql path (`SELECT count(*) FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'`, via run_as_postgres) and counts base/ on disk only when the cluster is stopped. `pg_dropcluster` runs only when that count is exactly `0`.

## shell-8 (K7a, requested by pycore)

- `scripts/shells/linux/common/pyservice_entry.sh`:
  - `BIND_HOST` now defaults to empty, and `--host` is passed only when the caller sets it, so the worker binds pycore's own default, `HTTP_BIND_HOST = host("loopback")` from the service contract. No bind literal remains in shell.
  - The help text says the default is loopback and that a LAN host also needs `pyservice.sh config system set --key rpcLanBind --value true`.
  - The run log shows `host=loopback` when the host is unset.
- No other script passes a 0.0.0.0 bind to pycore; the remaining 0.0.0.0 hits are Laravel/preview dev servers.

## shell-7 (B9: the IS-005 leak class across launchers)

All masking goes through the shared `ai_cli_mask_secret` / `Get-AiCliMaskedSecret`. Which names count as secret is decided in one module, `special_software_env_manager/utils/secret_display.py` (`SECRET_NAME_MARKERS` and `is_secret_name`), used by script_manager, env_loading_section and both command_content generators.

Generators fixed, then regenerated through them:
- `env_loading_section.py` (codex and any non-v4 prefix):
  - PowerShell: `Loaded X = ...` is masked for secret names, the `[DEBUG] Value: $value` leak is removed, and AiCliProvisionCommon.ps1 is dot-sourced when the helper is missing.
  - Bash: `load_secret_value` takes a 5th `secret|plain` argument from the generator; the Loaded, `Command executed`, VERIFY and Expected/Actual lines print masked values; ai_cli_provision_common.sh is sourced when needed.
- `command_content_generator_{linux,windows}.py` (codex launch):
  - the Variable Summary is masked;
  - the `Using command` / `Command:` display is a separate masked string. The value-bearing string is used only for bash `eval` (a builtin, so the values stay off any argv).
  - Windows: the child `powershell -Command` now gets only the tool command, `$fullCommand`, which inherits the `$env:` values. Before, every env value, including the API key, was on the child's command line (the IS-010 class).
- `kimi_launcher_section.py`: `KIMI_API_KEY_n` is masked, and the shared helper is loaded before the print. The intentional "paste this key" flow is kept.
- `ssh_command_generator.py`: the `SSH password loaded` line prints only the length. The copy-paste block, shown only when a password login is needed, is the intentional flow and is kept.
- piark1-7 come from the piyolo templates (below).
- Regenerated with the generator, parity 0 afterwards: claude1-5, codex1-2, kimi1-2, ark1-7.ps1, ark1-2.sh, piark1-7, ssh1-3 (.sh/.ps1).
  - claude1-5, codex1-2 and kimi1-2 also picked up the generator's pending shared-provisioning section, which replaces the older inline upgrade code with `ai_cli_provision` / `ai_cli_upgrade_prompt`.
  - codex2 was an older generation (about 300 lines closer to codex1 now).

Hand-written, edited directly (no generator):
- claudevolc, claudezhipu, claudealibaba, claudedeepseek (.sh/.ps1): `API Key: ... (loaded)` is masked; these already sourced the common files.
- piyolo.sh/.ps1 (the piark template): source the common helper; the Volcengine key is masked.
- kimiyolo.sh/.ps1: source the common helper; the key menu, "Using KIMI_API_KEY_n" and "API key" lines are masked; the paste flow is kept.
- openai1.sh: an orphan generated file, since no config has an `openai` prefix any more. It sources the helper, and OPENAI_API_KEY is masked.

Checks:
- Leftover sweep over scripts/linuxenvs and scripts/winenvs: the only value prints left are base URLs, models, paths, and the two intentional paste flows.
- The claude1-5 and ark outputs have no unmasked prints after the shell-3 rework.
- Generator parity is 0 for every generated file; `bash -n`, `ast.parse` and the pwsh parser pass; line endings are unchanged.

## shell-9 (review follow-ups: password mirror, 777 guard list)

- 75_install_postgresql.sh, the postgres password mirror (`<laravel_db>/.core_node_secrets/POSTGRES_PASSWORD`):
  - The store now belongs to its reader. `pg_mirror_reader` picks the first of `PG_PHP_RUNTIME_USER_CANDIDATES` (www www-data nginx apache) that runs a PHP process (`pgrep -u <user> php`); otherwise root, since the core_node FrankenPHP/Octane service runs as root.
  - The directory is set to reader-owned 0700 only when owner or mode differ. The file is written under umask 077 and then set to reader-owned 0600, the same model Laravel's RuntimeConfigurationStore uses. It was 0666 at audit time and 0644 in round 1. Every run is idempotent.
- postgresql_install_common.sh `get_postgresql_password` reads the mirror fallback through `$USE_SUDO test -s` / `$USE_SUDO head`. A non-root run no longer misses the 0600 file and so never rotates the password.
- fs_perm_helpers.sh:
  - `.core_node_secrets` is pruned from every 777 walk (the dd.sh webpath walk covers wwwroot and would otherwise reset the file to 0777). The new `repair_app_secret_tree` keeps the owner, sets files to 0600 and removes group/other write from directories.
  - shell-5 note: `fs_perm_target_safety` now also refuses /lib64, /var/lib, /var/log, /boot, /root, /home, /opt, /srv, /mnt, /media, /tmp, /run, /proc, /sys and /dev. The entries /home, /root, /opt, /srv, /mnt, /media, /tmp, /var/lib and /var/log are refused as exact paths; /boot, /run, /proc, /sys, /dev and /lib64 with their whole subtree. /var/_core_node and /usr/local stay allowed.
  - Probes: the guard table (/home and /root refused; /home/debian, /opt/_core_node, /var/_core_node/x and /mnt/dev_nvme0n1p1 safe). A scratch 777 walk over wwwroot left `.core_node_secrets` at 755 with its file 600, still owned by `nobody`.
- Noted for shell-7 (lead ack): the regenerated claude1-5, codex1-2 and kimi1-2 now carry the generator's shared ai_cli_provision section.

## Status summary

All shell tasks (shell-1 through shell-9) are approved.

Blockers: none.

Handed off:
- pycore: switch pycore/pyfoundations/secret_manager.py to the stdin password runner (IS-010), and add the systemd-run --scope escape for the PR-034 uninstall.

Watch on the first runs (reviewer note): the regenerated claude1-5, codex1-2 and kimi1-2 launchers now use the shared ai_cli_provision install/upgrade section.

User actions for K2:
1. Run dd.sh once on one machine, then encrypt CORE_NODE_CLIENT_KEY_1 when prompted.
2. Sync the encrypted copy.
3. Run dd.sh / dd.cmd on every other host, including the laravel-main server.

Deferred: test_decrypt.sh and TestSwooleInstall.ps1 are test scripts; AGENTS.md does not allow modifying tests.

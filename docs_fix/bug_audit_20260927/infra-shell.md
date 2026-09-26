# infra-shell bug audit (S4) — report only

Date: 2026-09-27 · Role: infra-shell · Prefix: IS · Binding doc: `docs_fix/REQUIREMENTS_20260927_TEAM_BUG_AUDIT.md`
No code, config, doc or test was changed. Static checks used: `bash -n` (547 .sh), PowerShell parser via pwsh (295 .ps1/.psm1),
`ast.parse` (296 .py, 0 errors), `node --check` (241 .js), CRLF/non-ASCII/BOM scans, and a cp1252 decode + re-parse simulation of every
BOM-less non-ASCII .ps1 (the Windows PowerShell 5.1 read path that `dd.cmd` uses: `powershell -File`).
Language-semantics probes were run only on throw-away snippets in the scratchpad (never on an audited script).
Files in flux: every in-scope file modified after 02:10 (41 files, the latest at 02:49) was re-read and syntax-checked again at 02:51-02:52. A finding in such a file is kept only if it still held at that re-read, and it carries `[in-flight, last read HH:MM]`. The role was renamed `shell` in REQUIREMENTS_20260927_CLAUDE_AGENT_ROLES_V2; the IS prefix is unchanged.

## Summary

30 findings: critical 1, high 3, medium 9, low 17. Ordered most severe first.

## Findings

### IS-001 — PostgreSQL ensurer drops the existing cluster (and its data) whenever the computed data dir differs and is still empty
- severity: critical · category: data-loss · confidence: confirmed
- location: scripts/shells/linux/debian/install_shells/75_install_postgresql.sh:194-209 (need_recreate) and :254-268 (`pg_dropcluster --stop "$POSTGRESQL_VERSION" main`); reached from main :552-561, and on every `175_laravel_main_start.sh` run (it calls 75 unconditionally, "Running canonical PostgreSQL ensurer")
- failure scenario: (a) A host already has a PostgreSQL cluster with real data at `/var/lib/postgresql/17/main`. On a non-WSL host, configure_postgresql picks `map_web_path postgresql`/data (POSIX mapping path), which has no PG_VERSION yet, so `need_recreate=true` and Case 2 runs `pg_dropcluster --stop 17 main`. That deletes the cluster's data directory and config, then an empty cluster is created at the new path. No prompt, no dump. (b) Same outcome whenever the computed path string changes (the `/www` bind or data disk is not mounted at boot, the WWW_PATH var changes, or on WSL the D-image mounts/unmounts) and the new path is empty. The code comment admits "recreates a fresh one there (sys:init re-seeds from init_data -- NOT a dump/restore migration)"; everything not in init_data is lost.
- evidence: pg_dropcluster(1) removes the cluster's data directory. The only guard is `[ -f "$POSTGRESQL_DATA_DIR/PG_VERSION" ]` on the new path; nothing checks whether the old cluster holds data.
- suggested fix: never drop a cluster that contains user databases. Relocate by stop + rsync (or pg_dump/restore) + config switch, or refuse and print an ACTION REQUIRED.


### IS-002 — Windows Step93/94/96 do not parse, so FrankenPHP, its Composer and its PHP ini are never installed on Windows
- severity: high · category: windows-breakage · confidence: confirmed
- location: scripts/shells/win/install_powershells/Step93_InstallFrankenPHP.ps1:20; Step94_InstallComposer.ps1:30; Step96_ConfigurePHP85.ps1:20
- failure scenario: dd.cmd → dd.ps1 step run, or Step175_LaravelMainStart.ps1 (`& $step93Path; & $step94Path; & $step96Path` at Step175_LaravelMainStart.ps1:68-70) on a fresh Windows host → each call fails with ParserError "Variable reference is not valid. ':' was not followed by a valid variable name character" → `Ensure-FrankenPhpNativeInstall`, `Install-ComposerForPhp` and `Ensure-FrankenPhpPhpConfiguration` never run. Step175 does not stop (a parse error in a called script is non-terminating for the caller) and goes on with no FrankenPHP binary, no composer.phar and no php.ini. The Laravel FrankenPHP service is never installed.
- evidence: `Write-FrankenPhpLog -Message "Step $STEP_NUMBER: ensuring ..."`. `$STEP_NUMBER:` is parsed as a scope/drive-qualified variable. The pwsh parser reports exactly these 3 files. A scratchpad probe (`& bad.ps1` from a caller) shows the ParserError and then "after-call continues". `Ensure-FrankenPhpNativeInstall` has no caller other than Step93 (grep).
- suggested fix: use `"Step ${STEP_NUMBER}: ..."` (as Step175 already does) in the three files.


### IS-003 — Root git push copies the project deploy key over every logged-in user's own private key, with no backup
- severity: high · category: data-loss · confidence: confirmed
- location: scripts/git/gitput_security_common.sh:467-523 (ensure_ssh_keys_installed step 6), called on every push from scripts/git/gitput_unified.sh:162
- failure scenario: root runs gitput_unified.sh while desktop user `debian` is logged in and has a personal `~/.ssh/id_ed25519`. `w -h` lists `debian`, and `cp -f "$found_key_path" "$user_ssh_dir/$key_basename"` overwrites the personal key with the project key (or with root's own verified key). The user's key is lost for good: step 2 backs up root's key before replacing it, but step 6 makes no backup. From then on that user's ssh/git identity silently changes.
- evidence: `cp -f "$found_key_path" "$user_key"; chown "$login_user:$login_user" ...` for every `w -h` user except root. The key name is shared (`id_ed25519`).
- suggested fix: never overwrite an existing different key (compare content, skip or back up), and install to users only on explicit opt-in.


### IS-004 — Windows path mapping removes a stale junction with `Remove-Item -Recurse -Force` under Windows PowerShell 5.1, which deletes the junction target's contents
- severity: high · category: data-loss · confidence: likely (PS 5.1 behaviour; PS 7 removes only the link)
- location: scripts/shells/win/win_common/PathMappingLib.ps1:420-431 (Remove-PathMappingLinkLocation), reached from :690-697 (Invoke-IdempotentPathMapping "Removing stale junction"); run on every dd.ps1 start (dd.ps1:1197 `Invoke-DefaultUserProfilePathMappings`) via `dd.cmd` → `powershell` (5.1)
- failure scenario: `%USERPROFILE%\.core_node` is a junction to the legacy root `D:\programing\Users\<user>\.core_node` (the dd.cmd mirror root), and the mapping target is now `$Global:CORE_NODE_DATA_DIR`. Sync-LegacyCoreNodeRuntimeData copies only the listed subfolders (config, data, cache, logs, ...). Then the stale-junction branch runs `Remove-Item -LiteralPath <junction> -Recurse -Force`, and Windows PowerShell 5.1 recurses through the reparse point and deletes everything in the legacy root, including folders that were never copied (e.g. the `scripts\` mirror that dd.cmd downloads, and any unlisted state). The same happens for any dot-folder whose junction target changed. Even on PS 7 the old target's content is not merged into the new target before the relink.
- evidence: `Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop` is called on a path that Test-PathIsDirectoryJunction just confirmed is a reparse point.
- suggested fix: delete junctions with `[System.IO.Directory]::Delete($link)` (non-recursive) or `cmd /c rmdir`, and merge the old target into the new one before relinking.


### IS-005 — `claude1`–`claude5` launchers (sh and ps1) print the full ANTHROPIC_AUTH_TOKEN to the terminal
- severity: medium · category: security · confidence: confirmed
- location: scripts/pytools/special_software_env_manager/managers/script_manager.py:385 and :523 (generator); emitted at scripts/linuxenvs/claude{1..5}.sh:81 and scripts/winenvs/claude{1..5}.ps1:89
- failure scenario: running `claude1` prints `ANTHROPIC_AUTH_TOKEN: sk-...` in clear text. The token ends up in tmux/terminal scrollback, screen shares, recordings and CI logs. The ark launchers mask the same key (`$masked_api_key`), so the claude generator is inconsistent with its own ark path.
- evidence: `summary_lines.append(f'echo "{dname}: ${name}"')` runs for every variable, including the secret. The ps1 generator emits `Write-Host "{dname}: $($env:{name})"`.
- suggested fix: mask values whose name matches TOKEN/KEY/SECRET in both generators (reuse the ark masking), then regenerate.


### IS-006 — BOM-less UTF-8 .ps1 files with non-ASCII inside double-quoted strings fail to parse under Windows PowerShell 5.1 on non-UTF-8 code pages
- severity: medium · category: windows-breakage · confidence: likely (confirmed for cp1252; cp936 behaviour not reproducible on Linux)
- location: scripts/winenvs/ark1.ps1..ark7.ps1:416/444/452; scripts/shells/win/win_common/TtsInstallAssetsCommon.ps1:163; scripts/shells/win/win_common/PythonPrereqInstallCommon.ps1:363; scripts/shells/win/install_powershells/postinstall/CursorAgentPostInstallProcessor.ps1:208; postinstall/TestSwooleInstall.ps1:66; scripts/chromefix/capture-chrome-tamper.ps1:130
- failure scenario: `dd.cmd` runs `powershell -File` (Windows PowerShell 5.1). 5.1 reads BOM-less files in the ANSI code page. On a cp1252 system "—" (E2 80 94) decodes to `â€"`, and 0x94 → U+201D is a PowerShell double-quote, so the string closes early. The whole file then fails to parse. TtsInstallAssetsCommon.ps1 is dot-sourced by Step12/36/38/56/58/59, so every TTS step dies on such hosts; the ark launchers do not start.
- evidence: I decoded each BOM-less non-ASCII .ps1 as cp1252 and re-parsed it with pwsh. Parse errors in: ark1-7.ps1 (10 each), TtsInstallAssetsCommon.ps1 (48), PythonPrereqInstallCommon.ps1 (3), CursorAgentPostInstallProcessor.ps1 (3), TestSwooleInstall.ps1 (3), capture-chrome-tamper.ps1 (6). The files with a UTF-8 BOM parse fine.
- suggested fix: save the win_common/steps/winenvs .ps1 files as UTF-8 with BOM, or replace non-ASCII punctuation in strings with ASCII.


### IS-007 — Global `git config http.sslVerify false` disables TLS verification for every git operation of the installing user
- severity: medium · category: security · confidence: confirmed
- location: scripts/shells/linux/debian/install_shells/3_setting_base.sh:418 (inside install_packages_and_configure_git)
- failure scenario: base setup (dd.sh first run, `dd_run_base_setup`) writes `http.sslVerify=false` to root's `~/.gitconfig`. Every later `git clone/pull/push` over HTTPS (project updates, installers that clone upstream sources such as GPT-SoVITS or FrankenPHP) accepts any certificate. That allows a MITM to inject code into cloned sources. The same step also sets a fixed global identity "prop-dev".
- evidence: `git config --global http.sslVerify "false" || true`.
- suggested fix: drop the global override; scope it to a specific remote only if a broken proxy needs it.


### IS-008 — dd.sh startup chmods the whole project tree to 777, including decrypted secrets `[in-flight, last read 02:51]`
- severity: medium · category: security · confidence: confirmed
- location: scripts/shells/linux/common/fs_perm_helpers.sh:185-202 (repair_owned_tree_777), called from scripts/shells/linux/dd_helper/smart_permissions.sh:58 via dd.sh `smart_permissions_fix`
- failure scenario: every dd.sh start (as root, in a detached worker) finds every entry under the project root that is not mode 0777 and runs `chmod 777` on it. That includes `.secret_keys/.secret_ignore/*`, which holds the decrypted API tokens the launchers read. On an ext4 server install any local account, including www-data running PHP/FrankenPHP, can read and overwrite those tokens and the `.git` objects.
- evidence: `find "$target_path" \( -type d -o -type f \) \( ! -user ... -o ! -perm 0777 \) -print0 | xargs -0 chmod 777` has no exclusion. `ls -la .secret_keys` on this host shows drwxrwxrwx on `.secret_ignore`.
- suggested fix: exclude `.secret_keys`, `.secrets` and `.git` from the 777 walk and keep secrets at 0600/0700 owned by the permission user.


### IS-009 — SSH tmux persistence hook opens a new `main-N` session instead of resuming after a dropped connection
- severity: medium · category: contract · confidence: likely
- location: scripts/shells/linux/common/ssh_server_common.sh:154-162 (drop-in: `TCPKeepAlive no`, `ClientAliveCountMax 0`) together with the profile hook at :501-521
- failure scenario: the network drops. With ClientAliveCountMax 0 (never terminate) and TCPKeepAlive off, sshd only notices when TCP retransmits of its keepalive writes time out (Linux tcp_retries2, ~15+ min). Until then the dead connection's tmux client still counts as attached to `main`. The user reconnects within minutes; the hook sees `tmux list-clients -t main` as non-empty and creates or attaches `main-2`, so the running shell is not resumed. This contradicts FIX_20260918 ("a dropped connection leaves its session unattached, so a reconnect resumes it").
- evidence: hook selection `elif [ -z "$(tmux list-clients -t "$candidate")" ]` only resumes sessions with zero clients; nothing detaches stale clients.
- suggested fix: attach with `tmux new-session -A -D -s main` for the base session (detach other clients) or detect stale clients by `client_activity`; alternatively allow a finite ClientAliveCountMax.


### IS-010 — Secret-decryption passwords are passed on the node command line, and step 27 echoes the SSH key password while typing `[in-flight, last read 02:51]`
- severity: medium · category: security · confidence: confirmed
- location: scripts/shells/linux/dd_helper/secret_functions.sh:338 and :364 (`"$SECRET_NODE_CMD" "$SECRET_BUNDLE_FILE" pwd "$SECRET_PASSWORD" ...`); scripts/git/gitput_security_common.sh:382,394; scripts/shells/linux/debian/install_shells/27_install_git_ssh.sh:353-357 (prompt) and :381,387 (argv)
- failure scenario: while decryption runs, any local account can read the master secret password from `/proc/<pid>/cmdline` or `ps -ef`. In non-batch mode there is one node process per encrypted file, so the window lasts seconds. In step 27 the password is read with `prompt_read_default` (plain `read`, no `-s`), so it is shown on screen and in recordings/scrollback, even though the file defines `read_password_with_asterisks`.
- evidence: `prompt_read_default password "" 30` → prompt_common.sh:54 `read -r -t ... < /dev/tty` (echo on).
- suggested fix: pass the password via stdin or an environment variable to the node tools, and read it with `read -s` (or the existing asterisk reader).


### IS-011 — webtools/file_server.py crashes on every start with NameError 'platform'
- severity: medium · category: crash · confidence: confirmed
- location: scripts/webtools/file_server.py:1125 (get_local_ips), called unconditionally at :1307
- failure scenario: `python file_server.py <dir>` binds the port (line 1303), then calls get_local_ips(). Line 1125 `system = platform.system()` sits outside any try, and `platform` is never imported (imports are at lines 8-23), so the server exits with a traceback before serving anything.
- evidence: an AST undefined-name scan of all 296 scoped .py files found 3 hits; this is one.
- suggested fix: `import platform` at the top.


### IS-012 — PostgreSQL "data dir drift" check and configure disagree on the expected path, so PostgreSQL is stopped/restarted on every run
- severity: medium · category: service · confidence: confirmed
- location: scripts/shells/linux/debian/install_shells/75_install_postgresql.sh:483-494 (pg_expected_data_dir → `map_web_path compile_dir postgresql/data`) vs :176-187 (configure_postgresql → `map_web_path postgresql`/data when POSIX)
- failure scenario: on a non-WSL host whose mapping path is POSIX, configure places the cluster under `…/wwwroot/postgresql/data`. On the next 75/175 run, pg_data_dir_drifted compares it with `…/<compile_dir>/postgresql/data`, reports drift and calls configure_postgresql. That runs `pg_service stop`, rewrites data_directory to the same value and restarts, dropping every Laravel/pycore connection on each dd/175 start. Combined with IS-001, if the two paths ever point at different empty/non-empty dirs, the drift branch becomes the drop branch.
- evidence: two different map_web_path keys for the same concept.
- suggested fix: derive the expected dir from one shared function used by both configure_postgresql and pg_data_dir_drifted.


### IS-013 — DNS fixer replaces the resolv.conf symlink with a static file and makes it immutable (`chattr +i`)
- severity: medium · category: network · confidence: likely
- location: scripts/shells/linux/debian/install_shells/9_fix_dns.sh:281-327 (create_static_resolv_conf), reached from main :752-755 whenever the connectivity pre-check and verify_dns fail
- failure scenario: run the installer while the uplink is briefly down (cable, Wi-Fi not yet up, captive portal). The fallback deletes the systemd-resolved symlink, writes public resolvers (8.8.8.8/223.5.5.5) and sets the immutable bit. Once the network returns, DHCP/NetworkManager/Tailscale MagicDNS/VPN can no longer update DNS. On LANs that block public DNS, resolution stays broken until someone runs `chattr -i` by hand. No script ever clears the flag (only a backup copy is kept).
- evidence: `$USE_SUDO rm -f /etc/resolv.conf` (symlink) … `$USE_SUDO chattr +i /etc/resolv.conf`.
- suggested fix: do not set +i; prefer a systemd-resolved drop-in (already attempted in step 4) and only write a static file after an explicit prompt.


### IS-014 — `claude6` and `claude9` launchers are syntax errors but are linked into /usr/local/bin
- severity: low · category: dead-code · confidence: confirmed
- location: scripts/linuxenvs/claude6.sh:368, scripts/linuxenvs/claude9.sh:368
- failure scenario: `claude6` → "syntax error near unexpected token `fi'". `sync_linuxenvs_to_bin` links every `scripts/linuxenvs/*.sh`, so both are live commands (/usr/local/bin/claude6 and /usr/local/bin/claude9 exist on this host). These are July-era generated files the current generator no longer produces (it produces claude1-5).
- evidence: `bash -n`; line 368 is an orphan `fi` after the env-var block.
- suggested fix: delete the stale claude6/claude9 (.sh and .ps1) or regenerate them.


### IS-015 — Several scripts were corrupted by a lossy encoding conversion and no longer parse or print correctly
- severity: low · category: corruption · confidence: confirmed
- location: scripts/node-upgrade/node-upgrade-manager.sh:66-70; scripts/dev/caddy/start_scanner.sh:28-37; scripts/shells/docker_compose/nvm/run_script.sh:11; scripts/dev/caddy/caddy_scanner.js:13 (shebang after the header); scripts/build_scripts/poly_app_manager.ps1:84 (closing quote eaten after "�?"); scripts/build_scripts/build_py_tools/validation_helper.ps1:59-124; scripts/cleanup/cleanup_mcp_backends.ps1:23-25
- failure scenario: the Chinese text was replaced by `?`/U+FFFD and adjacent quotes/newlines were swallowed. `bash -n` fails for the three .sh files and `node --check` fails for caddy_scanner.js, so they cannot run. poly_app_manager.ps1 still parses, but the quote pairing is shifted, so the banner prints garbage tokens.
- evidence: `bash -n`/`node --check` output; `cat -A` shows `echo "???? ...` lines without closing quotes.
- suggested fix: restore these files from history or rewrite the affected strings in ASCII English.


### IS-016 — fm_dnspod_candidate_install mixes log lines into its stdout return value
- severity: low · category: contract · confidence: confirmed
- location: scripts/shells/linux/common/frankenphp_runtime_common.sh:529-551 (callee), :584-588 (caller)
- failure scenario: the static build fails or the probe rejects it → the function echoes "[175] [WARN] dnspod module deferred ..." on stdout. The caller's `candidate="$(fm_dnspod_candidate_install)"` is non-empty, so it prints "compiled candidate prepared: [175] [WARN] dnspod module deferred ...". A failure is reported as success. On success the captured value is two lines (log line + path).
- evidence: the callee's warn/error `echo`s have no `>&2`, while `fm_static_build` sends its logs to `>&2`.
- suggested fix: send the callee's log lines to stderr so stdout carries only the path.


### IS-017 — 175_laravel_main_start.sh removes the opposite-plane unit with raw systemctl/rm (no $USE_SUDO) `[in-flight, last read 02:51]`
- severity: low · category: sudo-root · confidence: confirmed
- location: scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh:901-909
- failure scenario: run as a sudo-capable non-root user → `systemctl stop/disable` and `rm -f /etc/systemd/system/ncore-laravel-nginx.service` fail silently (stderr to /dev/null). Both plane units stay enabled and race for the same port at boot. The rest of the file uses `${USE_SUDO:-}` (lines 456-472, 754-771).
- evidence: `systemctl stop "$_old_service" 2>/dev/null; ... rm -f "/etc/systemd/system/${_old_service}.service"`.
- suggested fix: prefix these with `${USE_SUDO:-}` like the surrounding code.


### IS-018 — Add-AiCliUserPath rewrites the user PATH as REG_SZ with expanded values
- severity: low · category: windows-breakage · confidence: likely
- location: scripts/shells/win/win_common/AiCliProvisionCommon.ps1:98-101
- failure scenario: when `%USERPROFILE%\.local\bin` is missing from the user PATH, `[Environment]::GetEnvironmentVariable("Path","User")` returns the expanded value. SetEnvironmentVariable then writes it back as REG_SZ. Entries such as `%USERPROFILE%\AppData\Local\Microsoft\WindowsApps` or `%JAVA_HOME%\bin` are frozen to today's expansion and lose REG_EXPAND_SZ. Later changes to JAVA_HOME and similar variables no longer apply.
- evidence: the .NET API contract (reads expanded, writes REG_SZ).
- suggested fix: read and write `HKCU\Environment\Path` through the registry with `DoNotExpandEnvironmentNames` and REG_EXPAND_SZ.


### IS-019 — All Windows role windows write the same temp ultracode settings file concurrently `[in-flight, last read 02:51]`
- severity: low · category: race · confidence: suspect
- location: scripts/shells/win/win_common/AiCliProvisionCommon.ps1:408-409 (Get-AiCliUltracodeArgs), used by scripts/winenvs/claudeteam.ps1:72
- failure scenario: claudeteamup.ps1 starts up to 7 role windows ~1 s apart. Each runs `[IO.File]::WriteAllText("%TEMP%\claudeteam_ultracode_settings.json")`. Two overlapping writes raise IOException (the file is opened with FileShare.Read). Under `$ErrorActionPreference="Stop"` in claudeteam.ps1 that aborts the role before `claude` starts; the window stays open (-NoExit) with an error.
- evidence: a single fixed filename per SettingsName, and claudeteam.ps1 sets `$ErrorActionPreference = "Stop"`.
- suggested fix: write only when the content differs, or use a per-process file name (include $PID).


### IS-020 — resource_watchdog.sh `--daemon` can start duplicates, and `--stop` then stops only the last one
- severity: low · category: idempotency · confidence: confirmed
- location: scripts/services/resource_watchdog.sh:117-118, :138-147
- failure scenario: running `--daemon` twice overwrites /logs/resource_watchdog.pid. The first loop keeps running and logging forever; `--stop` kills only the second. As non-root, `LOG_DIR=/logs` (a root-level dir) cannot be created and every log write fails.
- evidence: `daemon_loop` writes `$$` without checking for a live PID.
- suggested fix: refuse to start when the PID file holds a live watchdog, and put the log/PID under CORE_NODE_DATA_DIR.


### IS-021 — mount_additional_disk runs mkfs without confirmation and writes a non-`nofail` fstab entry (latent, no caller)
- severity: low · category: data-loss · confidence: confirmed (no caller today)
- location: scripts/shells/linux/common/gvar_system_common.sh:165-220
- failure scenario: the function is loaded into every shell that sources gvar_common.sh. Called on a device that `blkid` cannot identify (BitLocker, dynamic disk, raw data), it runs `mkfs.$filesystem_type` with no prompt and adds `UUID=... defaults 0 2` without `nofail`. A later absent disk then drops boot into emergency mode.
- evidence: `if ! blkid "$disk_device"; then mkfs.$filesystem_type "$disk_device"`; mount_common.sh's own entries use `nofail,x-systemd.device-timeout=10`.
- suggested fix: remove the helper, or guard mkfs with an explicit confirmation and reuse mount_fstab_ensure_single_entry with nofail options.


### IS-022 — PowerShell paths built by string interpolation instead of Join-Path (141 sites) `[in-flight, last read 02:52]`
- severity: low · category: rule · confidence: confirmed
- location: scripts/shells/win/win_common/GlobalVars.ps1:146-162,236,412,449,463,471,643 (20 sites); CommonFunc.ps1:626,1624-1671,1865-1868; PackageManagerInvokes.ps1 (9); PostInstallCallbackProcessor.ps1:40-41; Step21_InstallApplications.ps1 (7); Step18_SetFileAssociations.ps1:21 (`"..\win_common\GlobalVars.ps1"` relative path)
- failure scenario: violates the AGENTS.md / shell-guide rule "PowerShell must use Split-Path/Join-Path/Resolve-Path and must not append strings directly to variables". An empty root variable (e.g. `$Global:APP_INSTALL_DIR`) silently yields a drive-root path such as `\Weixin`.
- evidence: grep `"\$var\...` across the 295 .ps1 files → 141 non-comment hits.
- suggested fix: convert the centralized constants in GlobalVars.ps1 first (one Join-Path per constant).


### IS-023 — unified_manager "proxy" action crashes with NameError 'domain'
- severity: low · category: crash · confidence: confirmed
- location: scripts/unified_manager/core/unified_core.py:683
- failure scenario: the user picks the domain-proxy action and enters domains. The vars are written, then `menu.log_info(f"Domain: {domain}")` raises NameError (only `domains` exists), so the menu loop crashes after the state was already marked EXECUTE_READY.
- evidence: `domain` is not bound anywhere in the module (AST scan).
- suggested fix: log `", ".join(domains)`.


### IS-024 — launch_multiple_terminals.py fails at import (NameError 'sys')
- severity: low · category: crash · confidence: confirmed
- location: scripts/shells/win/tools/launch_multiple_terminals.py:10
- failure scenario: `sys.path` is used on line 10 but `sys` is never imported, so any invocation dies immediately. pycore's char_size_measurer.py calls it "old", so it is probably retired; delete it or fix it.
- evidence: AST scan; the imports on lines 1-7 lack `sys`.
- suggested fix: remove the stale tool or add `import sys`.


### IS-025 — Step34_InstallQt calls the undefined `Add-ToPath` and then reports success
- severity: low · category: windows-breakage · confidence: confirmed
- location: scripts/shells/win/install_powershells/Step34_InstallQt.ps1:944-945
- failure scenario: Qt installs, then `Add-ToPath -PathToAdd $qtBinPath -Scope "Machine"` → CommandNotFoundException (no such function in any of the 295 .ps1/.psm1 files). The next line still prints "Qt bin added to PATH", so Qt tools stay off PATH while the log claims success.
- evidence: a cross-file PowerShell AST scan of defined functions vs called Verb-Noun commands.
- suggested fix: use the shared WindowsPathFunction.ps1 `add` entry (as IsolatedPythonInstallCommon does).


### IS-026 — dd.sh deletes /usr/local/qcloud on every start without stopping or disabling the Tencent Cloud agent units `[in-flight, last read 02:51]`
- severity: low · category: service · confidence: likely
- location: scripts/shells/linux/dd_helper/dev_cache_cleanup.sh:46-48, :179-196 (system_unwanted_paths_cleanup, called from dd.sh main)
- failure scenario: on a Tencent Cloud VM (e.g. the VM-0-2-debian server) the TAT/monitor agent units still reference binaries under /usr/local/qcloud. dd.sh removes the tree while the units stay enabled, so they fail or restart-loop and fill the journal. The cloud also reinstalls the agent, so the delete repeats on every start. This also contradicts REQUIREMENTS_20260927_DD_SH_STARTUP_REFACTOR R4 (cleanup belongs in Slim & Disk Cleanup, not startup).
- evidence: `$USE_SUDO rm -rf "$p"` with no service handling.
- suggested fix: move it into the Slim & Disk Cleanup menu and disable the agent units (tat_agent, YDService, etc.) before deleting.


### IS-027 — 119_install_launcher installs all missing tools in one apt transaction, so one unavailable package blocks xclip/wl-clipboard too
- severity: low · category: installer-parity · confidence: suspect
- location: scripts/shells/linux/debian/install_shells/119_install_launcher.sh:152-158
- failure scenario: NEED holds e.g. `xclip wl-clipboard x11-utils wlr-randr kitty`. If any one has no candidate (the script's own comment says wlr-randr "only exists in newer repos"), `apt-get install -y "${NEED[@]}"` aborts the whole transaction, and output goes to /dev/null. The R8 tools (xclip, wl-clipboard, x11-utils) are then never installed, and the only message is "Some launcher prerequisites failed".
- evidence: a single `$SUDO apt-get install -y "${NEED[@]}" >/dev/null 2>&1`.
- suggested fix: filter NEED through `apt-cache policy`/`apt-cache show` first (as 153_install_desktop_applications does), or install per package.


### IS-028 — Installers delete other working installs instead of repairing only what is missing
- severity: low · category: rule · confidence: confirmed
- location: scripts/shells/linux/debian/install_shells/17_install_node_toolchain_26.sh:221-233 (cleanup_wrong_install_locations, called at :870); scripts/shells/linux/common/nginx_manager.sh:101-116 (nm_conflicts_clear, run once by 33_install_nginx.sh:80)
- failure scenario: a host has a working Node under /opt/node (or /usr/local/node, /var/node) used by another service. Step 17 runs `rm -rf` on it precisely because `node -v` works there, and that service breaks. Step 33 purges an existing Caddy and runs `rm -rf /etc/caddy /var/lib/caddy`, destroying its ACME account and issued certificates without a prompt.
- evidence: `if [ -n "$candidate_state" ]; then $USE_SUDO rm -rf "$candidate"`; `$sudo_cmd rm -rf /etc/caddy /var/lib/caddy /var/log/caddy`.
- suggested fix: leave foreign installs in place (only fix PATH/links), or ask before removing, and never delete /var/lib/caddy.


### IS-029 — Windows claudeteamup treats any powershell/pwsh process that reuses a stale PID as a running role `[in-flight, last read 02:51]`
- severity: low · category: race · confidence: likely
- location: scripts/shells/win/win_common/ClaudeTeamCommon.ps1:259-277 (Get-ClaudeTeamLiveProcess, unchanged by the 02:48 V2 edit), used by Start-ClaudeTeamRoles and Wait-ClaudeTeamPid
- failure scenario: role windows are closed, the PID files stay behind, and Windows later reuses one of those PIDs for an unrelated powershell.exe or pwsh.exe (common on a dev box). The next `claudeteamup` reports "Role X already running (PID n)" and never reopens that role. No start-time or command-line check is done.
- evidence: the check is only `ProcessName -in pwsh/powershell`.
- suggested fix: store the process StartTime next to the PID (or check the command line for the role's EncodedCommand) and compare it.


### IS-030 — The catalog `permission_mode` is shown in the launcher logs but never applied `[in-flight, last read 02:51]`
- severity: low · category: contract · confidence: confirmed
- location: scripts/shells/linux/common/claude_team_common.sh:261,293,513 and ClaudeTeamCommon.ps1:168 (read and logged) vs scripts/linuxenvs/claudeteam.sh:75 and scripts/winenvs/claudeteam.ps1:70 (hardcoded `--permission-mode auto`)
- failure scenario: changing `config/claude_team_roles.json` `permission_mode` (catalog v4, still `auto`), e.g. to `default`, makes both launchers log "permission mode default" while every role still starts in `auto`. ROLES_V2 B8 fixes the mode at `auto`, so the hardcoded value is the intended one; the defect is that the catalog key and the logs look configurable when they are not.
- evidence: claudeteam.sh/ps1 never read the catalog.
- suggested fix: drop `permission_mode` from the catalog and the log lines (per V2 B8), or pass it through if it is meant to be configurable.

## Cross-scope

Owners use the V2 role ids.
- CS-1 (owner: orchestrator, or whoever holds `.claude/hooks/` under ROLES_V2; outside the S4 audit paths) `.claude/hooks/git_guard.mjs` `[in-flight, last read 02:54]`. The hook was rewritten at 02:52 into a token parser with a read-only allow-list. I probed the 02:52 functions on sample strings in the scratchpad; the results:
  - Fixed: a heredoc body that mentions "git push" no longer blocks. The old regex version blocked two read-only commands in this audit.
  - Still a false positive: `SEGMENT_SPLIT` (:11) splits on `|` even inside quotes, so `grep -n "a\|git add\|b" file` yields a segment `git add\` and is blocked (probe: needsGrant=true).
  - New, confirmed: GRANT_PATTERN (:9) grants all git/gh for 120 min on any prompt that contains the standalone word `git`/`gh`, including negative ones. The probe granted on "do not use git in this task", "git is hook-blocked; do not work around it" and "report the bug in the git guard". The grant lands in the shared `.claude/agents_shared/git_grant.json`, so it opens git for every role session. That contradicts AGENTS.md ("No git operations unless explicitly asked") and the MULTI_ROLE_TEAM rule that only an `allow-git` user prompt grants. If a teammate's incoming message is surfaced to the hook as UserPromptSubmit, another agent's text would grant git too (suspect, not verified).
  - Naming lag: GUARD_ENV is `CLAUDE_AGENTS_SESSION`, matching claudeteam.sh:54 / claudeteam.ps1:62 / claude_team_common.sh:41. REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM.md:167/195 and the comment at claudeteam.sh:29 still say `CLAUDE_AGENTS_GIT_GUARD=1`.
- CS-2 (owner: pycore) IS-004 moves and relinks every `%USERPROFILE%\.<dot-folder>` (including `.claude`, `.cursor`, `.codex`) on each dd.ps1 start. Any pycore code that caches those absolute paths should expect the junction to be re-pointed at startup.
- CS-3 (owner: laravel) IS-001/IS-012: every `175_laravel_main_start.sh` run executes step 75. A path drift therefore restarts PostgreSQL under a running Laravel/Octane worker, and in the IS-001 case replaces the database with an empty cluster that `sys:init` re-seeds from init_data only.
- CS-4 (owner: mcp-chrome) `apps/mcp-chrome/scripts/start.ps1:469` depends on `Register-UserLogonTask` (StartupManager.ps1). No defect was found there, but any change to that helper has this caller.

## In-flight observations

None of these are reported as bugs; each was consistent (or gone) at the 02:51-02:52 re-read.
- Git-guard variable rename. At my first read (~02:05) claudeteam.sh/.ps1 and claude_team_common.sh exported `CLAUDE_AGENTS_GIT_GUARD=1`. By 02:45 they, and the hook's GUARD_ENV, all use `CLAUDE_AGENTS_SESSION`. Code and hook agree now; only the doc and one comment lag (CS-1).
- git_guard.mjs was rewritten again at 02:52, one minute after my re-read. CS-1 reflects the 02:52 version, re-read and probed at 02:54. The regex-era heredoc false positive is gone; the other points in CS-1 persist.
- Agent roles V2 rollout (catalog v4, 02:48). Lead role `orchestrator`, 13 roles, grid 5×3, team session `ca-orchestrator`. The kickoff placeholders changed from `{requirements}`/`{board}` to `{guide}`/`{record}`. At re-read the catalog placeholder set matches the substitutions in claude_team_common.sh:462-469 and ClaudeTeamCommon.ps1:287-294, `guide_doc`/`record_dir` are parsed on both sides, and no reference to the removed `requirements_doc`/`task_board` keys remains. All 13 `.claude/agents/*.md` files named in the catalog exist.
- Syntax re-check at 02:51 of all 41 in-scope files modified after 02:10 (dd.sh, dd_helper/*, claude team launchers and commons, claude_code_install.sh, ClaudeTeamInstallCommon.ps1, NssmServiceManager.ps1, ApplicationsList.ps1, kimi/codex/agy launchers, redis_endpoint_common.sh, kimi_launcher_section.py, the catalog JSON, git_guard.mjs, team_gate.mjs): `bash -n`, the pwsh parser, `ast.parse`, `json.load` and `node --check` are all clean. No transient mid-edit breakage was observed.
- The redis/Laravel diff-delivery shell (redis_endpoint_common.sh, 02:23) is still moving. I have no finding in it and did not audit it beyond syntax.

## Coverage

Timing note: user sessions were editing the scope while the audit ran. All 41 files modified after 02:10 were re-read and re-verified at 02:51-02:52. Findings in those files carry `[in-flight, last read HH:MM]` (IS-008, 010, 017, 019, 022, 026, 029, 030); every one still held. All other findings sit in files with no edit after 02:10.

Whole-scope mechanical checks (every file, excluding the vendored trees below):
- `bash -n` on 547 .sh. Errors: claude6.sh, claude9.sh, node-upgrade-manager.sh, dev/caddy/start_scanner.sh, docker_compose/nvm/run_script.sh.
- PowerShell parser on 295 .ps1/.psm1. Errors: Step93, Step94, Step96. A cp1252 re-parse of the 41 BOM-less non-ASCII files is in IS-006.
- `ast.parse` on 296 .py (0 errors) plus an AST undefined-name scan (3 hits: IS-011/IS-023/IS-024).
- `node --check` on 241 .js. Real failures: caddy_scanner.js. Expected failures: ES-module workers, the `{{SECRETS_DATA}}` template, the 7z blob.
- CRLF in .sh: none. Non-ASCII in .sh: 4 files (comments/log text).
- A cross-file PowerShell scan of Verb-Noun commands with no definition (IS-025).
- Pattern sweeps across all own .sh/.ps1: `rm -rf` on variables, /etc/* and rc-file appends, eval, destructive apt/kill/pg ops, string-built PS paths (IS-022), `$null` comparisons, and obsolete Debian 13 / Ubuntu 26.04 package names (hits were in dead code: shared_python_setup.sh python3-distutils is sourced but never called).

Fully read (logic traced):
- Launchers and provisioning: claudeteamup/claudeagents/claudeteam (.sh and .ps1), claude_team_common.sh, ClaudeTeamCommon.ps1, ClaudeTeamInstallCommon.ps1, ai_cli_provision_common.sh, AiCliProvisionCommon.ps1, ai_shtools/claude_code_install.sh, claude1.sh (generated template), 14_install_python310.sh, isolated_python_install_common.sh, Step13_InstallPython310_312.ps1, IsolatedPythonInstallCommon.ps1.
- dd.sh startup chain: dd.sh, dd.cmd, dd_helper/{constants,system_functions,file_processing,cache_functions,smart_permissions,linuxenvs_sync}.sh, common/{prompt_common,fs_perm_helpers,systemd_service_manager,pycore_service,tts_docker_compose_common}.sh.
- Services and installers: services/resource_watchdog.sh, 119_install_launcher.sh, Step93/94/96/175 .ps1, NssmServiceManager.ps1, StartupManager.ps1, 175_laravel_main_start.sh (all non-comment lines).

Partially read (relevant sections): gvar_common.sh, gvar_system_common.sh, mount_common.sh, ssh_server_common.sh (drop-in, tmux hook, reaper, journal), 9_fix_dns.sh (main + resolv), 75_install_postgresql.sh (configure/main/drift), frankenphp_runtime_common.sh, laravel_main_runtime_common.sh (port/kill/prompt helpers), nginx_common.sh / nginx_manager.sh (reload verification, QUIC upgrade, conflicts), 3_setting_base.sh, 17_install_node_toolchain_26.sh, dev_cache_cleanup.sh, secret_functions.sh, 27_install_git_ssh.sh, gitput_unified.sh (1-230), gitput_security_common.sh (1-527), PathMappingLib.ps1 (junction/move/mapping list), dd.ps1 (1-260, 1095-1217), GlobalVars.ps1 (Python/path constants), CommonFunc.ps1 (timed prompt, service helpers), script_manager.py (launcher templates), generators/__init__.py.

Syntax and pattern checks only (not read line by line): the rest of the 298 focus files, including PackageManagerInvokes.ps1 (4031 lines), ApplicationsList.ps1, most of CommonFunc.ps1, TtsInstallAssetsCommon.ps1, FrankenPhpManager.ps1, WinScriptsInstaller.ps1, the ark/kimi/pi/codex launchers, the TTS/AI install_shells (105-183), 155/157/161/165/167/169 desktop installers, domain_setup_common.sh, octane_service_manager.sh, codesync_service.sh, pyservice_entry.sh, linux_management.sh, unified_manager/*, the scripts/git/*.py and pytools/* Python (36k lines), learning-tools, deployment/fixes .py.

Not read beyond syntax: scripts/tampermonkey (12k JS), scripts/dev, scripts/build_scripts, scripts/chromefix, scripts/video_*, scripts/file_sync_v2, scripts/testing, scripts/app_manager (except where grep hits are cited).

Excluded as vendored/third-party (parsed only, no findings filed): scripts/shells/docker_compose/** (366 files: nvm_node, clash_scrible/node_spider, aapanel, baota, bt9debian12, SubConv, certbot/letsencrypt, docker-node), scripts/shells/linux/common/linux-router/lnxrouter.sh (upstream linux-router), scripts/easy-gpy-pv/** (upstream Easy-GPU-PV), any node_modules, scripts/shells/win/win_common/CommonFunc.7z.gz.js (binary archive).

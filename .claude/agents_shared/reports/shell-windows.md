# shell-windows report

| Task | Scope | Status |
|---|---|---|
| shell-windows-2 | D12a desktop icon organizer: scan, upgrade, real run, idempotency, undo | review round 1 fixed (2 blocking + 3 non-blocking in scope), awaiting reviewer |
| shell-windows-3 | D12b Windows side: WSL2 + Debian 13 ensure, Docker model runner delegation, Step55/56 wiring | done, awaiting reviewer; model runs wait for shell-linux's runner |
| shell-windows-9 | Windows FrankenPHP bugs found bringing up local Laravel (merged route braces, no PHP extensions, no skip_install_trust, LAN ACME retries) | done, awaiting reviewer |
| p2-windows | Dual-boot P2: adjudicated 15 review findings on `SharedCacheEnv.ps1`'s Windows 3-drive layout constants (7 fixed, rest rejected/deferred with reasons) | done, awaiting reviewer |
| shell-windows-G1 | D13 group task: fixed the 6 reviews/shell-windows-1.json blockers (idle-shell liveness, session_env.lead clear, standalone `--agent` role spec, `--name` session filter, max-area/column-fill grid, duplicate constants) and D22 schema-7 `window:false` service-role support | done, awaiting reviewer |

## shell-windows-2: D12a desktop icon organizer

### Review round 1: fixes (reviews/shell-windows-2.json)

Blocking:

1. `Undo-DesktopIconOrganization` now sets `UndoneAt` and rewrites the manifest only when `$undoResults.Errors.Count -eq 0`. Otherwise it prints each failure and "The run stays open for undo; run Undo again (elevated for the Public desktop) to retry the failed entries: <manifest>". The default undo then picks the same run again, and the explicit `-DesktopIconUndoManifest` path no longer stops at "Already undone". Entries already restored replay as no-ops.
2. `Get-DesktopShortcutClassification`: `$baseDirectoryPrefix = Join-Path $Global:DESKTOP_BACKUP_DIR ''`. It returns `D:\.dev_win10\.desktopIcons\` on PS 5.1.19041, whether or not the input already ends in `\`. The string append is gone.

Non-blocking items in this task's scope:

3. Same-destination idempotency:
   - The new `Resolve-DesktopPlanCollisions`, called at the end of `Get-DesktopOrganizationPlan`, keeps at most one differing item per `<Category>\<name>`. The newest by mtime wins, and ties go to scan order (user desktop, Public desktop, category folders). Identical items follow the winner; every other item goes to `plan.Conflicts` and stays in place.
   - The new `Get-DesktopPlacementDecision` returns place, unchanged, duplicate, replace or conflict. A different filed shortcut is displaced only by a strictly newer one; otherwise the item is a conflict. In move mode an identical desktop duplicate goes to `state\displaced\<runId>` (recorded as displace and undoable) instead of displacing the filed copy.
   - `Move-ShortcutsToCategory` and Preview share this function. Preview no longer lists copies and refiles that the real run skips, and it prints "Nothing to move" when the run would change nothing.
4. `IconExtractor.ps1:114`: `Get-Item -LiteralPath $targetPath`.
5. Parity ledger:
   - the Chrome/Edge keep-copy rule moved from SPW-004 (platform-only) into SPW-001;
   - SPW-001 now records the collision and newer-only rules and the shared preview decision;
   - SPW-002 now records the "UndoneAt only on success, a rerun retries" rule;
   - the SPW-001 request below tells shell-linux to reuse `_dsm_login_users` and `_dsm_desktop_dir`.

Left for other owners or tasks (outside this task's write scope):

- The `%LOCALAPPDATA%\core_node` base is declared in 3 places (`DesktopIconManager.ps1:70`, `ClaudeTeamInstallCommon.ps1:32`, `PostgresqlManager.ps1:66`) and belongs in GlobalVars.
- `CommonFunc.ps1:2588-2594` duplicates `Set-DesktopCategoryLink` without its `.lnk` fallback, and `Create-DesktopShortcutsForPackage` still deletes same-name shortcuts.
- Next owner for both: a follow-up shell-windows task, if the orchestrator creates it.

Round 1 checks:

- PS 5.1 `Parser::ParseFile`: 0 errors on DesktopIconManager.ps1, IconExtractor.ps1, WindowsManagementManager.ps1 and Step21_InstallApplications.ps1. Both changed files are still ASCII with LF endings.
- Sandbox under scratchpad (base, state and desktop paths overridden, so the real desktop was not touched):
  - setup: user and Public `Chrome.lnk` with different content (user newer); identical `Notepad++.lnk` on both desktops; different `7-Zip.lnk` on both (Public newer); `Postman [x].lnk`;
  - Preview 1 matched Run 1: Postman moved; Notepad++ moved, with the Public duplicate displaced; the Public 7-Zip moved; the user Chrome copied; the user 7-Zip and Public Chrome were kept as conflicts;
  - Preview 2, Run 2 and Run 3: "Nothing to move", 0 records, still 1 manifest;
  - Undo with a locked `APITools\Postman [x].lnk`: 10 restored, 1 error, and `UndoneAt` stayed empty. The retry restored the remaining 3 with 0 errors and set `UndoneAt`. A third undo printed "No organizer run to undo". The final tree was the original 7 shortcuts; undone links and the copy were in `state\undone\<runId>`.
- Real machine, rerun after the fixes (elevated session): Preview, then Organize twice (the second run captured in full, child exit 0). Each printed only `kept (same name already in APITools, identical=False): ...\DevelopmentTools\Insomnia.lnk`, "Nothing to move; the desktop is already organized." and the pinned `Window Launcher.lnk`.
  - There is still exactly 1 manifest (`organize_20260927_153631_584.json`) and no `displaced\` dir.
  - The category folders hold 78 `.lnk` files, and both desktops are unchanged.
- Git: HEAD `f4f223414 CodeHeaderCleanerBak` (DevOps User, 15:57:10, 1191 files) already contains these code edits. I did not make that commit; I ran read-only git only. The ledger and report edits made after it show as working-tree changes.

### Where it lives

- Code: `scripts/shells/win/win_common/DesktopIconManager.ps1` (`Invoke-DesktopIconOrganization` and helpers). Category data is `$Global:DESKTOP_ORGANIZATION_CATEGORIES` in the same file. Package categories come from `ApplicationsList.ps1` (`DesktopCategory`, read only; this task did not change its data).
- Before: the only caller was the end of `Step21_InstallApplications.ps1`, with no menu item, no undo and output visible only in debug mode.
- Now:
  - menu: dd.ps1 > Management & Backup > Windows Management > "Organize Desktop Icons" [organize / preview / undo] (Left/Right picks the mode);
  - direct run: `DesktopIconManager.ps1 -DesktopIconAction Organize|Preview|Undo [-DesktopIconUndoManifest <path>]`.

### Machine scan before the run (read only)

- The user desktop is `C:\Users\mpc\Desktop` (not redirected; User Shell Folders points there). The session is elevated and Developer Mode is on, so symlinks work.
- User desktop:
  - 14 category links (directory symlinks named `<Category>.lnk` → `D:\.dev_win10\.desktopIcons\<Category>`): AICLITools, APITools, Browsers, CompressionTools, DatabaseTools, DesignTools, DevelopmentTools, DevScripts, MediaTools, NetworkTools, OfficeTools, SocialMedia, SystemTools, TextEditors;
  - `Claude.lnk` → `D:\applications\Chrome\Chrome\Application\chrome_proxy.exe --app-id=...`, a Chrome PWA. Unmatched: no AI keyword "Claude", and the old matcher had no category for it;
  - `Window Launcher.lnk` → `D:\.dev_win10\python313\python.exe -m pycore.pyutils.launcher`. dd.ps1 recreates it on every start (`pycore/pyutils/launcher/shortcut_check.ps1`), so it must stay.
- Public desktop:
  - `Chrome.lnk` and `ChromeBeta.lnk`: already in Browsers (equivalent copies); the Chrome/Edge rule keeps them on the desktop;
  - `NetBird.lnk` → `C:\Program Files\Netbird\netbird-ui.exe`: unmatched;
  - `鲜牛加速器.lnk` → `D:\applications\xianniu\XianNiuLauncher.exe`: unmatched (no generic "加速器" keyword).
- OneDrive desktop `C:\Users\mpc\OneDrive\Desktop` is not the active desktop. It holds 10 `Image_*.jpg` and `卖车合同.docx`: user files, no shortcuts. It was not touched and is not scanned by the organizer.
- `.appref-ms`: none.
- Category folders: 14 (DevScripts included) holding 75 `.lnk` files. Findings:
  - `DevelopmentTools\Google Chrome.lnk` was misfiled because the old substring matcher matched "Go" inside "Google";
  - `TextEditors\WPS Office.lnk`: office suites were listed under TextEditors;
  - `DevelopmentTools\Insomnia.lnk` duplicates `APITools\Insomnia.lnk` (the two files differ);
  - broken targets, left alone: `DevelopmentTools\Google Chrome Beta.lnk` (`C:\Program Files\Google\Chrome Beta\...` is missing) and `SystemTools\360驱动大师.lnk` (`D:\applications\360DrvMgr\DrvMgr.exe` is missing);
  - `DevelopmentTools\DevScripts.lnk` is a directory symlink inside a category. It is not a shortcut file and was left alone;
  - `.desktopIcons\Chrome.lnk` and `.desktopIcons\ChromeBeta.lnk` sit at the root (Create-DesktopShortcutsForPackage with no category). Left alone.

### Defects fixed

1. Matching was substring plus first match by category order. "Go" filed Google Chrome as a dev tool, and "Rust" could catch RustDesk. It now matches token runs (camelCase and digit splits, so VSCodiumInsiders and HTTPie tokenize the same on both sides). Keywords of 3 chars or fewer must start the name. CJK keywords match as substrings. The highest score wins, and ties go to the ApplicationsList package, then to category order.
2. ApplicationsList `DesktopCategory` was ignored, so the organizer and the installer filed the same app differently (Insomnia sat in both DevelopmentTools and APITools). Package key, Name, DesktopShortcuts Name and Exec now rank first. APITools and DesignTools are organizer categories now.
3. Only `.lnk` was handled. `.url` (plus `steam://`, `com.epicgames.launcher://`, `uplay://`, `origin://`, `battlenet://` → Games) and `.appref-ms` are handled now.
4. MSI-advertised and shell shortcuts (empty TargetPath) were skipped as invalid. They are movable now; only shortcuts with a missing target stay, and they are reported.
5. A category with no `.lnk` inside ran `Remove-Item -Recurse -Force` on its folder and desktop link, which could delete `.url`, `.cmd` and `.ps1` files. That removal is gone.
6. A same-name shortcut already in a category was deleted before the move. Now it is displaced into the state dir and recorded, but only when the incoming shortcut is newer (round 1). An identical desktop duplicate is displaced instead. Equivalent Chrome/Edge copies are skipped; they used to be recopied on every run.
7. The category-link skip used `-like "*<Category>*"`, which skipped real shortcuts such as "Games Launcher". It is now an exact category-name match, or a target inside `.desktopIcons`.
8. If the symlink failed (no admin or Developer Mode), shortcuts were moved with no desktop link. A `.lnk` shortcut is now the fallback.
9. Output went only through the debug channel. Moves, unmatched, broken, pinned items and the manifest path are printed now.
10. Icon extraction had its own inline extractor and recursed through symlinked folders. It now reuses `IconExtractor.ps1` `Extract-IconFromFile`, one folder level only. IconExtractor loads quietly and checks extensions without case sensitivity, with -LiteralPath.
11. Strict-mode safety: GlobalVars sets `Set-StrictMode -Version Latest`, so the new code uses hashtable indexers and `@()` counts.

### Keywords added

- NetworkAccelerators: 鲜牛, XianNiu, 加速器, Watt Toolkit, Clash for Windows/Verge/Nyanpasu/Meta, Mihomo, FlClash, v2rayN, V2Ray, Qv2ray, Nekoray, Hiddify, sing-box, Shadowsocks(R).
- APITools (new): Postman, Insomnia, HTTPie, Swagger, SoapUI, Hoppscotch, Bruno, Apifox, Apipost, Paw, RapidAPI, JMeter.
- DesignTools (new): Figma, Sketch, Canva, Affinity, Inkscape, Draw.io/DrawIO, diagrams.net, Lucidchart, Creately, Excalidraw, XMind, Axure, Balsamiq, Penpot, Pixso, MasterGo, Lunacy, ProcessOn, 即时设计, 墨刀.
- NetworkTools: NetBird, Tailscale, ZeroTier, WireGuard, OpenVPN, EasyTier, Headscale, Radmin VPN, Hamachi, Sunlogin, 向日葵, ToDesk, Parsec, frp, n2n, Termius, Xshell, Xftp, SecureCRT, mRemoteNG, Remote Desktop Manager.
- AICLITools: Claude, ChatGPT, OpenAI, Gemini, Copilot, DeepSeek, Kimi, Qwen, Doubao, Grok, Perplexity, Ollama, LM Studio, Cherry Studio, Codex, Manus, 豆包, 通义千问, 文心一言, 腾讯元宝, 智谱清言.
- Browsers: Google Chrome, Chrome Beta, Chrome Canary, Microsoft Edge, Thorium, Floorp, LibreWolf, Zen Browser.
- Office suites moved from TextEditors to OfficeTools: WPS Office, OpenOffice, FreeOffice, OnlyOffice.
- Office: Access → "Microsoft Access", Project → "Microsoft Project".
- TextEditors: gVim, WordPad.
- Diagram tools moved from DatabaseTools and MediaTools to DesignTools.

### Real run (Organize), then the second run

First run: 5 moves, a new category folder and its desktop link.

| Action | From | To | Reason |
|---|---|---|---|
| mkdir | | `D:\.dev_win10\.desktopIcons\NetworkAccelerators` | new category |
| link | | `C:\Users\mpc\Desktop\NetworkAccelerators.lnk` (symlink) | category link |
| move | `C:\Users\Public\Desktop\鲜牛加速器.lnk` | `...\NetworkAccelerators\鲜牛加速器.lnk` | keyword 加速器 |
| move (refile) | `...\TextEditors\WPS Office.lnk` | `...\OfficeTools\WPS Office.lnk` | package WPSOffice |
| move (refile) | `...\DevelopmentTools\Google Chrome.lnk` | `...\Browsers\Google Chrome.lnk` | keyword Google Chrome |
| move | `C:\Users\Public\Desktop\NetBird.lnk` | `...\NetworkTools\NetBird.lnk` | keyword NetBird |
| move | `C:\Users\mpc\Desktop\Claude.lnk` | `...\AICLITools\Claude.lnk` | keyword Claude |

- Undo manifest: `C:\Users\mpc\AppData\Local\core_node\desktop_icons\manifests\organize_20260927_153631_584.json`.
- Unchanged: Public `Chrome.lnk` and `ChromeBeta.lnk` (equivalent copies already in Browsers; they stay on the desktop).
- Kept: `DevelopmentTools\Insomnia.lnk`, because a different `Insomnia.lnk` already exists in APITools. It is reported on every run and never overwritten.
- Pinned: `Window Launcher.lnk`.
- Unmatched remainder: 0.
- Second run: "Nothing to move; the desktop is already organized." It made no records and wrote no new manifest. The same result came back through the Step21 dot-source path under strict mode.
- Desktop now: user desktop has the 15 category links plus `Window Launcher.lnk`; Public desktop has `Chrome.lnk` and `ChromeBeta.lnk`. The OneDrive desktop is unchanged.

### Checks

- The PowerShell parser passes on all 4 changed files.
- Preview run: its plan matched the real run.
- Undo sandbox under scratchpad, with the base and state dirs overridden: it covered mkdir, symlink, move of a name with `[ ]`, displace, and copy. Undo restored 6/6, including the displaced original. A second undo reports "Already undone". Undo was not run on the real desktop, so this machine keeps the organization the user asked for.
- Icon extraction was run into scratchpad only: 68 PNGs.

### Choices made (no questions asked)

- State dir `%LOCALAPPDATA%\core_node\desktop_icons`, the same base as the claude_team state.
- Broken shortcuts are reported and left in place, not filed.
- OneDrive desktop: only the active desktop is organized (`GetFolderPath('Desktop')` follows Known Folder Move).
- Refile only moves a filed shortcut when nothing supports its current folder, and never onto an existing name.
- Undo removes only an empty folder the run created. Copies and links go to `state\undone\<runId>` instead of being deleted.
- `Window Launcher` is pinned on the desktop.
- ApplicationsList `AdditionalKeywords` are not used for classification: they are binary-detection hints, and some are cross-wired (WinSocat lists "Nmap", iPerf3 lists "NetLimiter").
- The menu entry lives in `WindowsManagementManager.ps1`; the organizer had no menu before.

### Not changed, noted

- `Remove-ObsoleteScripts` uses `ConvertFrom-Json -AsHashtable`, which is PS 7 only; on 5.1 it fails into its catch. It belongs to custom scripts and is out of this task's scope.
- `Remove-OrphanedShortcuts` deletes, but only under `AGGRESSIVE_CLEANUP_ENABLED`, which is off. It was left untouched.
- `CommonFunc.ps1` `Create-DesktopShortcutsForPackage` still deletes a same-name shortcut in a category before it moves the installer's shortcut. That is not the organizer and was out of this task's write scope. Next owner: shell-windows, in a follow-up task if the orchestrator wants it.

### Changed files

- `scripts/shells/win/win_common/DesktopIconManager.ps1` (round 1: `Undo-DesktopIconOrganization`, `Get-DesktopShortcutClassification`, `Get-DesktopShortcutInfo` (LastWriteTimeUtc), `Get-DesktopOrganizationPlan`, new `Resolve-DesktopPlanCollisions`, new `Get-DesktopPlacementDecision`, `Move-ShortcutsToCategory`, `Invoke-DesktopIconOrganization` (preview and conflict output))
- `scripts/shells/win/win_common/IconExtractor.ps1` (round 1: `-LiteralPath` at line 114)
- `scripts/shells/win/menu_itemshells/WindowsManagementManager.ps1` (+25 lines; the earlier Disk Repair diff there is not mine)
- `scripts/shells/win/install_powershells/Step21_InstallApplications.ps1` (+3 lines, undo hint; the earlier Join-Path diff there is not mine)
- `.claude/agents_shared/shell_parity/windows.md` (new)

### Parity

- SPW-001, SPW-002 and SPW-003: `pending-linux`. No align task exists yet. The orchestrator must create `[shell-linux] align: SPW-001/002/003 desktop icon organizer + undo manifest + dd.sh menu entry` (the reviewer requires it for the pending rows).
- SPW-004 and SPW-005: `platform-only`. See the ledger `.claude/agents_shared/shell_parity/windows.md`. SPW-004 no longer contains the Chrome/Edge keep-copy rule; that rule is in SPW-001.

Alignment request for shell-linux (task shell-windows-2):

- SPW-001: add a desktop organizer for each real login user's Desktop dir.
  - Reuse `_dsm_login_users` and `_dsm_desktop_dir` from `scripts/shells/linux/common/desktop_shortcut_manager.sh` for user and Desktop discovery (they parse `user-dirs.dirs` literally, so root does not expand `$HOME` wrongly). Do not add a second discovery path. When run as root, pick the users through `_dsm_for_desktops`-style iteration.
  - What moves: only regular `*.desktop` launcher files. Never other files, folders or symlinks.
  - Keep-copy rule (same as Windows): browser launchers whose Name has a `chrome` or `edge` token (for example Google Chrome, Chrome Beta or Microsoft Edge; Chromium has no `chrome` token, so it is moved) are copied into Browsers and stay on the Desktop. An identical copy already in Browsers means no change.
  - Same destination: plan at most one differing launcher per `<Category>/<file>`. The newest mtime wins; ties go to scan order (then category folders). Launchers identical to the winner follow it; the rest are reported as conflicts and stay put.
  - Existing different file at the destination: displace it into the state dir only when the incoming launcher is strictly newer (mtime); otherwise report a conflict. An identical Desktop duplicate (move mode) goes to the state dir as a `displace` entry.
  - Preview must run the same placement decision as the real run and print "nothing to move" when the run would change nothing.
  - Where: `<base>/<Category>/`, with base `${CORE_NODE_DESKTOP_ICONS_DIR:-$HOME/.local/share/core_node/desktopIcons}`. Put one launcher (or symlink) per category folder on the Desktop.
  - Category names: the same as Windows (NetworkAccelerators, APITools, DevelopmentTools, TextEditors, DesignTools, MediaTools, OfficeTools, SocialMedia, CompressionTools, DatabaseTools, Browsers, Games, SecurityTools, SystemTools, DownloadTools, Education, Finance, Shopping, NetworkTools, AICLITools).
  - Keywords: the same lists. Keep them as one shared data file if you prefer; tell shell-windows so both sides read it.
  - Classify on the launcher `Name=` first, then the `Exec` binary basename (ignore generic hosts: python3, bash, sh, env, java, node, flatpak, snap).
  - Ranking: linux_applications_list.sh entries rank above the keyword lists, as ApplicationsList does on Windows.
  - Matching rules, identical to Windows: token runs with camelCase and digit splits; keywords of 3 chars or fewer must start the name; CJK keywords match as substrings; the highest score wins; ties go to the app list, then to category order.
  - Keep-on-desktop list: `window-launcher.desktop` (Name "Window Launcher").
  - Leave launchers whose Exec target is missing, and report them.
  - Refile a filed launcher only when nothing supports its current folder, and never onto an existing name.
  - Never delete. A replaced same-name launcher moves to the state dir. A second run changes nothing.
  - Targets: Debian 13, Ubuntu 26.04, Kali. Run as the user; when running as root, chown to that user and keep `gio set metadata::trusted` on moved launchers.
- SPW-002: undo manifest with the same JSON shape as Windows: `RunId, CreatedAt, BaseDirectory, UndoneAt, Entries[Action mkdir/link/move/copy/displace, Source, Destination, Category, Reason, Time]`. Store it at `${XDG_STATE_HOME:-$HOME/.local/state}/core_node/desktop_icons/manifests/organize_<runId>.json`. Write one only when something changed. Undo replays the newest run not yet undone, in reverse, and never overwrites. Undone copies and links go to `state/undone/<runId>`. Remove only the empty folders the run created. Set `UndoneAt` only when no entry failed. On failure, print the failures and keep the run open so that a rerun retries them; replayed entries must be no-ops (a move only when the destination exists and the source is free, a copy or link only when present, and rmdir only when empty).
- SPW-003: a dd.sh menu entry, "Organize Desktop Icons", with organize, preview and undo, beside the 154 desktop icon repair. Add a direct CLI (for example `desktop_icon_organizer.sh organize|preview|undo`). Print the undo hint after any install step that runs the organizer.

Blockers: none. Next owner: reviewer (shell-windows-2 review), then shell-linux (SPW-001..003 alignment).

## shell-windows-3: D12b Windows side (WSL2 + Debian 13 ensure, Docker model runner delegation)

- Status: done, awaiting reviewer. The full details are in the workflow result for shell-windows-3.
- Changed files:
  - `scripts/shells/win/win_common/DockerWslBridge.ps1`: `Invoke-DockerModelRunner`, `Initialize-DockerModelWslDistro`, `Get-DockerModelDefinition`, `Set-WslConfKey`; the wrappers `Invoke-TtsDockerEnsure` and `Invoke-TtsDockerApply` now map to runner ensure/up; the Docker Desktop path and the port/asset maps are removed;
  - `scripts/shells/win/install_powershells/Step55_InstallMelotts.ps1` and `Step56_InstallFishspeech.ps1`: the docker branch calls runner ensure, and `-Test` or `DOCKER_MODEL_TEST=1` calls test; `exit 1` is gone; the recommendation quotes are current; Step56 on Windows defaults to docker;
  - `scripts/shells/win/install_powershells/Step29_InstallWSL.ps1`: `/etc/wsl.conf` `[user] default=root` is merged, not overwritten; only changed distros are terminated;
  - `scripts/shells/win/install_powershells/Step30_InstallWSLDebian13.ps1`: `-DistroName` and `-InstallDir` for the side-by-side import; non-interactive defaults;
  - `.claude/agents_shared/shell_parity/windows.md`: SPW-006..017.
- Runs:
  - The WSL2 + Debian 13 ensure ran twice.
    - `Debian` has `VERSION_ID=13`, PID 1 is systemd, and wsl.conf has `[boot] systemd=true`, which the merge left unchanged.
    - The second run had no Step30 dispatch and no writes.
    - Afterwards the distro was terminated. The default is unchanged, nothing was unregistered, and `.wslconfig` was not touched.
  - No model was started.
  - Docker Engine is not in Debian yet; installing it is runner ensure (shell-linux).
- Parity:
  - pending-linux: SPW-006, 007, 008, 009 (runner part), 011, 012, 013, 014;
  - platform-only: SPW-009 (WSL terminate), 010, 015, 016, 017;
  - alignment task needed: `[shell-linux] align: SPW-006..014 docker_model_runner contract`.
- Blockers: the model runs (MeloTTS, then Fish Speech) wait for `docker_model_runner.sh` and `docker_compose/tts/<model>/model.sh`, from shell-linux.
- Follow-ups for shell-windows:
  - Step52 and Step54 still `exit 1` in their docker branch;
  - the saved `TTS_FISHSPEECH_INSTALL_METHOD=native` keeps Step56 on native until `TTS_METHOD=docker` or `TTS_METHOD_RESELECT=1`.
- Next owner: reviewer (shell-windows-3), then shell-linux (alignment), then the one-at-a-time model-run task.

## shell-windows-9: Windows FrankenPHP generator bugs (from the D7 local Laravel bring-up)

Source: `.claude/agents_shared/d7/laravel_local.md` blockers/`for shell-windows` section. All four defects fixed in `scripts/shells/win/win_common/FrankenPhpManager.ps1`. The live D7 instance and its config (`D:\www\frankenphp\**`, `D:\www\core_node\global_var\web_access_config.json`, `poly_apps/laravel_main/storage/frankenphp/**`) were never touched: verification ran the generator functions against script-scope path variables redirected to a scratch directory (dot-source the manager, then reassign `$script:FrankenPhp*` output paths before calling the `Ensure-*` functions), confirmed by comparing file mtimes before/after (all predate this session).

### (a) Merged route-file closing brace (`Step175` invalid config)

`Ensure-FrankenPhpLanLocalRoute` and `Ensure-FrankenPhpDomainRoutes` built each site block as `` "...{\n$tlsLine$apiHandlers}\n..." ``: `$apiHandlers`/`$uiHandlers` (from `Get-FrankenPhpReverseProxyHandlers`) already end in `\t}` with no trailing newline, so the literal `}` appended right after collapsed the two closing braces onto one line (`\t}}`), which `frankenphp validate` rejects with "unexpected EOF". Fixed by moving the trailing `}` onto its own line in all four site templates (LAN ts.net site, LAN mkcert site, per-domain API site, per-domain UI site).

Verified two ways in a scratch dir:
- Negative control: reproduced the exact pre-fix template (`\t}\n}` collapsed to `\t}}`) for a real generated `12gm.com.caddy` and ran `frankenphp validate` against it - it failed with `Error: adapting config using caddyfile: unexpected EOF, at ...\routes_broken\local_lan.caddy:27`, matching the D7 evidence.
- Positive: with the fixed generators, `frankenphp validate --config <scratch Caddyfile> --adapter caddyfile` returned exit 0 / "Valid configuration" for both the LAN-local route (real Tailscale ts.net + mkcert 127.0.0.1 certificate material already on this machine, read-only) and a per-domain route with a real tls line (see (d) below for how that path was exercised).

### (b) Embedded PHP loads no extensions (Step96 / `Ensure-FrankenPhpPhpConfiguration`)

The Windows FrankenPHP release is a bare static-PHP zip with no `php.ini` and no packaged extension enablement (unlike Linux, which installs `php-zts-*` apt packages that enable their own extensions - see Parity). `Ensure-FrankenPhpPhpConfiguration` now writes, from one list (`$script:FrankenPhpRequiredExtensions` at the file top): `extension_dir = "<payload>\bin\ext"` plus one `extension=<name>` line per name in `pdo_pgsql pgsql mbstring openssl intl gd zip bcmath curl fileinfo sodium` that actually has a `php_<name>.dll` in the payload (`extension_dir` and the whole list are omitted while the payload is not installed yet). `bcmath` has no DLL in this FrankenPHP build - it is compiled into core - so the presence filter skips it automatically with no special-casing; `php -m` already lists it without any ini entry. This reuses the exact extension set the D7 hand-written `D:\www\frankenphp\php-conf.d\50-d7-local-extensions.ini` (made by hand, not by this generator) had already proven necessary, minus the dev-only extras that ini also carried (bz2, exif, mysqli, pdo_mysql, pdo_sqlite, sqlite3) that Laravel does not need.

Verified in a scratch conf.d dir: `Ensure-FrankenPhpPhpConfiguration` is idempotent (identical content, unchanged, on a second run); `php.exe -m` with `PHP_INI_SCAN_DIR` pointed at the generated file loads exactly `pdo_pgsql pgsql mbstring openssl intl gd zip curl fileinfo sodium` (plus the always-present `bcmath`) with 0 warnings.

### (c) Caddyfile missing `skip_install_trust`

Added `skip_install_trust` to `Ensure-FrankenPhpCaddyfile`'s global options block, so Caddy never attempts to install its own CA into the OS trust store. Confirmed present in the generated scratch Caddyfile and that `frankenphp validate` still passes with it.

### (d) LAN host: production domain routes with no tls line kept retrying ACME

Recommended option taken (recorded here per the no-questions rule): **emit the per-domain route files only when this host is the production host**, not "give them `tls internal`" - the LAN-local route (`Ensure-FrankenPhpLanLocalRoute`, mkcert 127.0.0.1 / Tailscale ts.net) already is this host's local HTTPS entry point, so a second, internal-CA-backed way to reach the same backend under the public domain names would be redundant complexity with no real benefit (nobody browses 12gm.com from a LAN box that isn't the production host). `Ensure-FrankenPhpDomainRoutes` now skips its per-domain generation loop when `Test-FrankenPhpLanOnlyHost` (the existing host/role detection, already used by `Step175_LaravelMainStart.ps1` for the same LAN/production split) returns true; `Get-FrankenPhpExpectedRoutePaths` was updated the same way so `Remove-FrankenPhpStaleDomainRoutes` / `Test-FrankenPhpDomainRoutesReady` clean up any leftover per-domain files if a host stops being production. `Step175_LaravelMainStart.ps1` itself (the LE_PROD ACME ordering) is explicitly out of scope for this task and untouched.

Verified in a scratch dir: pass 1 (real detection on this LAN dev machine) generated zero per-domain files (only `local_lan.caddy`) and the Caddyfile still validated; pass 2 (`Test-FrankenPhpLanOnlyHost` monkey-patched in-process to return `$false`, to exercise the code path without a real production host) generated `12gm.com.caddy` / `gm15.com.caddy` with a real tls line (pointed at a copy of the local mkcert cert, only to make `frankenphp validate` load a real cert/key pair) and validated too.

### Changed files

- `scripts/shells/win/win_common/FrankenPhpManager.ps1`: `$script:FrankenPhpExtensionDirectory`, `$script:FrankenPhpRequiredExtensions` (new top-of-file vars); `Ensure-FrankenPhpPhpConfiguration`; `Ensure-FrankenPhpLanLocalRoute`; `Get-FrankenPhpExpectedRoutePaths`; `Ensure-FrankenPhpDomainRoutes`; `Ensure-FrankenPhpCaddyfile`.
- `.claude/agents_shared/shell_parity/windows.md`: SPW-031..034.

### Verification

- PowerShell 5.1 parser (`[System.Management.Automation.Language.Parser]::ParseFile`) on the whole file: 0 errors.
- `D:\www\frankenphp\bin\frankenphp.exe validate --config <scratch Caddyfile> --adapter caddyfile`: exit 0 / "Valid configuration", for the LAN-only pass, the forced-production pass, and (as a negative control) confirmed exit 1 / "unexpected EOF" for the pre-fix template.
- `php.exe -m` against the generated scratch conf.d ini: exact expected extension list, 0 warnings.
- Live D7 instance and its config untouched (mtimes all predate this session; every generator ran against scratch-redirected `$script:FrankenPhp*` path variables, never the real ones).
- No git writes.

### Parity

- SPW-031 (brace fix): `platform-only` - the bug was purely in the Windows here-string template; `frankenphp_domain_common.sh::fm_domain_render_route` and `fm_domain_lan_site_render` already put the closing brace on its own line.
- SPW-032 (PHP extensions ini): `platform-only` - Linux enables its extensions through `php-zts-*` apt packages (`frankenphp_install_modes.sh` `FRANKENPHP_APT_PACKAGES`); mbstring/curl/openssl/fileinfo/sodium are compiled into that static build already.
- SPW-033 (`skip_install_trust`): `pending-linux`. **Alignment request for shell-linux** (no live `shell-linux` teammate/session was reachable from this run - `ListAgents` showed none - so recording it here for the orchestrator to open `[shell-linux] align: SPW-033 skip_install_trust`): add `skip_install_trust` to the global options block in `scripts/shells/linux/common/frankenphp_runtime_common.sh::fm_caddyfile_render` (around line 713-718, the `{ admin ... auto_https disable_redirects ... }` block), same as Windows.
- SPW-034 (LAN ACME gating): `pending-linux`. **Alignment request for shell-linux** (same reachability note as above; `[shell-linux] align: SPW-034 LAN-only hosts skip production domain routes`): `scripts/shells/linux/common/frankenphp_domain_common.sh::fm_domain_render_route` / `fm_domain_enable_ui_binding` generate the same no-tls-line per-domain route files unconditionally (called from `scripts/shells/linux/debian/debian_com/175_laravel_main_start_frankenphp.sh:67` with no host-role check), so a Linux LAN/dev box hits the identical failing-ACME retry storm. Recommended fix: reuse `net_env_detect`'s `NET_ENV_IS_LAN` (`scripts/shells/linux/common/network_detect_common.sh`) to skip `fm_domain_ensure_route_file` per domain (and clean up stale per-domain files) exactly the way `Ensure-FrankenPhpDomainRoutes` now does, keeping the same "production host only" choice for parity rather than `tls internal`.

### Blockers

None for this task. SPW-033/034 need a `[shell-linux] align: ...]` task from the orchestrator (see Parity above) before they can move from `pending-linux` to `aligned`.

### Next owner

Reviewer (shell-windows-9), then shell-linux for the SPW-033/034 alignment tasks.

## p2-windows: dual-boot drive layout P2, review-findings fix pass

Task: adjudicate 15 review findings against the already-implemented Windows 3-drive layout constants in `scripts/shells/win/win_common/SharedCacheEnv.ps1` (the only fenced file for this lane; `GlobalVars.ps1` is owned by another lane), fix confirmed ones, reject the rest with reasons, run the allowed static checks.

### Findings disposition

1. **Get-Partition needs elevation** (line 96, high) -- CONFIRMED (documented Storage-module behavior: `Get-Partition`/`Get-Disk` require an elevated token, `Get-Volume` does not; matches the finding's own probe evidence). **Fixed**: `Test-CnProgramDriveQualifies` now treats an empty GUID as "cannot verify" rather than "disqualified" whenever the on-disk marker already exists, so admin and non-admin processes agree on the program root once E: has been adopted. A bare drive with no marker still needs a real (elevated) GUID to be treated as adoptable.
2. **ServiceContract.ps1 scope leak clobbers SecretManager.ps1's own `$serviceContractPath`** (line 16, medium) -- CONFIRMED, reproduced with a probe. **Fixed**: the dot-source moved into a `New-Module -ScriptBlock { . $ContractScriptPath }` wrapper, imported with `Import-Module -Global`, so `ServiceContract.ps1`'s internal `$script:ServiceContractPath` stays inside the module's own scope and only its functions reach the caller.
3 + 7. **Off-drive recorded GUID / marker-only check is weak** (line 144, medium+high, submitted twice) -- **partially rejected, partially fixed**. Rejected the redesign to require a GUID recorded off the drive (e.g. in global vars): it contradicts the explicit original task instructions ("if E: qualifies and the marker is missing this is first adoption", "never write anything at load time on E:"), and `GLOBAL_VAR_DIR` is not defined yet at the point this file loads, so doing it properly needs the GlobalVars lane, which is out of this lane's fenced scope. Fixed the contained sub-issues instead: `Get-CnProgramDrivePartitionGuid` now normalizes the GUID (lowercase, no braces, matching the Linux PARTUUID form) at its single source; `Register-CnProgramDriveAdoption` now rewrites the marker only when its content differs (idempotent-at-the-finest-grain).
4 + 8. **Hardcoded `'cache'` / hardcoded `'E:'` / duplicated `.cn_volume'` literal** (line 238, low, submitted twice) -- CONFIRMED (the rules explicitly list `tree_cache_root` as a contract key that must not be re-declared). **Fixed**: `CN_TREE_CACHE_ROOT` now resolves `paths.drive_layout.tree_cache_root` through `Resolve-CnDriveLayoutPath`; the marker filename is now the single `$Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME` constant; the fallback warning interpolates the actual configured primary-drive label instead of a literal `E:`.
5 + 12 + 14. **`$env:SystemDrive` is a new hard load-time dependency** (line 217, low, submitted three times) -- CONFIRMED via probe (`Get-CnDriveRoot -DriveSpec $env:SystemDrive` throws "Cannot bind argument to parameter 'DriveSpec' because it is an empty string" when the variable is empty or unset -- PowerShell rejects an empty string for a `Mandatory` `[string]` parameter, not just `$null`). **Fixed**: falls back to `[System.IO.Path]::GetPathRoot([Environment]::SystemDirectory)` when `$env:SystemDrive` is empty.
6 + 13. **`Get-CnWindowsSystemName` duplicates GlobalVars.ps1's branches; comments carry phase/process notes** (line 23, low, submitted twice) -- comments CONFIRMED as a rule violation (progress/phase notes in code) and fixed by trimming them to a plain technical rationale. The duplicate function itself is kept: the original task explicitly requires it (this file loads before `GlobalVars.ps1` computes its own copy, and `CN_TOOL_ROOT` needs a system name before that happens), and `GlobalVars.ps1` is not in this lane's fenced scope to de-duplicate against. Flagged as a follow-up below.
9. **Exported key names differ from the requirements-doc §3.1 draft names (`CN_WIN_SYSTEM_DRIVE` etc.)** (line 217, low) -- REJECTED. `docs_fix/` is explicitly non-binding background per this session's instructions ("derive the correct latest state from the current code and the newest related record ... never treat them as binding"); the actual task instructions given to this lane (authoritative and newer than that draft) name `WINDOWS_SYSTEM_DRIVE_ROOT`/`WINDOWS_DATA_DRIVE_ROOT`/`WINDOWS_PROGRAM_DRIVE_ROOT`/`WINDOWS_PROGRAM_DRIVE_IS_FALLBACK` explicitly, and the fencing note itself says GlobalVars.ps1 "will read your keys" -- these are those keys. Recorded the real, exported names in the parity ledger (SPW-035) so the GlobalVars lane does not chase the stale draft names.
10. **Fallback warning hardcodes `'E:'` and says "not found" even when E: exists but failed qualification** (line 205, low) -- CONFIRMED, fixed together with #4/#8 (dynamic drive letter, and reworded to "not available" so it no longer overclaims when E: is present but disqualified).
11. **MBR disks: `MSFT_Partition.Guid` is NULL, adoption throws a generic message** (line 97, low) -- CONFIRMED (documented Microsoft behavior: `Guid` is only valid for GPT). Fixed the throw message only, to say a GPT-partitioned NTFS/ReFS volume is required; did not implement MBR PARTUUID synthesis (disk-signature + partition-number, matching Linux's MBR PARTUUID form), which is a separate, larger feature -- flagged as a follow-up.
15. **Per-load `Get-Partition`/Storage-module cost; reviewer could not verify the non-admin case** (line 138, low) -- accepted as plausible and low priority. The elevation fix (#1) removes the worst symptom (admin/non-admin split-brain roots) but not the per-load cost itself. Did not implement the suggested raw-CIM-query optimization (`Get-CimInstance -Namespace root/Microsoft/Windows/Storage -Filter "DriveLetter='E'"`): it adds WMI filter-quoting risk for a low-severity item. Left as a deferred/rejected-for-now optimization.

### Verification

- PowerShell parser (`[System.Management.Automation.Language.Parser]::ParseFile`) on the changed file: 0 errors. No `.sh` files were touched, so no `bash -n`/shellcheck run.
- Read-only/isolated probes in the scratchpad (no installers, package managers, mounts, registry writes or other system-changing commands run):
  - Confirmed the exact `$env:SystemDrive` empty-string failure mode with a throwaway mandatory-param test function and `[System.IO.DriveInfo]::new('')` -- matches finding #5's reported error text exactly.
  - Confirmed that a plain `& { $script:X = ... }` scriptblock still leaks the write into the caller's scope, while `New-Module -ScriptBlock { $script:X = ... }` does not -- this is why the fix for #2 uses `New-Module`, not a plain scriptblock.
  - Loaded the real `ServiceContract.ps1` inside the `New-Module` wrapper: the caller's own `serviceContractPath` variable was untouched afterward, and `Get-ServiceContractValue`/`Get-ServiceContractHost` still worked -- confirms #2's fix in isolation.
  - Dot-sourced the real, unmodified `SecretManager.ps1` end-to-end (it loads `GlobalVars.ps1` -> this file, then separately dot-sources `ServiceContract.ps1` itself at its own line 36): got "[SECRET_MANAGER] Library loaded successfully" with no hang or file-association dialog, and `Get-ServiceContractValue` still worked afterward -- confirms the fix resolves the actual reported failure. Note: `$serviceContractPath` still ends up holding the JSON path *after* SecretManager.ps1's own line 36 runs; that is SecretManager.ps1's own pre-existing, harmless quirk (dot-sourcing `ServiceContract.ps1` always re-sets its internal `$script:ServiceContractPath`), unrelated to this fix and outside this lane's fenced file.
  - Full load of the edited file in an isolated child process (E: is absent on this machine; every `D:\www\cache\*` subdirectory the load-time loop creates already existed, so the run made no filesystem writes): resolved `WINDOWS_PROGRAM_DRIVE_ROOT=D:\` (correct fallback), `CN_TREE_CACHE_ROOT=D:\core_node_trees\cache` (now contract-derived, byte-identical to the old hardcoded value), `CN_TOOL_ROOT=D:\.dev_win10` (matches this machine's real build), and the fallback warning printed "Program drive E: not available; using the original location D:\". Re-dot-sourcing the file a second time in the same process succeeded cleanly (re-run safety preserved).
  - Confirmed no `E:` drive and no `.cn_volume` marker exist anywhere on this machine, so the GUID-normalization change has no pre-existing marker to conflict with.
  - Grepped the repo: none of the touched functions or the two new `$Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME` / `CN_PROGRAM_DRIVE_PRIMARY_LABEL` names are referenced anywhere outside this file yet, so the changes are self-contained.
  - Did not directly reproduce #1's non-elevated `Get-Partition` failure on this machine (this session's shell is already elevated, and `runas /trustlevel:0x20000` would not run non-interactively in this sandbox); relied on the documented Storage-module elevation requirement plus the finding's own probe evidence (internally consistent: `Get-Volume` succeeding while `Get-Partition` fails non-elevated matches the documented split between those cmdlet families).

### Changed file

`scripts/shells/win/win_common/SharedCacheEnv.ps1` -- header comments (1-27), `Get-CnProgramDrivePartitionGuid` (92-118), `Test-CnProgramDriveQualifies` (120-181), `Register-CnProgramDriveAdoption` (183-221), `Write-ProgramDriveFallbackWarning` (230-242), the ServiceContract module-isolation load and contract-value reads (244-268), the `WINDOWS_SYSTEM_DRIVE_ROOT` fallback (270-277), `CN_TREE_CACHE_ROOT` (298), and the `Remove-Variable` cleanup list (452-457).

### Parity

Added `.claude/agents_shared/shell_parity/windows.md` row SPW-035, status `aligned` (Linux P1's own fenced files already read the same `paths.drive_layout` contract keys in parallel; the GUID normalization here is the format a future Linux PARTUUID exclusion rule would need).

### Follow-ups for other lanes / the orchestrator

- GlobalVars lane: once `GlobalVars.ps1` is safe to touch, consume `Get-CnWindowsSystemName` from this file instead of keeping its own copy of the same OS-version branches (findings #6/#13).
- Possible future task: real cross-OS PARTUUID matching -- record the adopted GUID somewhere Linux can read (the global-var store, since `GLOBAL_VAR_DIR` is not yet defined at the point this file loads) so a different disk later assigned the same letter E: cannot silently auto-adopt just because it has no marker; also decide whether MBR program drives need support (disk-signature-based PARTUUID). Needs the GlobalVars lane and/or a contract addition, both outside this lane's fenced file (findings #3/#7/#11).
- Optional low-priority perf follow-up: avoid the Storage module's measured ~0.5-1.3s import cost on every fresh process once E: exists and qualifies, by gating the `Get-Partition` call more tightly on adoption state (finding #15). Not done here.

### Blockers

None. No `pending-linux` rows were left by this pass.

### Next owner

Reviewer, for `p2-windows`.

## shell-windows-G1: D13 blockers (reviews/shell-windows-1.json) + D22 schema-7 `window:false` roles

Diff base: `74e7770`. Files: `scripts/shells/win/win_common/ClaudeTeamCommon.ps1`, `scripts/winenvs/claudeteam.ps1`, `scripts/shells/win/win_common/ClaudeTeamInstallCommon.ps1`.

### Item D13-WIN-BLOCKERS -- status: done

1. **Idle-shell liveness (DESIGN §3.2).** `claudeteam.ps1`'s pane branch now calls the new `Remove-ClaudeTeamPidFile -Session $paneRow.Session` right after `& claude` returns and before the pane `return` (a role pane keeps its `-NoExit` shell open, but the role itself has stopped). `Remove-ClaudeTeamPidFile` (new, `ClaudeTeamCommon.ps1`) deletes `<session>.pid` only when its content still equals `$PID`, so a file already replaced by a newer PID (a rerun reopened the role while this shell was still exiting) is left alone. `Get-ClaudeTeamNamedProcessMap` now returns every process matching `--name`/`-n <session>` (not just the first), each tagged with `ProcessName`/`CreatedAt`; two new selectors read it: `Get-ClaudeTeamNamedClaudeProcess` (first `claude.exe`/`node.exe` match -- the only kind that counts as "already running") and `Get-ClaudeTeamNamedShellProcess` (newest `powershell.exe`/`pwsh.exe` match created at or after a given time -- "still starting"). `Get-ClaudeTeamLivePid` now only accepts a claude/node named match. `Open-ClaudeTeamMissingRoles` now reopens a missing role unless a claude/node match is alive, or a shell match started after `$script:ClaudeTeamLaunchTime` (an older idle shell no longer blocks the reopen).
2. **`session_env.lead` cleared generically.** `Set-ClaudeTeamSessionEnvironment` now loads the catalog before branching, and for a non-lead row clears every key of `Get-ClaudeTeamSessionEnvironment -Kinds @('lead')` (previously only the hardcoded `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` name).
3. **Standalone `--agent <role>` applies the role spec.** New `Get-ClaudeTeamStandaloneRow -Role` (quietly imports the catalog, returns the row only if `Role` is non-blank and an enabled registry role, writes no PID file). `claudeteam.ps1`'s standalone branch now tries this first: an enabled role gets its own `Get-ClaudeTeamRoleEnvironmentKinds` env, `--effort` from the frontmatter (skipped if the caller already passed `--effort`), `--teammate-mode` only when it is the lead, and the user's own `--agent`/`--name` pass through unchanged via `$forwardArgs`. Only a bare invocation, or `--agent` naming an unknown/disabled role, falls back to the original always-a-lead behavior.
4. **`--name` scan session-filtered.** `Get-ClaudeTeamNamedProcessMap` now queries `Win32_Process` with `Filter = "(<name filter>) AND SessionId=<this process's SessionId>"` (from `(Get-Process -Id $PID).SessionId`), so it only ever sees this Windows/Terminal-Services session's processes.
5. **Grid rule switched to max area, column-major fill (DESIGN §3.1).** `Select-ClaudeTeamGrid` now scores each candidate column count by `paneCols * paneRows` (max area, ties keep the smaller column count) instead of `|log((paneCols/paneRows)/2.5)|`; the now-unused `$ClaudeTeamTargetPaneAspect` constant was removed. `Set-ClaudeTeamTabLayout`'s cell-assignment loop was rewritten column-major: column 0 fills top to bottom before column 1 starts, and the first `count % columns` columns get one extra pane each (the same distribution as `claude_team_tab_grid` on Linux), replacing the old `index % columns` row-major fill. `.Tab`/`.Cells` are now set inline in that same loop (the old separate closing loop, which assumed row-major indexing, was removed). `Get-ClaudeTeamLeadShape`'s lead-top/lead-left fallback is unchanged.
6. **Duplicate constants removed.** `claudeteam.ps1`'s own `$teammateMode = "in-process"` is gone; both use sites (`--teammate-mode` args, the info banner) now reference `ClaudeTeamCommon.ps1`'s `$ClaudeTeamLeadTeammateMode` directly. `ClaudeTeamCommon.ps1` no longer declares its own `$ClaudeTeamCatalogPath` / `$ClaudeTeamUserClaudeDir`: the dot-source of `ClaudeTeamInstallCommon.ps1` (which keeps `$ClaudeTeamInstallCatalogPath` / `$ClaudeTeamInstallUserClaudeDir` at :24/:38, since it is also dot-sourced standalone by `dd.ps1`'s Step21/`ApplicationsList.ps1` callback) was moved to the top of `ClaudeTeamCommon.ps1`'s constant block, and every use site was repointed to the `Install`-prefixed names.

### Item D13-WIN-CATALOG-LEDGER -- status: done

- `Get-ClaudeTeamRoleWindowFlag -Role` (new): a role's catalog `window` flag, default `$true`.
- `Get-ClaudeTeamLayoutGroups` now filters `$KnownRoles` to `Get-ClaudeTeamRoleWindowFlag` before both the `tab_groups` membership check and the unlisted-roles fallback, so a `window:false` role can never land in a group even if a future config edit lists it explicitly.
- `Import-ClaudeTeamCatalog` now builds `$noWindowRoles` (known roles with `window:false`) and adds them as their own rows after the normal per-group loop: `Group = -1`, `Window = $false`, `Tab`/`Pane`/`Pid`/`Cells` stay `"-"`, and `State` is `"no-window"` (or `disabled`/`not-selected`/`no-agent-file` when those apply, via the new shared `Get-ClaudeTeamRoleBlockedState` helper, which also replaces the near-duplicate enabled/disabled/not-selected/no-agent-file block that used to be inlined in the per-group loop). Every row (packable and no-window) now carries a `Window` field.
- `Start-ClaudeTeamRoles`'s main loop and the STEP 7 liveness log now filter on `$_.Enabled -and $_.Window`, so `window:false` rows are never packed, never PID-checked, and never opened. `Get-ClaudeTeamOtherRoles` (feeds the `{roles}` kickoff placeholder) now also requires `$_.Window`, since a `window:false` role gets no local session to confirm via `ListAgents` in the kickoff's "confirm the sessions" sense.
- `groups[]` (the D22 top-level array) needs no separate read on Windows: `layout.tab_groups` is already grouped per team group and reflects the same membership -- recorded as aligned in the ledger note rather than as a second read path.
- `windows.md`: SPW-023 reworded to credit the idle-shell/`--name` liveness fix (item 1 above) instead of the pre-fix "started before the file was written" / plain name-collision text; SPW-025 reworded to describe max-area + column-fill (drops the stale "closest to 2.5 cols/row" text) and cross-references SPW-024's platform-only WT-chrome tab-count note (SPW-024 itself left untouched, as instructed); SPW-020 reworded for items 2 and 3 above (generic lead-key clearing, standalone role-spec behavior). New row **SPW-036** for the `window:false` feature, status `pending-linux` (see Cross-scope below).

### Verification

- `[System.Management.Automation.Language.Parser]::ParseFile` on all three files: **0 errors** (re-run after every edit round; last run confirmed clean).
- Idle-shell liveness, functionally, with a real background process (not a mock): started a real `powershell.exe -File <sleep stub> --team-pane sessions --agent zzz --name test-fake-session-<pid>` and queried the live map against it --
  - `Get-ClaudeTeamNamedClaudeProcess` for that session: **null** (a bare shell match is not "already running").
  - `Get-ClaudeTeamNamedShellProcess -AfterTime (Get-Date).AddMinutes(5)` (simulating an old idle shell relative to "now"): **null** (does not block a reopen).
  - `Get-ClaudeTeamNamedShellProcess -AfterTime (Get-Date).AddSeconds(-30)` (a time just before it actually started): returns that process's real PID (correctly recognized as "still starting").
  - `Get-ClaudeTeamLivePid` for that session: **null**, not the shell's PID -- confirms a lone `powershell.exe --name` match is never reported as a running role.
- `Remove-ClaudeTeamPidFile`: a PID file whose content equals the caller's own `$PID` is deleted; a PID file naming a different (foreign) PID is left untouched -- both verified directly.
- Standalone role resolution (`Get-ClaudeTeamStandaloneRow`), without invoking `claude`: `pycore-ai` -> a non-lead row (`Session=ct-pycore-ai`, `IsLead=False`); `orchestrator` -> the lead row; `reviewer` (a `window:false` role) -> still resolves as a valid row (it can still be started directly as its own pane); `bogus-role` and an empty role -> `null` (falls back to the plain lead behavior). Pre-set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the process before calling `Set-ClaudeTeamSessionEnvironment -Row <pycore-ai row>`: the variable read back **empty afterward**, confirming the non-lead clear.
- Grid rule, hand-calculated (`Select-ClaudeTeamGrid` invoked directly with a 2000x800 px region, 7 panes, same cell/chrome constants as the real budget): the **old** aspect-2.5 scoring picks **4** columns (score minimized at cols=4, 0.0397); the **new** max-area scoring picks **7** columns (area maximized at cols=7, ~1151.6 vs ~1041.5 at cols=4) -- the numbers differ between the two rules as the task's verify text requires.
- Full `-Status` dry run (`scripts\winenvs\claudeteamup.ps1 -Status`, read-only: no CLI provisioning, no official restore, nothing opened) against this machine's real catalog and monitor (2560x1600 @100%, budget 280x79): 15 packable roles packed into **1 tab, 3-column grid** (91x15 cells each); `orchestrator` correctly shows `other-lead` (a real `ca-orchestrator` session -- this very team -- is live) and `laravel-remote` shows `running` (a real remote pane is live), both resolved through the same fixed `Get-ClaudeTeamLivePid`/named-process pipeline. `reviewer`, `ncore`, `flutter` (D22 `window:false`) appear as rows with `Tab=-`, `Pane=-`, `Pid=-`, `State=no-window`, and are absent from every `wt` call segment and from the `{roles}` kickoff list -- matches both items' verify text.

### Cross-scope: alignment request for shell-linux

Left one row **pending-linux**: **SPW-036** -- `window:false` service roles (D22 schema_version 7). `scripts/shells/linux/common/claude_team_common.sh`'s `claude_team_load_catalog` (its embedded python parser, around line 421-432) does not read/emit `roles[].window` at all, and `claude_team_place_order` (around line 1032-1088) appends every role missing from `layout.tab_groups` to the last pack group unconditionally -- the identical latent bug this task fixed on Windows (`reviewer`/`ncore`/`flutter` would still get packed into a tmux pane on Linux today). Fix needed: exclude a `window:false` role from `claude_team_place_order`'s grouping and its "roles in no tab group" fallback, and give it its own non-packing row/state (mirroring `Get-ClaudeTeamRoleBlockedState`/`Import-ClaudeTeamCatalog`'s `Window`/`Group=-1`/`State=no-window` shape here) so it stays valid for messaging/tasks. Files: `scripts/shells/linux/common/claude_team_common.sh`. Task id: `shell-windows-G1`.

No live `shell-linux` teammate/session was reachable via ListAgents at the time of this report (only `core-node-e9` and `ct-laravel-remote` were listed as peers), so this request is recorded here for the orchestrator to open as `[shell-linux] align: SPW-036 window:false service-role catalog support`, per the parity protocol's third option.

### Blockers

None.

### Next owner

Reviewer, for `shell-windows-G1`. Orchestrator: please open `[shell-linux] align: SPW-036 window:false service-role catalog support` (see Cross-scope above).

# shell-windows report

| Task | Scope | Status |
|---|---|---|
| shell-windows-2 | D12a desktop icon organizer: scan, upgrade, real run, idempotency, undo | review round 1 fixed (2 blocking + 3 non-blocking in scope), awaiting reviewer |
| shell-windows-3 | D12b Windows side: WSL2 + Debian 13 ensure, Docker model runner delegation, Step55/56 wiring | done, awaiting reviewer; model runs wait for shell-linux's runner |
| shell-windows-9 | Windows FrankenPHP bugs found bringing up local Laravel (merged route braces, no PHP extensions, no skip_install_trust, LAN ACME retries) | done, awaiting reviewer |
| p2-windows | Dual-boot P2: adjudicated 15 review findings on `SharedCacheEnv.ps1`'s Windows 3-drive layout constants (7 fixed, rest rejected/deferred with reasons) | done, awaiting reviewer |
| shell-windows-G1 | D13 group task: fixed the 6 reviews/shell-windows-1.json blockers (idle-shell liveness, session_env.lead clear, standalone `--agent` role spec, `--name` session filter, max-area/column-fill grid, duplicate constants) and D22 schema-7 `window:false` service-role support | done, awaiting reviewer |
| amend-windows | D27 amendment: dual-boot layout dropped the tree root/subdir on both OSes; `SharedCacheEnv.ps1` re-worked to `CN_CACHE_ROOT`/`CN_CACHE_SUBDIR_NAMES` under `CN_TOOL_ROOT`, `.cn_volume` marker relocated to the drive root, no junction logic on Windows | done, awaiting reviewer |
| shell-windows-10 | Answer the D27 question ("/opt/core_node_trees/www/core_node_trees, what is it for, remove if useless") for the Windows side; re-verify shell-windows-9 was not regressed | done (investigation only; no code changes needed on the Windows side) |
| shell-windows-10 (D29) | Tailscale management: common library + Windows Management menu entry (status/devices/restart/panel), verified live against the running install, parity checked against shell-linux's own already-built counterpart | done, awaiting reviewer |
| amend-windows-d28d30 | D28/D30 lane: verified `SharedCacheEnv.ps1` + new `ProjectTreeCommon.ps1` against the current contract (namespaces/tool_root/cache_root/trees_root/toolchain_env_file), re-ran the 7-state junction scratch test, updated the stale SPW-035 ledger row | done, awaiting reviewer (no code changes needed -- files were already correct) |

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
- `windows.md`: SPW-023 reworded to credit the idle-shell/`--name` liveness fix (item 1 above) instead of the pre-fix "started before the file was written" / plain name-collision text, and extended to remote panes in review round 1 (see the `D13-WIN-BLOCKERS` round-1 fix below); SPW-025 reworded to describe max-area + column-fill (drops the stale "closest to 2.5 cols/row" text) and cross-references SPW-024's platform-only WT-chrome tab-count note (SPW-024 itself left untouched, as instructed); SPW-020 reworded for items 2 and 3 above (generic lead-key clearing, standalone role-spec behavior). New row **SPW-036** for the `window:false` feature -- round 1 corrected its status to `aligned` (see the `D13-WIN-CATALOG-LEDGER` round-1 fix below); the original `pending-linux` wording and its cross-scope alignment request are withdrawn.

### Review round 1: fixes (reviews/shell-windows-G1.json)

Blocking, both fixed:

1. **`claudeteam.ps1:112-115` (D13-WIN-BLOCKERS item 1, remote pane): idle-`.pid` leak on a remote role.** The remote branch (`Invoke-ClaudeTeamRemoteLoop` then `return`) never reached `claudeteam.ps1:198`'s `Remove-ClaudeTeamPidFile` call, so a remote role that stopped (missing python/ssh.exe/secret, or the loop's documented Ctrl-C stop) left `<session>.pid` behind naming a still-alive `-NoExit` shell; `Test-ClaudeTeamPidFile` then reported it "running" forever and it never restarted (the DESIGN §3.2 defect, but for remote panes specifically). Fixed by wrapping the whole pane body -- the remote-loop branch and the local-claude branch alike -- in one `try { ... } finally { if ($null -ne $paneRow) { Remove-ClaudeTeamPidFile -Session $paneRow.Session } }`; the old standalone call at the former `:198` is gone (the `finally` is now the only place that removes the file). `finally` runs on the loop's normal early return, on Ctrl-C, and on any terminating error under `$ErrorActionPreference = "Stop"`. `windows.md` SPW-023 reworded to say the try/finally (not a bare post-call statement) drops the PID file for both the remote loop and the local invocation.
2. **`windows.md` SPW-036 (D13-WIN-CATALOG-LEDGER): false `pending-linux` status.** Linux already implements `window:false` end to end -- `claude_team_common.sh:458` (python parser emits `window`), `:609-611` (`claude_team_validate_roles` sets `no-window` state), `claude_team_place_order` `:1107`/`:1119` (skips non-`place` rows) -- landed in the same backup commit `4ddb4be8e`, and `linux.md:45` already records it `aligned` under `shell-linux-G1`. Fixed: SPW-036 status is now `aligned (Linux: claude_team_load_catalog, claude_team_validate_roles, claude_team_place_order)`. The cross-scope `[shell-linux] align: SPW-036 ...]` request in this report (previously at the end of this section) and in the workflow result's `cross_scope` is withdrawn; no alignment task is needed.

Non-blocking (reviewer-accepted or informational; not required this round, left for a future pass if the orchestrator opens one):

- `ClaudeTeamCommon.ps1:25-29`/`:39` still re-derive `$ClaudeTeamRootDir`/`$ClaudeTeamWinEnvsDir`/the `.claude` join instead of reusing `ClaudeTeamInstallCommon.ps1`'s `$ClaudeTeamInstallRootDir`/`$ClaudeTeamInstallWinEnvsDir`/`$ClaudeTeamInstallClaudeDir` (the dot-source is now at `:37`, so those values are already in scope).
- `claudeteam.ps1:151-158` rebuilds `--effort`/`--permission-mode`/`--teammate-mode` inline for the standalone-role branch, duplicating `Get-ClaudeTeamRoleClaudeArguments`; a switch there (omit `--agent`/`--name`, keep a user-supplied `--effort`) would keep one implementation.
- Stale wording: `ClaudeTeamCommon.ps1:18-20`'s header and the `:1626` log still describe the pre-D13 "any --name process or live shell PID skips a role" rule instead of "only a claude/node --name match counts."
- Legacy `<mode>-<role>.pid` candidates (`Get-ClaudeTeamPidCandidates`) are never removed, so a surviving pre-D13 idle shell still counts as live (transitional only).
- The inline 1 s tolerances (`Get-ClaudeTeamNamedShellProcess`'s `AddSeconds(-1)`, `Test-ClaudeTeamPidFile`'s `AddSeconds(1)`) could share one top-level constant.
- Confirmed acceptable: `$ClaudeTeamInstallCatalogPath`/`$ClaudeTeamInstallUserClaudeDir` are declared once in `ClaudeTeamInstallCommon.ps1` rather than `ClaudeTeamCommon.ps1` as the original verify text asked; the reviewer accepted this because `ApplicationsList.ps1:1256` dot-sources `ClaudeTeamInstallCommon.ps1` standalone.

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

### Review round 1 re-verification

- `[System.Management.Automation.Language.Parser]::ParseFile` on all three files after the try/finally rewrite: **0 errors**.
- Line endings: `claudeteam.ps1` is still LF-only (0 `\r` bytes), matching the base.
- Remote-pane PID cleanup, functionally (scratch dir, `Get-ClaudeTeamPidPath` monkey-patched to a scratch state dir so the real `%LOCALAPPDATA%\core_node\claude_team` was never touched; `Invoke-ClaudeTeamRemoteLoop` stubbed to reproduce the two documented exits -- an early `return` for a missing prerequisite, and a thrown terminating error for the Ctrl-C case -- since a real ssh loop cannot run headless here): a `<session>.pid` file written with this process's own `$PID` (simulating a still-alive pane shell) existed before the `try`; after the stub's early `return`, the `finally` block had already deleted it; after re-creating the file and having the stub `throw`, the exception propagated past the `try` (confirming `finally` does not swallow it) and the file was still deleted. Both cases match DESIGN §3.2 ("a pane's -NoExit shell alone does not count") for the remote-pane path specifically, which review round 1 flagged as the remaining gap.
- SPW-036: re-read `.claude/agents_shared/shell_parity/linux.md:45` (still records `aligned`, task `shell-linux-G1`) and grepped `scripts/shells/linux/common/claude_team_common.sh` for `window` at lines 458/609-611/1107/1119 -- all present, confirming the reviewer's citations before changing the status.
- Grep confirms no remaining `pending-linux` text for SPW-036 in `windows.md`, and no `[shell-linux] align: SPW-036` text remains in this report.

### Cross-scope: withdrawn

**Review round 1 correction:** the original write-up here claimed SPW-036 (`window:false` service roles) was `pending-linux` and asked the orchestrator to open `[shell-linux] align: SPW-036 window:false service-role catalog support`. That was wrong: Linux already implements `window:false` -- `claude_team_common.sh:458` (the python parser emits `window`), `:609-611` (`claude_team_validate_roles` sets `no-window` state with no `ROW_ACTION`) and `claude_team_place_order` `:1107`/`:1119` (skips rows that are not `place`) -- landed in the same backup commit `4ddb4be8e`, and `linux.md:45` already records SPW-036 `aligned` (task `shell-linux-G1`). The ledger row is now `aligned` (see `windows.md` SPW-036). **This alignment request is withdrawn; no `[shell-linux] align: SPW-036 ...]` task is needed.**

### Second confirmation pass (this invocation, HEAD `24674d1a6`)

This session was dispatched the same reviews/shell-windows-G1.json round-1 issues again. `git status` on the three write-scope files plus `windows.md` and this report was already clean going in (0b6f362e3/2f31f9cd3/4ddb4be8e already carried the round-1 fixes above; the later `7a23f57d0`/`24674d1a6` commits touch unrelated files only, confirmed by `git log 8f95a2a24..HEAD` and per-commit `--stat` on those two hashes), so no new edits were needed. Independently re-ran the checks the two blocking issues require, starting from a fresh read of the working files rather than trusting the prior write-up:

- `claudeteam.ps1:110-206`: the pane body (remote-loop branch and local-claude branch alike) is wrapped in one `try { ... } finally { if ($null -ne $paneRow) { Remove-ClaudeTeamPidFile -Session $paneRow.Session } } ` -- confirmed by re-reading the file top to bottom; `Remove-ClaudeTeamPidFile` appears exactly once (the `finally` block), not also at the old post-`& claude` call site.
- `windows.md` SPW-036: reads `aligned (Linux: claude_team_load_catalog, claude_team_validate_roles, claude_team_place_order)`; grep for `pending-linux` near SPW-036 and for the old `claude_team_load_catalog does not emit roles[].window` text: no hits.
- This report: grep for `align: SPW-036`: only the historical withdrawal narrative above remains, no active alignment request.
- `[System.Management.Automation.Language.Parser]::ParseFile` re-run on all three write-scope files: **0 errors**.
- Line endings: `claudeteam.ps1`, `ClaudeTeamCommon.ps1`, `ClaudeTeamInstallCommon.ps1` all still 0 CR bytes (LF-only).
- Grep for `$teammateMode`, `$ClaudeTeamInstallCatalogPath =`, `$ClaudeTeamInstallUserClaudeDir =` across `scripts/`: `$teammateMode` has no hits in `claudeteam.ps1`/`ClaudeTeamCommon.ps1` (the remaining hits are the unrelated `ark*.ps1`/`claude1..5.ps1`/`claudealibaba.ps1`/`claudedeepseek.ps1`/`claudevolc.ps1`/`claudezhipu.ps1` standalone launchers and the `special_software_env_manager` codegen templates that produce them, none in this task's write scope); the two Install-prefixed constants are each declared exactly once, in `ClaudeTeamInstallCommon.ps1`.

No further edits were made; the fixes and their round-1 write-up above already reflect the current, correct state. No `.claude/agents_shared/reviews/shell-windows-G1.json` update to `approved` has appeared yet (still the `changes_requested` verdict from the round this section addresses), and no `reviewer` teammate/session was reachable via `ListAgents` in this invocation (peers were `core-node-e9` and `ct-laravel-remote` only) to message directly, so the outcome is recorded here for the orchestrator to route to the reviewer for re-check.

### Blockers

None.

### Next owner

Reviewer, for `shell-windows-G1` (round-1 fixes independently re-confirmed above; awaiting an `approved` verdict).

## shell-windows-10: "/opt/core_node_trees" question (D27) + shell-windows-9 re-verification

The harness's actual user message for this run was D27's question, not a computed FrankenPHP task: *"/opt/core_node_trees/www/core_node_trees 这个目录是干什么用的，查看项目中，如果没什么用去掉。"* ("What is this directory for? Check the project; if it's not useful, remove it.") Per the harness framing that request is the only user voice and wins over the computed task text, so this is written up as its own item even though the computed task named `shell-windows-9`.

### Finding

`core_node_trees` was never built: it is the dual-boot 3-drive design from `docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md` (Windows `<program_drive>\core_node_trees` for junctioned `node_modules`/`vendor`/`.venv` + toolchain caches; Linux ext4 `/opt/core_node_trees` bind-mounted onto an empty NTFS mount point `/www/core_node_trees` so the Windows junctions resolve to ext4). Confirmed on this machine: no `E:` drive, and no `core_node_trees` directory anywhere under `C:\` or `D:\` (2-level recursive scan). The orchestrator already ruled on exactly this question in `docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` (D27, "Ruling: remove `core_node_trees` everywhere") before this run started: the contract keys (`tree_subdir`, `tree_root`, `tree_cache_root`, `tree_cache_subdirs`) are replaced by `cache_root`/`cache_subdirs` and `trees_root`/`trees_rule`, and `core-node-e9` (the role that owns this fenced dual-boot-layout lane) was asked to update its code accordingly.

### Windows side (this task's scope)

- `config/service_contract.json` `paths.drive_layout` no longer has `tree_subdir`/`tree_root`/`tree_cache_root` (confirmed by reading the live file).
- `scripts/shells/win/win_common/SharedCacheEnv.ps1` (my write scope) still had the dead code reading those removed keys at the start of this task (`$__sccTreeSubdir`, `$Global:CN_TREE_ROOT`, `$Global:CN_TREE_CACHE_ROOT` via `Get-ServiceContractValue`, which throws on an unknown contract path) -- this was a live, broken load-time bug, not just leftover text. While investigating it, `core-node-e9` (listed live/busy in `ListAgents`, and the fenced owner of this exact code per the D25/D26/D27 entries in `CLIENT_KEY_AUTH_AUDIT_FIX.md`) fixed it in place concurrently: `CN_TREE_ROOT`/`CN_TREE_CACHE_ROOT` removed, the `.cn_volume` first-adoption marker relocated from `<tree_subdir>\.cn_volume` to `<DriveRoot>\.cn_volume` (`Test-CnProgramDriveQualifies`/`Register-CnProgramDriveAdoption` lost their `TreeSubdir` parameter), and a new `$Global:CN_CACHE_ROOT`/`CN_CACHE_SUBDIR_NAMES` pair declared from the contract's `cache_root`/`cache_subdirs`. It also updated the `windows.md` SPW-035 row and added the `amend-windows` row to this report's table itself.
- I made **no edits** to `SharedCacheEnv.ps1` or to the `windows.md` SPW-035 row: both changed under me between reads (confirmed by re-reading and by the line numbers shifting), so editing either risked clobbering `core-node-e9`'s in-flight work on a file it already owns for this lane. Sent it a short coordination message instead (msg_id `4456df50-5cf1-468e-b142-9ce00809fa6b`) confirming no conflict and recording what I verified independently.
- Independent verification of `core-node-e9`'s fix (read-only): `[System.Management.Automation.Language.Parser]::ParseFile` on `SharedCacheEnv.ps1` -- 0 errors; `grep -rn "CN_TREE_ROOT|CN_TREE_CACHE_ROOT|core_node_trees|tree_subdir" scripts/` -- zero hits anywhere under `scripts/` except the two Linux files below; no other Windows file references `CN_TREE_ROOT`/`CN_TREE_CACHE_ROOT`/`CN_CACHE_ROOT` (`GlobalVars.ps1` does not read them).
- Also noticed the live contract now carries a further D28/D30 purpose-note (`trees_root` reintroduced under a renamed `core_node_compiler` namespace, junctions gated on E: qualifying -- `development-guides/DIRECTORY_NAMESPACE_RULES.md`). That is a new design, not the `core_node_trees` the user asked about, and `core-node-e9`'s own SPW-035 note already flags it as "not implemented by this row, needs its own fenced task" -- left untouched; it is that lane's work, not this task's.

### Linux side (not my write scope -- flagged, not fixed)

`scripts/shells/linux/common/mount_common.sh` (`ensure_tree_root_bind_mount`, ~line 1042-1101) and `scripts/shells/linux/common/shared_cache_env.sh` (`CN_TREE_MNT`/`CN_TREE_BACKING`/`CN_TREE_CACHE_ROOT`, ~line 33-165) still read the removed `paths.drive_layout.tree_root.linux` / `tree_root.linux_backing` / `tree_cache_root` keys. They degrade gracefully (`sc_get ... || VAR=""`, a warning, and a no-op bind) rather than throwing, but the practical effect is that `ensure_tree_root_bind_mount` is now permanently dead code and the Linux toolchain-cache tier it fed is permanently disabled. `core-node-e9` already recorded this exact gap as `pending-linux` on `windows.md` SPW-035 with a Linux-side fix description (rename to `tool_root`/`cache_root`/`cache_subdirs`, matching `CN_CACHE_ROOT`/`CN_CACHE_SUBDIR_NAMES` on Windows; Linux keeps its own `trees_root.linux` bind-mount tier that Windows has none of). I did not touch these files (`shell-linux`'s write scope). No live `shell-linux`/`ct-shell-linux` session was reachable via `ListAgents` (only `core-node-e9` and `ct-laravel-remote`), so recording it here too per the parity protocol's third option.

### shell-windows-9 re-verification (no redo)

Per this run's note that a previous attempt may have already finished `shell-windows-9`: confirmed via `git diff --stat 74e7770` and direct reads that all four `FrankenPhpManager.ps1` fixes ((a) merged route braces, (b) PHP extension ini, (c) `skip_install_trust`, (d) LAN-only per-domain route gating) and parity rows SPW-031..034 are already in place and match the existing write-up above. Re-ran only the cheap, non-destructive check: `[System.Management.Automation.Language.Parser]::ParseFile` on `FrankenPhpManager.ps1` -- 0 errors. Did not re-run `frankenphp validate` (already exercised and documented in the shell-windows-9 section above; the task note said finish-and-verify, not redo, and the live D7 instance must stay untouched). No `.claude/agents_shared/reviews/shell-windows-9.json` exists yet, so it is still correctly "awaiting reviewer".

### Changed files

None under shell-windows-10 itself (`.claude/agents_shared/reports/shell-windows.md`, this section and its table row, is the only write). `SharedCacheEnv.ps1` and `windows.md` SPW-035 were changed by `core-node-e9`, not by this task.

### Parity

- SPW-035 (owned by `core-node-e9`'s lane, not created by this task): `pending-linux`, counterpart request already on record (see Linux side above). Listing it here again only so the orchestrator does not miss it if `core-node-e9`'s own report is not yet read: `[shell-linux] align: SPW-035 drop ensure_tree_root_bind_mount from mount_common.sh; rewire shared_cache_env.sh's CN_TREE_MNT/CN_TREE_BACKING/CN_TREE_CACHE_ROOT (removed contract keys tree_root.linux/tree_root.linux_backing/tree_cache_root) to CN_CACHE_ROOT from cache_root/cache_subdirs, mirroring SharedCacheEnv.ps1`.

### Blockers

None for the Windows side. The Linux-side cleanup above needs a `[shell-linux] align: SPW-035 ...` task from the orchestrator.

### Next owner

`core-node-e9` continues its fenced dual-boot-layout lane (including the newer D28/D30 `core_node_compiler` design). Orchestrator: please route the SPW-035 Linux alignment to `shell-linux` when it creates a session. Reviewer: nothing new to review under `shell-windows-10` (investigation only); `shell-windows-9` stays `done, awaiting reviewer`.

## shell-windows-10 (D29): Tailscale management menu

Note on the id: this run's dispatched task was also labeled `shell-windows-10`, colliding with the D27 "/opt/core_node_trees" investigation already recorded above under that same id. Both are genuine, unrelated pieces of work; rather than overwrite that section this one is filed as `shell-windows-10 (D29)` (matching the table row) so neither write-up is lost. Flagging the id reuse for the orchestrator's numbering, not asking about it.

User request (D29, verbatim, Chinese): "dd.cmd sh中的菜单中的liunx/windows管理中加入tailscale的管理，如果本机安装，则添加重记服务，打开面板，显示所有devices IP状态等等，搜索官方文档。加入公共脚本直接调用。" -- add Tailscale management to the Linux/Windows management menus; if installed locally, add a restart-service action, an open-panel action, and show every device's IP/status; search the official docs; put it in a common/shared script called directly. Reading B9: "重记服务" = restart the service (typo for 重启/重启记).

### What was already there when this task started

Both the Windows implementation and its Linux counterpart already existed in the working tree before this run touched anything (git commit `0b6f362e3`, "win0.0.1", already carries `TailscaleCommon.ps1` and the `WindowsManagementManager.ps1` wiring; the Linux `tailscale_common.sh`/`tailscale_menu.sh`/`linux_management.sh` wiring is likewise already committed, "linux0.1"). Neither side's own ledger or report had a Tailscale row yet, so this task's real remaining work was: verify the existing Windows code against the official-docs spec and against what shell-linux already built, fix anything wrong, and close the parity/reporting loop that a previous attempt at this same task apparently did not finish.

### Verification (Windows side)

- `[System.Management.Automation.Language.Parser]::ParseFile` on `TailscaleCommon.ps1` and `WindowsManagementManager.ps1`: 0 errors on both. Both files are ASCII with LF line endings (0 `\r` bytes).
- Read-only live run against the real, already-installed Tailscale on this machine (service `Tailscale` was `Running` before this task started; this task never started, stopped or restarted it, and never ran `tailscale up`/`down`/`set`):
  - `-Action Help`: prints the dispatcher usage.
  - `-Action Status`: correctly resolved `C:\Program Files\Tailscale\tailscale.exe`, `Service 'Tailscale': Running (StartType: Automatic)`, `Backend state: Running`, the real version, tailnet name, this node's two `TailscaleIPs`, `Peers on tailnet: 4`, and the logs path.
  - `-Action Devices`: printed a 5-peer + self table with real HostName/Owner/OS/IPv4/IPv6/Online/LastSeen/ExitNode/Connection data; the currently-online self row correctly showed the documented zero-time `LastSeen` value (`0001-01-01T00:00:00Z`) rather than a blank or an error, confirming `Get-TailscaleDeviceRow` handles that ipnstate edge case the way the spec describes it.
  - Deliberately not run: `-Action Restart` (explicitly forbidden this task) and `-Action Panel` (opens a browser tab; the task's verification scope was parsers, `-Action Help`/usage and read-only status calls, so it was reviewed by reading the code instead of executed).
- Code review against the official-docs command table found no defects: install-detection order (`%ProgramFiles%\Tailscale\tailscale.exe` -> PATH -> the `Tailscale` service's own `Win32_Service.PathName` directory) matches the MSI-install-dir doc's documented fallback chain; "installed" requires both the exe and the service, matching the spec's install_detection rule; the not-installed message only prints the doc URL and the `Tailscale.Tailscale` winget id, it never runs an install; `Restart-TailscaleServiceElevated` checks `$Global:IS_RUN_ADMIN` (from `GlobalVars.ps1`, already dot-sourced through `CommonFunc.ps1`) and relaunches itself elevated rather than failing silently; `Show-TailscalePanel` opens the admin console unconditionally and the local Quad100 URL only when `BackendState -eq 'Running'`, matching the device-web-interface doc's "daemon must be running and connected" note; every JSON field read goes through the Strict-Mode-safe `Get-TailscaleJsonProperty` (GlobalVars.ps1 sets `Set-StrictMode -Version Latest`, and `ConvertFrom-Json`'s shape varies by Tailscale version); IPv4/IPv6 are classified by the presence of `:`, not array order, per the ipnstate doc's caveat that `TailscaleIPs` order is not part of the schema; no `exit` statements anywhere in the file.
- No changes were needed to `TailscaleCommon.ps1` or `WindowsManagementManager.ps1` themselves; both were already correct.

### Parity (ledger: `.claude/agents_shared/shell_parity/windows.md`)

Read shell-linux's already-committed counterpart (`scripts/shells/linux/common/tailscale_common.sh`, `scripts/shells/linux/menu_itemshells/tailscale_menu.sh`, and the `dd_helper/linux_management.sh` wiring) function by function against the Windows code and the spec, rather than assuming either "pending-linux" or "aligned" from the task text alone (the task text predates the discovery that Linux had already built its side).

- **SPW-037** (`aligned`): the core feature -- install detection (CLI + service both present), `Status`, `Devices`, `Restart` (with elevation on Windows / `sudo` on Linux), `Panel` (admin console always, local web UI conditionally), never installs and never touches login state -- is already symmetric: Linux's `is_tailscale_installed`/`ts_service_unit_exists`/`ts_backend_state`/`ts_show_status`/`ts_show_devices`/`ts_restart_service`/`ts_show_panel`/`ts_show_help` mirror the Windows functions one for one, cite the same official-doc sources, and are wired into the "Linux Management" menu the same way `WindowsManagementManager.ps1` wires the Windows entry. No alignment task needed for this row.
- **SPW-038 / SPW-039**: first read of Linux's `tailscale_common.sh` found two real, narrow content gaps against the Windows side -- no `LastSeen` column in `ts_show_devices`, and `ts_show_panel` opening the local Quad100 URL unconditionally instead of gating it on `BackendState=Running`. Before this report was written up, a second read of the same file (shell-linux's own write scope, uncommitted working-tree changes, `bash -n`-clean) showed both already fixed: `ts_show_devices`'s `row_fmt` now has a `LAST SEEN` column (`peer.get("LastSeen", "") or "-"`), and `ts_show_panel` now checks `ts_backend_state = Running` before opening the local URL and prints a skip message naming the actual state otherwise, matching Windows almost line for line (down to the same kind of skip-message wording). `linux_management.sh` also gained the "Linux System Tools > Tailscale Management" menu entry in the same window. Recorded both rows `aligned`, crediting shell-linux; no alignment task needed.

No live `shell-linux` teammate or `ct-shell-linux` session was reachable via `ListAgents` (only `core-node-e9` and `ct-laravel-remote` were listed as peers) to confirm this directly, but the working-tree diff is unambiguous and self-consistent, so this is recorded as done rather than left open.

### Choices made (no questions asked)

- Recorded SPW-037 as `aligned` rather than following the task text's "pending-linux with the exact counterpart request" literally for the whole feature: the task text was written before either side's ledger recorded this work, but the Linux counterpart was already fully built and (as of this task) fully caught up by the time this ledger entry was closed out, so a blanket `pending-linux` on the whole feature, or even on SPW-038/SPW-039 by the end of this task, would have been stale and factually wrong. Recorded exactly what the code shows instead.
- Did not exercise `-Action Panel` or `-Action Restart` against the real installed Tailscale, per the task's explicit "never restart Tailscale or change its login" instruction and its narrower verification scope (parsers, `--help`/usage, read-only status calls); both were verified by code review instead.

### Changed files

- `.claude/agents_shared/shell_parity/windows.md` (SPW-037, SPW-038, SPW-039).
- `.claude/agents_shared/reports/shell-windows.md` (this section and its table row).
- No changes to `TailscaleCommon.ps1` or `WindowsManagementManager.ps1`: both were already correct and complete.
- Not this task's writes, observed only: `scripts/shells/linux/common/tailscale_common.sh`, `scripts/shells/linux/dd_helper/linux_management.sh`, and the new `scripts/shells/linux/menu_itemshells/tailscale_menu.sh` (shell-linux's write scope; already closing out SPW-038/SPW-039 by the time this report was written).

### Blockers

None.

### Next owner

Reviewer, for `shell-windows-10 (D29)`. No shell-linux alignment task needed: SPW-038/SPW-039 were already closed out in shell-linux's own working tree by the time this report was written.

## amend-windows-d28d30: D28/D30 SharedCacheEnv.ps1 + ProjectTreeCommon.ps1 lane

Fenced files: `scripts/shells/win/win_common/SharedCacheEnv.ps1`, `scripts/shells/win/win_common/ProjectTreeCommon.ps1`, `.claude/agents_shared/shell_parity/windows.md` (row SPW-035).

### Finding: both fenced .ps1 files were already fully D28/D30-compliant

Read the current contract (`config/service_contract.json#paths.drive_layout`, confirmed `tree_subdir`/`tree_root`/`tree_cache_root`/`tree_cache_subdirs` are gone and `tool_root`/`cache_root`/`trees_root`/`toolchain_env_file` are per-OS objects), `DIRECTORY_NAMESPACE_RULES.md`, `LINUX_SHELL_RULES.md`, and `docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md` §1 (D1-D30). `git log`/`git diff` showed the fenced files were last touched by an already-committed `win0.0.1` commit (`0b6f362e3`, today 20:52) with a clean working tree -- no stopped-workflow partial edits to reconcile. Checked point by point against the task's amendment list:

1. `SharedCacheEnv.ps1` already reads `namespaces.windows_program_drive`, `tool_root.windows`/`windows_d_fallback`, `cache_root.windows`/`windows_d_fallback`, `cache_subdirs`, `trees_root.windows`, `toolchain_env_file.windows`, each exactly once (`$__scc*Template` variables near line 285-294); `<program_drive>` and `<sys>` are each resolved once (`$__sccEffectiveProgramDriveLetter`, `$__sccSystemName`) and reused for every template substitution. All the required globals exist with one definition each: `CN_TOOL_ROOT`, `CN_CACHE_ROOT`, `CN_CACHE_SUBDIR_NAMES`, `CN_TREES_ROOT` (empty string on the D: fallback, D28), `CN_TOOLCHAIN_ENV_FILE`, plus the pre-existing drive-role globals. No load-time writes happen on the program-drive/tool/cache/trees path (the file's own header comment states this and the code matches: `Register-CnProgramDriveAdoption` and `New-CnNamespaceDirectory` are both installer-only, never called from top-level file scope). Confirmed no literal re-declares a contract value (grepped for hardcoded `core_node_compiler`/drive-letter logic in the code body; only comments mention them).
2. `Write-ProgramDriveFallbackWarning` (lines 256-266) already states, in explicit English, that programs/toolchains/build files and project heavy directories belong under the program-drive namespace, names the namespace root (e.g. `E:\core_node_compiler` via `$Global:CN_PROGRAM_DRIVE_NAMESPACE_ROOT`), says the drive is unavailable, and says the caller continues at the original location; a `CN_PROGRAM_DRIVE_FALLBACK_WARNED` guard makes it print at most once per process, and grep confirmed `SharedCacheEnv.ps1` itself never calls it (only `ProjectTreeCommon.ps1` does).
3. `ProjectTreeCommon.ps1` already integrates with `$Global:CN_TREES_ROOT` and `Write-ProgramDriveFallbackWarning` (`Invoke-ProjectTreeLinks`), is load-side-effect free (no dot-source-time code outside function/class definitions), never creates anything on the D: fallback (`Restore-ProjectTreeLocalDirectory` only ever unlinks), and routes namespace-root creation through the one `New-CnNamespaceDirectory` helper from `SharedCacheEnv.ps1` (`Set-ProjectTreeJunction` line ~185).
4. No new cache environment variables were exported anywhere in either file (P3 confirmed still deferred).
5. Confirmed `scripts/shells/win/main_powershells/WinScriptsInstaller.ps1`'s `$FILES` array (lines 2-52) does **not** include `ProjectTreeCommon.ps1` -- see Follow-up below.

### Verification: re-ran the 7-state junction scratch test

Parsed both files with `[System.Management.Automation.Language.Parser]::ParseFile` (no errors). Then wrote a standalone scratch harness (`D:\.tmp\claude\...\scratchpad\ptc_test\run_7state_test.ps1`, deleted with the rest of the scratchpad; junctions created and destroyed only inside a `wksp` subdirectory of the scratch dir, link-only deletes first then `[IO.Directory]::Delete($dir,$true)`) that dot-sources only `ProjectTreeCommon.ps1` (stubbing `Write-ColorMessage`/`New-CnNamespaceDirectory`/`Write-ProgramDriveFallbackWarning`/`$Global:CN_TREES_ROOT` locally, so the probe never dot-sources the real `SharedCacheEnv.ps1` and its unrelated D:\www\cache\* directory-creation side effects), under `Set-StrictMode -Version Latest` + `$ErrorActionPreference = 'Stop'`. All 7 states plus the `Invoke-ProjectTreeLinks` wrapper (E:-qualifies path and D:-fallback path) passed with no strict-mode errors:

- missing -> `Created`, junction verified, marker reachable through the link;
- rerun (same target already linked) -> `Linked`, target directory's own mtime unchanged (no filesystem touch);
- foreign link (junction pointing elsewhere) -> old link removed, replaced, new junction verified, the stale foreign target directory itself untouched;
- empty directory -> removed, replaced with a verified junction;
- directory with content -> quarantined to `<name>.pre_program_drive.<timestamp>` with its file intact, then replaced with a verified junction;
- regular file -> `Skipped` with a warning, left as a plain file (no junction attempted, no target created);
- fallback unlink (`Restore-ProjectTreeLocalDirectory`) -> removes an existing link and returns `Unlinked`; called again on the now-missing path returns `Local` with no filesystem change; target directory itself stays intact (only the link is removed);
- `Invoke-ProjectTreeLinks` wrapper: with `$Global:CN_TREES_ROOT` set, creates a real junction; with it cleared and `$Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK = $true`, takes the local/no-junction path and fires the fallback warning exactly once.

No code defects found; no edits were made to either `.ps1` file.

### Parity ledger update (`.claude/agents_shared/shell_parity/windows.md`, row SPW-035)

The existing SPW-035 row was stale: it still described the D27-only state (no `CN_TREES_ROOT`, no junction logic, `cache_root` defined as `<tool_root>/cache`) and carried a "Note for ca-orchestrator" saying the D28 trees-root/junction work needed its own fenced task. That fenced task is this one, and the code already implements it, so the row was rewritten to describe the current D28/D30 implementation (globals, `CN_TREES_ROOT` semantics, `ProjectTreeCommon.ps1`'s state machine and today's re-verification), replacing the obsolete note with the concrete `WinScriptsInstaller.ps1` follow-up. Status stays `pending-linux`, now itemized as two separate gaps:

1. `scripts/shells/linux/common/shared_cache_env.sh:33-35,84-115,162-165` still reads the removed contract keys `tree_root.linux`/`tree_root.linux_backing`/`tree_cache_root` (each `sc_get` already keeps its `|| var=""` guard, but the keys themselves no longer exist in the contract, so that cache tier silently resolves empty) -- needs the rename to `tool_root.linux`/`cache_root.linux`/`cache_subdirs`.
2. Linux has not implemented `trees_root.linux` + the `trees_mount_linux` bind (the single empty `/www/core_node_compiler/trees` mount point, `mountpoint -q` gated, zero writes while unmounted) nor the per-project runtime bind `trees_rule` describes for a plain-directory repo entry -- needed so a live Windows junction (real now that E: qualifies triggers real junctions) still resolves through to ext4 when the same repo is opened on Linux, and to prove the junction translation on real dual-boot Linux (ntfs3/ntfs-3g) per `trees_rule`.

No live `shell-linux` teammate or `ct-shell-linux` session was reachable via `ListAgents` (only `ca-orchestrator` was listed as a peer), so both gaps are recorded in the ledger and here per the parity protocol's report option, for the orchestrator to open as `[shell-linux] align: SPW-035 shared_cache_env.sh key rename (tree_root/tree_cache_root -> tool_root/cache_root/cache_subdirs)` and `[shell-linux] align: SPW-035 trees_root.linux + trees_mount_linux bind mount`.

### Follow-up for ca-orchestrator (not this lane's write scope)

`scripts/shells/win/main_powershells/WinScriptsInstaller.ps1`'s `$FILES` list dot-sources `SharedCacheEnv.ps1` (line 17) but not `ProjectTreeCommon.ps1`, so a fresh install would not have `Invoke-ProjectTreeLinks`/`Invoke-ProjectTreeLink`/etc. available. `WinScriptsInstaller.ps1` is not a shell-windows-owned path per this lane's fence; needs its own task to add the `ProjectTreeCommon.ps1` entry (naturally right after the `SharedCacheEnv.ps1` line, since it depends on that file's globals).

### Choices made (no questions asked)

- Made no code changes to either `.ps1` file after confirming, by static review and by an empirical scratch-dir re-run of all 7 states plus both `Invoke-ProjectTreeLinks` branches, that both already satisfy every point of the task's amendment list. Per the idempotent/repair-only-missing shell rule, editing already-correct code would only add risk.
- Ran the 7-state scratch test against a hand-stubbed `Write-ColorMessage`/`New-CnNamespaceDirectory`/`Write-ProgramDriveFallbackWarning`/`$Global:CN_TREES_ROOT` rather than dot-sourcing the real `SharedCacheEnv.ps1`, because that file's load also creates real `D:\www\cache\*` subdirectories as a documented pre-existing side effect (the shared HF/pip/torch/pycore cache tier, unrelated to this lane) -- dot-sourcing it would have written outside the scratch dir, beyond the "harmless scratch probe" safety allowance.
- Rewrote the SPW-035 row instead of adding a new SPW-0xx id, since the task named this row explicitly and the change is a continuation/correction of the same feature, not a new one.

### Changed files

- `.claude/agents_shared/shell_parity/windows.md` (SPW-035 row rewritten; lines shifted because two unrelated rows, SPW-036 through SPW-039, were added by other lanes between my read and my write -- re-read after the edit to confirm it applied cleanly and the table is still well-formed).
- `.claude/agents_shared/reports/shell-windows.md` (this section and its table row).
- No changes to `SharedCacheEnv.ps1` or `ProjectTreeCommon.ps1`: both were already correct and complete for D28/D30.

### Blockers

None for this lane. The two SPW-035 `pending-linux` items need `[shell-linux] align: ...` tasks from the orchestrator.

### Next owner

Reviewer, for `amend-windows-d28d30`. Then shell-linux for the two SPW-035 alignment items (contract-key rename in `shared_cache_env.sh`, and the `trees_root.linux`/`trees_mount_linux` bind-mount implementation). ca-orchestrator for the `WinScriptsInstaller.ps1` `$FILES` follow-up (add `ProjectTreeCommon.ps1`).

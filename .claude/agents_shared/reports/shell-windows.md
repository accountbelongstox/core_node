# shell-windows report

| Task | Scope | Status |
|---|---|---|
| shell-windows-2 | D12a desktop icon organizer: scan, upgrade, real run, idempotency, undo | done, awaiting reviewer |
| shell-windows-3 | D12b Windows side: WSL2 + Debian 13 ensure, Docker model runner delegation, Step55/56 wiring | done, awaiting reviewer; model runs wait for shell-linux's runner |

## shell-windows-2: D12a desktop icon organizer

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
6. A same-name shortcut already in a category was deleted before the move. It is now displaced into the state dir and recorded. Equivalent Chrome/Edge copies are skipped, where they used to be recopied on every run.
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

- `scripts/shells/win/win_common/DesktopIconManager.ps1`
- `scripts/shells/win/win_common/IconExtractor.ps1`
- `scripts/shells/win/menu_itemshells/WindowsManagementManager.ps1` (+25 lines; the earlier Disk Repair diff there is not mine)
- `scripts/shells/win/install_powershells/Step21_InstallApplications.ps1` (+3 lines, undo hint; the earlier Join-Path diff there is not mine)
- `.claude/agents_shared/shell_parity/windows.md` (new)

### Parity

- SPW-001, SPW-002 and SPW-003: `pending-linux`. The alignment requests are below; the orchestrator should raise `[shell-linux] align: SPW-001/002/003 desktop icon organizer + undo + menu`.
- SPW-004 and SPW-005: `platform-only`. See the ledger `.claude/agents_shared/shell_parity/windows.md`.

Alignment request for shell-linux (task shell-windows-2):

- SPW-001: add a desktop organizer for the real login user's XDG Desktop dir (`xdg-user-dir DESKTOP`).
  - What moves: only regular `*.desktop` launcher files. Never other files, folders or symlinks.
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
- SPW-002: undo manifest with the same JSON shape as Windows: `RunId, CreatedAt, BaseDirectory, UndoneAt, Entries[Action mkdir/link/move/copy/displace, Source, Destination, Category, Reason, Time]`. Store it at `${XDG_STATE_HOME:-$HOME/.local/state}/core_node/desktop_icons/manifests/organize_<runId>.json`. Write one only when something changed. Undo replays the newest run not yet undone, in reverse, and never overwrites. Undone copies and links go to `state/undone/<runId>`. Remove only the empty folders the run created. Set `UndoneAt` when done.
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

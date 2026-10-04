---
name: win-strictmode-and-desktop-icons
description: GlobalVars.ps1 enables Set-StrictMode Latest for every dot-sourcing script; desktop organizer layout and pitfalls
type: project
---
- `GlobalVars.ps1` runs `Set-StrictMode -Version Latest`, so every script that dot-sources it (Step21, menus, DesktopIconManager) is strict. In PS 5.1 `$hash.MissingKey`, `$null.Count` and `'x'.Count` all throw; use `$hash['key']`, `.ContainsKey()` and `@(...).Count`.
- Desktop organizer: `win_common/DesktopIconManager.ps1` (`Invoke-DesktopIconOrganization`, `Undo-DesktopIconOrganization`, `-DesktopIconAction Organize|Preview|Undo`). Folders live at `$Global:LANG_COMPILER_DIR\.desktopIcons\<Category>`, linked on the desktop as directory symlinks named `<Category>.lnk`. Undo manifests go to `%LOCALAPPDATA%\core_node\desktop_icons\manifests`. The menu is dd.ps1 > Management & Backup > Windows Management.
- Desktop policy (user, 2026-10): only one stable Chrome shortcut stays on the desktop; unmatched shortcuts go to `OtherApps`; real files move to the Documents known folder; real folders stay on the desktop (user: CustomPickits must not move). `Window Launcher.lnk` stays ON the desktop (user, 2026-10-04): both writers (`pycore/pyutils/launcher/shortcut_check.ps1`, `desktop_integration.py`) write it to the user desktop and it is pinned via `DESKTOP_ORGANIZATION_KEEP_ON_DESKTOP`; never re-file it into a category folder.
- DesktopIconManager.ps1 stays ASCII: CJK keywords are `\uXXXX` escapes decoded at runtime. The Edit tool can turn `\uXXXX` in new_string into real characters, so re-check with a byte scan after editing.
- Path prefix with a trailing separator: `Join-Path $dir ''` (PS 5.1 returns `D:\x\`); never `$dir + '\'` (reviewer blocks string appends).
- Organizer idempotency rules: one differing item per destination (newest wins), displace only when strictly newer (mtime), identical desktop duplicate goes to the state dir. Preview and the real run share `Get-DesktopPlacementDecision`. Undo sets `UndoneAt` only when no entry failed.
- In PowerShell `continue` inside `switch` applies to the switch, not the enclosing foreach; use if/elseif when a branch must skip the loop item.
- Piping a native `powershell.exe -File` child into `Select-Object -First N` stops the child early and reports exit 255; capture to a file instead.

---
name: win-strictmode-and-desktop-icons
description: GlobalVars.ps1 enables Set-StrictMode Latest for every dot-sourcing script; desktop organizer layout and pitfalls
type: project
---
- `GlobalVars.ps1` runs `Set-StrictMode -Version Latest`, so every script that dot-sources it (Step21, menus, DesktopIconManager) is strict. In PS 5.1 `$hash.MissingKey`, `$null.Count` and `'x'.Count` all throw; use `$hash['key']`, `.ContainsKey()` and `@(...).Count`.
- Desktop organizer: `win_common/DesktopIconManager.ps1` (`Invoke-DesktopIconOrganization`, `Undo-DesktopIconOrganization`, `-DesktopIconAction Organize|Preview|Undo`). Folders live at `$Global:LANG_COMPILER_DIR\.desktopIcons\<Category>`, linked on the desktop as directory symlinks named `<Category>.lnk`. Undo manifests go to `%LOCALAPPDATA%\core_node\desktop_icons\manifests`. The menu is dd.ps1 > Management & Backup > Windows Management.
- `Window Launcher.lnk` is recreated on the desktop by dd.ps1 (`pycore/pyutils/launcher/shortcut_check.ps1`); keep it pinned or the organizer churns.
- DesktopIconManager.ps1 stays ASCII: CJK keywords are `\uXXXX` escapes decoded at runtime. The Edit tool can turn `\uXXXX` in new_string into real characters, so re-check with a byte scan after editing.

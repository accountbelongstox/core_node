# DD Guide — Debian `dd.sh` + Windows `dd.ps1`

**RootDir** = `../` from this doc; every path is `$RootDir/`-relative. `dd.sh` is the Debian entry; `dd.cmd` → `scripts/shells/win/dd.ps1` is the Windows entry. Each declares its vars, shows a toggle menu, then runs dependency-ordered step scripts under `scripts/shells/{debian,win}/`. The two sides never cross-reference each other.

## Shared conventions
- Inter-script state flows ONLY through the file-backed store — bash `gvar_common.sh` `set_var`/`get_var`, PowerShell `GlobalVars.ps1` `Set-GlobalVar`/`Get-GlobalVar` (defaults supported); never via passed args.
- Each script self-locates its own dir, then walks up to `$RootDir`.
- Step scripts (`index_name.sh` / `Step{Index}_*.ps1`) are dependency-ordered and idempotent (restore/repair/install in one run); detect installs by binary existence (not command/winget output); PATH/env repair runs in its own branch.
- Add an env/app by registering it by type in the globals (bash `LGar.sh`; PowerShell `GlobalVars.ps1` `BasePackages`/`APPLICATIONS_PACKAGES`/`DEV_SOFTWARE_PACKAGES`) plus a new step.

## Debian (`dd.sh`)
- `LGar.sh` holds top-level constants, sourced first by every sub-script; `dd.sh` and `gvar_common.sh` source no third-party file (only invoke them) — prefer `LGar.sh` constants.
- Use `$USE_SUDO`, never raw `sudo`. Install to `$COMPILE_DIR/<pkg>` (copy out of `/root`); link binaries into `/usr/local/bin` (+x). Sources: web/apt/npm/pip.

## Windows (`dd.cmd` → `dd.ps1`)
- `dd.cmd` is local-first + remote-fallback: if `dd.ps1` is missing it downloads `WinScriptsInstaller.ps1`, which mirrors repo paths into `%USERPROFILE%\.core_node\`; runs `-NoProfile -ExecutionPolicy Bypass` and requires admin.
- Resolve absolute paths via `Split-Path`/`Join-Path`/`Resolve-Path`, never `..\..\`; set env/PATH globals after install. Install priority winget → choco → web. Scope from `Get-GlobalVar`: `SELECTED_REGION` (China = mirrors) and `INSTALL_TYPE` (base/server/full).

## Secrets & compliance
- Pre-`git push` secrets: AES-256, dual-password, namespace-isolated — raw in `.secrets/raw/` (gitignored), encrypted in `.secrets/encrypted_core_node/` (committed); passwords in memory only.
- On request, write yes/no/N-A compliance findings under `$RootDir/.compliance/`.

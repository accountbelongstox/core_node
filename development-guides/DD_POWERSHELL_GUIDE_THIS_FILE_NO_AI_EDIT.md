<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# DD PowerShell Guide (Windows)

**RootDir**: `../` relative to this doc; all paths based on `$RootDir/`.

## Two-layer launch
- `$RootDir/dd.cmd` is the entry only; logic lives in `scripts/shells/win/dd.ps1`.
- `dd.cmd`: local-first + remote-fallback. If local `dd.ps1` exists, run it; else download `main_powershells/WinScriptsInstaller.ps1` from the repo, which fetches deps to `%USERPROFILE%\.core_node\` (mirroring remote relative paths), then `dd.cmd` runs `dd.ps1`. Use `-NoProfile -ExecutionPolicy Bypass`; restore cwd and `endlocal`.
- `dd.ps1`: locate dir via `$PSScriptRoot`, derive `CORE_NODE_DIR`, process `apps/ncore/scripts` (e.g. encoding/line-ending fixes), load `EnvironmentDetection.ps1` (graceful if missing), show the up/down + left/right toggle menu, require admin.

## Common rules
- ASCII-only, all-English; never mix with Linux side (`scripts/shells/debian`); no cross-referencing sh/ps1.
- No test code/commands, no AI summaries. Each script self-locates then walks up to `$RootDir`; declare vars at top.
- Per project rule 6: resolve absolute paths via `Split-Path`/`Join-Path`/`Resolve-Path`, never `..\..\`.

## Installer scripts (`install_powershells/Step{Index}_*.ps1`)
- Order by dependency (node before yarn). Each sources `win_common/GlobalVars.ps1`, `CommanFunc.ps1`, `WindowsPathFunction.ps1`, and sets a script Index used as a print prefix.
- `GlobalVars.ps1`: global vars + `Set-GlobalVar`/`Get-GlobalVar` (file-backed exchange, supports defaults). `CommanFunc.ps1`: shortcuts/download/extract/print/winget. `WindowsPathFunction.ps1`: PATH/env (e.g. JAVA_HOME) — set globals after install.
- Idempotent restore/repair/install; detect by binary existence (not winget/npm). Repair PATH/env in an independent branch. Install priority: Winget (via CommanFunc) → choco → web download/extract → official docs.
- `DevInstaller.ps1`/`TestInstaller.ps1` share the single hardcoded list `main_powershells/InstallerScriptsList.ps1`; install runs steps in order, test matches a step by entered index.

## Adding an env/app deploy script
- Register by type in `GlobalVars.ps1`: env (multi-version list), `$Global:BasePackages` (installed via `Step{Index}_InstallBasePackages.ps1`), `$Global:APPLICATIONS_PACKAGES` (essential apps), `$Global:DEV_SOFTWARE_PACKAGES` (optional dev tools).
- Pick a dependency-correct `Step{Index}`; extend item metadata (install type/PATH/env). Use `Get-GlobalVar` for `SELECTED_REGION` (China sets mirrors/sources; Global default) and `INSTALL_TYPE` (base/server/full) — do not rely on passed args. Link mainstream envs into `EnvironmentDetection.ps1`. Read referenced files before editing.

## App deployment pipeline (`Step12_InstallApplications.ps1`)
- Reads `ApplicationsList.ps1` (per-package metadata: install type winget/choco/pip/npm/pipx/uv, PackageId, exe path, env, AdditionalInstallationPackages, PostInstallCallbacks). Calls `PackageManagerInvokes.ps1` (check→install→verify→return exe), installs extra deps, runs `PostInstallCallbackProcessor.ps1` (copy/rename/delete/configurator/registry_template/mcp, region-aware), sets env via `WindowsPathFunction.ps1`.

## Secrets & compliance
- Pre-`git push` encryption (AES-256, dual-password, namespace-isolated): raw secrets in `.secrets/raw/` (gitignored), encrypted in `.secrets/encrypted_core_node/` (committed); passwords in memory only. `dd.ps1` and `GlobalVars.ps1` implement this independently.
- On request, write yes/no/N-A findings to `$ProjectRootDir\.compliance\DD_POWERSHELL_COMPLIANCE_REPORT.md`.

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

# DD Shell Guide (Debian)

**RootDir**: `../` relative to this doc; all paths are based on `$RootDir/`.
`dd.sh` is the unified Debian entry for dev-environment management, app deployment, and system config.

## Layout
- `dd.sh` — main script: variable declarations + interactive menu that calls scripts under `scripts/shells/`.
- `scripts/shells/LGar.sh` — top-level global vars/constants; sourced first by every sub-script.
- `scripts/shells/common/` — `gvar_common.sh` (variable exchange), `selector_common.sh` (menu selector), `common_functions.sh` (shared funcs, suffix `_from_common_functions`).
- `scripts/shells/debian/` — `install.sh` + `install_shells/` (step scripts) + `run_apps/run_app.sh`.
- `scripts/shells/win/` — Windows side; see DD_POWERSHELL_GUIDE.

## Core rules
1. ASCII only, all-English code; variable names UPPERCASE.
2. Inter-script variables exchange only via `gvar_common.sh` `set_var $key $val` / `get_var $key` (file-backed in user dir).
3. `dd.sh` sources no third-party file (only invokes them); `gvar_common.sh` sources nothing. Third-party scripts prefer constants from `LGar.sh`.
4. Use `$USE_SUDO` (from `gvar_common.sh`) instead of raw `sudo`.
5. No test scripts/commands, no unsolicited docs (e.g. README.md).
6. Each sub-script resolves its own dir (`BASH_SOURCE` → parent levels) to locate `$RootDir`; declare all vars at file top.

## Menu selector (`selector_common.sh`)
- Optional `mode` preloads defaults (e.g. `server` enables MySQL); existing `get_var` values override presets.
- Left/right toggles a menu item's value; Enter saves via `set_var` and proceeds to `install_shells`.

## `install_shells` step scripts
- Name as `index_scriptname.sh`; order by dependency (e.g. node before npm). Set `$SCRIPT_INDEX` as a print prefix.
- Idempotent: re-runnable to restore/repair/install; symlink-refresh runs in its own branch regardless of install need.
- Recommended elements: command vars (e.g. 7z), install source (web/apt/npm/pip/...), environment verification (resolve real bin dir when not on PATH), link all binaries to `/usr/local/bin` with `+x`, loop over a list for multi-version reuse.
- Default install target: `$COMPILE_DIR/<package>` (from `LGar.sh`); copy out of `/root` to avoid permission issues. Detect by binary existence, not command output; optionally print copy-pastable usage at the end.

## Compliance report
On request, check `dd.sh` and all called scripts against the above and write yes/no/N-A findings to `$RootDir/.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md`.

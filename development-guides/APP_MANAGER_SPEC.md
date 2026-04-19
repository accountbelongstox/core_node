# Unified App Manager – Specification

## App types and scan paths

| Type        | Directory   | Description |
|------------|-------------|-------------|
| **ncoreApp**  | `./apps`      | Node/ncore apps (main.js app=name). |
| **pycoreApp** | `./pyapps`    | Python/pycore apps (main.py in pyapps/name). |
| **polyApp**   | `./poly_apps` | Poly-apps (React, Vue, Nuxt, Laravel, Flutter, etc.). |

Scan order in code must match types by path: **poly_apps** and **pyapps** must be classified before **apps** (e.g. in shell `case` match *poly_apps then *pyapps then *apps) so that `poly_apps` is not misclassified as ncoreApp.

## Active column and toggle

- **Active** column: per-row value **start** (default) or **安装到服务**.
- **Left/Right** on the **selected row** toggles Active: Left → start, Right → 安装到服务.
- **Enter**: If Active is **start**: launch the app (see Launch rules). If Active is **安装到服务**: install the app as a system service (see Install as service).

## Launch rules (no script for ncore/pycore; poly uses start script)

- **ncoreApp**: No wrapper script. Run from **repo root**. Command: `node ./main.js app=${appname}`. Require `main.js` at repo root; else show hint.
- **pycoreApp**: No wrapper script. Run from **repo root**. Command: `python ./pyapps/${appname}/main.py` (Linux: `python3`). Require `pyapps/${appname}/main.py`; else show hint.
- **polyApp**: Run `./poly_apps/${appname}/scripts/start.sh` (Linux) or `.\scripts\start.ps1` (Windows). **Port**: pass to start script (e.g. `start.sh Port`). Require script exists; else show hint. Poly apps must implement the script.

## Install as service

- **Linux**: Use `scripts/shells/linux/common/debian_service_manager.sh`. Call `create_systemd_service(service_name, description, exec_command, working_dir, ...)`. ncoreApp: `node ./main.js app=name`, cwd=root. pycoreApp: `python3 ./pyapps/name/main.py`, cwd=root. polyApp: `bash ./scripts/start.sh ${port}`, cwd=`poly_apps/name`; pass Port to start.sh.
- **Windows**: Same semantics. Use NSSM when available; service name e.g. `app-manager-${appname}`. Poly: run start.ps1 with Port (e.g. env PORT).

Windows implementation must match: Active column, Left/Right toggle, same launch rules, same install-as-service behavior.

## UI behavior (Linux and Windows must match)

- **Up/Down**: Move selection (highlighted row with `>`). No “Enter app number” prompt.
- **Left/Right**: On selected row, toggle Active between **start** and **安装到服务**.
- **Enter**: Launch the selected app (if Active = start) or install as service (if Active = 安装到服务). Last selected index is saved.
- **R**: Rescan applications (reload list from disk). After rescan, restore last selected index and clamp to new list length.
- **Q**: Quit. Save last selected index before exit.

No numeric input: selection is by arrow keys only; launch/install by Enter.

## Persist last selection

- **State file**: `$ROOT_DIR/.app_manager_last_index` (Linux), `$RootDir\.app_manager_last_index` (Windows).
- **Content**: Single line with the 0-based index of the last selected app.
- **When to save**: On Up/Down (after changing selection), on Enter (before launch/install), and on Q (before exit).
- **When to load**: After each scan; clamp index to `[0, count-1]` (if list shrunk or state invalid).

## Implementation locations

- **Linux**: `scripts/app_manager/linux_sh/app_manager.sh` and `core/app_scanner.sh`. Service: `scripts/shells/linux/common/debian_service_manager.sh`.
- **Windows**: `scripts/app_manager/windows_ps1/app_manager.ps1`; scanner uses explicit dir→type mapping. Service: NSSM or equivalent; same launch/install rules.

Windows must implement the same UI (arrow keys, Left/Right for Active, Enter to launch or install, R/Q), the same state file path and save/load semantics, the same launch rules per app type, and the same install-as-service behavior (with Port passed for poly start scripts).

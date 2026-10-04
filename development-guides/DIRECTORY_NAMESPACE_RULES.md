# Directory namespace rules (Windows and Linux; user D30, 2026-09-27)

Every directory the project's scripts or programs create lives under **one namespace directory per drive or filesystem**. Do not scatter top-level directories across a drive.
- The namespace names and roots are defined once, in `config/service_contract.json#paths.drive_layout.namespaces`.
- Scripts read them from the contract, through the constants library on Linux (`LINUX_SHELL_RULES.md` §1) or `SharedCacheEnv.ps1` on Windows. They never write a literal.

## 1. The namespaces

| Where | Namespace root | What goes under it |
|---|---|---|
| Windows program drive E: (when it qualifies) | `E:\_<sys>_dev\` (e.g. `E:\_win10_dev`) and `E:\applications\` | tool installs directly under `_<sys>_dev\`, plus `trees\<ns>\` (junction targets for node_modules/vendor/.venv, D28) and `cache\` (package caches); installed apps under `applications\` |
| Windows data drive D: | `D:\www\` | the shared data dir `D:\www\core_node\` (backups, logs, runtime data), web runtimes such as `D:\www\frankenphp\`, and everything else a script creates on D: |
| Linux ext4 | `/opt/core_node/` | `_<os>_<ver>/` (tool installs), `trees/<ns>/` (per-project heavy dirs), `cache/` (package caches) |
| Linux NTFS share (`/www` = D:) | `/www/www/` for shared data (= `D:\www\`); `/www/core_node_compiler/` only as the empty mount point of the ext4 trees bind (`trees` below it) | nothing else. Code stays where the user keeps it |

- Source code checkouts (e.g. `D:\programing\core_node` = `/www/programing/core_node`) are user-managed. They are not created by scripts and are outside this rule.
- On the D: fallback, when no E: drive exists, tools stay in the legacy `D:\.dev_<sys>`, apps in `D:\applications`, caches in `D:\www\cache`, and `trees` is not used (D28: normal in-repo dirs).

## 2. Rules
- Create a directory only below a namespace root. Create the namespace root itself idempotently, with one helper per OS.
- Never create a new top-level directory on any drive, or under `/opt` or `/www`, except the namespace roots above.
- Existing top-level directories that earlier scripts created are legacy (for example `D:\.dev_win10`, `/www/_debian_12`, `/www/_debian_13`, `.dev_debian13`, `.dev_linux`).
  - They are listed in the audit record and left in place.
  - Moving them into a namespace is a migration step that needs the user's explicit approval. Scripts keep reading them until the migration is done.
  - Approved (2026-10-03), so D: holds shared data only (contract `paths.drive_layout.legacy_program_dirs`):
    - `D:\.dev_<sys>` -> `E:\_<sys>_dev`, `D:\applications` -> `E:\applications`, `D:\.tmp\Downloads` -> `E:\_<sys>_dev\Downloads`, `D:\.pnpm-store` -> `E:\_<sys>_dev\cache\pnpm-store`. `D:\.tmp` stays (shared temp). Package caches point at `E:\_<sys>_dev\cache`.
    - Step 1, migration branch only (a fresh install has no old dir): copy every entry with `Copy-Item` (in-use files still copy) and verify every file; any failure stops the move and nothing is deleted.
    - Switch: re-root PATH and every environment variable (`WindowsPathFunction.ps1 moveroot`), E: text files, pip/uv launcher .exe files, shortcuts, scheduled tasks and registry (`SystemReferenceRelocation.ps1`), then `scoop reset *`.
    - Delete the D: entries file by file (locked files stay until the next run); data entries matching `keep_patterns` (models, drafts) move to `D:\www\program_data\<target dir name>`; the old dir is removed once empty. No link is left at an old path.
    - Step 1 records the live dirs in the var-center keys `LANG_COMPILER_DIR`, `APP_INSTALL_DIR` and `DOWNLOADS_DIR` (`windows_resolved_vars`); pycore and Laravel read them. Without E:, programs stay on D: and dd shows a warning.
- Everything in `LINUX_SHELL_RULES.md` still applies: NTFS holds code and shared data only, and there is no recycle bin on NTFS.

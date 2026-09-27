# Directory namespace rules (Windows and Linux; user D30, 2026-09-27)

Every directory the project's scripts or programs create lives under **one namespace directory per drive or filesystem**. Do not scatter top-level directories across a drive.
- The namespace names and roots are defined once, in `config/service_contract.json#paths.drive_layout.namespaces`.
- Scripts read them from the contract, through the constants library on Linux (`LINUX_SHELL_RULES.md` §1) or `SharedCacheEnv.ps1` on Windows. They never write a literal.

## 1. The namespaces

| Where | Namespace root | What goes under it |
|---|---|---|
| Windows program drive E: (when it qualifies) | `E:\core_node_compiler\` | `.dev_<sys>\` (tool installs), `trees\<ns>\` (junction targets for node_modules/vendor/.venv, D28), `cache\` (package caches) |
| Windows data drive D: | `D:\www\` | the shared data dir `D:\www\core_node\` (backups, logs, runtime data), web runtimes such as `D:\www\frankenphp\`, and everything else a script creates on D: |
| Linux ext4 | `/opt/core_node/` | `_<os>_<ver>/` (tool installs), `trees/<ns>/` (per-project heavy dirs), `cache/` (package caches) |
| Linux NTFS share (`/www` = D:) | `/www/www/` for shared data (= `D:\www\`); `/www/core_node_compiler/` only as the empty mount point of the ext4 trees bind (`trees` below it) | nothing else. Code stays where the user keeps it |

- Source code checkouts (e.g. `D:\programing\core_node` = `/www/programing/core_node`) are user-managed. They are not created by scripts and are outside this rule.
- On the D: fallback, when no E: drive exists, tools and caches go under the D: namespace (`D:\www\.dev_<sys>`, `D:\www\cache`) and `trees` is not used (D28: normal in-repo dirs).

## 2. Rules
- Create a directory only below a namespace root. Create the namespace root itself idempotently, with one helper per OS.
- Never create a new top-level directory on any drive, or under `/opt` or `/www`, except the namespace roots above.
- Existing top-level directories that earlier scripts created are legacy (for example `D:\.dev_win10`, `/www/_debian_12`, `/www/_debian_13`, `.dev_debian13`, `.dev_linux`).
  - They are listed in the audit record and left in place.
  - Moving them into a namespace is a migration step that needs the user's explicit approval. Scripts keep reading them until the migration is done.
- Everything in `LINUX_SHELL_RULES.md` still applies: NTFS holds code and shared data only, and there is no recycle bin on NTFS.

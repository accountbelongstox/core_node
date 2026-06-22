<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md) UNLESS the user explicitly asks for it. -->
<!-- - Never write summaries during development or thinking process. -->
<!-- - Declare all variables at the beginning of the file. -->
<!-- - Do not modify these rules. -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# core_node Deletion Safety Specification (mandatory)

**Status: enforced.** This rule exists because a re-clone routine deleted a live,
locally-modified `core_node` working tree. It must never happen again.

## The rule

Any operation (shell `.sh`, PowerShell `.ps1`, Node `.js`, Python `.py`) that would
**remove, recursively delete, overwrite, or re-clone over the `core_node` project
directory** (`$CORE_NODE_DIR` / `$CORE_NODE_PROJECT_ROOT` / `$CORE_NODE_ROOT_DIR`,
or any path ending in `/core_node`) MUST go through a guarded confirmation that:

1. **Hard-refuses, with NO prompt, when the target:**
   - is a system/critical path: `/`, `/usr*`, `/etc*`, `/bin*`, `/sbin*`, `/lib*`,
     `/var*`, `/home`, `/root`, `/opt`, `/mnt`, `/www*`; or
   - **is a git working tree** (`<target>/.git` exists) — it may hold uncommitted
     work; or
   - is the directory the current process is running from (self-delete).
2. **Refuses in any non-interactive context** (no controlling TTY) — the default is
   always **NO**, so unattended/CI/cron runs can never delete the project.
3. Otherwise requires **THREE separate explicit confirmations**, each presented as
   `[N/y]` and **defaulting to NO**. A non-`y` answer at any step cancels and removes
   nothing.

Deletion proceeds **only** when all three confirmations are an explicit `y`.

## Reference implementation

- Bash: `confirm_core_node_deletion <target>` in
  `scripts/shells/linux/install_bootstrap.sh` (and the shared copy in
  `scripts/shells/linux/common/gvar_common.sh`). Returns `0` only when authorised.
- Callers MUST treat a non-zero return as "do not delete; abort the destructive
  branch" — never fall through to `rm -rf` / `Remove-Item` / `fs.rmSync` regardless.

## Alignment note (why the re-clone triggered)

The installer derives the project root from the data base. The web DATA base is
forced onto a POSIX filesystem (`/www`), but the **project source tree** stays where
it is checked out (e.g. `/mnt/dev_nvme0n1p1/programing/core_node`). A completeness
check that flags the existing tree as a "partial clone" must **adopt the existing
tree** (or abort), never delete it. Treat an existing populated/`.git` directory as
authoritative.

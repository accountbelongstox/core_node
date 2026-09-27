---
name: shell-windows-review-checklist
description: Recurring defects and verification steps when reviewing shell-windows (PowerShell, dd.ps1, desktop organizer) tasks, including file-moving tools with undo manifests
metadata:
  type: project
---

Checks that paid off on shell-windows tasks (first seen on shell-windows-2, 2026-09-27):

- **Undo or state markers written unconditionally.** Look for "done/undone" flags set after a loop regardless of per-entry errors. Once set, retries are blocked, and "newest not yet undone" logic jumps to an older run out of order. Require the flag only when errors are 0, and check that per-entry replay is idempotent so a rerun is safe.
- **String append to build paths.** Grep added lines for `+ '\'` or `"...$var\..."`. AGENTS.md forbids it. `Join-Path $dir ''` gives a trailing-separator prefix on PS 5.1 (verified).
- **Copy-mode ping-pong.** When a tool copies instead of moving, check for two sources with the same name mapping to one destination. Each run then displaces the other copy, which breaks idempotency.
- **Verify "nothing deleted / second run moved nothing" read-only:**
  - read the manifest;
  - check that every destination exists and every source is gone;
  - count files per folder against the owner's "before" count;
  - check there is exactly one manifest and no displaced/ dir.
- **Shared files hold concurrent tasks' hunks** (e.g. the WindowsManagementManager Disk Repair hunk). Use mtimes against the role-file or task start time to attribute them, and review only this task's hunks.
- **Parity rows.** A pending-linux row needs an `[shell-linux] align` task. The owner only lists the request; the orchestrator must create the task, so flag it if none exists. Also check that "platform-only" rows do not hide behavior that Linux could share. Counterpart requests should name the existing Linux helpers to reuse (e.g. `desktop_shortcut_manager.sh` `_dsm_*`).
- **Parser check.** Only Windows PowerShell 5.1 is installed (no pwsh). Use `powershell.exe -NoProfile -Command` with `[System.Management.Automation.Language.Parser]::ParseFile`.
- **Preview vs real run.** Even when both call one decision function, preview decides followers against the pre-run state. Trace multi-item groups (copy-mode followers, followers of a "replace" winner) and implicit mkdir/link records; preview often mislabels them (seen in shell-windows-2 round 2, non-blocking).
- **mtime attribution in Git Bash.** `find -newermt "YYYY-MM-DD HH:MM:SS"` is read as UTC. Add `+1000`, or every file after 01:xx local shows as new. Directory mtimes of the desktops and category folders at or before the first run's time prove that later runs changed nothing.
- **Null-guard helpers with a Mandatory param** (shell-windows-10 D29):
  - `[Parameter(Mandatory)]$Object` rejects $null unless it has `[AllowNull()]`, so an `if ($null -eq $Object)` guard is dead code.
  - GlobalVars.ps1 sets EAP=Stop, so the binding error kills the script.
  - Owners' live runs cover only the happy path (daemon Running). Trace the stopped and logged-out inputs by hand.
- **A new common next to an older private copy.** Grep win_common for the same tool's exe path, detection and JSON parse (for example, FrankenPhpManager held its own Tailscale copies). Linux usually moves its copy into the common, so a Windows copy left behind is also a parity gap.
- **Per-column device and table parity.** Ledger rows list different field sets for each side and still say "aligned". Compare the printed columns, not the function names.
- **Align tasks** are listed in `.claude/agents_shared/client_key_auth/TASKS.md` (for example shell-linux-2 for D12a). Grep there before flagging "no align task".

- **Generator (FrankenPHP/Caddy) tasks: re-render without touching live state** (shell-windows-9, 2026-09-27).
  - Extract the generator functions from the file with the PowerShell AST (`FindAll FunctionDefinitionAst` + `. [scriptblock]::Create`).
  - Stub the contract readers (read config/service_contract.json directly), the LAN probe, and the certificate-material lookup; point every `$script:*` output path at the scratchpad.
  - Then run `frankenphp.exe validate --adapter caddyfile` with XDG_DATA_HOME/XDG_CONFIG_HOME in scratch. Run the same harness on `git show <base>:file` as a negative control.
  - `php.exe -m` with PHP_INI_SCAN_DIR set to the scratch conf.d checks the ini. Also combine it with any hand-made ini in the live conf.d: a duplicate `extension=` gives "Module already loaded".
- **LAN/production gating counterpart requests.** Linux gates on `domain_setup_detect_environment`/`DOMAIN_ENV_LAN_MODE`, not raw `net_env_detect`. That function honors `DOMAIN_SETUP_NET_MODE=server` and HAS_PUBLIC_IP (NAT-ed VPS). A request that says "reuse NET_ENV_IS_LAN" would regress production. Also check whether Linux already gates the main path (`fm_domain_install_all`) before accepting "identical gap".
- **Re-pass rounds: "the only new hunk is X" claims** (shell-windows-9 r2). Diff the prior-reviewed commit against HEAD. Other lanes' fix rounds often land in the same file, for example a merge commit bringing in the shell-windows-10 Tailscale dedup. Use AST function-text compare (scratchpad `ast_compare.ps1` pattern) to prove the reviewed functions are byte-identical before reusing old validate results.
- **Dot-sourcing a script that has a param block** (for example TailscaleCommon.ps1) leaks its parameter variables, together with their ValidateSet attributes, into the caller's scope, and that reaches every Step that dot-sources the manager. Grep callers for script-scope assignments to the same names (case-insensitive). Function-local ones are safe.
- **Live-file mtimes.** A live file newer than the task can come from a bulk rewrite. Compare with its siblings' mtimes (all of global_var had the same second) before blaming the owner.

**Why:** these were the defects the owner's own report missed, even though it claimed a sandbox undo test passed.
**How to apply:** use this list on every shell-windows review. See [[ui-review-patterns]] for per-hunk coverage in shared files.

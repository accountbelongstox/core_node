# D20 spec: `dd syncgit`, `dd help`, and the shared git-sync quick command

Owner of this spec: orchestrator. Implementers:
- shell-windows: Windows side, and the temporary writer of the cross-platform `scripts/git/*.py` and `scripts/git/git_remotes.conf` for D20;
- shell-linux: Linux side, in parity.

Verdicts: reviewer. The user's words (D20): "cd D:\programing\core_node ; git add . ; git commit -m "win0.0.1" ; git pull origin main ; git push origin main".

## 1. Behavior of `syncgit` (both OSes)
1. Change to the directory that holds `dd.sh` / `dd.cmd`: the repo root, resolved from the script's own location, never a hardcoded path.
2. Make sure `origin` is the **SSH GitHub** URL, never Gitee.
   - This is one idempotent line: compare, then `git remote set-url origin <github ssh url>` only when it differs.
   - The URL comes from the existing gitunified configuration (`scripts/git/git_remotes.conf`, read by `gitput_unified_modules/config.py` and the `.ps1`/`.sh` fronts). Add a key there only if no GitHub SSH entry exists; keep one definition.
   - Reuse the existing GitHub host/SSH helpers (`github_host_refresh.*`, `hosts_common.*`, the SSH key flow) instead of new code.
3. `git add .`
4. `git commit -m "<systemname><version>up<timestamp>"`:
   - `systemname`: `win` on Windows. On Linux, `<distro id><major>` from `/etc/os-release` (e.g. `debian13`, `ubuntu26`, `kali`).
   - `version`: the project's existing single version definition. Use a dd/core_node version constant if one exists (search dd.sh, dd.ps1 and the gitunified modules); otherwise the root `package.json` `version`. Record which one you used. Never add a second definition.
   - `timestamp`: `yyyyMMdd-HHmmss`, local time.
   - Example: `win1.0.0up20260927-171530`.
   - If there is nothing to commit, skip the commit and continue to pull/push.
5. `git pull origin main`. On a conflict or a failure, stop, print the conflicted paths and the next manual step, and do not push. Never auto-resolve and never force.
6. `git push origin main`.

## 2. Where it lives (reuse; one implementation per OS)
- One shared function per OS in the common libraries, e.g. `scripts/shells/win/win_common/GitSyncCommon.ps1` and `scripts/shells/linux/common/git_sync_common.sh`. Follow the existing naming style. If an existing gitunified common file (`gitput_sync_common.sh`, a win_common git helper) already does part of this, extend it rather than duplicate it.
- The quick command:
  - `syncgit` on PATH, in the same style as the existing winenvs/linuxenvs commands: `scripts/winenvs/syncgit.ps1` (plus a `.cmd` shim if the others have one) and `scripts/linuxenvs/syncgit.sh`;
  - the command calls the shared function;
  - `gitput_unified.ps1`/`.sh`/`.py` link to the same function, or call the same "ensure GitHub SSH origin" line, so there is one behavior.
- `dd`:
  - `dd.sh syncgit` and `dd.cmd syncgit` (via `scripts/shells/win/dd.ps1`) call the shared function and exit.
  - `dd.sh help`, `dd.cmd help` and `-h`/`--help` print every supported parameter (name, one-line purpose, example) from one table per OS and exit without running anything else.
  - Existing dd parameters keep working. Extend the argument dispatch minimally. "Refactor both ends" means one clean dispatch table per OS for the parameters, not a rewrite of dd.
- Parameters for testing: `syncgit --dry-run` prints every git command it would run (with the computed message and remote) and runs none.

## 3. Rules
- AGENTS.md and the shell guide: English, variables at the top, PowerShell paths via Split-Path/Join-Path/Resolve-Path, no string appends to variables, no version regex in PowerShell (read the version as data), idempotent, no exit codes as return values, no new tests.
- Parity (B11): SPW/SPL rows for every feature, with aligned or platform-only reasons (e.g. the systemname source).
- **Do not run git write commands** (add, commit, pull, push, remote set-url) in this task, even though the user's prompt has granted git for the session. Verify only with parsers, `bash -n`, `help`, and `syncgit --dry-run`. The user runs the real sync.
- Files that other workflows may be editing: `dd.sh` (the D7 lane for the dd.sh startup refactor). Keep your `dd.sh`/`dd.ps1` edits to the argument dispatch and help, and re-read before editing. The Edit tool refuses stale writes.
- Never re-add the stripped AI rules header block.

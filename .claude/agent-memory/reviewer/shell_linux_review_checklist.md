---
name: shell-linux-review-checklist
description: Recurring defects and read-only verification steps when reviewing shell-linux tasks (desktop_shortcut_manager.sh, organizer align, root multi-user runs, parity with Windows)
metadata:
  type: project
---

Checks that paid off on shell-linux-2 (D12a organizer align, 2026-09-27):

- **Root acting in user homes.** The owner's own rule: root never runs mv/cp/tee/chown/rm on paths inside another user's home. Grep every `$sudo rm|mv|cp|tee|chown` that touches `_dsm_desktop_dir`, `_dsm_filed_launchers` or `_dsm_org_*` paths. Fixes tend to cover create/edit and forget remove. `[ -f ]` follows a planted symlink.
- **Root detected by name.** Dispatch code of the form `[ "$user" = "root" ]` combined with runuser re-entry recurses for a second uid-0 account. Ask for a uid test.
- **Hand-rolled JSON parsers.** Undo that parses its own one-line manifest format must not mark UndoneAt when it parses 0 entries.
- **Keyword/constant tables copied from Windows.** Re-diff them read-only: awk-extract `AdditionalKeywords` from the ps1, map the DESKTOP_CATEGORY_* names through GlobalVars.ps1, then diff. Flag the duplication as an orchestrator follow-up (centralize), not as a blocker.
- **The library as a CLI.** Check the `BASH_SOURCE[0] = $0` guard, because about 10 installers source desktop_shortcut_manager.sh. Also check `set -e/-u` in the callers (none as of 2026-09-27).
- **dd.sh menus.** The 4th argument of `arrow_menu_select` is the back index; check that it moves when an item is inserted.
- **Line endings.** Use `tr -cd '\r' < f | wc -c`, not `grep -c $'\r'`. Git Bash grep -P fails in the C locale; use `LC_ALL=C grep -c '[^[:print:][:space:]]'` for non-ASCII.
- **Linux preview vs run.** Linux counts missing mkdir/link as changes, and followers of a placed destination as unchanged/conflict/duplicate. This is better than Windows; do not flag the difference against Linux.
- **Atomic-write swaps (mkstemp + os.replace).** Probe them as root against a file owned by uid 1000. The new inode belongs to the writer, so root:root 0600 locks the user out, where an in-place open('w') kept the owner. Probe a symlinked target as well, since replace breaks the link. Check that except clauses catch ValueError, because UnicodeDecodeError is not a JSONDecodeError. Found in orch-wf1 on 2026-09-28 in _json_sync_helper.py, which also had a whole-file CRLF→LF flip (HEAD CRLF .py). Then check the ownership fix itself: root `os.chown/os.chmod(tmp_path)` by path inside a user-owned dir follows a symlink the dir owner swaps in after mkstemp (local root escalation; not blocked by protected_symlinks outside sticky dirs). Prove it with an in-process monkeypatched os.fsync that renames the temp and plants a symlink to a scratch root-owned victim; ask for os.fchown/os.fchmod on the open fd. Found in orch-wf1b (both write_json_atomic copies), 2026-09-28; fixed with fd-based fchmod/fchown in round 2 (probe: victim unchanged).
- **Parity ledger tables.** GFM splits cells on `|` even inside backticks. Count cells per SPL row, splitting on unescaped `|`. SPL-109's pgrep regex broke its row (orch-wf1b, 2026-09-28).
- **tmux readiness probes that read scrollback.** `respawn-pane -k` clears the visible grid but keeps history, so old setup-screen text relabels the new process. Check for `clear-history` before the respawn; verify on a private `tmux -L revtest_$$` socket (kill-server after). Found and fixed in orch-wf1 launcher, 2026-09-28.
- **GNOME caveat.** Nautilus does not launch .desktop files inside folders. Flag filed launchers as "verify on a real GNOME desktop", not as a blocker.

**Why:** shell-linux-2 was approved, but these gaps were found only by tracing code the owner's sandbox did not cover (remove path, uid-0 aliases, reformatted manifests).
**How to apply:** use this list on every shell-linux review, and see [[shell-windows-review-checklist]] for the counterpart organizer checks.

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
- **GNOME caveat.** Nautilus does not launch .desktop files inside folders. Flag filed launchers as "verify on a real GNOME desktop", not as a blocker.

**Why:** shell-linux-2 was approved, but these gaps were found only by tracing code the owner's sandbox did not cover (remove path, uid-0 aliases, reformatted manifests).
**How to apply:** use this list on every shell-linux review, and see [[shell-windows-review-checklist]] for the counterpart organizer checks.

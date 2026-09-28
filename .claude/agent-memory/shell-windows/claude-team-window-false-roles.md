---
name: claude-team-window-false-roles
description: config/claude_team_roles.json schema_version 7 adds roles[].window (service roles with no window/session at start) and a top-level groups[]
metadata:
  type: project
---

`config/claude_team_roles.json` (orchestrator-owned, read-only to shell-windows) is `schema_version: 7` as of D22 (2026-09-27). Two additions relevant to the Windows launcher:

- `roles[].window: false` marks a service role (`reviewer`, `ncore`, `flutter` as of this writing) that is a valid, enabled row for messaging/task tags but must never be packed into a tab/pane or started automatically at launcher start (`role_source.catalog_roles_are` in the catalog spells this out: "no window/session at start"). It can still be started directly as its own session (`--team-pane ... --agent <role>`, or standalone `claudeteam --agent <role>`).
- A top-level `groups[]` array (team-group membership, leaders, `remote_members`) exists for the orchestrator's own bookkeeping. **The Windows shell never needs to read it separately**: `layout.tab_groups` is already grouped per team group (one sub-array per group), so it reflects the same membership `groups[]` describes. Record this as "aligned, no separate read" rather than adding a second read path.

**Why:** Before task shell-windows-G1, `Get-ClaudeTeamLayoutGroups`'s "roles missing from every listed tab_group get appended to the last group" fallback did not know about `window:false`, so `reviewer`/`ncore`/`flutter` were silently packed into a real pane/tab and given a live session — the opposite of what the catalog's own `window:false` intent describes. Fixed by filtering `Get-ClaudeTeamRoleWindowFlag -Role` out of both the grouped-membership check and the unlisted fallback inside `Get-ClaudeTeamLayoutGroups` itself (not just at the caller), and giving those roles their own non-packing rows (`Group = -1`, `Window = $false`, `State = "no-window"`) in `Import-ClaudeTeamCatalog`.

**How to apply:** Any future Windows-side catalog-reading code (packing, kickoff role lists, prerequisite checks) that iterates "every enabled role" should also gate on the row's `Window` field, the way `Start-ClaudeTeamRoles` and `Get-ClaudeTeamOtherRoles` now do — a `window:false` row is enabled but must never appear in a `wt` call or a "confirm the sessions" kickoff list. Parity ledger row: `SPW-036` (`.claude/agents_shared/shell_parity/windows.md`), left `pending-linux` as of 2026-09-27 because `scripts/shells/linux/common/claude_team_common.sh`'s `claude_team_load_catalog` python parser does not emit `roles[].window` yet and `claude_team_place_order` has the identical unconditional-append bug — check `linux.md` before assuming shell-linux has caught up.

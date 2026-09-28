---
name: history_under_old_role_names
description: Where to find pre-existing pycore-manager app work/reviews filed under earlier role names before the ui-pycore-manager role existed
metadata:
  type: reference
---

Work on `apps/pycore-manager/` predating the `ui-pycore-manager` role name is filed under two earlier role names — check both before assuming something is undone:

- `pycore-manager` (very early passes: i18n sweeps FU-004/018/024/025/026, stale-state/race fixes FU-011/036/037/040, K6/K7/K7a transport + RPC-access banner work). Report: `.claude/agents_shared/reports/pycore-manager.md`. Reviews: `.claude/agents_shared/reviews/pycore-manager-1.json` .. `-8.json` (all approved).
- `pycore-ui` (later pass, D7 delta commit `5bbb23682`: queue-center 'stopping' lifecycle, audio-lane full-sync rename, terminal integration timeout via relay contract, AppQyV1AiTools library-cover max_ids, relay `agent_history_config_changed` bridging). Review: `.claude/agents_shared/reviews/ui-pycore-manager-D7.json` (approved by pycore-lead; the pycore-ui role itself left no report file — the lead reconstructed the changed-file list from git).

**Why:** the role was renamed/split over time (`pycore-manager` → `pycore-ui` → `ui-pycore-manager`), so continuity of past decisions/rationale lives under those old filenames, not a single `ui-pycore-manager.md`.

**How to apply:** when picking up a task that touches an area with unclear history (e.g. "is X already i18n'd", "why does this helper exist"), grep these two files/review sets before assuming the code is unowned or undocumented. As of the D7 review (2026-09-27), it listed these as still open/unassigned for this app's scope: `MCHR-31` (started — presenter + `VocabLibrariesTab.tsx` adoption still missing), `PRAO-21`, `CKA-16`, `AHSC-33-ui`, `AHSC-34`, `AOQSD-06/25/28/30/37/43`, `LTCW-14`, `PRAO-03/11/18/20`, `CKA-15`, `p4-01` — treat this list as stale hearsay, not fact; re-derive from current code and the newest requirements doc in `docs_fix/` before acting on any of it, and check `TaskList`/`ca-orchestrator` first since task dispatch, not this list, is authoritative.

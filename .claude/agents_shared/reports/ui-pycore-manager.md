# ui-pycore-manager report (2026-09-28)

Session: ct-ui-pycore-manager (independent role session, cross-session messaging mode).

## Status

Startup sequence complete: read AGENTS.md / CLAUDE_CODE_AGENTS_GUIDE.md §1-7 (file has no literal "§8"; boundaries are in §5) / `poly_apps/pycore_laravel_wordnew_ui/README.md`; ran `ListAgents` (28 peer sessions found, `ca-orchestrator` present); sent readiness `SendMessage` to `ca-orchestrator` restating scope and shared-layer read-only default. `TaskList` is empty (no shared tasks queued). Working tree is clean under `apps/pycore-manager/` (no uncommitted work to resume).

**Reserve ruling (2026-09-28):** `ca-orchestrator` sent ruling R2 (`docs_fix/DESIGN_CLAUDE_TEAM.md`): `pycore-ui` is the post-D22 default writer for `apps/pycore-manager`; this session (`ui-pycore-manager`, pre-D22 alias) stays in reserve and edits only when a task explicitly names it as temporary writer. No task assigned — idle, waiting.

## Scope

Write: `poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager/` — terminal control, agent history panels, relay groups, audio orchestration views, delivery status panel, endpoint settings.
Read-only / needs temporary-writer grant: shared UI layer (`shell/ core/ shared/ components/ src/ services/ utils/ hooks/ contexts/ config/ styles/ themes/ resources/ public/ scripts/` and root build/config). Other `apps/`. Backends (`laravel`, `pycore`) via centralized endpoint modules only.

## Prior history (context, not this session's work)

Earlier role names `pycore-manager` (see `.claude/agents_shared/reports/pycore-manager.md`) and `pycore-ui` (D7 review `.claude/agents_shared/reviews/ui-pycore-manager-D7.json`, verdict approved) covered this same app. D7 review notes several items still open and unassigned as of its writing: `MCHR-31` (started, presenter + `VocabLibrariesTab.tsx` adoption not done), `PRAO-21`, `CKA-16`, `AHSC-33-ui`, `AHSC-34`, `AOQSD-06/25/28/30/37/43`, `LTCW-14`, `PRAO-03/11/18/20`, `CKA-15`, `p4-01`. These are not confirmed as still valid/current — derive from current code and the newest requirements doc if/when assigned, per the "docs_fix drifts" rule.

## Next

Idle, waiting for task dispatch from `ca-orchestrator`. Will claim tasks via cross-session messaging, implement in scope, message the reviewer with changed files, and update this report before going idle again.

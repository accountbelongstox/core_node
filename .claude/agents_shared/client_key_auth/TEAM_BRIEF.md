# Team brief: client key authentication and audit fixes (2026-09-27)

Lead: the orchestrator (the team lead session). User directive, verbatim, is in the requirements doc §1 (D1).

## Read first (binding)
1. `docs_fix/DESIGN_AUTH_IDENTITY.md` (K1–K7), §5 (surface → authentication), §6 (dispatch, shared-layer writers).
2. Contract: `config/service_contract.json#client_key_auth`. Read every value from it; never re-declare header names, key names, skew, TTL or error codes.
3. Test vectors: `.claude/agents_shared/client_key_auth/test_vectors.json`. They use a test-only key. Any signer or verifier you write must reproduce these signatures exactly. A one-off check in your scratchpad is fine; do not add test files.
4. Findings: `docs_fix/DESIGN_AUTH_IDENTITY.md` (§3 themes, §4.0 owners, §4 tables, §5 contract findings). Full evidence per finding is in `docs_fix/bug_audit_20260927/<audit-role>.md`: pycore-runtime, audio-tts, laravel-backend, frontend-ui, infra-shell, ncore, reviewer_contract.
5. Laravel route table, when published: `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.

## Rules
- Re-read the current code before each fix. Other sessions edited files after the audit. If a finding no longer holds or is wrong, change nothing and record it as `refuted` with a reason in your report.
- Write only inside your role's scope (guide §8). Anything else goes to the owner: message the orchestrator (or the owning teammate by name) with the path and the needed change.
- `config/*_contract.json` and `config/service_contract.json` change only through the orchestrator.
- No tests, builds, service starts or installs; the user did not ask. Static checks that write nothing are allowed: `php -l`, `node --check`, `bash -n`, a Python `ast.parse`, and a PowerShell parser check.
- git: read-only forms only.
- AGENTS.md: English code and logs, i18n for every user-visible string, variables at the file top, reuse and centralize (no duplicate implementations), no docs in code.
- The client key value is never printed, logged, stored in browser/extension storage, or passed on a command line.
- Machine callers never switch to web login. Human operator surfaces use `dashboard.auth`/Sanctum (requirements §5).

## Order
Critical → high → medium → low.
- Rule-category sweeps over 100 sites (NC-036, IS-022, LB-034): do these last. Do the behavior-relevant sites named in the finding first, then the rest if time allows. Record any remainder with a count.

## Tasks, review, report
- Create your tasks in the shared task list with subjects `[<your role>] <subject>`. Group them by theme, about 3–6 tasks, and list the finding IDs in each description.
- When a task is done, message `reviewer` with:
  - the task id;
  - the finding IDs;
  - the changed files;
  - the static checks you ran.

  The task completes only after `.claude/agents_shared/reviews/<task_id>.json` has `"verdict": "approved"`. On `changes_requested`, fix it and resubmit.
- Before going idle, keep `.claude/agents_shared/reports/<your role>.md` current with:
  - task ids;
  - each finding ID as fixed / refuted / deferred, with a reason;
  - changed files;
  - blockers;
  - the next owner.
- Message the orchestrator when your queue is empty or you are blocked.

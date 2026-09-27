# codemart-laravel handoff (D22, 2026-09-27)

## laravel-codemart-D7-fix

Fixes the three blocking issues of the laravel-codemart-D7 verdict (`.claude/agents_shared/reviews/laravel-codemart-D7.json`). Diff base 74e7770; the D7 work itself is already in HEAD, so `git diff` shows only this task.

### Items

| Item | Status | Files |
|---|---|---|
| laravel-codemart-D7-B1 | done | `CodeMartV1Utils/CodeMartV1DemoSeeder.php`, docblocks in `CodeMartV1Utils/CodeMartV1AdminPassword.php`, `CodeMartV1Commands/CodeMartV1AdminPasswordCommand.php`, `CodeMartV1Utils/CodeMartV1Initializer.php` |
| laravel-codemart-D7-B2 | done | `CodeMartV1Utils/CodeMartV1DemoSeeder.php` |
| laravel-codemart-D7-B3 | done | `CodeMartV1Gvar/CodeMartV1Constants.php`, `CodeMartV1Utils/CodeMartV1Initializer.php` |

All paths are under `poly_apps/laravel_main/app/Apps/CodeMartV1/`.

- **B1:** `seed()` now calls `CodeMartV1AdminPassword::apply($secret['password'])` right after `seedAccounts()` when `$secret['generated']` is true. It reuses the command's applier (locked and idempotent). When the file already exists, nothing changes: the seeder never rehashes, and only `codemart:admin-password` rotates. The docblocks that said "never rehashes" / "the only rotator" now describe the generated-file exception.
- **B2:** the seeder no longer logs `codemart.cli.seed.password_generated` with the plaintext. When it generates the file, it logs only `codemart.cli.seed.password_file` (the path). The password stays in the returned summary, which the initializer step message and `sys:codemartinit` print to the console.
- **B3:**
  - Added `SUBMISSION_TERMINAL_STATUSES` [approved, needs_revision, rejected] and `ANALYSIS_TERMINAL_STATUSES` [completed, failed] next to the other `*_TERMINAL_STATUSES`, and exposed them as `terminal_states.submission` / `terminal_states.analysis`.
  - Added `getAllSubmissionStatuses()` [pending, pending_review, approved, needs_revision, rejected]. It is now the single source for `states.submission` (which gains `pending`) and for the Initializer's submission check constraint, which used to be a duplicated literal list with the same values in the same order.
  - Also took the non-blocking note on the same lines: the terminal_states comment now reads "closed states (no further work; archiving may still follow)".

### Verification

- Free RAM: 2.95 GB at the start, so edits and static checks came first. It was 6.11 GB before the in-process runs.
- `php -l`: no syntax errors in the 5 changed files. All are LF with no BOM, as in HEAD. No AI rules header was re-added.
- In-process probe (`scratchpad/d7fix_probe.php`):
  - Setup: rolled back on the default (users) connection and the CodeMart connection. The secret file was a missing scratch path, the `local` disk root was redirected to scratch, and the seeder log callback was wired exactly like the Initializer's (`Log::info`), with messages captured through `MessageLogged`.
  - Baseline: 7 accounts, 7/7 accept the removed literal, secret file missing.
  - Seed 1: generated=true, 24 chars, summary carries the password, 7 hashes changed. **7/7 accept the generated password, 0/7 accept the removed literal.** Logs: 3 messages, **0 containing the password**, 1 containing the path. The Initializer step message still carries the password (console only).
  - Seed 2 (same file): generated=false, same password, **0 hashes changed**, 7/7 accept, 0 log messages with the password. A later `apply()` returns 7 unchanged.
  - Vocabulary:
    - `states.submission` = [pending, pending_review, approved, needs_revision, rejected].
    - `terminal_states.submission` = [approved, needs_revision, rejected]. Its non-terminal remainder [pending, pending_review] equals `SUBMISSION_REVIEWABLE_STATUSES` (CmSubmissionsPanel.tsx:15).
    - `terminal_states.analysis` = [completed, failed]. Its non-terminal remainder [pending, processing, revising] equals CmProjectAnalysisPanel.tsx:13 `ACTIVE_ANALYSIS_STATUSES`.
  - In-process `GET /api/codemart/v1/bootstrap` with a Sanctum token created inside the transaction: 200, and the served vocabulary equals `contractVocabulary()`, including both new terminal groups and the new `states.submission`.
  - After rollback: hashes restored, 0 probe tokens, and the scratch dir (secret file and disk root) deleted.
- `alignStatusConstraints()` (`scratchpad/d7fix_align.php`, rolled back): "Aligned 5 check constraints" with **0 ALTER statements**. The centralized submission list leaves the live constraint untouched.
- The workers were restarted: `POST http://localhost:2019/frankenphp/workers/restart` returned 200. Afterwards `/api/health` and `/api/codemart/v1/public/home` on :9000 both return 200.

### Decisions taken without asking

- The path message (`password_file`) is logged only when the file is generated, as the previous message was. The Initializer step message already reports the path in the existing-file case.
- `getAllSubmissionStatuses()` was added under AGENTS.md "centralize constants", so the vocabulary and the check constraint can no longer drift. Values and order are unchanged, so there is no schema effect (0 DDL verified).
- `SUBMISSION_TERMINAL_STATUSES` is declared on its own and does not alias `REVIEW_RECOMMENDATIONS`, which holds the same values with a different meaning.

### Deferrals

None for these three items. The remaining D7 scope (the CKA-28 literal sweep, cmgap-R1, cmgap-U30, CMDES-08, cmcont-11) and the verdict's other non-blocking notes stay open for codemart-laravel-G1:
- the AdminPassword RuntimeException literals;
- `writePrivateFile` reuse;
- `accept_idempotency_key`.

### Cross-scope notes

- ui-codemart (codemart-ui), cmdesign-03: it can now derive its local sets from `vocabulary.terminal_states.{submission,analysis}` and drop `CmSubmissionsPanel.tsx:15` and `CmProjectAnalysisPanel.tsx:13`. It should also note that `states.submission` now includes `pending`.
- pycore-laravel (unchanged, from the verdict):
  - `app/Console/Commands/CodeMartV1SeedDemoData.php:18-19` prints hardcoded English (USER175-07).
  - The `routes/web.php` system/init group has no `dashboard.auth`, while the step message carries the generated password on a first run.
- laravel-remote: the server twin needs this code through CodeSync. On a server whose secret file already exists (Step175 rotates it), behaviour is unchanged.

### Blockers

None.

### Next owner

codemart-lead: review and write the verdict for `laravel-codemart-D7-fix`.

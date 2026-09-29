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

## codemart-laravel-G1

Items: srv-05, CKA-28, cmdesign-03-api, cmgap-U30. Diff base 74e7770. The D7-fix state is commit 4ddb4be8e. The pre-outage part of G1 is in the user's snapshot commits 0b6f362e3 and 7a23f57d0. This session's part was also captured by the snapshots 6ecff3401 and 7bed0a953 while I worked, so `git diff HEAD` is empty. Review with `git diff 4ddb4be8e -- poly_apps/laravel_main/app/Apps/CodeMartV1 poly_apps/laravel_main/lang/{en,zh_CN}/codemart.php`: 31 files, +542/-214.

All paths below are under `poly_apps/laravel_main/`. Every file is LF with no BOM and starts with `<?php`. No AI rules header was re-added, no tests were touched, and no contract file was changed.

### Items

| Item | Status | Files |
|---|---|---|
| srv-05 | done | `CodeMartV1Utils/{CodeMartV1AdminPassword,CodeMartV1DemoSeeder,CodeMartV1Initializer}.php`, `CodeMartV1Commands/CodeMartV1AdminPasswordCommand.php` (unchanged in G1), `lang/{en,zh_CN}/codemart.php` |
| CKA-28 | done | the 15 listed files, plus the sweep files named below, plus `lang/{en,zh_CN}/codemart.php` |
| cmdesign-03-api | done | `CodeMartV1Gvar/CodeMartV1Constants.php`, plus the 3 validator lines named below. `CodeMartV1BootstrapService.php` needed no change: it serves `contractVocabulary()` as is. |
| cmgap-U30 | done | `CodeMartV1Ctl/CodeMartV1AIAnalysisCtl.php`, `CodeMartV1Models/CodeMartV1AIAnalysisModel.php` |

#### srv-05

The D7 findings were already fixed and approved in laravel-codemart-D7-fix; G1 re-verified them:
- (a) `DemoSeeder.php:757-762`: `ensure()`, then `seedAccounts()`, then `CodeMartV1AdminPassword::apply()` only when the file was generated. An existing file never rehashes anything, and the command stays the only rotator.
- (b) The seeder logs only `codemart.cli.seed.password_file` (the path). The password stays in the returned summary and in the Initializer step message (`Initializer.php:562-564`).

CLI texts:
- The AdminPassword RuntimeExceptions now use `codemart.cli.admin_password.{contract_incomplete,file_write_failed}`.
- The seeder warnings use `codemart.cli.seed.{accounts,step_failed}`.
- The Initializer step descriptions and step messages use `codemart.cli.init.*`.

Unchanged: the contract file, the mode, the length (24) and the alphabet.

#### CKA-28

- The listed literals are all behind codemart lang keys: AIAnalysisCtl, ArchitectCtl, ProjectCtl, ReviewerCtl, TaskCtl, TaskMarketplaceCtl, and the Initializer CLI texts.
- Every English message passed to `CodeMartV1FinanceException` (PaymentCtl, EscrowService, AdminFinanceService, FinanceService, DemoSeeder) is behind a key, as is every `codedError` fallback (`codemart.errors.request_failed`).
- The wallet-transactions API returns `description_code` and `description_params`. `WalletTransactionModel::description()` translates coded rows and keeps the stored text for legacy rows.
- Sweep extension, decided without asking (see Decisions). These English messages also reached responses, so they now use keys too:
  - `CodeMartV1Controllers/CodeMartV1AdminCtl.php`: 11 success messages and the validation message;
  - `CodeMartV1Controllers/CodeMartV1AdminFinanceCtl.php`: 9 success messages;
  - `CodeMartV1Controllers/{CodeMartV1BootstrapCtl,CodeMartV1ProfileCtl,CodeMartV1TestimonialCtl}.php`, `CodeMartV1Ctl/{CodeMartV1FundingCtl,CodeMartV1PublicHomeCtl}.php`;
  - the `failure()` messages in `CodeMartV1Services/{CodeMartV1AdminService (26),CodeMartV1ProjectStateService (5),CodeMartV1TaskStateService (5),CodeMartV1RoleRequestService (2),CodeMartV1TestimonialService (3)}.php`. These reach `codedError`/`errorWithCode` through the controllers' `failureResponse`/`respond`. The accept-proposal conflict message comes from ProjectStateService, for example.
  - `CodeMartV1Utils/CodeMartV1EmailService.php`: the verification mail subject and body, under the new `codemart.mail.*` keys.
- Lang: 27 new `errors` keys, 20 new `messages` keys and 2 `mail` keys, in both en and zh_CN. Existing keys were reused where the text was identical (`validation_failed`, `user_not_found`, `project_not_found`, `deposit_not_found`, `project_status_updated`).
- Also in RegistrationCtl (a listed file): `role_type` now validates against `CodeMartV1RoleRequestService::SELF_SERVICE_ROLES`, and the literal `'pending'` KYC status is now `KYC_STATUS_PENDING`.

#### cmdesign-03-api

Served by GET `/api/codemart/v1/bootstrap` through `contractVocabulary()`, built from existing constants only:
- `states`:
  - `contact_message` (CONTACT_STATUSES);
  - `role`, now from the new `ROLE_STATUSES` (`Constants.php:18`), which the admin role-status validator also uses.
- `terminal_states`: `analysis`, `submission` and `milestone`.
- `state_rules` (`Constants.php:856`):
  - payment_refundable, submission_reviewable, project_task_publishable, analysis_active;
  - role_reason_required, role_admin_grantable.
- `policy`: payment_types, identity_types, kyc_document_slots (`array_keys(KYC_FILE_COLUMNS)`), dispute_resolutions and supported_locales. The pre-outage part also added payment_creatable_types, task_priorities, complexities and budget_types, which are the validator sets.

One definition per validator:
- `AdminCtl.php:111`: role status, now `Rule::in(ROLE_STATUSES)` (was the literal `in:pending,active,suspended,rejected`).
- `AdminCtl.php:136`: grant status, now `Rule::in(ROLE_ADMIN_GRANT_STATUSES)`.
- `AdminFinanceCtl.php:207`: dispute resolution, now `DISPUTE_RESOLUTIONS`.
- `RegistrationCtl.php:49`: role_type, now `SELF_SERVICE_ROLES`.
- Already on constants: PaymentCtl (PAYMENT_CREATABLE_TYPES, WITHDRAWAL_METHODS), RegistrationCtl (IDENTITY_TYPES), ProjectCtl (COMPLEXITIES, BUDGET_TYPES) and TaskCtl (TASK_PRIORITIES).
- The rule sets are enforced through the same constants:
  - `PAYMENT_REFUNDABLE_STATUSES`: PaymentCtl:319, FinanceService:114;
  - `SUBMISSION_REVIEWABLE_STATUSES`: TaskSubmissionModel:63,114;
  - `PROJECT_MARKETPLACE_STATUSES`: ProjectModel:106, TaskModel:109;
  - `ANALYSIS_ACTIVE_STATUSES`: AIAnalysisCtl:124;
  - `ROLE_STATUS_REASON_REQUIRED`: AdminService:407;
  - `KYC_FILE_COLUMNS`: AdminService:607.

#### cmgap-U30

`AIAnalysisCtl::acceptProposal` (`:235-302`):
- It reads the key with `CodeMartV1FinanceService::idempotencyKey()` (CodeMartV1Constants::IDEMPOTENCY_HEADER, capped at 255), the same helper that deposits and payments use.
- A replay is detected twice: before the checks, and again under the analysis row lock inside the transaction (`AIAnalysisModel::lockById`, `isAcceptReplay`, `:90-101`), so a concurrent same-key request also replays.
- The key is stored in `accept_idempotency_key`, together with `accepted_at`.
- `acceptedResponse()` builds the same body for the first call and for a replay.
- A different key, or no key, still falls through to the project transition and gets its conflict (409 `invalid_project_transition`).

### Verification

Free RAM was 3.96 GB at the start and 5.6 GB before the in-process runs.

Static checks:
- `php -l`: no syntax errors in all changed and item files (the CodeMartV1 controllers, services and utils, Constants, AIAnalysis/Wallet/WalletTransaction models, the command, and both lang files).
- `grep -rnE "('message'|'error')\s*=>\s*'[A-Z]|success\(\['message' => '" app/Apps/CodeMartV1`: 2 hits, both DemoSeeder contact-message data rows (`:651-652`, exempt).
- `grep -rn 'Codemart#2026' app`: 0 hits (exit 1).
- A wider capitalized-literal scan over CodeMartV1 (excluding comments, logs, ApiInfo and the seeder) leaves only `'Super Administrator'` (RegistrationCtl:75). That is the stored rolename, a data value shared with `app/Models/User.php:254`, not a message.
- Lang (scratchpad `g1cm_lang_keys.php`): 71 files scanned, 237 `codemart.*` keys used (static, `LANG_PREFIX` concatenations, and the dynamic ledger/account/step keys), 0 missing in en or zh_CN, and 0 placeholder mismatches between en and zh_CN.
- `php artisan route:list --path=api/codemart/v1`: 113 routes, exit 0.

In-process probe (scratchpad `g1cm/probe.php`, output `g1cm/probe_out2.json`):
- Setup: each section in its own transactions on the default and the CodeMart connection, all rolled back. The secret paths and the private disk root point at a scratch directory. Log lines are captured with MessageLogged.
- srv-05:
  - The accounts were first set to the removed published password inside the transaction (simulating a pre-D17 database): 7/7 accepted it.
  - Seed 1 with a missing file: generated, file created, 24 chars of [A-Za-z0-9], summary password = file password, 7 hashes changed. `Hash::check`: file password 7/7, removed password 0/7.
  - Seed 2: not generated, same password, 0 hashes changed.
  - `codemart:admin-password`:
    - without `--file`: exit 2, "The --file option is required.";
    - unreadable file: exit 1;
    - a new scratch file: exit 0, 7 updated, and the new password is accepted 7/7 while the seed password is accepted 0/7;
    - the same file again: 7 unchanged, 0 hashes changed;
    - 0 command outputs contain a password.
  - 4 log lines were captured in the whole run, and 0 contain a password. The Initializer step message does carry the generated password (console only, by design).
  - After rollback, the hashes are restored.
- CKA-28:
  - `alignTableStructureFromArray` over `contractTableStructures()`, run twice: 0 actions each time.
  - `EscrowService::releaseForTask(task 7)`: released. The ledger row has description_code `task_escrow_release`, params `{"task_id":7}` and stored description NULL.
  - GET `/api/codemart/v1/wallet/transactions` as the seeded developer returned 200:
    - en: "Task 7 escrow release"; zh-CN: "任务 7 托管放款";
    - `description_code` and `description_params` are present;
    - a legacy row inserted without a code keeps "Legacy ledger text (G1 probe)" in both locales, with code and params null.
- cmdesign-03-api:
  - GET `/api/codemart/v1/bootstrap` as `codemart_demo_admin` returned 200, and the served vocabulary equals `contractVocabulary()`.
  - All 21 checked paths equal their constants: states.{testimonial,reviewer_application,contact_message,role}, terminal_states.{analysis,submission,milestone}, capability_roles, the 6 state_rules, and policy.{withdrawal_methods,withdrawal_min_amount,payment_types,identity_types,kyc_document_slots,dispute_resolutions,supported_locales}.
- cmgap-U30 (analysis 1, project 2, as its client):
  - Call 1 with key A: 200, project proposal_review → funding_pending, state_revision 1 → 2.
  - Call 2 with key A: 200 with a byte-identical body, state_revision still 2, 0 activity rows written.
  - Call 3 with key B: 409 `invalid_project_transition` (from funding_pending to funding_pending, allowed [open]).
  - Call 4 with no key: the same 409.
  - Activity rows: call 1 wrote 2 (the project proposal_accepted transition and the analysis `accepted` event), and calls 2-4 wrote 0. There is 1 funding_pending transition and 1 analysis-accepted row, and the stored key is key A.
  - After rollback: accepted_at is null, the key is null, and the project is back in proposal_review.
- Residue: 0 probe tokens, 0 legacy rows, 0 `task_release:7` payments, and the scratch directory is deleted. The PG sequences advanced, which is normal after a rollback.

Live server: `POST http://localhost:2019/frankenphp/workers/restart` returned 200. Afterwards `:9000/api/health` and `/api/codemart/v1/public/home` both return 200.

### Decisions taken without asking

1. **Sweep beyond the listed files.** CKA-28 asks for "any English message passed to CodeMartV1FinanceException or codedError that reaches a response", and cmdesign-03-api asks that "each validator use the same constant". Both need lines in CodeMartV1 files outside the listed ones: AdminCtl, AdminFinanceCtl, BootstrapCtl, ProfileCtl, TestimonialCtl, FundingCtl, PublicHomeCtl, Admin/ProjectState/TaskState/RoleRequest/TestimonialService and EmailService. They are all inside my role scope, and none is in another role's or member's G1 assignment: codemart-lead's G1 touches no Laravel file, and codemart-ui writes only UI. So the file-list rule's parallel-safety reason does not apply. The edits are literal-to-key or literal-to-constant only, with no behaviour change. If the lead prefers the strict list, they revert cleanly per file.
2. `ROLE_STATUSES` was added as the single role-status list, used by `states.role` and the admin validator. It follows the existing `*_STATUSES` pattern.
3. Kept `CodeMartV1AdminPassword::write()` on `ensureFileMode(contract file_mode)` rather than `FileSystemManager::writePrivateFile()`, which hardcodes 0600. This keeps the mode contract-driven (D7 optional note).
4. Kept the accepted D7-fix residual: the secret file is written before `apply()`, so a failure in between is healed by `codemart:admin-password`, which Step175 runs on every deploy. This follows the "never rehash with an existing file" ruling.
5. `CodeMartV1ApiInfo.php` (API description metadata with stale literal `in:` lists and English descriptions) was left unchanged: it is documentation, not a validator or a response message, and not in the item scope.

### Deferrals

None for the four items.

### Cross-scope notes

- codemart-ui (cmdesign-03):
  - it can now drop its local copies using `vocabulary.state_rules.*`, `states.contact_message`, `states.role` and `policy.{payment_types,payment_creatable_types,identity_types,kyc_document_slots,dispute_resolutions,supported_locales,task_priorities,complexities,budget_types}`;
  - type them in CmApiTypes.ts.
- codemart-ui (CKA-28-ui): the wallet-transactions items carry `description_code` and `description_params`; `description` is already translated by the server in the request locale.
- pycore-laravel (unchanged):
  - `app/Console/Commands/CodeMartV1SeedDemoData.php:18-19` prints hardcoded English;
  - the `routes/web.php` system/init group has no `dashboard.auth`, while a first-run step message carries the generated password;
  - `'Super Administrator'` is duplicated between `RegisteredUserController.php:59`, `User.php:254` and CodeMart `RegistrationCtl.php:75`. A shared constant on the User model would be the one definition.
- laravel-remote: the server needs this code through CodeSync, then a worker restart. There are no schema changes: the `accept_idempotency_key` column was already aligned by sys:init.

### Blockers

None.

### Next owner

codemart-lead: review and write the verdict for `codemart-laravel-G1`.

## Session ct-codemart-laravel resume (2026-09-28, after usage-limit reset)

- Status: idle, ready for tasks. No in-flight edits, nothing uncommitted in my scope.
- Verified both prior tasks carry `"verdict": "approved"`: `reviews/laravel-codemart-D7-fix.json` and `reviews/codemart-laravel-G1.json`. codemart-lead's report confirms codemart-laravel-G1 was reviewed (0 blocking, 8 non-blocking notes) and routed to ca-orchestrator for the group merge.
- Sent readiness messages to `ct-codemart-lead` (with the still-open D7-era items below) and to `ca-orchestrator`.
- Still-open D7-era items with no round/owner recorded since the D7 review: `cmgap-R1` (email verification resend), `CMDES-08` (legacy KYC file migration to private disk), `cmcont-11` (local schema convergence proof for public/home). These are in `items_codemart.json` under `laravel-codemart-D7` and were never picked up in D7-fix or G1.
- Open cross-scope referrals from my G1 report, needing routing through codemart-lead/claude lead, not mine to act on directly: the zh_CN glossary pass on `lang/zh_CN/codemart.php`, and the pycore-laravel items (`ApiResponse::success()` 'Success' default, `sys:codemartinit` hardcoded English, missing `dashboard.auth` on the system/init route group, a shared 'Super Administrator' rolename constant).
- Blockers: none.
- Next owner: ct-codemart-lead, to assign the next round (G3 / cmgap-R1 / CMDES-08 / cmcont-11 or other).

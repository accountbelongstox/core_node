# codemart-lead handoff (D22, 2026-09-27)

## ui-codemart-D7 review (member codemart-ui)

- Verdict: approved, in `.claude/agents_shared/reviews/ui-codemart-D7.json`.
- Closed: cmpui-07, cmgap-A14, cmgap-U30-ui.
- Still open: cmdesign-03. It is partial in the working tree and moves to codemart-ui-G1.
- Scope: the D7 part of the diff against 74e7770, which is f4f223414..5bbb23682 plus the working tree. codemart-1..7 were approved earlier and are excluded.

### Changed files reviewed

UI below means `poly_apps/pycore_laravel_wordnew_ui/`.

- UI/core/integrations/laravel/transport/ApiContract.ts (B2 writer under D7)
- apps/codemart:
  - auth/CmAuthApi.ts
  - api/CmPublicApi.ts
  - api/CmApi.ts
  - components/workspace/{CmPager, CmStateViews, CmPageHeader, CmStatusBadge, CmProjectAnalysisPanel}.tsx
  - components/workspace/{useCmPagedList, cmWorkspaceFormat}.ts
  - admin/{CmAdminShared, CmAdminPages, CmAdminFinancePages, CmAdminModerationPages, CmAdminUserDetailPage}.tsx
  - pages/CmShowcasePage.tsx
  - styles/cm-workspace.css
  - cm-locales/{en,zh}.ts
- Working tree (cmdesign-03, partial):
  - contexts/CmBootstrapContext.tsx
  - components/access/CmCapabilityGate.tsx
  - pages/CmDashboardPage.tsx

### Checks

- Free RAM was 6.57 GB.
- `bun run lint` fails on this Windows checkout with `bun: command not found: tsc`. This is the known problem with the POSIX .bin shims.
- `node node_modules/typescript/bin/tsc --noEmit` in the UI package exits 0 with 0 errors.
- The greps pass:
  - no auth path literals;
  - none of the removed admin or showcase primitive definitions;
  - no `new Intl.` under admin/;
  - no references to the removed locale keys or CSS classes.
- A static read shows the Idempotency-Key header on the accept request.
- Every changed file kept CRLF.
- No tests were touched.

### Non-blocking findings for codemart-ui-G1

1. `useCmPagedList.ts:59-61`: a failed load keeps the previous total. After a filter change that fails, the admin pager still shows the old summary under the error. Set total to 0 on failure, or hide the pager while an error is shown.
2. `useCmAdminFormat` (CmAdminShared.tsx:51-65) and `useCmFormat` (cmWorkspaceFormat.ts:151-161) could become one hook with a currency default.
3. The partial cmdesign-03 changes two behaviours:
   - Role chips now follow the server `getAllRoles()` order.
   - Architect-gated pages now offer the deposit action, as `policy.deposit_amounts` says they should.

   The rest of cmdesign-03 is still open:
   - the CmAdminTypes status lists;
   - the CmDashboardPage closed sets;
   - `CmProjectAnalysisPanel.tsx:13`;
   - CmMilestoneCard and CmSubmissionsPanel;
   - the cmPageAccess capability map;
   - `CmWalletPage.tsx:30` WITHDRAWAL_METHODS.
4. The cmgap-U30 server side is missing. `CodeMartV1AIAnalysisCtl::acceptProposal` does not read Idempotency-Key yet. Owner: codemart-laravel.
5. `CmShowcasePage` `useShowcaseSection` runs in parallel with useCmPagedList. It was out of A14 scope.

### Decisions taken without asking

- Verified with the node tsc form instead of the bun shim: same script, and Windows bun cannot resolve the shims.
- The partial cmdesign-03 is reviewed but not closed. The approval closes only the three items the task names.

### Blockers

None.

### Next owner

codemart-ui: codemart-ui-G1 takes cmdesign-03 and the non-blocking notes above.

## laravel-codemart-D7 review (member codemart-laravel)

- Verdict: changes_requested, in `.claude/agents_shared/reviews/laravel-codemart-D7.json`.
- Scope: the D7 delta f4f223414..worktree (5bbb23682, b20962b4f and the uncommitted callers). The D18 header removals are ignored.
- Confirmed:
  - CKA-28 ledger codes: 13 codes, all callers pass them, en and zh_CN keys, and the translated read.
  - The Initializer contract columns, aligned idempotently.
  - codemart:admin-password: exit codes, rotation, idempotency, no password in the output.
  - The bootstrap vocabulary additions.

### Changed files reviewed

All paths are under `poly_apps/laravel_main/app/Apps/CodeMartV1/`:
- the new files `CodeMartV1Utils/CodeMartV1AdminPassword.php` and `CodeMartV1Commands/CodeMartV1AdminPasswordCommand.php`;
- `CodeMartV1Utils/{CodeMartV1DemoSeeder,CodeMartV1Initializer}.php`;
- `CodeMartV1Gvar/CodeMartV1Constants.php`;
- `CodeMartV1Models/{CodeMartV1WalletModel,CodeMartV1WalletTransactionModel}.php`;
- `CodeMartV1Ctl/CodeMartV1PaymentCtl.php`;
- `CodeMartV1Services/{CodeMartV1EscrowService,CodeMartV1AdminFinanceService,CodeMartV1FinanceService}.php`.

The lang files `lang/{en,zh_CN}/codemart.php` were checked as consumers only.

### Blocking issues (codemart-laravel-G1)

1. `CodeMartV1DemoSeeder.php:756-761,855`: a generated secret is not applied to existing seeded accounts.
   - Local probe: 0/7 accounts accept it, and 7/7 still accept the removed published password.
   - Fix: when the file was generated, call `CodeMartV1AdminPassword::apply()` after seedAccounts.
2. `CodeMartV1DemoSeeder.php:758` with `CodeMartV1Initializer.php:564`: the generated password reaches `Log::info`.
   - Fix: log only the path, and keep the password in the returned summary.
3. `CodeMartV1Constants.php:786-797`: terminal_states has no analysis or submission group, and states.submission omits `pending`.
   - Without them, ui-codemart cmdesign-03 cannot drop `CmProjectAnalysisPanel.tsx:12` or `CmSubmissionsPanel.tsx:15`.

### Non-blocking notes

- The terminal_states comment contradicts the project completed/cancelled -> archived transitions.
- accept_idempotency_key has no reader or writer yet (cmgap-U30).
- The RuntimeException messages in CodeMartV1AdminPassword are English literals.
- Str::random is accepted instead of InstallationAccessCode, which has no public generator.
- Open D7 items, not in the delta: the CKA-28 literal sweep, cmgap-R1, cmgap-U30, CMDES-08, cmcont-11.

### Cross-group referral (pycore-laravel)

- `routes/web.php:149-155`: the system/init group has no dashboard.auth. On a first run, its response carries the generated password.
- sys:codemartinit prints hardcoded English.

### Checks

- Free RAM was 6.65 GB.
- php -l passes on all 13 files.
- LF is kept; no header was re-added.
- The removed-password grep finds 0 code hits.
- 37 lang keys resolve in both locales.
- In-process runs, rolled back on main and codemartv1:
  - bootstrap returns 200 and its vocabulary equals the constants;
  - align adds 0 lines;
  - the srv-05 and CKA-28 probes (escrow release and wallet/transactions, en and zh-CN).
- No residue after the rollbacks.
- Probe script: scratchpad `cm_d7_review/probe.php`.

### Decisions taken without asking

- Issue 1 applies the generated secret despite the item text "never rehashes an existing account". D17 and the contract require the printed password to work at once. The rule still holds whenever the file already exists.
- The log leak is raised to blocking, because it writes a plaintext credential to laravel.log.
- The analysis/submission groups are blocking, because the API item exists so that the UI can drop those local sets.

### Blockers

None for the review.

### Next owner

codemart-laravel: codemart-laravel-G1 takes the 3 blocking issues and the open D7 items.

## laravel-codemart-D7-fix review (member codemart-laravel, round 1)

- Verdict: approved, in `.claude/agents_shared/reviews/laravel-codemart-D7-fix.json` (base 74e7770).
- Confirmed:
  - B1: the seeder applies a generated secret at once. Probe: 7/7 accept it, 0/7 accept the removed literal, and a second seed changes 0 hashes.
  - B2: the seeder logs only the path. Probe: 0 log messages contain the password.
  - B3: terminal_states gains submission and analysis, and states.submission gains pending through getAllSubmissionStatuses(), which also feeds the check constraint (0 DDL).
- Files (now in commit 4ddb4be8e): `CodeMartV1Utils/{CodeMartV1DemoSeeder,CodeMartV1AdminPassword,CodeMartV1Initializer}.php`, `CodeMartV1Commands/CodeMartV1AdminPasswordCommand.php`, `CodeMartV1Gvar/CodeMartV1Constants.php`.
- Checks:
  - Free RAM was 3.19 GB.
  - php -l passes on all 5 files; LF is kept and no header was re-added.
  - The removed-password grep finds 0 hits.
  - The probe re-run (`scratchpad/d7fix_probe.php`, rolled back) and the align re-run (0 ALTER) both pass.
  - route:list shows 113 CodeMart routes; :9000 health returns 200.
- Non-blocking:
  - The secret file is written before apply(); a failure between them needs codemart:admin-password (accepted per the ruling).
  - Carried open items: codemart-laravel-G1 takes the D7 notes; pycore-laravel takes the system/init auth and the sys:codemartinit literals.
  - codemart-ui should type `vocabulary.terminal_states` in CmApiTypes.ts.
- Next owner: codemart-ui (cmdesign-03 can now drop CmSubmissionsPanel.tsx:15 and CmProjectAnalysisPanel.tsx:13); pycore-laravel for the referrals.

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

## codemart-lead-G1 (lead's own items; verdict by the reviewer service in `reviews/codemart-lead-G1.json`)

UI below means `poly_apps/pycore_laravel_wordnew_ui/`. Diff base 74e7770. The user's backup commit 4ddb4be8e (20:24) already holds the first generator version; the working tree adds the later subject edits and the regenerated icons.

### d9-01-gen: done (Laravel gateway run pending for the user)

- Files:
  - `UI/apps/codemart/assets/generate_cm_images.py` (LF kept; still the only generator).
  - `UI/apps/codemart/assets/icons/*.webp`, 28 new files.
  - `docs_fix/codemart_docs/PROGRESS_20260927_CODEMART_PAGE_POLISH.md` §3.1 (prompts, provider, sizes, ICON_SET_VERSION).
- Generator changes:
  - `--group images|icons` (default images), `--gateway laravel|pycore` (default laravel), `--dry-run`.
  - Icon group: 12 nav icons (one per cmPages.tsx entry id), 7 feature icons (the CmDashboardPage metric ids), 4 category icons (project complexity, which is the public `category` field) and 5 empty-state icons. One flat square style, no text.
  - `ICON_SET_VERSION = 1`, `ICON_SIZE = 128`, `ICON_MAX_BYTES = 30 KB`. The WebP quality steps down from 76 until the file fits; the images group got the 120 KB budget from the requirements §5.
  - Laravel gateway: `POST /api/local/ai/image` on `http://127.0.0.1:9000`. Host and port are resolved through `pycore.pyfoundations.service_contract` (hosts.loopback, ports.laravel_api_backend). Proxies are bypassed, no token is sent, and the dashboard.auth loopback debug session is used.
  - The pycore gateway is unchanged. `--provider` is accepted only with `--gateway pycore`, because the Laravel route has no provider field.
- Verification:
  - `py_compile` OK.
  - `--help` lists `--group`, `--gateway` and `--dry-run`.
  - `--group icons --dry-run` prints 28 `plan <name> 1:1 128px ...: <full prompt>` lines, exit 0, and calls no gateway (it only resolves the URL).
  - An unknown `--only` name and `--provider` with the laravel gateway both exit 2 with a usage error.
  - After the run, all 28 icons are WEBP 128x128. The largest is 1554 bytes and the total is 25402 bytes. None is git-ignored.
- Run:
  - Free RAM was 4.57 GB before the icon run and 3.62 / 3.12 GB before the two `--only` passes.
  - Laravel gateway: 28/28 failed with `cURL error 60 ... unable to get local issuer certificate`. The FrankenPHP PHP has no CA bundle (`curl.cainfo` and `openssl.cafile` are empty in `D:\www\frankenphp\php-conf.d`), so every outgoing HTTPS call from Laravel fails.
  - pycore gateway (`--gateway pycore --provider openrouter`, model google/gemini-2.5-flash-image): 28/28 generated.
  - Two `--only` passes regenerated 6 weak icons, then 3; details are in PAGE_POLISH §3.1.
  - I judged quality visually from contact sheets (scratchpad `icons_sheet.png`, `icons_regen*.png`).
  - Residue:
    - Some tiles have rounded corners, so the UI should clip icon images with a border radius.
    - category-medium shows arrows on its blocks.
- Deferrals and cross-scope:
  - **User + shell-windows:** set a CA bundle for the FrankenPHP PHP (Step96 `Ensure-FrankenPhpPhpConfiguration`, `FrankenPhpManager.ps1`), then restart FrankenPHP; a worker restart is not enough for ini changes. The local instance must not be stopped by roles, so the restart is the user's. After that, re-run `python generate_cm_images.py --group icons --force` to prove the default Laravel gateway. This defect also breaks every other outgoing HTTPS call from the local Laravel (all AiGateway providers).
  - **codemart-ui (d9-01-ui) can start:**
    - wire `assets/icons/<name>.webp` into cmPages.tsx and CmDashboardPage (the dashboard shortcuts reuse the nav icon of the same page id);
    - add the i18n alt texts in cm-locales;
    - clip with a border radius;
    - fold the icons into the IMG-01 registry (`assets/cmImageRegistry.ts`, which codemart-ui created in G1).
  - `docs_fix/codemart_docs/REQUIREMENTS_20260927_CODEMART_PAGE_POLISH.md` §5 still names only the pycore gateway. It is outside this task's file list and is left for a later lead pass.

### d9-redis: audit done; post-D9-01 proof pending on pycore-laravel

- Files: `docs_fix/codemart_docs/PROGRESS_20260927_CODEMART_GAP_COMPLETION.md` §8.2.
- Audit:
  - `grep -rnE "Cache::store|Redis::|RateLimiter::for|->lock\(|cache\(\)->store"` over `app/Apps/CodeMartV1` and `routes/CodeMartV1Router` returns 0 hits (grep exit 1).
  - Cache::remember and Cache::forget run only on the default store (`CodeMartV1PublicHomeService.php:54-62`).
  - THROTTLE_* uses the default limiter.
  - All money paths use `lockForUpdate` inside transactions.
  - Queues stay sync.
  - The audit found no CodeMart code change, so there is no codemart-laravel follow-up.
- Baseline probe (scratchpad `cm_redis_probe/probe.php`, in-process, both connections rolled back):
  - `cache.default=database`, `queue.default=sync`, `extension_loaded('redis')=false`, and `php -m` has no redis.
  - public/home returns 200 and is cached afterwards.
  - The `X-RateLimit-Remaining` header went 119 then 118 of 120.
  - `fundProject` on project 3 funded the escrow and ran `select * from "codemart_v1_wallets" where "user_id" = ? limit 1 for update`.
  - The probe printed "rolled back".
- Deviation: free RAM was 2.32 GB when this light probe ran. It was checked in the same command, not before it. Later RAM was 1.13 GB, so the separate residue query was skipped: psql is not on PATH, and another PHP bootstrap was not run. The probe only rolls back, and fundProject has no mail or notification side effects.
- Pending: D9-01 has not landed (`config/cache.php:18` is still `LaravelConfig::CACHE_STORE` = database, and there is no failover store). The same probe re-runs in G3. If D9-01 is still missing then, it is recorded as pending on pycore-laravel.

### d9-04-docs: done

- Files, all under `docs_fix/codemart_docs/` and all LF:
  - `PROGRESS_20260927_CODEMART_GAP_COMPLETION.md`:
    - the legend gains missing and superseded;
    - rows G10, U06 (advisory), U28, U30 (analysis accept missing), U31 and D01 (superseded by D17);
    - the §6 password text is removed;
    - each §7 item has a status and evidence;
    - new §8: 8.1 row table with file:line or task id, 8.2 Redis, 8.3 D22 choices.
  - `PROGRESS_20260927_CODEMART_PAGE_POLISH.md`:
    - the 13 K3 rows go from rough to polished, each with CmPageHeader and state lines; the crawl is G3;
    - legend note;
    - §3.1 icons;
    - log entries.
  - `PROGRESS_20260919_CODEMART_CONTINUATION.md`: the "175 asks, default no" demo-data text is superseded by D17.
  - `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`: the reviewer role and flow are advisory, and the date line notes it.
  - `PROGRESS_20260823_CODEMART_{INTEGRATION,LARAVEL_MAIN,PYCORE_UI}.md`:
    - a D9 reconciliation pointer;
    - the U30, U05/U06 and G10 superseded rows carry their current state;
    - bootstrap "no local copy" becomes partial (cmdesign-03);
    - i18n "done" gets the ledger exception (CKA-28-ui).
- Verification:
  - `grep -rn "Codemart#2026" docs_fix/codemart_docs` finds 0 hits, and `grep "Codemart#"` finds 0.
  - The evidence lines were re-read in the code (cmAuthSession.ts:26-38, EscrowService.php:45-50, ReviewerCtl.php:153-156, TaskCtl.php:615, Constants.php:297,799,812,842, AdminService.php:103/625/661, Initializer.php:408,547).
  - Line numbers drift while the members edit in G1; §8 says so.
- Cross-group (orchestrator):
  - the `docs_fix/` root copies of DESIGN_20260823, PROGRESS_20260823_*, PROGRESS_20260919 and REQUIREMENTS_20260927_CODEMART_PAGE_POLISH need their superseded marks;
  - the lang-file temporary writer is requested (D22 choice).

### Decisions taken without asking

- Laravel is the default gateway. When it failed on this host, I used the pycore gateway, the second path that the item allows, rather than leave the icons pending. The Laravel failure is recorded for the user.
- OpenRouter was pinned for one style, as in the K5 image run.
- Icon size 128 covers 2x at 64 px. "Category" means project complexity, because the public API's `category` is `complexity`, and the feature icons follow the dashboard metric ids.
- The K3 status is `polished` rather than `verified`, because the live crawl is G3.

### Blockers

- The Laravel gateway run needs the FrankenPHP CA bundle (user and shell-windows).
- The post-D9-01 Redis proof needs pycore-laravel D9-01.

### Next owner

- codemart-ui: d9-01-ui.
- reviewer: the codemart-lead-G1 verdict.
- pycore-laravel: D9-01.
- shell-windows and the user: the FrankenPHP CA bundle.

## Session ct-codemart-lead start (2026-09-27, later session)

- Status: ready and idle, waiting for tasks from ca-orchestrator. The shared task list is empty.
- Message sent: a readiness note to ca-orchestrator.
- The reviewer approved codemart-lead-G1 (`reviews/codemart-lead-G1.json`) with 0 blocking and 8 non-blocking notes.
- Carried open items:
  - cmgap-U30 review: codemart-laravel's 7a23f57d0 is not reviewed yet.
  - codemart-ui work: the rest of cmdesign-03, plus d9-01-ui, which includes the `?no-inline` icon glob.
  - My G3 work:
    - re-run the cm_redis_probe when free RAM is at least 3 GB, and refresh the D9-01 sentence;
    - move the U30 rows to done once cmgap-U30 is approved;
    - regenerate category-medium;
    - update REQUIREMENTS PAGE_POLISH §5.
  - The FrankenPHP CA bundle, which needs shell-windows and the user.
- Blockers: none.
- Next owner: ca-orchestrator, to dispatch.
- Standby order from ca-orchestrator: the D22 codemart workflow run is still active.
  - Its workflow agents are working on codemart-lead-G2, codemart-ui-G1 and codemart-laravel-G1.
  - Until ca-orchestrator dispatches work to me, I do not assign, edit, review or spawn subagents.
  - After the run, these items come by message:
    - the cmgap-U30 review;
    - the rest of cmdesign-03, and d9-01-ui;
    - codemart-G3, the reviewer's five follow-ups on codemart-lead-G1.
  - I then split them over ct-codemart-ui and ct-codemart-laravel.
- D23 withdrew the FrankenPHP CA bundle item. Local tests use http://127.0.0.1:9000 with K3, so it is no longer my blocker.

## codemart-ui-G1 review (workflow, round 1)

- Verdict: approved, 0 blocking and 8 non-blocking notes, in `.claude/agents_shared/reviews/codemart-ui-G1.json` (base 74e7770; the G1-only diff was read as 8f95a2a24..HEAD).
- Items: d9-03, cmpolreq-07, cmdesign-13, CKA-28-ui and cmpolish-IMG-01 are all confirmed.
  - The d9-03 THEME_IDS part is deferred until pycore-ui exports SHELL_THEME_IDS; the request goes to pycore-ui through the claude lead.
- Checks I re-ran:
  - tsc: exit 0, 0 errors;
  - the route, dead-code, zh, version, Braces and .webp greps: 0 hits;
  - ledger parity: 13 = 13 = 13;
  - registry sizes: 16/16 match the real files;
  - a read-only tinker probe of the ledger fields;
  - line endings: every file keeps its ending.
- Items to route:
  - server `lang/zh_CN/codemart.php` still has 审核员 x6 and 您 x20 → its owner, through the claude lead;
  - d9-01-ui → `?no-inline` on the icon glob, and fill CM_ICON_SPECS;
  - cmdesign-03 → one currency constant;
  - G3 → exercise a coded ledger row.
- Changed files: `.claude/agents_shared/reviews/codemart-ui-G1.json` and this report.
- Blockers: none. Next owner: ca-orchestrator.

## codemart-laravel-G1 review (workflow, round 1)

- Verdict: approved, 0 blocking and 8 non-blocking notes, in `.claude/agents_shared/reviews/codemart-laravel-G1.json`.
  - Base: 74e7770. The G1-only diff was read as 4ddb4be8e..HEAD: 31 files, +542/-214, in the user's snapshot commits 0b6f362e3, 7a23f57d0, 6ecff3401 and 7bed0a953.
- Items: srv-05, CKA-28, cmdesign-03-api and cmgap-U30 are all confirmed.
- Checks I re-ran:
  - php -l on 42 files;
  - LF/BOM/`<?php` checks;
  - a reference check of 2383 references (scratchpad `lead_g1cm_refs.php`);
  - a lang check (scratchpad `lead_g1cm_lang.php`): 237 keys, 0 missing, 0 placeholder mismatches, identical key sets;
  - both verify greps: 'Codemart#2026' gives 0; CKA-28 gives only the 2 exempt seeder rows;
  - route:list: 113 routes;
  - the member's rolled-back probe, read first and then re-run unchanged (output in scratchpad `lead_g1cm_probe_out.json`);
  - live health 200. The real secret file is accepted 7/7 and appears in 0 log files.
- Decisions:
  - Accepted the member's extension to 13 unlisted CodeMartV1 files. Reasons: CKA-28 says "any English message", and cmdesign-03-api says "each validator". All 13 are in the codemart-laravel scope, and no other writer touched them.
  - Read the cmgap-U30 "exactly one activity row" as "no duplicate writes on replay". The acceptance writes the 2 pre-existing events (the project transition and the analysis accepted event); a replay writes 0.
- Items to route:
  - server zh copy (`lang/zh_CN/codemart.php`) against the PAGE_POLISH §3 glossary: the G1 additions bring 审核员 x3, 您 x8, 提案 x3 and KYC x6. The next writer of the file does one glossary pass, as the claude lead assigns.
  - pycore-laravel (through the claude lead):
    - the `ApiResponse::success()` 'Success' default;
    - the sys:codemartinit English;
    - the system/init auth;
    - one shared constant for the 'Super Administrator' rolename.
  - codemart-laravel, in a later pass:
    - give CodeMartV1ApiInfo its enumerations from the constants;
    - the `you_can_only_apply_once_every_7` :days placeholder.
  - laravel-remote: sync through CodeSync and restart the workers; there is no schema change.
- Changed files: `.claude/agents_shared/reviews/codemart-laravel-G1.json` and this report. No code was changed and no worker restart was needed.
- Blockers: none. Next owner: ca-orchestrator (group merge and combined checks).

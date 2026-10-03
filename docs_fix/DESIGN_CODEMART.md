# CodeMart Design

Scope: the CodeMart managed software-delivery marketplace: the UI app in the pycore/Laravel/wordnew UI shell, the Laravel `CodeMartV1` backend, their integration, and the page quality standard.

Authority: code > config/*_contract.json > this document.

Owner: `codemart-lead`. The Flutter sources in `docs_fix/codemart_docs/flutter_reference/` are reference material only and never the target frontend; the target is the React app in the unified shell (`DESIGN_UI.md`).

## 1. Code map

| Part | Location |
| --- | --- |
| Backend | `poly_apps/laravel_main/app/Apps/CodeMartV1/` (Ctl, Controllers, Services, Models, Utils, Gvar, Commands) |
| Constants (policy, states, throttles, error codes) | `CodeMartV1Gvar/CodeMartV1Constants.php` |
| Routes | `poly_apps/laravel_main/routes/CodeMartV1Router/api.php`, prefix `/api/codemart/v1` |
| Schema and seeding | `CodeMartV1Utils/CodeMartV1Initializer.php` (run by `sys:init` through `AppInitializationManager`), `CodeMartV1DemoSeeder.php` |
| Server language files | `lang/en/codemart.php`, `lang/zh_CN/codemart.php` |
| UI app | `poly_apps/pycore_laravel_wordnew_ui/apps/codemart/` (route `/codemart`), flavor `flavors/codemart/` |
| UI language resources | `apps/codemart/cm-locales/en.ts`, `zh.ts` |
| Images and icons | `apps/codemart/assets/images/`, `assets/icons/`, generator `assets/generate_cm_images.py`, registry `assets/cmImageRegistry.ts` |

## 2. Product and roles

A client turns a requirement into a funded project; an architect may structure it into milestones and tasks; qualified developers accept open tasks and submit deliverables; qualified reviewers assess submissions; the platform enforces authorization, state transitions, money movement and audit history. CodeMart ships as an app in the unified shell (public surface, user workspace, separate administration console) and as a standalone Capacitor Android/iOS flavor (`flavors/codemart/`).

| Role | Purpose | Activation |
| --- | --- | --- |
| Client | Creates, funds and accepts projects | Shared account plus CodeMart onboarding; deposit `DEPOSIT_CLIENT` (0), active at registration |
| Developer | Accepts tasks, submits deliverables | Verification, profile, deposit `DEPOSIT_DEVELOPER` |
| Architect | Turns requirements into an executable plan | Active developer, `ARCHITECT_MIN_CODE_SCORE`, application, `DEPOSIT_ARCHITECT_ADDITIONAL` |
| Reviewer | Scores submissions and recommends; advisory only | Passed qualification (`REVIEWER_MIN_SIMILARITY`, retry after `REVIEWER_RETRY_DAYS`) |
| Administrator | KYC, deposits, refunds, withdrawals, disputes, role status, project intervention | Global admin authorization, or registration with the installation super code |

- A user may hold several CodeMart roles; role membership is separate from administrator rights.
- UI visibility follows server-returned capabilities, never locally inferred role names.
- Policy numbers (deposits, `PLATFORM_COMMISSION_RATE`, reviewer thresholds) live only in `CodeMartV1Constants.php` and reach the UI through the bootstrap/public policy; page copy never hardcodes them.

## 3. Server contract

- One bootstrap projection returns account, roles, capabilities, state vocabulary (including `terminal_states`, `capability_roles`), policy (including `withdrawal_methods`) and onboarding truth (completed and next steps). The UI keeps no second copy of server-owned vocabulary (`contexts/CmBootstrapContext.tsx`).
- Canonical states, owned by the server:
  - Role: `pending -> active | rejected`; `active <-> suspended`.
  - AI analysis: `pending -> processing -> completed | failed`; `completed -> revision_requested -> pending`.
  - Project: `draft -> proposal_review -> funding_pending -> open -> in_progress -> completed -> archived`; `open/in_progress -> paused -> in_progress`; `draft/open/paused/funding_pending -> cancelled` (cancel refunds the unused escrow remainder).
  - Task: `open -> assigned -> in_progress -> review -> completed`; `review -> in_progress`; `assigned/in_progress/review -> blocked -> in_progress`; `open/assigned/in_progress/blocked -> cancelled`.
  - Submission: `pending_review -> approved | needs_revision | rejected`.
  - Payment: `pending -> processing -> completed | failed`; `pending/processing -> cancelled`; `completed -> disputed -> refunded | completed`.
- Every mutation checks the expected current state. Task acceptance is atomic (one developer per open task) and requires an active developer role; tasks reach the marketplace only when the project is open.
- Idempotency: deposits, payments, funding, refunds, withdrawals and AI proposal accept honor `Idempotency-Key` (`CodeMartV1FinanceService::idempotencyKey`) and replay the prior result or return a precise conflict.
- Relation checks: task create/update, submission and submission review verify the caller's relation to the project or task; assigned developers can read the related project; only the payee reads or invoices a payment.
- AI analysis runs asynchronously; accepting a proposal moves the project to `funding_pending`. When the analysis task is disabled (`codemartv1_ai_analysis_enabled`, an operator setting), the response carries `analysis_available: false`, the UI stops polling, and the client may continue with the own budget (`POST /projects/{id}/confirm-budget`). Rows left in `processing` are resumed when the operator re-enables the task.
- Every API error carries an `error_code` translated in `cm-locales` `errors`; validation attribute names are translated in `lang/zh_CN/validation.php`. Only the generic authentication (401), administrator (403) and unmatched-route (404) answers carry no `error_code`; the UI falls back to a status message for them. Numeric route parameters are constrained in the route group, so a non-numeric id is a 404, never a 500.
- Domain notifications cover tasks, submissions, reviews, analysis, payments, refunds and role events; every state transition writes an activity entry.
- Escrow headroom: a task create or update that exceeds the project's funded escrow fails with `escrow_insufficient` (409); the milestone budget is informational. Completing a milestone with unfinished tasks returns `milestone_tasks_unfinished`, completing a project with unfinished tasks returns `project_tasks_unfinished`; a milestone without tasks can be completed.
- Invoices: `POST` on a payment creates one invoice and a repeat returns the same invoice; `tax` is an absolute nullable amount added to the total, unknown fields are ignored.
- Rate limits (`CodeMartV1Constants`): public reads `THROTTLE_PUBLIC` 120/min, registration 10/min, contact 5/min, email resend 3/10 min, each in its own bucket; the UI maps 429 to localized messages.
- Cache and locks: CodeMart uses the project default cache store (`LaravelConfig::CACHE_STORE`, `failover`) and the default limiter; money correctness relies on database `lockForUpdate` inside transactions, with no Redis lock. The queue connection is `sync`.

## 4. Money and trust rules

- Wallet, escrow, payment, refund, withdrawal and deposit changes happen only on the server; the UI shows server decimals and never computes financial truth.
- Ledger entries are immutable; corrections are compensating entries. Ledger text is rendered from `description_code` and params (names, titles) in both server lang files and `cm-locales` `wallet.ledger.*`.
- A deposit becomes paid only by administrator confirmation (or a gateway callback); users never confirm their own deposit. Deposit methods: `DEPOSIT_PAYMENT_METHODS` (bank transfer with `CMDEP-` reference); purpose `wallet` is a wallet top-up.
- Funding moves the accepted amount from the client wallet into escrow and opens the project; client approval of a task releases its amount minus commission to the developer.
- Refunds: one open refund per payment; approve and process are separate administrator transitions; processing debits the payee (or escrow) and credits the payer, and the payment ends `refunded`.
- Withdrawals freeze funds on request and settle when the administrator marks them paid.
- KYC documents are stored on the private disk `KYC_PRIVATE_DISK` and streamed only to administrators; `sys:init` moves KYC files found on the public disk to the private disk (`CodeMartV1FileUploadService::copyLegacyKycFileToPrivate`).

## 5. Flows

- Client: sign in -> onboarding -> draft -> attachments -> AI analysis (or own budget) -> accept proposal -> fund -> publish -> milestones/tasks (direct or architect) -> review submissions -> escrow release -> complete/archive.
- Developer: activation -> marketplace -> atomic accept -> start/block/unblock -> comment -> submit -> approved (paid) or needs revision (resubmit) -> withdrawal.
- Architect: eligibility -> application -> deposit -> activation -> accept architecture project -> milestones/tasks.
- Reviewer: application -> qualification exercise (sample snippets scored on quality, readability, efficiency) -> queue -> dimensional scores plus recommendation. The review is advisory: it never changes submission or task state and never moves money; the client's decision (approve, needs revision, reject) does (`CodeMartV1TaskCtl::reviewSubmission`).
- Administrator: console -> KYC -> deposit confirm/reject/refund -> role status with reason -> refunds -> withdrawals -> disputed payments -> project intervention (pause/resume/cancel/archive with reason) -> testimonials -> reviewer applications (revoke) -> contact messages -> activity log.
- Further capabilities: owner project editing; project creation with dates, required skills and stack, opening the project afterwards; project attachments upload, list and download; milestone create, edit and complete (deliverables stored as structured data); task required skills used by the marketplace filter; task comments and last review notes shown for resubmission; architect statistics updated on approvals and completions; payee-only invoices; user refund list with status; per-role deposit information with policy amounts and bank-transfer instructions (`GET /deposits/{id}/bank-info`); withdrawal requests and history; testimonial submission by clients of completed projects with administrator moderation (approve, hide, sort order); profile edits limited to held-role blocks plus client company fields; phone verification rejects already verified numbers; public estimate with server options, budget type, formatted amounts and team as role counts.
- Registration: role selection, optional super code (a wrong code is rejected, not ignored), returns a ready session; password reset through the shared account API; role request for existing accounts; email verification with resend (`POST /auth/resend-verification-email`), phone code, KYC submission (document type, number, legal name, birth date, front/back/selfie images with upload progress) with duplicate-number rejection.

## 6. Page map

- Public (`/codemart/...`): home (hero slider, live counters from `GET /public/home` counting published projects and escrowed funds, approved localized testimonials), about, delivery-process, services, estimate (options and result from the server), showcase (open tasks and completed projects without client identity), information (contact form), privacy, terms, download (hides unavailable packages), login, register, forgot-password, password-reset.
- Workspace (capability gate per page): dashboard (role-aware counters, next onboarding step, shortcuts per held role), marketplace (`task.browse`), projects and project create (`project.read`, `project.create`), project detail (overview, attachments, analysis, milestones, tasks, submission review, transitions), tasks (`task.read`), reviews (`review.read`), architect (`architect.read`), wallet (`finance.read`: balances, per-role deposits, transactions, payments, invoices, refunds, withdrawals), verification (`onboarding.read`), profile, notifications (pagination, unread badge, deep links), settings (language, appearance).
- Administration console (administrators only): overview, users and user detail, KYC (private document viewer), deposits, refunds, withdrawals, payments and escrow (dispute resolve), projects, testimonials, reviewer applications, contact messages, read-only policy, activity.
- Deferred and never shown as navigation: direct messaging, public social profiles, advanced search ranking, source-control automation, arbitration, multi-party organizations, extra payment gateways.

## 7. Access and page quality standard

- CodeMart has its own sign-in page `/codemart/login` (username or email, show password, error states, links to register and reset) on the shared account API. Protected pages send signed-out visitors there with the return path kept in the query and tab session storage (`auth/cmAuthSession.ts`); a 401 returns there too; sign-out exists in workspace and console.
- A missing capability shows a localized "not available for your roles" page with the way to obtain the role; non-administrators get a localized access-denied page on the console. Hiding navigation is never the only protection.
- Every page has a document title and description, heading and one-line purpose (`components/workspace/CmPageHeader.tsx`, `useCmPageTitle`), loading, empty and error states (retry only where it helps, not on 403/404), and a primary next action.
- Copy is accurate to real behavior, plain and specific: no invented statistics, names, awards or guarantees, no marketing filler; legal pages describe this installation's real data handling, escrow and refunds.
- Every visible string comes from `cm-locales` (English and natural Chinese); the language switcher offers en and zh only. Fixed terminology: client 客户, developer 开发者, architect 架构师, reviewer 评审员, administrator 管理员, project 项目, milestone 里程碑, task 任务, submission 交付物, marketplace 任务市场, deposit 保证金, escrow 托管资金, wallet 钱包, withdrawal 提现, refund 退款, invoice 发票, KYC 实名认证, proposal 方案, AI analysis AI 需求分析.
- Layout works at 390, 768, 1024 and 1366 px without horizontal page scroll (tables scroll inside their card), in light and dark mode; numbers, money and dates are locale-formatted (`Intl.NumberFormat` currency style in `cmWorkspaceFormat.ts`, CNY renders `¥` in zh and `CN¥` in en); statuses are translated badges.
- Images: 16 WebP page images in `assets/images/` (hero, about, services, process, estimate, showcase, download, contact, auth, admin and empty-workspace scenes; the home hero rotates every `HERO_ROTATION_MS` 7000) and 28 icons in `assets/icons/` with prefixes `nav-` (navigation and shortcuts), `feature-` (dashboard metrics), `category-` (project complexity) and `empty-` (empty states), clipped with a border radius in the UI; generated by `generate_cm_images.py` (single generator; default Laravel gateway `POST /api/local/ai/image`, `--gateway pycore` as the second path; `--provider`, `--group images|icons`, `--only a,b` to regenerate a badly drawn image, `--force`, `--dry-run`; the pycore gateway pins one OpenRouter image model so the style stays consistent), one flat style with no text, center-cropped, WebP, bundled by Vite (no external URLs), localized alt text, lazy below the fold, explicit size. Budgets: page images under 120 KB, icons 128x128 under 30 KB.

## 8. Demo data and secrets

- `sys:init` seeds the CodeMart demo dataset idempotently in every environment unless `services.codemart_seed_demo` (`LaravelConfig::CODEMART_SEED_DEMO`) is false; the switch is never in `.env`.
- Seven demo accounts `codemart_demo_{client,developer,architect,reviewer,admin,newdev,client2}`; ten projects cover every project state, with escrows, payments, refunds, invoices, withdrawals, notifications, activities, bilingual testimonials and contact messages whose ledgers match wallet balances.
- The seeded-account password is generated per `config/service_contract.json#codemart_admin_password` (deploy step 175) and applied by `php artisan codemart:admin-password`; no password is written in any document.
- Initialization modifies existing tables in place and never drops them; no CodeMart data or Flutter reference source is deleted.

## 9. Verification

- UI `http://127.0.0.1:13054/codemart`, API `http://127.0.0.1:9000/api/codemart/v1`; a loopback or LAN UI origin selects that host's API on port 9000 unless the browser stored a manual endpoint.
- After PHP edits: `curl -s -X POST http://localhost:2019/frankenphp/workers/restart`. Type check: `cd poly_apps/pycore_laravel_wordnew_ui && node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- Live tests (repository: `poly_apps/pycore_laravel_wordnew_ui/apps/codemart/tests/`, shared helpers in `lib/`):
  - API flow sweep `flows.mjs` (`bun run test:codemart:flows`, plain Node): registers its own `cmtest_<run>` users, funds wallets through admin-confirmed top-ups, drives every section 5 flow (client, developer race, architect, reviewer advisory, admin console, public, auth, invoices, refunds, withdrawals, relation checks), asserts state transitions, wallet balances and ledger invariants, the `error_code` contract and no 5xx, then cancels leftover `cmtest_` projects and suspends `cmtest_` developer/architect/reviewer roles. It signs in as `codemart_demo_admin` for admin actions (password from `CM_TEST_PASSWORD`, `CM_TEST_PASSWORD_FILE` or the `codemart_admin_password` secret file; never printed) and revokes every session token it created. Registration is throttled per IP (10/min), so the run waits as needed.
  - UI crawl `crawl.mjs` (`bun run test:codemart:crawl`; needs bun and Chrome, re-executes itself under bun): every public page, every workspace page (capability gates parsed from `cmPages.tsx`, expected access derived from each account's `GET /bootstrap`), project detail per project state, admin pages and admin denial, for the 7 demo accounts in en and zh at 390/768/1024/1366 px plus a dark pass at 390/1366; checks failed requests, console errors, raw i18n keys, `{{placeholders}}`/undefined, horizontal overflow, broken images, titles and descriptions, `html lang`, signed-out redirect with return path, return after sign-in and expired-token redirect. Options: `--accounts`, `--langs`, `--widths`, `--only <regex>`, `--no-dark`, `--concurrency`, `--json`, `--selftest` (proves the detectors fire).
  - Results of the last run: flow sweep 476 checks, 0 failures; crawl about 620 page loads per full run (about 10 minutes), 0 issues. Both leave `cmtest_` users, one completed and archived `cmtest_main` project per run and admin-visible activity behind; deleting them needs approval.

## Open items

- Live QA still unchecked (checklist numbering kept for tracking): 2.8 submission review messages in the UI (the API states, release amounts and commission are covered by `flows.mjs`); 7.1-7.2 review of `cm-locales` en/zh copy for vague, promotional or jargon wording ("server policy", "installation", "capability", "idempotent", 一站式, 赋能, 无缝, 闭环, 打造) with zh terminology 托管 / 注资 / 保证金 / 交付物 / 评审员 / 架构师 / 里程碑 / 提现 / 充值 kept consistent; 7.3 realistic `CodeMartV1DemoSeeder.php` content with stable `firstOrNew` title keys; 7.4 plain wording in `lang/en|zh_CN/codemart.php` including mail texts and no English inside zh; 7.5 page titles and descriptions through `useCmPageTitle`; 8.1-8.6 dark mode on every page, 390/768/1024/1366 px without horizontal scroll, states on every list (retry not on 403/404), keyboard use (focus, Escape, Enter, aria labels), CNY formatting, a full en/zh crawl with zero console errors, failed requests, raw keys or `{{placeholders}}`; 10.1-10.3 finish (type check and PHP lint clean, workers restarted, crawl and flow sweep pass, delete `cm_kimi_test` tokens, record per-section results).
- Not covered by the automated tests: positive email verification (`MAIL_MAILER=log`, the token never reaches the API), the registration with the installation super code (it would create a permanent administrator), phone OTP (no SMS provider), the AI analysis path while the operator task is disabled (the sweep asserts `analysis_unavailable` 503 and `confirm-budget`; with the task enabled it runs analyze, poll, accept and replay), architect self-application (needs the 10-project track record; the sweep grants the role as administrator), and interactive UI actions (buttons, forms, submission-review messages: the crawl only loads pages). The Laravel log is `/www/wwwroot/laravel_db/logs/laravel-<date>.log` (server date) and the UI token is `localStorage.app_auth_token`.
- Server note: `AvatarService` calls api.dicebear.com on registration with a 2-3 s timeout, so registration is slow on hosts without outbound access (not a CodeMart defect, the avatar falls back locally).
- Workspace pages (K3) are polished in code; the en/zh crawl at 390/1000/1280 px for all seven demo accounts that marks them verified is pending.
- Server vocabulary copies: `admin/CmAdminTypes.ts` keeps `CM_ADMIN_ACTIVITY_ACTIONS`, `CM_ADMIN_ACTIVITY_RESOURCES` and `CM_ADMIN_RESOURCE_STATE_GROUPS` locally; they belong in the bootstrap vocabulary (cmdesign-03).
- The Laravel image gateway fails on hosts whose FrankenPHP PHP has no CA bundle (`curl.cainfo`/`openssl.cafile` empty), so icons are generated through the pycore gateway; the CA bundle belongs to the shell installers.
- Phone OTP delivery: no SMS provider implementation exists (`CodeMartV1Constants::SMS_PROVIDERS` is empty; `CodeMartV1OtpService::sendOtpSms` reports failure and never logs the code), so phone verification stays optional in onboarding (`smsDeliveryAvailable()` requires `CODEMART_SMS_PROVIDER` to name a listed provider) until a provider is added.
- Data cleanup of test data needs user approval: test projects (ids 2, 11-15, 19-22), `cmtest_*`/`cmui*`/`cmkimi*` users, "UI Tester"/"Kimi" contact messages, deposits 12-16, refund 3, testimonial 5, reviewer applications 3-4.

# CodeMart Design

Scope: the CodeMart managed software-delivery marketplace: the UI app in the pycore/Laravel/wordnew UI shell, the Laravel `CodeMartV1` backend, their integration, and the page quality standard.

Authority: code > config/*_contract.json > this document.

Detailed working records, owned by `codemart-lead` and linked rather than copied: `docs_fix/codemart_docs/` (gap tracker `PROGRESS_20260927_CODEMART_GAP_COMPLETION.md`, page inventory `PROGRESS_20260927_CODEMART_PAGE_POLISH.md`, live QA checklist `TODO_20260930_CODEMART_FULL_CHECKLIST.md`, functional design copy, and `flutter_reference/`, which is reference material only and never the target frontend).

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

A client turns a requirement into a funded project; an architect may structure it into milestones and tasks; qualified developers accept open tasks and submit deliverables; qualified reviewers assess submissions; the platform enforces authorization, state transitions, money movement and audit history. CodeMart ships as an app in the unified shell (public surface, user workspace, separate administration console) and as a Capacitor build.

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
- Every API error carries an `error_code` translated in `cm-locales` `errors`; validation attribute names are translated in `lang/zh_CN/validation.php`.
- Domain notifications cover tasks, submissions, reviews, analysis, payments, refunds and role events; every state transition writes an activity entry.
- Rate limits (`CodeMartV1Constants`): public reads `THROTTLE_PUBLIC` 120/min, registration 10/min, contact 5/min, email resend 3/10 min, each in its own bucket; the UI maps 429 to localized messages.
- Cache and locks: CodeMart uses the project default cache store (`LaravelConfig::CACHE_STORE`, `failover`) and the default limiter; money correctness relies on database `lockForUpdate` inside transactions, with no Redis lock. The queue connection is `sync`.

## 4. Money and trust rules

- Wallet, escrow, payment, refund, withdrawal and deposit changes happen only on the server; the UI shows server decimals and never computes financial truth.
- Ledger entries are immutable; corrections are compensating entries. Ledger text is rendered from `description_code` and params (names, titles) in both server lang files and `cm-locales` `wallet.ledger.*`.
- A deposit becomes paid only by administrator confirmation (or a gateway callback); users never confirm their own deposit. Deposit methods: `DEPOSIT_PAYMENT_METHODS` (bank transfer with `CMDEP-` reference); purpose `wallet` is a wallet top-up.
- Funding moves the accepted amount from the client wallet into escrow and opens the project; client approval of a task releases its amount minus commission to the developer.
- Refunds: one open refund per payment; approve and process are separate administrator transitions; processing debits the payee (or escrow) and credits the payer, and the payment ends `refunded`.
- Withdrawals freeze funds on request and settle when the administrator marks them paid.
- KYC documents are stored on the private disk `KYC_PRIVATE_DISK` and streamed only to administrators; `sys:init` moves older public-disk files to the private disk (`CodeMartV1FileUploadService::copyLegacyKycFileToPrivate`).

## 5. Flows

- Client: sign in -> onboarding -> draft -> attachments -> AI analysis (or own budget) -> accept proposal -> fund -> publish -> milestones/tasks (direct or architect) -> review submissions -> escrow release -> complete/archive.
- Developer: activation -> marketplace -> atomic accept -> start/block/unblock -> comment -> submit -> approved (paid) or needs revision (resubmit) -> withdrawal.
- Architect: eligibility -> application -> deposit -> activation -> accept architecture project -> milestones/tasks.
- Reviewer: application -> qualification exercise (sample snippets scored on quality, readability, efficiency) -> queue -> dimensional scores plus recommendation. The review is advisory: it never changes submission or task state and never moves money; the client's decision (approve, needs revision, reject) does (`CodeMartV1TaskCtl::reviewSubmission`).
- Administrator: console -> KYC -> deposit confirm/reject/refund -> role status with reason -> refunds -> withdrawals -> disputed payments -> project intervention (pause/resume/cancel/archive with reason) -> testimonials -> reviewer applications (revoke) -> contact messages -> activity log.
- Further capabilities: owner project editing; project creation with dates, required skills and stack, opening the project afterwards; project attachments upload, list and download; milestone create, edit and complete (deliverables stored as structured data); task required skills used by the marketplace filter; task comments and last review notes shown for resubmission; architect statistics updated on approvals and completions; payee-only invoices; user refund list with status; per-role deposit information with policy amounts and bank-transfer instructions (`GET /deposits/{id}/bank-info`); withdrawal requests and history; testimonial submission by clients of completed projects; profile edits limited to held-role blocks plus client company fields; phone verification rejects already verified numbers; public estimate with server options, budget type, formatted amounts and team as role counts.
- Registration: role selection, optional super code (a wrong code is rejected, not ignored), returns a ready session; password reset through the shared account API; role request for existing accounts; email verification with resend (`POST /auth/resend-verification-email`), phone code, KYC submission with duplicate-number rejection.

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
- Layout works at 390, 768, 1024 and 1366 px without horizontal page scroll (tables scroll inside their card), in light and dark mode; numbers, money and dates are locale-formatted; statuses are translated badges.
- Images: generated by `generate_cm_images.py` (single generator; default Laravel gateway `POST /api/local/ai/image`, `--gateway pycore` as the second path; `--group icons`, `--only`, `--force`, `--dry-run`), one flat style with no text, center-cropped, WebP, bundled by Vite (no external URLs), localized alt text, lazy below the fold, explicit size. Budgets: page images under 120 KB, icons 128x128 under 30 KB.

## 8. Demo data and secrets

- `sys:init` seeds the CodeMart demo dataset idempotently in every environment unless `services.codemart_seed_demo` (`LaravelConfig::CODEMART_SEED_DEMO`) is false; the switch is never in `.env`.
- Seven demo accounts `codemart_demo_{client,developer,architect,reviewer,admin,newdev,client2}`; ten projects cover every project state, with escrows, payments, refunds, invoices, withdrawals, notifications, activities, bilingual testimonials and contact messages whose ledgers match wallet balances.
- The seeded-account password is generated per `config/service_contract.json#codemart_admin_password` (deploy step 175) and applied by `php artisan codemart:admin-password`; no password is written in any document.
- Initialization modifies existing tables in place and never drops them; no CodeMart data or Flutter reference source is deleted.

## 9. Verification

- UI `http://127.0.0.1:13054/codemart`, API `http://127.0.0.1:9000/api/codemart/v1`; a loopback or LAN UI origin selects that host's API on port 9000 unless the browser stored a manual endpoint.
- After PHP edits: `curl -s -X POST http://localhost:2019/frankenphp/workers/restart`. Type check: `cd poly_apps/pycore_laravel_wordnew_ui && node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- Live checks: headless crawl of every page per demo account in en and zh (no failed API call, raw key, placeholder or horizontal overflow), signed-out redirects with return, capability and admin denial pages, and the API flow sweep. Test tokens are Sanctum tokens named `cm_kimi_test`, deleted afterwards.

## Open items

- Live QA passes in `codemart_docs/TODO_20260930_CODEMART_FULL_CHECKLIST.md` still unchecked: 2.8 submission review messages, 7.1-7.5 content and terminology review (UI copy, zh phrasing, seeder content, server messages, page titles), 8.1-8.6 cross-cutting UI checks (dark mode, widths, states, keyboard, CNY format, full crawl), 10.1-10.3 finish (type check, lint, crawl, `flows.mjs`, delete `cm_kimi_test` tokens).
- Workspace pages (K3) are polished in code; the en/zh crawl at 390/1000/1280 px for all seven demo accounts that marks them verified is pending.
- The Laravel image gateway fails on hosts whose FrankenPHP PHP has no CA bundle (`curl.cainfo`/`openssl.cafile` empty), so icons were generated through the pycore gateway; the CA bundle belongs to the shell installers.
- Data cleanup of test projects, users, deposits and messages listed in the checklist section 9 needs user approval.

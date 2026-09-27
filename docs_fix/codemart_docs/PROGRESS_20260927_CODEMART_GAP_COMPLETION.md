# CodeMart Gap Audit and Completion Progress

Date: 2026-09-27
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`
Test target: interface `http://127.0.0.1:13054/codemart`, API `http://127.0.0.1:9000/api/codemart/v1`

This record lists the functions found missing or broken by a full audit of
the three CodeMart surfaces (user workspace, administration console, public
web showcase) across interface and server, and tracks their completion.
Earlier records marked several of these functions as done; this audit
supersedes those statuses.

Status legend: `open` not started, `wip` in progress, `done` implemented,
`verified` tested live on the local installation, `missing` not in the
code yet (owner task named), `superseded` replaced by a later ruling.
Section 8 reconciles every open row with the code (D9, 2026-09-27).

Work packages: S1 server money and trust, S2 server delivery flow,
S3 server administration and public, U1 user workspace interface,
U2 administration interface, U3 public interface, D1 data seeding.

## Summary

| Surface | Security/money defects | Missing functions | Partial functions |
| --- | --- | --- | --- |
| User workspace | 7 | 14 | 9 |
| Administration console | 5 | 9 | 5 |
| Public web showcase | 2 | 6 | 7 |

## 1. Security and money defects (highest priority)

| ID | Defect | Pkg | Status |
| --- | --- | --- | --- |
| G01 | Any user can confirm their own deposit and activate a role without an administrator | S1 | verified |
| G02 | Architect activation can be self-granted through the self-confirmed deposit; architect deposits are never recorded under the architect role | S1 | done |
| G03 | Refund approval and processing only require a low role level instead of administrator authorization | S1 | verified |
| G04 | Refund processing credits the payer without debiting the payee (creates money); payment ends as cancelled instead of refunded; no locking | S1 | verified |
| G05 | One payment can receive unlimited refund requests; payment status is not checked | S1 | verified |
| G06 | Any signed-in user can read any payment by id | S1 | verified |
| G07 | Wallet-to-wallet payment holds funds and then withdraws again (fails or double-deducts, frozen funds stuck) | S1 | verified |
| G08 | Task creation, update, submission, and submission review never check the caller's relation to the project/task | S2 | verified |
| G09 | Deliverable files are stored from the wrong request source | S2 | done |
| G10 | Identity (KYC) documents are stored on public storage | S3 | done for new uploads; legacy rows missing (CMDES-08, see 8.1) |
| G11 | Public estimate and registration have no rate limiting | S3 | done |
| G12 | A wrong administrator super code is silently ignored at registration | S3 | verified |

## 2. User workspace

| ID | Function | Interface | Server | Pkg | Status |
| --- | --- | --- | --- | --- | --- |
| U01 | Project funding: client funds an accepted proposal into escrow, project moves to open | missing | missing | S1+U1 | verified |
| U02 | Escrow release to the developer on client approval of a task | n/a | missing | S1 | verified |
| U03 | Proposal review state set when analysis completes; accept only from proposal review | n/a | missing | S2 | done |
| U04 | Latest AI analysis per project retrievable from the server (no local-only tracking) | partial | missing | S2+U1 | done |
| U05 | Client reviews submissions per task (approve / needs revision / reject) with notes | missing | exists | U1 | verified |
| U06 | Reviewer review is advisory: scores and a recommendation shown to the client, who decides the submission and task state | n/a | broken | S2 | verified (advisory, see 8.1) |
| U07 | Task transitions: start work, block, unblock, cancel (state-checked) | missing | missing | S2+U1 | verified |
| U08 | Task panel shows comment thread and last review notes for resubmission | missing | exists | U1 | verified |
| U09 | Project transitions: pause, resume, cancel, complete, archive (state-checked) | missing | missing | S2+U1 | verified |
| U10 | Milestone edit and completion | missing | missing | S2+U1 | done |
| U11 | Project attachments upload and listing | missing | partial | S2+U1 | done |
| U12 | Project creation sends dates, skills, stack; opens the project after creation | partial | exists | U1 | done |
| U13 | Task required skills stored and used by the marketplace filter | missing | missing | S2+U1 | verified |
| U14 | Tasks reach the marketplace only when the project is open | n/a | wrong | S2 | verified |
| U15 | Marketplace acceptance requires an active developer role | n/a | missing | S2 | verified |
| U16 | Assigned developers can read the related project | n/a | forbidden | S2 | done |
| U17 | Developer payout / withdrawal request and history | missing | missing | S1+U1 | verified |
| U18 | Invoice list (payee only creates invoices) | missing | missing | S1+U1 | done |
| U19 | User refund request list with status | missing | missing | S1+U1 | done |
| U20 | Deposit information per role with correct policy amounts; deposit for a chosen role | wrong | wrong | S1+U1 | done |
| U21 | Bank-transfer deposit instructions reachable | dead link | missing | S1+U1 | done |
| U22 | Domain notifications for tasks, submissions, reviews, analysis, payments, refunds | n/a | missing | S2 | verified |
| U23 | Notifications pagination, unread badge, deep links | partial | exists | U1 | done |
| U24 | Architect statistics updated on approvals and completions | n/a | missing | S2 | done |
| U25 | Architect eligibility shows client satisfaction; assignments link to project detail | broken | exists | U1 | done |
| U26 | Reviewer / architect application entry visible to eligible developers | missing | exists | U1 | done |
| U27 | Role request for existing accounts (become developer / client) | missing | missing | S3+U1 | done |
| U28 | Email verification resend and registration status on the verification page | missing | exists | U1 | done for verify and status; resend missing (cmgap-R1, see 8.1) |
| U29 | Profile edits send only the blocks of held roles; client company fields | partial | exists | U1 | done |
| U30 | Idempotency key honored for deposits, payments, funding, analysis accept, refunds | missing | missing | S1+U1 | verified except analysis accept, which is missing (cmgap-U30, see 8.1) |
| U31 | Translated wallet transaction types, milestone states, server error codes | partial | n/a | U1 | done; ledger description codes are open in the UI (CKA-28-ui, see 8.1) |
| U32 | Milestone deliverables stored as structured data | n/a | bug | S2 | done |

## 3. Administration console

| ID | Function | Interface | Server | Pkg | Status |
| --- | --- | --- | --- | --- | --- |
| A01 | Refund approve / reject / process under administration | missing | misplaced | S1+U2 | verified |
| A02 | Deposit reject and deposit refund; confirming administrator recorded | missing | missing | S1+U2 | done |
| A03 | Withdrawal requests review and processing | missing | missing | S1+U2 | verified |
| A04 | Payments, escrows, and disputed payments listing with resolve actions | missing | missing | S1+U2 | done |
| A05 | Project intervention: pause / resume / cancel / archive with reason | missing | missing | S3+U2 | done |
| A06 | User detail: profile, roles, KYC, deposits, wallet, projects | missing | missing | S3+U2 | done |
| A07 | Role status transitions enforced (pending to active/rejected, active to suspended and back) with reason and confirmation | partial | weak | S3+U2 | done |
| A08 | KYC review only for pending items, reject reason, private document viewer | partial | weak | S3+U2 | done |
| A09 | Testimonial moderation: list, approve, hide, order | missing | missing | S3+U2 | done |
| A10 | Reviewer applications oversight with revoke | missing | missing | S3+U2 | done |
| A11 | Read-only platform policy (deposits, commission) | missing | missing | S3+U2 | done |
| A12 | Audit activity log written on every administrator mutation and listed | missing | missing | S3+U2 | done |
| A13 | Overview shows projects by status | missing | exists | U2 | done |
| A14 | Pagination and role/status filters on all lists; error states | partial | exists | U2 | done |
| A15 | Administration gate waits for bootstrap and denies non-administrators | partial | ok | U2 | done |
| A16 | Contact messages inbox | missing | missing | S3+U2 | verified |

## 4. Public web showcase

| ID | Function | Interface | Server | Pkg | Status |
| --- | --- | --- | --- | --- | --- |
| P01 | CodeMart registration form with role selection and optional super code | missing | exists | U3 | verified |
| P02 | Forgot password link and reset flow | missing | exists (shared) | U3 | done |
| P03 | Public showcase: open tasks and completed projects (redacted) | missing | missing | S3+U3 | verified |
| P04 | Public statistics count only published projects and protected (escrowed) funds; active developer label | wrong | wrong | S3+U3 | verified |
| P05 | Contact form on the information page | missing | missing | S3+U3 | verified |
| P06 | Testimonial submission by clients of completed projects; localized testimonials | missing | missing | S3+U1 | done |
| P07 | Estimate options loaded from the server; budget type used; formatted amounts; team as role counts | partial | partial | S3+U3 | verified |
| P08 | Consistent public header, footer, and mobile menu on every public page | partial | n/a | U3 | done |
| P09 | Protected links from the public surface ask for sign-in first | partial | n/a | U3 | done |
| P10 | Page titles and descriptions per public page | missing | n/a | U3 | done |
| P11 | Download page hides unavailable app packages | risk | n/a | U3 | done |
| P12 | Statistics error state with retry | weak | n/a | U3 | done |

## 5. Data seeding

| ID | Function | Pkg | Status |
| --- | --- | --- | --- |
| D01 | System initialization seeds the CodeMart dataset idempotently (accounts, roles, wallets, deposits, projects in every state, milestones, tasks, submissions, reviews, escrows, payments, refunds, withdrawals, notifications, testimonials in both languages, reviewer application) | D1 | superseded by D17 for the password and the switch (see 8.1); the dataset itself stays verified |
| D02 | Seeded data exercises every new function above | D1 | verified |

## 6. Verification log

Entries are appended as functions are verified live.

- 2026-09-27: server packages S1, S2, S3 implemented; all CodeMart PHP files
  pass syntax check; 112 CodeMart routes registered; the CodeMart system
  initialization step aligned 16 tables (new: withdrawals, contact
  messages), 5 status constraints, and verified 30 tables; API workers
  reloaded and new public endpoints (showcase, estimate options) respond.
- 2026-09-27: interface API target: when the interface is opened from a
  loopback or LAN address it now selects that host's API on port 9000 by
  default (previously the first remote domain was chosen on a fresh
  browser). A browser that already stored a manual selection keeps it until
  switched in the API endpoint switcher. Verified: a fresh headless browser
  on `http://127.0.0.1:13054/codemart` calls `http://127.0.0.1:9000`.
- 2026-09-27: data seeding moved into the CodeMart system initialization
  step (runs on every system initialization, idempotent) in every
  environment, production included. The switch and the password in this
  entry are superseded by D17 (see 8.1): the switch is the config file
  value `services.codemart_seed_demo`, and the password is generated.
  Seven demo accounts: client, developer,
  architect, reviewer, admin, newdev (pending role/deposit/KYC), client2
  (completed project, pending testimonial). Ten projects cover every project
  state; escrows, payments, refunds, invoices, withdrawals, notifications,
  activities, bilingual testimonials, and contact messages are seeded with
  ledgers matching wallet balances. Repeated runs verified identical.
- 2026-09-27: interface packages U1, U2, U3 implemented; the type check
  reports no errors in the CodeMart interface.
- 2026-09-27: live verification on `http://127.0.0.1:13054/codemart` with
  API `http://127.0.0.1:9000`:
  - Headless-browser crawl: 12 public pages, 14 administration pages, and
    every workspace page for all seven demo accounts, in English and
    Chinese, rendered without failing API calls or untranslated keys; all
    nine project detail pages (every project state) rendered.
  - API flow runs (48 checks passed; three first-run failures were test-side
    field names, a strict status assertion, and the rate limit, re-run green): self-confirm deposit and user refund
    approval removed; administration denied to non-administrators; foreign
    payment read denied; project funding into escrow with idempotent
    replay; milestone and task creation with skills; marketplace
    visibility only for open projects; pending developer cannot accept;
    submit before start and non-assignee submit rejected; reviewer advisory
    review with duplicate guard; client sees the recommendation; revision
    returns the task to in progress; client approval releases escrow net of
    commission to the developer; notifications delivered; invalid project
    transition rejected, pause and resume work; wallet payment, refund
    request, duplicate refund blocked, administrator approve and process
    (payee debited, payment refunded); withdrawal request, approve, pay;
    administrator deposit confirmation; wrong super code rejected;
    registration returns a session; contact message reaches the
    administration inbox; showcase, hourly estimate with team roles, and
    Chinese testimonials with escrow-based protected funds.
  - Interface registration form: creates the account, adopts the session,
    and opens the verification page.
- 2026-09-27: fixes from live testing: public rate limits now use separate
  per-group buckets (public reads 120/min, registration 10/min, contact
  5/min) because a shared bucket made registration fail after browsing;
  public header no longer overflows at 1000-1320 px and drops the
  redundant signed-out workspace button; on phones the workspace and
  administration top bars no longer duplicate the theme and language
  controls, and wide administration tables scroll inside their card.

## 7. Remaining items

- Email verification resend needs a server endpoint (currently verify with
  token and registration status only). Status: missing, in progress as
  cmgap-R1 (codemart-laravel) and cmgap-R1-ui (codemart-ui).
- The return path after the shared sign-in is kept in memory only.
  Status: done (PAGE_POLISH K1: query parameter plus tab session storage,
  `auth/cmAuthSession.ts:26-38`, read back in `pages/CmLoginPage.tsx:52`).
- Deposit and refund rows in the administration console show user ids,
  not usernames. Status: done (PAGE_POLISH K4: `userSummaries`,
  `CodeMartV1AdminService.php:103`, used by `refundsPage` :625-642 and
  `depositsPage` :661-678).

## 8. D9 reconciliation (2026-09-27, codemart-lead G1)

Every open row, remaining item and `superseded (ID)` reference in
`docs_fix/codemart_docs/` is matched to the code below. Line numbers are
from this check; codemart-laravel and codemart-ui edit the same files in
G1, so they drift.

### 8.1 Rows

| Item | Status | Evidence |
| --- | --- | --- |
| 7 resend (U28) | missing | `routes/CodeMartV1Router/api.php:49` has only the phone verification request; tasks cmgap-R1 and cmgap-R1-ui (G1) |
| 7 return path | done | `apps/codemart/auth/cmAuthSession.ts:26-38`, `pages/CmLoginPage.tsx:52` |
| 7 deposit and refund usernames | done | `CodeMartV1AdminService.php:103`, :625-642, :661-678 |
| U06 reviewer review | done, advisory | `CodeMartV1ReviewerCtl.php:153-156`: scores plus an optional recommendation shown to the client; the review never changes the submission or task state and never releases money; the client decides |
| U05 client review of submissions | verified | `CodeMartV1TaskCtl.php:615` (`reviewSubmission`): the client decision drives the submission and task state |
| U30 analysis accept idempotency | missing | `CodeMartV1AIAnalysisCtl.php:210` (`acceptProposal`) reads no Idempotency-Key; the column exists (`CodeMartV1Initializer.php:408`, `accept_idempotency_key`); tasks cmgap-U30 (codemart-laravel) and cmgap-U30-ui (UI side approved in ui-codemart-D7) |
| U30 other mutations | done | deposits `CodeMartV1DepositCtl.php:136`, payments `CodeMartV1PaymentCtl.php:111`, refunds :310, withdrawals :429, funding `CodeMartV1EscrowService.php:45-50` |
| Bootstrap vocabulary as the only copy (INTEGRATION "no local copy") | server done, UI missing | the bootstrap carries `terminal_states`, `capability_roles` and `policy.withdrawal_methods` (`CodeMartV1Constants.php:799,812,842`); the UI still keeps local lists (`admin/CmAdminTypes.ts:3-21`, `pages/CmWalletPage.tsx:30`, `pages/CmDashboardPage.tsx:30-31`); task cmdesign-03 (codemart-ui) |
| U31 ledger text | server done, UI open | ledger message codes confirmed in review laravel-codemart-D7 (CKA-28; that verdict is changes_requested for other items); CKA-28-ui renders them through cm-locales |
| G10 KYC documents | done for new uploads, legacy missing | `CodeMartV1Constants.php:297` private disk; `CodeMartV1FileUploadService.php:50` still reads the legacy public disk; the migration is CMDES-08 (codemart-laravel) |
| G04-G07, U01, U02, U19 money rows | done or verified | section 1 and 2 rows; funding and escrow release take row locks (8.2) |
| U22 notifications | verified | section 2 row U22 |
| A01 refunds | verified | section 3 row A01 |
| P01, P02 registration and reset | verified, done | section 4 rows P01, P02 |
| D01 password and switch | superseded (D17) | the password is generated per the contract `config/service_contract.json#codemart_admin_password` and applied by `codemart:admin-password` (`CodeMartV1AdminPasswordCommand.php:20`, `CodeMartV1AdminPassword.php:23`); no password is written in any document. The seeding switch is `services.codemart_seed_demo` (`config/services.php:27`, `LaravelConfig.php:58`, read at `CodeMartV1Initializer.php:547`), never `.env`. The seeder applies a newly generated password to the existing seeded accounts at once (review laravel-codemart-D7-fix, approved) |
| 0919 demo data text ("175 asks, default no") | superseded (D17) | seeding runs in the CodeMart system initialization step by default (D01 row) |

### 8.2 Backend Redis (D9 item 5)

Audit of `app/Apps/CodeMartV1` and `routes/CodeMartV1Router`:
`grep -rnE "Cache::store|Redis::|RateLimiter::for|->lock\(|cache\(\)->store"` finds nothing.
CodeMart names no cache store, driver, Redis call or cache lock:
- `CodeMartV1PublicHomeService.php:54-62` uses `Cache::remember` and `Cache::forget` on the default store.
- `THROTTLE_PUBLIC`, `THROTTLE_REGISTER` and `THROTTLE_CONTACT` (`CodeMartV1Constants.php:327-329`, used at `api.php:29,36,40`) use the default limiter store.
- Money operations keep `lockForUpdate` inside transactions: wallet `CodeMartV1WalletModel.php:77`, escrow `CodeMartV1EscrowService.php:52,142,176,278`, admin finance `CodeMartV1AdminFinanceService.php:65,254`, and the deposit, payment, refund, withdrawal, submission, milestone and project row locks.
- No queue use; the queue connection stays `sync` (D9-06).

Per ruling D9-01/CKA-35 no Redis lock is added: the database row locks stay
the correctness boundary, and phpredis is missing on the server. CodeMart
reaches Redis only through the project default cache store, which
pycore-laravel moves to the failover store [redis, database] (D9-01). The
audit finds no CodeMart code change, so there is no codemart-laravel
follow-up.

Degradation check on this host (in-process, every change rolled back on the
`main` and `codemartv1` connections):
- Baseline before D9-01 (G1): `cache.default` = `database` (no failover store yet), `queue.default` = `sync`, `php -m` shows no redis and `extension_loaded('redis')` is false. public/home answers 200 through the HTTP kernel and is cached afterwards; a second call shows `X-RateLimit-Remaining` 119 then 118 of 120 (the `codemart_public` hit is counted); `CodeMartV1EscrowService::fundProject` on the seeded funding_pending project funds its escrow and takes the wallet row lock (`select * from "codemart_v1_wallets" where "user_id" = ? limit 1 for update`).
- After D9-01: pending on pycore-laravel. D9-01 has not landed (`config/cache.php:18` is still `LaravelConfig::CACHE_STORE`, `database`, and there is no failover store). The same probe re-runs in G3 and must show `cache.default` as the failover store with the same three results.

### 8.3 D22 choices (recorded, no questions asked)

- The pre-outage D7 work is reviewed first (ui-codemart-D7 approved; laravel-codemart-D7 changes requested, then laravel-codemart-D7-fix approved), then the G1 items.
- Icons: the single generator `generate_cm_images.py` with the Laravel gateway as its default (B9 d9-01b, no second generator); the pycore gateway stays as the second path.
- d9-02a and cmpolreq-13 are no longer deferred, because the local Laravel is up.
- The D17 password flow is applied locally (generated secret, `codemart:admin-password`).
- Redis follows D9-01 (8.2).
- CKA-28-ui renders the ledger codes through cm-locales.
- The temporary writer of the lang files is requested from the claude lead.
- The `docs_fix/` root copies of the CodeMart documents get their superseded marks from the orchestrator.

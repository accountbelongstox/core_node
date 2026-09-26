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
`verified` tested live on the local installation.

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
| G10 | Identity (KYC) documents are stored on public storage | S3 | done |
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
| U06 | Reviewer decision drives the submission and task state | n/a | broken | S2 | verified |
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
| U28 | Email verification resend and registration status on the verification page | missing | exists | U1 | done (verify with token and status; the server has no resend endpoint) |
| U29 | Profile edits send only the blocks of held roles; client company fields | partial | exists | U1 | done |
| U30 | Idempotency key honored for deposits, payments, funding, analysis accept, refunds | missing | missing | S1+U1 | verified |
| U31 | Translated wallet transaction types, milestone states, server error codes | partial | n/a | U1 | done |
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
| D01 | System initialization seeds the CodeMart dataset idempotently (accounts, roles, wallets, deposits, projects in every state, milestones, tasks, submissions, reviews, escrows, payments, refunds, withdrawals, notifications, testimonials in both languages, reviewer application) | D1 | verified |
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
  environment, production included; only `CODEMART_SEED_DEMO=false` turns
  it off. The deployment-script prompt remains as a forced seed.
  Seven demo accounts (password `Codemart#2026`): client, developer,
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
  token and registration status only).
- The return path after the shared sign-in is kept in memory only.
- Deposit and refund rows in the administration console show user ids,
  not usernames.

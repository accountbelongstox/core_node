# CodeMart User Interface Functional Status

Updated: 2026-09-18 (functional-only revision)
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`

> Revision 2026-09-27: a full audit found several functions below missing or
> broken; statuses marked `superseded` are tracked in
> `PROGRESS_20260927_CODEMART_GAP_COMPLETION.md`, which is authoritative.

This record describes only which user-facing functions the CodeMart
interface provides and their status. It contains no code, file, or
architecture descriptions; the implementation is the authority for those.

## Public surface

- Home landing page with hero, live aggregate counters (protected funds,
  project count, developer count), delivery process section, approved
  testimonials, final call to action, and footer navigation. Status: done.
- About CodeMart page: mission, platform description, delivery roles.
  Status: done.
- Delivery process page: the five delivery stages explained for visitors.
  Status: done.
- Services page: managed delivery, task marketplace, independent review,
  escrow and invoicing. Status: done.
- Project estimate page: interactive server-calculated budget, duration,
  effort, and team estimate. Status: done.
- Information page: contact, platform status, legal notes. Status: done.
- Privacy page: data collection, usage, storage protection, user rights.
  Status: done.
- Terms page: accounts, delivery commitments, payments/refunds, acceptable
  use. Status: done.

## User workspace (authenticated)

- Dashboard with role-aware counters (active projects, open tasks, pending
  reviews, protected funds). Status: done.
- Task marketplace with browsing and atomic task acceptance. Status: done.
- My projects with publish action. Status: done.
- Guided project creation. Status: done.
- My tasks. Status: done.
- Reviews queue and review actions. Status: done.
- Architect eligibility, application, and assignments. Status: done.
- Wallet with balances, deposits, transactions. Status: done.
- Verification page showing server-owned onboarding steps and status.
  Status: done.
- Profile with account, roles, and professional profile. Status: done.
- Notifications with read state. Status: done.
- Settings with language and appearance preferences. Status: done.

Navigation visibility follows server-returned capabilities; hidden pages
remain protected by a route gate.

## Administration console (separate interface)

- Overview with platform totals and pending-work counters. Status: done.
- Users search and CodeMart role status management. Status: done.
- KYC review with approve/reject. Status: done.
- Deposits listing and payment confirmation that activates roles.
  Status: done.
- Refunds request visibility. Status: superseded (A01).
- Projects cross-user listing and state visibility. Status: done.

The administration console is a separate interface from the user workspace
and is reachable only with administrator authorization.

## Cross-cutting

- Multi-language interface (English and Chinese) with a language switcher
  in the top-right corner of every surface. Status: done.
- Dark/light mode toggle in the top-right corner. Status: done.
- Responsive web and mobile layouts. Status: done.
- Standalone app build support through Capacitor (Android and iOS build
  flavor). Status: done.
- Every visible text comes from language resources; no hardcoded interface
  strings. Status: done.
- Registration and login through the shared account, including the optional
  installation super code that grants administrator rights. Status: superseded (P01, P02: CodeMart registration with role selection was not wired).

# CodeMart Interface and Server Integration Functional Status

Updated: 2026-09-18 (functional-only revision)
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`

This record describes the functional alignment between the CodeMart
interface and the CodeMart server. It contains no code, file, or
architecture descriptions; the implementation is the authority for those.

## Alignment status

- The interface consumes the single server bootstrap projection (account,
  roles, capabilities, state vocabulary, policy, onboarding truth) and
  keeps no local copy of server-owned defaults. Status: aligned.
- Canonical state vocabulary (roles, AI analysis, projects, tasks,
  submissions, payments) is owned by the server; legacy state values are
  mapped server-side. Status: aligned.
- Public home counters and testimonials shown on the landing page come
  from the server projection. Status: aligned.
- The project estimate page sends visitor choices to the server and
  displays the server-calculated budget, duration, effort, and team
  result. Status: aligned.
- Registration (including the installation super code for administrator
  rights) returns a session that the interface adopts immediately.
  Status: aligned.
- Interface navigation visibility follows server-returned capabilities;
  unauthorized pages are absent from navigation and still blocked by a
  route gate. Status: aligned.
- All money amounts are displayed as server-provided decimals; the
  interface never calculates financial truth locally. Status: aligned.
- Repeated mutations (task acceptance, deposit confirmation, finance
  transitions) carry a stable idempotency key; the server returns the
  prior successful result or a precise conflict. Status: aligned.
- The administration console uses the dedicated administration functions
  (overview, users, KYC review, deposits, refunds, projects) and is a
  separate interface from the user workspace. Status: aligned.
- Language resources cover every visible text in English and Chinese;
  the language switcher and dark/light toggle are available on every
  surface. Status: aligned.
- Responsive layouts cover web and mobile; the standalone app build
  through Capacitor is supported. Status: aligned.

## Verified end-to-end flows

- Registration with the super code produces an administrator account;
  registration without it produces a standard account. Status: verified.
- Client deposit creation, administrator confirmation (idempotent), role
  activation, and resulting notification. Status: verified.
- Authenticated bootstrap with capabilities for both standard and
  administrator accounts. Status: verified.
- Server-calculated project estimate. Status: verified.
- AI requirement analysis cycle: analyze, proposal delivery, accept (project
  moves to funding pending), and revision request with regeneration.
  Status: verified.
- Delivery chain: project creation, milestone, task, publication,
  marketplace browsing, atomic task acceptance, deliverable submission,
  task comments, and client review decision. Status: verified.
- Reviewer qualification: application, sample-code test, activation, review
  queue, dimensional review submission, and duplicate-review guard.
  Status: verified.
- Architect lane: eligibility evaluation, application, deposit-funded
  activation, assignment listing, and project acceptance. Status: verified.
- Deposit top-up creation with payment link and deposit history.
  Status: verified.

## Deferred (by design, not shown as completed)

Direct messaging, public social profiles, advanced search ranking,
external source-control automation, arbitration workflows, multi-party
organizations, and additional payment gateways.

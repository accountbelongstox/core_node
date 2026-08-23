# CodeMart Pycore UI and Laravel Main Redesign

Date: 2026-08-23  
Status: approved design baseline; implementation has not started.

## Progress documents

This document is the stable architecture and product contract. Implementation
status, deviations, blockers, and handoff notes belong only in the following
progress documents:

- UI implementation:
  `PROGRESS_20260823_CODEMART_PYCORE_UI.md`
- Laravel implementation:
  `PROGRESS_20260823_CODEMART_LARAVEL_MAIN.md`
- Cross-end contract and integration:
  `PROGRESS_20260823_CODEMART_INTEGRATION.md`

The progress documents are independent files and remain mutable. A design
change that affects product scope, ownership, a state machine, or an API
contract must first be recorded in the integration progress document. This main
document is updated only when that change is accepted as a new baseline.

## 1. Decision

CodeMart remains a versioned Laravel sub-application named `CodeMartV1`. The
existing Flutter implementation under
`poly_apps/flutter_bloom/lib/apps/app_codemart` becomes reference-only and is
not the target frontend.

The new frontend is a React/TypeScript sub-application in the existing unified
Pycore UI shell:

```text
poly_apps/pycore_laravel_wordnew_ui/apps/codemart/
```

It is mounted at `/codemart/*`, uses the prefix `Cm` for exported UI types and
components, and communicates only with Laravel through the shared Laravel
transport. The browser does not call Pycore directly for CodeMart business
operations. Laravel may use the existing global task system and Pycore workers
for server-coordinated AI work.

The backend extends the existing sources in:

```text
poly_apps/laravel_main/app/Apps/CodeMartV1/
poly_apps/laravel_main/routes/CodeMartV1Router/
poly_apps/laravel_main/database/migrations/CodeMartV1_*.php
```

The API base remains `/api/codemart/v1`. Existing database identity,
`AppKeys::CODEMARTV1`, the `codemartv1` PostgreSQL connection, and existing
table data are retained. Schema evolution is additive and idempotent.

## 2. Source audit and corrections

The old Flutter design directory contains a useful structure but not a complete
product specification. Its architecture, data model, flow, page map, detailed
page, and progress documents are mostly templates. The implemented Flutter
screens and Laravel `CodeMartV1` sources are therefore the actual behavioral
reference.

The current implementation already contains:

- client, developer, architect, and reviewer roles;
- email, phone, KYC, role, and deposit onboarding concepts;
- projects, AI requirement analysis, proposals, milestones, and attachments;
- a task marketplace, task acceptance, submissions, comments, and reviews;
- wallets, transactions, payments, escrow, invoices, refunds, and deposits;
- architect promotion, reviewer qualification, and developer statistics;
- an Octane timer path for CodeMart AI analysis.

The redesign must correct these existing inconsistencies instead of copying
them into the React frontend:

| Area | Current inconsistency | Required authority |
| --- | --- | --- |
| Role status | Flutter includes `approved`; Laravel uses `active` | Versioned Laravel contract |
| Task status | Flutter and Laravel expose different state sets; marketplace code uses `open` while constants omit it | One canonical task state machine |
| Project status | AI code writes `awaiting_payment`, which is absent from Laravel constants | One canonical project state machine |
| Deposit amount | Flutter and Laravel contain different hardcoded amounts | Server contract and server calculation |
| KYC fields | API metadata and controller use different names and identity values | Request DTO and serializer contract |
| Authentication | CodeMart registration duplicates global user concerns | Shared Laravel identity and one bearer session |
| UI state | Old frontend duplicates enums and defaults | Typed API models plus server bootstrap contract |
| Async analysis | Domain row is treated as execution work | Domain record plus `global_tasks` execution truth |

## 3. Product boundary

CodeMart is a managed software-delivery marketplace. A client converts a
requirement into a funded project. An architect may structure the project into
milestones and tasks. Qualified developers accept open tasks and submit
deliverables. Qualified reviewers assess submissions. Laravel enforces
authorization, state transitions, money movement, and audit history.

### 3.1 Roles

| Role | Purpose | Activation gate |
| --- | --- | --- |
| Client | Creates, funds, and accepts projects | Shared account plus required CodeMart onboarding |
| Developer | Accepts tasks and submits deliverables | Required verification, profile, and configured deposit policy |
| Architect | Converts requirements into an executable project plan | Active developer, performance threshold, application, and additional deposit policy |
| Reviewer | Reviews submissions independently | Active eligible user and passed reviewer qualification |
| Platform administrator | Handles KYC, disputes, exceptional refunds, and role suspension | Existing Laravel administrator authorization |

A user may own multiple CodeMart roles. Role membership is separate from the
global Laravel administrator role. UI visibility is derived from capabilities
returned by Laravel, not from locally inferred role names.

### 3.2 Delivery scope

MVP includes:

- shared login and CodeMart onboarding status;
- role-aware dashboard;
- client project creation and editing;
- AI requirement analysis and proposal review;
- milestones, task publication, marketplace browsing, and atomic task
  acceptance;
- developer task workspace and submission;
- reviewer qualification status, review queue, and review submission;
- wallet summary, transaction history, deposit status, project funding,
  escrow visibility, invoice visibility, and refund requests;
- profile, verification, notifications, and localized error states.

Deferred scope includes direct messaging, public social profiles, advanced
search ranking, external source-control automation, arbitration workflows,
multi-party organizations, and additional payment gateways. Deferred features
must not be represented as completed navigation items.

## 4. System architecture

```text
React CodeMart sub-app
  pages -> feature controllers/stores -> CmApi modules -> shared BaseAPI
                                      |
                                      v
                           Laravel :9000 /api/codemart/v1
                                      |
                 controllers -> services -> models/repositories
                         |             |             |
                         |             |             v
                         |             |      CodeMart PostgreSQL
                         |             v
                         |      global_tasks / timer driver
                         |             |
                         |             v
                         |      Pycore worker when required
                         v
                PathMapper/FileSystemManager
```

Ownership rules:

- React owns presentation, local form drafts, query state, and optimistic
  display only.
- Laravel owns identity binding, capabilities, validation, domain state,
  transitions, money, file metadata, and access policy.
- PostgreSQL is authoritative for durable CodeMart state.
- `global_tasks` is authoritative for asynchronous execution state. A
  CodeMart analysis row stores the business request and result, not a second
  independent worker queue.
- Notifications or Mercure events are invalidation hints. Clients reconcile
  with Laravel after reconnect; events are never the only source of truth.

## 5. Frontend design

### 5.1 Target structure

```text
poly_apps/pycore_laravel_wordnew_ui/apps/codemart/
  CmApp.tsx
  CmLayout.tsx
  cmPages.tsx
  api/
    CmApi.ts
    CmApiContract.ts
    CmApiTypes.ts
    index.ts
  auth/
    CmAccessGate.tsx
  components/
    common/
    dashboard/
    projects/
    tasks/
    reviews/
    finance/
  contexts/
    CmBootstrapContext.tsx
  pages/
    CmDashboardPage.tsx
    CmMarketplacePage.tsx
    CmProjectsPage.tsx
    CmProjectCreatePage.tsx
    CmProjectDetailPage.tsx
    CmTaskWorkspacePage.tsx
    CmMyTasksPage.tsx
    CmReviewQueuePage.tsx
    CmArchitectPage.tsx
    CmWalletPage.tsx
    CmVerificationPage.tsx
    CmProfilePage.tsx
    CmNotificationsPage.tsx
    CmSettingsPage.tsx
  cm-locales/
    en.ts
    zh.ts
    index.ts
  stores/
    CmDraftStore.ts
    CmQueryState.ts
```

`cmPages.tsx` is the single registry for page ID, route, localized label key,
icon, required capability, and lazy component. `CmApp.tsx` generates routes
from that registry. `CmLayout.tsx` generates navigation from the same registry,
so routing and navigation cannot drift.

The sub-app is registered in the shell through `shellTypes.ts`,
`ShellProvider.tsx`, `ShellApp.tsx`, `ShellHome.tsx`, and the app switcher.
`END_USES_PYCORE.codemart` is `false`. CodeMart uses the existing `nexus` theme
until a separately approved shared theme is introduced.

An optional standalone flavor may be added at `flavors/codemart/` with:

```text
id: codemart
rootRoute: /codemart
entry: apps/codemart/CmApp.tsx
```

### 5.2 Page map

| Route | Page | Capability |
| --- | --- | --- |
| `/codemart` | Role-aware dashboard | Authenticated user |
| `/codemart/marketplace` | Open task marketplace | `task.browse` |
| `/codemart/projects` | Owned or assigned projects | `project.read` |
| `/codemart/projects/new` | Project creation wizard | `project.create` |
| `/codemart/projects/:projectId` | Project, proposal, milestones, funding, activity | `project.read` plus resource authorization |
| `/codemart/tasks` | Current user's accepted or managed tasks | `task.read` |
| `/codemart/tasks/:taskId` | Task workspace, comments, submissions, review result | `task.read` plus resource authorization |
| `/codemart/reviews` | Reviewer qualification or review queue | `review.read` |
| `/codemart/architect` | Eligibility, application, and architecture assignments | `architect.read` |
| `/codemart/wallet` | Balance, deposits, payments, invoices, refunds | `finance.read` |
| `/codemart/verification` | Phone, KYC, role and deposit onboarding | `onboarding.read` |
| `/codemart/profile` | CodeMart profile and role data | `profile.read` |
| `/codemart/notifications` | Domain notifications | `notification.read` |
| `/codemart/settings` | Language and application preferences | Authenticated user |

Unauthorized pages are absent from navigation and still protected by a route
gate. Hiding navigation is not authorization; every Laravel operation repeats
the resource and capability check.

### 5.3 Frontend state and transport

- `CmApi` extends the existing shared `BaseAPI` with prefix
  `/api/codemart/v1` and active-endpoint behavior.
- Components never call `fetch`, construct Laravel origins, or read bearer
  tokens directly.
- The existing shared AuthSession and global login host provide the only bearer
  session. CodeMart does not store another password, token, or endpoint.
- `CmBootstrapContext` owns the current CodeMart user projection, onboarding
  state, roles, capabilities, contract version, enum vocabulary, finance
  policy, and unread counts returned by `GET /bootstrap`.
- Server entities use normalized TypeScript DTOs. Form models remain separate
  from response DTOs.
- List filters, sorting, cursors, and pagination stay in `CmQueryState`; durable
  business records never use browser storage as their authority.
- Project creation drafts may use the existing storage abstractions under a
  CodeMart-namespaced key and must be cleared only after confirmed server
  creation.
- All user-facing text, including errors, empty states, validation messages,
  statuses, and accessibility labels, uses the `codemart` i18n namespace.
- Money is received as a decimal string plus ISO currency and formatted for
  display. The frontend never calculates commission, escrow release, refund,
  or deposit truth.
- Mutation buttons expose pending state and prevent local duplicate clicks,
  while server idempotency and conditional state transitions remain required.

## 6. Laravel design

### 6.1 Reuse and alignment

Retain the public namespace `CodeMartV1`, app key, connection, table prefix,
route prefix, API info integration, existing models, and existing rows. Extend
the app rather than creating `CodeMartV2` or a second service.

New or substantially rewritten controllers use the current Laravel convention:

```text
app/Apps/CodeMartV1/
  CodeMartV1Controllers/     # classes end in Ctl
  CodeMartV1Services/
  CodeMartV1Models/
  CodeMartV1Policies/
  CodeMartV1Serializers/
  CodeMartV1Gvar/
  CodeMartV1TablesMaps/
  CodeMartV1Utils/
```

Legacy `CodeMartV1Ctl` classes remain reachable during migration. New business
logic must not be added to both controller directories. Controllers validate
transport shape, call `AuthHelper`, delegate to a service, and return the shared
`ApiResponse` envelope. State transitions and money movement belong in domain
services with short database transactions and row locks where contention is
possible.

All CodeMart models must inherit the CodeMart app model base or otherwise use
the registered CodeMart connection intentionally. Table and column vocabulary
is centralized in `CodeMartV1TablesMaps`; no new query hardcodes connection or
table strings.

### 6.2 Authentication and onboarding

Global Laravel identity is the only login identity. CodeMart records extend a
global user ID with CodeMart roles, profiles, verification, qualification, and
financial state. CodeMart must not issue an independent long-lived token.

The target onboarding flow is:

```text
global account
  -> CodeMart profile and requested role
  -> contact verification required by policy
  -> KYC required by policy
  -> deposit requirement returned by server
  -> role active
```

`GET /bootstrap` returns exact completed and next steps. The UI never derives
onboarding completion from missing fields. Existing registration routes may be
retained temporarily for compatibility, but new UI account login and bearer
state use the shared global auth flow. Compatibility behavior and removal
criteria are recorded in the integration progress document before cutover.

### 6.3 Canonical state machines

State strings are owned by a versioned Laravel CodeMart contract and returned
by `GET /bootstrap` or a dedicated read-only contract endpoint. UI source does
not duplicate server defaults.

Role:

```text
pending -> active
pending -> rejected
active  -> suspended -> active
```

AI analysis:

```text
pending -> processing -> completed
                      -> failed
completed -> revision_requested -> pending
```

Project:

```text
draft -> proposal_review -> funding_pending -> open -> in_progress -> completed -> archived
                                       open/in_progress -> paused -> in_progress
                              draft/open/paused/funding_pending -> cancelled
```

Task:

```text
open -> assigned -> in_progress -> review -> completed
                                  review -> in_progress
              assigned/in_progress/review -> blocked -> in_progress
              open/assigned/in_progress/blocked -> cancelled
```

Submission:

```text
pending_review -> approved
               -> needs_revision
               -> rejected
```

Payment:

```text
pending -> processing -> completed
                      -> failed
pending/processing -> cancelled
completed -> disputed -> refunded or completed
```

Every mutation verifies the expected current state. Task acceptance is one
atomic conditional update or locked transaction, so only one developer can
claim an open task. Repeated mutation requests use a stable idempotency key and
must return the prior successful result or a precise conflict.

Existing noncanonical values such as `awaiting_payment` are migrated or mapped
by one backend compatibility layer. They are never propagated as a second UI
vocabulary.

### 6.4 API surface

The existing routes remain the starting point. The target API is grouped by
domain and returns a consistent `{ success, data, message, error_code }`
envelope.

| Domain | Existing coverage | Required extension |
| --- | --- | --- |
| Bootstrap | Registration status only | Current user projection, roles, capabilities, contract, policy, counters |
| Projects | List/create/read/update/publish, milestone create, upload | Stable serializers, timeline, cancellation, explicit state actions |
| AI analysis | Start/read/accept/revise | `global_task_id`, revision, retry-safe status, normalized proposal |
| Tasks | CRUD, submit, comment | Canonical transitions, attachment metadata, activity and authorization |
| Marketplace | Browse/accept/my tasks | Sorting, cursor/page contract, atomic accept conflict |
| Reviews | Submission review and reviewer workflow | Qualification projection, assignment ownership, review history |
| Architect | Eligibility/apply/tasks/accept/deposit | Stable eligibility reasons and project-plan workflow |
| Finance | Wallet, transactions, payments, invoices, refunds, deposits | Decimal strings, idempotency, escrow actions, authorization, audit references |
| Notifications | None | Paginated list, unread count, mark-read action |
| Profile | Partial model fields | Role-aware profile read/update and completeness result |

API rules:

- Path IDs are integers and resource queries always include owner or allowed
  role scope.
- Pagination uses one field convention across domains. The selected convention
  and compatibility aliases are recorded in integration progress before UI
  implementation.
- API serializers emit stable snake_case JSON. Eloquent models are not exposed
  directly.
- Datetimes are UTC ISO 8601. Money is a fixed decimal string; calculations use
  decimal-safe server operations.
- Validation and domain conflicts have stable `error_code` values. User-facing
  UI text comes from i18n keys, not raw backend English strings.
- Uploads use multipart requests through `BaseAPI`. Laravel validates actual
  MIME type, size, ownership, and allowed purpose.
- Download URLs are resolved against the active Laravel endpoint and require
  authorization where the file is private.
- Create and money-changing endpoints accept `Idempotency-Key`.

### 6.5 Data model

Retain and align the existing entities:

```text
global users
  -> CodeMart roles
  -> developer/client profiles
  -> phone and KYC verification
  -> deposits
  -> developer statistics and reviewer applications

project
  -> AI analyses and proposal
  -> milestones
      -> tasks
          -> comments
          -> submissions
              -> code reviews
  -> attachments
  -> escrow/payments/invoices/refunds

user
  -> wallet
      -> wallet transactions
```

Add only data required by implemented product behavior:

- project/task activity rows for an auditable timeline;
- CodeMart notifications with read state and a domain resource reference;
- explicit state revision columns on contested aggregates where conditional
  writes need optimistic conflict detection;
- external execution reference and result revision on AI analysis rows;
- immutable business reference and idempotency fields on money-changing rows.

Do not add chat, organization, arbitration, ranking, or source-control tables
until their deferred feature is approved.

Migrations use `SafeMigrationHelper::alignTableStructureFromArray()`, are
create-if-missing/additive, and never drop, truncate, rebuild, or delete data.
They run only through the normal `php artisan sys:init` lifecycle when runtime
execution is separately authorized.

### 6.6 AI analysis and background work

Project analysis is asynchronous:

1. Laravel validates project ownership and creates or reuses one analysis
   request using an idempotency key.
2. Laravel creates the domain analysis row and a `global_tasks` item in the
   same minimum-step workflow, retaining repairable references if a later step
   fails.
3. The existing Octane timer is the only task driver. A qualified Laravel or
   Pycore execution lane claims the global task according to registered
   capability.
4. The worker stores structured recommendations and proposal data, then marks
   the domain result and global task terminal using idempotent transitions.
5. Laravel emits a small status notification. The UI refetches the analysis.

The analysis result contains structured technologies, team composition,
milestones, effort, cost ranges, assumptions, risks, and proposal text. The
client must explicitly accept it before funding. AI output cannot directly
move funds, publish a project, assign a developer, or approve a submission.

### 6.7 Finance and files

- Wallet balance, available balance, frozen balance, escrow, payment, refund,
  and deposit changes occur only inside Laravel transactions.
- Ledger entries are immutable. Corrections are compensating entries, not row
  edits that erase financial history.
- Commission and deposit policies are server configuration exposed read-only
  through the CodeMart contract.
- Escrow release requires an allowed project/milestone state and authorized
  actor. External gateway callbacks are verified and idempotent.
- Refund approval and processing are different transitions. Administrator-only
  operations use the existing Laravel administrator policy.
- Files use `PathMapper` and `FileSystemManager`; PHP native filesystem calls
  and source-tree storage paths are forbidden.
- KYC files are private and never returned as public paths. Project and
  submission attachments are authorized by resource membership.

## 7. Primary user flows

### 7.1 Client delivery flow

```text
Login -> onboarding -> create draft -> upload requirements -> request analysis
-> review/revise proposal -> accept -> fund -> publish project
-> architect plan or direct milestones/tasks -> monitor work
-> accept reviewed deliverables -> escrow release -> close project
```

### 7.2 Developer flow

```text
Login -> complete developer activation -> browse marketplace -> inspect task
-> atomically accept -> work and comment -> submit deliverables
-> approved: completion/payment
-> needs revision: update and resubmit
```

### 7.3 Architect flow

```text
Active developer -> eligibility check -> apply -> additional policy/deposit
-> role activation -> accept open architecture project
-> refine proposal -> create milestones/tasks -> publish executable plan
```

### 7.4 Reviewer flow

```text
Eligible user -> reviewer application -> qualification exercise -> activation
-> claim or receive review assignment -> score defined dimensions
-> approve, request revision, or reject -> immutable review record
```

## 8. Security and consistency

- Sanctum bearer authentication is shared with the unified UI shell.
- Laravel policies verify role capability and resource relationship on every
  request.
- KYC and finance endpoints use stricter rate limits and audit records.
- Secrets, full identity numbers, tokens, payment credentials, and private file
  paths are never returned in ordinary serializers or logs.
- Sensitive identity fields are encrypted or irreversibly masked according to
  the existing Laravel secret facilities.
- Concurrent task acceptance, escrow release, refund processing, and deposit
  confirmation use row locks or conditional writes with idempotency.
- Lists cannot leak cross-user records through unscoped filters or IDs.
- Contract version and API version are returned in bootstrap data. An
  incompatible major contract blocks mutations with a precise upgrade message.
- Realtime reconnection always performs a normal API reconciliation.

## 9. Migration and cutover

1. Freeze this design and initialize all three progress documents.
2. Normalize Laravel contracts and state vocabulary before implementing React
   pages that depend on them.
3. Add bootstrap, serializers, policies, error codes, and additive schema.
4. Implement the React app shell, API modules, i18n, route registry, and access
   gate.
5. Deliver vertical slices in this order: onboarding, projects/analysis,
   tasks/marketplace, review, finance, notifications/profile.
6. Compare the new UI with retained Flutter behavior and record intentional
   differences in integration progress.
7. Keep Flutter sources reference-only during parity review. Removing or
   archiving them is a separate destructive action requiring explicit approval.
8. Enable optional standalone flavor only after the shell route is complete.

There is no dual write between Flutter and React. Both may temporarily call the
same Laravel V1 API, but Laravel remains the only state authority.

## 10. Completion criteria

The redesign is complete only when:

- `/codemart/*` is registered as a lazy-loaded unified-shell sub-app;
- all visible text is served by CodeMart i18n resources;
- the React app uses the shared Laravel endpoint, auth, request coordination,
  and response envelope;
- Laravel bootstrap exposes roles, capabilities, contract vocabulary, policy,
  and onboarding truth;
- canonical states are enforced server-side and old incompatible values are
  mapped once;
- task acceptance and all finance transitions are concurrency-safe and
  idempotent;
- AI analysis uses durable global task execution and reconciled domain results;
- private files are authorized and stored through the shared filesystem layer;
- the page set supports the four primary role flows without placeholder pages;
- every progress document records source-complete status and remaining runtime
  verification separately;
- no existing CodeMart data or Flutter source is deleted as part of the
  implementation.

Repository policy requires separate authorization before builds, tests,
services, migrations, or runtime verification. This design does not authorize
those operations.

# CodeMart Laravel Main Progress

Owner: Laravel/PHP implementation  
Updated: 2026-08-23  
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`  
Integration progress: `PROGRESS_20260823_CODEMART_INTEGRATION.md`

## Scope

This document tracks extensions and alignment of the existing Laravel
`CodeMartV1` sub-application. The existing app key, PostgreSQL connection,
route base, tables, and data remain in place.

The main design owns architecture, product scope, and state machines. This file
records Laravel source progress, compatibility decisions, blockers, and
handoffs.

## Current status

Status: legacy implementation exists; redesign implementation has not started.

No PHP source, migration, configuration, service, or test source was changed
while creating this document. No build, test, migration, service, or runtime
command was run.

## Existing backend inventory

- Route base: `/api/codemart/v1`.
- Registered app: `AppKeys::CODEMARTV1` / `codemartv1` PostgreSQL connection.
- Controllers: registration, projects, tasks, payments, deposits, AI analysis,
  architect, reviewer, and marketplace.
- Models: users/roles/profiles/verification, projects/proposals/milestones,
  tasks/submissions/comments/reviews, wallet/transactions, payments/escrow,
  invoices/refunds, deposits, AI analyses, developer statistics, and reviewer
  applications.
- API metadata: `CodeMartV1ApiInfo` exposed through the aggregated API info.
- Async path: `CodeMartV1AIAnalysisTask` driven by the existing Octane timer.
- Existing migrations from 2025-10-21 through 2026-05-18.

## Required corrections discovered by audit

- [ ] Replace multiple status vocabularies with the canonical state machines in
  the main design.
- [ ] Map or migrate the current `awaiting_payment` project value.
- [ ] Align task constants with marketplace and task-model behavior.
- [ ] Make server deposit and commission policy the only authority.
- [ ] Align KYC request fields, identity values, validation, API metadata, and
  serializers.
- [ ] Ensure every CodeMart model intentionally uses the registered CodeMart
  connection or documented global identity connection.
- [ ] Remove business behavior from controllers and centralize transitions in
  services.
- [ ] Replace direct Eloquent response exposure with stable serializers.
- [ ] Consolidate CodeMart onboarding with the shared global Laravel identity
  and bearer session.
- [ ] Move asynchronous execution truth to `global_tasks` while retaining the
  CodeMart analysis row as the domain result.
- [ ] Replace hardcoded user-facing controller messages with stable error codes
  and localized message handling.
- [ ] Confirm all file paths use `PathMapper` and `FileSystemManager`.

## Work checklist

### Phase L-0: contract and compatibility

- [ ] Read the latest UI and integration progress documents.
- [ ] Define a CodeMart contract version and canonical constants.
- [ ] Define bootstrap, serializer, error, pagination, money, and datetime
  formats.
- [ ] Inventory current stored status values and define one compatibility map.
- [ ] Decide the compatibility lifetime of legacy CodeMart registration routes.

### Phase L-1: application foundation

- [ ] Add the bootstrap endpoint with user, onboarding, roles, capabilities,
  policies, enum vocabulary, and counters.
- [ ] Add policies/authorization services for every role and resource action.
- [ ] Add stable serializers and request DTO validation.
- [ ] Add domain services for state transitions and atomic mutation ownership.
- [ ] Align API metadata with actual request and response contracts.

### Phase L-2: additive persistence

- [ ] Add activity, notification, revision, task-reference, and idempotency
  fields required by the accepted design.
- [ ] Use `SafeMigrationHelper::alignTableStructureFromArray()` only.
- [ ] Preserve all existing columns and rows.
- [ ] Add required unique constraints and indexes without destructive rebuilds.
- [ ] Centralize new table and field names in `CodeMartV1TablesMaps`.

### Phase L-3: onboarding and roles

- [ ] Bind CodeMart role/profile rows to the authenticated global user.
- [ ] Normalize contact verification, KYC, deposit, and role activation steps.
- [ ] Return an explicit next step and blocking reasons.
- [ ] Keep administrator authorization separate from CodeMart role membership.

### Phase L-4: project, analysis, and planning

- [ ] Align project and analysis state transitions.
- [ ] Make analysis creation idempotent and connect it to `global_tasks`.
- [ ] Store structured, revisioned proposal results.
- [ ] Enforce client ownership for revise, accept, fund, publish, pause,
  cancel, and close actions.
- [ ] Add project activity and normalized milestone/task planning responses.

### Phase L-5: marketplace, submission, and review

- [ ] Implement atomic task acceptance with a precise conflict response.
- [ ] Enforce canonical task and submission transitions.
- [ ] Scope marketplace, assigned task, comments, files, and submission reads.
- [ ] Normalize architect eligibility and reviewer qualification results.
- [ ] Make review records immutable and authorization-scoped.

### Phase L-6: finance and notifications

- [ ] Use decimal-safe values and server-owned policy calculations.
- [ ] Make deposits, funding, escrow release, payment, and refund processing
  transactional and idempotent.
- [ ] Add immutable ledger references and compensating corrections.
- [ ] Add paginated CodeMart notifications and unread count.
- [ ] Protect private KYC, project, submission, and invoice resources.

### Phase L-7: source handoff

- [ ] Update `CodeMartV1ApiInfo` to the accepted API contract.
- [ ] Record every retained compatibility route and removal criterion.
- [ ] Confirm all controller actions use `ApiResponse` and `AuthHelper`.
- [ ] Confirm no new CodeMart query hardcodes a connection or table name.
- [ ] Record source-complete status and separately authorized verification needs.

## Compatibility boundary

The existing Flutter source may remain a temporary API consumer. Compatibility
must be implemented once in Laravel serializers or a documented route adapter,
not as parallel domain logic. The React frontend receives only the canonical
contract.

Existing Flutter source, existing tables, and legacy PHP classes are not
deleted by this work. Cleanup requires a separate explicit approval after
cutover.

## Progress log

### 2026-08-23

- Audited CodeMart routes, constants, API metadata, controllers, models, table
  map, app registration, migrations, and AI analysis timer path.
- Confirmed that the current backend is reusable but contains contract and
  state inconsistencies that must be normalized before React implementation.
- No implementation files were changed.

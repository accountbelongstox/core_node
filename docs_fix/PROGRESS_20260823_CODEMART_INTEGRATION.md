# CodeMart UI and Laravel Integration Progress

Owners: CodeMart React UI and Laravel Main implementations  
Updated: 2026-08-23  
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`

## Purpose

This document is the mutable coordination record between the CodeMart React
sub-app and Laravel `CodeMartV1`. It owns accepted DTO details, temporary
compatibility mappings, handoff readiness, blockers, and cutover status. It
does not replace the main architecture design.

Both implementations must read this document and their own progress document
before changing source.

## Current status

Status: UI foundation and public visual surface are source-complete; Laravel
contract implementation and live feature binding have not started.

| Workstream | Status | Dependency |
| --- | --- | --- |
| Main product/architecture design | Complete | None |
| Public landing visual contract | UI source complete | Authorized runtime/mobile parity review |
| Public landing data contract | UI consumer complete; server pending | Publication-safe aggregate definitions |
| Canonical Laravel contract | Pending | State and compatibility audit |
| Laravel bootstrap and serializers | Pending | Canonical contract |
| React API types and foundation | Public foundation complete; domain types pending | Bootstrap/serializer handoff |
| Vertical feature slices | Pending | Matching backend domains |
| Flutter parity review | Pending | React source complete |
| Cutover | Pending | Accepted runtime verification |

UI source and shared shell foundations were changed. No Laravel business
source, build output, migration, service, or test source was changed. No
build, test, migration, service, or runtime verification command was run.

## Binding integration decisions

- Frontend root: `poly_apps/pycore_laravel_wordnew_ui/apps/codemart`.
- Shell route: `/codemart/*`.
- Laravel API base: `/api/codemart/v1`.
- Identity: one global Laravel bearer session.
- Direct browser-to-Pycore communication: none for CodeMart.
- JSON naming: snake_case from Laravel DTO serializers.
- Date/time: UTC ISO 8601.
- Money: decimal string plus ISO currency.
- State/policy authority: versioned Laravel bootstrap contract.
- Async execution authority: `global_tasks`; CodeMart rows hold domain state
  and results.
- Realtime: notification/invalidation only; normal Laravel reads reconcile.
- Existing data and Flutter source: retained through initial cutover.
- Public landing route: `/codemart`; authenticated dashboard route:
  `/codemart/dashboard`.
- Public landing appearance follows the inspected `mytoken.cloud` desktop
  baseline, but the implementation uses only local React components, CSS,
  assets, i18n content, and Laravel data.
- Reference-site counters, testimonials, identity, contact information, legal
  text, and assets are not copied into the product contract.

## Contract handoff checklist

### Bootstrap

- [ ] Contract version and minimum supported UI version.
- [ ] Authenticated global user projection.
- [ ] CodeMart profile and completeness.
- [ ] Requested, pending, active, suspended, and rejected roles.
- [ ] Capability list used by navigation and action gates.
- [ ] Explicit onboarding steps, completion, next step, and blockers.
- [ ] Canonical state/display-key vocabulary.
- [ ] Deposit, commission, currency, upload, pagination, and rating policies.
- [ ] Dashboard counters and notification unread count.

### Public home

- [ ] Define `GET /public/home` without a bearer requirement.
- [ ] Define publication-safe aggregate counter names, decimal/integer shape,
  update cadence, and unavailable-data behavior.
- [ ] Decide whether approved testimonials are server-managed in MVP; omit the
  section when no approved records exist.
- [ ] Confirm that localized marketing copy, navigation labels, and delivery
  steps remain frontend locale content rather than API data.
- [x] UI consumes `/api/codemart/v1/public/home` only through `CmApi`, validates
  aggregate/testimonial shapes, and renders unavailable values without static
  business fallbacks.

### Common response contract

- [ ] Success envelope.
- [ ] Validation-error field shape.
- [ ] Stable domain `error_code` vocabulary.
- [ ] Pagination naming and boundary behavior.
- [ ] Resource-not-found behavior that does not leak unauthorized existence.
- [ ] Idempotency replay and conflict behavior.
- [ ] State revision/conditional mutation behavior.

### Feature DTOs

- [ ] Project summary/detail/write DTOs.
- [ ] Analysis status/result/revision DTOs.
- [ ] Milestone and task summary/detail/write DTOs.
- [ ] Marketplace filters and acceptance result.
- [ ] Submission, comment, and review DTOs.
- [ ] Architect and reviewer qualification DTOs.
- [ ] Wallet, transaction, deposit, payment, escrow, invoice, and refund DTOs.
- [ ] Notification and profile DTOs.
- [ ] Multipart upload field names and authorized download descriptors.

## Known legacy mappings to resolve

| Legacy area | Conflict | Resolution status |
| --- | --- | --- |
| Project payment wait | Controller writes `awaiting_payment`; constants omit it | Pending canonical mapping |
| Task availability | Marketplace expects `open`; Laravel constants begin at `pending` | Pending canonical mapping |
| Task lifecycle | Flutter exposes more states than Laravel | Pending state migration plan |
| Role activation | Flutter includes `approved`; Laravel uses `active` | `active` selected; stored-value audit pending |
| Deposits | Flutter and Laravel amounts differ | Server policy selected; exact configured values pending |
| KYC identity | Metadata and controller use different names/values | Pending request DTO freeze |
| Registration | CodeMart-specific registration overlaps global auth | Shared auth selected; legacy compatibility pending |
| Pagination | Existing APIs mix `pageSize`, response collections, and local shapes | Pending one canonical shape |
| API messages | Controllers return raw English strings | Stable error code/i18n handoff pending |

No React fallback may become a second permanent answer for these conflicts.

## Vertical-slice handoff order

1. Bootstrap, auth binding, capabilities, and onboarding.
2. Project creation, AI analysis, proposal, and funding state.
3. Milestones, marketplace, task acceptance, and developer workspace.
4. Submission, architect, reviewer, and review workflow.
5. Wallet, deposit, escrow, invoice, payment, and refund workflow.
6. Notifications, profile, activity timeline, and optional realtime hints.

For each slice:

1. Laravel records the stable DTO and source-complete status here.
2. UI updates its types and implementation without duplicating server policy.
3. Integration records compatibility behavior and unresolved differences.
4. Runtime verification remains a separately authorized step.

## Open decisions

- Exact canonical pagination response fields and whether cursor pagination is
  required for activity and notifications.
- Exact policy source for deposit and commission configuration.
- Compatibility lifetime and response behavior of legacy registration routes.
- Whether the initial CodeMart release needs Mercure notifications or uses
  bounded status polling plus normal refetch only.
- Whether external payment gateways are enabled in MVP or represented only by
  wallet/manual funding flows.
- Exact administrator workflow for KYC approval and exceptional refund
  processing.
- Exact aggregate definitions for public total amount, project count, and
  registered-developer count.
- Whether testimonials are included in MVP and, if included, their approval,
  consent, ordering, and withdrawal workflow.
- Exact responsive breakpoints after a reliable mobile reference capture.

Decisions are appended here with date, owner, affected DTOs, and migration
impact before either side implements them.

## Progress log

### 2026-08-23

- Established the React UI and Laravel ownership boundary.
- Selected the shared bearer session, server-owned contract, Laravel-only
  browser transport, and durable async ownership model.
- Recorded all known Flutter/Laravel contract conflicts and handoff order.
- Added the inspected `mytoken.cloud` desktop landing-page visual contract and
  separated it from local architecture, assets, identity, content, and data
  ownership.
- Added the unauthenticated public-home contract handoff and reserved
  `/codemart/dashboard` for the authenticated role-aware dashboard.
- Completed the UI-side public-home consumer, shell/auth/i18n foundation,
  responsive visual surface, and authenticated route structure.
- Kept all mutation-dependent controls inactive until the matching canonical
  Laravel contract defines validation, capabilities, and per-operation
  idempotency keys.
- No Laravel source, build, test, migration, service, or runtime verification
  command was run.

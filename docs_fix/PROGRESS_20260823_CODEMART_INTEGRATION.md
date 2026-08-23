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

Status: design synchronized; implementation not started.

| Workstream | Status | Dependency |
| --- | --- | --- |
| Main product/architecture design | Complete | None |
| Canonical Laravel contract | Pending | State and compatibility audit |
| Laravel bootstrap and serializers | Pending | Canonical contract |
| React API types and foundation | Pending | Bootstrap/serializer handoff |
| Vertical feature slices | Pending | Matching backend domains |
| Flutter parity review | Pending | React source complete |
| Cutover | Pending | Accepted runtime verification |

No business source, build output, migration, service, or test source was
changed while creating this document. No build, test, migration, or runtime
command was run.

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

Decisions are appended here with date, owner, affected DTOs, and migration
impact before either side implements them.

## Progress log

### 2026-08-23

- Established the React UI and Laravel ownership boundary.
- Selected the shared bearer session, server-owned contract, Laravel-only
  browser transport, and durable async ownership model.
- Recorded all known Flutter/Laravel contract conflicts and handoff order.
- No implementation files were changed.

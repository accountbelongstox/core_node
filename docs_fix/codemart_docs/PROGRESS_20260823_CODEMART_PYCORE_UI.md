# CodeMart Pycore UI Progress

Owner: React/TypeScript UI implementation  
Updated: 2026-08-23  
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`  
Integration progress: `PROGRESS_20260823_CODEMART_INTEGRATION.md`

## Scope

This document tracks the CodeMart sub-application under:

```text
poly_apps/pycore_laravel_wordnew_ui/apps/codemart/
```

The main design is the product and architecture authority. This file records
only implementation progress, UI-specific decisions, blockers, and handoff
notes.

## Current status

Status: UI foundation, shell registration, public landing page, authenticated
workspace shell, and route-level domain surfaces are source-complete. Live
domain binding remains blocked by the Laravel contracts listed below.

React/TypeScript, CSS, SVG flavor assets, and shell registration were changed.
No build output or test source was changed. No build, test, service, migration,
or runtime verification command was run.

## Existing reusable components

- Unified shell routing and lazy end loading in `shell/ShellApp.tsx`.
- End metadata, theme selection, and Pycore transport gating in
  `shell/shellTypes.ts` and `shell/ShellProvider.tsx`.
- Shared Laravel endpoint selection, failover, bearer authentication, request
  coordination, FormData handling, and response envelopes in
  `core/integrations/laravel/`.
- Global login host and shared AuthSession.
- Shared i18next instance and shell language state.
- Existing common loading, empty-state, status, form, table, modal, and
  notification components.
- `apps/pdd-manager` and `apps/pycore-manager` page-registry patterns.
- Flavor-based standalone build support.
- Shared `createAppRouteElements()` now centralizes the React Router 7 registry
  typing previously duplicated by the Pycore and PDD applications.
- Shared AuthSession now exposes a `useSyncExternalStore` subscription for
  application-neutral authentication rendering.

## Binding UI decisions

- App folder: `apps/codemart`.
- Component/type prefix: `Cm`.
- Root route: `/codemart`.
- Default existing theme: `nexus`.
- Direct Pycore transport: disabled for this end.
- Backend prefix: `/api/codemart/v1` through shared `BaseAPI`.
- Authentication: shared global bearer session; no CodeMart token store.
- Navigation and routes: one `cmPages.tsx` registry.
- User-facing strings: `codemart` i18n namespace with English and Chinese at
  minimum.
- Business states, limits, deposit amounts, commission, and currencies: loaded
  from Laravel bootstrap; not copied into TypeScript constants.
- Public landing visual reference: `https://mytoken.cloud/`, reproduced with
  local React/CSS/assets and local data rather than an iframe or external
  runtime dependency.
- Public root: `/codemart`; authenticated dashboard: `/codemart/dashboard`.

## Reference UI audit

MCP Chrome captured the live reference homepage on 2026-08-23 at a
`1424 x 771` desktop viewport. The page uses a transparent header over a 640px
hero, dual CTAs, a three-column metrics band, five alternating delivery steps,
a testimonial carousel, a dark final CTA, and a multi-column footer. Its main
desktop content width is 980px.

Captured presentation tokens include `#4187DB` primary blue, `#4289DB` link
blue, `#2D3238` headings, `#8796A8` muted text, `#DDE3EB` testimonial surface,
`#2B3747` final CTA, 42px hero/step headings, and 5px button radius. These
measurements are now binding for the public landing desktop baseline.

Reference assets and operational content are not implementation inputs. Local
assets replace the logo, hero, process illustrations, avatars, and QR code;
CodeMart locale files replace page copy; Laravel supplies publication-safe
counters and any approved testimonial records.

## Work checklist

### Phase UI-0: contract preparation

- [x] Read the latest integration and Laravel progress documents.
- [ ] Freeze the bootstrap DTO, API envelope, pagination convention, stable
  error codes, and canonical state strings.
- [ ] Define `CmApiTypes.ts` from the accepted backend serializers.
- [ ] Record every temporary compatibility alias in integration progress.

### Phase UI-1: shell and foundation

- [x] Add `CmApp.tsx`, `CmLayout.tsx`, and `cmPages.tsx`.
- [x] Register the CodeMart end in shell type, route, provider, home, controls,
  and app switcher ownership points.
- [x] Set `END_USES_PYCORE.codemart` to `false`.
- [x] Add English and Chinese locale registration.
- [ ] Add the full bootstrap context, shared page states, and namespaced
  draft/query persistence. `CmApi`, the public-home query, and access gate are
  complete.
- [x] Add `CmPublicHomePage`, `CmPublicHeader`, `CmHero`, `CmPlatformStats`,
  `CmDeliveryFlow`, `CmTestimonials`, `CmPublicCta`, and `CmPublicFooter`.
- [x] Add CodeMart-scoped public-home CSS tokens and local visual assets; do
  not import or hotlink reference-site CSS, images, logo, or fonts.
- [x] Implement the 980px desktop geometry, full-bleed section surfaces,
  keyboard-accessible hero/testimonial controls, and reduced-motion behavior.
- [x] Implement the responsive header, stacked CTAs, wrapping metrics, and
  single-column delivery steps. Exact mobile-reference parity remains pending.

### Phase UI-2: onboarding and dashboard

- [ ] Implement bootstrap loading and incompatible-contract handling.
- [ ] Bind role-aware dashboard cards and next-action summary to bootstrap.
  The responsive dashboard surface and delivery-lane navigation are complete.
- [ ] Implement phone, KYC, role, and deposit onboarding views from server
  status.
- [x] Reuse the global login host and shared endpoint selector.

### Phase UI-3: projects and AI proposal

- [ ] Implement project list, create/edit wizard, detail, attachments, and
  timeline.
- [ ] Implement AI analysis submission, status reconciliation, proposal review,
  revision request, and acceptance.
- [ ] Implement funding-pending and publication actions with idempotency keys.
- [ ] Implement milestone and project-task planning views.

### Phase UI-4: task marketplace and delivery

- [ ] Implement marketplace filters and server pagination.
- [ ] Handle atomic task-accept conflicts without optimistic ownership claims.
- [ ] Implement my tasks, task workspace, comments, attachments, submission,
  revision, and completion states.

### Phase UI-5: architect and reviewer

- [ ] Implement architect eligibility, application, deposit, and assignments.
- [ ] Implement reviewer qualification state, exercise submission, review
  queue, review form, and history.
- [ ] Render score dimensions and review outcomes from the server contract.

### Phase UI-6: finance, notifications, and profile

- [ ] Implement decimal-safe wallet and transaction displays.
- [ ] Implement deposit, payment, escrow, invoice, and refund views.
- [ ] Add mutation pending states and idempotency keys for financial actions.
- [ ] Implement notification list/unread state and profile completeness.
- [ ] Add settings and accessibility behavior without duplicating shell state.

### Phase UI-7: parity and handoff

- [ ] Compare all retained Flutter screens with the accepted page map.
- [ ] Record intentionally deferred or replaced Flutter behavior.
- [ ] Confirm that no component calls Laravel directly outside `CmApi`.
- [ ] Confirm that visible literals are absent outside locale data.
- [ ] Record source-complete status and separately authorized verification needs.

## Known blockers

- The reference site's linked project pages currently resolve to an
  unavailable external host, so only its landing page is an inspected visual
  authority.
- Exact reference mobile breakpoints and dimensions were not available from
  the current MCP Chrome viewport and still require a mobile capture.
- Laravel does not yet expose the publication-safe `GET /public/home` summary
  contract.
- Laravel does not yet expose the required bootstrap contract.
- Current route metadata and controller validation disagree for multiple KYC
  fields.
- Current Flutter and Laravel state enums and deposit values disagree.
- Current Laravel responses are not yet guaranteed to use stable serializers
  and one pagination shape.
- Source-level domain pages intentionally show contract-aware empty states and
  keep project submission disabled. They must not be marked functionally
  complete until their matching Laravel slice is accepted.

These blockers must be resolved in Laravel or the integration contract. They
must not be hidden by permanent frontend fallback values.

## Progress log

### 2026-08-23

- Audited the old Flutter CodeMart design and implemented screen structure.
- Audited the unified React shell, page registries, shared Laravel transport,
  global login host, endpoint manager, themes, and i18n owner.
- Selected the target route, file prefix, backend-only transport, and phased
  page delivery plan.
- Captured the live `mytoken.cloud` landing page through MCP Chrome and
  recorded its desktop hierarchy, geometry, colors, typography, and component
  mapping.
- Defined visual parity as a local React/CSS reconstruction with CodeMart
  branding, i18n copy, local assets, and Laravel data; no external embedding or
  hotlinking.
- Split the public landing route (`/codemart`) from the authenticated dashboard
  route (`/codemart/dashboard`).
- Added the CodeMart shell end, standalone flavor, local SVG identity, shared
  authentication subscription, and `/api/codemart/v1` transport prefix.
- Implemented the local visual-parity landing page with a 640px hero, 980px
  content geometry, metrics, five delivery steps, optional approved
  testimonials, final CTA, footer, responsive layout, and reduced motion.
- Implemented the official accessible carousel controls: manual start/stop,
  focus pause, hover pause, native buttons, accessible labels, and slide state.
- Added the authenticated workspace layout, single page registry, access gate,
  dashboard, marketplace filters, project brief surface, and all accepted
  domain routes without inventing backend records.
- Refactored duplicate Pycore/PDD route element generation into one shared
  React Router helper and changed locale registration to per-language
  idempotent add/update steps.
- Kept every new source file below 800 lines; the largest is the scoped public
  landing stylesheet at 793 lines.
- Consulted the official React lazy/Suspense, React Router declarative routing,
  i18next resource-bundle, and W3C carousel-pattern documentation.
- No build, test, service, migration, or runtime verification command was run.

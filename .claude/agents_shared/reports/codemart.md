# codemart report: client key auth and audit fixes (2026-09-27)

## Tasks

| Id | Subject | Findings | Status |
|---|---|---|---|
| codemart-1 | [codemart] stale responses and effect lifecycle | FU-010, FU-013, FU-014 | approved |
| codemart-2 | [codemart] bootstrap refresh keeps the last good state | FU-015 | approved; review hardening applied and recorded as resolved |
| codemart-3 | [codemart] calendar dates and estimate inputs | FU-017, FU-022 | approved |
| codemart-4 | [codemart] adapt UI to laravel CodeMart money fixes; route table check | LB-008, LB-009, LB-019, LB-020, LB-024, LB-025 | approved |
| codemart-5 | [codemart] FU-026 CodeMart parts: central money/number/percent formatting, dead getPublicHome | FU-026 (codemart part) | approved; review notes fixed after approval (CRLF restored in api/index.ts; up to 2 decimals for public amounts without a currency) |
| codemart-6 | [codemart] CmApi transport reuse: BaseAPI IDEMPOTENCY_KEY_HEADER; drop redundant read-invalidation overrides | lead request (reuse rule) | approved |
| codemart-7 | [codemart] B9: useCmIdempotencyKey uses BaseAPI createIdempotencyKey | lead request (reuse rule) | approved |

Scope: `poly_apps/pycore_laravel_wordnew_ui/apps/codemart/` (UI/ below means `poly_apps/pycore_laravel_wordnew_ui/`).

## Findings

- FU-010 fixed. `CmProjectAnalysisPanel.tsx`: an alive flag plus a generation ref. A response that arrives after unmount or after a project change is dropped. Polling is not re-armed, and `onProjectChanged` is not called. `t` is read through a ref, so a language switch no longer starts a second poll chain.
- FU-013 fixed. `useCmPagedList.ts`: a request counter ref (same pattern as `useCmAdminList`). Superseded responses are ignored, and disabling the list invalidates in-flight requests.
- FU-014 fixed. `CmAdminKycDocumentViewer` (`CmAdminPages.tsx`): a request counter. Each click (open, switch or toggle off) and unmount invalidates older requests. A stale response is dropped before it creates an object URL, so it neither mislabels the image nor leaks a blob URL.
- FU-015 fixed.
  - `CmBootstrapContext.tsx`: a failed refresh keeps the last good bootstrap and sets `error`. A request counter drops superseded loads. Sign-out invalidates in-flight loads and clears the error.
  - New `components/access/CmBootstrapRefreshNotice.tsx` shows a non-blocking error with a retry button. It is rendered in `CmLayout` and `CmAdminLayout`.
  - `CmAdminLayout` no longer replaces the console with "checking access" during a refresh while a bootstrap is loaded.
  - `CmNotice` gained an optional `onRetry`.
  - New i18n key `access.refreshFailed` (en, zh).
  - Review hardening: when a login success carries a different user id (`id`, or `user_id` from registration) than the kept bootstrap, the old bootstrap and unread count are cleared before the reload.
- FU-017 fixed. Laravel serializes `date` casts (and `due_date`) as UTC-midnight ISO timestamps (`…T00:00:00.000000Z`, or `+00:00` via `toIso8601String`). The old date-only pattern alone did not cover this.
  - `cmWorkspaceFormat.ts` now exports `cmParseDate(value, calendar)`. In calendar mode a UTC-midnight timestamp reads as that local calendar day. `cmFormatDate` uses calendar mode.
  - The admin `useCmAdminFormat.date/time` delegate parsing to `cmParseDate`. Calendar mode applies only to `CmAdminDate dateOnly`.
  - The public `formatCmDate` copy was deleted. `CmShowcasePage` uses `cmFormatDate`.
- FU-022 fixed. `CmEstimatePage.tsx`: the count inputs keep the raw string while editing. They are clamped on blur and on submit or retry (`clampCount`/`clampDraft`), and one mapped field block replaces the two copies.
- FU-026 (CodeMart part, codemart-5) fixed.
  - `cmWorkspaceFormat.ts` is the single CodeMart formatter module. `cmFormatMoney` takes an optional fraction-digit count (`CM_WHOLE_MONEY_DIGITS` is 0, used for public whole-unit figures). New helpers: `cmFormatMoneyRange` (Intl `formatRange` with a joined fallback) and `cmFormatPercent`.
  - `components/public-home/cmPublicFormat.ts` was deleted. `CmPlatformStats`, `CmEstimatePage` and `CmShowcasePage` use the central helpers. The estimate hourly range now uses the range helper.
  - `useCmAdminFormat.money/number` delegate to `cmFormatMoney`/`cmFormatNumber`, and the admin policy commission uses `cmFormatPercent`.
  - The dead `CmApi.getPublicHome` was removed, with its private normalizers, cache TTL and the unused `CmPublicHomeLoadResult` type. `CmPublicApi.getHome` stays the only public-home loader.
- codemart-6 done. `api/CmApi.ts` uses BaseAPI's exported `IDEMPOTENCY_KEY_HEADER` instead of a local literal. The `request` override and the `uploadFresh` wrapper are removed: BaseAPI already invalidates coalesced reads after every non-GET `request`, `uploadWithProgress` and `rawRequest` write. The attachment and KYC uploads call `uploadWithProgress` directly.
- codemart-4 progress (laravel-T2 working tree read on 2026-09-27):
  - LB-020: `CmWalletPage` takes the deposit methods from bootstrap `vocabulary.policy.deposit_payment_methods` (typed in `CmApiTypes`) and falls back to `['bank_transfer']`. The Pay now link shows only for accepted non-bank methods, so legacy Alipay/WeChat placeholder URLs are hidden.
  - LB-009/LB-024: `errors.escrow_insufficient` and `errors.escrow_release_failed` are reworded (approval not applied); `task_not_assigned` and `task_project_missing` already existed.
  - LB-008: `CmProjectTransitionResult` types `side_effects.escrow_refund`. On cancel or complete, the project page appends `transitions.escrowRefunded` with the refunded amount. Admin activity action `escrow_refunded` is translated.
  - LB-025: a replayed invoice (HTTP 200 with the existing invoice) shows `wallet.invoiceExists` instead of "Invoice created".
  - LB-019: `errors.sms_unavailable` is added. It maps once laravel sends `codedError('sms_unavailable')`.
  - Optional phone step, using the field names the lead fixed (`steps[].optional`, `onboarding.phone_verification_available`):
    - The verification page marks incomplete optional steps "Optional".
    - When phone verification is unavailable, the page hides the phone form, shows an info notice, and shows the phone status as "Not available".
    - Dashboard progress counts only required steps.
  - Admin escrow refund (LB-008):
    - The admin escrow table shows a "Refund remainder" action on rows with `refundable: true`. It calls `cmAdminApi.refundEscrow` (POST admin/escrows/{id}/refund, optional notes).
    - The success notice shows the refunded amount, or "Nothing was left to refund" when `replayed` is true.
    - `errors.escrow_not_found` and `errors.escrow_not_refundable` are added.
    - `useCmAdminAction` requests take an optional `successText(data)` for response-driven notices.
- codemart-7 done. `api/useCmIdempotencyKey.ts` calls BaseAPI's `createIdempotencyKey()`, and CodeMart's local `createKey` copy is deleted. The behavior is unchanged: one key per user action, kept across retries, and replaced on `reset()`. No other key generator is left in codemart.
- Route table (codemart-4): CodeMart API routes keep `auth:sanctum`. The only non-CodeMart route the app calls is `api/logout`, which moves to `dashboard.auth:user` (any signed-in user). No UI change is needed. `api/login` is public.

## Changed files
- UI/apps/codemart/components/workspace/CmProjectAnalysisPanel.tsx
- UI/apps/codemart/components/workspace/useCmPagedList.ts
- UI/apps/codemart/admin/CmAdminPages.tsx
- UI/apps/codemart/contexts/CmBootstrapContext.tsx
- UI/apps/codemart/components/access/CmBootstrapRefreshNotice.tsx (new)
- UI/apps/codemart/CmLayout.tsx
- UI/apps/codemart/admin/CmAdminLayout.tsx
- UI/apps/codemart/components/workspace/CmStateViews.tsx
- UI/apps/codemart/styles/cm-workspace.css
- UI/apps/codemart/cm-locales/en.ts, zh.ts
- UI/apps/codemart/components/workspace/cmWorkspaceFormat.ts
- UI/apps/codemart/admin/CmAdminShared.tsx
- UI/apps/codemart/components/public-home/cmPublicFormat.ts
- UI/apps/codemart/pages/CmShowcasePage.tsx
- UI/apps/codemart/pages/CmEstimatePage.tsx
- codemart-4: UI/apps/codemart/admin/CmAdminFinancePages.tsx, UI/apps/codemart/admin/CmAdminApi.ts, UI/apps/codemart/admin/CmAdminTypes.ts, UI/apps/codemart/admin/CmAdminShared.tsx, UI/apps/codemart/pages/CmWalletPage.tsx, UI/apps/codemart/pages/CmProjectDetailPage.tsx, UI/apps/codemart/pages/CmVerificationPage.tsx, UI/apps/codemart/pages/CmDashboardPage.tsx, UI/apps/codemart/styles/cm-workspace.css, UI/apps/codemart/api/CmApi.ts, UI/apps/codemart/api/CmApiTypes.ts, UI/apps/codemart/cm-locales/en.ts, zh.ts
- codemart-5: UI/apps/codemart/components/workspace/cmWorkspaceFormat.ts, UI/apps/codemart/components/public-home/cmPublicFormat.ts (deleted), UI/apps/codemart/components/public-home/CmPlatformStats.tsx, UI/apps/codemart/pages/CmEstimatePage.tsx, UI/apps/codemart/pages/CmShowcasePage.tsx, UI/apps/codemart/admin/CmAdminShared.tsx, UI/apps/codemart/admin/CmAdminPages.tsx, UI/apps/codemart/api/CmApi.ts, UI/apps/codemart/api/CmApiTypes.ts, UI/apps/codemart/api/index.ts

## Static checks
- `tsc --noEmit -p tsconfig.json` (the tsconfig has `noEmit: true`) reports no errors under `apps/codemart`, re-run after codemart-5. The other errors are outside codemart: laravel-manager 67, wordnew 22, core/network 3, core/contracts 2, vortex 1.

## Blockers
- None.
- The UI hardcodes the deposit methods (`pages/CmWalletPage.tsx:27`). I asked laravel to expose the accepted list in bootstrap `vocabulary.policy` (LB-020).

## Next owner
- None. All codemart tasks (codemart-1 to codemart-7) are approved; the queue is empty.

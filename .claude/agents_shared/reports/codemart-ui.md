# codemart-ui handoff (D22, 2026-09-27)

## codemart-ui-G1

UI below means `poly_apps/pycore_laravel_wordnew_ui/`; paths without a prefix are under `UI/apps/codemart/`.

Status: all five items are implemented. Only the THEME_IDS part of d9-03 is deferred, because it waits on pycore-ui. Verdict pending from codemart-lead.

Note on git: the user's session auto-committed the working tree while I worked (4ddb4be8e, 2f31f9cd3, "win0.0.1"). Most of my edits therefore sit in those commits, not in `git status`. I ran no git write command. Diff base for review: 74e7770.

### d9-03: routes, dead code, file split (done; THEME_IDS deferred)

- `components/public-home/cmPublicRoutes.ts` is the single route module.
  - CM_PROTECTED_ROUTE gained tasks, reviews, architect and notifications.
  - New `CM_ADMIN_ROUTE` holds the 12 console routes.
  - New `CM_TASK_QUERY_PARAM`, moved from CmTasksPage.
  - New helpers: `cmRouteWithQuery`, `cmWorkspacePath`, `cmProjectPath`, `cmTaskPath`, `cmAdminUserPath`.
- Every `'/codemart...'` literal is replaced, including bare `'/codemart'`.
  - Files: admin/{CmAdminLayout, CmAdminShared, CmAdminPages, CmAdminFinancePages, CmAdminUserDetailPage}.tsx, auth/cmAuthSession.ts (ADMIN_HOME removed), components/workspace/{cmNotificationFormat.ts, CmProjectFundPanel.tsx}, pages/{CmDashboardPage, CmProjectsPage, CmProjectDetailPage, CmMarketplacePage, CmTasksPage, CmVerificationPage, CmSettingsPage, CmReviewsPage}.tsx, CmLayout.tsx, CmApp.tsx.
  - The local ADMIN_* path constants are gone.
- `api/CmApi.ts`: removed getAnalysis, createPayment and estimate, plus their now-unused type imports (CmAiAnalysis, CmEstimateInput, CmEstimateResult). `CmPublicApi.estimate` stays the only estimate call.
- CmArchitectPage moved out of CmReviewsPage.tsx into the new `pages/CmArchitectPage.tsx` (default export), with its constants and routes. `cmPages.tsx` lazy-loads `./pages/CmArchitectPage`. CmReviewsPage.tsx dropped the imports it no longer uses.
- Deferred (cross-scope): `pages/CmSettingsPage.tsx:9` THEME_IDS is left as it is. `shell/shellTypes.ts` exports only the `ThemeId` type and no list.
  - Request to pycore-ui (B2 writer): export `SHELL_THEME_IDS: readonly ThemeId[]` from shell/shellTypes.ts.
  - Once it exists, CmSettingsPage imports it and deletes the local array.

### cmpolreq-07: zh terminology (done)

- `cm-locales/zh.ts`:
  - submission_invalid_state is now '此交付物当前不处于待评审状态。'
  - review_duplicate is now '你已评审过此交付物。'
  - review_conflict_of_interest is now '不能评审自己提交的交付物。'
  - submission_not_found is now '未找到交付物。'
- All 14 uses of 您 now use the glossary register 你, as the other 108 strings already do.
- Decision: states.submission.pending_review changes from 待审核 to 待评审. This matches the review-queue copy ('待评审交付物', '暂无待评审的交付物') and the new error text.

### cmdesign-13: version and brand mark (code part done; Capacitor build deferred to the user)

- New `cmFlavor.ts` reads the shared `shell/flavor.ts` FLAVOR_REGISTRY. It exports:
  - `CM_APP_VERSION` (flavor.json `version`);
  - `CM_BRAND_ICON_URL` (flavor icon.svg, through `flavorAssetUrl`).
- `cmAppDownloads.ts` has no version literal left:
  - both versions use CM_APP_VERSION;
  - the Android URL is built from it, and is empty when there is no version, which hides the card.
- `components/CmBrand.tsx` (kept CRLF): the lucide Braces glyph is replaced by the flavor icon `<img>` (40 px, 32 px compact, decorative alt).
- `styles/cm-public-home.css`: `.cm-brand__mark` no longer draws the bordered box, because the icon has its own rounded tile.
- `flavors/codemart/flavor.json` is unchanged. It already declares version 1.0.0, and it is now the only declaration.
- Deferred to the user: the Capacitor native project and the published artifact.

### CKA-28-ui: ledger codes (done)

- `api/CmApiTypes.ts`: CmWalletTransaction now types `description_code?: string | null` and `description_params?: Record<string, string | number> | null`.
- `pages/CmWalletPage.tsx` (transactions tab): `describe()` renders `wallet.ledger.<code>` with description_params as interpolation values.
  - An unknown code falls back to cmHumanize(code).
  - The stored `description` is returned only when `description_code` is empty (legacy rows).
- `cm-locales/en.ts` and `zh.ts`: a new `wallet.ledger` block with one key per LEDGER_* code (13 keys). The params match the server call sites: payment_id, user_id, project_id, task_id, deposit_id, withdrawal_id. zh uses 保证金, 托管资金, 提现, 已打款.

### cmpolish-IMG-01: image registry (done)

- New `assets/cmImageRegistry.ts`:
  - `cmImage(name)` covers the 16 images, each with width, height, altKey (null for decorative images) and lazy;
  - it globs `./images/*.webp` and `./icons/*.webp`;
  - the icon slot is `CM_ICON_SPECS` / `cmIcon(name)`, empty for d9-01-ui to fill.
- New `components/CmImage.tsx` renders a registry image: localized alt, intrinsic size, and the registry loading hint, which an `eager` prop can override.
- Deleted `components/public-home/cmPublicImages.ts` and `components/workspace/cmWorkspaceImages.ts`. The registry replaces both, and nothing imports them. The same pattern was used when codemart-5 deleted cmPublicFormat.ts.
- Consumers now read the registry:
  - `CmPublicBlocks.tsx`: CmPublicIllustration wraps CmImage. The `altKey` props on it and on CmPublicSplit are removed, because the registry owns the alt keys.
  - `CmHero.tsx`: the slide `altKey`s are removed.
  - `CmInfoPages.tsx`, `CmEstimatePage.tsx`, `CmDownloadPage.tsx`: the duplicate altKey/eager props are removed.
  - `CmStateViews.tsx`: the empty state uses CmImage.
  - `auth/CmAuthLayout.tsx` and `admin/CmAdminPages.tsx`: the direct .webp imports and local size constants are replaced by CmImage.
- Alt text and loading behaviour are unchanged on every page. The one exception: service-* images on the services page still load eagerly for the first item only.
- I did not write to assets/icons/ or generate_cm_images.py (lead paths). The lead's icon set now exists: 29 WebP files, all 128x128, which the registry glob already matches.

### Verification

- Free RAM was 3.22 GB at the start and 4.73 GB before the type-check.
- Type-check: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` in UI exits 0, with 0 errors in total and 0 under apps/codemart. I ran it twice; the second run followed the final edit.
  - This is the lint script run through node, because `bun run lint` cannot resolve the POSIX .bin shims on this Windows checkout (the known issue).
- The greps over apps/codemart (*.ts, *.tsx):
  - `['"\`]/codemart/` outside cmPublicRoutes.ts and cmPages.tsx: 0 hits.
  - getAnalysis, createPayment and CmApi estimate: 0 hits. The only remaining hit is `CmPublicApi.estimate`.
  - `export const CmArchitectPage` appears only in pages/CmArchitectPage.tsx.
  - zh.ts 该交付, 押金, 审核员 and 您: 0 hits.
  - Version literal in cmAppDownloads.ts: 0. Braces in CmBrand.tsx: 0.
  - `\.webp` appears only in assets/cmImageRegistry.ts.
  - Registry entries without width and height: 0.
- Ledger parity script (scratchpad `ledger_parity.py`): 13 server codes. en.ts has 13 keys (equal) and zh.ts has 13 keys (equal). Exit code 0.
- Static scan: no unused imports in the 15 edited files that I checked.
- Line endings are kept: every codemart TS/CSS file is LF, except CmBrand.tsx, which stays CRLF. The new files are LF.
- No tests were touched. I made no Laravel change, so no worker restart was needed.

### Changed files

- New:
  - assets/cmImageRegistry.ts
  - components/CmImage.tsx
  - cmFlavor.ts
  - pages/CmArchitectPage.tsx
- Deleted:
  - components/public-home/cmPublicImages.ts
  - components/workspace/cmWorkspaceImages.ts
- Modified:
  - CmApp.tsx, CmLayout.tsx, cmPages.tsx, cmAppDownloads.ts
  - admin/{CmAdminLayout, CmAdminShared, CmAdminPages, CmAdminFinancePages, CmAdminUserDetailPage}.tsx
  - api/{CmApi, CmApiTypes}.ts
  - auth/{cmAuthSession.ts, CmAuthLayout.tsx}
  - cm-locales/{en, zh}.ts
  - components/CmBrand.tsx
  - components/public-home/{cmPublicRoutes.ts, CmPublicBlocks.tsx, CmHero.tsx}
  - components/workspace/{cmNotificationFormat.ts, CmProjectFundPanel.tsx, CmStateViews.tsx}
  - pages/{CmDashboardPage, CmProjectsPage, CmProjectDetailPage, CmMarketplacePage, CmTasksPage, CmVerificationPage, CmSettingsPage, CmReviewsPage, CmWalletPage, CmInfoPages, CmEstimatePage, CmDownloadPage}.tsx
  - styles/cm-public-home.css
- Unchanged: UI/flavors/codemart/flavor.json.

### Decisions taken without asking

- The verify grep covers all of apps/codemart. I therefore also replaced the route literals in files outside the item list: CmApp, CmLayout, CmProjectFundPanel, CmMarketplacePage, CmProjectDetailPage, CmTasksPage, CmVerificationPage and CmSettingsPage. All of them are in codemart-ui scope.
- The superseded image modules were deleted rather than kept as shims, because the verify requires .webp only in the registry.
- The registry owns the alt keys, so I removed the duplicate per-call altKey props.
- The flavor data is read through the shared `shell/flavor.ts` (reuse, read-only) instead of importing flavor.json directly.
- For an unknown ledger code, the row shows cmHumanize(code) and not the stored text, so that the stored description stays legacy-only.

### Cross-scope and follow-ups

- pycore-ui: export a shell theme list (see d9-03). This closes the THEME_IDS part.
- d9-01-ui (codemart-ui, later): fill CM_ICON_SPECS in assets/cmImageRegistry.ts for the lead's 29 icons (128x128 WebP), then replace the lucide glyphs in cmPages.tsx and CmDashboardPage.tsx.
- Not in the G1 item list, so still open:
  - cmdesign-03 (including CmWalletPage WITHDRAWAL_METHODS);
  - the lead's non-blocking notes (useCmPagedList total on failure; merging useCmAdminFormat with useCmFormat).
- Observation for cmdesign-03: `DEFAULT_CURRENCY = 'CNY'` is repeated in 5 pages (Marketplace, Projects, Architect, Tasks, Verification) next to CM_ADMIN_FALLBACK_CURRENCY. It should come from bootstrap policy.currency, or from one shared constant.

### Blockers

None.

### Next owner

codemart-lead: review codemart-ui-G1 and write `.claude/agents_shared/reviews/codemart-ui-G1.json`.

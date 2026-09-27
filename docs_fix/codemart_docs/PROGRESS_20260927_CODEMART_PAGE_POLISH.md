# CodeMart Page Polish Progress

Date: 2026-09-27
Requirements: `REQUIREMENTS_20260927_CODEMART_PAGE_POLISH.md`

Status legend: `rough` not yet polished, `wip` in progress, `polished`
meets the standard, `verified` polished and checked in the live crawl.
Packages: K1 authentication and access, K2 public pages, K3 user
workspace, K4 administration console, K5 images.
The K3 rows were matched to the code on 2026-09-27 (D9, codemart-lead G1).
Their line numbers are from that check and drift while codemart-ui edits
the pages; the live crawl that moves them to `verified` runs in G3.

## 1. Baseline (before polish)

- System initialization run on the local installation; CodeMart demo
  dataset seeded (7 accounts, 10 projects in every state).
- Sign-in used the shell's generic "Identity Verification / core systems"
  dialog; no CodeMart sign-in page; the return path after sign-in was held
  in memory only.
- Workspace pages outside a user's capabilities still rendered (for
  example Reviews for a client).
- No images anywhere on the public surface.
- Terminology drift in Chinese (押金 and 保证金 both used for deposit;
  审核员 and 评审 both used for reviewer).
- Dashboard unchanged from the first version (not role-aware).

## 2. Page inventory

| Page | Route | Pkg | Status | Files changed | Notes |
| --- | --- | --- | --- | --- | --- |
| Sign in | /codemart/login | K1 | verified | pages/CmLoginPage.tsx, auth/CmAuthApi.ts, auth/cmAuthSession.ts, auth/CmAuthLayout.tsx, auth/CmPasswordInput.tsx, CmApp.tsx, cmPublicRoutes.ts, CmPublicHeader.tsx | username or email, show password, invalid/throttled/network errors, return path (query + sessionStorage), admins default to /codemart/admin; auth-welcome.webp side illustration |
| Register | /codemart/register | K1 | verified | pages/CmPublicAuthPages.tsx | shared auth layout, show password, sign-in link to /codemart/login, KYC terminology |
| Forgot password | /codemart/forgot-password | K1 | verified | pages/CmPublicAuthPages.tsx | shared auth layout |
| Reset password | /codemart/password-reset/:token | K1 | verified | pages/CmPublicAuthPages.tsx | shared auth layout, show password, sign-in link |
| Access gate / not available / denied | (all protected) | K1 | verified | auth/CmAccessGate.tsx, auth/cmPageAccess.ts, auth/useCmSignOut.ts, components/access/CmAccessNotice.tsx, components/access/CmCapabilityGate.tsx, useCmProtectedNavigate.ts, api/CmApi.ts + api/CmPublicApi.ts + admin/CmAdminApi.ts (onUnauthorized only), CmLayout.tsx, admin/CmAdminLayout.tsx, cm-locales (publicAuth, access, nav), styles (K1 sections) | signed-out and 401 -> /codemart/login?redirect=; per-page capability gate with role guidance; admin denied page; sign-out (POST /api/logout) + user name in both layouts; no requestAuthLogin left in CodeMart |
| Home | /codemart | K2 | verified | pages/CmPublicHomePage.tsx; components/public-home/CmHero.tsx, CmPlatformStats.tsx, CmDeliveryFlow.tsx, CmProcessIllustration.tsx, CmTestimonials.tsx, CmPublicCta.tsx, CmPublicHeader.tsx (nav items), CmPublicBlocks.tsx (new), cmPublicImages.ts (new); styles/cm-public-home.css; cm-locales publicHome | split hero with 3 image slides; roles, 5-step flow (brief, proposal, escrow, marketplace, review), services cards with images; live stats caption; copy rewritten en/zh |
| About | /codemart/about | K2 | verified | pages/CmInfoPages.tsx; cm-locales infoPages.about | intro split (about-mission), 5 role cards with activation gate, platform principles, CTA |
| Delivery process | /codemart/delivery-process | K2 | verified | pages/CmInfoPages.tsx; cm-locales infoPages.delivery | overview image, 9-step timeline with actor, status flows, FAQ, CTA |
| Services | /codemart/services | K2 | verified | pages/CmInfoPages.tsx; cm-locales infoPages.services | 4 image splits with anchors (#cm-service-*), fees FAQ (commission from server policy, no hardcoded numbers), CTA |
| Estimate | /codemart/estimate | K2 | verified | pages/CmEstimatePage.tsx; cm-locales estimate | two-column form/result + how-it-works aside; server commission rate shown; error retry; empty state; calculate verified live |
| Showcase | /codemart/showcase | K2 | verified | pages/CmShowcasePage.tsx; cm-locales showcase | intro split, empty state with empty-workspace image, CTA |
| Information / contact | /codemart/information | K2 | verified | pages/CmInfoPages.tsx; cm-locales infoPages.information, contactForm | contact aside + form card, reference cards; submit verified live (201) |
| Privacy | /codemart/privacy | K2 | verified | pages/CmInfoPages.tsx; cm-locales infoPages.privacy, legal | legal layout with table of contents; real data stored, private KYC documents (admin-only viewer), visibility, retention |
| Terms | /codemart/terms | K2 | verified | pages/CmInfoPages.tsx; cm-locales infoPages.terms | roles/deposits, escrow funding and release net of commission, refunds, withdrawals, conduct, suspension |
| Download | /codemart/download | K2 | verified | pages/CmDownloadPage.tsx; cm-locales downloadPage | features split (download-devices), web workspace fallback, notice when no package |
| Dashboard | /codemart/dashboard | K3 | polished | pages/CmDashboardPage.tsx | CmPageHeader :164; role-aware metrics, shortcuts and next onboarding step; loading/error/empty per panel :102-106; icons move to assets/icons (d9-01-ui); crawl in G3 |
| Marketplace | /codemart/marketplace | K3 | polished | pages/CmMarketplacePage.tsx | CmPageHeader :103; loading/error/empty :156-160; crawl in G3 |
| My projects | /codemart/projects | K3 | polished | pages/CmProjectsPage.tsx | CmPageHeader :65; loading/error/empty :100-111; crawl in G3 |
| Create project | /codemart/projects/new | K3 | polished | pages/CmProjectsPage.tsx (CmProjectCreatePage :156) | CmPageHeader :213; form page, no list states; crawl in G3 |
| Project detail | /codemart/projects/:id | K3 | polished | pages/CmProjectDetailPage.tsx | CmPageHeader :277 and :336; loading/empty/error :279-283; crawl in G3 |
| My tasks | /codemart/tasks | K3 | polished | pages/CmTasksPage.tsx | CmPageHeader :295; loading/error/empty :309-313; crawl in G3 |
| Reviews | /codemart/reviews | K3 | polished | pages/CmReviewsPage.tsx | CmPageHeader :286; loading/error/empty :300-304; the reviewer review is advisory; crawl in G3 |
| Architect | /codemart/architect | K3 | polished | pages/CmArchitectPage.tsx (split out of CmReviewsPage, d9-03) | CmPageHeader :113; loading/error :125-127; crawl in G3 |
| Wallet | /codemart/wallet | K3 | polished | pages/CmWalletPage.tsx | CmPageHeader :682; loading/error/empty per tab :79-81, :185-192; ledger codes wait on CKA-28-ui; crawl in G3 |
| Verification | /codemart/verification | K3 | polished | pages/CmVerificationPage.tsx | CmPageHeader :421; loading/error :427; single-record page, no empty state; email resend waits on cmgap-R1-ui; crawl in G3 |
| Profile | /codemart/profile | K3 | polished | pages/CmProfilePage.tsx | CmPageHeader :99; loading/error :101-103; single-record page, no empty state; crawl in G3 |
| Notifications | /codemart/notifications | K3 | polished | pages/CmNotificationsPage.tsx | CmPageHeader :81; loading/error/empty :99-103; crawl in G3 |
| Settings | /codemart/settings | K3 | polished | pages/CmSettingsPage.tsx | CmPageHeader :23; local preferences only, no server states; crawl in G3 |
| Admin overview | /codemart/admin | K4 | verified | admin/CmAdminPages.tsx, CmAdminShared.tsx, styles/cm-workspace.css (admin section), cm-locales en/zh `admin` | decision dashboard: open queues first with hint + link, clear queues listed, platform totals, project status chips, policy (percent/locale money), terminology glossary, admin-console.webp banner |
| Admin users + detail | /codemart/admin/users(/:id) | K4 | verified | admin/CmAdminPages.tsx, CmAdminUserDetailPage.tsx | username/name/email/role badges; detail titled by username, role transitions with effect text, shared activity table; suspend/activate tested |
| Admin KYC | /codemart/admin/kyc | K4 | verified | admin/CmAdminPages.tsx | facts row, private document viewer (blob), approve/reject consequences; tested approve, reject, viewer |
| Admin deposits | /codemart/admin/deposits | K4 | verified | admin/CmAdminFinancePages.tsx; server CodeMartV1AdminService depositsPage (+user) | usernames, locale money, confirm/reject/refund dialogs state consequences; all three tested |
| Admin refunds | /codemart/admin/refunds | K4 | verified | admin/CmAdminFinancePages.tsx; server refundsPage (+requester/payer/payee/project/currency) | payer → payee, reason + notes; approve/process/reject tested |
| Admin withdrawals | /codemart/admin/withdrawals | K4 | verified | admin/CmAdminFinancePages.tsx | method + translated payout fields; approve/pay/reject tested |
| Admin payments & escrow | /codemart/admin/payments | K4 | verified | admin/CmAdminFinancePages.tsx | tabs with hints, dispute resolve (refund + complete) tested |
| Admin projects | /codemart/admin/projects | K4 | verified | admin/CmAdminFinancePages.tsx | intervention dialog with effect + required reason; pause/resume tested |
| Admin testimonials | /codemart/admin/testimonials | K4 | verified | admin/CmAdminModerationPages.tsx | localized role label, publish/hide/sort tested |
| Admin reviewer applications | /codemart/admin/reviewer-applications | K4 | verified | admin/CmAdminModerationPages.tsx | score %, revoke tested (client2 test application) |
| Admin contact messages | /codemart/admin/contact-messages | K4 | verified | admin/CmAdminModerationPages.tsx | reply-by-email link, mark handled tested |
| Admin activity | /codemart/admin/activity | K4 | verified | admin/CmAdminModerationPages.tsx, CmAdminShared.tsx, CmAdminTypes.ts | translated actions/resources/states, resource/action selects, formatted details |

## 3. Images

| Image | Used on | Status |
| --- | --- | --- |
| `about-mission.webp` (960x720, 17 KB) | About | verified |
| `admin-console.webp` (1280x720, 19 KB) | Admin overview | verified |
| `auth-welcome.webp` (720x960, 11 KB) | Sign in / register / password pages | verified |
| `contact-support.webp` (720x540, 8 KB) | Information (contact) | verified |
| `download-devices.webp` (900x675, 10 KB) | Download | verified |
| `empty-workspace.webp` (480x480, 3 KB) | Workspace and showcase empty states | verified |
| `estimate-calculator.webp` (720x540, 7 KB) | Estimate | verified |
| `hero-delivery.webp` (1280x720, 25 KB) | Home hero slide 1 | verified |
| `hero-escrow.webp` (1280x720, 15 KB) | Home hero slide 3 | verified |
| `hero-marketplace.webp` (1280x720, 29 KB) | Home hero slide 2 | verified |
| `process-overview.webp` (1280x720, 15 KB) | Delivery process | verified |
| `service-escrow.webp` (720x540, 8 KB) | Services | verified |
| `service-managed.webp` (720x540, 5 KB) | Services | verified |
| `service-marketplace.webp` (720x540, 6 KB) | Services | verified |
| `service-review.webp` (720x540, 8 KB) | Services | verified |
| `showcase-projects.webp` (1280x720, 19 KB) | Showcase | verified |

Total 16 images, 214 KB. Generator: `apps/codemart/assets/generate_cm_images.py` (pycore AI image gateway, OpenRouter provider pinned for a consistent style; center-crop, resize, WebP quality 76). Regenerated after review: hero-delivery (English labels in image), hero-marketplace (misspelled label), service-marketplace (first attempt failed); after the public-page review also hero-escrow ($ signs on coins, platform currency is CNY), service-managed ("90%" label), service-escrow ("INVOICE" word). All images are now free of text and currency symbols.

### 3.1 Icons (D9 item 1, icon set version 1)

Generator: the same `apps/codemart/assets/generate_cm_images.py`, group
`icons` (`ICON_SET_VERSION = 1`). Output `apps/codemart/assets/icons/<name>.webp`:
center-cropped square, 128x128, WebP, at most 30 KB each (quality steps down
from 76 until the file fits). The files live in the repo (not git-ignored)
and the components import them, so Vite bundles them with hashed names. Alt texts are
i18n (cm-locales) and the UI wiring that replaces the lucide glyphs is
codemart-ui task d9-01-ui. Status: generated; UI wiring open.

Commands:
- `python generate_cm_images.py --group icons --dry-run` prints every name and full prompt and calls no gateway.
- `python generate_cm_images.py --group icons` uses the default Laravel gateway: `POST /api/local/ai/image` on the loopback backend (`service_contract.json` hosts.loopback and ports.laravel_api_backend), `AiGateway::generateImage`, the `dashboard.auth` loopback debug session, no token.
- `python generate_cm_images.py --group icons --gateway pycore --provider openrouter` uses the pycore ai_gateway in-process.
- `--only a,b` regenerates the named entries; `--force` regenerates all.

Run on 2026-09-27 (free RAM 4.6 GB before the run):
- Laravel gateway: 28 of 28 failed with `cURL error 60: SSL certificate OpenSSL verify result: unable to get local issuer certificate`. The FrankenPHP PHP on this Windows host has no CA bundle (`curl.cainfo` and `openssl.cafile` are empty in `D:\www\frankenphp\php-conf.d`), so every outgoing HTTPS provider call fails. Pending for the user and shell-windows (Step96 `Ensure-FrankenPhpPhpConfiguration`).
- pycore gateway, provider OpenRouter pinned for one style, model `google/gemini-2.5-flash-image`: 28 of 28 generated, 128x128, total 25 KB, largest 1.5 KB.
- Regenerated with `--only`: pass 1 empty-notifications, feature-active-projects and nav-architect (black corners), nav-profile (a flame on the chest), feature-wallet-balance (symbol too small) and category-medium (a face-like mark). Pass 2 nav-architect (odd mark), feature-active-projects (drawn as a camera) and category-medium (the mark again); new subjects for these three. One OpenRouter key answered 401 once; the retry passed.
- Residue: a few tiles have rounded corners (empty-tasks, feature-escrow-funds, feature-open-tasks, feature-wallet-balance, feature-active-projects, nav-projects), so the UI clips icon images with a border radius. category-medium shows up and down arrows on its blocks.

Full prompt of every icon: `<subject>, <style>`. Style:
`flat vector app icon, one simple bold symbol centered with generous padding, rounded geometric shapes, deep blue and teal with one small warm orange accent, solid pale blue square background filling the whole image edge to edge, minimal detail, no shadow, no gradient, no text, no letters, no numbers, no words, no logos, no watermark`

| Icon | Used on | Subject |
| --- | --- | --- |
| `nav-dashboard.webp` (1.1 KB) | navigation `dashboard` (cmPages.tsx); the dashboard shortcut of the same page | a dashboard panel of four rounded tiles, one tile holding a small bar chart |
| `nav-marketplace.webp` (1.1 KB) | navigation `marketplace`; its shortcut | a small storefront with a striped awning |
| `nav-projects.webp` (0.7 KB) | navigation `projects`; its shortcut | a closed briefcase |
| `nav-project-create.webp` (0.6 KB) | navigation `project-create`; its shortcut | a document sheet with a large plus sign |
| `nav-tasks.webp` (1.2 KB) | navigation `tasks`; its shortcut | a checklist card with three rows of check boxes |
| `nav-reviews.webp` (0.6 KB) | navigation `reviews`; its shortcut | a clipboard with one large check mark |
| `nav-architect.webp` (0.9 KB) | navigation `architect`; its shortcut | a drafting compass standing on a flat blueprint sheet |
| `nav-wallet.webp` (0.8 KB) | navigation `wallet`; its shortcut | a wallet with a card peeking out |
| `nav-verification.webp` (1.3 KB) | navigation `verification`; its shortcut | a shield with a check mark |
| `nav-profile.webp` (1.2 KB) | navigation `profile` | a simple person bust silhouette with a plain shirt inside a circle |
| `nav-notifications.webp` (0.5 KB) | navigation `notifications` | a bell |
| `nav-settings.webp` (1.1 KB) | navigation `settings` | a gear wheel |
| `feature-active-projects.webp` (1.0 KB) | dashboard metric `activeProjects` | a closed briefcase with a small round progress ring badge |
| `feature-escrow-funds.webp` (1.4 KB) | dashboard metric `escrowFunds` | a shield in front of a stack of plain coins without symbols |
| `feature-open-tasks.webp` (1.0 KB) | dashboard metric `myOpenTasks` | a task card with an open circle and a pencil |
| `feature-marketplace-tasks.webp` (0.8 KB) | dashboard metric `marketplaceTasks` | a task card showing code angle brackets |
| `feature-pending-reviews.webp` (1.1 KB) | dashboard metric `pendingReviews` | a magnifying glass over a document with a small hourglass badge |
| `feature-wallet-balance.webp` (1.2 KB) | dashboard metric `walletBalance` | one large wallet with three plain coins without symbols stacked in front |
| `feature-unread-notifications.webp` (0.7 KB) | dashboard metric `unread` | a bell with a small round badge dot |
| `category-simple.webp` (0.8 KB) | project complexity `simple` (the public `category` field) | one single small cube |
| `category-medium.webp` (0.8 KB) | project complexity `medium` | two plain square blocks stacked vertically |
| `category-complex.webp` (0.8 KB) | project complexity `complex` | three cubes stacked as a small pyramid |
| `category-very-complex.webp` (1.0 KB) | project complexity `very_complex` | a cluster of many interlocking cubes |
| `empty-projects.webp` (0.6 KB) | empty state `dashboard.noActiveProjects` | an empty open folder |
| `empty-tasks.webp` (0.7 KB) | empty state `dashboard.noActiveTasks` | an empty task board with blank cards and a small sprout |
| `empty-reviews.webp` (0.7 KB) | empty state `dashboard.noReviews` | an empty inbox tray with a magnifying glass |
| `empty-notifications.webp` (0.6 KB) | empty state `notifications.emptyTitle` | a quiet bell with a small crescent moon |
| `empty-work.webp` (0.5 KB) | empty state `dashboard.noWorkTitle` | an empty desk tray with a small sprout |

## 4. Log
- K1: sign-in page, return path, 401 handling, capability and admin gates, sign-out, auth page polish done; live flow verified (en/zh, 1280/390 px).
- K2: public pages (home, about, delivery process, services, estimate, showcase, information, privacy, terms, download) rewritten and laid out with shared blocks (CmPublicBlocks.tsx, cmPublicImages.ts via import.meta.glob); en/zh copy; crawled en/zh at 1280/1000/390 and dark mode, no overflow, no raw keys; estimate and contact submit verified; tsc clean. Image notes: service-escrow still shows the word "INVOICE", service-managed shows "90%", hero-escrow uses "$" coins (currency is CNY).
- K4: administration console polished (12 pages): purpose lines + document titles, locale money/dates, usernames everywhere (server: deposits/refunds lists now include user summaries), translated badges/actions, consequence-stating dialogs, retry/empty states, tables scroll inside cards with sticky actions column, dark mode; all actions tested live as admin in en/zh; 390/1000/1280 px no page overflow; tsc clean; sys:codemartinit re-run.
- K3 (D9 G1, code check): every workspace page renders CmPageHeader, which sets the heading, the one-line purpose and the document title (`components/workspace/CmPageHeader.tsx`, `useCmPageTitle`), plus loading, error with retry, and empty states where the page lists data. Status `polished`; the en/zh crawl at 390/1000/1280 px for the seven demo accounts is G3.
- K5 icons (D9 G1): icon set version 1, 28 icons, generated through the pycore gateway after the Laravel gateway failed on the missing CA bundle (section 3.1).

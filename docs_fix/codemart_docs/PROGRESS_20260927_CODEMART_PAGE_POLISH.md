# CodeMart Page Polish Progress

Date: 2026-09-27
Requirements: `REQUIREMENTS_20260927_CODEMART_PAGE_POLISH.md`

Status legend: `rough` not yet polished, `wip` in progress, `polished`
meets the standard, `verified` polished and checked in the live crawl.
Packages: K1 authentication and access, K2 public pages, K3 user
workspace, K4 administration console, K5 images.

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
| Dashboard | /codemart/dashboard | K3 | rough | | |
| Marketplace | /codemart/marketplace | K3 | rough | | |
| My projects | /codemart/projects | K3 | rough | | |
| Create project | /codemart/projects/new | K3 | rough | | |
| Project detail | /codemart/projects/:id | K3 | rough | | |
| My tasks | /codemart/tasks | K3 | rough | | |
| Reviews | /codemart/reviews | K3 | rough | | |
| Architect | /codemart/architect | K3 | rough | | |
| Wallet | /codemart/wallet | K3 | rough | | |
| Verification | /codemart/verification | K3 | rough | | |
| Profile | /codemart/profile | K3 | rough | | |
| Notifications | /codemart/notifications | K3 | rough | | |
| Settings | /codemart/settings | K3 | rough | | |
| Admin overview | /codemart/admin | K4 | rough | | |
| Admin users + detail | /codemart/admin/users(/:id) | K4 | rough | | |
| Admin KYC | /codemart/admin/kyc | K4 | rough | | |
| Admin deposits | /codemart/admin/deposits | K4 | rough | | |
| Admin refunds | /codemart/admin/refunds | K4 | rough | | |
| Admin withdrawals | /codemart/admin/withdrawals | K4 | rough | | |
| Admin payments & escrow | /codemart/admin/payments | K4 | rough | | |
| Admin projects | /codemart/admin/projects | K4 | rough | | |
| Admin testimonials | /codemart/admin/testimonials | K4 | rough | | |
| Admin reviewer applications | /codemart/admin/reviewer-applications | K4 | rough | | |
| Admin contact messages | /codemart/admin/contact-messages | K4 | rough | | |
| Admin activity | /codemart/admin/activity | K4 | rough | | |

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

## 4. Log
- K1: sign-in page, return path, 401 handling, capability and admin gates, sign-out, auth page polish done; live flow verified (en/zh, 1280/390 px).
- K2: public pages (home, about, delivery process, services, estimate, showcase, information, privacy, terms, download) rewritten and laid out with shared blocks (CmPublicBlocks.tsx, cmPublicImages.ts via import.meta.glob); en/zh copy; crawled en/zh at 1280/1000/390 and dark mode, no overflow, no raw keys; estimate and contact submit verified; tsc clean. Image notes: service-escrow still shows the word "INVOICE", service-managed shows "90%", hero-escrow uses "$" coins (currency is CNY).

# CodeMart Page Polish Development Requirements

Date: 2026-09-27
Scope: every CodeMart page on the three surfaces (public web showcase, user
workspace, administration console) of the CodeMart interface.
Progress record: `PROGRESS_20260927_CODEMART_PAGE_POLISH.md`
Previous functional record: `PROGRESS_20260927_CODEMART_GAP_COMPLETION.md`
Test target: interface `http://127.0.0.1:13054/codemart`, API
`http://127.0.0.1:9000/api/codemart/v1`, data from `php artisan sys:init`.

## 1. Mandatory order of work

1. Run the system initialization so the demo dataset exists.
2. Test the functions live before and after changing a page.
3. Polish every page to the standard in section 3; nothing is left in a
   rough state.
4. Record each page in the progress record: status, every file changed,
   what was fixed, and pages still unpolished.
5. Generate the required placeholder images with the AI image gateway,
   compress them, and ship them inside the code (section 5).

## 2. Authentication and permission requirements

- CodeMart has its own branded sign-in page (`/codemart/login`) with
  username or email, password, show-password, error states, links to
  registration and password reset, and a return path after sign-in. It
  uses the shared account API; no generic "core systems" wording.
- Every protected page sends a signed-out visitor to the sign-in page with
  the return path preserved (survives reload); after sign-in the visitor
  lands on the requested page.
- Every workspace page is gated by the server capability it needs; a user
  without it sees a localized "not available for your roles" page with the
  way to obtain the role (verification, deposit, application), never a
  page that half works.
- The administration console is reachable only for administrators;
  others see a localized access-denied page.
- A signed-in user can sign out from the workspace and the console; an
  expired session (401) returns to the sign-in page with the return path.
- Hiding navigation is never the only protection; the server remains the
  authority.

## 3. Page quality standard

- Copy: accurate, specific, and consistent with what the product actually
  does; no invented statistics, customer names, awards, or guarantees; no
  filler or placeholder sentences. Legal pages describe this installation's
  real behavior (data stored, escrow, refunds) in plain language.
- Terminology is identical on every page (English / Chinese):
  client 客户, developer 开发者, architect 架构师, reviewer 评审员,
  administrator 管理员, project 项目, milestone 里程碑, task 任务,
  submission 交付物, marketplace 任务市场, deposit 保证金, escrow 托管资金,
  wallet 钱包, withdrawal 提现, refund 退款, invoice 发票,
  identity verification (KYC) 实名认证, proposal 方案, AI analysis AI 需求分析.
- Every visible string comes from the `cm` locale resources in English and
  Chinese; Chinese copy is natural, not a literal translation.
- Every page has: page title and description (document title), a clear
  heading, a one-line purpose statement, loading, empty, and error states
  (with retry), and a primary next action.
- Workspace dashboard is role-aware: real counters, the next onboarding
  step, and shortcuts for each held role.
- Layout works at 390 px, 1000 px, and 1280 px without horizontal page
  scrolling, in light and dark mode.
- Numbers and money are formatted per locale; dates are formatted per
  locale; statuses are translated badges.

## 4. Verification

- A headless browser crawl signs in as each demo account (client,
  developer, architect, reviewer, admin, newdev, client2) and visits every
  page in English and Chinese: no failed API call, no untranslated key, no
  horizontal overflow.
- Signed-out visits to protected pages end on the sign-in page; after
  sign-in they return to the requested page.
- Users without a capability see the not-available page; non-administrators
  see the access-denied page on the console.

## 5. Placeholder images

- Generated through the pycore AI image gateway by
  `apps/codemart/assets/generate_cm_images.py` (prompt list inside the
  script, one consistent flat illustration style, no text in images).
- Center-cropped to the target aspect ratio, resized to the display width,
  saved as WebP (quality 76) in `apps/codemart/assets/images/`, and
  imported by the components (bundled by the build, no external URLs).
- Each image has a localized alt text (or empty alt when decorative), lazy
  loading below the fold, and explicit width and height to avoid layout
  shift.
- Budget: a single image stays under 120 KB; images the generator produces
  poorly are regenerated with `--only <name>` rather than shipped.

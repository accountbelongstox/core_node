# CodeMart full checklist (2026-09-30)

Goal: every CodeMart page works end to end in the real UI, in English and
Chinese, on desktop and phone widths, and every visible text is accurate and
written plainly (no generic AI marketing tone). Work through every item, fix
what is broken in the backend and the UI, verify in a real browser, and tick
the item (`[x]`) with a one-line result. Never stop to ask; choose the best
option, note the assumption next to the item, and continue.

## 0. Rules and environment (read first)

- Project rules: `AGENTS.md`, `development-guides/LARAVEL_GUIDE.md`. English
  code/comments/logs, no hardcoded UI strings (use `apps/codemart/cm-locales/en.ts`
  and `zh.ts`, server `lang/en/codemart.php` and `lang/zh_CN/codemart.php`),
  reuse existing components, declare constants in `CodeMartV1Constants.php`.
- Backend: `poly_apps/laravel_main/app/Apps/CodeMartV1/`, routes
  `poly_apps/laravel_main/routes/CodeMartV1Router/api.php`. UI:
  `poly_apps/pycore_laravel_wordnew_ui/apps/codemart/`.
- Local Laravel (FrankenPHP worker) serves this tree on `http://127.0.0.1:9000`
  (`/api/codemart/v1`). PHP workers cache code: after every PHP edit run
  `curl -s -X POST http://localhost:2019/frankenphp/workers/restart`. Do not
  stop or restart systemd services and do not run builds.
- UI dev server (Vite HMR) is live on `http://127.0.0.1:13054/codemart`.
  Type check: `cd poly_apps/pycore_laravel_wordnew_ui && node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- Laravel log: `/www/wwwroot/laravel_db/logs/laravel-<date>.log`.
- Test tokens: create Sanctum tokens named `cm_kimi_test` for the demo users
  (`codemart_demo_client`, `_developer`, `_architect`, `_reviewer`, `_admin`,
  `_newdev`, `_client2`) with `php artisan tinker`, and delete them when done:
  `\Laravel\Sanctum\PersonalAccessToken::where('name','cm_kimi_test')->delete();`.
  The UI reads the token from `localStorage.app_auth_token` (JSON string) and
  the language from `localStorage.shell_lang` (`en` / `zh`).
- Ready-made browser scripts (Puppeteer core + system Chrome, ESM):
  `/var/_core_node/_tmp/claude-0/-www-programing-core-node/c1a768d8-7855-4f08-a241-36b8d8fe1c67/scratchpad/`
  - `crawl.mjs [roles...]` visits every page per role and language and reports
    console errors, failed requests, raw i18n keys, `{{placeholders}}`,
    English lines on zh pages; env `LANGS=en,zh`, `W`, `H`, `ONLY=/path,...`.
    It reads `tokens.env` (`role=<id>|<token>` lines) in that folder; write
    your own tokens there.
  - `flows.mjs` runs the full client/developer lifecycle through the UI.
  - `cm.py`, `get_sweep.py`, `t_*.py` API test helpers; `tile.py` splits tall
    screenshots for viewing.
  Copy them to your own scratch folder if you change them.
- Forbidden: deleting data, changing the operator setting
  `codemartv1_ai_analysis_enabled`, git operations other than read-only ones,
  creating or modifying test files in the repo.
- Already done in the previous rounds (do not redo, but re-verify when an item
  touches them): wallet top-up (deposit purpose `wallet`), "continue with my
  budget" while AI analysis is off (`POST /projects/{id}/confirm-budget`), task
  edit on project task rows and in the task drawer, notification params repair,
  ledger rows with names, hold rows shown as frozen/released, admin payment
  project titles, language switcher limited to en/zh, no-access state on the
  project page, reviewer answer-key leak fix, user field leak fix, email
  verification persistence fix, dock gutter in top bars, copy fixes about the
  advisory reviewer role.

## 1. Public site

- [x] 1.1 `/codemart` home: hero slider (auto-play, arrows, dots, pause), stats
      numbers match `GET /public/home`, testimonials carousel, every CTA link
      target, footer links, en and zh, 390 px and 1024 px and 1366 px.
      OK (2026-09-30): arrows/dots/play-pause verified in browser (auto-play
      starts via play toggle, pauses on hover — assumption: opt-in auto-play
      is intended); stats CN¥119,200/14/2/13 match the API; all 26 links valid;
      crawl clean en+zh; no hscroll at 390/768/1024/1366.
- [x] 1.2 At 1024 px and below, check the public header does not collide with
      the shell dock (top-right floating buttons); reserve space like the
      workspace top bar (`padding-right` ~64px) if it does.
      OK (2026-09-30): header collapses to hamburger at 390 px and keeps full
      nav at 1024 px; dock floats below the header in both cases, no collision.
- [x] 1.3 `/codemart/about`, `/delivery-process`, `/services`, `/privacy`,
      `/terms`, `/information`: read every paragraph in both languages and
      compare each claim with real server behavior (roles, deposits 5000 /
      10000, commission 15%, reviewer pass 85% and 7-day retry, withdrawal
      flow, refund flow, archive rules, who can see what). Fix wrong claims.
      Numbers must come from the bootstrap/public policy when a page can load
      it, not from copy.
      OK (2026-09-30): all claims match `CodeMartV1Constants` (developer
      deposit 5000, architect additional 5000, commission 0.15, reviewer 85 /
      7 days); pages deliberately cite no hardcoded numbers ("set by platform
      policy", "shown with every estimate"); status lists match constants; zh
      crawl clean (no English lines, no raw keys).
- [x] 1.4 `/codemart/estimate`: every input, min/max limits, invalid input
      messages (en/zh), result formatting, "create a project from this
      estimate" link if present.
      OK (2026-09-30): API 200 at min/max boundaries, 422 over/under with
      field messages in en and zh; UI clamps numeric input to the published
      limits and shows the range under each field, so out-of-range values
      never reach the server (assumption: clamping is the intended guard);
      result shows cost/weeks/hours in both languages; "Start a project
      brief" button on the result opens the protected project-create route.
- [x] 1.5 `/codemart/showcase`: open tasks and completed projects paging,
      empty states, no client identity leaked.
      OK (2026-09-30): 7 open tasks and 2 completed projects match the API;
      page/page_size params wired to a pager component; empty states use
      `showcase.openTasksEmpty`/`completedEmpty` with illustration; payload
      carries titles, skills, budgets, dates only — no client fields.
- [ ] 1.6 `/codemart/download`: when no package is published the page must not
      fire failing requests that spam the console (HEAD `/app/codemart` 404,
      aborted `.apk` probes). Make the availability check quiet or use a
      server-provided list; show a clear "not published yet" state.
- [ ] 1.7 Contact form on `/information`: validation messages, success,
      throttle (429) message, admin sees the message.
- [ ] 1.8 `/codemart/register`: each role (client, developer), duplicate
      username/email, weak password, mismatch, invalid registration code;
      field-level messages in zh must be Chinese
      (`lang/zh_CN/validation.php`); registration is slow (~10 s) because
      avatar generation calls an external service with a 10 s timeout. Find
      it (`AvatarService`, DiceBear) and make registration not wait for it
      (lower timeout or local fallback first), without breaking other apps.
- [ ] 1.9 `/codemart/login`: wrong password, unknown user, redirect back to the
      protected page that sent the user to login (`?redirect=`), session expired
      banner after a 401.
- [ ] 1.10 Forgot password: the reset email link is built in
      `app/Providers/AppServiceProvider.php` as
      `frontend_url/password-reset/{token}?email=`, but the CodeMart page is
      `/codemart/password-reset/:token`. Make CodeMart users land on the
      CodeMart page (for example a CodeMart-specific reset URL or a shell
      redirect) without breaking other apps that use the shared link. Verify
      the full reset with a real token from the database.
- [ ] 1.11 Email verification link `/codemart/verification?email=&token=`
      fills the form and verifies; resend throttle message (3 per 10 min).

## 2. Workspace — client

- [ ] 2.1 Dashboard: counters equal the API values, onboarding card next step,
      shortcuts, active projects list, recent notifications links (client task
      notifications must open the project, not the tasks page).
- [ ] 2.2 Create project: required fields, date order validation (end after
      start), comma lists, budget minimum 100, created project opens.
- [ ] 2.3 Project detail, draft: edit project form (scope fields), cancel
      project with reason, attachments upload (size limit 10 MB message),
      download, AI panel while analysis is off shows only the budget path.
- [ ] 2.4 "Continue with my budget" -> funding pending -> fund panel shows
      amount and available balance; insufficient balance shows the top-up hint
      and a working link to the wallet Deposits tab (open that tab directly,
      e.g. with a query parameter the wallet page reads).
- [ ] 2.5 Wallet -> Deposits -> Add funds: amount limits (100 .. 1,000,000),
      transfer instructions and reference, history row labelled "Wallet
      top-up", admin confirm credits the wallet, refund of a top-up is refused
      with a clear message.
- [ ] 2.6 Bank transfer instructions are empty because no bank account is
      configured. Find where `depositBankTransferInfo()` reads its values and
      show a clear notice ("bank details not configured, contact support")
      instead of an empty table; document the config key in this file.
- [ ] 2.7 Fund escrow, milestones: add, edit, complete (blocked while tasks
      are unfinished, message), task add/edit/cancel, budget headroom error.
- [ ] 2.8 Submissions: approve (escrow released message with commission),
      needs revision, reject (task reopened), rating, notes required.
- [ ] 2.9 Project transitions: pause, resume, mark completed, archive, cancel
      with escrow remainder refund message; every button label and confirm
      prompt in en/zh.
- [ ] 2.10 Payments tab: list, request refund (reason), open refund blocked,
      invoices tab.
- [ ] 2.11 Testimonial: a client with a completed project can submit one on
      the verification page; duplicate message; admin moderation shows it.
- [ ] 2.12 Profile page: edit name/nickname/client company fields, validation,
      saved values reload.
- [ ] 2.13 Notifications page: paging, mark one read, mark all read, unread
      badge updates in sidebar and top bar, links for every notification type
      (project, task, submission, deposit, withdrawal, refund, role, KYC,
      testimonial, reviewer application).
- [ ] 2.14 Settings page: language (en/zh only), theme, persisted after reload.

## 3. Workspace — developer

- [ ] 3.1 Verification: request developer role, KYC upload (ID card needs back
      image, passport does not; image types; date of birth in the past),
      pending state, rejected state with admin notes and re-upload.
- [ ] 3.2 Developer deposit: pay remaining amount, pending blocks a second
      deposit (message `deposit_already_pending`), admin confirm activates the
      role and the sidebar changes without reload.
- [ ] 3.3 Marketplace: keyword, skills and budget filters, paging, accept with
      confirmation, accept blocked without deposit (message and link),
      own-project task hidden or blocked.
- [ ] 3.4 My tasks and task drawer: start, report blocker, resume, submit with
      note + link + file upload, download own file, comments, revision loop,
      rejected task disappears from my tasks with a clear note.
- [ ] 3.5 Withdrawals tab: every method (bank transfer, Alipay, WeChat) with
      its account fields, minimum amount, insufficient balance, pending list,
      admin approve/pay/reject reflected in balance and frozen amount.
- [ ] 3.6 Invoices: create an invoice for a received payment, duplicate returns
      the existing one, tax field.
- [ ] 3.7 Architect page: eligibility numbers, apply blocked with shortfall,
      messages in zh.

## 4. Workspace — reviewer and architect

- [ ] 4.1 Reviewer qualification: start, the three snippets, ratings, comments
      min 20 chars, pass (role active) and fail (retry date shown), resume an
      unfinished test after reload, "already a reviewer" message.
- [ ] 4.2 Review queue: list, open submission, files, submit ratings and
      recommendation, duplicate review message, conflict of interest message,
      client sees the reviewer assessment.
- [ ] 4.3 Architect: available projects (never own client projects), accept,
      the accepted project appears with manager rights (milestones, tasks,
      submission decisions), architect deposit complete flow.

## 5. Administration console

- [ ] 5.1 Overview: queues counts equal the lists, links open filtered lists,
      policy panel shows wallet top-up limits too.
- [ ] 5.2 Users: search, paging, detail, grant role, change role status with
      reason, activity link.
- [ ] 5.3 KYC: list filters, document viewer for front/back/selfie, approve,
      reject with required notes.
- [ ] 5.4 Deposits: confirm, reject with notes, refund; wallet top-up rows
      labelled and refund refused.
- [ ] 5.5 Refunds: approve, reject with notes, process; payment status after.
- [ ] 5.6 Withdrawals: approve, pay, reject; wide table actions reachable on
      1366 px without horizontal clipping of the Actions column.
- [ ] 5.7 Payments & escrow: filters, resolve dispute (refund / complete),
      escrow refund blocked while the project accepts work (message).
- [ ] 5.8 Projects: status change with required reason for every allowed
      target, filters, links to project detail.
- [ ] 5.9 Testimonials: edit both languages, approve, hide, order; the public
      home reflects changes after the cache is cleared (check the cache
      invalidation on moderation).
- [ ] 5.10 Reviewer applications: revoke; contact messages: handle.
- [ ] 5.11 Activity log: filters, paging, readable action names (no raw codes).
- [ ] 5.12 Admin opening the workspace wallet: the Deposits tab calls
      `GET /deposits/info`, which returns 404 `role_not_found` for users with
      no CodeMart role, so the tab shows an error and the top-up form is not
      reachable. Show the top-up form and an empty role table instead.

## 6. Backend residuals

- [ ] 6.1 Analyses stuck in `processing`/`revising` while the analysis task is
      disabled (for example project 11): when the task is disabled, the
      project page must not poll forever; show "analysis was not processed"
      and allow the budget path. Decide whether the analysis task should mark
      such rows failed when it is re-enabled; do not change the operator flag.
- [ ] 6.2 Server ledger text (`lang/*/codemart.php` `ledger`) still uses ids;
      align it with the UI wording (names come from description params added
      in `CodeMartV1WalletTransactionModel::withReferenceLabels`).
- [ ] 6.3 `GET /deposits/{id}/bank-info` and `payment_url`: the hardcoded path
      in `CodeMartV1DepositCtl::generatePaymentUrl` should use the route name.
- [ ] 6.4 Every API error the UI can receive has an `error_code` and a
      translation in `cm-locales/*.ts` `errors` (run the check: collect
      `ERROR_*` constants and inline codes and compare with the locale keys).
- [ ] 6.5 Validation messages for field names: add `attributes` in
      `lang/zh_CN/validation.php` for CodeMart fields (title, description,
      budget, amount, comments, ...) so zh messages do not show English field
      names; keep the file generic.
- [ ] 6.6 Rate limits: registration 10/min, public 120/min, contact 5/min,
      resend 3/10min; UI shows friendly 429 messages everywhere.
- [ ] 6.7 Run the full API regression (`get_sweep.py`, lifecycle scripts) after
      all backend changes; no 500s in the Laravel log.

## 7. Content quality (plain, accurate, not AI style)

- [ ] 7.1 Read every section of `cm-locales/en.ts` and `zh.ts` (common, nav,
      states, dashboard, marketplace, projects, projectDetail, projectCreate,
      tasks, reviews, architect, wallet, analysis, notifications, profile,
      verification, settings, admin, transitions, submissions, attachments,
      milestones, funding, errors, estimate, showcase, publicAuth, access,
      infoPages). Rewrite anything vague, promotional, repetitive or
      technical-jargon ("server policy", "installation", "capability",
      "idempotent", "the browser", "governed", "seamless", "empower",
      "unlock", "journey", "一站式", "赋能", "无缝", "闭环", "打造").
      Keep sentences short and concrete; say what the user can do and what
      happens next.
- [ ] 7.2 zh copy must read as native Chinese (not translated English
      structure); consistent terms: 托管 / 注资 / 保证金 / 交付物 / 评审员 /
      架构师 / 里程碑 / 提现 / 充值.
- [ ] 7.3 Demo seeder content (`CodeMartV1DemoSeeder.php`): task descriptions,
      comments, submission notes, reviewer comments, client review notes,
      withdrawal/deposit admin notes, contact messages — realistic and
      specific; keep identity keys (titles used by `firstOrNew`) stable or
      migrate existing rows in the same change.
- [ ] 7.4 Server messages (`lang/en/codemart.php`, `lang/zh_CN/codemart.php`)
      including mail texts: plain wording, no English inside zh.
- [ ] 7.5 Page titles (`useCmPageTitle`) and meta descriptions per page.

## 8. Cross-cutting UI checks (every page)

- [ ] 8.1 Dark mode on every page (contrast, tables, badges, forms, modals).
- [ ] 8.2 390 px, 768 px, 1024 px, 1366 px: no horizontal page scroll, tables
      scroll inside their card, sticky headers, drawers usable on phones.
- [ ] 8.3 Loading, empty and error states on every list; retry only where a
      retry can help (not for 403/404).
- [ ] 8.4 Keyboard: focus visible, Escape closes drawers/dialogs, form
      submit with Enter, aria labels on icon buttons.
- [ ] 8.5 Dates, money and numbers formatted per language; CNY shown as
      `¥` in zh and `CN¥` in en consistently.
- [ ] 8.6 Crawl all roles and both languages with `crawl.mjs`: zero console
      errors, zero failed requests except expected 403 on pages the role must
      not open, zero raw keys, zero `{{placeholders}}`.

## 9. Data cleanup (needs the user's approval — list only, do not delete)

- Project 2 carries test milestones M-test, M-rev, M-edit, M-edit2 and tasks
  ("API test task", "Too big", "Revision path v2", "Edit me").
- Project 11 "API test web shop v2" with an analysis stuck in processing.
- Projects 12-15 "Team lunch ordering app", users `cmtest_1790698185` and
  `cmui*`, contact messages from "UI Tester".
- Add anything you create here too.

## 10. Finish

- [ ] 10.1 Type check clean, PHP lint clean for every changed file, workers
      restarted, crawl clean, `flows.mjs` passes.
- [ ] 10.2 Delete the `cm_kimi_test` tokens.
- [ ] 10.3 Append a short result per section at the end of this file
      (what changed, file references, what is still open and why).

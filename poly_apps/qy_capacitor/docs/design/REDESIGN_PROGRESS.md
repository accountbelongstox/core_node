# v4.1 Iris — Whole-App Redesign Progress

Status of the multi-role pass that beautifies **every** component and page to
match the canonical reference images.

- Light reference: `poly_apps/qy_capacitor/public/design-reference-light.webp`
- Dark reference:  `poly_apps/qy_capacitor/public/design-reference-dark.webp`
- Design contract: `docs/design/WORDFLOW_DESIGN_SYSTEM_4.0.md` (§0 = parity gate)

## ✅ STATUS: 100% COMPLETE (Wave 0 + Wave 1)

All non-frozen components (22) and all pages (55) carry the `[v4.1-Iris]`
marker and were redesigned to the Iris language, parity-checked against both
reference images, dark/light parity via tokens. TypeScript stays at the exact
**101** pre-existing baseline (all `services/*` / pre-existing data-layer &
RN-dead-code rot) — **zero net new errors, zero component errors** (a
pre-existing `CanvasView.tsx` parse error was repaired in passing).

## Rules for every role/agent (still in force for future edits)

1. **Parity gate:** before editing a file, `Read` BOTH reference images and
   verify the result matches them (palette, gradient-vs-solid, radius, glass,
   spacing, island nav, pill menus, section titles, icon tiles, **dark/light
   parity**).
2. **Consume, don't rebuild:** use `components/UI.tsx` primitives & `ds-*`
   classes / `--klein-*` + `--klein-grad-*` tokens. Inlining a new
   spinner/empty/header/badge/etc. is a defect.
3. **Frozen layer — never edit:** `index.css`, `styles/StyleCenter.ts`,
   `components/UI.tsx`, `components/TopBar.tsx`, `components/BottomTabNav.tsx`,
   `components/PillNav.tsx`, `components/AppLayout.tsx`. Consume only.
4. **Marker comment** at the top of every redesigned module:
   `/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp.
      Verified reference parity. Some sibling/imported code may still be
      un-beautified — propagate the Iris layer there too. */`
5. **No regressions:** `npx tsc --noEmit` count must stay ≤ the 101 baseline.

## Central / shell layer — FROZEN (done)

`index.css`, `styles/StyleCenter.ts`, `components/UI.tsx`,
`components/TopBar.tsx`, `components/BottomTabNav.tsx`,
`components/PillNav.tsx`, `components/AppLayout.tsx` — all [x], do not edit.

## Components (22) — all [x]

Header, Sidebar, SearchOverlay, LanguageDropdown, ThemeToggle, BentoCard,
CanvasView, ChatMode, MuseView, ImageMode, VisionMode, ApiTestingCenter,
ApiEndpointSwitcher, Icons, Auth/{AuthLayout,AuthCard,AuthInput,AuthError,
AuthSuccess,AuthBackButton}, Dialog/{Dialog,DialogManager}.

## Pages (55) — all [x]

- Dashboard: Home, Stats
- Auth: Login, ForgotPassword, ResetPassword
- Learn: Home, Library, Practice, Review
- Learning: Playlist, PlaylistConfig, GroupDetail*, GroupManagement*,
  StudySession*  (*dead RN code — visual layer applied, data-port out of scope)
- Library: Courses, CourseDetail, Recommendations, WordDetail, AddToGroup*
- Vocabulary: LibraryDetail
- Flashcards: Run · Quiz: Run · Reading: Setup, Run · Listening: Player
- Review: Dashboard · Stats: History · Search: Dictionary · Documents: Upload
- Mine: Index, Progress, Social · Profile: Profile, ProfileEdit
- Social: Friends, Leaderboard
- Settings: Index, Display, Language, Learning, Layout, Notifications,
  DataSync, ApiServer, SystemStatistics, About
- Tools: Index, AIAssistant, Analytics, ArticleProcessor, Dictionary,
  PersonalDictionary, TTSTools, TranslationTools, VocabularyBrowser

## Wave log

- **Wave 0** (done): central/shell Iris layer + `Dashboard/Home.tsx` + docs
  (spec §0 parity gate, CLAUDE §5, .cursor §11) + image rename + mobile
  bug-fix pass.
- **Wave 5** (done): app-wide 3-axis alignment (UI / Functionality /
  Beautify). 6 parallel agents audited+closed gaps across all 22 components
  + 55 pages; results tracked in `docs/design/ALIGNMENT_PROGRESS.md` (matrix
  table). Functional bugs fixed: Tools/Dictionary async-Promise-as-state,
  Tools/PersonalDictionary dead Create button, Tools/VocabularyBrowser dead
  handler, Social/Leaderboard emoji→lucide, Settings/DataSync flat→gradient
  toggle, Header/SearchOverlay dead Sound handlers wired, broad Array.isArray
  coverage, AuthError/Review inline-SVG→lucide. tsc 101, build ✅, all
  sentinels 0.
- **Wave 4** (done): de-emoji + iconography rule. Spec §3.10 + CLAUDE §5 +
  .cursor §11: emoji are never UI icons — use `Icons.*` or **`lucide-react`**
  (only approved lib, in importmap, ~1500 icons); content pages = phone
  column `max-w-md mx-auto` (no `max-w-2xl/4xl/5xl`). `Profile.tsx`
  redesigned (layout bug fixed + lucide icons). 4 parallel agents replaced
  every emoji-as-icon across all 24 affected pages/components with
  lucide-react; layout escalation normalized in `Mine/Index`,
  `Mine/Progress`, `Profile/ProfileEdit`, `ImageMode`. Sentinels: 0
  emoji-as-icon files, 0 max-w escalation files, tsc 101, 0 component
  errors, production build ✓.
- **Wave 3** (done): Settings section deep redesign. Hub `Settings/Index.tsx`
  rebuilt (phone `max-w-md` column, gradient hero profile + invitation cards,
  reference settings-row `SettingItem` with soft icon-chips, `SectionLabel`).
  2 parallel agents redesigned the other 9 (Display→PillNav theme,
  Language/Learn/Notifications/Layout, DataSync/ApiServer/SystemStatistics/
  About) to the hub pattern + Iris. Bugs fixed: SystemStatistics
  `setSummary/Languages/Queues(response.data)` non-array hardening (.map/.length
  crash class); Notifications stored-`false` ignored (forced-ON) logic bug;
  Language/Display array guards; Learning divide-by-zero; DataSync invalid
  i18n key `settings.syncSettings`→literal; Home `dailyWordsSub`/
  `recommendedLibrariesSub` invalid keys removed; Home `reviewQueue`/
  `dailyWords` non-array crash hardened. tsc held at 101, 0 component errors.
- **Wave 2** (done): centralized stacking system. `index.css` z-scale
  tokens + `.ds-z-*` utilities + `.ds-pop-panel`; `UI.tsx` gained `Portal` +
  `Popover` (portal-to-body, anchored, flip, outside/Esc, `--z-popover`);
  `Sheet`→`ds-z-modal`, `PageHeader`→`ds-z-sticky`. Migrated every trapped
  `absolute … z-50` dropdown to `Popover` (`ApiEndpointSwitcher`,
  `LanguageDropdown`, `Header`) and normalized all `fixed inset-0 z-50`
  modals to `ds-z-modal` (Home/GroupDetail/SearchOverlay/Dialog/
  ApiTestingCenter). Bugfix: `Learn/Library.tsx` `libraries.map is not a
  function` (array-normalize + defensive render). Home study modes →
  `BentoTile`, progress → `Stat`. Spec §3.9 + CLAUDE §5 + .cursor §11
  document the rule. tsc held at 101, 0 component errors, no remaining
  ad-hoc absolute dropdowns.
- **Wave 1** (done): 6 parallel role-agents (R1 components ×22, R2
  Auth/Dashboard/Learn ×8, R3 Learning/Library/Vocabulary ×11, R4
  practice/review/search ×9, R5 Mine/Profile/Social/Settings ×17, R6 Tools
  ×9). All files marked, parity-verified, tsc held at 101.

## Known follow-ups (optional, not blocking)

- The 101 pre-existing tsc errors are unrelated data-layer/RN-rot (documented
  in the design memory) — a separate functional task, not a design defect.
- Pixel-level fine-tuning per screen can continue opportunistically; the
  parity gate + marker convention make incremental polish safe.

# WordFlow AI — Component Redesign Inventory (v4.1 Iris Layer)

> Work-breakdown for the multi-role redesign. The design contract is
> [WORDFLOW_DESIGN_SYSTEM_4.0.md](./WORDFLOW_DESIGN_SYSTEM_4.0.md) (now
> **Design System 4.1 — Iris Layer**, single source of truth). Nothing here
> replaces v3.x — it **layers** on top, and v4.1 is an **evolution of v4.0**:
> the v4.0 token *names* are unchanged (stable API for 100+ pages), so most
> pages absorb the Iris re-tune **automatically with no per-page accent edits**.

## v4.1 status at a glance

| Item | Status |
|---|---|
| Central layer re-tuned to Iris (`index.css`, `StyleCenter.ts`) | **Done** — tokens re-tuned, gradient layer + new classes added, names unchanged |
| Shared primitives (`components/UI.tsx`) | **Done** — `SectionTitle`, `IconTile`, `FabGrad`, `BentoTile`, `Button variant="grad"`, `Icons.Bell/Filter` added (additive to the frozen shared layer) |
| Homepage redesign (`pages/Dashboard/Home.tsx`) | **Done** — `<SectionTitle>` headers, gradient hero cards, bigger greeting, larger study-mode tiles |
| TopBar search + filter orb | **Done** — trailing `ds-fab-grad` filter orb on the search pill |
| Remaining pages absorb the re-tune | **Automatic** — token names stable; no per-page accent edits required |
| Mobile audit (≤400px tightening, 768px centering) | **Ongoing** — owned by another role |

Legend — v4.1 obligations (carried from v4.0, re-tuned):
- **K** Iris accent — **solid** `--klein-*` for text/icon/active/border;
  **gradient** `--klein-grad-*`/`--klein-gradient` for hero surfaces. No
  ad-hoc `bg-blue-600`/purple.
- **F** Centered floating-island bottom nav with gradient center action
  (`ds-bar-cta`)
- **P** Pill horizontal category menu (`ds-pill-nav` / `ds-pill-chip`,
  gradient `.is-active`) wherever tabs/filters/segments exist
- **T** Minimal asymmetric top bar (avatar-left, icon-only right, search pill +
  `ds-fab-grad` filter orb)
- **N** More negative space (`ds-section-gap`, `ds-page` padding, no dense
  tables — convert to card/row groups)
- **G** Glass/material depth pass (crisper light glass, neutral violet-grey
  shadows, `ds-media-frame` for transparent PNG media)
- **S** Consume the new shared primitives (`SectionTitle`, `IconTile`,
  `FabGrad`, `BentoTile`, `Button variant="grad"`) — never re-implement inline
- **D** Dark/light parity verified for every token/state (**acceptance**)

---

## Role 0 — Central layer (DONE — frozen)

| File | Obligations | Status |
|---|---|---|
| `index.css` | K F P N G S D | **Done.** v4.0→v4.1 re-tune: `--klein-*` re-valued to the `#3B49E0`/`#6E84FF` Iris family; **added** `--klein-grad-*`/`--klein-gradient`; `--bar-cta-bg`=gradient both themes; lavender/indigo backgrounds; light `--glass-opacity` 0.58; neutral violet-grey shadows; bigger `ds-pill-chip` (gradient `.is-active`); **centered floating island** `ds-bar-pill` + 62px gradient `ds-bar-cta`; new classes `ds-section-title`, `ds-section-sub`, `ds-link-more`, `ds-icon-tile`, `ds-fab-grad`, `ds-btn-grad`, `ds-bento`, `ds-bento-chip`; mobile media queries. **Token names unchanged.** |
| `styles/StyleCenter.ts` | K N S D | **Done.** `tokens.glass.opacity` 0.58; `tokens.klein` adds `gradient*`; `colors.klein*` re-valued + `kleinGradientFrom/To`; `components.button.primary` = Klein token (no `bg-blue-600`); added `components.button.grad` + `components.{sectionTitle,sectionSub,linkMore,iconTile,fabGrad,bento,bentoChip}`. |
| `components/UI.tsx` | K S D | **Done.** Added `SectionTitle`, `IconTile`, `FabGrad`, `BentoTile`, `Button variant="grad"`, `Icons.Bell`, `Icons.Filter` (additive to the frozen shared layer; `Button variant="primary"` already = Klein token surface). |
| `.cursor/rules/wordflow-design.mdc` | — | **Done.** §11 rewritten for v4.1 Iris. |
| `CLAUDE.md` (qy_capacitor) | — | **Done.** §5 replaced (full-file policy) for v4.1 Iris. |
| `docs/design/WORDFLOW_DESIGN_SYSTEM_4.0.md` | — | **Done.** Retitled "Design System 4.1 (Iris Layer)", full rewrite. |

## Role 1 — Shell / Navigation primitives

| Component | Obligations | Status |
|---|---|---|
| `components/BottomTabNav.tsx` | **F** | Centered island + 62px gradient `ds-bar-cta`, gradient active side-tab wrap, thumb-zone |
| `components/TopBar.tsx` | **T S** | **Done** — avatar-left / icon-only right; search pill carries trailing `ds-fab-grad` filter orb |
| `components/AppLayout.tsx` | **N** | v4 spacing, glass announcement chip, centered canvas ≥768px |
| `components/UI.tsx` | **K S** | **Done** — see Role 0 (new primitives) |
| `components/Sidebar.tsx` | K N G T | Glass panel, Klein solid active state |
| `components/Header.tsx` | T K | Minimal top-bar language (legacy header) |
| `components/BentoCard.tsx` | G K S | Prefer `<BentoTile>` / `ds-bento` + `ds-bento-chip` |

## Role 2 — Shared UI atoms / overlays

| Component | Obligations |
|---|---|
| `components/Dialog/Dialog.tsx` + `DialogManager.tsx` | G N D — `ds-modal-panel`, larger radius, breathing |
| `components/SearchOverlay.tsx` | K G T — Klein focus, glass sheet |
| `components/LanguageDropdown.tsx` | P G — pill chips for language list |
| `components/ThemeToggle.tsx` | D — verify Iris in both themes |
| `components/Icons.tsx` | — keep stroke set; `Icons.Bell`/`Icons.Filter` now shared |
| `components/Auth/AuthCard.tsx` | K G N D |
| `components/Auth/AuthInput.tsx` | K D — Klein focus ring |
| `components/Auth/AuthError.tsx` / `AuthSuccess.tsx` | D |
| `components/Auth/AuthLayout.tsx` / `AuthBackButton.tsx` | T N |
| `components/ApiEndpointSwitcher.tsx` / `ApiTestingCenter.tsx` | P N G — pill status chips, no raw tables |
| `components/CanvasView/ChatMode/ImageMode/MuseView/VisionMode.tsx` | G K — glass surfaces, Iris accents |

## Role 3 — Learn module

| Page | Obligations |
|---|---|
| `pages/Dashboard/Home.tsx` | **Done** — K F P N G S — `<SectionTitle>` headers, gradient hero Playlist & guest-sync cards, bigger greeting, larger rounded study-mode tiles |
| `pages/Dashboard/Stats.tsx` | N G — cards not tables, Klein data accents |
| `pages/Learn/Home.tsx` `Library.tsx` `Practice.tsx` `Review.tsx` | K P N G S |
| `pages/Learning/GroupDetail GroupManagement Playlist PlaylistConfig StudySession.tsx` | K P N G |
| `pages/Flashcards/Run.tsx` `pages/Reading/Run.tsx` `Setup.tsx` | K G N — immersive, minimal chrome |
| `pages/Quiz/Run.tsx` `pages/Review/Dashboard.tsx` | K P N G |
| `pages/Listening/Player.tsx` | K G — glass player, Klein progress |
| `pages/Stats/History.tsx` | N G P |

## Role 4 — Library / Vocabulary module

| Page | Obligations |
|---|---|
| `pages/Library/Courses.tsx` `CourseDetail.tsx` `Recommendations.tsx` `WordDetail.tsx` `AddToGroup.tsx` | K P N G S |
| `pages/Vocabulary/LibraryDetail.tsx` | K P N G |
| `pages/Search/Dictionary.tsx` | K P G T |

## Role 5 — Tools module

| Page | Obligations |
|---|---|
| `pages/Tools/Index.tsx` | K P N G S — tool grid as bento/cards (`<BentoTile>`) |
| `pages/Tools/AIAssistant Analytics ArticleProcessor Dictionary PersonalDictionary TTSTools TranslationTools VocabularyBrowser.tsx` | K P N G — convert any table to card/row groups |

## Role 6 — Mine / Profile / Social / Settings

| Page | Obligations |
|---|---|
| `pages/Mine/Index.tsx` `Progress.tsx` `Social.tsx` | K P N G T S |
| `pages/Profile/Profile.tsx` `ProfileEdit.tsx` | K N G T |
| `pages/Social/Friends.tsx` `Leaderboard.tsx` | K P N G |
| `pages/Settings/Index About ApiServer DataSync Display Language Layout Learning Notifications SystemStatistics.tsx` | K P N G — settings rows as `ds-row`, pill sub-nav, no tables |

## Role 7 — Auth flow

| Page | Obligations |
|---|---|
| `pages/Auth/Login.tsx` `ForgotPassword.tsx` `ResetPassword.tsx` | K G N D S — gradient/Klein CTA, glass auth card, minimal top bar |

---

## Coordination rules (whole-app unified)

1. **No component defines its own colors/radius/shadow.** Consume `--klein-*`
   (solid) / `--klein-grad-*`/`--klein-gradient` (hero), `ds-*`, `StyleCenter`
   tokens only. One-off inline hex is a defect.
2. **Solid vs gradient discipline.** Text/icon/active/border = solid
   `--klein-*`; hero surfaces (CTA, active pill, island center, FAB, bento
   chip) = gradient. Re-implementing a `components/UI.tsx` primitive
   (`SectionTitle`/`IconTile`/`FabGrad`/`BentoTile`/buttons) inline is a defect.
3. **Tables → card/row groups.** Any `<table>`/dense grid becomes `ds-row`
   stacks or `ds-grid-breathing`.
4. **Every interactive target ≥ `--touch-min`; primary actions in thumb zone.**
5. **Dark/light parity is acceptance criteria**, not optional.
6. v4.1 is a re-tune, not a rename — token names are stable, so Roles 3–7
   pages mostly inherit Iris automatically; they must not edit Role 0/1 files
   (central + shell) — those are frozen once the orchestrator finishes them.

## Follow-ups

- **Mobile audit (ongoing, another role):** verify the `@media (max-width:400px)`
  tightening (page padding / section gap / titles / icon tiles) and the
  `@media (min-width:768px)` centered 540px canvas across all pages.
- Spot-check pages that hard-coded a flat blue/purple before v4.0 — they should
  now read the re-tuned tokens; any remaining ad-hoc hex is a defect to fix.

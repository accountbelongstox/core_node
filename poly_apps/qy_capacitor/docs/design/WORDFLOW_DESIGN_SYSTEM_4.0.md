# WordFlow AI — Design System 4.1 (Iris Layer) + UI/UX Interaction Design

> **单一事实来源 / Single source of truth.** This document now owns **both**
> layers of the WordFlow AI (`poly_apps/qy_capacitor`) front-end design:
>
> - **Part A — Visual Design System (视觉设计系统)** — the Iris token system,
>   base classes, shared React primitives, StyleCenter mirrors, and visual
>   acceptance criteria (§0–§6). Additive on the v3.x Ultra-Glassmorphism /
>   Aurora system — not a replacement.
> - **Part B — UI/UX Interaction Design (交互设计)** — information architecture,
>   navigation, app-shell behaviour, user flows, interaction states, overlay /
>   stacking model, and motion (§7–§12). Each topic documents the **current UI
>   (现在的UI)** as it actually behaves in code today, and the **expected UI
>   (预期的UI)** — the intended target. (§7–§12 absorb the interaction material
>   that previously lived scattered in `architecture/ARCHITECTURE.md` §8 and in
>   the archived `REDESIGN_HISTORY_MERGED.md` UX proposal; those sources now
>   point here.)
>
> Routing / IA / interaction is **no longer out of scope** for this doc (see the
> rewritten §13). The work-breakdown checklist is
> [COMPONENT_REDESIGN_INVENTORY.md](./COMPONENT_REDESIGN_INVENTORY.md); the
> rolling redesign status is [REDESIGN_PROGRESS.md](./REDESIGN_PROGRESS.md).

| Need | Read |
|---|---|
| Colors, tokens, glass, radius, primitives | **Part A** (§0–§6) |
| What links to what, navigation, flows, states, overlays, motion | **Part B** (§7–§12) |
| What the app does **today** vs. what it **should** do | The **现在的UI / 预期的UI** blocks in each Part B section |

---
---

# PART A — VISUAL DESIGN SYSTEM / 视觉设计系统

> **Additive layer, not a replacement — v4.0 → v4.1 re-tune.** v4.1 still sits
> on top of the existing v3.x Ultra-Glassmorphism / Aurora system (`index.css`,
> `StyleCenter.ts`). Everything in v3.x (glass, aurora bg, material presets,
> motion curves, pill bottom bar, bento/fluid CTAs) remains valid. v4.1 keeps
> the **same v4.0 token NAMES** (stable API for 100+ pages — pages do not need
> per-page accent edits) but **re-tunes the values**, **adds a gradient hero
> layer**, and **re-shapes the bottom bar into a centered floating island** to
> faithfully match the reference design. The accent moves from flat
> International Klein Blue `#002FA7` to the **Iris** palette: soft
> lavender/periwinkle light, deep near-black indigo dark with violet glow,
> periwinkle→violet gradient for hero surfaces, solid periwinkle-indigo for
> text/icons/active.

## 0. Canonical reference images + mandatory parity gate (强制)

The visual source of truth for the **entire app** is two images, committed in
the repo:

| File | Role |
|---|---|
| `poly_apps/qy_capacitor/public/design-reference-light.webp` | **Light** theme reference (colors, components, spacing, nav, cards) |
| `poly_apps/qy_capacitor/public/design-reference-dark.webp` | **Dark** theme reference |

> These were renamed from the originals (`ld.webp` /
> `a41971bc8cb0adfb0ad93766a384624d.webp`) and are now the permanent names.
> Develop every screen and widget to look like these from now on.

**Parity gate (non-negotiable, applies to all roles/agents):** before changing
or creating *any* component or page that has visible design, you MUST first
open both reference images (`Read` the two files) and verify your output
matches them — palette, gradient-vs-solid usage, radius, glass, spacing,
floating-island nav, pill menus, section titles, icon tiles, dark/light
parity. A change that was not checked against the references is a defect.

**Marker-comment convention:** every file you redesign gets, at the top of the
component/page module, the comment:

```
/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp.
   Verified reference parity. Some sibling/imported code may still be
   un-beautified — propagate the Iris layer there too. */
```

Rolling status of the whole-app pass:
[REDESIGN_PROGRESS.md](./REDESIGN_PROGRESS.md).

---

## 1. Why a layer (design philosophy)

The reference design asks for: a soft lavender/periwinkle light theme, a deep
near-black indigo dark theme with a violet ambient glow, a **periwinkle→violet
gradient** as the hero accent (CTA / active pill / island center / FAB) with a
**solid periwinkle-indigo** for text, icons, active text and borders, generous
negative space, unified large radius, glassmorphism, a **centered floating
island bottom nav with an elevated gradient central action**, **pill-shaped
horizontal category menus**, a **minimal asymmetric functional top bar** (with
a trailing gradient filter orb on the search pill), bold real section titles
with a quiet "See all", circular colored icon tiles, and thumb-zone
optimization.

The v4.0 layer already delivered the structural pieces (Klein token set, pill
nav, floating bar, media frame). v4.1 does **not** rebuild and does **not**
rename a single token — that stability is the whole point: 100+ already-styled
pages keep working with zero per-page edits. v4.1 only **re-tunes the token
values**, **adds the gradient layer + new base classes/primitives**, and
**re-shapes the bottom bar into a centered island**.

> The *interaction* consequences of these visual choices — thumb-zone reach,
> floating-island behaviour, pill-menu gestures, overlay stacking — are
> specified in **Part B** (§7–§12), not here. Part A defines *what it looks
> like*; Part B defines *how it behaves*.

## 2. Token re-tune + additions (`index.css` `:root` + `html.dark`)

### 2.1 Iris solid accent (text / icon / active / border / soft tint)

Same names as v4.0 (`--klein-*`), re-tuned to the reference periwinkle-indigo.
AA on white in light; brightened in dark.

```css
:root{
  /* Solid accent: vivid periwinkle-indigo (text/icon/active, AA on white) */
  --klein-blue:        #3B49E0;
  --klein-blue-strong: #2C38C2;             /* pressed / deep */
  --klein-blue-soft:   rgba(59,73,224,0.10);/* tinted container (light) */
  --klein-on:          #ffffff;             /* text/icon on accent */
  --klein-ring:        rgba(110,124,245,0.50);
  --klein-glow:        0 14px 34px rgba(99,110,240,0.30), 0 4px 14px rgba(150,124,232,0.20);
}
html.dark{
  --klein-blue:        #6E84FF;             /* brightened for dark */
  --klein-blue-strong: #5468E6;
  --klein-blue-soft:   rgba(110,132,255,0.16);
  --klein-ring:        rgba(124,138,255,0.55);
  --klein-glow:        0 14px 38px rgba(110,132,255,0.42), 0 4px 16px rgba(120,100,240,0.30);
}
```

### 2.2 Iris gradient accent (hero surfaces) — NEW

The reference uses a periwinkle→violet gradient for hero surfaces (primary CTA,
active pill, floating-island center, FAB, bento corner-chip). New tokens, both
themes:

```css
:root{
  --klein-grad-from: #6E7CF5;
  --klein-grad-to:   #A47FE8;
  --klein-gradient:  linear-gradient(135deg, var(--klein-grad-from) 0%, var(--klein-grad-to) 100%);
  --klein-grad-soft: rgba(123,124,240,0.12);
  --klein-grad-glow: 0 16px 36px rgba(110,124,245,0.34), 0 6px 16px rgba(164,127,232,0.24);
}
html.dark{
  --klein-grad-from: #6E84FF;
  --klein-grad-to:   #9A6CF2;
  --klein-grad-soft: rgba(110,132,255,0.18);
  --klein-grad-glow: 0 18px 40px rgba(110,132,255,0.44), 0 6px 18px rgba(154,108,242,0.32);
}
```

**Token usage rule:** solid `--klein-*` for text / icons / active state /
borders / soft tints; gradient `--klein-grad-*` / `--klein-gradient` for hero
surfaces only (CTA, active pill, island center, FAB, bento chip). Do not paint
body text in the gradient; do not use a flat blue for hero surfaces.

### 2.3 Floating-island center is now gradient

`--bar-cta-bg: var(--klein-gradient)` in **both** themes (was light near-black
`#101012` / dark `--klein-blue` in v4.0). The bottom-bar center action is now a
gradient orb. `--bar-active-bg: var(--klein-gradient)` too (active side-tab icon
wrap fill is the gradient). *Behaviour & placement → §7/§8/§12.*

### 2.4 Backgrounds re-tuned to the reference

| Surface | Light | Dark |
|---|---|---|
| `body` bg | `#ECEDFB` | `#07070f` |
| `.ds-aura-bg` | `linear-gradient(165deg,#ECEDFB 0%,#E5E7FB 46%,#EFE9FC 100%)` (soft lavender wash) | `#07070f` + indigo/violet radial glows (`rgba(110,132,255,…)`, `rgba(154,108,242,…)`, `rgba(110,124,245,…)`) |
| `.ds-aura-overlay` | soft lavender blobs (`rgba(214,218,252,…)` family), `blur(72px)` | indigo/violet radials, `blur(60px)`, animated `ds-mesh-flow` |

### 2.5 Crisper cards, neutral shadows

- `--glass-opacity` light raised **0.42 → 0.58** (crisper near-white cards;
  dark stays 0.32). Mirror in `StyleCenter.ts` `tokens.glass.opacity = 0.58`.
- Card / row shadows changed from blue-tinted to **neutral violet-grey**
  (`rgba(76,70,140,…)` + `rgba(30,27,60,…)`), e.g. `.ds-card`
  `0 14px 40px rgba(76,70,140,0.10) …`.

### 2.6 Negative space (unchanged names, mobile re-tune)

```css
:root{
  --space-breath: 2.5rem;
  --section-gap:  var(--space-2xl);
  --page-padding-v: 3.25rem;
}
```

## 3. Base classes (`index.css`) — both themes

### 3.1 Klein solid button — `ds-btn-klein`
Solid `--klein-blue` fill, `--klein-on` text, `--klein-glow`,
`--radius-button`, top inset highlight, `:active` scale 0.98, `:hover` →
`--klein-blue-strong`. Exposed via `Button variant="klein"`.

### 3.2 Gradient hero button — `ds-btn-grad` — NEW
`--klein-gradient` fill, `--klein-on`, `--klein-grad-glow` + inner top
highlight, `--radius-button`, `:hover` `brightness(1.06)` + `--klein-grad-soft`
halo ring, `:active` scale 0.98. The reference hero CTA. Exposed via
`Button variant="grad"`.

### 3.3 Pill horizontal category menu — `ds-pill-nav` / `ds-pill-chip`
- `ds-pill-nav`: `display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x;`
  no scrollbar, horizontal swipe, edge `--page-padding-h` bleed.
- `ds-pill-chip` (re-tuned in v4.1, **bigger + gradient active**):
  stadium (`--radius-full`), **`min-height:40px`**, padding **`9px 20px`**,
  font **`0.875rem`** weight 600; **inactive** = frosted
  (`rgba(255,255,255,var(--material-thin-opacity))` + `blur` +
  `--border-highlight`) + `--color-text-secondary`; **`.is-active`** =
  `var(--klein-gradient)` fill + transparent border + `--klein-on` +
  `--klein-grad-glow`. `:hover` border → `--klein-ring`. Canonical "All /
  category" pattern — use for every category/filter/segment row; never a
  `<select>` or table header for that. *Gesture → §12.*

### 3.4 Centered floating island bottom bar — `ds-bar-pill` / `ds-bar-cta`
v4.1 re-shapes the bar into a **centered floating island** (was edge-to-edge in
v4.0):
- `.ds-bar-pill`: `position:fixed; left:50%; transform:translateX(-50%);`
  `width:min(calc(100vw - 2*var(--bar-gap)), 430px);` lifted
  (`bottom: calc(env(safe-area-inset-bottom,12px) + 14px)`), stronger float
  shadow, saturated blur (`backdrop-filter: blur(var(--glass-blur-lg))
  saturate(160%)`), `--radius-full`.
- `.ds-bar-pill-inner`: height **62px**, `padding 0 10px`.
- `.ds-bar-cta`: **62px** gradient orb (`background: var(--bar-cta-bg)` =
  `--klein-gradient`), **4px** `--bar-bg`-colored ring, `translateY(-18px)`
  (breaks the silhouette), `--shadow-float` + `--klein-grad-glow`; `:hover`
  lifts to `-20px` + `--klein-grad-soft` halo; `:active` scale 0.93.
- Active side-tab icon wrap (`.ds-bar-tab.is-active .ds-bar-tab-icon-wrap`)
  fill = `var(--bar-active-bg)` = the gradient, with `--klein-grad-glow`.
- Side tabs stay quiet (`ds-bar-tab`) for the deliberate visual imbalance;
  center action is the largest thumb-zone hit target.

*Navigation semantics (which tabs, when shown/hidden) → §7 & §8.*

### 3.5 Transparent-media frame — `ds-media-frame`
Magazine-style imagery: faint tinted surface (`--color-primary-container`),
`--radius-card`, `object-fit:contain`, centered, inner top highlight. For PNGs
with transparent background on cards.

### 3.6 Reference-faithful additions — NEW base classes

| Class | Role |
|---|---|
| `ds-section-title` | Bold real section heading (`1.0625rem`, weight 800, tight tracking) — reference uses real titles, not tiny uppercase |
| `ds-section-sub` | Optional sub-line under the title (`0.8125rem`, weight 500, secondary) |
| `ds-link-more` | Quiet "See all" link; `:hover` → `--klein-blue` text + `--klein-blue-soft` bg |
| `ds-icon-tile` | Circular colored icon tile (60px, frosted; 54px under 400px) for games / quick actions |
| `ds-fab-grad` | Gradient circular FAB (`--klein-gradient`, `--klein-grad-glow`) — search filter / accent action |
| `ds-btn-grad` | Gradient hero CTA (see §3.2) |
| `ds-bento` | Bento card (glass surface, neutral violet-grey shadow, spring hover) |
| `ds-bento-chip` | Bento corner icon-chip (40px, `14px` radius, `--klein-gradient` fill, `--klein-grad-glow`) — AI Chat / AI Image reference style |

### 3.7 Mobile / adaptive re-tune

- `@media (max-width:400px)`: `--page-padding-h: 1.125rem`,
  `--section-gap: var(--space-xl)`, `--space-breath: 1.75rem`,
  `ds-section-title` → `1rem`, `ds-icon-tile` → 54px.
- `@media (min-width:768px)`: `.ds-page { max-width:540px; margin:auto; }` —
  keeps the phone-app feel centered on tablet/desktop.

### 3.8 Shared React primitives — `components/UI.tsx` (maximize reuse)

The frozen shared layer. **Consume these everywhere; never re-implement their
markup inline — re-implementing a primitive inline is a defect.**

| Primitive | Replaces | Notes |
|---|---|---|
| `Button variant="primary"` | ad-hoc `bg-blue-600` | = the Klein **solid** token surface (no `bg-blue-600`) |
| `Button variant="klein"` | ad-hoc primary | solid Klein anchor (`ds-btn-klein`) |
| `Button variant="grad"` | ad-hoc gradient/purple CTA | **NEW** gradient hero CTA (`ds-btn-grad`) |
| `<SectionTitle title subtitle onSeeAll>` | ad-hoc `font-bold` headers + "more" link | **NEW** bold title + optional `ds-section-sub` + "See all" via `ds-link-more` |
| `<IconTile>` | ad-hoc round colored tiles | **NEW** consumes `ds-icon-tile` |
| `<FabGrad>` | ad-hoc round gradient buttons | **NEW** consumes `ds-fab-grad` |
| `<BentoTile>` | ad-hoc bento cards w/ corner icon | **NEW** consumes `ds-bento` + `ds-bento-chip` |
| `<Spinner size>` / `<LoadingState label>` | every `animate-spin` variant | unified Klein, sizes sm/md/lg |
| `<EmptyState …>` | every "暂无/No data" block | consumes `.ds-empty` |
| `<IconButton …>` | `p-2 rounded-full hover:bg-…` | ≥ `--touch-min` via `ds-touch-target` |
| `<BackButton onClick>` | the back-button copy | = `IconButton` + `Icons.Back` |
| `<PageHeader title onBack right>` | sticky glass top bar copy | `--color-surface`/`--border-highlight` |
| `<Badge tone>` | inline `rounded-full px-… text-xs` tags | tone: neutral/klein/success/danger |
| `<ProgressBar value max>` | inline `h-1.5 rounded-full` | unified Klein fill, clamped 0–100 |
| `<Sheet open onClose position>` | inline `fixed inset-0 z-50` modals | wraps `.ds-modal-backdrop`/`.ds-modal-panel`, now `ds-z-modal` |
| `<Popover open onClose anchorRef align>` | ad-hoc `absolute … z-50` dropdowns | **NEW** portals to `<body>`, fixed from anchor rect, flips, outside/Esc close, `--z-popover` |
| `<Portal>` | hand-rolled `createPortal` | **NEW** escapes all stacking/overflow ancestors |
| `<Stat value label accent>` | repeated `text-2xl font-bold`+label | unstyled, composes in cards |
| `<SectionLabel action>` | ad-hoc `uppercase tracking-*` | consumes `.ds-section-label` |
| `Icons.Bell`, `Icons.Filter` | ad-hoc inline SVGs | **NEW** added to the shared icon set |

### 3.9 Stacking / z-index scale (tokens) — 强制

The accent-glass system uses `backdrop-filter` + `transform` on `.ds-card` /
`.ds-glass`; each creates a **new stacking context**, and scroll containers
add `overflow` clipping — so the z-scale is centralized. **Single z-index
scale** (tokens in `index.css`, never hard-code a z value):

`--z-base 0 · --z-raised 10 · --z-sticky 30 · --z-chrome 40 (fixed top bar +
bottom island) · --z-popover 60 · --z-modal 80 · --z-toast 95`. Utilities:
`.ds-z-sticky/-chrome/-popover/-modal/-toast`.

> **The interaction discipline** (when to use `<Popover>`/`<Portal>` vs
> `<Sheet>`, why hand-rolled `absolute … z-50` dropdowns are a defect, flip /
> outside-click / Esc behaviour) is specified in **§11 — Overlays & Stacking**.

### 3.10 Iconography — no emoji as UI icons (强制)

Emoji must **never** be used as an interface icon/affordance (buttons,
stats, nav, achievements, list bullets, tiles, badges, empty-states, status
dots). They are inconsistent across platforms, unstyleable, and off-brand.
Emoji are allowed **only** inside genuine user-authored/content text.

- **Icon sources, in order:** (1) the shared `components/UI.tsx` `Icons.*`
  set for core glyphs (Home, Book, Settings, ChevronRight, Search, Bell,
  Filter, …); (2) **`lucide-react`** for everything else — it is the single
  approved icon library (in `index.html` importmap `lucide-react@^0.555.0`
  and `package.json`, ~1,500 tree-shakeable icons; already used across
  components). No other icon library, no inline ad-hoc SVG when a lucide /
  `Icons.*` equivalent exists.
- Size via `className="w-* h-*"`, color via `currentColor` / `--klein-*`
  tokens (never hard-coded hex). Decorative icons get `aria-hidden`; icon-only
  buttons keep an `aria-label`.
- Reference implementation: `pages/Profile/Profile.tsx`.

> **Layout norm** (content pages = centred phone column `max-w-md mx-auto` /
> `.ds-page`, never `max-w-2xl/4xl/5xl` escalation) and thumb-zone reach are
> interaction concerns — specified in **§12 — Gestures, Transitions & Motion**.

## 4. Reference design → implementation mapping

| Reference requirement | v4.1 mechanism |
|---|---|
| 软薰衣草/长春花亮色背景 | `body #ECEDFB`, `.ds-aura-bg` lavender gradient, lavender overlay blobs |
| 近黑靛蓝暗色 + 紫色辉光 | `body #07070f`, `.ds-aura-bg` `#07070f` + indigo/violet radial glows |
| 长春花→紫罗兰渐变主色 (hero) | `--klein-grad-*` / `--klein-gradient`; `ds-btn-grad`, `ds-fab-grad`, `ds-bento-chip`, active pill, island center |
| 实色长春花-靛蓝 (文字/图标/激活) | re-tuned `--klein-*`; `ds-btn-klein`, active text, focus rings, `ds-link-more:hover` |
| 大面积留白/负空间 | `--space-breath`, `--section-gap`, `ds-page` padding, mobile re-tune |
| 高度一致大圆角 | `--radius-card/-button/-full`; menus + island stadium |
| 玻璃拟态 (更清透) | `ds-glass`/`ds-material-*`, light `--glass-opacity` 0.58, neutral violet-grey shadows |
| 居中悬浮岛底栏 + 渐变中心动作 | `ds-bar-pill` centered island + `ds-bar-cta` gradient orb |
| 胶囊水平分类菜单 | `ds-pill-nav` + bigger `ds-pill-chip` (gradient `.is-active`) |
| 极简功能化顶栏 (不对称) + 搜索滤镜球 | `TopBar` v4: avatar-left, icon-only right, search pill + trailing `ds-fab-grad` filter orb |
| 加粗真实标题 + "查看全部" | `ds-section-title` / `ds-section-sub` / `ds-link-more` via `<SectionTitle>` |
| 圆形彩色图标块 | `ds-icon-tile` via `<IconTile>` |
| Bento (AI Chat/Image) 角标 | `ds-bento` + `ds-bento-chip` via `<BentoTile>` |
| 拇指热区优化 | primary actions bottom-center; targets ≥ `--touch-min` (§12) |
| 去底色商品呈现 (PNG) | `ds-media-frame` |
| Dark/Light | every token has `html.dark` override; **parity = acceptance** |

## 5. StyleCenter.ts re-tune (token mirrors)

- `tokens.glass.opacity = 0.58`.
- `tokens.klein` keeps `base/strong/soft/on/ring/glow` **and adds**
  `gradient/gradientFrom/gradientTo/gradientSoft/gradientGlow`.
- `colors.klein` literals updated to the `#3B49E0` family
  (`klein #3B49E0`, `kleinStrong #2C38C2`, `kleinSoft rgba(59,73,224,0.10)`,
  `kleinOn #ffffff`) **plus** `kleinGradientFrom #6E7CF5` /
  `kleinGradientTo #A47FE8` (light-mode reference literals; CSS contexts must
  use the theme-aware `--klein-*` / `--klein-grad-*` vars).
- `components.button.primary` no longer `bg-blue-600` — it is the Klein solid
  token surface. **Added** `components.button.grad` (`ds-btn-grad`).
- **Added** `components.{sectionTitle, sectionSub, linkMore, iconTile, fabGrad,
  bento, bentoChip}`. `components.pillNav`/`pillChip`/`barCta`/`mediaFrame`
  retained. Components consume these — no inline hex.

## 6. Acceptance criteria (visual, per component)

1. No `bg-blue-600` / ad-hoc purple for *primary* accent — uses `--klein-*`
   (solid) or `--klein-grad-*`/`--klein-gradient` (hero surfaces).
2. Solid vs gradient token discipline: text/icon/active/border = solid
   `--klein-*`; hero surfaces (CTA, active pill, island center, FAB, bento
   chip) = gradient.
3. Any category/filter/segment row is `ds-pill-nav` / `ds-pill-chip` (or
   `<PillNav>`) — gradient `.is-active`.
4. Bottom-bar pages use the centered island + `ds-bar-cta` gradient center
   action where a primary verb exists.
5. Tables / dense grids replaced by `ds-row` / `ds-card` / `ds-grid-breathing`.
6. Top bar minimal & asymmetric (avatar-left, icon-only right); search pill
   carries the trailing `ds-fab-grad` filter orb.
7. Section headers use `<SectionTitle>`; round colored tiles use `<IconTile>`;
   bento cards use `<BentoTile>` — the new `components/UI.tsx` primitives are
   consumed, never re-implemented inline (a defect).
8. Verified in **both** `html.dark` and light; **dark/light parity is
   acceptance**; contrast AA on solid Klein surfaces.
9. Targets ≥ 44px; key actions reachable in thumb zone (§12).

> Interaction acceptance (navigation reach, flow continuity, state coverage,
> overlay stacking, motion) is specified per-section in Part B.

---
---

# PART B — UI/UX INTERACTION DESIGN / 交互设计

> **How to read this part / 阅读方式.** Each section first states the **现在的UI
> (Current UI)** — how the shipped code actually behaves today (verified against
> `index.tsx`, `router/RouteCenter.tsx`, `components/*`) — then the **预期的UI
> (Expected UI)** — the intended target the app should converge on. Where they
> already match, that is called out. Implementing the *expected* deltas is
> tracked in [REDESIGN_PROGRESS.md](./REDESIGN_PROGRESS.md); this doc is the
> spec, not the change log.

## 7. Information Architecture & Navigation / 信息架构与导航

### 7.1 现在的UI (Current UI)

**Primary navigation = a 5-tab centered floating island** (`components/
BottomTabNav.tsx`), shown on every non-immersive route:

| # | Tab | Route (`navigate`) | Highlight match (`matchRoutes`) |
|---|-----|--------------------|---------------------------------|
| 1 | Home (`nav.home`) | `/` | `/`, `/home`, `/dashboard` |
| 2 | Library (`nav.library`) | `/learn/library` | `/learn/library`, `/library` |
| 3 | **Practice** (center action) | `/learn/practice` | `/learn/practice`, `/reading`, `/flashcards` |
| 4 | Tools (`nav.tools`) | `/tools` | `/tools`, `/dictionary`, `/translation` |
| 5 | Mine (`nav.mine`) | `/mine` | `/mine`, `/profile`, `/settings`, `/social` |

- The **center tab (index 2 = Practice)** renders as the elevated gradient
  `ds-bar-cta` orb (§3.4); the other four are quiet `ds-bar-tab`s. A tab is
  active when `location.pathname` starts with any of its `matchRoutes`.
- **Route registry** (`router/RouteCenter.tsx`, `ROUTE_REGISTRY`): ~60 routes,
  each tagged `category` + `isProtected?` + `isImmersive?`. `RouteCenter`
  exposes `getRoutesByCategory`, `getRouteByPath`, `isImmersiveRoute`,
  `isProtectedRoute`, `getRouteName`. Categories present today: `auth`,
  `dashboard`, `learn`, `mine`, `learning`, `user`, `settings`, `library`,
  `vocabulary`, `documents`, `search`, `social`, `stats`, `tools`.
- **Known current-state gaps (现状缺陷):**
  - **Legacy/new overlap.** Both the new module routes (`/learn/*`, `/mine/*`)
    and the older fragmented routes coexist: `/` `/home` `/dashboard` all map to
    the same Dashboard page; `Library` (tab) → `/learn/library` while
    `/courses`, `/group_management`, `/recommendations` live under the
    `library` category; practice has `/learn/practice` *and* `/reading_setup`,
    `/flashcard_setup`, `/quiz_run`, `/listening_player`, `/playlist`. This is
    the exact "信息架构混乱 / chaotic IA" the redesign set out to fix —
    partially done (shell), not yet pruned (routes/pages).
  - **No global auth guard.** `isProtected` is declared on routes but `index.tsx`
    does **not** redirect unauthenticated users; protection is page-level only.
  - **No tab-change transition.** `navigate` swaps the route with no shared
    enter/exit animation (see §12).

### 7.2 预期的UI (Expected UI)

A clean **3-tier architecture / 三层架构** — every feature reachable in **≤ 2
taps** from any tab:

```
WordFlow AI
├── Learn  (学习 — core)     ── tabs: Home · Library · Practice · Review
├── Tools  (工具 — assist)   ── Dictionary · AI Assistant · Analytics
└── Mine   (我的 — personal) ── Profile · Progress · Social · Settings
```

- **Learn module (核心):** `Home` (today's plan, recommendations, quick-start,
  progress) → `Library` (system/my/imported vocab, doc import, AI content) →
  `Practice` (reading / listening / flashcard / quiz) → `Review` (due today,
  calendar, smart review). The loop **Home → Library → Practice → Review** is a
  closed cycle; a single "Continue learning / 继续学习" CTA jumps to the last
  position.
- **Tools module (辅助):** a hub with 3 buckets — Dictionary (lookup/translate/
  pronounce), AI Assistant (translation, TTS, article processing, personal
  dictionary), Analytics (stats, mastery, trends). Tools are context-aware and
  results feed back into learning.
- **Mine module (个人):** Profile, Progress (daily stats, history, achievements,
  calendar), Social (friends, leaderboard, share), Settings (preferences,
  language/theme, notifications, data sync).
- **Navigation model:** bottom 5-tab island is the only primary nav (no parallel
  sidebar/header menus competing on mobile). Sub-pages open *within* a tab and
  return to it. Target reach metrics: dictionary 3→2 taps, AI tools →2 taps via
  hub, social = one page with tabs.
- **Convergence work (差距收敛):** retire duplicate routes (`/dashboard` vs
  `/home`, `Library/Courses` vs `Learn/Library`, scattered practice entries) in
  favour of the `learn/` + `mine/` namespaces; add a real protected-route guard;
  add tab transitions (§12). *(Implementation = follow-up, tracked separately.)*

### 7.3 Design principles (设计原则) — drive every IA/flow decision

1. **简单优先 / Simplicity first** — fewer pages, ≤2 taps to anything, smart
   defaults over option overload.
2. **学习优先 / Learning first** — learning is the core; everything serves a
   seamless, immersive study path.
3. **渐进披露 / Progressive disclosure** — simple surface for beginners, advanced
   features revealed gradually.
4. **即时反馈 / Instant feedback** — actions respond immediately; progress is
   always visible; achievements reward on the spot.
5. **数据驱动 / Data-driven** — recommended content, personalized paths, adaptive
   difficulty.

## 8. App Shell & Chrome / 应用外壳与导航栏行为

### 8.1 现在的UI (Current UI)

Composition (`index.tsx`): `BrowserRouter → AppProvider → AppRouter`. `AppRouter`
maps `ROUTE_REGISTRY` and decides chrome per route via `useAppLayout(route)`:

| Route class | TopBar + banner (`AppLayout`) | Bottom island | Notes |
|---|---|---|---|
| Normal route | ✅ wrapped in `<AppLayout>` | ✅ | default |
| **Auth** (`/login`, `/forgot-password`, `/reset-password`) | ❌ | ✅* | bare page; *bottom nav still mounts unless immersive |
| **Immersive** (`isImmersive`) | ❌ | ❌ | full-screen, zero chrome |
| **Custom-header** (`/vocabulary_library*`) | ❌ (page renders its own `Header`) | ✅ | back + page actions |

- **Immersive routes today:** `/reading_run`, `/flashcard_run`, `/quiz_run`,
  `/listening_player` — the active learning surfaces, deliberately chrome-free.
- **`AppLayout`** = fixed `TopBar` + a "NEW" announcement banner (from
  `MOCK_ANNOUNCEMENTS`) + `<Outlet>` inside `.ds-page`; main area scrolls,
  padded for the fixed top bar and safe-area insets.
- **`TopBar`** (`components/TopBar.tsx`): left = avatar (→ profile) with green
  online dot, or a back chevron when `showBack`; center = search pill (opens
  `SearchOverlay`) ending in a `ds-fab-grad` filter orb; right = `ThemeToggle`,
  `LanguageDropdown`, settings. On scroll past 20px the bar adopts glass
  (`ds-glass ds-glass-edge`); at top it is transparent — a quiet→solid scroll
  transition.
- **`DialogManager`** is mounted globally for the web confirm/alert fallback.
- `App.tsx` at the app root (`poly_apps/qy_capacitor/App.tsx`) is **dead legacy**
  (Chat/Image/Vision + Sidebar) and is **not** part of the shell — ignore it.

### 8.2 预期的UI (Expected UI)

- **One consistent header contract:** top-level tab pages use the search-pill
  `TopBar`; sub-pages use a back-titled header (`<PageHeader>` / the
  custom-header pattern). No page invents its own ad-hoc bar.
- **Immersive = the learning verb only.** Any focused study/run surface (read,
  listen, flashcard, quiz, and future "Practice" run) is immersive: minimized
  header (back · progress · overflow), full-bleed content, no bottom island —
  matching the reference Practice screen (§9.3, §10).
- **Protected routes actually gate.** Unauthenticated access to an `isProtected`
  route redirects to `/login` and returns after auth (close the §7.1 gap).
- **Announcement banner** is real data (not `MOCK_ANNOUNCEMENTS`) and dismissible.
- Header glass-on-scroll, safe-area insets, and centered ≤540px canvas on
  tablet/desktop (§3.7) are kept.

## 9. Core User Flows / 核心用户流程

For each flow: **现在的UI** = what the routes/pages do today; **预期的UI** = the
intended journey.

### 9.1 Auth / 认证

- **现在的UI:** `/login` ⇄ `/forgot-password` ⇄ `/reset-password`, all bare
  (no shell). Glass auth card, Klein/gradient CTA. Post-login lands on `/`.
  Because there is no global guard, much of the app is also reachable logged-out.
- **预期的UI:** guest can browse non-protected surfaces; the first protected
  action routes through `/login` and returns to intent. Inline validation +
  instant error/success feedback (§10). Minimal top chrome only.

### 9.2 Learn loop / 学习闭环 (Home → Library → Practice → Review)

- **现在的UI:** Home (`pages/Dashboard/Home.tsx`) shows greeting, hero
  Playlist/guest-sync cards, study-mode bento tiles, progress stats. Library tab
  → `pages/Learn/Library.tsx`. Practice center tab → `pages/Learn/Practice.tsx`.
  Review → `/learn/review`. The four pages exist, but legacy entry points
  (`/courses`, `/reading_setup`, …) still bypass the loop.
- **预期的UI:** a single closed cycle. Home's **"Continue learning"** CTA resumes
  the last session in one tap; Library → "Start learning" enters Practice
  seamlessly; finishing Practice offers Review of just-missed items; Review feeds
  the next Home plan. Every step ≤2 taps; no dead-ends back to fragmented pages.

### 9.3 Immersive practice / 沉浸式练习

- **现在的UI:** `/reading_run`, `/flashcard_run`, `/quiz_run`,
  `/listening_player` render chrome-free (§8.1). Setup pages (`/reading_setup`,
  `/flashcard_setup`) precede the run.
- **预期的UI (reference Practice screen):** minimized header `← 5/20 ━━━ 25% ⋮`
  (back · progress bar · overflow), centered word-card area with audio, and a
  bottom action row — self-assessment (认识 / 模糊 / 不认识) **or** multiple-choice
  (A/B/C/D) — with **instant** correct/incorrect feedback. Flashcard = tap/swipe
  to flip (front word ↔ back meaning). Full-screen, no bottom island.

### 9.4 Tools hub / 工具中心

- **现在的UI / 预期的UI (already aligned):**
  ```
  /tools (hub)
    ├─ /tools/dictionary           (search · history · favorites)
    ├─ /tools/ai-assistant         (AI tools hub)
    │     ├─ /tools/translation
    │     ├─ /tools/tts
    │     ├─ /tools/article-processor
    │     └─ /tools/personal-dictionary
    └─ /tools/analytics            (stats & charts)
  ```
  Any tool reachable in ≤2 taps from the hub.

### 9.5 Mine / Settings / 我的 · 设置

- **现在的UI / 预期的UI (already aligned):**
  ```
  /mine (personal center)
    ├─ /mine/progress  (learning stats, history, achievements)
    └─ /mine/social    (Friends · Leaderboard · Achievements tabs)
  Settings hub → Display · Language · Learning · Notifications · DataSync ·
                 ApiServer · SystemStatistics · About  (rows as ds-row, pill sub-nav)
  ```

## 10. Interaction States / 交互状态

### 10.1 现在的UI (Current UI)

The shared layer already provides the canonical state widgets (§3.8): `<Spinner>`
/ `<LoadingState>` (loading), `<EmptyState>` (no-data / "暂无"), `<ProgressBar>`
(determinate progress), `<Badge>` (status). `TopBar` shows a quiet→glass scroll
state; buttons use `:active` scale (0.93–0.98). Feature pages add ad-hoc states
(e.g. an audio-generating spinner, hover affordances on home icons) — functional
but not yet uniformly routed through the primitives.

### 10.2 预期的UI (Expected UI)

Every async surface covers the full state set, via the §3.8 primitives only
(re-implementing inline is a defect):

| State | Pattern |
|---|---|
| **Loading** | `<LoadingState>` / `<Spinner>` (Klein), skeleton where the shape is known |
| **Empty** | `<EmptyState>` — icon (lucide/`Icons.*`, never emoji §3.10) + message + primary action |
| **Error** | inline message + retry; network errors degrade gracefully (cached/default), never a blank crash |
| **Hover / focus** | Klein tint / `--klein-ring`; visible focus ring for a11y |
| **Active / pressed** | scale (`:active`), gradient on hero surfaces |
| **Disabled** | reduced opacity, no pointer events, `aria-disabled` |
| **Selected** | pill `.is-active` gradient (§3.3); active tab island (§3.4) |

**Instant feedback (即时反馈):** quiz/flashcard answers, save actions, and
toggles respond on the spot; long ops show progress, not a frozen UI.

## 11. Overlays & Stacking / 浮层与层级 (强制)

> Uses the centralized z-scale tokens from **§3.9** (`--z-* / .ds-z-*`).

### 11.1 现在的UI (Current UI)

Overlay primitives in `components/UI.tsx`: `<Portal>` (escapes stacking/overflow
ancestors), `<Popover>` (anchored, portals to `<body>`, fixed from the anchor
rect, flips up when low, closes on outside-click + Esc, `--z-popover`), `<Sheet>`
(modal, wraps `.ds-modal-backdrop`/`.ds-modal-panel`, `ds-z-modal`). Reference
implementations: `ApiEndpointSwitcher`, `LanguageDropdown`, `Header`. `PageHeader`
uses `ds-z-sticky`; `DialogManager` provides the global confirm/alert.

### 11.2 预期的UI + discipline (Expected UI / 规则)

- **Why it matters:** `backdrop-filter` + `transform` on `.ds-card`/`.ds-glass`
  each create a new stacking context, and scroll containers clip via `overflow`
  — so a hand-rolled `position:absolute … z-50` dropdown gets **trapped** under
  sibling cards / the fixed chrome ("not floating on top").
- **Any anchored floating panel** (dropdown, menu, select-replacement, popover,
  tooltip, overlay expander) **MUST** use `<Popover>` (or `<Portal>`) — never
  `absolute … z-50` inside a card/scroll area. Re-implementing a bare absolute
  dropdown is a defect.
- **Full-screen modals/overlays** use `<Sheet>` / `ds-z-modal` — always **above**
  popovers. In-scroll sticky headers use `ds-z-sticky` (below chrome). Toasts
  use `ds-z-toast`.
- **Layer order (强制):** sticky 30 < chrome 40 < popover 60 < modal 80 <
  toast 95. Never hard-code a z value — use the §3.9 tokens/utilities only.

## 12. Gestures, Transitions & Motion / 手势 · 转场 · 动效

### 12.1 现在的UI (Current UI)

- **Pill menus** (`ds-pill-nav`, §3.3) scroll horizontally with `scroll-snap`
  (swipe). **Bottom island** center action lifts on hover (`-18→-20px`) and
  scales on press (0.93); side tabs highlight via `matchRoutes`.
- **Press feedback** everywhere via `:active` scale (0.93–0.98).
- **TopBar** transitions transparent→glass on scroll (`scrollY>20`, 300–500ms).
- **Aurora background** has ambient `ds-mesh-flow` motion (v3.x).
- **No route/tab transition** — page swaps are instant (gap, §7.1).
- **Thumb-zone:** primary actions sit bottom-center (the island); targets ≥
  `--touch-min` (44px) via `ds-touch-target`.

### 12.2 预期的UI (Expected UI)

- **Page transitions:** lateral tab switches **slide** (Home ↔ Library ↔
  Practice); drilling into a sub-page = **fade + slide-down**; returning =
  **fade + slide-up**. Respect `prefers-reduced-motion`.
- **Flashcard flip:** tap/swipe flips the card (front word ↔ back meaning) with
  a spring.
- **Instant micro-feedback** on quiz answers (correct/incorrect color + subtle
  motion), toggles, and saves (§10).
- **Layout norm (布局规范, from §3.10):** content pages are a centred phone column
  — `max-w-md mx-auto` / `.ds-page`, never `max-w-2xl/4xl/5xl` escalation
  (that was the Profile layout defect). Matches the reference device frame and
  keeps everything in thumb reach.

---

## 13. Out of scope (kept from v3.x untouched)

Aurora mesh motion **internals**, the v3.x motion-curve definitions, bento/fluid
CTA mechanics, and the glass/material preset engine. v4.1 layers visual language
(Part A) and now documents interaction (Part B) on top of v3.x — it does **not**
rewrite v3.x.

> Note: routing / information architecture / interaction design are **no longer
> out of scope** for this document — they are specified in Part B (§7–§12). This
> supersedes the old v4.0 "§7 out of scope" boundary.

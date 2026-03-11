---
name: wordflow-design-system
description: Applies WordFlow AI design system (Ultra-Glassmorphism 30–50px, mesh/aura cyan–purple–blue, material presets Thin/Thick, spring/liquid motion, pill/bento/fluid buttons, floating pill bar, design tokens, centralized style). Use when beautifying poly_apps/wordflow-ai UI or enforcing Design Tokens and base-override hierarchy.
---

# WordFlow AI Design System

Use this skill when working on **poly_apps/wordflow-ai** UI (手机 APP): mobile-first adaptive layout, safe area, touch targets, design tokens, base > personalized for theme/components/styles.

## Canonical Files

- **Tokens & base styles:** `poly_apps/wordflow-ai/index.css`
- **JS tokens / components:** `poly_apps/wordflow-ai/styles/StyleCenter.ts`
- **Rule (file-scoped):** `.cursor/rules/wordflow-design.mdc` (applies when editing wordflow-ai TSX/CSS/HTML)

## Design Principles

### 1. Centralized Management (Design System)

- All styles follow **Design Tokens**. Colors, blur, radius, spacing, shadows, **layout** defined once in `index.css` (`:root` / `html.dark`) and optionally in `StyleCenter.ts`.
- **Mobile / Adaptive (手机 APP):** **No fixed width** for main content — use `ds-page` (full width + safe area). Tokens: `--touch-min` 44px (iOS 44pt / Android 48dp / WCAG), `--grid-unit` 8px, `--page-padding-h/v`, `--bar-gap`; layout uses `env(safe-area-inset-*)`. Optional `ds-page-contained` for max-width on large screens (e.g. tablet). **Touch targets:** interactive elements ≥ `--touch-min`; use class `ds-touch-target` or ensure buttons have `min-height: var(--touch-min)`.
- **Blur:** `--blur-sm` 4px, `--blur-md` 12px, `--blur-lg` 24px, `--blur-glass` 20px, **`--blur-ultra`** 40px. **Global glass:** `--glass-opacity`, `--glass-blur` (40px), `--border-highlight`. **Material presets:** `--material-thin-*`, `--material-thick-*`; classes `ds-material-thin`, `ds-material-thick`. **Motion:** `--ease-spring`, `--ease-liquid`, `--ease-smooth`. **`--primary-blur`** 20px.
- **Shadow:** `--shadow-sm/md/lg/float`; **`--shadow-deep`** (unified heavy soft shadow for buttons / bento).
- **Color tokens:** Backgrounds use `--color-primary-container`, `--color-surface-variant`, `--color-surface`; glass edges use `--color-glass-border`, `--color-inner-glow`. **Neon accents on dark:** `--bento-lime`, `--fluid-from/mid/to`.
- **Unified radius:** Cards and buttons use `--radius-card` / `--radius-button` (e.g. 24px).
- **Component logic:** All Cards and Buttons inherit from tokens; icons use **atomic icon system** (e.g. dot-matrix on unified grid, consistent stroke/density).
- **Responsive transparency:** By z-index / layer depth, use higher `backdrop-filter` for higher layers (e.g. `ds-glass-lg` for modals, `ds-glass-md` for cards).

### 2. Style Hierarchy: Base > Personalized (基类 > 个性化)

- **Theme, components, and styles** all follow: apply **base** design-system classes first, then **personalized** overrides. Do not bypass base classes with one-off inline styles or ad-hoc theme values.

### 3. Visual Language

| Effect | Description | Implementation |
|--------|-------------|----------------|
| **Glassmorphism (Ultra-Glassmorphism)** | 30–50px backdrop blur, jelly-like translucency; 1px edge lighting. | `ds-glass` uses `--glass-opacity`, `--glass-blur`, `--border-highlight`. **Material presets:** `ds-material-thin` (low blur, high transparency), `ds-material-thick` (high blur, low transparency). |
| **Mesh / Aura (弥散 · 青紫蓝流体)** | Cyan, purple, blue fluid gradients; deep spatial depth. | `ds-aura-bg` + `ds-aura-overlay`; `ds-mesh-flow` / `ds-blob-soft` animation. |
| **Edge lighting & ambient shadows** | 1px semi-transparent stroke; colored (not black) shadow for float. | Cards/rows use `--border-highlight`; box-shadow with primary-tint (e.g. rgba(59, 130, 246, 0.08)). |
| **Motion (Spring / Liquid)** | All motion uses nonlinear spring; no linear easing. | `--ease-spring`, `--ease-liquid`, `--ease-smooth`; transitions on transform, box-shadow. |
| **Z-axis depth** | Layered blur by depth. | `ds-glass-lg` (background) vs `ds-glass-sm` (foreground). |

### 4. Base Classes (index.css)

- **Background:** `ds-aura-bg`, `ds-aura-overlay`
- **Surfaces:** `ds-glass`, **`ds-material-thin`**, **`ds-material-thick`**, `ds-glass-sm`, `ds-glass-md`, `ds-glass-lg`, `ds-glass-edge`
- **Cards:** `ds-card`, `ds-card-flat`, `ds-card-elevated`
- **Rows / lists:** `ds-row`
- **Layout:** **`ds-page`** (adaptive full width + safe area), **`ds-page-contained`**, **`ds-stack`**, **`ds-stack-tight`**, **`ds-grid-breathing`**, **`ds-touch-target`**
- **Top bar (全局顶栏):** **AppLayout** wraps non-auth, non-immersive routes and provides **TopBar** (search capsule, **ThemeToggle**, **LanguageDropdown**, settings, avatar). **AuthLayout** provides **TopBar variant="minimal"** (theme + language only). **SearchOverlay** is used by AppLayout for full-screen search. Centralized components: **ThemeToggle**, **LanguageDropdown**, **TopBar**, **SearchOverlay**, **AppLayout**; all use ds-* base classes. Pages that need custom title/back can use **useTopBarOverrides** or keep **Header** (e.g. vocabulary_library).
- **Empty state:** `ds-empty`
- **Buttons:** `ds-btn`, **`ds-btn-pill`** (full stadium CTA), **`ds-btn-bento`** (Neo-Brutalism modular), **`ds-btn-fluid`** (Vibrant Fluidity gradient + motion)
- **Labels:** `ds-section-label`
- **Modal:** `ds-modal-backdrop`, `ds-modal-panel`
- **Bottom bar:** `ds-bar-pill`, `ds-bar-pill-inner`, `ds-bar-tab`, `ds-bar-tab-icon-wrap`, `ds-bar-tab-label`

### 5a. Bento / Neo-Brutalism Button (模块化高对比)

- **Design language:** Neo-Brutalism + Bento Grid; asymmetric layout.
- **Structure:** Left accent block (fluorescent lime `--bento-lime`), right dark interaction area (`--bento-deep`). Border `--bento-border`; shadow `--shadow-deep` (heavy soft drop shadow for strong float).
- **Icon:** Dot-matrix style arrow (`IconsDotMatrix.ArrowRight`) in accent block — retro tech, consistent grid.
- **Use:** `Button variant="bento"`. Compact: add class `ds-btn-bento-compact` for section links (View more, View All, Add).

### 5b. Fluid / Vibrant Fluidity Button (流体渐变 + 动效)

- **Design language:** Vibrant Fluidity; geometric play with transparency stacking; motion blur feel.
- **Visual:** Blue–purple–green gradient (`--fluid-from`, `--fluid-mid`, `--fluid-to`); glow `--fluid-glow`; subtle background-position animation; hover shine (pseudo-element sweep).
- **Use:** `Button variant="fluid" showPlay` for “Play”, “Start”, “Create” CTAs.

### 5c. Bottom Bar Pill (胶囊形悬浮条 · 毛玻璃 2.0)

- **Visual identity:** Classic **pill shape** floating bar; does not touch screen edges (breathing room). **Glass 2.0:** Icons are not flat — each has a **local frosted layer** (`ds-bar-tab-icon-wrap`): semi-transparent overlay so the icon feels “seen through frosted glass” (虚实结合).
- **Multi-mode:** **Light:** High-transparency milky base `--bar-bg`, fine white edge stroke `--bar-stroke`, soft wide shadow `--bar-shadow`. **Dark:** Dark semi-transparent base (e.g. `#1A1A1A` ~60%), glass refracts dark bg for deeper/metallic feel.
- **Material layers (三层):** All bar components = **Background (variable)** + **Backdrop-filter** + **Inner-border** (1px rgba white). Bar: `--bar-bg` + `blur(var(--glass-blur-lg))` + `--bar-inner-border`. Tab icon wrap: `--bar-tab-glass` + blur; active: `--bar-active-bg` (purple base).
- **Interaction:** **Spring scaling:** On tap, icon + purple base use spring-like scale (e.g. cubic-bezier(0.34, 1.56, 0.64, 1)). **Blur transition:** Selected tab’s glass layer animates from transparent to frosted (backdrop-filter increase). **Magnetic snap:** Purple active background switches between tabs with smooth liquid-style transition (`--ease-tab`). **Shimmer:** On click, a brief edge sweep (shimmer) on the icon to simulate light refraction on glass.
- **Tokens:** `--glass-blur-sm` 4px, `--glass-blur-md` 12px, `--glass-blur-lg` 20px; `--ease-tab` cubic-bezier(0.4, 0, 0.2, 1); `--bar-bg`, `--bar-stroke`, `--bar-shadow`, `--bar-inner-border`, `--bar-tab-glass`, `--bar-active-bg`.
- **Use:** `BottomTabNav` uses `ds-bar-pill`, `ds-bar-pill-inner`, `ds-bar-tab`, `ds-bar-tab-icon-wrap`, `ds-bar-tab-label`; active state `is-active`.

### 6. Pill/CTA Button (核心视觉 — Full Stadium, Glassmorphism CTA)

Use for primary actions (e.g. login, register). Design tokens in `index.css`:

- **Shape:** Full stadium / pill — `border-radius: var(--radius-full)` (9999px). Affordance: friendly, modern, easy to tap.
- **Color & gradient:** `--cta-gradient-from` (vibrant purple) to `--cta-gradient-to` (deep purple-blue).
- **Inner glow (内发光):** Bottom arc of light purple (`--cta-inner-glow-bottom`) via pseudo-element, suggesting light from below for volume.
- **Glass border (毛玻璃描边):** 0.5pt–1pt semi-transparent light stroke `--cta-border-stroke`; glassmorphism edge that blends with dark background.
- **Lighting (光影):**
  - **Colored drop shadow:** `--cta-shadow-colored` — shadow hue from button (purple/deep purple); button appears to float on a glow. No single black shadow.
  - **Inset shadows:** Light inset at top (`--cta-inset-top`), dark inset at bottom (`--cta-inset-bottom`) for 3D relief.
- **Sparkles / AI icon:** Optional Sparkles icon on the left (`Button showSparkles`) to suggest “magic” / AI capability.

**Texture & depth (质感增强):**

- **Backdrop blur:** Context (e.g. auth form panel) uses `ds-glass` — blur 12–20px (`--blur-glass` / `--blur-md`) for translucency.
- **Ultra-fine border:** 0.5–1pt semi-transparent bright stroke (`--cta-border-stroke`) to simulate glass refraction.

Apply: `Button variant="pill" showSparkles` on login/register submit; form container uses `ds-glass ds-glass-edge`.

### 7. When Applying the Design System

1. **Mobile-first:** Use `ds-page` for main content (adaptive width, safe area). Do not set fixed max-width on page container unless using `ds-page-contained` for tablet.
2. Ensure `index.css` is imported and page uses `ds-aura-bg` + `ds-aura-overlay`. Replace ad-hoc styles with `ds-*` classes; use tokens instead of magic numbers.
3. Add new tokens in `index.css` and optionally in `StyleCenter.ts`; do not introduce one-off values in components.
4. **Base > personalized:** For theme, components, and styles: apply base classes first, then page-specific or semantic overrides.
5. **Touch targets:** Buttons and tappable elements ≥ 44px (use `ds-touch-target` or `min-height: var(--touch-min)` on `.ds-btn`).
6. **Bottom bar:** `ds-bar-pill` uses `left`/`right` with `--bar-gap` and safe area for adaptive width; tab animations use `--ease-spring` / `--ease-liquid`.

## 集中化管理提示词 (Management Prompt)

To keep glass and bar effects consistent:

- **模糊步长 (Blur steps):** Use **`--glass-blur-sm`** 4px, **`--glass-blur-md`** 12px, **`--glass-blur-lg`** 20px for all backdrop-filter. No magic numbers.
- **材质分层 (Material layers):** Every glass component = **Background (variable)** + **Backdrop-filter** + **Inner-border** (1px rgba white). Bar: `var(--bar-bg)` + `blur(var(--glass-blur-lg))` + `var(--bar-inner-border)`.
- **Animation:** All tab/bar and card motion use **`--ease-spring`** / **`--ease-liquid`** (single cubic-bezier set). No linear easing.
- **Mobile/adaptive:** Layout 自适应不限制宽度；padding 使用 `--page-padding-h/v` + `env(safe-area-inset-*)`；可点击区域 ≥ `--touch-min` (44px)。主题/组件/样式：基类 > 个性化。

## 官方设计参考 (Official design references)

- **iOS Human Interface Guidelines:** typography ≥17pt body, touch targets ≥44×44pt, safe area.
- **Material Design 3:** 14pt minimum type, 48×48dp touch targets, breakpoints.
- **WCAG 2.2:** contrast 4.5:1 (text), touch target ≥44×44px.
- **Responsive/adaptive:** fluid grid (%), breakpoints (e.g. mobile ≤576px, tablet 577–768px), avoid fixed width for main content; use safe area for notched/foldable devices.

## 前沿设计要求 (Design Requirements for Replication)

When replicating or upgrading the pill/CTA style, request:

**A. 质感增强 (Texture & Depth)**  
- **Dynamic blur background:** Backdrop blur between background and button, typically 12–20px, for translucency.  
- **Ultra-fine border:** 0.5–1pt semi-transparent light stroke (border/stroke) to simulate glass refraction.

**B. 光影管理 (Lighting Strategy)**  
- **Layered shadow:** Do not use a single black shadow. Use **colored drop shadows** — shadow color from the button’s primary hue (e.g. deep purple) so the button looks like it floats on a glow.  
- **Dynamic inset shadow:** Slight light inset at top, dark inset at bottom for 3D relief.

## 视觉特效与结构管理 (Visual Effects & Style Governance)

**A. 视觉特效 (Blur & Light)**  
- **Motion / directional blur:** Add subtle motion blur or directional blur to interactive elements to suggest physical movement.  
- **Glassmorphism upgrade:** Beyond flat translucency, consider chromatic aberration (色散) on glass edges and weak inner glow (内发光) on container edges.  
- **Neon-saturated accents:** On dark backgrounds use high-saturation neon accents (e.g. fluorescent lime `--bento-lime`, electric purple/green in fluid gradient).

**B. 结构管理 (Style Governance)**  
- **Global variables:** `--primary-blur` for unified backdrop blur (e.g. 20px); `--shadow-deep` for unified button/card shadow spread and offset.  
- **Atomic icon system:** All icons (e.g. dot-matrix arrow, play shape) follow a unified grid; stroke weight or dot density consistent.  
- **Responsive transparency:** Backdrop-filter strength scales by element depth (z-index): higher layer → higher blur.

**C. 推荐美化 Prompt 示例**  
“Design an app interface with **Ultra-Glassmorphism** (30–50px backdrop blur, jelly-like translucency) and **Aurora mesh gradients** (cyan, purple, blue fluid). Use **edge lighting** (1px semi-transparent stroke) and **colored ambient shadows** (no flat black). **Material presets:** Thin (low blur, high transparency) and Thick (high blur, low transparency). **Motion:** Liquid morphing transitions, **spring-based physics** for all motion; single cubic-bezier set. **Centralized tokens:** `--glass-opacity`, `--glass-blur`, `--border-highlight`; all components inherit.”

**前沿 AI 术语 (Prompts for AI):**  
Visual: Hyper-realistic Glassmorphism, Iridescent translucent layers, Frosted acrylic texture, Subtle chromatic aberration at edges.  
Background: Aurora mesh gradients, Fluid organic background animation, Deep spatial depth.  
Interaction: Liquid morphing transitions, High-fidelity micro-interactions, Spring-based physics motion.

## Quick Reference

- **Tokens:** `poly_apps/wordflow-ai/index.css`; **Layout:** `--touch-min`, `--grid-unit`, `--page-padding-h/v`, `--bar-gap`; safe area via `env(safe-area-inset-*)`.
- **Rule:** `.cursor/rules/wordflow-design.mdc` (applies to wordflow-ai TSX/CSS/HTML).
- **Summary:** Mobile-first adaptive (no fixed width); base `ds-*` > personalized; theme/components/styles follow base extension; touch targets ≥44px; single source of truth for blur, radius, shadow, layout.

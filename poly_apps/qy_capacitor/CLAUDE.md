# CLAUDE.md — qy_capacitor (WordFlow AI)

Per-app conventions for Claude / AI agents working in `poly_apps/qy_capacitor`.
This is the canonical app doc. **Replace this whole file when conventions change — do not append incrementally.**

---

## 1. AI Special Attention Rules (inherited, non-negotiable)

1. Write all code in English only.
2. Never execute, create, or modify test code.
3. Never write summaries inside source files during development.
4. Declare all variables at the beginning of `*.ps1` files.
5. For PowerShell: never append strings directly to variables; never use relative paths
   like `..\..\` — resolve absolute paths via `Split-Path` / `Join-Path` / `Resolve-Path`.
6. Documentation policy for this app: docs are **full-file replacements**, not incremental
   edits. When a doc is outdated, rewrite the whole file.

---

## 2. App Identity

- `poly_apps/qy_capacitor` = **WordFlow AI** frontend.
- Stack: React + TSX + Vite + Capacitor; package manager **pnpm**.
- Dev log tag: `[wordflow-ai]`. Default dev port: `3000` (overridable via `.env` `PORT=`).
- Design system rule: `.cursor/rules/wordflow-design.mdc` (glob `poly_apps/qy_capacitor/**`).
  Design tokens canonical in `index.css` + `styles/StyleCenter.ts`.

---

## 3. Frontend + Backend Co-Development (强制 / mandatory)

The qy_capacitor frontend and its Laravel backend are **one feature, two repos**. When you
develop anything in `poly_apps/qy_capacitor`, you MUST also develop the corresponding
backend branch app in `poly_apps/laravel_main`:

| Concern            | Path |
|--------------------|------|
| Backend app code   | `poly_apps/laravel_main/app/Apps/AppQyV1/**` |
| Backend routes     | `poly_apps/laravel_main/routes/AppQyV1Router/**` |
| 功能/后端要求   | `poly_apps/laravel_dashboard/apps/wordflow/docs/FEATURES.md` + `BACKEND_REQUIREMENTS.md`(只描述功能与后端行为;接口/路由按需在实现时设计,不在文档固定) |
| Backend guide      | `development-guides/LARAVEL_GUIDE.md` |

Rules:

- A frontend change that adds or modifies an API call is **incomplete** until the matching
  `AppQyV1` route + controller exists (and the reverse).
- 接口/路由不在文档中固定:按 `FEATURES.md` / `BACKEND_REQUIREMENTS.md` 的功能要求,
  在实现时设计前后端接口(由 AI 实时发挥),保持前后端一致。
- Backend Laravel conventions (Windows vs Linux, `composer dev:win`, migrations,
  `php artisan sys:init`) live in `development-guides/LARAVEL_GUIDE.md` and the
  laravel `scripts/start.ps1` / `start.sh`.

---

## 4. Startup

Scripts live in `poly_apps/qy_capacitor/scripts/`:

| Script        | Role |
|---------------|------|
| `start.ps1`   | **Orchestrator.** Prints every launched script, then starts the laravel backend and the qy frontend simultaneously, each in its own PowerShell window. Accepts `-ForceInstall`. |
| `start_qy.ps1`| qy_capacitor only: idempotent `pnpm install`, verify vite toolchain, `pnpm run dev`, open browser. |
| `start.sh`    | Linux/Unix qy_capacitor launcher. |

Backend is launched by the orchestrator via `poly_apps/laravel_main/scripts/start.ps1`
(Windows) — that script runs `composer install` (when `vendor/autoload.php` is missing),
`php artisan route:clear`, `route:list`, `migrate`, `sys:init`, then `composer dev:win`.

Usage:

```powershell
.\poly_apps\qy_capacitor\scripts\start.ps1
.\poly_apps\qy_capacitor\scripts\start.ps1 -ForceInstall
```

---

## 5. Design Language — v4.1 Iris Layer (additive)

The UI uses the v3.x Ultra-Glassmorphism / Aurora system **plus** an additive
Iris layer. v4.1 is an **evolution of v4.0**: same v4.0 token NAMES (stable API
for 100+ pages — no per-page accent edits), but **re-tuned values** to the
reference Iris palette (light = soft lavender/periwinkle bg; dark = deep
near-black indigo with violet glow) **plus** a gradient hero layer and a
centered floating island. Does not replace v3.x. When building or restyling
any UI:

- **Canonical reference images (强制 parity gate).** The whole app must look
  like `public/design-reference-light.webp` (light) and
  `public/design-reference-dark.webp` (dark). Before changing or creating ANY
  component/page with visible design, first `Read` both images and verify your
  output matches them; an unverified design change is a defect. Add the
  `/* [v4.1-Iris] … */` marker comment (spec §0) to every file you redesign.
- Canonical spec: `poly_apps/laravel_dashboard/apps/wordflow/docs/DESIGN_SYSTEM.md`
  (迁移自 qy_capacitor/docs,已精简去重;**Part A §0–§6 = visual system** —
  §0 = reference images + parity gate; **Part B §7–§12 = UI/UX interaction
  design** — IA & navigation, app shell, user flows, interaction states,
  overlays/stacking, motion;只保留预期 UI 规范). 组件工作分解已并入该文件 §14。
  Rule summary: `.cursor/rules/wordflow-design.mdc` §11.
- **Solid vs gradient (mandatory).** Solid `--klein-*` (light `#3B49E0` / dark
  `#6E84FF`) for **text / icons / active / borders / soft tints** —
  `Button variant="klein"`/`primary` (`ds-btn-klein`). Gradient
  `--klein-grad-*` / `--klein-gradient` (periwinkle→violet) for **hero
  surfaces only**: primary CTA (`Button variant="grad"` / `ds-btn-grad`),
  active pill, floating-island center, FAB, bento corner-chip. No ad-hoc
  `bg-blue-600`/purple; never a flat blue on a hero surface.
- Category/filter/segment rows = `<PillNav>` (`components/PillNav.tsx`) /
  `ds-pill-nav` + `ds-pill-chip` (gradient `.is-active`). Never a
  `<select>`/table header for that.
- Bottom nav = centered floating island; center tab = gradient `ds-bar-cta`
  (in `BottomTabNav.tsx`).
- Tables/dense grids → `ds-row` / `ds-card` / `ds-grid-breathing` (no raw tables).
- Reuse the shared primitives from `components/UI.tsx`: the new
  `SectionTitle`, `IconTile`, `FabGrad`, `BentoTile`, `Button variant="grad"`,
  plus `Spinner`/`LoadingState`, `EmptyState`, `IconButton`, `BackButton`,
  `PageHeader`, `Badge`, `ProgressBar`, `Sheet`, `Stat`, `SectionLabel`,
  `Button`, `Card`, and `Icons.Bell`/`Icons.Filter`. Re-implementing any of
  these inline is a defect — import the primitive (spec §3.8).
- **Stacking (强制).** Never hand-roll an `absolute … z-50` dropdown inside a
  card/scroll area — `backdrop-filter`/`transform`/`overflow` ancestors trap
  it under the chrome. Anchored floating panels → `<Popover>`/`<Portal>`
  (UI.tsx); modals → `<Sheet>`/`ds-z-modal`. Use the centralized z-scale
  tokens/utilities only (`--z-* / .ds-z-*`): sticky 30 < chrome 40 < popover
  60 < modal 80 < toast 95. Spec §3.9.
- **Icons (强制).** Never use emoji as a UI icon/affordance — emoji only in
  real user content text. Icons come from `components/UI.tsx` `Icons.*`
  (core glyphs) or **`lucide-react`** (the only approved icon library,
  ~1,500 icons, already in the importmap). Size via `w-*/h-*`, color via
  `currentColor`/tokens. Content pages = centred phone column
  `max-w-md mx-auto` / `.ds-page` (never `max-w-2xl/4xl/5xl`). Spec §3.10.
- Tokens stay centralized in `index.css` + `styles/StyleCenter.ts`; consume,
  never inline hex. **Dark/light parity is acceptance criteria.**

---

## 6. Where Conventions Live (single source of truth)

- This file — per-app + co-development rules for qy_capacitor.
- `.cursor/rules/wordflow-design.mdc` — design system rule (references this file).
- `poly_apps/laravel_dashboard/apps/wordflow/docs/DESIGN_SYSTEM.md` — **the**
  design contract: Part A (§0–§6) visual system + Part B (§7–§12) UI/UX
  interaction design;组件工作分解并入其 §14。
- `development-guides/LARAVEL_GUIDE.md` — backend (AppQyV1) conventions.
- `development-guides/CURSOR_RULES_UPDATE_GUIDE.md` — how to edit rules/specs.
- `poly_apps/laravel_dashboard/apps/wordflow/docs/README.md` — WordFlow 文档索引
  (2026-06 自 qy_capacitor/docs 迁移并精简)。

Do not duplicate full specs across files; reference the canonical source.

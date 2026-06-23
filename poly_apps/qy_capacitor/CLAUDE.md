# CLAUDE.md — qy_capacitor (WordFlow AI)

Per-app rules. Docs are full-file replacements, not incremental edits.

- **Identity:** WordFlow AI frontend. React + TSX + Vite + Capacitor; pkg mgr **pnpm**. Dev log tag `[wordflow-ai]`; default port `3000` (`.env PORT=`).
- **One feature, two repos (mandatory):** any frontend change touching an API is incomplete until the matching Laravel backend exists in `poly_apps/laravel_main/app/Apps/AppQyV1/**` + `routes/AppQyV1Router/**` (and reverse). Interfaces/routes are designed at implementation time per FEATURES.md / BACKEND_REQUIREMENTS.md, not fixed in docs.
- **Startup:** `scripts/start.ps1` (orchestrator: starts laravel backend + qy frontend, each own window, `-ForceInstall`), `start_qy.ps1` (frontend only), `start.sh` (Linux).
- **Design (mandatory):** v4.1 Iris layer (additive over v3.x). Output MUST match `public/design-reference-{light,dark}.webp` — Read both before any visible design change. Solid `--klein-*` for text/icons/active/borders; gradient `--klein-grad-*` for hero surfaces (CTA, island center, FAB) only. Use shared primitives in `components/UI.tsx`, `<PillNav>`, `ds-*` classes/z-scale tokens (never raw tables, ad-hoc `absolute z-50`, inline hex, or emoji icons — use `Icons.*`/`lucide-react`). Content pages = `max-w-md mx-auto`. Tokens centralized in `index.css` + `styles/StyleCenter.ts`. Add `/* [v4.1-Iris] */` marker to redesigned files.
- **PowerShell:** declare vars at top; absolute paths via `Split-Path`/`Join-Path`/`Resolve-Path`.

Full detail: `poly_apps/pycore_laravel_wordflow_ui/apps/wordflow/docs/DESIGN_SYSTEM.md` (design), `development-guides/LARAVEL_GUIDE.md` (backend), `.cursor/rules/wordflow-design.mdc`.

Git/code rules: see repo-root CLAUDE.md.

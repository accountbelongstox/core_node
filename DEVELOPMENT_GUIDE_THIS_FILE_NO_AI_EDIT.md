<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

## 1. Project Architecture

### 1.1. Node Core Service Framework
Located in `./ncore`, the framework runs on the latest Node.js version and exposes multiple entry points via the subdirectories inside `./apps`. Each entry can boot a dedicated app flow while reusing the capabilities provided by `ncore`.
Development standards for `ncore` and `./apps` live in `development-guides/NODE_NCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

### 1.2. Application Modules (`apps`)
- **Core apps (`apps`)**: Everything under `apps/` is a business entry powered by `ncore`. Launch from the repo root using `node ./main.js app=appName`; the runtime automatically invokes `apps/appName/main.js` and calls its `start` method.

### 1.2. Aggregated Apps (`poly_apps`)
- **Aggregated apps (`poly_apps`)**: Third-party stacks (Laravel, Vue, Flutter, etc.) that interact with `ncore` or run independently. Each lives under `poly_apps/`.

#### 1.2.1. Laravel backend (`./poly_apps/laravel_main`)
`poly_apps/laravel_main` is the Laravel-based backend that exposes multi-entry APIs for the rest of the system. Development details: `./poly_apps/laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

#### 1.2.2. Flutter aggregate app (`./poly_apps/flutter_bloom`)
`poly_apps/flutter_bloom` is the Flutter mobile/web aggregate client. It integrates with other subsystems through multi-entry flows. Guide: `./poly_apps/flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

#### 1.2.3. Nuxt aggregate app (`./poly_apps/nuxt_main`)
`poly_apps/nuxt_main` is the Nuxt-powered web entry point. Guide: `./poly_apps/nuxt_main/development-guides/NUXT_POLYAPP_GUIDE_THIS_FILE_NO_AI_EDIT.md`.
- **Project path:** `D:/programing/core_node/poly_apps/nuxt_main`
- **Nuxt multi-app architecture doc:** `D:/programing/core_node/development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`

### MCP (AI-MCP service)
Development standards: `development-guides/MCPSERVER_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

### 1.3. System bootstrap & installers
- **Windows:** Root-level `dd.cmd` installs Node/Java/PHP/Docker and other essentials in one step. Details: `./development-guides/DD_POWERSHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.
- **Linux (Debian):** Root-level `dd.sh` performs the same setup (more advanced than Windows). Details: `./development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

### 1.4. Global auxiliary scripts `./scripts/`
- Helper scripts used during development.
- Read `./scripts/AUXILIARY_SCRIPTS_GUIDE_THIS_FILE_NO_AI_EDIT.md` before running anything.

## 2. Development Process
- Every section (`app`, `poly_apps`, `./ncore`, `./scripts`, etc.) ships its own `development-guides` entry. Report if something is missing.
- When building an app on top of `ncore`, consult its matching guide first.
- When working in `poly_apps`, open the relevant guide for that stack.
- For cross-app efforts, review all affected guides before coding.
- Gemini AI dedicated feedback doc: `development-guides\GEMINI_AI_FEEDBACK.md`.

## Strict Requirements
- Do **not** run test commands during development.
- Do **not** create or edit documentation unless explicitly instructed (especially `README.md`).
- Do **not** write summaries during the development process; keep the focus on implementation.

## Project Highlights
- **Monorepo architecture:** All apps and libraries live in one repository for unified versioning and code sharing.
- **Framework driven:** The in-house `ncore` framework standardizes patterns and stacks for consistency and maintainability.
- **Low-code / zero-code mindset:** Heavy abstraction plus configuration lets engineers focus on business logic instead of plumbing.
- **Polyglot, multi-app:** Manage Node.js, PHP, Python, Vue, Flutter, and more side-by-side with strong interoperability.
- **High automation:** Powerful `dd` installers and comprehensive guides emphasize productivity and reliable DevOps workflows.

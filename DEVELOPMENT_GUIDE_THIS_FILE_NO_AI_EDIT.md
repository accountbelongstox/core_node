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
Development standards for `ncore` and `apps` live in `development-guides/NODE_NCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

### 1.2. Application Modules (`apps`)
- **Core apps (`apps`)**: Everything under `apps/` is a business entry powered by `ncore`. Launch from the repo root using `node ./main.js app=appName`; the runtime automatically invokes `apps/appName/main.js` and calls its `start` method.

### 1.3. Aggregated Apps (`poly_apps`)
- **Aggregated apps (`poly_apps`)**: Third-party stacks (Laravel, Vue, Flutter, etc.) that interact with `ncore` or run independently. Each lives under `poly_apps/`.

#### 1.3.1. Laravel backend (`./poly_apps/laravel_main`)
`poly_apps/laravel_main` is the Laravel-based backend that exposes multi-entry APIs for the rest of the system. Development details: `development-guides/LARAVEL_GUIDE.md`.

#### 1.3.2. Flutter aggregate app (`./poly_apps/flutter_bloom`)
`poly_apps/flutter_bloom` is the Flutter mobile/web aggregate client. It integrates with other subsystems through multi-entry flows. Guide: `development-guides/FLUTTER_GUIDE.md`.

#### 1.3.3. Nuxt aggregate app (`./poly_apps/nuxt_main`)
`poly_apps/nuxt_main` is the Nuxt-powered web entry point. Guide: `development-guides/NCORE_NUXT_INTEGRATION_GUIDE.md`.
- **Project path:** `D:/programing/core_node/poly_apps/nuxt_main`
- **Nuxt multi-app architecture doc:** `development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`

### 1.4. System bootstrap & installers
- **Windows:** Root-level `dd.cmd` installs Node/Java/PHP/Docker and other essentials in one step. Details: `development-guides/DD_POWERSHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.
- **Linux (Debian):** Root-level `dd.sh` performs the same setup (more advanced than Windows). Details: `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

### 1.5. Global auxiliary scripts `./scripts/`
- Helper scripts used during development.
- Read `development-guides/AUXILIARY_SCRIPTS_GUIDE_THIS_FILE_NO_AI_EDIT.md` before running anything.

### 1.6. MCP (AI-MCP service)
Development standards: `development-guides/MCPSERVER_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

### 1.7. Python Core (`pycore`)
Python core framework and utilities. Development guide: `development-guides/PYTHON_PYCORE.md`.

### 1.8. Common Specifications
- **Timer design:** `development-guides/COMMON_TIMER_DESIGN_SPECIFICATION.md`
- **Theme and style:** `development-guides/THEME_AND_STYLE_GUIDE.md`
- **Debug output:** `development-guides/DEBUG_OUTPUT_SOLUTION.md`

## 2. Development Process
- Every section (`app`, `poly_apps`, `./ncore`, `./scripts`, etc.) ships its own `development-guides` entry. Report if something is missing.
- When building an app on top of `ncore`, consult its matching guide first.
- When working in `poly_apps`, open the relevant guide for that stack.
- For cross-app efforts, review all affected guides before coding.

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

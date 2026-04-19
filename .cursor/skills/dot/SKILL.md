---
name: dot
description: When working on dotcore (shared .NET libs = public class libraries = pycore counterpart) or dotapps (runnable apps), follow layout, naming, and dependency rules. All shared libraries live in dotcore; apps reference only dotcore.
---

# Dot Stack Skill (dotcore + dotapps)

Use this skill when editing or adding code under **dotcore/** or **dotapps/**.

- **dotcore** = .NET **public class libraries (公共类库)** = counterpart of **pycore**. All shared libraries used by more than one app (DotCore.Foundations, DotCore.Common, DotCore.Utils, DotCore.Infrastructure, DotCore.UIInspect, DotCore.UITheme, etc.) live here.
- **dotapps** = runnable applications; they reference dotcore and, when needed, their own **sub-app characteristic library (子APP的特征类库)** under dotapps/<App>/ (e.g. dotapps/d3check/D3CheckCore/). No app-to-app references.

Canonical spec: [development-guides/DOT_ARCHITECTURE.md](../../development-guides/DOT_ARCHITECTURE.md). Cursor rule: [.cursor/rules/dot.mdc](../../.cursor/rules/dot.mdc). **UI (WPF/MAUI/Blazor/Avalonia):** canonical spec [development-guides/DOT_UI_PROJECT_SPECIFICATION.md](../../development-guides/DOT_UI_PROJECT_SPECIFICATION.md), [.cursor/rules/dot-ui.mdc](../../.cursor/rules/dot-ui.mdc). Progress and pycore↔dotcore mapping: [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md).

## When to Use

- Editing or adding code under `dotcore/` (any DotCore.* project or tests).
- Editing or adding code under `dotapps/` (SimpleUi, Cli, CallModule, d3check, or any new app).
- Adding a new shared library (as a new DotCore.* under dotcore) or a new app (under dotapps).
- Choosing where to put types, utilities, or config used by multiple apps (dotcore, not dotapps).

## Instructions

### 1. Layout: all shared libs in dotcore, apps in dotapps

- **dotcore/** = shared class libraries only. Every subfolder is one library (e.g. `DotCore.Foundations`). All code used by more than one app, or shared infrastructure, belongs here. **Sub-app characteristic libs (子APP的特征类库)** belong under **dotapps/<App>/** (e.g. dotapps/d3check/D3CheckCore/), not in dotcore. No runnable apps under dotcore.
- **dotapps/** = runnable applications only. Every subfolder is one app (e.g. `SimpleUi`, `Cli`, `CallModule`, `d3check`). Apps reference dotcore and, when needed, a project under the same app (e.g. d3check → D3CheckCore); no app-to-app project references.
- **Tests** live under `dotcore/tests/` (e.g. `DotCore.Foundations.Tests`).

### 2. Naming and code language

- **Language:** All code, comments, and user-facing strings in **English**. **ASCII only** in source code.
- **Libraries:** Folder and project name `DotCore.<Name>` (e.g. `DotCore.Utils`). Namespace `DotCore.*`.
- **Apps:** Folder and assembly name match (e.g. `SimpleUi`). Root namespace **DotApps.<AppName>** (e.g. `DotApps.SimpleUi`).

### 3. Dependencies

- **Direction:** Apps → Libraries only. Libraries do not reference apps. Libraries may reference other libraries only in a DAG (no cycles).
- **DotCore.Foundations:** No project refs; BCL/minimal NuGet only.
- **DotCore.Common:** Foundations only.
- **DotCore.Utils / DotCore.Infrastructure:** Foundations + Common (and optional third-party).
- **DotCore.UIInspect:** Optional third-party (e.g. FlaUI) only; no dotcore project refs if not needed.
- **Apps:** Reference only the `DotCore.*` projects they need (e.g. Cli uses Foundations, Common, Utils; SimpleUi uses UIInspect).

### 4. Project reference paths

- **From app (dotapps/&lt;AppName&gt;/):** `..\..\dotcore\DotCore.<Name>\DotCore.<Name>.csproj`
- **From library (dotcore/):** `..\DotCore.<Name>\DotCore.<Name>.csproj`
- **From test (dotcore/tests/...):** `..\..\DotCore.<Name>\DotCore.<Name>.csproj`

### 5. Adding a new library

- Create `dotcore/DotCore.<Name>/` with `DotCore.<Name>.csproj`.
- Obey dependency rule: only reference DotCore.* projects that are allowed (see §3).
- Add the project to `dotcore/dotcore.sln`.
- Update [DOT_ARCHITECTURE.md](../../development-guides/DOT_ARCHITECTURE.md) and [dotcore/DESIGN.md](../../dotcore/DESIGN.md) project list.

### 6. Adding a new app

- Create `dotapps/<AppName>/` with `<AppName>.csproj` and entry point (e.g. `Program.cs`).
- Set `RootNamespace` to `DotApps.<AppName>`, `AssemblyName` to `<AppName>`.
- Add ProjectReference only to required `dotcore` libs (path `..\..\dotcore\DotCore.<Name>\DotCore.<Name>.csproj`).
- Add the project to `dotcore/dotcore.sln`.
- Optionally use `dotapps/start.ps1` menu "Create new app" to scaffold.

### 7. Build and run

- From repo root: `dotnet build dotcore/dotcore.sln`
- Run app: `dotnet run --project dotapps/<AppName>/<AppName>.csproj` (with optional args after `--`).
- Menu: `.\dotapps\start.ps1` (from repo root or from `dotapps/`) for "Create new app" or "Run existing app".

### 8. Updating this skill / rules

- Canonical project spec: [development-guides/DOT_ARCHITECTURE.md](../../development-guides/DOT_ARCHITECTURE.md).
- Rule file: [.cursor/rules/dot.mdc](../../.cursor/rules/dot.mdc). Keep skill and rule in sync; avoid duplicate wording; reference by section (e.g. §3) where possible.
- UI rule: For WPF/MAUI/Blazor/Avalonia apps, also follow [development-guides/DOT_UI_PROJECT_SPECIFICATION.md](../../development-guides/DOT_UI_PROJECT_SPECIFICATION.md) and [.cursor/rules/dot-ui.mdc](../../.cursor/rules/dot-ui.mdc).
- When adding a new library or app, update DOT_ARCHITECTURE.md and DESIGN.md; optionally extend this SKILL.md Instructions.

## Summary

| Need | Where |
|------|--------|
| Shared types / utilities used by more than one app | dotcore/DotCore.* |
| Sub-app characteristic library (single-app domain types) | dotapps/<AppName>/<SubLib>/ (e.g. dotapps/d3check/D3CheckCore/) |
| Runnable app | dotapps/<AppName>/ |
| Canonical layout and naming | DOT_ARCHITECTURE.md |
| Cursor rule (globs dotcore/**, dotapps/**) | .cursor/rules/dot.mdc |
| UI layer (Clean Architecture + MVVM + Fluent 2) | DOT_UI_PROJECT_SPECIFICATION.md, .cursor/rules/dot-ui.mdc |
| Build | dotnet build dotcore/dotcore.sln |
| Run app | dotnet run --project dotapps/... or start.ps1 |

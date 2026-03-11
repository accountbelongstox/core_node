# Dot Architecture (dotcore + dotapps)

This document is the **canonical project specification** for the .NET "dot" stack. **dotcore** is the .NET **public class libraries (公共类库)** and is the counterpart of **pycore** (Python): shared libraries under `dotcore/`, runnable apps under `dotapps/`. **Sub-app class libraries (子app的类库)** are per-app code under `pyapps/<app>/` (Python) or `dotapps/<App>/` (.NET); they are not shared across apps. Canonical definitions: [PYCORE_PYAPPS_STRUCTURE.md](PYCORE_PYAPPS_STRUCTURE.md). Cursor rule: [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc). Cursor skill: [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md). Progress and pycore↔dotcore mapping: [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md).

---

## 1. Directory layout

- **dotcore/** – Public class libraries (公共类库). .NET counterpart of **pycore**. **All** shared libraries used by more than one app live here. Each subfolder is one library. **Sub-app characteristic libraries (子APP的特征类库)** belong under **dotapps/<App>/** (e.g. `dotapps/d3check/D3CheckCore/` for D3 path scanner, game interface data, Battle.net region/operations), not in dotcore.
  - `dotcore/DotCore.Foundations/` – Base library (BCL only, no third-party).
  - `dotcore/DotCore.Common/` – Constants, paths, global config.
  - `dotcore/DotCore.Utils/` – Shared utilities (incl. Ocr, **Security**: `Security/MachineIdProvider.cs`, `Security/PasswordCipher.cs` for machine-bound encrypt/decrypt; may use third-party).
  - `dotcore/DotCore.Utils.ImageColor/` – HSV, InRange mask (Utils; no cross-calls).
  - `dotcore/DotCore.Utils.ImageContours/` – FindContours, area/aspect filter (Utils; no cross-calls).
  - `dotcore/DotCore.Utils.ImageMorphology/` – Canny, Dilation, Erosion (Utils; no cross-calls).
  - `dotcore/DotCore.Utils.ImagePreprocess/` – Grayscale, Otsu binarize (Utils; no cross-calls).
  - `dotcore/DotCore.ButtonRecognizer/` – Button/text-region recognition (aggregate; composes above Utils + Utils.Ocr, TemplateMatcher, ScreenCapture).
  - `dotcore/DotCore.Infrastructure/` – DB, file, network abstractions.
  - `dotcore/DotCore.UIInspect/` – UI Automation (e.g. FlaUI) helpers.
  - `dotcore/DotCore.UITheme/` – Theme data (colors, fonts, sizes); no WPF types; for D3Check and other dotapps.
  - `dotcore/DotCore.VocAnnotator/` – VOC/JSON annotation IO, project config; logic 1:1 with pycore voc_annotator.
  - `dotcore/tests/` – Test projects (e.g. `DotCore.Foundations.Tests`).
- **dotapps/** – Runnable applications. Each subfolder is one app. Apps reference dotcore and, when needed, their own sub-app lib (e.g. d3check references `dotapps/d3check/D3CheckCore/`). No app-to-app references.
  - `dotapps/SimpleUi/` – WPF sample app.
  - `dotapps/Cli/` – Console multi-command host.
  - `dotapps/CallModule/` – Service host.
  - `dotapps/d3check/` – D3Check WPF app; uses **D3CheckCore** (sub-app lib under `dotapps/d3check/D3CheckCore/`) for path scanner, game interface data, Battle.net region/operations.
- **Solution:** `dotcore/dotcore.sln` references all projects (libs + apps). App projects reference libs via `..\..\dotcore\DotCore.*\*.csproj`.

**Where to put code:** Generic, reusable logic (machine ID, password cipher, path/hotkey/string utils) belongs in **dotcore** (e.g. `DotCore.Utils` or a dedicated `DotCore.<Feature>`). App-specific config keys, UI, and flow (e.g. Battle.net credentials config key names, credentials dialog, AsiaCredentialsService) stay in **dotapps/<App>/** (e.g. `dotapps/d3check/Config/`, `dotapps/d3check/Windows/`). Do not put public-class-library code under `dotapps/<App>/D3CheckCore/` or similar sub-app lib if it has no app-specific dependency.

---

## 2. Naming and code language

- **All code and user-facing strings in English.** No non-ASCII in source.
- **Libraries:** `DotCore.<Name>` (e.g. `DotCore.Foundations`). Namespace `DotCore.*`.
- **Apps:** Folder and assembly name match (e.g. `SimpleUi`, `Cli`). Root namespace `DotApps.<AppName>` (e.g. `DotApps.SimpleUi`).
- **New library:** Add `dotcore/DotCore.<Name>/` and `DotCore.<Name>.csproj`. Add to `dotcore.sln`.
- **New app:** Add `dotapps/<AppName>/` with `<AppName>.csproj` and entry (e.g. `Program.cs`). Reference required `dotcore` libs. Add to `dotcore.sln`. Optionally use `dotapps/start.ps1` to scaffold.

---

## 3. Dependencies

- **Direction:** Apps → Libraries. Libraries do not reference apps or each other in a cycle.
- **Foundations:** No project refs; BCL/minimal deps only.
- **Common:** Foundations only.
- **Utils / Infrastructure:** Foundations + Common (and optional third-party).
- **UIInspect:** Optional third-party (e.g. FlaUI.UIA3) only.
- **Apps:** Reference only the DotCore.* projects they need.

---

## 4. Build and run

- From repo root:
  - `dotnet build dotcore/dotcore.sln`
  - `dotnet run --project dotapps/SimpleUi/SimpleUi.csproj`
  - `dotnet run --project dotapps/Cli/Cli.csproj -- --help`
- **dotapps/start.ps1:** Run from repo root or from `dotapps/`. Menu: (1) Create new app, (2) Run existing app (pick from list).

---

## 5. Cursor / AI rules and skill (summary)

- Code and comments in English; ASCII only in code.
- Follow the layout above: all shared libs in `dotcore/`, apps in `dotapps/`; apps reference only dotcore.
- Use `DotApps.<AppName>` for app root namespaces.
- Prefer `DotCore.*` for shared types. No circular refs.
- **Rule:** `.cursor/rules/dot.mdc` (applied to `dotcore/**` and `dotapps/**`).
- **UI (WPF/MAUI/Blazor/Avalonia):** Canonical spec `development-guides/DOT_UI_PROJECT_SPECIFICATION.md` and `.cursor/rules/dot-ui.mdc` (Clean Architecture + MVVM + Fluent 2 for Presentation layer). Other docs must defer to this spec for UI structure.
- **Skill:** `.cursor/skills/dot/SKILL.md` (when to use, step-by-step instructions, summary table).

# Dot Architecture (dotcore + dotapps)

**Canonical specification** for the .NET "dot" stack. **dotcore/** = the .NET **public class libraries (公共类库)**, the counterpart of **pycore** (Python): shared libraries used by more than one app. **dotapps/** = runnable applications (one per subfolder). **Sub-app class libraries (子app的类库)** are per-app code under `dotapps/<App>/` (e.g. `dotapps/d3check/D3CheckCore/`) — not shared across apps.

Authority / related: [PYCORE_PYAPPS_STRUCTURE.md](PYCORE_PYAPPS_STRUCTURE.md) · rules [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc) + [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc) · skill [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md) · pycore↔dotcore mapping [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md).

## Layout
- **dotcore/** — public class libraries; each subfolder is one library. **All** shared (multi-app) libraries live here.
- **dotapps/** — runnable apps; each references dotcore and, when needed, its own sub-app lib under `dotapps/<App>/`.
- **Solution:** `dotcore/dotcore.sln` references all projects; apps reference libs via `..\..\dotcore\DotCore.*\*.csproj`. `dotapps/start.ps1` scaffolds/runs apps.

## Code placement (the core rule)
- Generic, reusable logic (machine id, password cipher, path/string/hotkey utils, OCR, image ops) → **dotcore**.
- App-specific config keys, UI, flow, domain (e.g. Battle.net credentials, D3/ROSBOT scanning) → **dotapps/<App>/** or its sub-app lib.
- Never put generic public-library code in a sub-app lib; never put app-specific domain in dotcore.

## Naming
- Libraries: `DotCore.<Name>` (folder = csproj = namespace `DotCore.*`).
- Apps: folder = assembly name; root namespace `DotApps.<AppName>`.

## Dependencies
- Direction: **Apps → Libraries**, DAG only. Libraries never reference apps; no cycles; no dotcore→dotapps; **no app→app**.
- An app references only the dotcore libs it needs, plus its own sub-app lib.

## UI projects
WPF/MAUI/Blazor/Avalonia apps under dotapps follow **Clean Architecture + MVVM + Fluent 2**: Domain → Application → Infrastructure, with Presentation depending on Application (not Infrastructure). Authority: [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc) — it wins on any UI/Presentation conflict.

## VocAnnotator (pycore ↔ dot)
Logic is **1:1 with `pycore/pyutils/voc_annotator`**: all VOC/JSON/XML IO and config live in the **DotCore.VocAnnotator** library; the **dotapps/VocAnnotator** app implements the window/canvas/lists/menus and uses the library. `VocAnnotatorLauncher` lets a host app (e.g. d3check) open the annotator.

## Conventions
**All code, comments, and user-facing strings in English; ASCII-only in source.**

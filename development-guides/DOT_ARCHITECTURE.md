# Dot Architecture & Specification (dotcore + dotapps)

**Canonical project specification** for the .NET "dot" stack. **dotcore** is the .NET **public class libraries (公共类库)** and is the counterpart of **pycore** (Python): shared libraries under `dotcore/`, runnable apps under `dotapps/`. **Sub-app class libraries (子app的类库)** are per-app code under `pyapps/<app>/` (Python) or `dotapps/<App>/` (.NET); they are not shared across apps.

> This single document consolidates the dot architecture, library placement inventory, structure & dependencies, the **.NET UI specification** (Clean Architecture + MVVM + Fluent 2), and the **VocAnnotator** pycore↔dot mapping. (Merged 2026-06 from the former DOT_ARCHITECTURE / DOT_UI_PROJECT_SPECIFICATION / DOT_LIBRARY_PLACEMENT_AUDIT / DOT_STRUCTURE_AND_DEPENDENCIES_AUDIT / DOT_VOC_ANNOTATOR_PROGRESS.)

Related: [PYCORE_PYAPPS_STRUCTURE.md](PYCORE_PYAPPS_STRUCTURE.md) · Cursor rules [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc) / [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc) · Skill [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md) · pycore↔dotcore mapping [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md).

---

## 1. Directory layout

- **dotcore/** – Public class libraries (公共类库), the .NET counterpart of **pycore**. **All** shared libraries used by more than one app live here; each subfolder is one library. **Sub-app characteristic libraries (子APP的特征类库)** belong under **dotapps/<App>/** (e.g. `dotapps/d3check/D3CheckCore/`), not in dotcore.
- **dotapps/** – Runnable applications; each subfolder is one app. Apps reference dotcore and, when needed, their own sub-app lib. **No app-to-app references.**
- **Solution:** `dotcore/dotcore.sln` references all projects (libs + apps); app projects reference libs via `..\..\dotcore\DotCore.*\*.csproj`.

**Where to put code:** Generic, reusable logic (machine ID, password cipher, path/hotkey/string utils, OCR, image ops) belongs in **dotcore**. App-specific config keys, UI, flow and domain (e.g. Battle.net credentials, D3/ROSBOT scanning, credentials dialog) stay in **dotapps/<App>/** or its sub-app lib. Do not place generic public-library code in a sub-app lib, and do not place app-specific domain in dotcore.

---

## 2. Naming and code language

- **All code and user-facing strings in English; no non-ASCII in source.**
- **Libraries:** `DotCore.<Name>` (folder, csproj, namespace `DotCore.*`).
- **Apps:** Folder = assembly name (e.g. `SimpleUi`, `Cli`); root namespace `DotApps.<AppName>`.
- **New library:** add `dotcore/DotCore.<Name>/` + `DotCore.<Name>.csproj`; add to `dotcore.sln`.
- **New app:** add `dotapps/<AppName>/` with `<AppName>.csproj` + entry (`Program.cs`/`App.xaml`); reference required dotcore libs; add to `dotcore.sln`. `dotapps/start.ps1` can scaffold (menu: create new app / run existing).

---

## 3. Dependencies

- **Direction:** Apps → Libraries. Libraries never reference apps, and never form a cycle (DAG only).
- **Foundations:** no project refs (BCL/minimal only). **Common:** Foundations only. **Utils / Infrastructure:** Foundations + Common (+ optional third-party). **Utils.Image\*:** Foundations only, no cross-calls between them. **TemplateMatcher / ScreenCapture / UITheme / UIInspect:** no dotcore project refs (packages only, e.g. FlaUI, OpenCv). **ButtonRecognizer:** composes Utils, Utils.Image\*, TemplateMatcher, ScreenCapture. **VocAnnotator:** Foundations + Common.
- **Apps** reference only the dotcore libs they need (and their own sub-app lib). Example — `d3check`: Foundations, Common, Utils, Infrastructure, UITheme, UIInspect, VocAnnotator, **D3CheckCore** (its sub-app lib).
- Invariants (verified): no dotcore→dotapps reference; no reverse dependency on app domain; no app→app reference; no cycles.

---

## 4. Build and run

```
dotnet build dotcore/dotcore.sln
dotnet run --project dotapps/SimpleUi/SimpleUi.csproj
dotnet run --project dotapps/Cli/Cli.csproj -- --help
```
`dotapps/start.ps1` (run from repo root or `dotapps/`): (1) create new app, (2) run an existing app.

---

## 5. Library inventory (what lives where)

### 5.1 dotcore — public class libraries

| Library | Contents |
|---------|----------|
| **DotCore.Foundations** | Base, BCL-only: Guard, Result, ColorPrinter, AppEventIds, IEventHub/DefaultEventHub, IShutdownRequest/DefaultShutdownRequest, IMainThreadDispatcher. |
| **DotCore.Common** | AppPaths (user data/config dir, cross-platform), CommonConstants, II18nProvider/DefaultI18nProvider, StatusDisplaySymbols. |
| **DotCore.Utils** | PathUtil, StringUtil, TimeUtil, HotkeyUtil, ConfigChangeNotifier, IGlobalHotkeyService/WindowsGlobalHotkeyService, `Ocr/` (IOcrEngine, OcrHelper, OcrResult, PaddleOcrEngine), **`Security/`** (MachineIdProvider — machine-unique id; PasswordCipher — machine-bound Fernet encrypt/decrypt). |
| **DotCore.Infrastructure** | IFileReadWriter/DefaultFileReadWriter, JsonKeyPathConfig (JSON config by key path; no app keys). |
| **DotCore.UITheme** | Theme data only (ThemeColors/Fonts/Sizes + key types, UITheme aggregation); no WPF types. |
| **DotCore.UIInspect** | UI Automation (FlaUI): UIOperations, UIElementDumper, UIInspectPrinter, ElectronDetector, UIButtonEnumerator, ProcessLauncher. |
| **DotCore.ScreenCapture** | ScreenCaptureService, ScreenshotData, constants, P/Invoke NativeMethods. |
| **DotCore.TemplateMatcher** | Image template matching (OpenCv): TemplateMatcherService, result, constants. |
| **DotCore.Utils.ImageColor / ImageContours / ImageMorphology / ImagePreprocess** | Isolated image ops (HSV/mask; contours/area-aspect; Canny/dilate/erode; grayscale/Otsu). No cross-calls. |
| **DotCore.ButtonRecognizer** | Button/text-region recognition; aggregate composing Utils.\*, TemplateMatcher, ScreenCapture. |
| **DotCore.VocAnnotator** | VOC/JSON annotation IO (AnnotationIo, VocIo, DataYamlWriter), ProjectConfig/VocAnnotatorConfig, VocAnnotatorLauncher (API to launch the annotator app). |
| **dotcore/tests/** | Test projects (e.g. DotCore.Foundations.Tests). |

Rule: generic, reusable code used by more than one app belongs in dotcore; **no app-specific config keys, UI, or domain (D3/ROSBOT/Battle.net) in dotcore.**

### 5.2 dotapps — applications and sub-app libs

| App / lib | Contents |
|-----------|----------|
| **d3check** (app) | `Config/` (AsiaCredentialsService, D3CheckConfigService, CredentialsStored — uses DotCore.Utils.Security), `Constants/` (ConfigKeys, I18nKeys), `Ctl/` (BattlenetLoginCtl, RosbotFlowController, RosbotStatusProvider), `I18n/`, `Panels/`/`Windows/`/`Components/` (WPF UI), entry. |
| **d3check/D3CheckCore** (sub-app lib) | D3/ROSBOT/Battle.net domain: PathScanner/DriveOrder/PathScanResult, Rosbot\* (pick/version/detection/operation), D3 constants/scale/status, GameInterfaceData, `Battlenet/` (manager, region detection, login OCR flow, stuck detector, cache cleanup, browser finder), screenshot/input helpers. No generic cipher/machine-id (those live in DotCore.Utils.Security). |
| **SimpleUi** | WPF sample (references dotcore as needed). |
| **Cli** | Console host (Foundations, Common, Utils). |
| **CallModule** | Service host (Foundations, Common, Utils). |
| **VocAnnotator** (app) | Annotator app: references DotCore.VocAnnotator for all IO; implements window, image list, canvas, class list, menus (see §7). |
| **abc, _template** | Scaffold/template (not all in `dotcore.sln`). |

Rule: app-specific code (config keys, UI, flows, domain) stays under `dotapps/<App>/` or its sub-app lib; no generic public-library code in app libs.

---

## 6. UI Project Specification (Clean Architecture + MVVM + Fluent 2)

**Canonical spec** for .NET UI projects under **dotapps** using WPF, MAUI, Blazor Hybrid, or Avalonia. Any other document that describes UI/Presentation structure must defer to this section. Cursor rule: [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc).

### 6.1 Solution architecture (layers)

- **Domain (core)** — no dependencies; pure C# POCO: Entities, ValueObjects, Enums, interfaces (e.g. repository interfaces). Core business logic; no UI/DB framework deps.
- **Application** — depends on Domain: use cases, DTOs, service interfaces, validators (e.g. FluentValidation). CQRS via MediatR (commands/queries) is common.
- **Infrastructure** — depends on Application: DB (EF Core), external API clients, file system, auth. All side effects live here.
- **Presentation (UI)** — depends on Application (not Infrastructure): UI framework code (WPF/MAUI/Blazor) — Views (XAML/Razor), ViewModels, Converters, Styles. **No complex business logic here.**

### 6.2 Presentation folder structure

```
dotapps/<AppName>/
├── App.xaml                # Entry + resource dictionary merge
├── Assets/                 # Fonts/, Images/, Styles/ (Colors.xaml, Themes.xaml)
├── Components/             # Reusable UI (UserControls)
├── Pages/  (or Views/)     # Page-level views, grouped by feature (Dashboard/, Settings/)
├── ViewModels/             # ViewModels (Base/ BaseViewModel + per-view)
├── Services/               # UI services (Navigation/, Dialog/), interface-based
└── Converters/             # Data-binding converters (e.g. BoolToVisibility)
```
Group Pages/Views by feature; one ViewModel per major view with constructor injection; interface-based Services for testability.

### 6.3 Naming & coding standards

| Type | Format | Rule |
|------|--------|------|
| Views | `[Feature]Page.xaml` | Suffix Page/Window/View. |
| ViewModels | `[Feature]ViewModel.cs` | One-to-one with View; constructor injection. |
| Services | `I[Name]Service` | Interface-based; mockable. |
| Commands | `[Action]Command` | ICommand properties in ViewModel. |
| Async | `[Method]Async` | All I/O async; never block the UI thread. |

Code/comments English, ASCII-only; app root namespace `DotApps.<AppName>`.

### 6.4 Visual design (Fluent 2)

Use **Fluent 2** (Windows 11 style): light, depth, motion, material. **Materials:** Mica/Acrylic backgrounds; shadows + strokes for hierarchy (not flat blocks). **Motion:** transitions on show/hide; staggered list entrance; drill-in page navigation. **Typography:** Segoe UI Variable; bold titles with whitespace, high-contrast body. **Layout/theming:** Fluent 2 layout system; prefer WinUI 3-style controls; support Light/Dark mode. Reference: <https://fluent2.microsoft.design/>.

---

## 7. VocAnnotator (pycore ↔ dot)

Logic **1:1 with `pycore/pyutils/voc_annotator`**: public lib in **DotCore.VocAnnotator**, runnable app in **dotapps/VocAnnotator** that uses the lib — same pattern as Python (shared lib + sub-app tool).

| Python (pycore) | .NET | Location |
|-----------------|------|----------|
| config.py | VocAnnotatorConfig | DotCore.VocAnnotator |
| voc_io.py (Pascal VOC XML, bndbox) | VocIo | DotCore.VocAnnotator |
| annotation_io.py (rect/polygon/ellipse/circle; YOLO export) | AnnotationIo | DotCore.VocAnnotator |
| project_config.py (project_name, classes, class_colors) | ProjectConfig | DotCore.VocAnnotator |
| main_window + canvas + waterfall + annotation_table | VocAnnotator app UI (WPF) | dotapps/VocAnnotator |

**Rule:** all file/XML/JSON logic and config live in **DotCore.VocAnnotator**; the **dotapps/VocAnnotator** app implements the window, image list, canvas, class list and menus. `VocAnnotatorLauncher` lets a host app (e.g. d3check Calibration "Open label") start the annotator; in-process use opens an `AnnotatorWindow` directly.

**Differences vs Python:** UI is WPF (vs Tkinter); image size obtained from the loaded WPF `BitmapImage` (vs PIL in voc_io); config dir via `CORE_NODE_CONFIG_DIR`/`DotCore.Common.AppPaths` (same as Python env/`~/.core_node`). **Optional parity gap:** the dot canvas currently does rectangles; polygon/ellipse/circle can be added to `dotapps/VocAnnotator` for full parity with the pycore canvas.

---

## 8. Cursor / AI rules and skill (summary)

- Code & comments English; ASCII-only in source.
- Follow the layout above: shared libs in `dotcore/`, apps in `dotapps/`; apps reference only dotcore (+ own sub-app lib); no cycles, no app→app refs.
- Namespaces: `DotCore.*` for libs, `DotApps.<AppName>` for apps.
- **Base rule:** [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc) (globs `dotcore/**`, `dotapps/**`).
- **UI rule:** [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc) — for WPF/MAUI/Blazor/Avalonia apps, follow §6 (Clean Architecture + MVVM + Fluent 2). On any UI/Presentation conflict, §6 + dot-ui.mdc win.
- **Skill:** [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md).

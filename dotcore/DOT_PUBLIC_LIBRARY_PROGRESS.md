# Dot Public Class Libraries (dotcore) – Progress and Mapping

**Public class libraries (公共类库)** in this repo means **pycore** (Python) and **dotcore** (.NET): shared, app-agnostic libraries under `pycore/` and `dotcore/`. **Sub-app class libraries (子app的类库)** are per-app code under `pyapps/<app>/` or `dotapps/<App>/` and are not shared across apps. Canonical definitions: [development-guides/PYCORE_PYAPPS_STRUCTURE.md](../development-guides/PYCORE_PYAPPS_STRUCTURE.md). **dotcore** is the .NET counterpart of **pycore**. Apps depend on the core layer only—they do not depend on each other.

This document (1) defines the **pycore ↔ dotcore** mapping, (2) lists **all** DotCore.* projects as the public class libraries, and (3) tracks implementation progress per library. When adding or changing any DotCore.* project, update this document.

**Norms:** [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md), [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc), [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md). All code and comments in **English**, **ASCII only** in source.

---

## 1. Public class libraries = pycore (Python) ↔ dotcore (.NET)

| Python (pycore) | .NET (dotcore) | Role |
|-----------------|----------------|------|
| **pycore/** (root) | **dotcore/** (root) | Public/shared class libraries only. No apps. |
| pyfoundations | DotCore.Foundations | Base types, BCL only; no third-party. |
| (constants, paths, global config – in pyfoundations or shared) | DotCore.Common | Constants, paths, global config. Depends on Foundations. |
| pyutils (common, hotkey, ocr, api, file, etc.) | DotCore.Utils | Shared utilities. May use third-party. Depends on Foundations, Common. |
| database | DotCore.Infrastructure | DB, file, network abstractions. Depends on Foundations, Common. |
| (UI Automation / inspect helpers) | DotCore.UIInspect | UI Automation (e.g. FlaUI). Optional third-party; no dotcore project refs. |
| (theme / semantic UI data – app theme in Python; shared token data in dot) | DotCore.UITheme | Theme data (colors, fonts, sizes); no WPF. For D3Check and other dotapps. |
| pyutils/voc_annotator (config, voc_io, annotation_io, project_config) | DotCore.VocAnnotator | VOC/JSON annotation IO, project config; logic 1:1 with pycore. |
| pyadb, pydevice, pylauncher, pythreadpool, pygvar, pyheartbeat, pyctl, callmodule | (Future or under Utils/Infrastructure) | Map to DotCore.Utils / DotCore.Infrastructure or new DotCore.* as needed. Not yet split in dot. |

**Rule:** All shared libraries used by any app belong in **dotcore**. Each subfolder under dotcore is one library (DotCore.\*). Apps under **dotapps** reference **only** dotcore; no app-to-app references.

**Logic 1:1 (not code copy):** Python capabilities are implemented in dot with the same behaviour and contracts; implementation uses .NET idioms (interfaces, events, System.Text.Json, etc.). See DOT_D3CHECK_SUBLIBRARIES for capability list; this progress doc lists the dot types that fulfil each.

---

## 2. All DotCore.* projects (the public class libraries)

| Project | Path | Role | Depends on | Status |
|---------|------|------|------------|--------|
| **DotCore.Foundations** | dotcore/DotCore.Foundations/ | Base types, BCL only | (none) | Implemented (see §4.1) |
| **DotCore.Common** | dotcore/DotCore.Common/ | Constants, paths | Foundations | Implemented (see §4.2) |
| **DotCore.Utils** | dotcore/DotCore.Utils/ | Shared utilities | Foundations, Common | Implemented (see §4.3) |
| **DotCore.Infrastructure** | dotcore/DotCore.Infrastructure/ | DB, file, network | Foundations, Common | Implemented (see §4.4) |
| **DotCore.UIInspect** | dotcore/DotCore.UIInspect/ | UI Automation (FlaUI) | (none) | Exists |
| **DotCore.UITheme** | dotcore/DotCore.UITheme/ | Theme data (colors, fonts, sizes); no WPF | (none) | Implemented (see §4.6) |
| **DotCore.VocAnnotator** | dotcore/DotCore.VocAnnotator/ | VOC/JSON annotation IO, project config | Foundations, Common | Implemented (see §4.7) |

**Sub-app characteristic libraries (子APP的特征类库):** D3-check domain types (path scanner, game interface data, Battle.net region/operations) live under **dotapps/d3check/D3CheckCore/** (namespace DotApps.d3check.Core), not in dotcore. See DOT_ARCHITECTURE.md.

Tests live under **dotcore/tests/** (e.g. DotCore.Foundations.Tests). They are part of the dotcore solution but are test projects, not public class libraries.

---

## 3. Build and solution

- **Build:** From repo root: `dotnet build dotcore/dotcore.sln`
- All DotCore.* projects above are included in `dotcore.sln`. Apps in dotapps reference them via `..\..\dotcore\DotCore.<Name>\DotCore.<Name>.csproj`.

---

## 4. Per-library progress (implemented or planned)

### 4.1 DotCore.Foundations

- **Role:** Base library; BCL only. Python counterpart: pyfoundations.
- **Status:** Implemented.
- **API:** `Guard.NotNull<T>`, `Guard.NotNullOrWhiteSpace`; `Result.Ok()`, `Result.Fail(message)`, `Result.ThrowOnFailure()`; **IMainThreadDispatcher** (Invoke(action)—logic 1:1 with root.after(0,f)); **IShutdownRequest** (Request(), IsShutdownRequested); **DefaultShutdownRequest**; **IEventHub** (Subscribe, Unsubscribe, Publish); **DefaultEventHub** (sync invoke); **AppEventIds** (AppExit, WindowShow, ExtensionMainStartMacro, etc.—logic 1:1 with Python event_signals); **ColorPrinter** (RegisterCallback(LogCallback), UnregisterCallback, ClearAllCallbacks; Green, Red, Yellow, Blue, Gray, White, Cyan, Debug, Info, Warn, Error, Success)—logic 1:1 with Python color_print.ColorPrint, no UI refs, callback (message, colorType, logLevel) for sub-apps to route to Log tab.
- **Refs:** .NET BCL; [C# nullable](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/nullable-reference-types); DOT_D3CHECK_SUBLIBRARIES §7 Event center, §8 Shutdown manager; pycore pyfoundations color_print.

### 4.2 DotCore.Common

- **Role:** Constants, paths, global config, i18n. Python: shared constants/paths, providor i18n_manager.
- **Status:** Implemented.
- **API:** `AppPaths.GetUserDataDirectory`, `AppPaths.GetConfigFilePath`; `CommonConstants.Utf8EncodingName`, `CommonConstants.JsonConfigExtension`; **II18nProvider** (GetCurrentLanguage, LoadLanguageFromConfig, GetUiText(key), SetLanguage, LanguageChanged event); **DefaultI18nProvider** (in-memory strings, SetStrings, SetString); **LanguageChangedEventArgs**.
- **Refs:** DOT_D3CHECK_SUBLIBRARIES §1 Config path, §2 i18n (load language, get_ui_text, language change notification).

### 4.3 DotCore.Utils

- **Role:** Shared utilities. Python: pyutils.
- **Status:** Implemented.
- **API:** `PathUtil.CombineFull`, `PathUtil.EnsureDirectoryExists`; `StringUtil.IsNullOrWhiteSpace`, `StringUtil.Coalesce`; **TimeUtil.MonotonicMilliseconds**, **TimeUtil.UnixSecondsUtc**, **TimeUtil.HasElapsed(lastTimeMs, intervalMs)** (debounce/throttle—logic 1:1 with Python time comparison); **ConfigChangeNotifier** (Subscribe(handler), NotifyConfigChanged(keyPath), Unsubscribe)—logic 1:1 with Python config_change_hub; **HotkeyUtil.NormalizeCanonical(string?)**—lowercase, no spaces, same as Python normalize_hotkey_canonical; **IGlobalHotkeyService** (Register(id, hotkeyCanonical, callback), Unregister(id), UnregisterAll()); **WindowsGlobalHotkeyService** (hwnd, IMainThreadDispatcher?)—RegisterHotKey impl, app must forward WM_HOTKEY (0x0312) to OnWmHotkey(wParam). **OCR (DOT_D3CHECK_SUBLIBRARIES §15):** **IOcrEngine** (Init(), Ocr(imagePath, gridPosition)); **OcrResult** (Text, RawResult, Offset, Region, GridPosition); **OcrWordBox** (Text, Position); **OcrHelper.GetResult**, **OcrHelper.HasAnyKeyword**, **OcrHelper.FindKeywordBoxes**; **PaddleOcrEngine** (PaddleOCRSharp, Windows x64). Windows native OCR (Windows.Media.Ocr) is implemented in Python (pycore ocr_windows_engine); .NET cannot reference WinRT winmd from a net8.0 or net8.0-windows library (NETSDK1130), so Windows native OCR is not in dotcore; apps may call PaddleOcrEngine or add WinRT OCR in app layer if needed.
- **Refs:** DOT_D3CHECK_SUBLIBRARIES §11 Hotkey registry, §18 one-shot/debounce, §20 Config change hub, §15 OCR.

### 4.4 DotCore.Infrastructure

- **Role:** File I/O, config store, future DB/network. Python: database and I/O, providor config.
- **Status:** Implemented.
- **API:** `IFileReadWriter` (ReadAllText, WriteAllText); `DefaultFileReadWriter`; **JsonKeyPathConfig** (Load(), GetValueSafe&lt;T&gt;(keyPath, default), GetStringSafe, SetValue(keyPath, value), Save(), QueueSave(), FlushPendingSave(), IsSavePending)—logic 1:1 with Python config: load from file, get/set by key path, thread-safe, optional queue save.
- **Refs:** DOT_D3CHECK_SUBLIBRARIES §1 Config (load, get/set by path, user config path, async save queue, thread safety); [System.Text.Json](https://learn.microsoft.com/en-us/dotnet/api/system.text.json).

### 4.5 DotCore.UIInspect

- **Role:** UI Automation (e.g. FlaUI). Python: UI inspection / automation helpers.
- **Status:** Project exists; contains FlaUI-based helpers.

### 4.6 DotCore.UITheme

- **Role:** Theme data only: semantic color keys/values (hex), font keys (family, size, bold), size keys (padding, border). No WPF/WinForms. Python: theme data lives in app (e.g. d3-check ui/theme/theme.py); dot centralizes shared token data here for D3Check and other dotapps.
- **Status:** Implemented.
- **API:** `ThemeColorKeys`, `ThemeColors.Get`/`GetAll`; `ThemeFontKeys`, `ThemeFontInfo`, `ThemeFonts.Get`/`GetAll`; `ThemeSizeKeys`, `ThemeSizes.Get`/`GetAll`; `UITheme.GetColor`/`GetFont`/`GetSize`.
- **Consume:** Add `ProjectReference` to `DotCore.UITheme` from a dotapp; use `UITheme.GetColor(ThemeColorKeys.BgDark)` etc. to build WPF/WinForms resources at startup.
- **Refs:** [pyapps/d3-check/docs/DOT_D3CHECK_UI_LIBRARY.md](../pyapps/d3-check/docs/DOT_D3CHECK_UI_LIBRARY.md), [pyapps/d3-check/ui/theme/theme.py](../pyapps/d3-check/ui/theme/theme.py).

### 4.7 DotCore.VocAnnotator

- **Role:** VOC/JSON annotation IO and project config. Python: pycore/pyutils/voc_annotator.
- **Status:** Implemented.
- **API:** **VocIo** (VocBox, ReadBoxesFromVoc, WriteVocXml); **VocAnnotatorConfig** (Load/SaveConfig, Get/SetZoomPercent, Get/SetLastImagesDir, Get/SetLastSaveDir); **ProjectConfig** (LoadProjectConfig, SaveProjectConfig, GetClassesFromConfig); **AnnotationIo** (ShapeToBbox, ShapesToBoxes, BoxesToShapes, LoadAnnotations, SaveAnnotations; shape_type rectangle/polygon/ellipse/circle); **VocAnnotatorLauncher** (ResolveVocAnnotatorExe, Launch(imagesDir, projectPath, hintAppBaseDir)—logic 1:1 with Python flow3_open_label_tool / _launch_voc_annotator_subprocess).
- **App:** dotapps/VocAnnotator (WPF): Open images dir, set save dir, image list, canvas (image + rectangles), class list, add rectangle by drag, Save (JSON + VOC). Accepts CLI: first path = images dir, `--project-path &lt;dir&gt;` = save/project dir.
- **Consume from d3check:** Calibration tab "Open label" calls VocAnnotatorLauncher.Launch with project path from config; VocAnnotator.exe started as separate process.
- **Refs:** [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md), pycore/pyutils/voc_annotator.

---

## 5. Document and tool references

When developing dotcore, use:

| Resource | Purpose |
|----------|---------|
| [.NET documentation (Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/) | SDK, C#, BCL, project format. |
| [C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/) | Language, nullable, attributes. |
| [development-guides/PYCORE_PYAPPS_STRUCTURE.md](../development-guides/PYCORE_PYAPPS_STRUCTURE.md) | Canonical definitions: 公共类库 (pycore) vs 子app的类库 (pyapps/<app>/). |
| [pycore/](../pycore/) | Python public class libraries (公共类库). dotcore mirrors this layer. |
| [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md) | Dot layout, naming, dependencies. |
| [dotcore/DESIGN.md](DESIGN.md) | Dotcore project list and roles. |
| [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc) | Cursor rule: English, ASCII, layout. |
| [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md) | UI (WPF/MAUI/Blazor/Avalonia): canonical spec – Clean Architecture + MVVM + Fluent 2. |
| [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc) | Cursor rule for dotapps UI layer. |
| [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md) | How to add lib/app, ref paths. |
| [pyapps/d3-check/docs/DOT_D3CHECK_*.md](../pyapps/d3-check/docs/) | **Differential/requirements:** D3Check port (UI, sub-libraries, controllers); dot implements same capabilities in .NET. |

**Summary:** 公共类库 = pycore (Python) = dotcore (.NET). All DotCore.* projects are the public class libraries. Implemented (logic 1:1 with Python, not code copy): **Foundations** (Guard, Result, IMainThreadDispatcher, IShutdownRequest, DefaultShutdownRequest, IEventHub, DefaultEventHub, AppEventIds); **Common** (AppPaths, CommonConstants, II18nProvider, DefaultI18nProvider, LanguageChangedEventArgs); **Utils** (PathUtil, StringUtil, TimeUtil, ConfigChangeNotifier); **Infrastructure** (IFileReadWriter, DefaultFileReadWriter, JsonKeyPathConfig); **UITheme** (theme data); **VocAnnotator** (VocIo, VocAnnotatorConfig, ProjectConfig, AnnotationIo). Extend DotCore.* per DOT_ARCHITECTURE and DOT_D3CHECK_* requirements so dotapps depend only on dotcore.

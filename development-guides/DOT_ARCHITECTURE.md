# Dot Architecture (dotcore + dotapps)

Canonical spec for the .NET "dot" stack. **dotcore/** = .NET public class libraries (counterpart of **pycore**). **dotapps/** = runnable apps, one per folder. Sub-app libraries live under `dotapps/<App>/` (e.g. `dotapps/d3d4tester/D3D4TesterCore/`) and are never shared. Related: [PYTHON_PYCORE.md](PYTHON_PYCORE.md), [dotcore/DESIGN.md](../dotcore/DESIGN.md), [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md).

## 1. Placement and dependencies
- Generic logic (paths, strings, hotkeys, crypto, OCR, image ops, window/input, screen capture, template matching, YOLO/ONNX) → `dotcore/DotCore.<Name>`. App domain (config keys, UI, flows, game rules) → `dotapps/<App>/`.
- Direction: apps → dotcore, DAG only. No dotcore → dotapps, no app → app.
- Libraries: folder = csproj = namespace `DotCore.<Name>`. Apps: folder = assembly name, root namespace `DotApps.<app>`.

## 2. UI apps (WPF): Clean Architecture + MVVM + Fluent 2
- Layers: `Domain/` → `ApplicationServices/` → `Infrastructure/`; Presentation depends on ApplicationServices, not Infrastructure.
- Presentation: `Pages/<Feature>/<Feature>Page.xaml`, `ViewModels/<Feature>ViewModel.cs`, `Components/`, `Windows/`, `Services/`, `Converters/`, `Assets/Styles/` (Themes/Dark|Light, Motion). `MainWindow` is the shell; tabs host Pages.
- Names: `I<Name>Service`, `<Action>Command`, `<Method>Async`.
- Colors/fonts/sizes come from theme resources (`DotCore.UITheme`), never inline hex in pages.
- Styles (Fluent 2, `DotCore.UITheme/Themes`): `AppTheme.xaml` (Tokens + default palette) → `AppStyles.xaml` → app `Assets/Styles` (Overrides, `Themes/Dark|Light.xaml`, Motion). Brushes via `DynamicResource` (live dark/light switch through `ThemeManager` / app `ThemeService`, saved in `ui_settings.theme`); tokens via `StaticResource`. No implicit TextBlock style: text inherits Foreground/Font from the window.
- Tabbed shell windows use `ShellWindowStyle`; dialogs and single-window tools use `DialogWindowStyle`; chrome, backdrop (Mica), tray and theme switching come only from `DotCore.UITheme` (`WindowChromeBehavior`, `WindowBackdrop`, `ThemeManager`, `Tray/*`), never app-local copies.
- Group controls in cards (`CardBorderStyle` + `SectionHeaderTextStyle`), labels/inputs on a grid; state colors only via semantic Success/Warning/Danger/Info styles; simple icons are Segoe Fluent glyphs (`IconButtonStyle`/`IconTextStyle`), not image files.

| Kind | Keys |
|---|---|
| Buttons | `PrimaryButtonStyle`, `SecondaryButtonStyle` (default), `SubtleButtonStyle`, `SuccessButtonStyle`, `WarningButtonStyle`, `DangerButtonStyle`, `InfoButtonStyle`, `IconButtonStyle` (glyph content), `HyperlinkButtonStyle`, `TitleBarButtonStyle`, `TitleBarCloseButtonStyle`; CheckBox `ToggleSwitchStyle` |
| Text | `TitleTextStyle`, `SubtitleTextStyle`, `SectionHeaderTextStyle`, `BodyTextStyle`, `BodyStrongTextStyle`, `CaptionTextStyle`, `FieldLabelTextStyle`, `MutedTextStyle`, `SecondaryTextStyle`, `MonoTextStyle`, `IconTextStyle` |
| Containers | `CardBorderStyle`, `CardSecondaryBorderStyle`, `InsetBorderStyle`, `ToolbarPanelStyle` (Border); GroupBox/Expander render as cards |
| Status | `StatusChipStyle`, `StatusChipSuccessStyle`, `StatusChipWarningStyle`, `StatusChipDangerStyle`, `StatusChipInfoStyle` (Border wrapping a TextBlock) |
| Inputs | `MonoLogTextBoxStyle`; `theme:ControlAssist.Placeholder` |
| Windows/tabs | `ShellWindowStyle`, `DialogWindowStyle`, `ShellTabControlStyle` |
| Brushes | `WindowBackground`, `LayerFill`, `CardBackground(Secondary)`, `CardStroke`, `InsetBackground`, `Divider`, `ControlFill(Hover/Pressed)`, `ControlStroke`, `Text{Primary,Muted,Tertiary,Disabled}`, `Accent(Hover/Pressed/Text)`, `{Success,Warning,Danger,Info}{,Hover,Pressed,Subtle,Text}` + `Brush`; legacy d3check keys kept |
| Tokens | `Spacing{XS,S,M,L,XL}` / `Thickness*` (4/8/12/16/24), `CardPadding`, `CardMargin`, `FieldMargin`, `PageMargin`, `ControlCornerRadius` (4), `CardCornerRadius` (8), `FontSize{Caption,Body,BodyLarge,Subtitle,Title}`, `UiFontFamily`, `MonoFontFamily`, `IconFontFamily` |

## 3. Configuration and runtime state
- Persistent config: Options pattern. Read with `ConfigOptionsProvider.GetOptions<T>()`; write with `<App>ConfigService.SetValueAsync` + `QueueSave`. Key paths are constants in `Constants/ConfigKeys.<Area>.cs` (`partial class ConfigKeys`), one file per feature area.
- Control ↔ config binding goes only through `Config/ConfigBinding` (`Bind*` / `Save*` / `Parse*`); pages keep no own save helpers.
- Runtime state: one global state center per app (snapshot + callbacks; feature sections such as D4 hang off it), never duplicated per page or per service; flow-switch classes are views over it, setters return "changed" so writers notify once.
- Each external entity (client process, game window, region, path validity) has exactly one detector/controller type; callers use it or the center's cached flag, never their own `Process`/window lookups. Launch is idempotent: detect first, act only when missing.
- A ported app keeps reading the same user config file as its Python twin with the identical JSON schema, so both stay interchangeable.
- Periodic work registers on the app's single 1 s clock `TickDriver` (every tick; flow step %2, smart echo %3, inactive refresh %10); no ad-hoc timers or poll loops. Exceptions: `DispatcherTimer` for UI-local debounce/drain, and a dedicated loop only where the Python twin has its own thread period (e.g. D4 3 s `D4TickLoop`).
- New shared runtime state is registered in the app's `Core/InMemoryCentersCatalog`.
- One definition per value: config key paths only in the sub-app library `ConfigKeys` (so the app and its Core share them), shared enum-like values (regions, client states, folder names, file timestamp formats) only once in Core; other places reference them, never re-declare the literal.
- Config defaults live in one embedded JSON (`Config/default_config.json`) written as the user config on first run and merged (missing keys only) at every start; code never keeps a second set of defaults, every UI change is written back immediately.

## 4. i18n
- Layout 1:1 with Python `providor/i18n`: `I18n/i18n_base.json` (languages and ordered `files` list) + `I18n/i18n_<area>_<lang>.json`, merged in order. App-only keys go in `i18n_dot_<lang>.json`.
- Keys are `ui.<area>.<key>`; constants live in `Constants/I18nKeys.<Area>.cs` (`partial class I18nKeys`), one file per feature area.
- No user-facing literal in code. Every key exists in every language file.

## 5. Porting from Python (1:1)
- Port behavior, not code: same branches, constants, timings, and log texts. Each type's summary names its source: `1:1 Python <path>`.
- Two-way cross-references: each C# file starts with `// PY-REF: <python path>` (or `// PY-REF: none (DOT-only)`); the app's Python reference copy (`dotapps/<app>/reference/`) marks each `.py` with `# DOT-REF: <C# path>`.
- Where Python has a bug, implement the intended behavior and note `Fixes Python bug: ...` in one line.
- Third-party mapping: OpenCV → OpenCvSharp4; cnocr → `DotCore.Utils/Ocr` (PaddleOCRSharp via `OcrEngineRegistry` task→model); pyautogui/win32 input → `DotCore.Utils/Input` (`ClickHandler`, `FieldInput`); pywinauto/uiautomation → `DotCore.UIInspect` (FlaUI); Flask bridge → `DotCore.Infrastructure/Http/LocalJsonHttpHost`; GameAISDK record → `DotCore.YoloRecord`; YOLO `.pt` → ONNX via Microsoft.ML.OnnxRuntime; tkinter → WPF; threads/timers → `TickDriver` (see §3) or `Task`.
- Generic primitives land in dotcore first; the app only wraps them with domain config (e.g. `D3ScaledTemplateMatcher` over `ScaledTemplateMatcher`).
- Debug/test buttons register in the app's `Services/TestActionRegistry` under their i18n key.
- Python dead code (`_obsolete_*`, unreachable from `main.py`) and one-off dev scripts are not ported; each app records this in `docs/PY_DOT_PORT_MAP.md`.

## 6. Files, build, verification
- Directory names must not match `.gitignore` patterns case-insensitively (e.g. `log/`, `logs/`, `bin/`, `obj/`). Check with `git -c core.ignorecase=true check-ignore -v <path>`.
- Run/build through `dotapps/<app>/scripts/start.ps1` (Windows) / `start.sh` (Linux): shared shell libs (`win_common`, `linux/common`), prerequisites from `dotapps/<app>/scripts/prereqs.conf` (plain `|` records read natively by bash/PowerShell, no Python or JSON tooling; each row maps to the platform installer step `install_shells/NN_*.sh` / `install_powershells/StepNN_*.ps1`; start never detects or verifies, it runs each applicable installer once per run and the idempotent installer owns detection; optional ones with `--with-optional`/`-WithOptional`; non-CLI items listed under `manual` print install steps and never block), restore only when a `*.csproj`/`Directory.*.props`/`nuget.config` is newer than `obj/<app>/project.assets.json` (stamp refreshed after restore), artifacts in `<CN_CACHE_ROOT>/dotnet-artifacts/<app>`; build-only/no-watch run one incremental build, watch mode leaves the single build to `dotnet watch --no-restore` (hot reload). Re-running with nothing changed does no restore and no extra build. Flags: `-BuildOnly`/`--build-only`, `-NoWatch`/`--no-watch`, `-Configuration`/`-c`. `start.sh` delegates to `start.ps1` in WSL with Windows interop, otherwise builds once and exits with a note that WPF needs Windows; `--watch` opts into a Linux watch-build (compile check only). With the optional `wine-wpf` prerequisite (Wine + .NET 8 Windows Desktop Runtime in a per-user prefix under `<CN_CACHE_ROOT>/wine`, installed by step 57 with `START_DOTNET_WPF_WINE`) and a display, `start.sh` builds `-r win-x64 --self-contained false`, runs the exe under Wine and rebuilds and restarts it on source change (inotifywait, mtime polling fallback); in-process hot reload stays Windows-only.
- Manual build: `dotnet build dotapps/<app>/<app>.csproj` (Linux: add `-p:EnableWindowsTargeting=true`, compile-only).
- For parallel or agent builds, use `--artifacts-path <scratch dir>` per builder so no `bin/obj` lands in the source tree and builds do not collide.
- All code, comments, and logs in English; ASCII in source except i18n JSON.

# Dot Architecture (dotcore + dotapps)

Canonical spec for the .NET "dot" stack. **dotcore/** = .NET public class libraries (counterpart of **pycore**). **dotapps/** = runnable apps, one per folder. Sub-app libraries live under `dotapps/<App>/` (e.g. `dotapps/d3d4tester/D3D4TesterCore/`) and are never shared. Related: [PYCORE_PYAPPS_STRUCTURE.md](PYCORE_PYAPPS_STRUCTURE.md), [dotcore/DESIGN.md](../dotcore/DESIGN.md), [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md).

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
- Persistent config: Options pattern. Read with `ConfigOptionsProvider.GetOptions<T>()`; write with `<App>ConfigService.SetValueAsync` + `QueueSave`. Key paths are constants in `Constants/ConfigKeys*.cs`.
- Runtime state: one in-memory source (snapshot + callbacks), never duplicated per page.
- A ported app keeps reading the same user config file as its Python twin, so both stay interchangeable.

## 4. i18n
- Layout 1:1 with Python `providor/i18n`: `I18n/i18n_base.json` (languages and ordered `files` list) + `I18n/i18n_<area>_<lang>.json`, merged in order. App-only keys go in `i18n_dot_<lang>.json`.
- Keys are `ui.<area>.<key>`; constants live in `Constants/I18nKeys.<Area>.cs` (`partial class I18nKeys`), one file per feature area.
- No user-facing literal in code. Every key exists in every language file.

## 5. Porting from Python (1:1)
- Port behavior, not code: same branches, constants, timings, and log texts. Each type's summary names its source: `1:1 Python <path>`.
- Third-party mapping: OpenCV → OpenCvSharp4; YOLO `.pt` → ONNX via Microsoft.ML.OnnxRuntime; cnocr → `DotCore.Utils.Ocr.Windows`; tkinter → WPF; threads/timers → `Task`/`DispatcherTimer`/`System.Threading.Timer`.
- Debug/test buttons register in the app's `Services/TestActionRegistry` under their i18n key.
- Python dead code (`_obsolete_*`, unreachable from `main.py`) and one-off dev scripts are not ported.

## 6. Files, build, verification
- Directory names must not match `.gitignore` patterns case-insensitively (e.g. `log/`, `logs/`, `bin/`, `obj/`). Check with `git -c core.ignorecase=true check-ignore -v <path>`.
- Build on Windows: `dotnet build dotapps\<app>\<app>.csproj`. On Linux: add `-p:EnableWindowsTargeting=true` (compile-only; WPF does not run on Linux).
- For parallel or agent builds, use `--artifacts-path <scratch dir>` per builder so no `bin/obj` lands in the source tree and builds do not collide.
- All code, comments, and logs in English; ASCII in source except i18n JSON.

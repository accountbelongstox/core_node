# D3Check Dot UI Theming (Beautification)

This document describes the **official WPF approach** to styling, the **Python (Tk) theme** used by d3-check, and the **derived dot beautification** for the .NET port.

---

## 1. Official WPF approach (Microsoft Learn)

- **Styles and templates**: [Styles and templates overview](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/styles-templates-overview) — styles apply a set of property values to elements; templates define the visual tree of a control. Declare styles as resources in `Resources` (e.g. `Window.Resources` or `Application.Resources`).
- **Resources**: [XAML resources overview](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/systems/xaml-resources-overview) — brushes and styles are resources with a unique `x:Key`. Use `StaticResource` or `DynamicResource` to reference them. Resources can be merged from external XAML via `ResourceDictionary.MergedDictionaries`.
- **Single theme at app level**: Merge a theme `ResourceDictionary` into `Application.Resources` so all windows and controls inherit. Define semantic **brushes** (e.g. `BackgroundPrimaryBrush`) and **styles** (implicit by `TargetType` or explicit by `x:Key`). Use `BasedOn` to extend styles.
- **ControlTemplate**: For full control look (e.g. Button), set `Control.Template` in a Style; put `ControlTemplate.Triggers` as a direct child of `ControlTemplate`, not inside the root visual (e.g. Border).

---

## 2. Python (Tk) theme and unified styles

- **UITheme** (`ui/theme/theme.py`): Single entry — `apply_to_root(root)` sets root `bg=bg_dark`, switches ttk to `clam`, and configures all ttk styles (TNotebook, TNotebook.Tab, TFrame, TButton, TEntry, TCombobox, TCheckbutton, TLabel, TSpinbox, TProgressbar, Dark.TNotebook). **COLORS** dict: bg_primary/secondary/tertiary/dark/light/hover, text_primary/secondary/tertiary/dark/accent/success/warning/error, btn_primary/secondary/success/danger/accent/info (+ hover), input_bg/text/border/focus, border_*, separator, panel_border, tab_unselected/selected bg and fg, accent/blue/cyan/red/orange/green. **FONTS**: title, body, button, code (Arial 9, Consolas 9). **SIZES**: padding_small/medium/large, border_width, etc.
- **UnifiedStyles** (`ui/unified_styles.py`): Merges extra **COLORS** (primary, secondary, panel_bg, tab_bg/tab_active/tab_text, success, warning, error, info). **FONTS**: Segoe UI 9, Consolas 9. **SPACING** and **PADDING** tokens (xs/sm/md/lg/xl/xxl). Single style entry remains UITheme; panels read one palette (UITheme + UnifiedStyles extras).

---

## 3. Derived dot beautification (what dot should do)

Aligned with [DOT_D3CHECK_UI_LIBRARY.md §2](DOT_D3CHECK_UI_LIBRARY.md#2-theme-and-styling-requirements): one theme applied once at startup; semantic tokens only; map to WPF resources.

| Aspect | Dot implementation |
|--------|--------------------|
| **Theme entry** | Merge `Themes/AppTheme.xaml` and `Themes/AppStyles.xaml` into `Application.Resources` in `App.xaml` (single load at startup). |
| **Semantic brushes** | `AppTheme.xaml`: SolidColorBrush resources for BackgroundPrimary/Secondary/Tertiary/Dark/Light/Hover, PanelBackground, PanelHeader; TextPrimary/Secondary/Tertiary/Muted/Dark/Accent/Success/Warning/Error; ButtonPrimary/PrimaryHover/Secondary/Success/Danger/Accent/Info; InputBackground/Text/Border/FocusBorder; BorderPrimary/Subtle/Separator/PanelBorder; TabUnselected/Selected background and foreground; AccentDefault/Blue/Cyan/Red/Orange/Green. Colors match Python UITheme + UnifiedStyles (e.g. #1a1a2e, #16213e, #0a0a0a, #e0e0e0, #00d4ff, #4CAF50, #2a2a3e, #4C566A, #ECEFF4). |
| **Implicit styles** | `AppStyles.xaml`: Default Style for TextBlock (TextPrimary, Segoe UI 12), Button (ButtonPrimary, template with hover/disabled triggers), TextBox (InputBackground/Text/Border), ComboBox (input colors), CheckBox, RadioButton. Keyed styles: TitleTextStyle, MutedTextStyle, SuccessButtonStyle. |
| **Usage in views** | Replace hardcoded hex (e.g. `#252525`, `#ddd`, `#333`) with `{StaticResource PanelBackgroundBrush}`, `{StaticResource TextPrimaryBrush}`, `{StaticResource InputBackgroundBrush}`, etc. Main window and panels reference theme resources; no inline colors for themeable surfaces. |
| **Fonts and spacing** | Fonts: Segoe UI 12 (body), 14 (title); code: Consolas. Spacing/padding can be added as resource keys (e.g. SpacingSm, PaddingMd) and used in styles or panels as needed. |

**Done in this pass**: AppTheme.xaml (all brushes), AppStyles.xaml (TextBlock, Button with template, TextBox, ComboBox, CheckBox, RadioButton; keyed Title/Muted/Success). App.xaml merges both. MainWindow and MainPanel use theme resources; other panels can be updated the same way.

**Optional later**: TabItem header style (selected/unselected colors); DataGrid row/cell styles; full ComboBox dropdown template; spacing/padding as shared thickness resources.

---

## 4. Reference

- WPF: [Styles and templates](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/styles-templates-overview), [XAML resources](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/systems/xaml-resources-overview), [How to create a style](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/how-to-create-apply-style).
- Python: `pyapps/d3-check/ui/theme/theme.py` (UITheme), `pyapps/d3-check/ui/unified_styles.py` (UnifiedStyles).
- Dot: `dotapps/d3check/Themes/AppTheme.xaml`, `dotapps/d3check/Themes/AppStyles.xaml`, `dotapps/d3check/App.xaml`.

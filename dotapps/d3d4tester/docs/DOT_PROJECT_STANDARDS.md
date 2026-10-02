# d3d4tester Project Standards

Canonical rules: [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md). This file only states how d3d4tester applies them. Progress, config vs in-memory centers, code conventions: [DOT_UI_PROJECT_STANDARDS_PROGRESS.md](DOT_UI_PROJECT_STANDARDS_PROGRESS.md). Python→C# map: [PY_DOT_PORT_MAP.md](PY_DOT_PORT_MAP.md).

## Layout

| Path | Content |
|------|---------|
| `d3d4tester.csproj` | WPF app, namespace `DotApps.d3d4tester`; Python twin `pyapps/d3-check` |
| `D3D4TesterCore/` | Sub-app library `DotApps.d3d4tester.Core`: game data, Battle.net (`Battlenet/`), ROSBOT, D3 assistant (`Bag/`, `Kanai/`, `Blacksmith/`), D4 pipeline (`D4/`), tick flows (`Flow/`) |
| `Pages/{Main,Rosbot,D4,Calibration,RunLog}/` | Tab pages (tab order = `AppConstants.TabIndex*`) |
| `ViewModels/`, `Components/`, `Windows/`, `Converters/`, `StatusBar/` | Presentation |
| `Ctl/` | Flow/feature controllers (ROSBOT task processor, status providers, assistant, D4 tick loop) |
| `Services/` | App services (tray, HTTP bridge, event center, shutdown, theme, `TestActionRegistry`, ROSBOT log pipeline) |
| `Config/` | `D3D4TesterConfigService`, `ConfigOptionsProvider`, `ConfigBinding`, Options POCOs |
| `Constants/` | `ConfigKeys.<Area>.cs`, `I18nKeys.<Area>.cs` (partial classes), `AppConstants` |
| `I18n/` | i18n JSON + `D3D4TesterI18n` |
| `Assets/Styles/` | `AppOverrides.xaml`, `Motion.xaml`, `Themes/{Dark,Light}.xaml` |
| `Core/InMemoryCentersCatalog.cs` | Inventory of shared runtime state |
| `scripts/start.{ps1,sh}` | Build/run entry (stops a previous run of this project, no MSBuild node reuse, auto-restart on rude edit) |
| `tools/BnProbe`, `scripts/bnprobe.ps1` | Dev probe: idempotent build + passive live scan of the Battle.net client with the app's own detectors (`-WatchSeconds N` to repeat); excluded from the app build |

## Rules

- **Config:** user config shared with Python (same schema). Read `ConfigOptionsProvider.GetOptions<T>()`; write `D3D4TesterConfigService.Instance.SetValueAsync` + `QueueSave()`; controls bind via `ConfigBinding` only.
- **i18n:** `I18n/i18n_base.json` lists languages (`zh` default, `en`) and the ordered `files`; each area has `i18n_<area>_{zh,en}.json` (main_window, skill_config, auxiliary_panel, rosbot_panel, d4_panel, log_panel, tabs, common, errors, dot). Keys `ui.<area>.<key>` in both languages.
- **Ticks:** flows and polling register on `D3D4TesterCore/Flow/TickDriver` (1 s); D4 farming/debug uses `Ctl/D4TickLoop` (3 s, as Python).
- **Debug buttons:** handlers register in `Services/TestActionRegistry` under the button i18n key; RunLog page invokes them.
- **Theme/UI:** `DotCore.UITheme` styles and brushes only (`DynamicResource` brushes, `StaticResource` tokens); `MainWindow` = `ShellWindowStyle`, dialogs = `DialogWindowStyle`; dark/light toggle via `Services/ThemeService` (saved in `ui_settings.theme`).

## Build and run

```bash
dotapps/d3d4tester/scripts/start.sh            # Linux: WSL → delegates to start.ps1; else watch-build (compile only)
```
```powershell
.\dotapps\d3d4tester\scripts\start.ps1         # Windows: SDK check, restore, build, dotnet watch run
```
Flags: `-BuildOnly`/`--build-only`, `-NoWatch`/`--no-watch`, `-Configuration`/`-c Debug|Release`. Artifacts go to `<CN_CACHE_ROOT>/dotnet-artifacts/d3d4tester`.

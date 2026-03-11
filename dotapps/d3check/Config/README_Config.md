# D3Check Config (sub-app library)

Config load, save, and get/set by key path for the D3Check WPF app. Matches Python behavior (CONFIG_USER_PATH, merge template, thread-safe, async save). **Not** a shared dotcore library; lives under `DotApps.d3check.Config`.

## Usage

- **Startup**: `D3CheckConfigService.Instance.Load()` is called from `App_Startup` (already wired).
- **Read (thread-safe)**: `D3CheckConfigService.Instance.GetValueSafe<string>(ConfigKeys.UiSettingsWindowGeometry, AppConstants.DefaultWindowGeometry)`
- **Write from UI (non-blocking)**: `D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsWindowGeometry, "800x600+50+50");` then optionally `QueueSave()` if you batch multiple sets.
- **Explicit save**: `D3CheckConfigService.Instance.QueueSave()` to coalesce pending writes; or `Save()` on a background thread (service uses a save worker when you call `QueueSave()`).
- **Blocking set (tests only)**: `SetValueSafe(keyPath, value)` then `Save()`.

Use constants from `ConfigKeys` (e.g. `ConfigKeys.MacroConfigsAuxiliaryConfig`) so keys stay in sync with Python and UI.

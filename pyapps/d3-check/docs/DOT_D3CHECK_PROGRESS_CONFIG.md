# D3Check Dot Port: CONFIG Progress (sub-app library)

Progress document for the **D3Check sub-app CONFIG library** (generate, save, update). Implemented in `dotapps/d3check/` per [DOT_ARCHITECTURE](../../../development-guides/DOT_ARCHITECTURE.md) and [DOT_D3CHECK_SUBLIBRARIES](DOT_D3CHECK_SUBLIBRARIES.md) §1. Logic follows Python (providor_index, unified_config, config_change_hub) **by behavior**, not by code copy.

---

## 1. Scope

- **Where**: `dotapps/d3check/Config/` and `dotapps/d3check/Constants/ConfigKeys.cs`. **Not** in dotcore (app-specific keys and paths).
- **What**: Load config from user file, get/set by key path, merge with template (missing keys only), thread-safe access, coalesced async save for UI.

---

## 2. Implemented

| Item | Status | Notes |
|------|--------|------|
| Config paths | Done | `ConfigPaths.CurrentUserDataPath`, `ConfigPaths.ConfigUserPath` = `{UserData}/d3check_config.json` (same as Python) |
| Load at startup | Done | `D3CheckConfigService.Instance.Load()` in `App_Startup`; creates dir and default file if missing |
| Get by key path | Done | `GetValueSafe<T>(keyPath, default)`; thread-safe, dot notation (e.g. `ui_settings.window_geometry`) |
| Set (blocking) | Done | `SetValueSafe(keyPath, value)` for tests/sync use |
| Set (async for UI) | Done | `SetValueAsync(keyPath, value)` + `QueueSave()`; no main-thread block |
| Merge with template | Done | On load and before save: merge default template into config (add missing keys only); user values kept |
| Coalesced save | Done | Background save worker; multiple `QueueSave()` coalesced into one write |
| Key path constants | Done | `ConfigKeys` (UiSettingsWindowGeometry, MacroConfigsCurrentSkillConfig, HotkeyConfigPathAuxiliary, etc.) for UI/controller alignment |
| Default template | Done | In-code default with `ui_settings`, `macro_configs` (current_skill_config, skill_configs, auxiliary_config) |

---

## 3. Files

| Path | Purpose |
|------|---------|
| `dotapps/d3check/Constants/ConfigKeys.cs` | Key path constants (align with Python and UI) |
| `dotapps/d3check/Config/ConfigPaths.cs` | User data dir and config file path |
| `dotapps/d3check/Config/D3CheckConfigService.cs` | Singleton: Load, Save, GetValueSafe, SetValueSafe, SetValueAsync, QueueSave, merge logic |
| `dotapps/d3check/Config/README_Config.md` | Usage for UI and controllers |
| `dotapps/d3check/App.xaml.cs` | Calls `D3CheckConfigService.Instance.Load()` on startup |

---

## 4. Python logic referenced (no code copy)

- **Paths**: `CONFIG_USER_PATH` = `{CURRENT_USER_DATA_PATH}/d3check_config.json`; user data dir created if missing.
- **Load**: First run: sync (create file from template if missing), then load file; later: optional force reload with sync.
- **Get/Set**: Dot path (e.g. `macro_configs.auxiliary_config`); thread-safe via config worker in Python; dot uses lock + background save task.
- **Merge**: Recursive merge template into config/user file: only add missing keys; existing user values unchanged.
- **Async save**: UI calls set + queue save; one writer coalesces multiple requests into one file write.

---

## 5. UI alignment (implemented)

- **Same config file as Python**: `ConfigPaths.ConfigUserPath` = `{UserProfile}/.core_node/.d3check/d3check_config.json`. Dot and Python use the same path; UI and config stay in sync across runs.
- **MainWindow**: Loads geometry on Loaded, saves on Closing. Format `WxH+X+Y` matches Python.
- **MainPanel**: Skill config ComboBox (config1–config4), macro/assistant hotkeys, animation speed, game language, bag offset, all auxiliary checkboxes — load from config on Loaded, write on change via `SetValueAsync` + `QueueSave`.
- **RosbotPanel**: ROS directory, Battlenet path, D3 path, auto-enable latest ROS, pickup blood shards, prevent stuck — same pattern.
- **LogPanel**: Show DEBUG, auto-scroll, log level — same pattern.
- All key paths in `ConfigKeys`; no magic strings in panels.

---

## 6. Next (optional)

- **Config change hub (dot)**: Subscribe/notify on key path (e.g. `macro_configs.auxiliary_config` → hotkey rebind; `macro_configs` → refresh macro loader). Can be added as a separate type in `Config/` that subscribes to config changes and invokes callbacks on UI thread.
- **Skill table binding**: Main panel skill rows (skill1–potion) can be bound to `macro_configs.skill_configs.{current}.skills.{skillKey}.key|strategy|interval|delay|random_delay` with control names or a small view model.
- **Richer default template**: Optional embedded `template_config.json` (same as Python) for full key set; current in-code default covers ui_settings, macro_configs, ros_settings, battlenet, d3, log_settings, ui_analysis, anti_stuck, rosbot for UI binding.

---

## 7. References

- [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)
- [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc)
- [DOT_D3CHECK_SUBLIBRARIES.md](DOT_D3CHECK_SUBLIBRARIES.md) §1 Config
- [DOT_D3CHECK_VERIFICATION_REPORT.md](DOT_D3CHECK_VERIFICATION_REPORT.md)
- Python: `pyapps/d3-check/providor/providor_index.py` (CONFIG, load_config, get_config_value_safe, set_config_value_async, queue_config_save, merge_template_to_config, sync_config)

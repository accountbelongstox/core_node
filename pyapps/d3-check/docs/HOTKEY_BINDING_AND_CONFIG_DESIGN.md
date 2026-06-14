# Hotkey Binding and Config Sync — Design Requirements

**References:** Official technical implementation (keyboard library) in §7 is based on [boppreh/keyboard](https://github.com/boppreh/keyboard) (README + API + `keyboard/__init__.py`). **MCP:** Invoked for official docs; no MCP resources were configured, so content was fetched via web. Design gaps identified below (§8) are from comparing this doc to the official API and the current codebase.

## 1. Purpose

Unify hotkey behavior: **load from config at app start**, **rebind immediately when config changes**, and **one binding per function** (key ↔ function). All HotkeyInput-backed functions (assistant macro, combat macro, quick switch, potion, skill1–4) follow the same flow: UI change → config update → apply/rebind.

### 1.1 Variable hotkeys, immediate effect

- **Hotkeys are variable**: every hotkey (assistant, combat, quick_switch, potion, skill1–4) can be changed in the UI.
- **Change takes effect immediately**: after the user edits a HotkeyInput and presses a key (or clears), the new value is written to CONFIG, `notify_config_changed` is called, and the system **immediately** updates:
  - **Global hotkeys** (assistant, combat): unregister old key, register new key (no restart).
  - **Per-config keys** (quick_switch, potion, skills): macro config loader is refreshed; the next macro tick uses the new key.
- No “Apply” or “Save” step is required for hotkeys; **single edit → single key update → immediate effect**.

### 1.2 Config by group and by single key

- **Config is applied in groups** (一组一组换): the effective binding set is not “one key” but **one group** at a time.
  - **Auxiliary group**: `macro_configs.auxiliary_config` — two global hotkeys (assistant_hotkey, macro_start_hotkey). Changing either in UI updates CONFIG and rebinds that one key immediately.
  - **Per-config group**: `macro_configs.skill_configs.<name>` for `<name>` in config1..config4. Each group contains quick_switch, potion, movement, skill1..4. The **current** group is chosen by `macro_configs.current_skill_config`. When the user switches the current config (e.g. config1 → config2), the **whole set** of keys for that config becomes active for the macro; the loader serves the active group.
- **Single-key update is supported** (也可以单个设置后更新配置和热键): the user can change only one key in the UI (e.g. only quick_switch for config1). That single key is written to CONFIG, `notify_config_changed` is called with the appropriate path, and:
  - If the path is under `macro_configs.auxiliary_config` → both global hotkeys are reregistered (each from its current CONFIG value).
  - If the path is under `macro_configs.skill_configs` → the macro config loader is refreshed; the active config’s set (including the changed key) is reloaded.
- So: **group switch** = change `current_skill_config` (active set changes); **single key** = change one field in CONFIG and immediately update that binding/loader.

## 2. Current Stack (Reference)

| Layer | Location | Role |
|-------|----------|------|
| OS hook | `keyboard` (boppreh/keyboard) | `add_hotkey` / `remove_hotkey`; hotkey format e.g. `ctrl+shift+f1`, `f6`. |
| Pycore | `pycore.pyutils.hotkey.global_hotkey_listener` | `HotkeyListener`, `register_global_hotkey`, `unregister_global_hotkey`, `get_global_hotkey_listener`; normalizes hotkey string; supports `update_hotkey(old, new)`. |
| d3-check | `d3utils.global_hotkey_manager` | Single worker thread + command queue; `register_hotkey` / `unregister_hotkey` with source, priority, conflict handling. All mutations on worker. |
| d3-check | `d3utils.d3u_common.hotkey_registry` | Reads CONFIG; registers assistant + combat hotkeys; `reregister_assistant_hotkey()` / `reregister_combat_hotkey()` on `macro_configs.auxiliary_config` change. |
| Config | `macro_configs.auxiliary_config` | `macro_start_hotkey`, `assistant_hotkey`. |
| Config | `macro_configs.skill_configs.<name>` | `quick_switch`, `potion`, `movement`, `skills.skill1.key` … `skills.skill4.key`. |
| UI | `ui.widgets.hotkey_input.HotkeyInput` | Focus → capture key; `on_change(hotkey)`; displays i18n key names. |
| Controller | `d3_macro_controller` | Subscribes to config_change_hub; on `macro_configs.auxiliary_config` calls `get_hotkey_registry().reregister_assistant_hotkey()`; on `macro_configs*` calls `get_macro_config_loader().load_active()`. |

## 3. Functional Scope (Same Logic for All)

Apply **one binding model** to every hotkey-like setting:

- **辅助宏启停热键** — `macro_configs.auxiliary_config.assistant_hotkey` (e.g. F6)  
  → Global hotkey: trigger assistant start/stop.
- **战斗宏启停热键** — `macro_configs.auxiliary_config.macro_start_hotkey` (e.g. F2)  
  → Global hotkey: trigger combat macro start/stop.
- **快速切换** — `macro_configs.skill_configs.<config>.quick_switch` (e.g. F1)  
  → Per-config: key sent to game to switch config; no global listener (or optional future global “switch to this config”).
- **药水** — `macro_configs.skill_configs.<config>.potion`  
  → Per-config key sent to game.
- **技能一 / 二 / 三 / 四** — `macro_configs.skill_configs.<config>.skills.skill1.key` … `skill4.key` (e.g. 1, 2, 3, 4)  
  → Per-config keys sent to game.

Unified rule:

- **Global listener hotkeys** (assistant, combat): config path → single key → one callback. On config change: unregister old key, register new key (immediate rebind).
- **Per-config bindings** (quick_switch, potion, skill1–4): config path → single key; used by macro/loader when running. On config change: refresh loader/cache so next macro tick uses new keys; no global registration unless explicitly added later.

## 4. Design Requirements

### 4.1 Startup: Load Hotkeys from Config

- After CONFIG is ready (and before or as part of `initialize_hotkeys()`):
  - Read **assistant_hotkey** and **macro_start_hotkey** from `macro_configs.auxiliary_config`.
  - Register both with the global hotkey manager (hotkey_registry or equivalent), each with a single callback (assistant toggle, combat macro toggle).
- Per-config keys (quick_switch, potion, skill1–4) are not registered as global hotkeys; they are loaded by `MacroConfigLoader` and used when the macro runs.

### 4.2 Config Change → Immediate Hotkey Update

- When any hotkey-related config path changes (e.g. `macro_configs.auxiliary_config` for F2/F6, or `macro_configs.skill_configs` for quick_switch/potion/skills):
  - **Global hotkeys (assistant, combat):**  
    Unregister the previous key for that function and register the new key from CONFIG (same callback, new key). No app restart. Same pattern as current `reregister_assistant_hotkey()` / `reregister_combat_hotkey()`.
  - **Per-config bindings:**  
    Notify macro config loader to refresh (e.g. `get_macro_config_loader().load_active()`); macro uses updated keys on next use. No global rebind.
- **Single-key change**: Editing one HotkeyInput updates one key in CONFIG and triggers the above once; no need to “apply” the whole group. **Group switch**: Changing `current_skill_config` (e.g. config1 → config2) switches which group the macro uses; the loader then serves that group’s set. Both paths lead to immediate effect.

### 4.3 Binding Model: One Key per Function

- Each “function” has at most one bound key at a time:
  - **assistant_toggle** ↔ `assistant_hotkey`
  - **combat_macro_toggle** ↔ `macro_start_hotkey`
  - **quick_switch** (per config) ↔ `skill_configs.<name>.quick_switch`
  - **potion** (per config) ↔ `skill_configs.<name>.potion`
  - **skill1..4** (per config) ↔ `skill_configs.<name>.skills.skillN.key`
- Changing the key in config effectively “unbinds” the old key and “binds” the new key for that function. No duplicate binding of the same key to two functions in the same scope (global vs per-config).

### 4.4 UI: HotkeyInput → Config Update → Rebind (single key, immediate)

- When the user focuses a HotkeyInput and presses a new key (or clears with Escape/Delete):
  - **UI:** HotkeyInput captures the key and calls `on_change(new_hotkey)`.
  - **Binding layer:** `on_change` must:
    1. Write the **single** new value to CONFIG at the correct path (e.g. `macro_configs.auxiliary_config.assistant_hotkey`, or `macro_configs.skill_configs.<current>.quick_switch`, etc.).
    2. Call `get_config_change_hub().notify_config_changed(...)` with the appropriate key path (e.g. `macro_configs.auxiliary_config` or `macro_configs.skill_configs`).
  - **Controller / hotkey registry:** Subscribed to config_change_hub; on notification:
    - For paths under `macro_configs.auxiliary_config`: reregister both global hotkeys (each key read from CONFIG).
    - For paths under `macro_configs.skill_configs`: refresh macro config loader only (active group is reloaded).
- **One HotkeyInput = one key in CONFIG**: no “Apply” button; **focus → press key → that key in config and its binding/loader update immediately.** Single-key update and group-based config (current_skill_config) coexist: editing one field only updates that field and applies the change at once.

### 4.5 Hotkey Format and Normalization

- Store in config in a **canonical form** (e.g. lowercase, `+` for modifiers: `f6`, `ctrl+shift+f2`) so that:
  - pycore `HotkeyListener` / `keyboard` and d3-check `GlobalHotkeyManager` use the same format.
  - HotkeyInput display can remain i18n (e.g. “F6”, “Ctrl+Shift+F2”) while internal value is canonical.
- Normalization must be consistent between: config write, global_hotkey_manager, and pycore hotkey_listener (e.g. `_normalize_hotkey`).

### 4.6 Extension Points (keyboard library)

- See **§7 Official technical implementation** for the exact API and lifecycle. In short:
  - **Register:** `keyboard.add_hotkey(hotkey, callback, suppress=False, ...)`; returns a **remove** callable.
  - **Unregister:** `keyboard.remove_hotkey(hotkey)` or `keyboard.remove_hotkey(remove_callable)` (the value returned by `add_hotkey`). The library looks up by hotkey string or by that callable in an internal `_hotkeys` dict.
  - **Format:** `ctrl+shift+f1`, `f6`; multi-step possible (e.g. `a, b`). Literal comma/plus/space use names `'comma'`, `'plus'`, `'space'`.
- All mutations to the global listener must go through the **single worker thread** in `GlobalHotkeyManager` (command queue); no direct `register_global_hotkey` / `unregister_global_hotkey` from UI or arbitrary threads. Hotkey registry continues to call `register_hotkey` / `unregister_hotkey` (manager API), which enqueue commands.

### 4.7 Combat Macro Hotkey (macro_start_hotkey)

- **Requirement:** Treat **战斗宏启停热键** the same as **辅助宏启停热键**:
  - At startup: register `macro_start_hotkey` from config with a callback that toggles combat macro (start/stop).
  - On config change for `macro_configs.auxiliary_config`: unregister old `macro_start_hotkey`, register new one (same callback).
- Implementation: extend `HotkeyRegistry` (or equivalent) with `register_combat_hotkey` and `reregister_combat_hotkey`, and call both from `initialize_hotkeys()` and from the config-change handler when `macro_configs.auxiliary_config` changes.

## 5. Config key set (config 需要的一组键)

CONFIG uses the following keys for hotkey-related behaviour. All are under `CONFIG['macro_configs']` unless noted.

| Mode | Scope | Effect of change |
|------|--------|------------------|
| **Group** | `auxiliary_config` (2 keys) or `skill_configs.<name>` (quick_switch, potion, movement, skill1..4) | Auxiliary: two global hotkeys. Per-config: one set per config name; switching `current_skill_config` switches which set the macro uses. |
| **Single key** | One HotkeyInput → one path in CONFIG | Write that key → notify_config_changed → immediate rebind (global) or loader refresh (per-config). Config can be updated one key at a time; each update takes effect immediately. |

### 5.1 Global listener hotkeys (immediate rebind on change)

| Config path | Key | Description |
|-------------|-----|-------------|
| `macro_configs.auxiliary_config` | `assistant_hotkey` | 辅助宏启停 (e.g. F6) |
| `macro_configs.auxiliary_config` | `macro_start_hotkey` | 战斗宏启停 (e.g. F2) |

Constant in code: `d3utils.d3u_common.hotkey_registry.AUXILIARY_CONFIG_HOTKEY_KEYS = ('assistant_hotkey', 'macro_start_hotkey')`.

### 5.2 Per-config bindings (per skill config name: config1 … config4)

| Config path | Key | Description |
|-------------|-----|-------------|
| `macro_configs.skill_configs.<name>` | `quick_switch` | 快速切换 (e.g. F1) |
| `macro_configs.skill_configs.<name>` | `potion` | 药水 (e.g. Q) |
| `macro_configs.skill_configs.<name>` | `movement` | 移动 (e.g. Space) |
| `macro_configs.skill_configs.<name>.skills` | `skill1.key` … `skill4.key` | 技能一 … 四 (e.g. 1, 2, 3, 4) |

These are not registered as global hotkeys; they are read by `MacroConfigLoader` and used when the macro runs. On change, `get_macro_config_loader().load_active()` refreshes the cache.

### 5.3 Full list (for validation / defaults)

```text
macro_configs.auxiliary_config.assistant_hotkey
macro_configs.auxiliary_config.macro_start_hotkey
macro_configs.skill_configs.<name>.quick_switch
macro_configs.skill_configs.<name>.potion
macro_configs.skill_configs.<name>.movement
macro_configs.skill_configs.<name>.skills.skill1.key
macro_configs.skill_configs.<name>.skills.skill2.key
macro_configs.skill_configs.<name>.skills.skill3.key
macro_configs.skill_configs.<name>.skills.skill4.key
```

`<name>` is one of: `config1`, `config2`, `config3`, `config4`.

## 6. Summary Checklist

- [x] **Startup:** Load assistant_hotkey and macro_start_hotkey from config; register both with global hotkey manager.
- [x] **Config change:** On `macro_configs.auxiliary_config` change, reregister both assistant and combat hotkeys (unregister old key, register new key).
- [x] **Per-config change:** On `macro_configs.skill_configs` change, refresh macro config loader only (no global hotkey change).
- [ ] **UI:** Every HotkeyInput that backs a hotkey/config key: on_change → write CONFIG → notify_config_changed → controller/hotkey_registry applies (rebind or refresh).
- [ ] **One key per function:** No double-binding; changing key in UI updates config and rebind in one flow.
- [x] **Single worker:** All global hotkey register/unregister go through GlobalHotkeyManager queue; no direct listener access from UI thread.
- [x] **Combat hotkey:** Combat macro hotkey in hotkey_registry (register_combat_hotkey + reregister_combat_hotkey); wired to config path and config_change_hub.

This document defines the requirements; config-driven hotkey switching for auxiliary hotkeys is implemented in hotkey_registry, d3_macro_controller, and system_initializer.

---

## 7. Official technical implementation (keyboard library)

*Source: [boppreh/keyboard](https://github.com/boppreh/keyboard) (GitHub). MCP had no configured resources; this section is based on the official repository README and `keyboard/__init__.py`.*

### 7.1 Architecture

- **Singleton listener:** One global `_KeyboardListener` instance (`_listener`). Listening starts on first use (`_listener.start_if_necessary()` when e.g. `add_hotkey` or `hook` is called).
- **OS layer:** Platform-specific module `_winkeyboard` / `_nixkeyboard` / `_darwinkeyboard`; `_os_keyboard.listen(callback)` runs the OS hook; events are processed in a dedicated thread.
- **Hotkey storage:** Hotkeys are stored in `_listener.blocking_hotkeys` or `_listener.nonblocking_hotkeys` (dict: key = tuple of scan_codes for current step, value = list of handler callables). Single-step hotkeys use `_add_hotkey_step`; multi-step hotkeys add a global `hook(catch_misses, suppress=True)` for step progression and timeout.

### 7.2 add_hotkey / remove_hotkey

- **add_hotkey(hotkey, callback, args=(), suppress=False, timeout=1, trigger_on_release=False)**  
  - Parses `hotkey` with `parse_hotkey_combinations(hotkey)` (which uses `parse_hotkey` → `key_to_scan_codes` → `normalize_name` from `_canonical_names`).  
  - Single-step: registers a handler in `blocking_hotkeys` or `nonblocking_hotkeys` keyed by scan-code tuple; returns a **remove** function that undoes that registration and cleans `_hotkeys`.  
  - Multi-step: same plus a global hook for step/timeout handling; remove clears both.  
  - **Returns:** the remove callable (stored in `_hotkeys` under `hotkey`, `remove_`, and `callback` so lookup by string or by remove callable works).

- **remove_hotkey(hotkey_or_callback)**  
  - Implemented as `_hotkeys[hotkey_or_callback]()` — i.e. the argument must be either the **exact hotkey string** passed to `add_hotkey`, or the **remove callable** returned by `add_hotkey`.  
  - Calling the remove callable: unregisters from `blocking_hotkeys`/`nonblocking_hotkeys`, decrements `filtered_modifiers` for modifiers, and removes entries from `_hotkeys`.  
  - **Rebind pattern:** To change binding, call `remove_hotkey(old_hotkey)` (or `remove_hotkey(old_remove_callable)`), then `add_hotkey(new_hotkey, same_callback, ...)`. Using the same normalized string form for old/new avoids ambiguity.

### 7.3 Hotkey string format and normalization

- **Input format:** Case-insensitive; steps separated by comma (e.g. `ctrl+a, b`); keys in a step separated by `+` (e.g. `ctrl+shift+f1`). Literal comma/plus/space: use names `'comma'`, `'plus'`, `'space'`.  
- **Normalization:** `parse_hotkey` splits by `,\s?` and `\s?\+\s?`; each key is passed to `key_to_scan_codes(key)` which uses `normalize_name(key)` from `_canonical_names` (e.g. "LEFT CONTROL" → "left ctrl"). Storing in config as lowercase with `+` (e.g. `f6`, `ctrl+shift+f2`) matches typical canonical form and ensures `remove_hotkey(old_string)` works when the same string is used at add.

### 7.4 Callback execution and thread safety

- Hotkey callbacks run in the **listener thread** (asynchronously). Do not block long; for UI or heavy work, schedule on main thread (e.g. `root.after(0, ...)` in Tk) or a worker.  
- **unhook_all_hotkeys()** clears all hotkey state (`blocking_hotkeys`, `nonblocking_hotkeys`) and leaves other hooks (e.g. `hook`) intact; `unhook_all()` clears everything including hotkeys.

### 7.5 Implications for this project

- **Rebind:** Use the same normalized hotkey string when calling `keyboard.remove_hotkey(old)` and `keyboard.add_hotkey(new, callback, ...)`. Pycore’s `_normalize_hotkey` should produce a string compatible with keyboard’s `normalize_name` (e.g. lowercase, `+` for modifiers).  
- **Single worker:** All add/remove must run in one thread (our GlobalHotkeyManager worker); the keyboard library is not thread-safe for concurrent add_hotkey/remove_hotkey.  
- **UI capture:** For “press key to set binding”, use Tk’s KeyPress on HotkeyInput (widget-level); do not use `keyboard.read_hotkey()` in the main thread (it blocks). Optionally, `keyboard.get_hotkey_name()` can format the current combination for display if we ever capture via keyboard in a background thread.

### 7.6 Known limitations (official README)

- **Project status:** keyboard is currently unmaintained; may have friction and limited features.
- **Windows:** Events don’t report device id; key suppression/blocking only on Windows.
- **Linux:** Media keys may be nameless or missing; raw device read may require root.
- **Other apps:** Some applications (e.g. games) may swallow key events; keyboard will not see them.
- **SSH:** Only typed text is forwarded, not keyboard events; hooks on a server won’t see local key presses.
- **remove_hotkey:** Official API text says “Must be called with the value returned by add_hotkey”; the implementation also accepts the hotkey string (lookup via `_hotkeys`). For rebind we use the same string as at add (normalized).

---

## 8. Design gaps and incompleteness

*Identified by comparing this document with the [keyboard](https://github.com/boppreh/keyboard) official API and the current code (HotkeyInput, hotkey_registry, global_hotkey_manager, pycore hotkey_listener). MCP was used to look up official docs; no MCP resources were available.*

### 8.1 HotkeyInput → CONFIG format (normalization)

- **Gap:** The design says “store in config in canonical form” and “HotkeyInput display can remain i18n”, but it does **not** specify the format of the argument passed to `on_change(hotkey)`.
- **Current code:** HotkeyInput builds the string with **i18n key names** (e.g. locale “Ctrl”, “F6”) and calls `on_change(hotkey)` with that. If the panel writes this directly to CONFIG, the value may not match what `keyboard` / pycore expect (e.g. `ctrl+f6`).
- **Missing:** (1) Contract for `on_change`: canonical string only, or i18n string with conversion in the binding layer? (2) Where normalization is applied: in HotkeyInput before calling `on_change`, or in the panel’s `on_change` before writing CONFIG, or in hotkey_registry when reading CONFIG? (3) If CONFIG stores i18n, registry/manager must normalize before `add_hotkey`/`remove_hotkey`; document that and ensure one place does it.

### 8.2 Empty or invalid hotkey

- **Gap:** Behaviour when the user clears the HotkeyInput (empty string) or when CONFIG has empty/missing `assistant_hotkey` or `macro_start_hotkey` is not fully specified.
- **Current behaviour:** `register_*` returns False and does not register; `reregister_*` skips if new value is missing. If the user changes a key to “empty”, the **old** binding may remain registered (no explicit unregister).
- **Missing:** (1) Define: on “clear” in UI, should we write empty to CONFIG and **unregister** the previous key for that function? (2) Document that empty/missing in CONFIG means “no global hotkey” and that any previous binding should be removed when updating to empty.

### 8.3 Duplicate key (same key for two functions)

- **Gap:** The design says “no duplicate binding of the same key to two functions” but does not specify what happens when the user assigns the same key to e.g. assistant and combat (reject, last-wins, or warn).
- **Current code:** GlobalHotkeyManager has conflict resolution by priority/source; hotkey_registry uses the same source for both, so the second register could replace or fail depending on manager logic.
- **Missing:** (1) Define desired behaviour (e.g. last-wins, or reject with UI message). (2) Document that conflict resolution is in GlobalHotkeyManager and how it interacts with registry (source, priority).

### 8.4 notify_config_changed key_path

- **Gap:** The design says notify with `macro_configs.auxiliary_config` or `macro_configs.skill_configs` but not whether a more specific path (e.g. `macro_configs.auxiliary_config.assistant_hotkey`) should be used.
- **Current behaviour:** Any change under `macro_configs.auxiliary_config` triggers reregister of **both** global hotkeys (each re-read from CONFIG). So a single path is enough; we don’t need per-key paths for optimisation.
- **Missing:** Explicitly state that we notify at group/parent path level and always reregister both auxiliary hotkeys (or refresh the whole loader) so that a single path contract is sufficient.

### 8.5 current_skill_config change

- **Gap:** The design says switching `current_skill_config` switches the active group but does not explicitly say that when `current_skill_config` changes, the macro config loader must be refreshed.
- **Current behaviour:** Controller calls `get_macro_config_loader().load_active()` when `key_path.startswith("macro_configs")`, and `load_active()` reads `current_skill_config` from CONFIG. So changing `current_skill_config` (under `macro_configs`) triggers a refresh.
- **Missing:** In the design, state explicitly that a change to `macro_configs.current_skill_config` (or any `macro_configs.*`) triggers `load_active()` so the loader serves the new current group.

### 8.6 Shutdown / cleanup

- **Gap:** The design does not mention unregistering hotkeys on app shutdown.
- **Note:** The keyboard library states that when the program exits, hotkeys are no longer in effect. Explicitly calling `unhook_all_hotkeys()` or unregistering each hotkey on shutdown is cleaner and avoids any residual hook state.
- **Missing:** (1) Require or recommend that on app shutdown we unregister all hotkeys (or call the same path as “stop listening”). (2) Reference any existing shutdown hook (e.g. THREAD_BUS or event_center) that should trigger hotkey cleanup.

### 8.7 UI binding map (widget → config path)

- **Gap:** The checklist says “every HotkeyInput that backs a hotkey/config key” should follow on_change → CONFIG → notify, but the design does not list which UI widgets bind to which config paths.
- **Missing:** A small mapping table, e.g.: main_functions_panel — macro_start_hotkey → `macro_configs.auxiliary_config.macro_start_hotkey`, assistant_hotkey → `macro_configs.auxiliary_config.assistant_hotkey`, quick_switch → `macro_configs.skill_configs.<current>.quick_switch`; skill1..4 keys per config; and any other panels that expose HotkeyInput. This ensures no binding is missed and clarifies “single key” vs “group” per widget.

### 8.8 Canonical form vs keyboard.normalize_name

- **Gap:** Design and pycore use `_normalize_hotkey` (e.g. `lower().replace(' ', '')`); the keyboard library exposes `keyboard.normalize_name(name)` for a single key (e.g. "LEFT CONTROL" → "left ctrl"). Full hotkey strings (e.g. `ctrl+shift+f2`) are parsed by `parse_hotkey` which uses `normalize_name` per key.
- **Missing:** (1) State whether we rely on pycore/d3-check normalization only or also align with `keyboard.normalize_name` for single-key segments. (2) If CONFIG is ever edited by hand or by another tool, document that valid values must be parseable by the keyboard library (and list literal names: `'comma'`, `'plus'`, `'space'` for special keys).

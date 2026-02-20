# Battle.net region: config-only detection (no UI)

Region (Asia vs CN) is **only** from config. UI is not used to set or detect region.

## Source of truth

- **In memory**: `game_interface_data.battlenet_region` (`"asia"` | `"cn"` | `None`).
- **Filled from** (in order):

1. **Startup**  
   `get_game_interface_data()` first creation runs `_initialize_battlenet_region_from_config()` in `share/game_interface_data.py`: reads **Battle.net client config file** `Battle.net.config` (path from `providor_index.BATTLE_NET_CONFIG_PATH`, e.g. `~/AppData/Roaming/Battle.net/Battle.net.config`), key `Services.LastLoginRegion`. If `"CN"` → set `"cn"`; else (e.g. US, EU, KR, TW) → set `"asia"`. If file missing or invalid, leaves `battlenet_region` unchanged (stays `None`).

2. **Later refresh (when region still None)**  
   `ensure_battlenet_region_from_config()` in `d3utils/battlenet_status_provider.py`:
   - If `game_data.get_battlenet_region()` is not `None`, returns.
   - Else reads **Battle.net.config** again (`_read_region_from_battlenet_config()`): same rule (CN → `"cn"`, else → `"asia"`). If found, sets `game_data.battlenet_region` and `ros_settings.battlenet_region_cache`.
   - Else reads **our config** `ros_settings.battlenet_region_cache`; if value in `("asia", "cn")`, sets `game_data.battlenet_region`.

So: **Battle.net.config file** is the primary source; **ros_settings.battlenet_region_cache** is the fallback. No UI detection updates region.

## Where it is used

- **BN flow (tick)**  
  `rosbot_flow_battlenet._get_bn_preferred_region()` returns `get_game_interface_data().get_battlenet_region()`. B9/B13 use it to choose BN_LoginAsia vs BN_Login1 (CN).
- **Controller login flow**  
  `_run_login_flow_ui_by_region()` calls `ensure_battlenet_region_from_config()` then `get_battlenet_region()`. If still `None`, skips login-by-region (no UI fallback).
- **Status provider**  
  `_detect_battlenet_dynamic()` calls `ensure_battlenet_region_from_config()` so refresh can resolve region from config when not set at startup.
- **BattlenetOperation**  
  `_resolve_battlenet_region()`: returns `game_data.get_battlenet_region()` else `ros_settings.battlenet_region_cache` (no file read; assumes game_data or cache already set).
- **UI / update / timers**  
  Bottom bar, rosbot update manager, one_shot_tasks read `get_game_interface_data().get_battlenet_region()` or cache for display and update checks.

## Constants

- `providor/constants/common.py`: `BATTLE_NET_CONFIG_LAST_LOGIN_REGION_KEY = "LastLoginRegion"`, `BATTLE_NET_CONFIG_REGION_CN = "CN"`.
- `providor/providor_index.py`: `BATTLE_NET_CONFIG_PATH` (Battle.net client config path).

## Summary

| Step              | Source                    | Action                                      |
|-------------------|---------------------------|---------------------------------------------|
| Game data init    | Battle.net.config file   | Set `battlenet_region` (CN → "cn", else "asia") |
| ensure_*_from_config | Battle.net.config → cache | If region None: read file then cache; set game_data (and cache when from file) |
| All consumers     | `get_battlenet_region()`  | Read in-memory value only (no UI)           |

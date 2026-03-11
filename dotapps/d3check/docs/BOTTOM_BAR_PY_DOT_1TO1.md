# Bottom status bar: PY ↔ DOT 1:1 mapping

Reference: **PY** `pyapps/d3-check/ui/components/bottom_bar.py`, `bottom_bar_status_block.py`, `status_row_config.py`. **DOT** `dotapps/d3check/MainWindow.xaml` (bottom bar).

**Layout:** PY uses `pack(side=LEFT)` for row 1 and row 2 (left-aligned); row 3 has left_f (test_mode) and right_f (path icons + scan) with sticky="e". DOT matches: row 0 and row 1 are left-aligned StackPanels; row 2 is Grid with test_mode left, path icons + Scan right.

---

## Row 0 (DOT) = PY STATUS_ROW_1 (first status row)

| # | PY (status_row_config STATUS_ROW_1) | DOT control | Notes |
|---|-------------------------------------|-------------|--------|
| 0 | (none; PY options row is separate) | TxtMacroStatus | "Macro area" / current config (DOT only, code-behind) |
| 1 | Battle.net (rosbot.battlenet_status) | TxtStatusBn | "Battle.net: -" |
| 2 | ROS (rosbot.ros_label) | TxtStatusRos | "ROS: -" |
| 3 | D3 (rosbot.d3_status) | TxtStatusD3 | "D3: -" |
| 4 | Map (rosbot.map_status) | TxtStatusMap | "Map: -" |
| 5 | Stage (rosbot.stage) | TxtStatusStage | "Stage: -" |

All on **one row, left-aligned** (same as PY `pack(side=LEFT)`).

---

## Row 1 (DOT) = PY STATUS_ROW_2 (second status row)

| # | PY (status_row_config STATUS_ROW_2) | DOT control | Notes |
|---|-------------------------------------|-------------|--------|
| 1 | OAuth (rosbot.oauth_script_status) | TxtStatusOauth | "OAuth: -" |
| 2 | window_size (ui.status_bar.window_size) | TxtStatusWindowSize | "0x0" |

**Left-aligned** in DOT (same as PY).

---

## Row 2 (DOT) = PY row 3 (_build_row3_always)

| # | PY (bottom_bar_status_block) | DOT control | Notes |
|---|-------------------------------|-------------|--------|
| 1 | test_mode (left, one label) | TxtTestMode | Left-aligned |
| 2 | ○ BN (path icon) | TxtPathBn | "○ BN" or "✓ BN" by path |
| 3 | ○ D3 (path icon) | TxtPathD3 | "○ D3" or "✓ D3" |
| 4 | ○ D4 (path icon) | TxtPathD4 | "○ D4" |
| 5 | ○ ROS (path icon) | TxtPathRos | "○ ROS" or "✓ ROS" + optional version |
| 6 | One-Click Scan button (extra_f) | BtnScanPaths | "One-Click Scan" |

Path icons + Scan button right-aligned in DOT.

---

## Icon / control summary

| PY element | DOT element |
|------------|-------------|
| battlenet status value | TxtStatusBn |
| ros status value | TxtStatusRos |
| d3 status value | TxtStatusD3 |
| map status value | TxtStatusMap |
| stage status value | TxtStatusStage |
| oauth status value | TxtStatusOauth |
| window_size value | TxtStatusWindowSize |
| test_mode label | TxtTestMode |
| ○ BN / ✓ BN | TxtPathBn |
| ○ D3 / ✓ D3 | TxtPathD3 |
| ○ D4 | TxtPathD4 |
| ○ ROS / ✓ ROS | TxtPathRos |
| One-Click Scan button | BtnScanPaths |
| Macro area (row 0 options) | TxtMacroStatus |

---

## Changes made (DOT to match PY)

1. **Row 0:** Order set to Battle.net → ROS → D3 → Map → Stage (was BN, D3, 0x0, D4, ROS, Scan). Removed window_size, path D4, and Scan from row 0.
2. **Row 1:** Map and Stage moved to row 0. Row 1 now OAuth + window_size only (right); left = Macro area.
3. **Row 2:** Added TxtPathD4 between D3 and ROS; moved BtnScanPaths to end of row 2 (same row as path icons). Layout: test_mode (left) | ○ BN, ○ D3, ○ D4, ○ ROS, One-Click Scan (right).

---

## Python ROSBOT display and find logic (reference)

### Bottom bar – ROS status (Row 0)

- **PY:** `update_status_from_state()` sets ROS value from `rosbot_total_restart_count`: `[R{count}]` when count > 0, else `"-"`. Foreground by `rosbot_extended_status`: running = success, paused = warning, else error. Label key: `rosbot.ros_label`.
- **Source:** `bottom_bar.py` (status vars), `status_row_config.py` STATUS_ROW_1.

### Bottom bar – path icons (Row 3) and ROS version display

- **PY:** `refresh_path_icons()`:
  - BN/D3: ✓ when path exists and is valid file (correct exe name), ○ otherwise; fg green/muted.
  - D4: always ○ (muted).
  - **ROS:** ✓/○ by path validity (dir or .exe). **ROS label includes version suffix:** `ROS{ros_suffix}` where `ros_suffix = " " + _ros_version_display_from_update_logic()`.
- **ROS version string (PY):** `_ros_version_display_from_update_logic()` in `bottom_bar.py`:
  - Uses `get_rosbot_manager().get_ros_directory()`; parent dir = `os.path.dirname(ros_dir)`.
  - If parent basename is standard (`Asia_*` or `CN_*` with parseable version via `rosbot_update_manager.parse_version_from_name`), return **parent_basename** (e.g. `Asia_36.0129`, `CN_36.0129`).
  - Else non-standard (e.g. `ros-bot7.18`): parse version from path, optionally prefix with Battle.net region (`Asia_` / `CN_`) from `get_game_interface_data().get_battlenet_region()`, else version only.
- **Constants:** `ROSBOT_DIR_NAMESPACE_ASIA`, `ROSBOT_DIR_NAMESPACE_CN` (providor.constants.d3).

### Python path scan and “find” logic

- **Scan:** `d3utils.path_scanner.scan_for_paths(progress_callback, include_rosbot=True, force_scan_rosbot=True)`:
  - Drives: fixed order (D first, then others, C last); max depth `PATH_SCAN_MAX_DEPTH`.
  - Battle.net/D3: skip scan if configured path exists and is valid.
  - ROSBOT: when `force_scan_rosbot=True`, always scan for ROSBOT dirs even if one is configured (to find both Asia_* and CN_*).
  - Returns `(battlenet_path, list of rosbot_dirs, d3_path)`.
- **ROSBOT sort (PY):** Prefer update-convention paths: `GameTools\\{Asia|CN}_{version}\\RosBot` (via `_is_rosbot_update_convention_path`), then by mtime descending. Result order used when presenting multiple dirs.
- **Pick best by region:** `pick_best_rosbot_dir_by_region(dirs, region)`:
  - If region is asia/cn: return first dir whose path contains Asia/亚服 or CN/国服 (and for CN, exclude Asia).
  - Else or no match: return dir with newest parsed version from path.
- **Apply results (PY):** `_apply_scan_results(battlenet_path, rosbot_dirs, d3_path)` in `rosbot_extension_panel.py`:
  - Writes BN/D3 only when current config is missing or invalid.
  - For ROSBOT: `chosen = pick_best_rosbot_dir_by_region(rosbot_dirs, region)`. Does **not** overwrite when current is valid and matches BN region and chosen does not (e.g. switched to CN, scan only found Asia). If chosen and overwrite_ok and (current invalid or path different), set `ros_settings.ros_directory` to chosen.
  - PY does **not** call `_ask_choose_rosbot_directory` in the current flow; that method was dead code and has been removed. No "choose one" dialog is required for 1:1.
  - After apply: `refresh_path_icons()`.

### Region change → auto path scan (PY)

- In `update_status_from_state()`: when `region_key in ("asia","cn")`, PY updates `ros_settings.battlenet_region_cache`; if cache changed and `_region_changed_callback` is set, calls it.
- When Battle.net and ROSBOT version/region mismatch (current ROS path does not match region), PY triggers **one** auto path scan via the same callback (`_mismatch_scan_triggered`); reset when paths match.

---

## DOT gaps vs Python (ROSBOT display, one-click scan, update, UI)

### 1. Bottom bar – ROS path icon (TxtPathRos) missing version suffix

| Item | PY | DOT |
|------|----|-----|
| ROS path icon text | `✓ ROS Asia_36.0129` or `✓ ROS 36.0129` (version from parent dir or parsed + region) | `✓ ROS` or `○ ROS` only |
| **Gap** | DOT does not show ROS version/region suffix; no equivalent to `_ros_version_display_from_update_logic()`. |

**Suggestion:** In DOT, when updating TxtPathRos in `UpdateStatusFromState` (or a dedicated refresh), compute a ROS version display string from configured `ros_settings.ros_directory` (parent dir name if standard `Asia_*`/`CN_*`, else parsed version + Battle.net region) and set `TxtPathRos.Text` to e.g. `"✓ ROS " + versionDisplay` / `"○ ROS " + versionDisplay`.

### 2. Region change → no auto path scan

| Item | PY | DOT |
|------|----|-----|
| On Battle.net region change / BN–ROSBOT mismatch | Calls `_region_changed_callback()` once to run path scan (and optionally skip overwrite when current matches region). | No callback; no auto scan on region change or mismatch. |

**Suggestion:** In DOT, when `UpdateStatusFromState` (or equivalent) detects region change or region/ROSBOT path mismatch, call into a single “run one path scan” path (with same overwrite/skip semantics as PY) or set a flag so the next tick runs scan once.

### 3. One-click scan – ROSBOT directory selection

| Item | PY | DOT |
|------|----|-----|
| After scan | `pick_best_rosbot_dir_by_region(rosbot_dirs, region)`; overwrite only when current invalid or overwrite_ok (no overwrite when current matches region and chosen does not). | `result.RosbotDirs.FirstOrDefault()` – no region-based pick; no overwrite_ok rule. |
| Multiple ROSBOT dirs | PY does not call a choose dialog; uses pick_best only. | No dialog; use pick_best (1:1). |

**Gap:** DOT one-click scan does not:
- Prefer update-convention paths when **sorting** ROSBOT dirs (DOT PathScanner sorts by mtime only).
- **Pick by region** (Asia/CN) before writing config.
- Apply “do not overwrite when current valid and matches region and chosen does not.”
- Offer a “choose one” dialog when multiple ROSBOT dirs exist.

**Suggestion:** In DOT: (1) In PathScanner (or post-scan), sort ROSBOT dirs: update-convention first, then by mtime. (2) Add `PickBestRosbotDirByRegion(dirs, region)` and use it in BtnScanPaths_Click. (3) Apply PY overwrite_ok logic before setting `ros_settings.ros_directory`. (4) Optionally show a simple “choose one” dialog when `RosbotDirs.Count > 1` and region does not single out one.

### 4. PathScanner – ROSBOT sort order

| Item | PY | DOT |
|------|----|-----|
| ROSBOT list order | Prefer `GameTools\\{Asia|CN}_{version}\\RosBot` (update convention), then by mtime. | `OrderByDescending(x => x.mtime)` only. |

**Suggestion:** In DOT PathScanner, sort ROSBOT dirs by “is update-convention path” first, then by mtime descending (same semantics as PY).

### 5. Update ROSBOT button

| Item | PY | DOT |
|------|----|-----|
| “Update ROSBOT” | Uses `rosbot_update_manager` (find zip in Downloads by region/size, extract to GameTools\\{Asia|CN}_{version}\\RosBot, update config). | `BtnUpdateRosbot_Click` placeholder: “not implemented yet”. |

**Suggestion:** Implement DOT update flow to mirror PY (downloads dir, zip selection by region/size, extract, move to RosBot, update `ros_settings.ros_directory` and clear cache).

### 6. UI display – Map / Stage i18n keys

| Item | PY | DOT |
|------|----|-----|
| Map/Stage keys | `rosbot.map_{map_type}`, `rosbot.stage_{game_stage}`. | `ui.rosbot.map_*`, `ui.rosbot.stage_*` (e.g. `mapKey = "ui.rosbot.map_" + s.MapType`). |

If the same JSON keys or fallbacks are used for both, display is consistent; otherwise ensure DOT uses the same key namespace as PY (or that both resolve to the same strings).

### 7. Other UI / status notes (aligned)

- **ROS restart count:** DOT now uses `I18nKeys.StatusRestartCountFormat` (e.g. `[R{count}]` / `重{count}`), same as PY `rosbot.restart_count_format`.
- **Map/Stage labels:** DOT uses `I18nKeys.StatusMap` and `I18nKeys.StatusStage` for the "Map" / "Stage" label prefix, same as PY status_row_config.
- PY test mode row: `rosbot_test_mode_display` or `get_test_mode_display_string()` when `rosbot.test_mode` is on. DOT uses `s.RosbotTestModeDisplay` – ensure the value is set by flow/timer when test mode is on (single source of truth).

---

## DOT alignment done (2025-02)

- **PathScanner:** ROSBOT dirs sorted by update-convention path first, then mtime (1:1 Python).
- **RosbotPathPicker:** `PickBestRosbotDirByRegion(dirs, region)` and `PathMatchesRegion(path, region)` added; used in one-click scan.
- **One-click scan:** Uses `PickBestRosbotDirByRegion`; applies overwrite_ok (do not overwrite when current valid and matches region and chosen does not); BN/D3 only set when current invalid.
- **TxtPathRos version suffix:** `RosbotVersionInfo.GetRosVersionDisplay(rosPath, battlenetRegion)` used in `UpdateStatusFromState` so path icon shows e.g. `✓ ROS Asia_36.0129`.
- **ROSBOT update:** `RosbotUpdateManager` (Downloads zip by region/size, extract to GameTools\\{Asia|CN}_{version}\\RosBot, copy RoS-BoT.ini, update config); `BtnUpdateRosbot` calls `CheckUpdate` then `ApplyUpdate` with Yes/No dialog.
- **Config:** `ConfigKeys.PathsDownloadsDir` for `paths.downloads_dir`; `D3PathConstants.RosbotGameToolsBase` for GameTools base.

### Remaining (optional)

- **Region change → auto one-time scan (done 1:1 PY):** In `UpdateStatusFromState`, when region is asia/cn: (1) if `ros_settings.battlenet_region_cache` != current region, write cache and if cached was not null call `RunRegionChangePathScanAsync()`; (2) if current ROS path does not match region and `_mismatchScanTriggered` is false, set it true and call `RunRegionChangePathScanAsync()`. When path matches region, reset `_mismatchScanTriggered`. Scan runs in background and applies on UI thread.
- **Multiple ROSBOT dirs:** PY does not call a choose dialog (removed as dead code). DOT using pick_best only is 1:1.

---

## DOT details audit (post region-change + scan)

- **Region change / mismatch auto-scan:** Implemented 1:1: cache write when region changes; trigger `RunRegionChangePathScanAsync()` when cached was not null (region changed) or when ROS path does not match region and `_mismatchScanTriggered` was false; reset `_mismatchScanTriggered` when path matches region.
- **ROS restart count i18n:** `StatusRestartCountFormat` (e.g. `[R{count}]` / `重{count}`) used in `UpdateStatusFromState`; key in i18n_config.json and I18nFallbacks.
- **Map/Stage labels:** Status row uses `I18nKeys.StatusMap` and `I18nKeys.StatusStage` for the label part instead of hardcoded "Map:" / "Stage:".
- **Test mode row:** Value from `s.RosbotTestModeDisplay`; ensure flow/timer sets `SetRosbotTestModeDisplay` when test mode is on.
- **Optional:** (N/A—PY has no choose dialog.)

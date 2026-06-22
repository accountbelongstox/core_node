# main.py CLI and HTTP Bridge for DOT Client

## Overview

- **GUI mode (default)**: `python main.py` — starts TK GUI + HTTP bridge on 127.0.0.1:8765. No CLI args; exit via UI/hotkey.
- **Bridge-only mode**: `python main.py --http-bridge-only [--host 127.0.0.1] [--port 8765]` — starts only the HTTP bridge (no TK). For the **DOT d3check** app: CalibrationPanel uses this to run Record Start/Stop, Export, List segments, etc. Run bridge-only in a separate terminal so DOT can connect.
- **Library use**: When `main.py` or its modules are imported, nothing starts automatically. Use `HTTPBridgeController`, `d3utils.yolo_record`, etc. directly.

## CLI Arguments

| Argument | Description |
|----------|-------------|
| `--http-bridge-only` | Start only HTTP server; no TK GUI. Ctrl+C stops the bridge. |
| `--host` | Bind address (default: 127.0.0.1). |
| `--port` | Port (default: 8765). |

## DOT Client Workflow (Record → Export → Label)

1. Start Python bridge: `python main.py --http-bridge-only`
2. In DOT: open **坐标校准** tab, select **Project**, click **Record Start** (DOT sends project_path + window handle to Python).
3. Record in game; click **Record Stop** (DOT calls Python stop; Python writes segment).
4. **Refresh** → segment list fills. **Export selected** → Python composes segment to frames (images for labeling).
5. **Open label** → opens AnnotatorWindow (in-process) on segment images and project.

If the bridge is not running, DOT shows:  
`Record stop failed: Python bridge not running: ... Start Python with: python main.py --http-bridge-only`

## Project Data Structure (shared)

- **DOT** uses `YoloProjectData` (dotapps/d3check/Models/YoloProjectData.cs): ProjectPath, ProjectName, ClientType, Classes, Segments. CONFIG keys: `coord_calibration.yolo_data_root`, `coord_calibration.yolo_current_project`, `coord_calibration.yolo_project_list`.
- **Python** uses `yolo_data_layout` and `d3utils.yolo_record`: project_path = `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`, segments as subdirs, `project_config.json` and `patch_data.json` at project root. Same layout so DOT and Python interoperate.

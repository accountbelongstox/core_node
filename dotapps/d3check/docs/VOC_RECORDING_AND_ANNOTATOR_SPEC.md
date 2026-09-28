# D3Check Client Video/Frame Recording and VocAnnotator Integration — Full Spec

## 1. Overview and Goals

- **Goal**: Enable the d3check client (DOT WPF app) to (1) **record** game/client content as frames (or optionally video), (2) **generate data** in the layout expected by **VocAnnotator** and by the Python YOLO workflow, (3) **create** and **switch** VocAnnotator projects, and (4) open the label tool (in-process AnnotatorWindow or standalone VocAnnotator) on the correct project/segment.
- **Reference**: Python `pyapps/d3-check/main.py` (TK + HTTP bridge; no recording/VOC UI there — incomplete). Python `pycore/pyutils/voc_annotator` defines project/segment layout and `run_voc_annotator(project_path=..., images_dir=...)`. This spec aligns DOT with that layout and workflow.
- **Workflow (CalibrationPanel)**: **Step 1 Record** → **Step 2 Export** → **Step 3 Label**.

All logic and data format requirements below are binding for implementation.

---

## 2. Current State (Summary)

### 2.1 DOT (d3check)

| Component | State |
|-----------|--------|
| **CalibrationPanel** | Client mode (Battle.net / D3 Game / D4 Game), Capture screenshot, YOLO: Record Start/Stop, **Import patch** (wired), Project ComboBox, Create project, Open project dir, segment DataGrid (Timestamp, Frames, Status, Size), Refresh, Export selected, Open label, Merge, Delete, Record log. Record Start/Stop and Export call **Python HTTP bridge** (127.0.0.1:8765); start Python with `python main.py --http-bridge-only`. Import patch writes `patch_data.json` to current project (Python-compatible). |
| **AnnotatorWindow** | In-process VOC annotator: open images dir, set save dir, list images, draw rectangles, save JSON + VOC XML. Constructor `(imagesDir, projectPath)`. Uses `DotCore.VocAnnotator`: `ProjectConfig`, `AnnotationIo`, `VocAnnotatorConfig`. |
| **DotCore.VocAnnotator** | `ProjectConfig` (project_config.json / annotator_config.json: project_name, classes, class_colors), `AnnotationIo` (JSON shapes + VOC XML, YOLO .txt export), `VocIo` (VOC XML read/write), `VocAnnotatorConfig` (last dirs, zoom), `VocAnnotatorLauncher` (launch dotapps/VocAnnotator.exe with `--project-path` and images dir). |
| **Config** | `ConfigKeys.CoordCalibrationClientType`, `CoordCalibrationYoloCurrentProject`, `CoordCalibrationYoloProjectList`. Central project model: `Models/YoloProjectData.cs`. |
| **Screen capture** | `DotCore.ScreenCapture.ScreenCaptureService`: Gen (full + optional game window), SaveCurrentScreenshot, CaptureRegion, CaptureWindow, BitBlt/PrintWindow. No continuous “recording” loop yet. |

### 2.2 Python (pyapps/d3-check, pycore)

| Component | State |
|-----------|--------|
| **main.py** | TK GUI + HTTP bridge; D3MacroController; **no** VOC/recording UI. |
| **pycore/pyutils/voc_annotator** | `run_voc_annotator(project_path=..., images_dir=..., save_dir=..., config_path=...)`. `list_segments_from_project(project_path)` returns `[(segment_id, segment_path)]` (subdirs of project, newest first). Segment path contains `frames/`, `record/`, `images/`, `labels/`. **Not** called from main.py today. |
| **yolo_data_layout** | `YOLO_DATA_ROOT`, `{client_type}/{project_name}/{segment_id}/`, `record/`, `frames/`, `images/`, `labels/`, `data.yaml`. |

---

## 3. Logic Requirements (All Features)

### 3.1 Recording (Step 1)

- **Record Start**
  - Require a **current project** (selected in Project ComboBox). If none, show message and optionally create one or select existing.
  - **Segment ID**: Generate a new segment per recording session (e.g. `yyyyMMdd_HHmmss` or UUID). Segment = one directory under project path.
  - **Target paths**: Under segment dir create `record/` and optionally `frames/` (see 4.1). Configurable root: either under a fixed “YOLO data root” (env or config) or under a user-chosen project root.
  - **Capture source**: Chosen by Client mode — Battle.net window, D3 Game window, or D4 Game window. Resolve window handle from existing D3Check logic (e.g. BattlenetManager, game window detection). If no window, optionally fall back to full screen or show error.
  - **Capture method**: Use `DotCore.ScreenCapture.ScreenCaptureService` (e.g. `CaptureWindow(hwnd)` or `CaptureWindowPrintWindow` for client area; or full screen). **Frame-based recording**: on a timer (e.g. 1–5 FPS, configurable), capture and write each frame to disk under `segment/record/` (and optionally copy/link to `segment/frames/`). File names: sequential (e.g. `frame_00001.png`) or timestamp-based, consistent naming.
  - **No video file required for MVP**: Recording = sequence of images. Optionally later: encode to video (e.g. MP4) in `record/` and/or extract frames from video for labeling; not in initial scope.
  - **Record Stop**: Stop timer, flush files, update segment metadata (frame count, status). Append one row to the segment list (DataGrid) and persist “current segment” if needed.
  - **Threading**: Recording loop must not block UI. Use background thread or async; marshal UI updates (log, segment list) to dispatcher.
  - **Log**: Append to “Record log” (e.g. “Recording started segment 20250224_120000”, “Stopped. 150 frames saved.”).

- **Config**
  - **Record FPS** (or interval ms): e.g. 1–10 FPS; default 2. Stored in config (e.g. `coord_calibration.record_fps`).
  - **YOLO data root** (or “project root”): Directory under which `client_type/project_name/` live. Config key e.g. `coord_calibration.yolo_data_root`; default from env `YOLO_DATA_ROOT` or a sensible default (e.g. user docs folder).

### 3.2 Export (Step 2)

- **Export selected**
  - One or more segments selected in the DataGrid. For each selected segment:
    - Source: `segment/record/` (or `segment/frames/` if already populated).
    - Target for labeling: `segment/images/` (VocAnnotator expects images here). Copy or move frames from record (or frames) into `images/` with a naming scheme that matches what VocAnnotator expects (e.g. `frame_00001.png` → same name in `images/`).
  - If “Export” means “prepare for YOLO training”, then also ensure `segment/labels/` exists and optionally generate empty or placeholder `data.yaml` (see 4.2). VocAnnotator will write per-image JSON + VOC XML into the **save dir** (we use same segment dir: images + labels in one segment).
  - **Status**: Mark segment as “exported” or “ready for label” in the DataGrid and/or in a small metadata file under segment (e.g. `segment_meta.json` with status, frame count).
  - **Log**: “Exported segment … (N frames to images/).”

- **Merge**
  - Optional: Merge two or more segments (e.g. combine all frames into one segment). Specification: define merge rule (e.g. copy all frames into first segment’s `images/` with unique names, update frame count). Detail in a later iteration if needed.

- **Delete**
  - Delete selected segment(s): remove segment directory from disk, refresh list, update config if current project/segment was deleted.

### 3.3 Project: Create and Switch

- **Create project**
  - Input: project name (and optionally client type, or derive from current Client mode). Path = `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`. Create directory; create `project_config.json` (or `annotator_config.json`) with `project_name`, `classes` (default e.g. `["object"]`), optionally `class_colors`. Add this project to the Project ComboBox and set as current. Persist `CoordCalibrationYoloCurrentProject` and append to `CoordCalibrationYoloProjectList` in config.

- **Project ComboBox**
  - **Data source**: List of project paths (or project display names). Load from config `CoordCalibrationYoloProjectList` and/or scan `YOLO_DATA_ROOT` for `client_type/project_name` directories. Display: project name or relative path. Value: full project path.
  - **Selection**: On change, set `CoordCalibrationYoloCurrentProject` and refresh the segment list (DataGrid) for this project. Segment list = subdirectories of project path (same as Python `list_segments_from_project`).

- **Open project dir**
  - Open Explorer at the current project path (or selected project path). Use `Process.Start("explorer.exe", projectPath)`.

- **Switch project**
  - Switching = selecting another item in the Project ComboBox. No extra logic beyond loading segment list and saving current project to config.

### 3.4 VocAnnotator and “Open label” (Step 3)

- **Open label (current)**
  - Already opens `AnnotatorWindow(imagesDir, projectPath)`. **imagesDir**: should be the **segment’s images dir** (or frames dir) when user has selected one segment; if no segment selected, use current project path (and AnnotatorWindow will show project-level or first segment). **projectPath**: current project path so that `project_config.json` is loaded (classes, etc.).
  - **Improvement**: If one segment is selected in the DataGrid, pass `segment_path` (or `segment_path/images`) as imagesDir and `project_path` as projectPath. So: imagesDir = selected segment’s `images/` (or `frames/` if images not yet exported), projectPath = current project dir.

- **Optional: Launch standalone VocAnnotator**
  - Use `VocAnnotatorLauncher.Launch(imagesDir, projectPath, hintAppBaseDir)`. Same imagesDir/projectPath as above. Gives user the option to use the full VocAnnotator app (e.g. for “Generate YOLO dataset” menu) if needed.

### 3.5 Capture screenshot (single)

- **BtnCapture**: One-shot capture using `ScreenCaptureService.Gen(gameWindowHwnd)` and save to a user-chosen or default path (or to current project’s current segment `record/` with a single filename). Exact behavior can be: save to segment/record if recording context exists, else open SaveFileDialog. Not required for VocAnnotator workflow but must not break.

### 3.6 Config and YOLO config button

- **BtnYoloConfig**: Open or edit YOLO/recording config: e.g. YOLO_DATA_ROOT, record FPS, default client type. Can be a small dialog or a dedicated config panel; config keys under `coord_calibration.*`.

### 3.7 Import patch

- **Import patch**: “Patch” = external images or annotations to import into a segment or project. Specification: define patch format (e.g. a zip or folder with images + optional JSON/VOC). Copy images into `segment/images/` (or record/) and optionally merge annotations. Can be implemented after Record/Export/Project work.

---

## 4. Data Format Requirements

### 4.1 Directory Layout (YOLO / VocAnnotator compatible)

- **Root**: `YOLO_DATA_ROOT` (config or env). Example: `D:\programing\yolo_data`.
- **Project path**: `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`. Example: `D:\programing\yolo_data\d3_game\my_project\`.
- **Segment path**: `{project_path}/{segment_id}/`. Example: `D:\programing\yolo_data\d3_game\my_project\20250224_120000\`.
- **Segment subdirs** (all under segment path):
  - `record/` — raw recording output (frame images from Record Start/Stop). Naming: e.g. `frame_00001.png`, `frame_00002.png`, or `record_00001.png`. Use PNG for lossless; extension from `ScreenCaptureConstants.DefaultImageExtension` if defined.
  - `frames/` — exported frames for labeling (can be same as record initially, or copy from record at Export). VocAnnotator can use this as “images dir” if no `images/` yet.
  - `images/` — canonical images for labeling (VocAnnotator save dir can be segment path; it will write JSON/VOC next to images or in segment root). After Export, frames sit here. Naming: same as in record/frames (e.g. `frame_00001.png`).
  - `labels/` — YOLO .txt per image (class x_center y_center width height normalized). Filled by VocAnnotator or by “Generate YOLO dataset” step. Optional for MVP.
  - `data.yaml` — Ultralytics format (path, train/val, names). Written when generating YOLO dataset; optional for MVP.
- **Project-level file**: `project_config.json` or `annotator_config.json` under **project path** (not under segment). Python uses `annotator_config.json`; DotCore.VocAnnotator uses `project_config.json` and also looks for `annotator_config.json`. Support both filenames for compatibility.

### 4.2 project_config.json / annotator_config.json

- **Location**: `{project_path}/project_config.json` or `{project_path}/annotator_config.json`.
- **Content** (JSON):
  - `project_name`: string.
  - `classes`: array of strings (e.g. `["object", "button", "icon"]`).
  - `class_colors`: optional object, class name → [R, G, B].
- **DotCore.VocAnnotator**: `ProjectConfig.LoadProjectConfig`, `SaveProjectConfig`, `GetClassesFromProjectDir`. Use these; do not invent a new format.

### 4.3 Per-image annotation (VocAnnotator)

- **JSON** (per image): In segment dir (or save dir), file `{image_basename_without_ext}.json`. Content: `imagePath`, `imageSize` [w, h], `shapes` array. Each shape: `shape_type` ("rectangle"), `label`, `points` ([[x1,y1],[x2,y2]] for rect), `difficult` (0/1). Same as DotCore.VocAnnotator `AnnotationIo.SaveAnnotations` / `LoadAnnotations`.
- **VOC XML**: Optional; one `.xml` per image (GameAISDK format). Written by `AnnotationIo` when `writeVoc: true`. Used for compatibility; YOLO training typically uses `.txt` (see 4.5).
- **YOLO .txt**: One line per object: `class_index x_center y_center width height` (normalized 0–1). Written by `AnnotationIo.ExportYoloDetectionTxt`. Path: `segment/labels/{image_basename}.txt`.

### 4.4 Segment list and metadata

- **Segment list**: List subdirectories of project path. Sort by name descending (newest first) so newest segment appears first. Exclude files; only dirs. Same as Python `list_segments_from_project`.
- **Segment metadata (optional)**: Under `{segment_path}/segment_meta.json`: `{ "frame_count": N, "status": "recorded" | "exported" | "labeled", "created_utc": "..." }`. If present, use for DataGrid Status/Size; else derive from directory (e.g. count files in record/ or images/).

### 4.5 Patch import format

- **Input**: A folder or zip. Folder: contains image files (e.g. .png, .jpg) and optionally same-named .json or .xml annotations. Zip: same structure when extracted.
- **Target**: Selected segment or current project’s new segment. Copy images into `segment/images/`; copy or convert annotations into segment dir (JSON/VOC) so VocAnnotator can load them. Naming: preserve basename; avoid overwrite by appending suffix if needed.

---

## 5. Config Keys (DOT)

- **Existing**: `ConfigKeys.CoordCalibrationClientType`, `CoordCalibrationYoloCurrentProject`, `CoordCalibrationYoloProjectList`.
- **To add** (or confirm):
  - `coord_calibration.yolo_data_root` — string, root for all YOLO projects.
  - `coord_calibration.record_fps` — number, frames per second during recording (e.g. 2).
  - `coord_calibration.record_interval_ms` — alternative to FPS; interval in ms between frames.
- **Project list**: Store as JSON array of strings (full paths) or as a single string with separator. Load/save via `D3CheckConfigService`.

---

## 6. UI Wiring Checklist (CalibrationPanel)

- [ ] **Client mode** (Battle.net / D3 Game / D4 Game): Persist to `CoordCalibrationClientType` on change; use when creating project path and when resolving window for capture.
- [ ] **Record Start**: Ensure project selected; create segment; start background capture loop; write to `segment/record/`; update log and segment list when stopped.
- [ ] **Record Stop**: Stop loop; write segment_meta.json if used; refresh DataGrid.
- [ ] **Project ComboBox**: Load from config + scan YOLO_DATA_ROOT; on selection change save current project and refresh segment list.
- [ ] **Create project**: Dialog or inline name input; create dirs and project_config.json; add to list and select.
- [ ] **Open project dir**: Explorer at current project path.
- [ ] **Refresh**: Re-scan project path for segment subdirs; refresh DataGrid.
- [ ] **Export selected**: For each selected segment, copy record/ (or frames/) → images/; set status.
- [ ] **Open label**: Pass selected segment’s images dir (or frames/) and project path to AnnotatorWindow or VocAnnotatorLauncher.
- [ ] **Merge / Delete**: As per 3.2.
- [ ] **Import patch**: **Done.** Select image in folder → write `patch_data.json` to project (base_dir + items).
- [ ] **BtnCapture**: Single capture; save to segment/record if in recording context, else prompt.
- [ ] **BtnYoloConfig**: Open config for yolo_data_root, record_fps, etc.

---

## 7. Python Side (Incomplete Parts)

- **main.py**: Does not open VOC annotator or recording UI. Optional: add a menu or button that calls `run_voc_annotator(project_path=..., images_dir=...)` when needed; or leave VOC/recording entirely to the DOT client.
- **list_segments_from_project**: Implemented; returns `[(segment_id, segment_path)]`. DOT should mirror this (list subdirs of project path).
- **yolo_data_layout**: Authoritative for path layout. DOT will implement same layout under a configurable root.

---

## 8. Implementation Order (Suggested)

1. **Config**: Add `yolo_data_root`, `record_fps` (or `record_interval_ms`). Implement YOLO config dialog or panel.
2. **Project**: Create project (dirs + project_config.json), load project list (config + scan), ComboBox selection and persistence, refresh segment list.
3. **Recording**: Record Start/Stop, segment id generation, capture loop using ScreenCaptureService, write frames to `segment/record/`, update DataGrid and log.
4. **Export**: Export selected segments (record → images), optional segment_meta.json.
5. **Open label**: Pass segment images dir and project path when a segment is selected; keep in-process AnnotatorWindow as default.
6. **Merge, Delete, Import patch**: After core flow works.

---

## 9. References (Official / Project)

- **WPF / .NET**: [BitmapEncoder](https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.imaging.bitmapencoder) for encoding frames to PNG/JPEG if saving from in-memory bitmap. `DotCore.ScreenCapture.ScreenCaptureService.SaveToFile(Bitmap, path)` already saves by extension.
- **DotCore.VocAnnotator**: `AnnotationIo`, `ProjectConfig`, `VocIo`, `VocAnnotatorConfig`, `VocAnnotatorLauncher` — use as-is for formats and project/annotator logic.
- **Python**: `pycore/pyutils/voc_annotator/yolo_data_layout.py`, `main_window.py` (`list_segments_from_project`, `run_voc_annotator`), `pycore/pyutils/common/ultralytics_comm/layout.py` (IMAGES_SUBDIR = "images", LABELS_SUBDIR = "labels", DATA_YAML_NAME = "data.yaml").

This document is the single source of truth for logic and data formats; implementation must follow it and update this spec if the design evolves.

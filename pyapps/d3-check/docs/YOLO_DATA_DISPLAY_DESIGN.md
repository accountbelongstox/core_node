# YOLO Data Display & Operation Area (GameAISDK-aligned)

Design derived from GameAISDK doc (PyLibUsage.md, action_sampler output layout, TrainDetModel.md).

---

## 1. GameAISDK data model

### 1.1 Project and segment (from PyLibUsage + action_sampler)

- **SavePath**: Root directory passed at record start. No "project name" in API—project = directory.
- **GameName**: Config key, we use `"output"`. Segment dir = `SavePath/output/<timestamp>/`.
- **Segment**: One folder per segment: `project_path/output/<YYYY-MM-DD_HH_MM_SS>/`
  - Contents: `data.csv` + per-frame `.jpg` **or** `video.avi` (by `OutputAsVideo`).
  - After export: optional `frames/` subdir with extracted/copied images for labeling.

So: **one project (one root path) → many segments (timestamp subdirs)**. Multiple video segments under one project is the normal case; training (TrainDetModel) uses "multiple segments → cut to images → label → train".

### 1.2 Namespace: one project per client type (optional named subprojects)

- Current: one project per client = `data/yolo_record/<client_subdir>` (e.g. d3_game, d4_game, battlenet).
- Optional extension: named subprojects = subdirs under client, e.g. `d3_game/quest_ui`, `d3_game/combat`; user can create/select project. Not required for "multiple segments in one project"—segments are already under one project.

### 1.3 Merge meaning

- **Merge selected segments**: Export multiple segments into **one target folder** (with per-segment frame prefix to avoid name clash) so one labeled dataset can be built from many segments. Aligns with TrainDetModel "多段 → 切图 → 标注".

---

## 2. Display and operation design

### 2.1 Project row

- Show **current project path** (shortened) and optionally a control to open project dir.
- Current project = last record project or default by client type. No project "list" in minimal design; optional later: dropdown of named subprojects.

### 2.2 Segment table

- Columns: **Segment** (timestamp) | **Path** (short) | **Frames** | **Status** (raw / exported).
- Data: `list_segments(project_path)`, `segment_info(segment_path)`.
- Multi-select (Ctrl/Shift) for batch actions.

### 2.3 Toolbar

- **Refresh**: Reload segment list.
- **Export selected**: For each selected segment, run `compose_segment_to_frames`; then open first exported `frames/` for labeling.
- **Open label**: First selected segment: ensure frames exported, open `frames/` in explorer.
- **Merge selected**: Choose target folder via dialog; export each selected segment’s frames into that folder with prefix `seg_<i>_` (e.g. `seg_0_frame_000000.png`); open target folder for labeling.
- **Open project dir**: Open `project_path` (or `output/`) in explorer.

### 2.4 Segment right-click menu

- **Open folder**: Open segment dir in explorer.
- **Export frames**: `compose_segment_to_frames(segment_path)`.
- **Open for labeling**: Export if needed, then open `frames/` in explorer.
- **Delete segment**: Delete segment folder on disk (with confirmation). GameAISDK does not manage segments—they are plain dirs; safe to delete when not recording.

### 2.5 Constraints

- **Delete segment**: Only when not recording (disable or hide when `is_recording()`).
- **Merge**: Target folder must be empty or user-confirmed overwrite; frame names prefixed by segment index to avoid clashes.

---

## 3. Implementation mapping

| Feature            | Module / API |
|--------------------|--------------|
| List segments      | `yolo_record.list_segments(project_path)` |
| Segment info       | `yolo_record.segment_info(segment_path)` |
| Export one segment | `yolo_record.compose_segment_to_frames(segment_path)` |
| Open for labeling  | `yolo_record.open_frames_dir_for_labeling(frames_dir)` |
| Delete segment     | New: `yolo_record.delete_segment(segment_path)` → remove dir (confirm in UI). |
| Merge selected     | New: `yolo_record.merge_segments_to_folder(segment_paths, target_dir)` → export each with prefix, return merged frames dir. |
| Project path       | `_last_record_project_path` or default from client type. |

---

## 3.5 Labeling and dataset (TrainDetModel alignment)

- **Labeling**: GameAISDK doc uses **labelImg**; 打开目录 = image dir (e.g. segment `frames/` or merged folder), 存放目录 = XML save dir. One XML per image; one image can have multiple `<object>` labels.
- **Dataset**: One folder of images + one folder of XML (or same folder) + **one class list**. Merging multiple segments into one folder = one dataset; user labels with one consistent class list.
- **Labeled status**: Segment is labeled when `frames/` contains at least one `.xml` or `.txt`. See `yolo_record.segment_has_labeled(segment_path)`.

---

## 4. Optional future: named projects

- List projects = list subdirs of `data/yolo_record/<client>/` (or allow one level of nesting).
- "New project" = create subdir; "Current project" = dropdown or list selection.
- Record uses selected project path as SavePath. No change to GameAISDK API.

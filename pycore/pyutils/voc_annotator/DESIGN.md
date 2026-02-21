# VOC Annotator Design (pycore, PySide6, GameAISDK + YOLO compatible)

## 1. Purpose

Provide an in-project image annotation tool equivalent to labelImg, implemented in **pycore** with **PySide6** (project standard). Supports **rectangle** (VOC/GameAISDK detection), **polygon**, **ellipse**, **circle**, and **custom polygon** for segmentation/OBB. Output conforms to **GameAISDK** VOC XML (detection) and is exportable to **YOLO detection/segmentation** formats.

References: labelImg; GameAISDK doc/YOLO/TrainDetModel.md; Ultralytics docs (detect: bbox; segment: polygon; NDJSON OBB); GameAISDK SDKTool shape (RECT, POLYGON, etc.); labelme (polygon/rectangle/circle/line/point).

## 2. Requirements (from user and docs)

- **Display**: Center image with default size; **zoom in/out** buttons; **persist zoom %**; show current zoom in UI.
- **Left list**: **Thumbnail + filename**; **right-click delete** only when image has **no annotations** (no XML or empty objects).
- **Project/config**: Open with **project_name** and **config_path** (passed by d3-check); load config **immediately**; **one project → multiple segments → shared classes**; add class names and persist to config.
- **Class list**: Show **item names** from config; **click** one to set as current class for new shapes; can **add** class (saved to config); **one image** can be labeled with **multiple classes** by switching current class.
- **Shapes**: Support **rectangle** (current), **polygon**, **ellipse**, **circle**, **custom polygon**; store per GameAISDK + YOLO conventions; export detection (VOC/YOLO bbox) and segmentation (YOLO polygon).
- **Stack**: PySide6 only; third-party via pycore; code/comments in English.

## 3. LabelImg parity (reference)

- **UI**: Open Dir (Ctrl+u), Change save dir (Ctrl+r), Create RectBox (w), Save (Ctrl+s), Next (d), Prev (a), Copy box (Ctrl+d), Delete box (del), **Zoom in (Ctrl++)**, **Zoom out (Ctrl+-)**, Fit window, Original size.
- **Settings**: Stored in `.labelImgSettings.pkl` (or similar); we use a JSON config under pycore/user config dir for zoom and last paths.
- **Zoom**: labelImg has zoom widget and fit window / fit width; we add explicit default size, +/- buttons, and **persist zoom %** so next run opens at that scale.

## 4. GameAISDK annotation data format (VOC XML)

Per TrainDetModel.md and voc_label.py / yolo_label_lib:

- One XML file per image: `{image_id}.xml` in the chosen save dir (same base name as image, extension .xml).
- Structure (Pascal VOC):

```xml
<annotation>
  <folder>FolderName</folder>
  <filename>image.png</filename>
  <path>/absolute/path/to/image.png</path>
  <source><database>Unknown</database></source>
  <size>
    <width>1280</width>
    <height>720</height>
    <depth>3</depth>
  </size>
  <segmented>0</segmented>
  <object>
    <name>ClassName</name>
    <pose>Unspecified</pose>
    <truncated>0</truncated>
    <difficult>0</difficult>
    <bndbox>
      <xmin>780</xmin>
      <ymin>242</ymin>
      <xmax>890</xmax>
      <ymax>360</ymax>
    </bndbox>
  </object>
  <!-- more <object> ... -->
</annotation>
```

- **bndbox**: Pixel coordinates (xmin, ymin, xmax, ymax); integer or float.
- **difficult**: 0 or 1; training may exclude difficult (yolo_label_lib skips difficult==1 when converting to YOLO).
- **truncated**: 0 or 1.
- **depth**: Typically 3 for RGB.

This format is read by GameAISDK `voc_label.py` and `yolo_label_lib.voc_annotations_to_yolo_labels()`; no change to those pipelines.

## 5. Zoom and config persistence

- **Default zoom**: On first run or no saved config, display image at **100%** (1:1) or a defined default scale (e.g. 100%).
- **Zoom in / Zoom out**: Buttons (and optional Ctrl+/Ctrl-) step scale (e.g. 10% or 25%); clamp to a min/max (e.g. 25%–400%).
- **Display**: Show current scale as **"100%"** (or "75%", "125%") in status bar or next to zoom buttons.
- **Persist**: On zoom change (or on window close), write to config:
  - Key: e.g. `voc_annotator.zoom_percent` (integer 25–400).
  - Config file: pycore user config (e.g. under `~/.core_node/` or existing pycore config path) in a JSON file, e.g. `voc_annotator_config.json`.
- **Load**: On startup, read `zoom_percent`; apply when loading first image so the canvas opens at that scale.

## 6. Module layout (pycore)

- **Path**: `pycore/pyutils/voc_annotator/`
- **Public API**:
  - `run_voc_annotator(images_dir: str, save_dir: Optional[str] = None, classes: Optional[List[str]] = None) -> None`
    - Opens PySide6 window; loads image list from `images_dir`; save XMLs to `save_dir` (default `images_dir`); optional predefined `classes`.
  - Optional: `get_pyside6_app()` if we need to run inside existing QApplication.
- **Files**:
  - `__init__.py`: export `run_voc_annotator`, version.
  - `config.py`: load/save zoom and paths (JSON); default zoom 100.
  - `voc_io.py`: read image size; read/write VOC XML (GameAISDK detection).
  - `annotation_io.py`: load/save unified JSON (shapes: rectangle, polygon, ellipse, circle); export VOC XML from rectangles; `load_annotations`, `save_annotations`, `shapes_to_boxes`, `boxes_to_shapes`.
  - `project_config.py`: load/save project config (project_name, classes) at config_path.
  - `main_window.py`: PySide6 QMainWindow – menu, toolbar (Zoom, Shape modes: Rect/Polygon/Ellipse/Circle, Save, Class list), thumbnail file list, class list, canvas.
  - `canvas.py`: QWidget – draw shapes at scale; modes: rectangle (drag), polygon (click + Enter to close), ellipse/circle (drag); store shapes (shape_type, label, points, difficult); get_boxes/get_shapes for VOC and JSON.
  - `DESIGN.md`: this document.

- **Dependencies**: PySide6 via `get_third_package_pyside6()` at top level; stdlib xml.etree.ElementTree for VOC; no PyQt5, no labelImg import.

## 7. Thread and app lifecycle

- Run in main thread: `run_voc_annotator()` creates `QApplication` if not existing, then `MainWindow`, then `app.exec()`. Call from host (d3-check/GameAISDK) as a blocking call or from a dedicated process; if host already has Qt, we may accept an optional `QApplication` instance (future).
- For d3-check: may be launched in-process (same process as Tk) or in subprocess. When run in-process, Windows may log "SetProcessDpiAwarenessContext() failed: Access is denied" because the process DPI context was already set by Tk; see §24 for the mitigation.

## 8. Class list and predefined classes

- Predefined classes: optional list of strings (e.g. `["Enemy", "House"]`); shown in combo or list for quick pick when creating a box. If not provided, user can type new class name (we allow dynamic classes and append to list for the session).
- Persist class list: optional; can save to same config file or a `predefined_classes.txt` in save dir per labelImg convention for compatibility.

## 9. Project / segment / classes (GameAISDK + YOLO layout)

- **One project name**: e.g. `d3_game`; used as display and for dataset root.
- **Multiple segments**: each segment = one images dir + one labels dir (VOC XML). d3-check exports frames per segment (e.g. `project/output/seg_0_.../frames/`).
- **One annotator config** (classes) shared across segments: d3-check passes `config_path` (e.g. `{project_path}/annotator_config.json`). Annotator loads it on open and saves when user adds a class.
- **Data layout on disk** (YOLO/GameAISDK compatible):
  - Project root: `{project_path}/` (e.g. d3-check `YOLO_RECORD_BASE_DIR/d3_game` or SDKTool `project/<name>/`). In d3-check, **project path can be any directory**: default is `YOLO_RECORD_BASE_DIR/{client_type}`; user can **create** a project by choosing a **new directory as base path** (folder picker), or **load** an existing directory.
  - Config: `{project_path}/annotator_config.json` with `project_name`, `classes`.
  - Segment: `{project_path}/output/<segment_id>/frames/` (images), same dir or `labels/` for XML (per-call images_dir/save_dir).
  - VOC XML per image (GameAISDK §4); conversion to YOLO txt via `voc_annotations_to_yolo_labels`; training uses `data/voc.names` or Ultralytics data.yaml `names` (one project, multiple segments, shared classes).

- **d3-check project namespace (YOLO data panel)**:
  - **Standard path**: `YOLO_RECORD_BASE_DIR/{client_type}` (e.g. `.../yolo_record/d4_game`). All **direct subdirectories** under this path are treated as projects and listed in the dropdown.
  - **Project dropdown**: A **list** of projects: **scanned standard path** (all subdirs under standard path) **+ cache** (paths opened via “载入项目”, i.e. non-standard paths). User can **switch** by selecting an item, or use **新建** / **载入项目** from the same menu.
  - **载入项目 (Load project)**: Opens **non-standard path** — folder picker to select any directory; that path is added to **cache** and set as current. Cache is persisted in `coord_calibration.yolo_project_list`.
  - **打开项目目录 (Open project dir)**: Opens the **current** project’s directory in explorer (no path picker).
  - **新建**: New directory as base path (folder picker); path becomes project root; if under standard path it will appear in next dropdown scan.
  - **Current project**: Persisted in `coord_calibration.yolo_current_project`. Dropdown = scan(standard path) + cache, then 新建 / 载入项目.

## 10. Annotator config file (passed by d3-check)

- **Path**: Caller passes `config_path`; if present, load on startup and use for classes; save when user adds a class.
- **Format**: JSON `{"project_name": "my_project", "classes": ["Enemy", "Door", "Item"]}`.
- **Module**: `project_config.py` — `load_project_config(config_path)`, `save_project_config(config_path, project_name, classes)`.

## 11. Left panel: thumbnail list and right-click delete

- **List content**: Each item shows a **thumbnail** (small preview) and **filename**. Use `QListWidget` with `setIcon` (QIcon from scaled QPixmap) + `setText`; load thumbnails on demand or when loading list (e.g. 64–96 px height).
- **Right-click menu**: "Delete image". **Only allowed when the image has no annotations**: no VOC XML file, or XML exists but has zero `<object>` elements. If annotated, menu item disabled or show message. On delete: remove image file from disk, remove XML if present, remove item from list and update current index.

## 12. Class list (item names) and current class for drawing

- **Source**: Load from `config_path` on open; user can **add** new class names (persisted to config).
- **UI**: Dedicated **class list** ("Classes (click to label):") in the right panel showing all class names. **Click** a class = set as **current class** for new boxes. No toolbar Class combo or "Set class for selected" button; current class is chosen only from this list.
- **Info area**: Above the class list, an **info area** shows the **current labeling class** and its **annotation color** (swatch). It updates automatically when the user selects a class in the list. Used for displaying other necessary info as needed.
- **Behavior**: When user draws a new rect, the new box is assigned the **current class** (no prompt). User can switch current class by clicking another class in the list; the info area and drawing color update immediately.
- **Persistence**: New classes added in session are appended to list and saved to `config_path` so multiple segments share the same names.

## 13. Shape types: polygon, ellipse, circle, custom (GameAISDK + YOLO)

Supported annotation shapes and how they map to GameAISDK / Ultralytics YOLO:

| Shape       | Description | Storage (points) | YOLO detection | YOLO segment / OBB |
|------------|-------------|------------------|----------------|---------------------|
| **rectangle** | Axis-aligned box (drag). | `[xmin, ymin, xmax, ymax]` or 4 corners. | Yes: `class x_center y_center w h` (normalized). | Bbox used as 4-point OBB or polygon. |
| **polygon** | Free polygon: click vertices, close with Enter/double-click. Min 3 points. | List of `[x, y]` pixel coords. | Use tight bbox. | Yes: `class x1 y1 x2 y2 ... xn yn` (normalized, Ultralytics segment format). |
| **ellipse** | Ellipse: center + two axes (e.g. drag bounding ellipse). | Center `(cx, cy)` + radii `(rx, ry)` or 4 points. | Use tight bbox. | Sample N points on boundary → polygon → YOLO seg. |
| **circle** | Circle: center + radius (e.g. center click + drag). | Center `(cx, cy)` + radius `r` or 2 points. | Use tight bbox. | Sample points on circumference → polygon → YOLO seg. |
| **custom** | Same as polygon (arbitrary vertex count). | Same as polygon. | Same as polygon. | Same as polygon. |

- **Reference**: Ultralytics segment format (docs): one `.txt` per image, each row `class_id x1 y1 x2 y2 ...` normalized [0,1]; min 3 points per polygon. GameAISDK SDKTool `shape.py`: RECT, LINE, POINT, POLYGON; labelme: polygon, rectangle, circle, line, point.
- **UI**: Toolbar or mode selector: **Rectangle** (default) | **Polygon** | **Ellipse** | **Circle**. Polygon: click to add vertex, Enter or double-click to close. Ellipse/Circle: drag to define (e.g. center then axes/radius). Current class applies to new shape.

## 14. Unified annotation storage and export

- **Primary storage**: One **JSON file per image** (e.g. `{image_id}.json`) so all shape types can be stored in one place. Structure (labelme-like):

```json
{
  "imagePath": "image.png",
  "imageSize": [width, height],
  "shapes": [
    {
      "shape_type": "rectangle",
      "label": "Enemy",
      "points": [[xmin, ymin], [xmax, ymax]],
      "difficult": 0
    },
    {
      "shape_type": "polygon",
      "label": "Item",
      "points": [[x1,y1], [x2,y2], ...],
      "difficult": 0
    },
    {
      "shape_type": "ellipse",
      "label": "Target",
      "points": [[cx, cy], [rx, ry]]
    },
    {
      "shape_type": "circle",
      "label": "Target",
      "points": [[cx, cy], [r, 0]]
    }
  ]
}
```

- **Backward compatibility**: Continue to **read/write VOC XML** for rectangle-only workflows (GameAISDK detection). When only rectangles exist, save as VOC XML as today; when any polygon/ellipse/circle exists, save to JSON and optionally export rectangles to VOC XML.
- **Export**:
  - **VOC XML**: All rectangles only (same as current); used by `voc_annotations_to_yolo_labels` for detection.
  - **YOLO segment .txt**: One file per image; each row `class_id x1 y1 x2 y2 ...` (normalized); polygons and ellipse/circle (sampled to polygon) from JSON.
  - **YOLO OBB** (if needed): Rectangles as 4 corners; ellipses/circles as sampled polygon; Ultralytics NDJSON format `[class_id, x1,y1,x2,y2,x3,y3,x4,y4]` for 4-corner OBB.

- **Data layout** (unchanged): One project name → multiple segments → shared config (classes) → each segment: images + annotation files (VOC XML and/or JSON). Same directory or `labels/` for outputs.

## 15. Image size and training (Ultralytics official)

- **Annotation**: No recommended or required image size. Use **any resolution** for labeling; coordinates are stored in pixels and **exported as normalized [0,1]** (divide by image width/height), so the YOLO format is resolution-agnostic.
- **Training**: Ultralytics training **resizes images automatically**. Default `imgsz=640`: "Target image size for training. Images are resized to squares with sides equal to the specified value." So **no need to resize or crop images** before annotation or before training; the pipeline uses original images for annotation and the trainer resizes at training time (e.g. 640×640).
- **Model**: Docs recommend YOLO26 (NMS-free, end-to-end) and YOLO11 for stable production; examples use `yolo26n.pt`, `yolo26n.yaml`, `imgsz=640`.

## 16. Training data directory (official layout)

- **Root**: Training data is placed under a single root, e.g. `D:\programing\yolo_data`, then by **project** and **segment**: `{YOLO_DATA_ROOT}/{project_name}/{segment_id}/`.
- **Per-segment layout** (Ultralytics): Under each segment dir, use **images/** and **labels/** at the same level so the loader finds labels by matching base name (e.g. `images/train/img1.jpg` → `labels/train/img1.txt`). For a single split per segment: `images/` (all images), `labels/` (all YOLO .txt), and a **data.yaml** with `path: .`, `train: images`, `val: images`, `names: {0: class0, ...}`.
- **data.yaml** (dataset config): `path` = dataset root (segment dir), `train` / `val` = dirs or .txt file lists relative to `path`, `names` = dict of class_id to class name. Training uses this file; images are auto-resized by `imgsz`.

## 17. Data format compliance (official specs)

- **VOC XML (GameAISDK TrainDetModel.md §4)**: We output exact structure: `<annotation>`, `<folder>`, `<filename>`, `<path>`, `<size>` (width, height, depth), `<segmented>0</segmented>`, `<object>` with `<name>`, `<pose>`, `<truncated>`, `<difficult>`, `<bndbox>` (xmin, ymin, xmax, ymax in pixels). Consumed by `voc_annotations_to_yolo_labels` and `voc_label.py`.

- **YOLO detection .txt (Ultralytics + GameAISDK §5)**: One file per image; each row `class_id x_center y_center width height` with coordinates **normalized to [0, 1]** (divide by image width/height). Class index **zero-based**. Formula: `x_center = (xmin+xmax)/2 / width`, same for y and w, h. GameAISDK `_convert_box` and pycore `export_yolo_detection_txt` use this.

- **YOLO segment .txt (Ultralytics segment docs)**: One file per image; each row `class_id x1 y1 x2 y2 ... xn yn` with polygon vertices **normalized [0, 1]**; minimum **3 points** per object. pycore `export_yolo_segment_txt` and GameAISDK `annotations_to_yolo_segment` (from JSON) produce this.

- **Dataset layout (Ultralytics)**: Prefer **images/** and **labels/** as separate folders at same level; label files match image base name (e.g. `image1.jpg` → `image1.txt`). Our save_dir can be the same as images dir or a dedicated labels dir.

## 18. pycore ultralytics vs voc_annotator: complement and allocation

**Official (MCP/docs)**: Ultralytics YOLO format = data.yaml (path, train, val, names); labels = one .txt per image, normalized [0,1]; detect = `class x_center y_center width height`; segment = `class x1 y1 x2 y2 ...` (min 3 points). Train/val can be dirs (e.g. images/train, images/val) or flat (images/). YOLO26/YOLO11, imgsz=640.

### 18.1 pycore/pyutils/ultralytics (training and dataset generation)

- **annotation_to_yolo_dataset**: Input = list of **entries** (each: `image_path` or `image` PIL, `annotations` list with `class_id`, `type` = rect|circle|polygon, and rect: x,y,width,height; circle: x,y,radius; polygon: vertices). Output = full dataset with **train/val split**: `output_dir/images/train`, `images/val`, `labels/train`, `labels/val`, `data.yaml` (path, train, val, nc, names). Use case: in-memory or pre-collected annotations → one-shot YOLO dataset with split.
- **dataset_generator_yolo**: **Classification** (yes/no from coordinates or patches), **Detection** (paste patches on backgrounds → images/, labels/, data.yaml). Use case: synthetic data from screenshots + coordinates, not from manual annotation.
- **DetectionTrainer / UnifiedTrainer**: Load metadata (coordinates, background_images), prepare data (DetectionDatasetGenerator or external), then `YOLO().train(data=...)`. Use case: pipeline from “source dir + metadata” to trained model.
- **build_train_command**: Returns CLI string for `ultralytics train` (model, data, epochs, imgsz, batch, device).

### 18.2 pycore/pyutils/voc_annotator (annotation UI and per-image export)

- **GUI**: Label images (rect, polygon, ellipse, circle); store **JSON per image** (shapes with shape_type, label, points) and optionally **VOC XML** (rectangles only).
- **annotation_io**: `load_annotations` / `save_annotations` (JSON + VOC); **export_yolo_detection_txt**, **export_yolo_segment_txt** (single image, normalized [0,1]). No train/val split.
- **yolo_data_layout**: **YOLO_DATA_ROOT**, **get_yolo_data_dir(project_name, segment_id)**, **ensure_yolo_segment_dirs**, **write_data_yaml**. Segment-centric layout: `yolo_data/{project}/{segment}/images/`, `labels/`, `data.yaml`. Use case: d3-check “one segment” export; path and data.yaml for training.

### 18.3 How they complement

| Need | Where it lives | Note |
|------|------------------|------|
| Label images (any size) | voc_annotator | UI + JSON/VOC + per-image YOLO .txt export |
| Dataset path and data.yaml for one segment | voc_annotator (yolo_data_layout) | project/segment → images/, labels/, data.yaml |
| Train/val split from many images | ultralytics (annotation_to_yolo_dataset) | entries → images/train, images/val, labels/train, labels/val |
| Synthetic detection data (paste patches) | ultralytics (DetectionDatasetGenerator) | coordinates + backgrounds → images + labels |
| Run YOLO train | ultralytics (DetectionTrainer, build_train_command) | data=path/to/data.yaml, imgsz=640 |

**Bridge**: voc_annotator output (images_dir + save_dir with JSON) can be converted to **entries** in the format expected by `annotation_to_yolo_dataset` (class_id, type rect|circle|polygon, coords). Then `generate_yolo_dataset(entries, class_names, output_dir, train_ratio)` produces a dataset with train/val split. So: **voc_annotator** = source of truth for manual labels; **ultralytics** = consumer for “full dataset with split” when needed. Bridge lives in voc_annotator: e.g. `load_entries_for_ultralytics(images_dir, save_dir, classes)` → entries for `generate_yolo_dataset`.

### 18.4 Functionality allocation (no duplicate responsibility)

- **voc_annotator**: (1) Annotate: any image size; (2) Store: JSON + VOC; (3) Export: per-image YOLO det/seg .txt; (4) Layout: yolo_data_layout (path, dirs, data.yaml for one segment); (5) Bridge: build entries from annotator dir for ultralytics.
- **ultralytics**: (1) Generate dataset with train/val from entries; (2) Generate synthetic detection/classification data; (3) Train: DetectionTrainer, build_train_command; (4) No UI; no per-image load/save.
- **d3-check / GameAISDK**: Orchestrate: open annotator (voc_annotator), VOC→YOLO or “prepare training dir” (yolo_data_layout + flow5), optionally merge segments and call ultralytics generate_yolo_dataset.

### 18.5 voc_annotator adapting to Ultralytics

- Export format already matches: normalized [0,1], one .txt per image, no .txt when zero objects.
- data.yaml: written by yolo_data_layout with path, train, val, names (and nc for compatibility).
- Ellipse: annotator stores ellipse; segment export samples polygon; entry bridge converts ellipse → polygon vertices so ultralytics receives only rect/circle/polygon.
- Single source for dataset config: yolo_data_layout.write_data_yaml; ultralytics does not write segment-level data.yaml.

## 19. Summary

| Item            | Choice                                                                 |
|-----------------|------------------------------------------------------------------------|
| GUI             | PySide6 (QMainWindow, QWidget canvas, QToolBar, QListWidget file list) |
| Default size    | 100% (1:1); configurable default in config                            |
| Zoom            | Zoom in / Zoom out buttons; show percentage; persist to config         |
| Config          | JSON under pycore user dir; keys: zoom_percent, last_images_dir, last_save_dir |
| Project config  | JSON at config_path: project_name, classes; load on open, save on add class |
| Left list       | Thumbnail + filename; right-click delete only if image has no annotations |
| Class list      | Load from config; click to set current class; add class persists to config |
| Shape types     | rectangle, polygon, ellipse, circle, custom (polygon); mode in toolbar |
| Storage         | JSON per image (shapes[] with shape_type, label, points); VOC XML for rect-only |
| Output format   | GameAISDK VOC XML (rectangles); YOLO seg .txt (polygons, normalized); YOLO det from VOC |
| Entry           | `run_voc_annotator(..., project_name=None, config_path=None)`         |
| Launch from host| Subprocess; host passes project_name, config_path for shared config   |
| Compliance       | VOC XML = GameAISDK §4; YOLO det/seg = Ultralytics normalized [0,1], zero-indexed class |
| Undo            | Per-image history stack (max 50); Undo button under each card; redraw + cache_changed for global tables |
| Layout          | Side panels max width; center 1/2 columns by width (≥640px → 2 cols, 50% each); title below image; default one class selected |

## 20. 补丁图 (patch data) and dataset generation

- **补丁图**: Project-level, **multiple sources** (like segments). Stored in `patch_data.json` as `sources: [{base_dir, items: [{file, class}]}, ...]`. Each source = one directory or one file; adding a folder or a single image adds a new source. Shared by all segments. Default class = filename (stem). **Unified management in VOC Annotator (File)**: File → "Load patch images (补丁图)" / panel "Load external dir" add sources; list shows all items from all sources; double-click edit class, "Merge selected to same class", "Remove selected". d3-check step2 has "导入补丁图" (Import one image / Import folder) to add sources; patch data is the same file, managed in VOC Annotator.
- **Generation**: "Generate YOLO dataset" exports (1) annotated large images, (2) if patch data exists and num_synthetic > 0: paste from all sources via `get_patch_items_flat()`, (3) write `data.yaml`. Format follows Ultralytics YOLO dataset layout.

## 21. Annotation tables: global table and per-image list

- **Global annotation table (总表)**: Left panel showing **all annotations** across all images. Columns: Image (filename), Class, Type (rectangle/polygon/ellipse/circle), Position (bbox or point count), Color (background color matching class color). Double-click a row to activate/focus that image in the waterfall. **Right-click** a row → "Delete (删除)" to remove that annotation from cache, redraw the canvas, and refresh both tables. Updates automatically when annotations change.
- **Per-image annotation list (当前图标注)**: Bottom panel below waterfall, showing annotations for the **currently active image** (focused canvas). Same columns as global table plus Index. Supports **deletion**: select row(s) and click "Delete Selected" to remove annotations from cache and canvas. Double-click to select annotation in canvas. When user clicks an image card, this area shows only that image's annotations. Updates when a different image is activated (canvas focus changes).
- **Color display**: Both tables show class colors as background color in the "Color" column, matching the color used for drawing shapes on images. Colors are assigned randomly when a class is added and persisted in `class_colors` in project config.
- **Synchronization**: Tables update automatically via `cache_changed` signal from waterfall when any card's annotations change. When deleting from per-image list or from global table (right-click), the annotation is removed from cache, canvas is updated, and both tables refresh.
- **Module**: `annotation_table.py` — `GlobalAnnotationTable`, `ImageAnnotationList`. Integrated in `main_window.py` layout: left = global table, center = waterfall + per-image list (vertical splitter), right = class panel.

## 22. Per-image Undo (撤销) and annotation history

- **Undo button**: Each image card has an **"Undo (撤销)"** button below the filename. Undo applies only to that image's annotations.
- **Per-image annotation history**: In memory, each image has an **annotation history stack** (queue of previous states). A state is a full copy of the shapes list for that image. When the user adds, edits, or deletes a shape, the **current** state (before the change) is pushed onto that image's stack (max 50 states per image). When the user clicks Undo, the last state is popped, the cache and the card's canvas are set to that state, the canvas is redrawn, and `cache_changed` is emitted so the global table and per-image list update.
- **Data**: Only the current state is persisted (save to JSON/VOC); the history stack is in-memory only and is cleared when the segment or image list is reloaded.
- **Implementation**: `WaterfallFlowWidget` holds `_annotation_history: Dict[str, List[List[Dict]]]` (image_path → list of past shapes lists). In `_on_card_shapes_changed`, before updating the cache, push a deep copy of the current cache state for that image; then update cache. On `_undo_for_image(image_path)`, pop from history, set cache and card canvas to that state, emit `cache_changed`. A flag `_undo_in_progress` prevents the canvas's `set_shapes` emission from pushing again. Module: `waterfall_flow.py` — `ImageCardWidget` (Undo button), `WaterfallFlowWidget` (history and `_undo_for_image`).

## 23. Layout and responsive behavior

- **Side panels (max width)**: Left panel (global table) and right panel (class list + patch) have **maximum width** (e.g. 380px and 240px) so that when the UI is fullscreen they do not grow proportionally; the center area takes the remaining space.
- **Center image area**: The waterfall shows image cards in a grid. **Responsive columns**: when the center width is **≥ 640px**, the grid uses **2 columns** (each card gets 50% of the width); when narrower, **1 column** (100% width). Column count is updated on container resize.
- **Card layout**: Each card shows the image at **100% of the card width** with proportional height (aspect ratio preserved); the **title (filename)** is displayed **below** the image; then the **Undo** button. Cards are resizable with the layout (size policy Expanding horizontally).
- **Default class**: On startup, if the project has at least one class, the first class is selected in the class list and set as the default for drawing; the info area shows that class and its annotation color.

## 24. Windows DPI (SetProcessDpiAwarenessContext failed)

- **Symptom**: When the annotator runs in the same process as a host that already set DPI awareness (e.g. d3-check with Tk), Qt 6 may log: `SetProcessDpiAwarenessContext() failed: Access is denied` (Qt defaults to Per-Monitor DPI Aware V2; Windows allows only one such call per process).
- **Mitigation**: Before creating `QApplication`, we set `QT_QPA_PLATFORM=windows:dpiawareness=1` (System DPI aware) when not already set, so Qt does not try to switch to Per-Monitor V2. See Qt 6 High DPI docs: https://doc.qt.io/qt-6/highdpi.html#configuring-windows (qt.conf `[Platforms] WindowsArguments = dpiawareness=0,1,2`).
- **Optional**: If the warning persists, the user can add a `qt.conf` next to the Python executable with:
  `[Platforms]` and `WindowsArguments = dpiawareness=1`.

# VOC Annotator (Dot) – Design Audit

Audit of DotCore.VocAnnotator and d3check integration against project design docs and YOLO/annotator data flow. Goal: **use class library to open Annotator (in-process window)**, not command-line/process launch; ensure data structures and logic are self-consistent.

---

## 1. Design documents and data flow (reference)

| Doc | Content |
|-----|--------|
| **VOC_ANNOTATOR_DOT_VS_PYCORE.md** | Shared logic in dotcore; d3check uses it; "Open label" → **open annotator window** (WPF), not subprocess. |
| **YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md** | Data: CONFIG → _get_yolo_current_project() → flow3_open_label_tool(project_path). Python run_voc_annotator(project_path, images_dir, ...) is a **library call** (window in same or pumped process). |
| **YOLO_UNIFIED_DIRECTORY_DESIGN.md** | Project tree: `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`; segment: `record/`, `frames/`, `images/`, `labels/`, `data.yaml`; project-level `annotator_config.json`. |
| **pycore yolo_data_layout.py** | YOLO_DATA_ROOT; get_yolo_project_path, get_yolo_segment_path, get_yolo_images_dir, get_yolo_labels_dir, ensure_yolo_segment_dirs, write_data_yaml. |
| **DOT_ARCHITECTURE.md** | Apps reference only dotcore; no app-to-app references. |

**Python annotator entry:** `run_voc_annotator(images_dir, save_dir, classes, project_name, config_path, project_path)` — creates `VOCAnnotatorWindow` with those params; blocks or uses `event_pump_schedule`. No subprocess in the library API.

---

## 2. Incomplete or inconsistent design points (dot)

### 2.1 Integration method: process vs class library

- **Intended (VOC_ANNOTATOR_DOT_VS_PYCORE §4.2):** "Open label → open **annotator window** (WPF window)" using dotcore, not subprocess.
- **Current (fixed):** d3check "Open label" creates and shows **AnnotatorWindow(imagesDir, projectPath)** in-process; uses DotCore.VocAnnotator only. VocAnnotatorLauncher kept for standalone VocAnnotator.exe (CLI/shell).
- **Conclusion:** Integration is class library; no CLI/process for in-app flow.

### 2.2 YOLO data layout in dot

- **Pycore:** `yolo_data_layout.py` — YOLO_DATA_ROOT, get_yolo_*_path, get_yolo_images_dir, get_yolo_labels_dir, ensure_yolo_segment_dirs, write_data_yaml.
- **Dot:** DotCore.VocAnnotator has **DataYamlWriter.WriteDataYaml** and **AnnotationIo.ExportYoloDetectionTxt**; no path helpers (get_yolo_segment_path etc.). Callers build paths; data.yaml and YOLO .txt format match Ultralytics.
- **Conclusion:** data.yaml and YOLO export in place; path helpers optional backlog.

### 2.3 Data structures and I/O consistency

- **Annotation shape:** Python and dot both use shape_type (rectangle/polygon/ellipse/circle), label, points, difficult. Dot `AnnotationIo` uses `Dictionary<string, object>` and VocIo.VocBox; JSON/VOC round-trip is consistent.
- **Project config:** **GetClassesFromProjectDir** tries `project_config.json` then `annotator_config.json` (Python compat). Content (project_name, classes, class_colors) aligned.
- **Config dir:** VocAnnotatorConfig (zoom, last paths) consistent.
- **Conclusion:** Data structures and I/O aligned; config filename dual-read implemented.

### 2.4 Data flow when opening label (d3check)

- **Current:** project_path from CONFIG (`coord_calibration.yolo_current_project`) → **AnnotatorWindow(imagesDir, projectPath)** in-process; window loads project config via GetClassesFromProjectDir(projectPath), uses AnnotationIo/VocIo for load/save. Same data flow as design; no process launch.
- **Optional:** When a segment is selected (e.g. in segment table), caller could pass segment path or segment/frames as imagesDir so the annotator opens with that folder; currently one path is used for both.

### 2.5 Single place for annotator UI

- **Constraint (DOT_ARCHITECTURE):** Apps do not reference other apps. So d3check cannot reference dotapps/VocAnnotator to reuse its window.
- **Options:** (A) Put annotator WPF window in **d3check** (uses DotCore.VocAnnotator only); (B) Put annotator UI in **dotcore** (e.g. DotCore.VocAnnotator.UI with WPF). Architecture prefers no WPF in dotcore (UITheme is data only); hence (A) is the compliant choice: **annotator window lives in d3check**, uses DotCore.VocAnnotator as the class library. Standalone VocAnnotator.exe remains a separate app with its own window for CLI/standalone use.
- **Conclusion:** Implement **AnnotatorWindow** in d3check that uses DotCore.VocAnnotator; "Open label" shows this window. Logic and layout can mirror the standalone app but live in d3check to avoid app-to-app reference.

---

## 3. Logic self-consistency and code alignment

| Check | Status |
|-------|--------|
| VOC XML / JSON shape format | Dot matches Python and GameAISDK §4 (folder, filename, path, size, object name, difficult, bndbox). |
| Load order (JSON then VOC) | AnnotationIo.LoadAnnotations: JSON first, fallback VOC — matches Python. |
| Save (JSON + optional VOC) | AnnotationIo.SaveAnnotations writes JSON (with imageSize) and VOC from same shape list — correct. |
| Project config path | GetClassesFromProjectDir tries project_config.json then annotator_config.json (Python compat). |
| Batch export image size | TryGetImageSizeFromAnnotationFile reads imageSize from saved JSON so batch YOLO export can run without loading images. |
| VocAnnotatorLauncher | Kept for standalone exe; d3check "Open label" uses in-process AnnotatorWindow. |

---

## 4. Recommended changes (until no issues remain)

1. **d3check – Open label via class library**  
   - Add **AnnotatorWindow** (WPF) in d3check that takes `string? imagesDir, string? projectPath` (projectPath = save dir for annotations and project config).  
   - Window uses **DotCore.VocAnnotator** only: VocAnnotatorConfig, ProjectConfig, AnnotationIo, VocIo.  
   - CalibrationPanel "Open label": create and show `new AnnotatorWindow(imagesDir, projectPath).Show()`; do **not** call VocAnnotatorLauncher for this path.

2. **VocAnnotatorLauncher**  
   - Keep for: (a) standalone VocAnnotator.exe launched from shell/scripts, (b) optional "Open in external annotator" if we add that later.  
   - Doc: clarify "for standalone exe; in-d3check use AnnotatorWindow".

3. **Project config filename**  
   - In d3check AnnotatorWindow, load project config from `projectPath/project_config.json`; optionally try `annotator_config.json` for Python compatibility (or document the difference).

4. **YoloDataLayout (dot)**  
   - Add to backlog: DotCore.VocAnnotator (or new DotCore.YoloDataLayout) with YOLO_DATA_ROOT, get project/segment paths, ensure dirs, write_data_yaml, 1:1 with pycore yolo_data_layout. Not required for "Open label" to work with library integration.

5. **Docs**  
   - Update DOT_D3CHECK_UI_PROGRESS / VOC_ANNOTATOR_DOT_VS_PYCORE / DOT_VOC_ANNOTATOR_PROGRESS to state: "Open label" opens in-process AnnotatorWindow (d3check) using DotCore.VocAnnotator; VocAnnotatorLauncher is for standalone exe only.

---

## 5. Class library gaps (DotCore.VocAnnotator vs pycore / Ultralytics)

| Capability | Pycore | DotCore.VocAnnotator | Official (Ultralytics) |
|------------|--------|----------------------|------------------------|
| JSON + VOC load/save | annotation_io | AnnotationIo ✓ | — |
| YOLO detection .txt | export_yolo_detection_txt (class x_center y_center width height, normalized [0,1]) | **AnnotationIo.ExportYoloDetectionTxt** ✓ | One .txt per image; class x_center y_center width height normalized [0,1] |
| YOLO segment .txt | export_yolo_segment_txt | **Missing** (optional) | class x1 y1 x2 y2 ... (min 3 points) |
| data.yaml | yolo_data_layout.write_data_yaml (path, train, val, nc, names) | **DataYamlWriter.WriteDataYaml** ✓ | path, train, val, names (dataset config) |
| Image size for batch export | voc_io.image_size_from_file (or from JSON) | **AnnotationIo.TryGetImageSizeFromAnnotationFile** ✓ (from saved JSON) | — |
| Segment/project paths | get_yolo_*_dir, ensure_yolo_segment_dirs | Optional backlog | — |

**Conclusion:** Dot class library now provides (1) **AnnotationIo.ExportYoloDetectionTxt** for YOLO detection .txt per image; (2) **DataYamlWriter.WriteDataYaml** for data.yaml. Segment/project path helpers (YoloDataLayout) remain optional backlog. "Generate YOLO dataset" and "Export selected" can be implemented in d3check/annotator by calling these APIs.

---

## 6. D3 (d3check) responsibility check

| Feature | Owner (design) | Current dot state |
|---------|----------------|-------------------|
| Open label | d3check (annotator window using dotcore) | ✓ AnnotatorWindow in-process; uses DotCore.VocAnnotator. |
| Export selected | d3check (orchestrate; use dotcore for YOLO export + data.yaml) | Button exists; no handler yet. DotCore now provides ExportYoloDetectionTxt + WriteDataYaml for implementation. |
| Project/segment list, Create project, Record, etc. | d3check + dotcore (config, paths) | UI shell only; backend/segment list not in scope of this audit. |
| Annotator: Generate YOLO dataset | Annotator window (d3check) using dotcore | Not implemented in AnnotatorWindow; would need DotCore YOLO export + WriteDataYaml. |

**Conclusion:** D3 correctly owns the "front" (Open label = in-process window). Export flows (Export selected, Generate YOLO dataset) are correctly d3check’s responsibility but depend on dotcore providing YOLO export and data.yaml; currently the class library does not, so those flows are incomplete.

---

## 7. Summary

| Item | Finding |
|------|--------|
| **Integration** | ✓ Class library: d3check shows in-process AnnotatorWindow; not CLI/process. |
| **YOLO layout / export** | DotCore.VocAnnotator now has ExportYoloDetectionTxt and DataYamlWriter.WriteDataYaml; YoloDataLayout path helpers remain optional. |
| **Data structures** | Aligned; project config filename differs (project_config.json vs annotator_config.json); annotator should try both for Python compat. |
| **Logic** | Load/save and VOC/JSON consistent; integration method fixed. |
| **D3 responsibility** | Open label ✓; Export selected / Generate YOLO dataset can use DotCore YOLO APIs (ExportYoloDetectionTxt, WriteDataYaml, TryGetImageSizeFromAnnotationFile). |

**Remaining (optional / UI):** AnnotatorWindow has no "Generate YOLO dataset" menu yet; CalibrationPanel "Export selected" has no click handler. Class library is ready; UI can call ExportYoloDetectionTxt, WriteDataYaml, TryGetImageSizeFromAnnotationFile to implement these.

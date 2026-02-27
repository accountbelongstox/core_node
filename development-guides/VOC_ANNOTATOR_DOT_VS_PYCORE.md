# VOC Annotator: Dot vs Pycore – Task and Design

This document (1) restates the task in a clear, structured form; (2) compares pycore `voc_annotator` with the current dot implementation; (3) outlines the design so that **shared logic lives in dotcore** and **d3check uses it as a sub-app library**, 1:1 with pycore logic (not code copy). It also notes how to align with multi-app shared-library usage and how to resolve conflicts in existing docs.

---

## 1. Restated task (整理后的任务描述)

**Objective**

- **Compare** `pycore/pyutils/voc_annotator` with the **dot** (dotcore + dotapps) implementation.
- **Identify gaps**: how much is missing on the dot side (UI and logic).
- **Complete** the dot side: implement UI and logic so that behavior aligns with pycore.

**Architecture rules (no code copy, logic 1:1)**

- Put **shared, app-agnostic** annotation/VOC/YOLO logic in **dotcore** as public class libraries (公共类库).
- Have **dotapps/d3check** reference those dotcore libraries and build the **D3Check-specific sub-app library** (子 app 类库) on top (e.g. panels, project/segment list, “Open label” integration).
- Follow the same **logical** structure as pycore: **multi-app shared lib (dotcore) + sub-app (d3check) calling shared lib to form its sub-library**; implementation uses .NET idioms and WPF, not Python/tkinter.
- **Reference** official/authoritative docs for any dot-specific or format differences (e.g. Ultralytics YOLO, VOC XML, GameAISDK) and reflect them in behavior and, where needed, in docs.

**Deliverables**

- Implement missing dotcore libraries and d3check integration (UI + logic).
- **Update code and documentation** where they conflict with this architecture or with the dot vs pycore mapping (e.g. DOT_D3CHECK_*, DOT_PUBLIC_LIBRARY_PROGRESS, DOT_ARCHITECTURE; **for UI layer use [DOT_UI_PROJECT_SPECIFICATION.md](DOT_UI_PROJECT_SPECIFICATION.md) as canonical**).

---

## 2. Pycore voc_annotator – what exists (logic, not code)

Source: `pycore/pyutils/voc_annotator/` and `DESIGN.md`.

| Layer | Module / area | Responsibility (logic) |
|-------|----------------|------------------------|
| **Entry** | `__init__.py` | `run_voc_annotator(images_dir, save_dir=None, classes=None, project_name=None, config_path=None)` – opens annotator window. |
| **Config** | `config.py` | Zoom %, last paths; JSON under pycore user dir. |
| **Project** | `project_config.py` | Load/save project config at `config_path`: `project_name`, `classes` (and class colors). |
| **VOC I/O** | `voc_io.py` | Read image size; read/write VOC XML (GameAISDK detection: bndbox, object name, difficult, truncated). |
| **Annotation I/O** | `annotation_io.py` | Load/save unified JSON per image (shapes: rectangle, polygon, ellipse, circle); export VOC XML from rectangles; export YOLO det/seg .txt (normalized). |
| **Layout** | `yolo_data_layout.py` | YOLO_DATA_ROOT; get_yolo_data_dir(project, segment); ensure_yolo_segment_dirs; write_data_yaml. |
| **Patch** | `patch_data.py`, `external_data.py` | Patch sources (base_dir + items); shared across segments. |
| **Paste** | `detection_paste_generator.py` | Generate YOLO dataset: paste patches on backgrounds; images/, labels/, data.yaml. |
| **UI** | `main_window.py` | Toplevel: menu, toolbar (zoom, shape modes, save, class list), class list, canvas area, tables. |
| **Canvas** | `canvas.py` | Draw shapes at scale; modes: rect (drag), polygon (click+Enter), ellipse/circle (drag); shapes → boxes/shapes for VOC and JSON. |
| **Flow** | `waterfall_flow.py` | Image cards in grid; responsive columns; per-image undo (history stack); cache_changed for tables. |
| **Tables** | `annotation_table.py` | Global annotation table; per-image annotation list; class color column; sync on cache_changed. |

**Behavior (summary):** One project → multiple segments → shared classes/config; VOC XML + JSON per image; YOLO det/seg export; patch images; zoom persistence; class list with current class for new shapes; rectangle/polygon/ellipse/circle; per-image undo.

---

## 3. Dot side – current status

**dotcore**

- **No** VOC/annotation/YOLO library. No `DotCore.VocAnnotator` (or similar); no shared types for VOC XML, annotation JSON, YOLO layout, or shape types.
- Existing libs (Foundations, Common, Utils, Infrastructure, UIInspect, UITheme) do not cover annotation/VOC/YOLO.

**dotapps/d3check**

- **CalibrationPanel** only: YOLO **UI shell** – buttons (Config, Record Start/Stop, Import patch, Create project, Open project dir, Refresh, Export selected, Open label, Merge, Delete), and a **DataGrid** for segments (`YoloSegmentRow`).
- **No** annotator window, no canvas, no VOC/JSON read-write, no project/config load from `config_path`, no shared annotation types from dotcore.
- “Open label” has no implementation that opens a WPF annotator backed by dotcore.

**Conclusion:** Dot is missing almost the entire **voc_annotator** stack: both **public lib (dotcore)** and **sub-app usage (d3check)**. The gap is full UI + full logic, not just small pieces.

---

## 4. Design: public lib in dotcore, d3check as sub-app (1:1 logic with pycore)

**Principle:** Same **logic** as pycore (contracts, data formats, project/segment/classes, VOC/YOLO behavior); implementation in .NET with WPF. No code copy.

### 4.1 dotcore (public class libraries)

- **DotCore.VocAnnotator** (or **DotCore.Annotation** – name TBD):  
  - Types: shape (rectangle, polygon, ellipse, circle), annotation (shape + label + points + difficult), project config (project_name, classes, class_colors).  
  - VOC: read/write VOC XML (GameAISDK §4); image size from file.  
  - Annotation I/O: load/save JSON per image (unified shapes); export VOC from rectangles; export YOLO det/seg .txt (normalized [0,1]).  
  - No UI here; only contracts and I/O so that any dotapp (e.g. d3check) can use them.

- **DotCore.YoloDataLayout** (or under same lib):  
  - YOLO data root; get segment dir (project, segment); ensure dirs (images/, labels/); write data.yaml (path, train, val, names).  
  - Logic 1:1 with pycore `yolo_data_layout`.

- **DotCore.PatchData** (or under same lib):  
  - Patch sources (base_dir + items); shared by segments; same contract as pycore `patch_data` / `external_data` for dataset generation.

- Dependencies: DotCore.VocAnnotator may depend on Foundations, Common, Utils, Infrastructure (file I/O, config if needed). No reference to dotapps.

### 4.2 dotapps/d3check (sub-app library)

- **Reference** DotCore.VocAnnotator (and YoloDataLayout, PatchData as needed).
- **CalibrationPanel**: Wire existing buttons to real behavior: Create project → folder picker + project root; Open project dir → open explorer; **Open label** → open **annotator window** (in-process WPF window) with `images_dir`, `project_path` (save dir). Integration is **class library**: d3check creates and shows `AnnotatorWindow(imagesDir, projectPath)`; no CLI/process launch. (Standalone VocAnnotator.exe remains available via VocAnnotatorLauncher for shell/scripts.)
- **Annotator window** (d3check `Windows/AnnotatorWindow`): WPF window that uses dotcore for:  
  - Load/save project config (config_path), VOC/JSON, zoom config.  
  - Canvas: draw shapes (rect, polygon, ellipse, circle), current class from class list.  
  - Image list (thumbnails + filenames); delete image only when no annotations.  
  - Global table + per-image table; per-image undo; patch panel if needed.  
  - Export: VOC XML, YOLO det/seg .txt; optionally use DotCore.YoloDataLayout for segment layout and data.yaml.
- **Project/segment list**: Use YOLO_RECORD_BASE_DIR / client_type and “Load project” cache as in pycore; persist current project in config (e.g. coord_calibration.yolo_current_project).

This keeps **multi-app shared lib** in dotcore and **sub-app orchestration and UI** in dotapps/d3check, 1:1 with pycore’s split (pycore = shared, d3-check = caller + UI).

### 4.3 Official / differential docs

- **Formats:** Align with Ultralytics YOLO (det/seg .txt, data.yaml, normalized [0,1]) and GameAISDK VOC XML (DESIGN.md §4, §17).  
- **Dot-specific:** Use [DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md), [DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md), and [DOT_D3CHECK_*.md](../pyapps/d3-check/docs/) for where each capability lives (dotcore vs dotapps/d3check).  
- **Conflicts:** Where a doc says “annotator” or “YOLO data” is only in d3check without a dotcore lib, update to: “shared annotation/VOC/YOLO types and I/O in dotcore; d3check implements UI and orchestration”.

---

## 5. Document and code updates (conflict resolution)

- **DOT_PUBLIC_LIBRARY_PROGRESS.md:** Add a row for the new dotcore annotation/VOC/YOLO library (and YoloDataLayout, PatchData if separate); map to pycore `pyutils/voc_annotator` + `yolo_data_layout` + patch/dataset generation; status “Planned” or “In progress” until implemented.
- **DOT_ARCHITECTURE.md:** If a new DotCore.* project is added, list it under §1 and in the solution; dependency rule: no app refs, no cycles.
- **DOT_D3CHECK_SUBLIBRARIES.md** (or DOT_D3CHECK_UI_LIBRARY.md): Add a short section for “Annotation / YOLO data / Open label”: **dotcore** = VOC/annotation I/O, YOLO layout, patch data (types and file ops); **d3check** = CalibrationPanel, annotator window (WPF), project/segment list, “Open label” and export flows. This removes any implication that annotation is only in d3check without a shared lib.
- **pyapps/d3-check/docs:** If any doc states that “VOC/annotator is only in Python”, add a note that the dot port provides the same capability via dotcore + dotapps/d3check.
- **Code:** Implement dotcore lib(s) and d3check integration as above; ensure no app-to-app references and that d3check references only dotcore.

---

## 6. Summary

| Item | Pycore | Dot (current) | Dot (target) |
|------|--------|----------------|---------------|
| Shared annotation/VOC/YOLO | pycore/pyutils/voc_annotator, yolo_data_layout, patch_data | None | dotcore: DotCore.VocAnnotator (and YoloDataLayout, PatchData) |
| Annotator UI | main_window, canvas, waterfall_flow, annotation_table | None | dotapps/d3check: annotator window (WPF) using dotcore |
| D3Check YOLO panel | coordinate_calibration_panel + run_voc_annotator | CalibrationPanel (buttons + grid only) | CalibrationPanel wired; “Open label” opens annotator |
| Logic | DESIGN.md, 1:1 with GameAISDK/Ultralytics | N/A | 1:1 with pycore logic; .NET/WPF implementation |

Task in one sentence: **Implement dotcore public lib(s) for VOC/annotation/YOLO and d3check’s annotator UI and wiring so that behavior matches pycore voc_annotator (logic 1:1), then fix any doc/code conflicts.**

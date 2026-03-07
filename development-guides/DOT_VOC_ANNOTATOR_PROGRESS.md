# VOC Annotator: pycore vs dotcore Progress

Logic 1:1 with **pycore/pyutils/voc_annotator**: public lib in **dotcore** (DotCore.VocAnnotator), runnable app in **dotapps/VocAnnotator** that uses the lib. Same architecture as Python: multi-app shared lib, sub-app calls public lib to form its tool.

---

## 1. Python (pycore) layout

| Module | Role |
|--------|------|
| **config.py** | Zoom percent, last images_dir, last save_dir; JSON under user config dir. |
| **voc_io.py** | Read/write Pascal VOC XML (GameAISDK); one XML per image; bndbox (xmin, ymin, xmax, ymax). |
| **annotation_io.py** | Unified shapes (rectangle, polygon, ellipse, circle); JSON per image; shapes_to_boxes / boxes_to_shapes; load/save annotations; export YOLO detection/segment txt. |
| **project_config.py** | Project-level JSON: project_name, classes, class_colors; load/save at config_path. |
| **main_window.py** | Tk UI: menu, toolbar, image list, class list, canvas, tables. |
| **canvas.py** | Tk Canvas: draw rectangle/polygon/ellipse/circle; store shapes; get_boxes/get_shapes. |
| **waterfall_flow.py** | Image card grid and scroll. |
| **annotation_table.py** | Annotation list/table UI. |

---

## 2. Dot mapping

| Python | .NET | Location |
|--------|------|----------|
| config.py | VocAnnotatorConfig | DotCore.VocAnnotator |
| voc_io.py | VocIo | DotCore.VocAnnotator |
| annotation_io.py | AnnotationIo | DotCore.VocAnnotator |
| project_config.py | ProjectConfig | DotCore.VocAnnotator |
| main_window + canvas + waterfall + annotation_table | VocAnnotator app UI | dotapps/VocAnnotator (WPF) |

**Rule:** All file/XML/JSON logic and config live in **DotCore.VocAnnotator**. The **dotapps/VocAnnotator** app references DotCore.VocAnnotator and implements the window, image list, canvas, class list, and menus.

---

## 3. Dot completion status

| Component | Status | Notes |
|-----------|--------|-------|
| **VocIo** | Done | ReadBoxesFromVoc, WriteVocXml; no ImageSizeFromFile (app provides size from loaded image). |
| **VocAnnotatorConfig** | Done | Load/Save JSON; Get/Set zoom percent, last images dir, last save dir; config dir via env or AppPaths. |
| **ProjectConfig** | Done | Load/Save project_name, classes, class_colors. |
| **AnnotationIo** | Done | Shape types, ShapeToBbox, ShapesToBoxes, BoxesToShapes, LoadAnnotations, SaveAnnotations. |
| **VocAnnotator app** | Done | WPF: Open Dir, image list, canvas (rectangle), class list, Save; DotCore.VocAnnotator for all IO. CLI: first arg = images dir, --project-path = save/project dir. |
| **VocAnnotatorLauncher** | Done | Launch(imagesDir, projectPath, hintAppBaseDir); resolves VocAnnotator.exe from sibling build or PATH; used by d3check Calibration "Open label". |

---

## 4. Doc and architecture

- **DOT_ARCHITECTURE.md**: dotcore = public libs, dotapps = apps; no change.
- **DOT_PUBLIC_LIBRARY_PROGRESS.md**: Add DotCore.VocAnnotator row; pyutils/voc_annotator maps to it.
- **PYCORE_PYAPPS_STRUCTURE**: pyutils is public; voc_annotator is a sub-feature; dot mirrors with DotCore.VocAnnotator.

---

## 5. Differences (dot vs Python)

- **UI**: Python uses Tkinter; dot uses WPF. Same behaviour: Open Dir, Change save dir, Save, zoom, shape modes, class list, image list, canvas.
- **Image size**: Python uses PIL in voc_io.image_size_from_file; dot app obtains size from WPF BitmapImage when loading image and passes to WriteVocXml / SaveAnnotations.
- **Config dir**: Python uses CORE_NODE_CONFIG_DIR or ~/.core_node; dot uses same env or DotCore.Common.AppPaths.GetUserDataDirectory().

## 6. Gap assessment (dot vs pycore)

| pycore | dot | Gap |
|--------|-----|-----|
| voc_io, annotation_io, project_config, config | VocIo, AnnotationIo, ProjectConfig, VocAnnotatorConfig | None; logic 1:1. |
| main_window (menu, toolbar, image list, class list, canvas, tables) | VocAnnotator WPF app (Open Dir, image list, canvas, class list, Save) | Dot app has rectangle-only canvas; pycore canvas supports polygon, ellipse, circle. Add polygon/ellipse/circle to dot canvas if needed. |
| waterfall_flow.py (image card grid and scroll) | Dot app uses list/grid for image list | Behaviourally equivalent; no structural gap. |
| annotation_table.py | Dot app annotation list/table | Dot has annotation list; table layout may differ. |
**Conclusion:** Dot public lib (DotCore.VocAnnotator) and app cover core IO and rectangle workflow. Remaining optional: canvas shape types polygon/ellipse/circle in dotapps/VocAnnotator for full parity with pycore.

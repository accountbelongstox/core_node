# VOC Annotator: PySide6 → Tkinter Migration

## Purpose

Replace all PySide6 (Qt6) usage in `pycore.pyutils.voc_annotator` with Python standard library **tkinter**, without changing functionality. This removes the PySide6 dependency for the annotator and aligns with pycore’s option to use native Tk (see threading rules: Tk from Tk thread only).

## Scope

- **In scope**: `main_window.py`, `canvas.py`, `waterfall_flow.py`, `annotation_table.py`, `__init__.py`, and doc references in `DESIGN.md` / `__init__.py` docstrings.
- **Out of scope**: `config.py`, `voc_io.py`, `annotation_io.py`, `project_config.py`, `patch_data.py`, `yolo_data_layout.py`, `detection_paste_generator.py`, `external_data.py` — no Qt; unchanged except where they are called from the new Tk UI.

## Backup

Before edits, a copy of the PySide6-based UI files is stored under:

- `pycore/pyutils/voc_annotator/backup_before_tk/`
  - `main_window.py`
  - `canvas.py`
  - `waterfall_flow.py`
  - `annotation_table.py`
  - `__init__.py`

Restore by copying these back over the same names if rollback is needed.

## Mapping (1:1 functional equivalence)

| PySide6 | Tkinter |
|--------|---------|
| QApplication / QMainWindow | `tk.Tk` or `tk.Toplevel`; no separate app object |
| QWidget, QFrame | `tk.Frame` |
| QVBoxLayout / QHBoxLayout | `pack()`, `grid()`, `grid_rowconfigure` / `grid_columnconfigure` |
| QToolBar | `tk.Menu` or `Frame` with buttons |
| QPushButton | `ttk.Button` or `tk.Button` |
| QLabel | `tk.Label` or `ttk.Label` |
| QListWidget | `tk.Listbox` or `ttk.Treeview` |
| QFileDialog | `tkinter.filedialog` |
| QMessageBox | `tkinter.messagebox` |
| QInputDialog | `tkinter.simpledialog` |
| QScrollArea | `tk.Canvas` + scrollbar or `Frame` in scrollable region |
| QSplitter | `tk.PanedWindow` |
| QComboBox | `ttk.Combobox` |
| QMenu / QAction | `tk.Menu`, `add_command` |
| QTableWidget | `ttk.Treeview` (columns = tree columns) |
| QHeaderView | Treeview column headings |
| Signal/slot | Callbacks: store `callable` and invoke from event handlers |
| QEventLoop.exec() | `root.mainloop()` or host-driven `root.update()` / `root.after()` |
| QTimer.singleShot | `root.after(ms, callback)` |
| event_pump_schedule | Host calls `root.update()` or `root.after(pump_once, delay_ms)` |
| QWidget (canvas) | `tk.Canvas` for image and shapes |
| QPainter / QPixmap / QImage | `tk.PhotoImage` for image; Canvas items (line, rect, polygon, oval) for shapes |
| QColor | RGB tuple `(r, g, b)` or hex string for Canvas `fill`/`outline` |
| Qt.* constants | `tk` event constants (e.g. button numbers, keys) |

## Entry Point and Lifecycle

- **Before**: `run_voc_annotator(...)` ensured `QApplication.instance()` or created `QApplication([])`, then created `VOCAnnotatorWindow` (QMainWindow). With `event_pump_schedule`, it showed the window and returned; the host called `app.processEvents()` on a timer. Without, it ran `QEventLoop.exec()` until the window closed.
- **After**: `run_voc_annotator(...)` creates a `tk.Toplevel` or `tk.Tk` (if no root exists), builds the same UI with Tk widgets, and either:
  - **With `event_pump_schedule`**: show window, schedule `root.after(delay, pump_once)` where `pump_once` calls `root.update()` and re-schedules; return without blocking.
  - **Without**: run `root.mainloop()` (or a blocking loop that calls `root.update()` until window is destroyed).

So: no QApplication, no processEvents; use Tk’s mainloop or host-driven `update()`/`after()`.

## File-by-File Changes

1. **canvas.py**  
   - `AnnotatorCanvas(QWidget)` → custom widget based on `tk.Canvas`.  
   - Image: load with PIL, convert to `PhotoImage`, display with `create_image`.  
   - Shapes: draw with `create_rectangle`, `create_polygon`, `create_oval`; store internal shape list; redraw on change.  
   - Mouse/key: `bind('<Button-1>', ...)`, `bind('<Motion>', ...)`, `bind('<Key>', ...)`; focus with `focus_set()`.  
   - `boxes_changed` / `shapes_changed` → callbacks passed in or set via setter; call after updates.

2. **waterfall_flow.py**  
   - `ImageCardWidget(QFrame)` → `tk.Frame` containing canvas + label + Undo button.  
   - `WaterfallFlowWidget` → `tk.Frame` with scrollable area (Canvas + scrollbar or Frame in scrollable frame); grid of cards.  
   - `current_canvas_changed` / `cache_changed` → callbacks; `eventFilter` for focus → bind `<FocusIn>` on canvas.

3. **annotation_table.py**  
   - `GlobalAnnotationTable` / `ImageAnnotationList` → `ttk.Treeview` in a Frame; columns: Image (or Index), Class, Type, Position, Color (color as tag or column).  
   - Double-click / right-click delete → bind `<<TreeviewSelect>>`, `<Double-1>`, `<Button-3>` and call same logic as before.

4. **main_window.py**  
   - `VOCAnnotatorWindow(QMainWindow)` → window as `tk.Toplevel` or `tk.Tk`, menu via `tk.Menu`, toolbar as `Frame` with buttons, zoom label, shape buttons, segment combo, save/delete.  
   - Left/center/right: `PanedWindow` or grid with global table, center (waterfall + per-image list), class panel (listbox + patch list + buttons).  
   - Thumbnails: use PIL + `PhotoImage` (small) for list items where needed.  
   - `run_voc_annotator`: create root if needed, build window, then mainloop or event_pump_schedule as above.

5. **__init__.py**  
   - Docstring: “PySide6” → “tkinter”.  
   - No `get_third_package_pyside6()`.

6. **DESIGN.md**  
   - Replace “PySide6” with “tkinter” in GUI stack and dependency descriptions; keep behavior and layout descriptions the same.

## Dependencies

- **Removed**: PySide6; no `get_third_package_pyside6()` in voc_annotator.
- **Unchanged**: stdlib (xml, json, os, tkinter), PIL (via existing third_party for image load), pycore (config, voc_io, annotation_io, project_config, patch_data, yolo_data_layout, detection_paste_generator).

## Testing Checklist (functional parity)

- Open dir / Change save dir / Save; zoom +/- and label; segment combo when project_path given.
- Shape modes: Rect, Polygon, Ellipse, Circle; draw and edit; current class from class list.
- Global table: list all annotations; double-click focuses image card; right-click delete.
- Per-image list: shows current image annotations; delete selected; double-click selects on canvas.
- Class list: click to set current; add class; edit class name; class colors in tables and canvas.
- Patch (补丁图): load dir, merge to class, remove selected, double-click edit class.
- Generate YOLO dataset: output dir, synthetic count; same output as before.
- Undo per card; config and project config load/save (zoom, paths, classes, class_colors).
- Run standalone (`python -m pycore.pyutils.voc_annotator`) and run with `event_pump_schedule` from host (e.g. d3-check).

## Date

Migration doc and backup: 2025-02-23.  
1:1 code replacement: same session.

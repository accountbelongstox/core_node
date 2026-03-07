# -*- coding: utf-8 -*-
"""
VOC Annotator main window: project/config, waterfall image grid, class list, cache.
Zoom persisted; config_path loads/saves project_name, classes, and class_colors.
Tkinter implementation (no PySide6).
"""

import os
import random
import shutil
import sys
import tkinter as tk
from tkinter import ttk
from tkinter import filedialog
from tkinter import messagebox
from tkinter import simpledialog
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint

from . import config
from . import voc_io
from . import project_config
from . import annotation_io
from . import patch_data
from . import yolo_data_layout
from . import detection_paste_generator
from .canvas import AnnotatorCanvas, DRAW_MODE_RECTANGLE, DRAW_MODE_POLYGON, DRAW_MODE_ELLIPSE, DRAW_MODE_CIRCLE
from .waterfall_flow import WaterfallFlowWidget
from .annotation_table import GlobalAnnotationTable, ImageAnnotationList

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageTk

_PIL_Image = get_third_package_PIL_Image()
_PIL_ImageTk = get_third_package_PIL_ImageTk()

THUMB_MAX_HEIGHT = 72
THUMB_MAX_LIST = 800


def list_segments_from_project(project_path: str) -> List[Tuple[str, str]]:
    if not project_path or not project_path.strip():
        return []
    proj = os.path.abspath(project_path.rstrip(os.sep))
    if not os.path.isdir(proj):
        return []
    try:
        subdirs = [d for d in os.listdir(proj) if os.path.isdir(os.path.join(proj, d))]
        subdirs.sort(reverse=True)
        return [(d, os.path.join(proj, d)) for d in subdirs]
    except OSError:
        return []


def _random_rgb() -> List[int]:
    return [random.randint(60, 255), random.randint(60, 255), random.randint(60, 255)]


def _thumbnail_for_image(path: str, max_height: int = THUMB_MAX_HEIGHT):
    """Return a small PhotoImage for list display; caller must keep reference. None on failure."""
    if not path or not os.path.isfile(path):
        return None
    try:
        pil = _PIL_Image.open(path)
        if pil.mode != "RGB":
            pil = pil.convert("RGB")
        w, h = pil.size
        if h > max_height:
            r = getattr(_PIL_Image, "Resampling", None)
            resample = getattr(r, "LANCZOS", None) if r else getattr(_PIL_Image, "LANCZOS", 1)
            pil = pil.resize((int(w * max_height / h), max_height), resample)
        return _PIL_ImageTk.PhotoImage(pil)
    except OSError:
        return None


class VOCAnnotatorWindow:
    def __init__(
        self,
        images_dir: Optional[str] = None,
        save_dir: Optional[str] = None,
        classes: Optional[List[str]] = None,
        project_name: Optional[str] = None,
        config_path: Optional[str] = None,
        project_path: Optional[str] = None,
        parent: Optional[tk.Tk] = None,
    ):
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__ start: project_path=%s, images_dir=%s" % (project_path, images_dir))
        self._root = parent if parent is not None else tk.Tk()
        self._win = tk.Toplevel(self._root) if parent is not None else self._root
        self._project_path = project_path
        self._segment_list: List[Tuple[str, str]] = []
        if project_path and os.path.isdir(project_path):
            if not config_path:
                config_path = os.path.join(project_path, "annotator_config.json")
            self._segment_list = list_segments_from_project(project_path)
            if self._segment_list and not images_dir:
                first_seg = self._segment_list[0][1]
                frames_dir = os.path.join(first_seg, "frames")
                if os.path.isdir(frames_dir):
                    images_dir = frames_dir
                    save_dir = save_dir or frames_dir
        self._config_path = config_path
        self._images_dir = images_dir or config.get_last_images_dir() or ""
        self._save_dir = save_dir or config.get_last_save_dir() or self._images_dir
        self._project_name = project_name or ""
        self._image_list: List[str] = []
        self._current_index = -1
        self._patch_sources: List[dict] = []
        self._external_items: List[tuple] = []
        self._external_item_meta: List[tuple] = []
        self._class_colors: Dict[str, Tuple[int, int, int]] = {}
        if config_path and os.path.isfile(config_path):
            proj = project_config.load_project_config(config_path)
            self._classes = list(proj.get(project_config.CONFIG_KEY_CLASSES, []) or [])
            if not self._project_name and proj.get(project_config.CONFIG_KEY_PROJECT_NAME):
                self._project_name = proj[project_config.CONFIG_KEY_PROJECT_NAME]
            raw = proj.get(project_config.CONFIG_KEY_CLASS_COLORS) or {}
            for name, rgb in raw.items():
                if isinstance(rgb, (list, tuple)) and len(rgb) >= 3:
                    self._class_colors[str(name)] = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
        else:
            self._classes = list(classes) if classes else []
        for c in self._classes:
            if c not in self._class_colors:
                self._class_colors[c] = tuple(_random_rgb())
        self._focused_canvas: Optional[AnnotatorCanvas] = None
        self._card_scale = 1.0
        self._external_thumb_refs: List[Any] = []

        self._win.title("VOC Annotator" + (" - " + self._project_name if self._project_name else " (pycore)"))
        self._win.geometry("1200x800")

        menubar = tk.Menu(self._win)
        self._win.config(menu=menubar)
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Open Dir", accelerator="Ctrl+O", command=self._open_dir)
        file_menu.add_command(label="Change save dir", command=self._change_save_dir)
        file_menu.add_command(label="Save", accelerator="Ctrl+S", command=self._save_current)
        file_menu.add_separator()
        file_menu.add_command(label="Load patch images (补丁图)", command=self._load_external_dir)
        file_menu.add_command(label="Generate YOLO dataset", command=self._generate_yolo_dataset)
        self._win.bind("<Control-o>", lambda e: self._open_dir())
        self._win.bind("<Control-s>", lambda e: self._save_current())
        self._win.bind("<Control-plus>", lambda e: self._zoom_in())
        self._win.bind("<Control-equal>", lambda e: self._zoom_in())
        self._win.bind("<Control-minus>", lambda e: self._zoom_out())
        self._win.bind("<Delete>", lambda e: self._delete_selected())
        self._win.bind("<BackSpace>", lambda e: self._delete_selected())

        main = tk.Frame(self._win, padx=4, pady=4)
        main.pack(fill="both", expand=True)

        toolbar = tk.Frame(main)
        toolbar.pack(fill="x", pady=(0, 4))
        zoom_out_btn = ttk.Button(toolbar, text="Zoom -", width=8, command=self._zoom_out)
        zoom_out_btn.pack(side="left", padx=2)
        self._zoom_label = ttk.Label(toolbar, text="100%", width=6)
        self._zoom_label.pack(side="left", padx=2)
        zoom_in_btn = ttk.Button(toolbar, text="Zoom +", width=8, command=self._zoom_in)
        zoom_in_btn.pack(side="left", padx=2)
        ttk.Separator(toolbar, orient="vertical").pack(side="left", fill="y", padx=8)
        ttk.Label(toolbar, text=" Shape:").pack(side="left", padx=2)
        self._shape_buttons = []
        self._shape_mode_var = tk.StringVar(value="Rect")
        for label, mode in [("Rect", DRAW_MODE_RECTANGLE), ("Polygon", DRAW_MODE_POLYGON), ("Ellipse", DRAW_MODE_ELLIPSE), ("Circle", DRAW_MODE_CIRCLE)]:
            btn = ttk.Button(toolbar, text=label, width=8, command=lambda m=mode, l=label: self._set_shape_mode(m, l))
            btn.pack(side="left", padx=2)
            self._shape_buttons.append((btn, mode))
        self._shape_mode_label = ttk.Label(toolbar, textvariable=self._shape_mode_var, width=8)
        self._shape_mode_label.pack(side="left", padx=4)
        ttk.Separator(toolbar, orient="vertical").pack(side="left", fill="y", padx=8)
        ttk.Button(toolbar, text="Save", command=self._save_current).pack(side="left", padx=2)
        self._segment_combo: Optional[ttk.Combobox] = None
        if self._segment_list:
            ttk.Separator(toolbar, orient="vertical").pack(side="left", fill="y", padx=8)
            ttk.Label(toolbar, text=" Segment:").pack(side="left", padx=2)
            self._segment_combo = ttk.Combobox(toolbar, values=[ts for ts, _ in self._segment_list], state="readonly", width=18)
            self._segment_combo.pack(side="left", padx=2)
            self._segment_combo.bind("<<ComboboxSelected>>", self._on_segment_combo_changed)
            for i, (_, seg_path) in enumerate(self._segment_list):
                if os.path.normpath(self._images_dir) == os.path.normpath(os.path.join(seg_path, "frames")):
                    self._segment_combo.current(i)
                    break
            else:
                self._segment_combo.current(0)
        delete_btn = ttk.Button(toolbar, text="Delete selected box", command=self._delete_selected)
        delete_btn.pack(side="left", padx=2)

        paned = tk.PanedWindow(main, orient="horizontal", sashwidth=4)
        paned.pack(fill="both", expand=True)

        self._global_table = GlobalAnnotationTable(paned)
        self._global_table.set_image_activated_callback(self._on_global_table_image_activated)
        self._global_table.set_annotation_deleted_callback(self._on_image_annotation_deleted)
        self._global_table.set_class_colors(self._class_colors)
        paned.add(self._global_table.widget(), width=380, minsize=200)

        center_paned = tk.PanedWindow(paned, orient="vertical", sashwidth=4)
        self._waterfall = WaterfallFlowWidget(center_paned)
        self._waterfall.set_current_canvas_changed_callback(self._on_waterfall_canvas_focused)
        self._waterfall.set_cache_changed_callback(self._on_annotation_cache_changed)
        self._waterfall.set_card_context_menu_callback(self._on_card_right_click)
        center_paned.add(self._waterfall.widget(), height=600, minsize=120)
        self._image_annotation_list = ImageAnnotationList(center_paned)
        self._image_annotation_list.set_annotation_deleted_callback(self._on_image_annotation_deleted)
        self._image_annotation_list.set_annotation_selected_callback(self._on_image_annotation_selected)
        self._image_annotation_list.set_class_colors(self._class_colors)
        center_paned.add(self._image_annotation_list.widget(), height=200, minsize=80)
        paned.add(center_paned, width=700, minsize=400)

        class_panel = tk.Frame(paned, padx=8, pady=8, relief="ridge", bd=1)
        info_f = tk.Frame(class_panel, bg="#e8eaed", padx=8, pady=6)
        info_f.pack(fill="x", pady=(0, 6))
        self._info_current_label = tk.Label(info_f, text="Current (for labeling): —", font=("", 11, "bold"), bg="#e8eaed")
        self._info_current_label.pack(anchor="w")
        self._info_color_swatch = tk.Label(info_f, text=" ", bg="#9aa0a6", height=1, width=4)
        self._info_color_swatch.pack(anchor="w", pady=2)
        tk.Label(class_panel, text="Classes (click to label):").pack(anchor="w")
        self._class_list = tk.Listbox(class_panel, height=10, width=22, selectmode="single")
        self._class_list.pack(fill="x", pady=2)
        for c in self._classes:
            self._class_list.insert("end", c)
        self._class_list.bind("<<ListboxSelect>>", self._on_class_select)
        self._class_list.bind("<Double-1>", self._on_class_double_edit)
        ttk.Button(class_panel, text="+", width=3, command=self._add_class_inline).pack(anchor="w", pady=2)
        tk.Label(class_panel, text="Patch (补丁图):").pack(anchor="w")
        self._external_list = tk.Listbox(class_panel, height=5, width=22, selectmode="extended")
        self._external_list.pack(fill="x", pady=2)
        self._external_list.bind("<Double-1>", self._on_external_item_double_clicked)
        self._external_list.bind("<Button-3>", self._on_external_context_menu)
        ttk.Button(class_panel, text="Load external dir", command=self._load_external_dir).pack(fill="x", pady=2)
        ttk.Button(class_panel, text="Merge selected to class", command=self._merge_external_to_class).pack(fill="x", pady=2)
        paned.add(class_panel, width=240, minsize=160)

        self._status_label = ttk.Label(main, text="")
        self._status_label.pack(anchor="w", pady=2)
        for w, msg in [
            (zoom_out_btn, "Zoom out (Ctrl+-)"),
            (zoom_in_btn, "Zoom in (Ctrl++)"),
            (delete_btn, "Delete selected annotation (Del/BackSpace)"),
        ]:
            w.bind("<Enter>", lambda e, m=msg: self._status_label.config(text=m))
            w.bind("<Leave>", lambda e: self._status_label.config(text="%d images" % len(self._image_list) if self._image_list else ""))

        def _class_colors_rgb() -> Dict[str, List[int]]:
            return {k: [c[0], c[1], c[2]] for k, c in self._class_colors.items()}

        def _save_config() -> None:
            if self._config_path:
                project_config.save_project_config(
                    self._config_path,
                    self._project_name,
                    self._classes,
                    class_colors=_class_colors_rgb(),
                )

        def _ensure_class_color(name: str) -> None:
            if name and name not in self._class_colors:
                self._class_colors[name] = tuple(_random_rgb())
                _save_config()

        self._class_colors_rgb = _class_colors_rgb
        self._save_config = _save_config
        self._ensure_class_color = _ensure_class_color

        self._card_scale = config.get_zoom_percent() / 100.0
        self._update_zoom_label()

        if self._classes:
            self._class_list.selection_set(0)
            self._class_list.see(0)
            self._waterfall.set_default_class(self._classes[0])
        self._update_class_info_area()

        if self._images_dir and os.path.isdir(self._images_dir):
            self._load_image_list()
        else:
            self._open_dir()

        self._reload_patch_sources()
        self._refresh_external_list()

        self._win.protocol("WM_DELETE_WINDOW", self._on_close)
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: finished")

    def _on_segment_combo_changed(self, event=None) -> None:
        if not self._segment_combo:
            return
        i = self._segment_combo.current()
        if i < 0 or i >= len(self._segment_list):
            return
        _, seg_path = self._segment_list[i]
        frames_dir = os.path.join(seg_path, "frames")
        if not os.path.isdir(frames_dir):
            return
        self._save_current()
        self._images_dir = frames_dir
        self._save_dir = frames_dir
        config.set_last_images_dir(frames_dir)
        config.set_last_save_dir(frames_dir)
        self._load_image_list()
        self._status_label.config(text="Segment: %s" % os.path.basename(seg_path))

    def _reload_patch_sources(self) -> None:
        self._patch_sources = patch_data.load_patch_sources(self._config_path)
        self._external_items = []
        self._external_item_meta = []
        for si, s in enumerate(self._patch_sources):
            base = (s.get(patch_data.KEY_BASE_DIR) or "").strip()
            for ii, it in enumerate(s.get(patch_data.KEY_ITEMS) or []):
                f = it.get(patch_data.KEY_FILE) or ""
                c = it.get(patch_data.KEY_CLASS)
                if c is None:
                    continue
                path = os.path.normpath(os.path.join(base, f)) if base else os.path.normpath(f)
                self._external_items.append((path, str(c)))
                self._external_item_meta.append((si, ii))

    def _refresh_external_list(self) -> None:
        self._external_list.delete(0, "end")
        self._external_thumb_refs.clear()
        for idx, (path, class_name) in enumerate(self._external_items):
            display_name = os.path.basename(path) if os.path.dirname(path) else path
            self._external_list.insert("end", "%s  →  %s" % (display_name, class_name))
            thumb = _thumbnail_for_image(path, 48)
            if thumb is not None:
                self._external_thumb_refs.append(thumb)

    def _load_external_dir(self) -> None:
        d = filedialog.askdirectory(title="Select directory of patch images (补丁图)", initialdir=os.path.expanduser("~"))
        if not d:
            return
        items = patch_data.load_patch_dir(d)
        if not items:
            self._status_label.config(text="No images in directory")
            return
        patch_data.add_patch_source(self._config_path, d, items)
        self._reload_patch_sources()
        self._refresh_external_list()
        self._status_label.config(text="Patch source +%d from %s (total %d)" % (len(items), os.path.basename(d), len(self._external_items)))

    def _on_external_item_double_clicked(self, event) -> None:
        sel = self._external_list.curselection()
        if not sel:
            return
        row = sel[0]
        if row < 0 or row >= len(self._external_item_meta):
            return
        path, old_class = self._external_items[row]
        idx = row
        new_class = simpledialog.askstring("Edit class", "Class name for %s:" % os.path.basename(path), initialvalue=old_class)
        if not new_class or not new_class.strip():
            return
        new_class = new_class.strip()
        if new_class not in self._classes:
            self._classes.append(new_class)
            self._class_list.insert("end", new_class)
            self._ensure_class_color(new_class)
            self._waterfall.set_class_colors(self._class_colors)
            self._global_table.set_class_colors(self._class_colors)
            self._image_annotation_list.set_class_colors(self._class_colors)
        if 0 <= idx < len(self._external_item_meta):
            si, ii = self._external_item_meta[idx]
            if si < len(self._patch_sources) and ii < len(self._patch_sources[si].get(patch_data.KEY_ITEMS) or []):
                self._patch_sources[si][patch_data.KEY_ITEMS][ii][patch_data.KEY_CLASS] = new_class
                patch_data.save_patch_sources(self._config_path, self._patch_sources)
        self._reload_patch_sources()
        self._refresh_external_list()

    def _on_external_context_menu(self, event) -> None:
        sel = self._external_list.curselection()
        if not sel:
            return
        menu = tk.Menu(self._win, tearoff=0)
        menu.add_command(label="Merge selected to same class", command=self._merge_external_to_class)
        menu.add_command(label="Remove selected", command=self._remove_external_selected)
        menu.tk_popup(event.x_root, event.y_root)

    def _remove_external_selected(self) -> None:
        rows = list(self._external_list.curselection())
        if not rows:
            return
        to_remove = []
        for r in rows:
            if 0 <= r < len(self._external_item_meta):
                to_remove.append(self._external_item_meta[r])
        by_source = {}
        for si, ii in to_remove:
            by_source.setdefault(si, []).append(ii)
        for si in sorted(by_source.keys(), reverse=True):
            iis = sorted(set(by_source[si]), reverse=True)
            items = self._patch_sources[si].get(patch_data.KEY_ITEMS) or []
            for ii in iis:
                if 0 <= ii < len(items):
                    items.pop(ii)
            if not items:
                self._patch_sources.pop(si)
        patch_data.save_patch_sources(self._config_path, self._patch_sources)
        self._reload_patch_sources()
        self._refresh_external_list()

    def _merge_external_to_class(self) -> None:
        rows = list(self._external_list.curselection())
        if not rows:
            messagebox.showinfo("Merge", "Select one or more external images first.")
            return
        class_name = simpledialog.askstring("Merge to class", "Class name:", initialvalue=self._classes[0] if self._classes else "")
        if not class_name or not class_name.strip():
            return
        class_name = class_name.strip()
        if class_name not in self._classes:
            self._classes.append(class_name)
            self._class_list.insert("end", class_name)
            self._ensure_class_color(class_name)
            self._waterfall.set_class_colors(self._class_colors)
            self._global_table.set_class_colors(self._class_colors)
            self._image_annotation_list.set_class_colors(self._class_colors)
        for r in rows:
            if 0 <= r < len(self._external_item_meta):
                si, ii = self._external_item_meta[r]
                if si < len(self._patch_sources) and ii < len(self._patch_sources[si].get(patch_data.KEY_ITEMS) or []):
                    self._patch_sources[si][patch_data.KEY_ITEMS][ii][patch_data.KEY_CLASS] = class_name
        patch_data.save_patch_sources(self._config_path, self._patch_sources)
        self._reload_patch_sources()
        self._refresh_external_list()
        self._status_label.config(text="Merged %d image(s) to class %s" % (len(rows), class_name))

    def _generate_yolo_dataset(self) -> None:
        if not self._images_dir or not os.path.isdir(self._images_dir):
            messagebox.showwarning("Generate", "Open an images directory first.")
            return
        if not self._classes:
            messagebox.showwarning("Generate", "Add at least one class.")
            return
        self._save_current()
        out_dir = filedialog.askdirectory(title="Output directory for YOLO dataset", initialdir=self._save_dir or self._images_dir)
        if not out_dir:
            return
        num_syn = simpledialog.askinteger("Synthetic images", "Number of paste images (0 = only annotated):", initialvalue=50, minvalue=0, maxvalue=1000)
        if num_syn is None:
            return
        images_out = os.path.join(out_dir, yolo_data_layout.IMAGES_SUBDIR)
        labels_out = os.path.join(out_dir, yolo_data_layout.LABELS_SUBDIR)
        os.makedirs(images_out, exist_ok=True)
        os.makedirs(labels_out, exist_ok=True)
        exts = (".jpg", ".jpeg", ".png", ".bmp")
        count_annot = 0
        for path in self._image_list:
            if not path.lower().endswith(exts):
                continue
            base = os.path.splitext(os.path.basename(path))[0]
            size = voc_io.image_size_from_file(path)
            if not size:
                continue
            shapes = annotation_io.load_annotations(path, self._save_dir, size)
            txt_path = os.path.join(labels_out, base + ".txt")
            n = annotation_io.export_yolo_detection_txt(txt_path, size, shapes, self._classes)
            if n > 0:
                dest = os.path.join(images_out, os.path.basename(path))
                if os.path.abspath(path) != os.path.abspath(dest):
                    shutil.copy2(path, dest)
                count_annot += 1
        count_syn = 0
        if num_syn > 0:
            flat = patch_data.get_patch_items_flat(self._config_path)
            patch_items = []
            for full, class_name in flat:
                if class_name not in self._classes:
                    continue
                cid = self._classes.index(class_name)
                if os.path.isfile(full):
                    patch_items.append((full, cid))
            if patch_items and self._image_list:
                bg_paths = [p for p in self._image_list if p.lower().endswith(exts) and os.path.isfile(p)]
                if bg_paths:
                    count_syn = detection_paste_generator.generate_detection_by_paste(
                        bg_paths, patch_items, self._classes, images_out, labels_out,
                        num_images=num_syn, patches_per_image=(2, 8),
                    )
        yolo_data_layout.write_data_yaml(out_dir, self._classes, train_subdir=yolo_data_layout.IMAGES_SUBDIR)
        msg = "Generated: %d annotated images" % count_annot
        if count_syn > 0:
            msg += ", %d synthetic (paste)" % count_syn
        msg += ". data.yaml written."
        self._status_label.config(text=msg)
        messagebox.showinfo("Generate", msg)

    def _set_shape_mode(self, mode: str, label: Optional[str] = None) -> None:
        if label is None:
            label = {"rectangle": "Rect", "polygon": "Polygon", "ellipse": "Ellipse", "circle": "Circle"}.get(mode, "Rect")
        self._shape_mode_var.set(label)
        self._waterfall.set_draw_mode(mode)
        if mode == DRAW_MODE_POLYGON:
            self._status_label.config(text="Polygon: click points, then Enter to close")
        else:
            try:
                sel = self._class_list.curselection()
                name = self._classes[sel[0]] if self._classes and sel else ""
                self._status_label.config(text="Current class: %s" % name if name else "")
            except (IndexError, tk.TclError):
                self._status_label.config(text="")

    def _update_class_info_area(self) -> None:
        sel = self._class_list.curselection()
        if sel:
            idx = sel[0]
            if 0 <= idx < len(self._classes):
                name = self._classes[idx]
                self._info_current_label.config(text="Current (for labeling): %s" % (name or "—"))
                if name and name in self._class_colors:
                    c = self._class_colors[name]
                    hex_color = "#%02x%02x%02x" % (c[0], c[1], c[2])
                    self._info_color_swatch.config(bg=hex_color)
                    self._info_color_swatch.config(text=" ")
                else:
                    self._info_color_swatch.config(bg="#9aa0a6")
            else:
                self._info_current_label.config(text="Current (for labeling): —")
                self._info_color_swatch.config(bg="#9aa0a6")
        else:
            self._info_current_label.config(text="Current (for labeling): —")
            self._info_color_swatch.config(bg="#9aa0a6")

    def _on_class_select(self, event) -> None:
        sel = self._class_list.curselection()
        if not sel:
            return
        idx = sel[0]
        if 0 <= idx < len(self._classes):
            name = self._classes[idx]
            self._waterfall.set_default_class(name)
            self._status_label.config(text="Current class: %s" % name)
            self._update_class_info_area()

    def _on_class_double_edit(self, event) -> None:
        sel = self._class_list.curselection()
        if not sel:
            return
        row = sel[0]
        if row < 0 or row >= len(self._classes):
            return
        old_name = self._classes[row]
        new_name = simpledialog.askstring("Rename class", "New name:", initialvalue=old_name)
        if not new_name or not new_name.strip():
            return
        new_name = new_name.strip()
        if new_name == old_name:
            return
        if new_name in self._classes and self._classes.index(new_name) != row:
            self._status_label.config(text="Class name already exists")
            return
        self._classes[row] = new_name
        if old_name in self._class_colors:
            self._class_colors[new_name] = self._class_colors.pop(old_name)
        self._save_config()
        self._class_list.delete(row)
        self._class_list.insert(row, new_name)
        self._class_list.selection_set(row)
        self._waterfall.set_class_colors(self._class_colors)
        self._global_table.set_class_colors(self._class_colors)
        self._image_annotation_list.set_class_colors(self._class_colors)
        self._update_class_info_area()
        self._status_label.config(text="Class renamed: %s → %s (ID: %d)" % (old_name, new_name, row))

    def _add_class_inline(self) -> None:
        base = "class"
        idx = 0
        while f"{base}{idx}" in self._classes:
            idx += 1
        name = f"{base}{idx}"
        self._classes.append(name)
        self._class_list.insert("end", name)
        self._ensure_class_color(name)
        self._waterfall.set_class_colors(self._class_colors)
        self._global_table.set_class_colors(self._class_colors)
        self._image_annotation_list.set_class_colors(self._class_colors)
        self._waterfall.set_default_class(name)
        self._class_list.selection_clear(0, "end")
        self._class_list.selection_set(self._class_list.size() - 1)
        self._class_list.see("end")
        self._update_class_info_area()
        self._status_label.config(text="Added class: %s (ID: %d)" % (name, len(self._classes) - 1))

    def _on_waterfall_canvas_focused(self, canvas) -> None:
        self._focused_canvas = canvas
        image_path = self._waterfall.get_image_path_for_canvas(canvas)
        if image_path:
            cache = self._waterfall.get_annotation_cache()
            shapes = cache.get(image_path, [])
            self._image_annotation_list.set_image_annotations(image_path, shapes)

    def _on_annotation_cache_changed(self) -> None:
        self._update_annotation_tables()

    def _update_annotation_tables(self) -> None:
        cache = self._waterfall.get_annotation_cache()
        self._global_table.set_annotation_cache(cache)
        if self._focused_canvas:
            image_path = self._waterfall.get_image_path_for_canvas(self._focused_canvas)
            if image_path:
                shapes = cache.get(image_path, [])
                self._image_annotation_list.set_image_annotations(image_path, shapes)

    def _on_global_table_image_activated(self, image_path: str) -> None:
        self._waterfall.focus_card_for_image(image_path)

    def _on_card_right_click(self, image_path: str, x_root: int, y_root: int) -> None:
        cache = self._waterfall.get_annotation_cache()
        shapes = cache.get(image_path, [])
        menu = tk.Menu(self._win, tearoff=0)
        can_delete = len(shapes) == 0
        if can_delete:
            menu.add_command(
                label="Delete image (删除图片)",
                command=lambda: self._delete_image_from_disk(image_path),
            )
        else:
            menu.add_command(
                label="Delete image (only when no annotations)",
                state="disabled",
            )
        try:
            menu.tk_popup(x_root, y_root)
        finally:
            menu.grab_release()

    def _delete_image_from_disk(self, image_path: str) -> None:
        cache = self._waterfall.get_annotation_cache()
        if cache.get(image_path):
            messagebox.showwarning("Delete", "Image has annotations; remove them first.")
            return
        if not os.path.isfile(image_path):
            return
        if not messagebox.askyesno("Delete image", "Delete image file and its annotation files?\n%s" % os.path.basename(image_path)):
            return
        base = os.path.splitext(os.path.basename(image_path))[0]
        for ext in (".json", ".xml"):
            p = os.path.join(self._save_dir, base + ext)
            if os.path.isfile(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
        try:
            os.remove(image_path)
        except OSError:
            messagebox.showerror("Delete", "Could not delete image file.")
            return
        self._image_list = [p for p in self._image_list if p != image_path]
        if cache and image_path in cache:
            del cache[image_path]
        if self._image_list:
            self._refresh_waterfall_from_list()
        else:
            self._waterfall.set_images([], lambda p: [])
            self._update_annotation_tables()
        self._status_label.config(text="Deleted image: %s" % os.path.basename(image_path) if self._image_list else "No images")

    def _on_image_annotation_deleted(self, image_path: str, shape_index: int) -> None:
        cache = self._waterfall.get_annotation_cache()
        if image_path in cache and 0 <= shape_index < len(cache[image_path]):
            cache[image_path].pop(shape_index)
            for c in self._waterfall._cards:
                if c.image_path() == image_path:
                    c.canvas().set_shapes(cache[image_path])
                    self._focused_canvas = c.canvas()
                    break
            self._update_annotation_tables()

    def _on_image_annotation_selected(self, image_path: str, shape_index: int) -> None:
        for c in self._waterfall._cards:
            if c.image_path() == image_path:
                canvas = c.canvas()
                shapes = canvas.get_shapes()
                if 0 <= shape_index < len(shapes):
                    canvas.set_selected_index(shape_index)
                    canvas.update()
                    self._focused_canvas = canvas
                break

    def _update_zoom_label(self) -> None:
        pct = int(round(self._card_scale * 100))
        self._zoom_label.config(text="%d%%" % pct)
        config.set_zoom_percent(pct)

    def _zoom_in(self) -> None:
        self._card_scale = min(4.0, self._card_scale + 0.25)
        self._waterfall.set_card_scale(self._card_scale)
        self._update_zoom_label()

    def _zoom_out(self) -> None:
        self._card_scale = max(0.25, self._card_scale - 0.25)
        self._waterfall.set_card_scale(self._card_scale)
        self._update_zoom_label()

    def _open_dir(self) -> None:
        d = filedialog.askdirectory(title="Open images directory", initialdir=self._images_dir or os.path.expanduser("~"))
        if not d:
            return
        self._images_dir = d
        config.set_last_images_dir(d)
        if not self._save_dir:
            self._save_dir = d
            config.set_last_save_dir(d)
        self._load_image_list()

    def _change_save_dir(self) -> None:
        d = filedialog.askdirectory(title="Change save directory", initialdir=self._save_dir or self._images_dir)
        if not d:
            return
        self._save_dir = d
        config.set_last_save_dir(d)
        self._status_label.config(text="Save dir: %s" % d)

    def _load_annotations_for_path(self, path: str):
        size = voc_io.image_size_from_file(path)
        return annotation_io.load_annotations(path, self._save_dir, size)

    def _load_image_list(self) -> None:
        self._image_list = []
        exts = (".jpg", ".jpeg", ".png", ".bmp")
        try:
            for f in sorted(os.listdir(self._images_dir)):
                if f.lower().endswith(exts):
                    self._image_list.append(os.path.join(self._images_dir, f))
        except OSError:
            pass
        if len(self._image_list) > THUMB_MAX_LIST:
            self._status_label.config(text="%d images (showing first %d)" % (len(self._image_list), THUMB_MAX_LIST))
        else:
            self._status_label.config(text="%d images" % len(self._image_list))
        if self._image_list:
            self._refresh_waterfall_from_list()
        else:
            self._waterfall.set_images([], lambda p: [])
            self._update_annotation_tables()

    def _refresh_waterfall_from_list(self) -> None:
        if not self._image_list:
            return
        self._waterfall.set_images(self._image_list, self._load_annotations_for_path)
        self._waterfall.set_card_scale(self._card_scale)
        self._waterfall.set_class_colors(self._class_colors)
        self._global_table.set_class_colors(self._class_colors)
        self._image_annotation_list.set_class_colors(self._class_colors)
        self._waterfall.set_draw_mode(DRAW_MODE_RECTANGLE)
        self._shape_mode_var.set("Rect")
        if self._classes:
            self._waterfall.set_default_class(self._classes[0])
        else:
            self._waterfall.set_default_class("")
        self._update_annotation_tables()

    def _save_current(self) -> None:
        cache = self._waterfall.get_annotation_cache()
        if not cache:
            return
        saved = 0
        for path, shapes in cache.items():
            size = voc_io.image_size_from_file(path) or (0, 0)
            if size == (0, 0):
                continue
            annotation_io.save_annotations(path, self._save_dir, size, shapes, write_voc=True)
            saved += 1
        self._status_label.config(text="Saved %d image(s)" % saved)

    def _delete_selected(self) -> None:
        if self._focused_canvas and self._focused_canvas.delete_selected():
            self._status_label.config(text="Deleted selected box")

    def _on_close(self) -> None:
        self._save_current()
        config.set_zoom_percent(int(round(self._card_scale * 100)))
        self._win.destroy()

    def is_destroyed(self) -> bool:
        try:
            return not self._win.winfo_exists()
        except tk.TclError:
            return True


def run_voc_annotator(
    images_dir: Optional[str] = None,
    save_dir: Optional[str] = None,
    classes: Optional[List[str]] = None,
    project_name: Optional[str] = None,
    config_path: Optional[str] = None,
    project_path: Optional[str] = None,
    event_pump_schedule: Optional[Callable[[Callable[[], None], int], None]] = None,
) -> None:
    """Open VOC Annotator window (Tk). When event_pump_schedule(callback, delay_ms) is provided, the host drives the UI loop; does not block. Otherwise blocks until window closed."""
    root = getattr(tk, "_default_root", None)
    created_root = False
    if root is None:
        root = tk.Tk()
        root.withdraw()
        created_root = True
    win = VOCAnnotatorWindow(
        images_dir=images_dir,
        save_dir=save_dir,
        classes=classes,
        project_name=project_name,
        config_path=config_path,
        project_path=project_path,
        parent=root,
    )
    if event_pump_schedule is not None:
        def pump_once():
            if not win.is_destroyed():
                try:
                    root.update()
                except tk.TclError:
                    pass
                event_pump_schedule(pump_once, 50)
        event_pump_schedule(pump_once, 50)
        return
    root.wait_window(win._win)
    if created_root:
        try:
            root.destroy()
        except tk.TclError:
            pass

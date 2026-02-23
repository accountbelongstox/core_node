# -*- coding: utf-8 -*-
"""
Annotation tables: global table (all images) and per-image annotation list.
Display annotations with class colors; support deletion.
Tkinter implementation (no PySide6).
"""

import os
import tkinter as tk
from tkinter import ttk
from typing import Any, Dict, List, Optional, Tuple, Union

from . import annotation_io

ColorSpec = Union[Tuple[int, int, int], str]


def _color_to_hex(c: ColorSpec) -> str:
    if isinstance(c, str) and c.startswith("#"):
        return c
    if isinstance(c, (list, tuple)) and len(c) >= 3:
        return "#%02x%02x%02x" % (int(c[0]) % 256, int(c[1]) % 256, int(c[2]) % 256)
    return "#cccccc"


class GlobalAnnotationTable:
    """Table showing all annotations across all images: image, class, shape_type, bbox/polygon summary."""

    def __init__(self, parent: Optional[tk.Widget] = None):
        self._parent = parent
        self._frame = tk.Frame(parent)
        self._class_colors: Dict[str, ColorSpec] = {}
        self._annotation_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._on_image_activated: Optional[Any] = None
        self._on_annotation_deleted: Optional[Any] = None

        tk.Label(self._frame, text="All Annotations (总表)", font=("", 11, "bold")).pack(anchor="w")
        self._tree = ttk.Treeview(
            self._frame,
            columns=("image", "class", "type", "position", "color"),
            show="headings",
            height=12,
            selectmode="browse",
        )
        self._tree.heading("image", text="Image")
        self._tree.heading("class", text="Class")
        self._tree.heading("type", text="Type")
        self._tree.heading("position", text="Position")
        self._tree.heading("color", text="Color")
        self._tree.column("image", width=80, minwidth=60)
        self._tree.column("class", width=60, minwidth=50)
        self._tree.column("type", width=70, minwidth=50)
        self._tree.column("position", width=120, minwidth=80)
        self._tree.column("color", width=40, minwidth=30)
        self._tree.pack(fill="both", expand=True)
        self._tree.bind("<Double-1>", self._on_double_click)
        self._tree.bind("<Button-3>", self._on_right_click)
        self._row_data: Dict[str, Tuple[str, int]] = {}

    def widget(self) -> tk.Frame:
        return self._frame

    def set_image_activated_callback(self, cb: Optional[Any]) -> None:
        self._on_image_activated = cb

    def set_annotation_deleted_callback(self, cb: Optional[Any]) -> None:
        self._on_annotation_deleted = cb

    def set_class_colors(self, color_map: Dict[str, ColorSpec]) -> None:
        self._class_colors = dict(color_map) if color_map else {}
        self._refresh_table()

    def set_annotation_cache(self, cache: Dict[str, List[Dict[str, Any]]]) -> None:
        self._annotation_cache = cache
        self._refresh_table()

    def _format_position(self, shape: Dict[str, Any]) -> str:
        pts = shape.get("points") or []
        if not pts:
            return ""
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            return f"[{int(min(x1,x2))},{int(min(y1,y2))}]-[{int(max(x1,x2))},{int(max(y1,y2))}]"
        if st == annotation_io.SHAPE_TYPE_POLYGON:
            return f"Polygon({len(pts)} pts)"
        if st == annotation_io.SHAPE_TYPE_ELLIPSE:
            return f"Ellipse({len(pts)} pts)"
        if st == annotation_io.SHAPE_TYPE_CIRCLE:
            return f"Circle({len(pts)} pts)"
        return f"{len(pts)} points"

    def _refresh_table(self) -> None:
        for iid in self._tree.get_children():
            self._tree.delete(iid)
        self._row_data.clear()
        for image_path, shapes in self._annotation_cache.items():
            for shape_idx, shape in enumerate(shapes):
                image_name = os.path.basename(image_path)
                label = (shape.get("label") or "").strip() or "(no class)"
                shape_type = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
                pos_str = self._format_position(shape)
                hex_color = _color_to_hex(self._class_colors[label]) if label in self._class_colors else "#cccccc"
                tag = "bg_" + hex_color.replace("#", "")
                iid = self._tree.insert("", "end", values=(image_name, label, shape_type, pos_str, ""), tags=(tag,))
                self._row_data[iid] = (image_path, shape_idx)
                self._tree.tag_configure(tag, background=hex_color)

    def _on_double_click(self, event) -> None:
        sel = self._tree.selection()
        if not sel:
            return
        iid = sel[0]
        data = self._row_data.get(iid)
        if data and self._on_image_activated:
            self._on_image_activated(data[0])

    def _on_right_click(self, event) -> None:
        region = self._tree.identify_region(event.x, event.y)
        if region != "cell" and region != "tree":
            return
        iid = self._tree.identify_row(event.y)
        if not iid:
            return
        self._tree.selection_set(iid)
        self._tree.focus(iid)
        data = self._row_data.get(iid)
        if not data or not self._on_annotation_deleted:
            return
        image_path, shape_index = data
        menu = tk.Menu(self._frame, tearoff=0)
        menu.add_command(label="Delete (删除)", command=lambda: self._on_annotation_deleted(image_path, shape_index))
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()


class ImageAnnotationList:
    """List showing annotations for one active image; supports deletion."""

    def __init__(self, parent: Optional[tk.Widget] = None):
        self._parent = parent
        self._frame = tk.Frame(parent)
        self._class_colors: Dict[str, ColorSpec] = {}
        self._current_image_path: Optional[str] = None
        self._shapes: List[Dict[str, Any]] = []
        self._on_annotation_deleted: Optional[Any] = None
        self._on_annotation_selected: Optional[Any] = None

        self._title_label = tk.Label(self._frame, text="Current Image Annotations (当前图标注)", font=("", 11, "bold"))
        self._title_label.pack(anchor="w")
        self._tree = ttk.Treeview(
            self._frame,
            columns=("index", "class", "type", "position", "color"),
            show="headings",
            height=6,
            selectmode="extended",
        )
        self._tree.heading("index", text="Index")
        self._tree.heading("class", text="Class")
        self._tree.heading("type", text="Type")
        self._tree.heading("position", text="Position")
        self._tree.heading("color", text="Color")
        self._tree.column("index", width=40)
        self._tree.column("class", width=60)
        self._tree.column("type", width=70)
        self._tree.column("position", width=120)
        self._tree.column("color", width=40)
        self._tree.pack(fill="both", expand=True)
        self._tree.bind("<Double-1>", self._on_double_click)
        ttk.Button(self._frame, text="Delete Selected", command=self._delete_selected).pack(pady=4)
        self._row_to_index: Dict[str, int] = {}

    def widget(self) -> tk.Frame:
        return self._frame

    def set_annotation_deleted_callback(self, cb: Optional[Any]) -> None:
        self._on_annotation_deleted = cb

    def set_annotation_selected_callback(self, cb: Optional[Any]) -> None:
        self._on_annotation_selected = cb

    def set_class_colors(self, color_map: Dict[str, ColorSpec]) -> None:
        self._class_colors = dict(color_map) if color_map else {}
        self._refresh_list()

    def set_image_annotations(self, image_path: str, shapes: List[Dict[str, Any]]) -> None:
        self._current_image_path = image_path
        self._shapes = list(shapes)
        self._title_label.config(text="Current Image Annotations: %s" % os.path.basename(image_path))
        self._refresh_list()

    def _format_position(self, shape: Dict[str, Any]) -> str:
        pts = shape.get("points") or []
        if not pts:
            return ""
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            return f"[{int(min(x1,x2))},{int(min(y1,y2))}]-[{int(max(x1,x2))},{int(max(y1,y2))}]"
        if st == annotation_io.SHAPE_TYPE_POLYGON:
            return f"Polygon({len(pts)} pts)"
        if st == annotation_io.SHAPE_TYPE_ELLIPSE:
            return f"Ellipse({len(pts)} pts)"
        if st == annotation_io.SHAPE_TYPE_CIRCLE:
            return f"Circle({len(pts)} pts)"
        return f"{len(pts)} points"

    def _refresh_list(self) -> None:
        for iid in self._tree.get_children():
            self._tree.delete(iid)
        self._row_to_index.clear()
        for idx, shape in enumerate(self._shapes):
            label = (shape.get("label") or "").strip() or "(no class)"
            shape_type = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
            pos_str = self._format_position(shape)
            hex_color = _color_to_hex(self._class_colors[label]) if label in self._class_colors else "#cccccc"
            tag = "bg_" + hex_color.replace("#", "")
            iid = self._tree.insert("", "end", values=(str(idx), label, shape_type, pos_str, ""), tags=(tag,))
            self._row_to_index[iid] = idx
            self._tree.tag_configure(tag, background=hex_color)

    def _on_double_click(self, event) -> None:
        sel = self._tree.selection()
        if not sel or not self._current_image_path or not self._on_annotation_selected:
            return
        iid = sel[0]
        idx = self._row_to_index.get(iid)
        if idx is not None and 0 <= idx < len(self._shapes):
            self._on_annotation_selected(self._current_image_path, idx)

    def _delete_selected(self) -> None:
        sel = self._tree.selection()
        if not sel or not self._current_image_path or not self._on_annotation_deleted:
            return
        rows = sorted([self._row_to_index[iid] for iid in sel if iid in self._row_to_index], reverse=True)
        for row in rows:
            if 0 <= row < len(self._shapes):
                self._on_annotation_deleted(self._current_image_path, row)

# -*- coding: utf-8 -*-
"""
Canvas widget: display image at zoom; draw and edit shapes (rectangle, polygon, ellipse, circle).
Stores shapes (shape_type, label, points, difficult); boxes derived for VOC compatibility.
Tkinter implementation (no PySide6).
"""

import os
from typing import Any, Dict, List, Optional, Tuple, Union

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageTk

from . import annotation_io

_PIL_Image = get_third_package_PIL_Image()
_PIL_ImageTk = get_third_package_PIL_ImageTk()

# RGB tuple (0-255) or hex string for Tk Canvas
ColorSpec = Union[Tuple[int, int, int], str]

# Backward compat: Box = (class_name, xmin, ymin, xmax, ymax, difficult)
Box = Tuple[str, int, int, int, int, int]

DRAW_MODE_RECTANGLE = "rectangle"
DRAW_MODE_POLYGON = "polygon"
DRAW_MODE_ELLIPSE = "ellipse"
DRAW_MODE_CIRCLE = "circle"


def _point_in_polygon(px: float, py: float, pts: List[Tuple[float, float]]) -> bool:
    if len(pts) < 3:
        return False
    n = len(pts)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = pts[i][0], pts[i][1]
        xj, yj = pts[j][0], pts[j][1]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _color_to_hex(c: ColorSpec) -> str:
    if isinstance(c, str) and c.startswith("#"):
        return c
    if isinstance(c, (list, tuple)) and len(c) >= 3:
        return "#%02x%02x%02x" % (int(c[0]) % 256, int(c[1]) % 256, int(c[2]) % 256)
    return "#00ff00"


class AnnotatorCanvas:
    """Display image with zoom; draw shapes in image space; callbacks for boxes/shapes (VOC compat)."""

    def __init__(self, parent, **kwargs):
        import tkinter as tk
        self._tk = tk
        self._parent = parent
        self._canvas = tk.Canvas(
            parent,
            width=400,
            height=300,
            bg="#3c3c3c",
            highlightthickness=0,
            **kwargs,
        )
        self._image_path: Optional[str] = None
        self._image_size: Tuple[int, int] = (0, 0)
        self._pil_image: Optional[Any] = None
        self._photo: Optional[Any] = None
        self._photo_id: Optional[Any] = None
        self._shapes: List[Dict[str, Any]] = []
        self._scale = 1.0
        self._creating: Optional[Tuple[int, int, int, int]] = None  # x1,y1,x2,y2 canvas
        self._polygon_draft: List[Tuple[int, int]] = []
        self._polygon_mouse_pos: Optional[Tuple[int, int]] = None
        self._ellipse_draft: Optional[Tuple[int, int, int, int]] = None
        self._polygon_close_threshold = 10
        self._selected_index: Optional[int] = None
        self._default_class: str = ""
        self._draw_mode = DRAW_MODE_RECTANGLE
        self._class_colors: Dict[str, ColorSpec] = {}
        self._on_boxes_changed: Optional[Any] = None
        self._on_shapes_changed: Optional[Any] = None
        self._shape_draw_ids: List[Any] = []
        self._draft_ids: List[Any] = []

        self._canvas.bind("<Button-1>", self._on_btn1)
        self._canvas.bind("<B1-Motion>", self._on_motion)
        self._canvas.bind("<ButtonRelease-1>", self._on_release1)
        self._canvas.bind("<Motion>", self._on_mouse_move)
        self._canvas.bind("<Button-3>", self._on_btn3)
        self._canvas.bind("<Key>", self._on_key)
        self._canvas.bind("<FocusIn>", self._on_focus_in)
        self._canvas.configure(takefocus=1)

    def widget(self):
        return self._canvas

    def set_scale(self, scale: float) -> None:
        self._scale = max(0.25, min(4.0, scale))
        self._redraw()

    def scale(self) -> float:
        return self._scale

    def set_draw_mode(self, mode: str) -> None:
        if mode in (DRAW_MODE_RECTANGLE, DRAW_MODE_POLYGON, DRAW_MODE_ELLIPSE, DRAW_MODE_CIRCLE):
            self._draw_mode = mode
            self._polygon_draft = []
            self._polygon_mouse_pos = None
            self._creating = None
            self._ellipse_draft = None
            self._redraw()

    def draw_mode(self) -> str:
        return self._draw_mode

    def load_image(self, image_path: str) -> bool:
        if not image_path or not os.path.isfile(image_path):
            return False
        try:
            pil = _PIL_Image.open(image_path)
        except OSError:
            return False
        if pil.mode != "RGB":
            pil = pil.convert("RGB")
        w, h = pil.size
        self._image_path = image_path
        self._image_size = (w, h)
        self._pil_image = pil
        self._shapes = []
        self._creating = None
        self._polygon_draft = []
        self._ellipse_draft = None
        self._selected_index = None
        self._redraw()
        return True

    def set_boxes(self, boxes: List[Box]) -> None:
        self._shapes = annotation_io.boxes_to_shapes(boxes)
        self._emit_updates()

    def get_boxes(self) -> List[Box]:
        return annotation_io.shapes_to_boxes(self._shapes)

    def set_shapes(self, shapes: List[Dict[str, Any]]) -> None:
        self._shapes = list(shapes)
        self._emit_updates()

    def get_shapes(self) -> List[Dict[str, Any]]:
        return list(self._shapes)

    def _emit_updates(self) -> None:
        self._redraw()
        if self._on_boxes_changed:
            self._on_boxes_changed(self.get_boxes())
        if self._on_shapes_changed:
            self._on_shapes_changed(self.get_shapes())

    def set_boxes_changed_callback(self, cb: Optional[Any]) -> None:
        self._on_boxes_changed = cb

    def set_shapes_changed_callback(self, cb: Optional[Any]) -> None:
        self._on_shapes_changed = cb

    def get_selected_index(self) -> Optional[int]:
        if self._selected_index is not None and 0 <= self._selected_index < len(self._shapes):
            return self._selected_index
        return None

    def image_path(self) -> Optional[str]:
        return self._image_path

    def image_size(self) -> Tuple[int, int]:
        return self._image_size

    def _image_rect(self) -> Tuple[int, int, int, int]:
        if self._image_size == (0, 0):
            return (0, 0, 0, 0)
        w = int(self._image_size[0] * self._scale)
        h = int(self._image_size[1] * self._scale)
        return (0, 0, w, h)

    def _to_image_point(self, cx: int, cy: int) -> Tuple[int, int]:
        return (int(cx / self._scale), int(cy / self._scale))

    def _to_canvas_point(self, x: float, y: float) -> Tuple[int, int]:
        return (int(x * self._scale), int(y * self._scale))

    def _to_canvas_rect(self, xmin: int, ymin: int, xmax: int, ymax: int) -> Tuple[int, int, int, int]:
        x1 = int(xmin * self._scale)
        y1 = int(ymin * self._scale)
        x2 = int(xmax * self._scale)
        y2 = int(ymax * self._scale)
        return (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))

    def _shape_contains_canvas_point(self, shape: Dict, cx: int, cy: int) -> bool:
        pts = shape.get("points") or []
        if len(pts) < 2:
            return False
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            r = self._to_canvas_rect(int(min(x1, x2)), int(min(y1, y2)), int(max(x1, x2)), int(max(y1, y2)))
            return r[0] <= cx <= r[2] and r[1] <= cy <= r[3]
        if st == annotation_io.SHAPE_TYPE_POLYGON and len(pts) >= 3:
            cpts = [(self._to_canvas_point(x, y)[0], self._to_canvas_point(x, y)[1]) for x, y in pts]
            return _point_in_polygon(float(cx), float(cy), [(float(a), float(b)) for a, b in cpts])
        if st in (annotation_io.SHAPE_TYPE_ELLIPSE, annotation_io.SHAPE_TYPE_CIRCLE) and len(pts) >= 2:
            bbox = annotation_io.shape_to_bbox(shape)
            if bbox:
                r = self._to_canvas_rect(*bbox)
                return r[0] <= cx <= r[2] and r[1] <= cy <= r[3]
        return False

    def _hit_shape(self, cx: int, cy: int) -> Optional[int]:
        for i in range(len(self._shapes) - 1, -1, -1):
            if self._shape_contains_canvas_point(self._shapes[i], cx, cy):
                return i
        return None

    def _redraw(self) -> None:
        c = self._canvas
        if self._photo_id is not None:
            try:
                c.delete(self._photo_id)
            except Exception:
                pass
            self._photo_id = None
        for id_ in self._shape_draw_ids:
            try:
                c.delete(id_)
            except Exception:
                pass
        self._shape_draw_ids = []
        for id_ in self._draft_ids:
            try:
                c.delete(id_)
            except Exception:
                pass
        self._draft_ids = []

        if self._pil_image is not None and self._image_size != (0, 0):
            cw = int(self._image_size[0] * self._scale)
            ch = int(self._image_size[1] * self._scale)
            if cw > 0 and ch > 0:
                resample = getattr(_PIL_Image, "LANCZOS", None) or getattr(getattr(_PIL_Image, "Resampling", None), "LANCZOS", 1)
                resized = self._pil_image.resize((cw, ch), resample)
                self._photo = _PIL_ImageTk.PhotoImage(resized)
                self._photo_id = c.create_image(0, 0, anchor="nw", image=self._photo)
                c.lower(self._photo_id)

        default_color = "#00ff00"
        for i, shape in enumerate(self._shapes):
            if i == self._selected_index:
                color = "#ffc800"
                width = 3
            else:
                label = (shape.get("label") or "").strip()
                if label and label in self._class_colors:
                    color = _color_to_hex(self._class_colors[label])
                else:
                    color = default_color
                width = 2
            ids = self._draw_shape_canvas(shape, color, width)
            self._shape_draw_ids.extend(ids)

        if self._creating is not None:
            x1, y1, x2, y2 = self._creating
            id_ = c.create_rectangle(x1, y1, x2, y2, outline="#00ffff", width=2)
            self._draft_ids.append(id_)

        if self._polygon_draft:
            pts = self._polygon_draft
            for j in range(len(pts) - 1):
                id_ = c.create_line(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], fill="#00ffff", width=2)
                self._draft_ids.append(id_)
            if self._polygon_mouse_pos is not None:
                id_ = c.create_line(pts[-1][0], pts[-1][1], self._polygon_mouse_pos[0], self._polygon_mouse_pos[1], fill="#00ffff", width=2)
                self._draft_ids.append(id_)
            elif len(pts) >= 2:
                id_ = c.create_line(pts[-1][0], pts[-1][1], pts[0][0], pts[0][1], fill="#00ffff", width=2)
                self._draft_ids.append(id_)

        if self._ellipse_draft is not None:
            x1, y1, x2, y2 = self._ellipse_draft
            id_ = c.create_oval(x1, y1, x2, y2, outline="#00ffff", width=2)
            self._draft_ids.append(id_)

    def _draw_shape_canvas(self, shape: Dict, color: str, width: int) -> List[Any]:
        c = self._canvas
        ids = []
        pts = shape.get("points") or []
        if not pts:
            return ids
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            r = self._to_canvas_rect(int(min(x1, x2)), int(min(y1, y2)), int(max(x1, x2)), int(max(y1, y2)))
            id_ = c.create_rectangle(r[0], r[1], r[2], r[3], outline=color, width=width)
            ids.append(id_)
            return ids
        if st == annotation_io.SHAPE_TYPE_POLYGON and len(pts) >= 2:
            flat = []
            for x, y in pts:
                a, b = self._to_canvas_point(x, y)
                flat.extend([a, b])
            if len(flat) >= 4:
                id_ = c.create_polygon(flat, outline=color, width=width, fill="")
                ids.append(id_)
            return ids
        if st in (annotation_io.SHAPE_TYPE_ELLIPSE, annotation_io.SHAPE_TYPE_CIRCLE) and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            r = (
                min(x1, x2) * self._scale, min(y1, y2) * self._scale,
                max(x1, x2) * self._scale, max(y1, y2) * self._scale,
            )
            id_ = c.create_oval(r[0], r[1], r[2], r[3], outline=color, width=width)
            ids.append(id_)
            return ids
        bbox = annotation_io.shape_to_bbox(shape)
        if bbox:
            r = self._to_canvas_rect(*bbox)
            id_ = c.create_rectangle(r[0], r[1], r[2], r[3], outline=color, width=width)
            ids.append(id_)
        return ids

    def _on_btn1(self, event) -> None:
        self._canvas.focus_set()
        cx, cy = event.x, event.y
        ir = self._image_rect()
        if not (ir[0] <= cx < ir[2] and ir[1] <= cy < ir[3]):
            return
        if self._draw_mode == DRAW_MODE_POLYGON:
            if len(self._polygon_draft) >= 2:
                dx = cx - self._polygon_draft[0][0]
                dy = cy - self._polygon_draft[0][1]
                if dx * dx + dy * dy <= self._polygon_close_threshold * self._polygon_close_threshold:
                    self.close_polygon_draft()
                    self._polygon_mouse_pos = None
                    self._selected_index = None
                    self._redraw()
                    return
            self._polygon_draft.append((cx, cy))
            self._selected_index = None
            self._redraw()
            return
        if self._draw_mode in (DRAW_MODE_ELLIPSE, DRAW_MODE_CIRCLE):
            self._ellipse_draft = (cx, cy, cx, cy)
            self._selected_index = None
            self._redraw()
            return
        idx = self._hit_shape(cx, cy)
        if idx is not None:
            self._selected_index = idx
            self._creating = None
        else:
            self._creating = (cx, cy, cx, cy)
            self._selected_index = None
        self._redraw()

    def _on_motion(self, event) -> None:
        cx, cy = event.x, event.y
        if self._creating is not None:
            x1, y1, _, _ = self._creating
            self._creating = (x1, y1, cx, cy)
            self._redraw()
        elif self._ellipse_draft is not None:
            x1, y1, _, _ = self._ellipse_draft
            self._ellipse_draft = (x1, y1, cx, cy)
            self._redraw()
        elif self._draw_mode == DRAW_MODE_POLYGON and self._polygon_draft:
            self._polygon_mouse_pos = (cx, cy)
            self._redraw()

    def _on_release1(self, event) -> None:
        cx, cy = event.x, event.y
        if self._creating is not None:
            x1, y1, x2, y2 = self._creating[0], self._creating[1], self._creating[2], self._creating[3]
            ix1, iy1 = self._to_image_point(x1, y1)
            ix2, iy2 = self._to_image_point(x2, y2)
            xmin, xmax = min(ix1, ix2), max(ix1, ix2)
            ymin, ymax = min(iy1, iy2), max(iy1, iy2)
            if xmax - xmin >= 2 and ymax - ymin >= 2:
                cls = self._default_class if isinstance(self._default_class, str) else ""
                self._shapes.append({
                    "shape_type": annotation_io.SHAPE_TYPE_RECTANGLE,
                    "label": cls,
                    "points": [[xmin, ymin], [xmax, ymax]],
                    "difficult": 0,
                })
                self._emit_updates()
            self._creating = None
            self._redraw()
            return
        if self._ellipse_draft is not None:
            x1, y1, x2, y2 = self._ellipse_draft
            ix1, iy1 = self._to_image_point(x1, y1)
            ix2, iy2 = self._to_image_point(x2, y2)
            if abs(ix2 - ix1) >= 2 and abs(iy2 - iy1) >= 2:
                cls = self._default_class if isinstance(self._default_class, str) else ""
                st = annotation_io.SHAPE_TYPE_CIRCLE if self._draw_mode == DRAW_MODE_CIRCLE else annotation_io.SHAPE_TYPE_ELLIPSE
                self._shapes.append({
                    "shape_type": st,
                    "label": cls,
                    "points": [[ix1, iy1], [ix2, iy2]],
                    "difficult": 0,
                })
                self._emit_updates()
            self._ellipse_draft = None
            self._redraw()

    def _on_mouse_move(self, event) -> None:
        if self._draw_mode == DRAW_MODE_POLYGON and self._polygon_draft:
            self._polygon_mouse_pos = (event.x, event.y)
            self._redraw()

    def _on_btn3(self, event) -> None:
        self._creating = None
        self._polygon_draft = []
        self._polygon_mouse_pos = None
        self._ellipse_draft = None
        self._selected_index = None
        self._redraw()

    def _on_key(self, event) -> None:
        if event.keysym in ("Return", "KP_Enter"):
            if self._polygon_draft and self.close_polygon_draft():
                self._redraw()
                return

    def _on_focus_in(self, event) -> None:
        pass

    def close_polygon_draft(self) -> bool:
        if len(self._polygon_draft) < 3:
            return False
        pts_img = [self._to_image_point(p[0], p[1]) for p in self._polygon_draft]
        cls = self._default_class if isinstance(self._default_class, str) else ""
        self._shapes.append({
            "shape_type": annotation_io.SHAPE_TYPE_POLYGON,
            "label": cls,
            "points": [[x, y] for x, y in pts_img],
            "difficult": 0,
        })
        self._polygon_draft = []
        self._polygon_mouse_pos = None
        self._emit_updates()
        return True

    def delete_selected(self) -> bool:
        if self._selected_index is not None and 0 <= self._selected_index < len(self._shapes):
            self._shapes.pop(self._selected_index)
            self._selected_index = None
            self._emit_updates()
            return True
        return False

    def set_default_class(self, class_name: str) -> None:
        self._default_class = class_name if isinstance(class_name, str) else ""

    def default_class(self) -> str:
        return self._default_class

    def set_box_class(self, index: int, class_name: str) -> None:
        if 0 <= index < len(self._shapes):
            self._shapes[index]["label"] = class_name
            self._emit_updates()

    def set_class_colors(self, color_map: Dict[str, ColorSpec]) -> None:
        self._class_colors = dict(color_map) if color_map else {}
        self._redraw()

    def set_selected_index(self, index: Optional[int]) -> None:
        self._selected_index = index
        self._redraw()

    def update(self) -> None:
        self._redraw()

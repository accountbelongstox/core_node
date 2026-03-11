# -*- coding: utf-8 -*-
"""
Canvas widget: display image at zoom; draw and edit shapes (rectangle, polygon, ellipse, circle).
Stores shapes (shape_type, label, points, difficult); boxes derived for VOC compatibility.
"""

import os
from typing import Any, Dict, List, Optional, Tuple

from PySide6.QtCore import Qt, QPoint, QPointF, QRect, QRectF, Signal
from PySide6.QtGui import QPixmap, QPainter, QColor, QPen, QImage, QPolygonF, QPainterPath
from PySide6.QtWidgets import QWidget

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

from . import annotation_io

_PIL_Image = get_third_package_PIL_Image()

# Backward compat: Box = (class_name, xmin, ymin, xmax, ymax, difficult)
Box = Tuple[str, int, int, int, int, int]

DRAW_MODE_RECTANGLE = "rectangle"
DRAW_MODE_POLYGON = "polygon"
DRAW_MODE_ELLIPSE = "ellipse"
DRAW_MODE_CIRCLE = "circle"


def _point_in_polygon(pt: QPointF, pts: List[QPointF]) -> bool:
    if len(pts) < 3:
        return False
    path = QPainterPath(pts[0])
    for p in pts[1:]:
        path.lineTo(p)
    path.closeSubpath()
    return path.contains(pt)


class AnnotatorCanvas(QWidget):
    """Display image with zoom; draw shapes in image space; emit boxes for VOC compat."""

    boxes_changed = Signal(list)  # list of Box (for backward compat)
    shapes_changed = Signal(list)  # list of shape dicts

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._image_path: Optional[str] = None
        self._image_size: Tuple[int, int] = (0, 0)
        self._pixmap: Optional[QPixmap] = None
        self._shapes: List[Dict[str, Any]] = []
        self._scale = 1.0
        self._creating: Optional[Tuple[QPoint, QPoint]] = None
        self._polygon_draft: List[QPoint] = []
        self._polygon_mouse_pos: Optional[QPoint] = None  # current mouse for rubber-band line
        self._ellipse_draft: Optional[Tuple[QPoint, QPoint]] = None
        self._polygon_close_threshold = 10  # pixels in canvas; click within this of first point to close
        self._selected_index: Optional[int] = None
        self._default_class: str = ""
        self._draw_mode = DRAW_MODE_RECTANGLE
        self._class_colors: Dict[str, QColor] = {}
        self.setMinimumSize(400, 300)
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.StrongFocus)

    def set_scale(self, scale: float) -> None:
        self._scale = max(0.25, min(4.0, scale))
        self.update()

    def scale(self) -> float:
        return self._scale

    def set_draw_mode(self, mode: str) -> None:
        if mode in (DRAW_MODE_RECTANGLE, DRAW_MODE_POLYGON, DRAW_MODE_ELLIPSE, DRAW_MODE_CIRCLE):
            self._draw_mode = mode
            self._polygon_draft = []
            self._polygon_mouse_pos = None
            self._creating = None
            self._ellipse_draft = None
            self.update()

    def draw_mode(self) -> str:
        return self._draw_mode

    def load_image(self, image_path: str) -> bool:
        if not image_path or not os.path.isfile(image_path):
            return False
        try:
            pil = _PIL_Image.open(image_path)
            if pil.mode != "RGB":
                pil = pil.convert("RGB")
            w, h = pil.size
            data = pil.tobytes("raw", "RGB")
            qimg = QImage(data, w, h, QImage.Format_RGB888)
            self._pixmap = QPixmap.fromImage(qimg)
            self._image_path = image_path
            self._image_size = (w, h)
            self._shapes = []
            self._creating = None
            self._polygon_draft = []
            self._ellipse_draft = None
            self._selected_index = None
            self.update()
            return True
        except OSError:
            return False

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
        self.update()
        self.boxes_changed.emit(self.get_boxes())
        self.shapes_changed.emit(self.get_shapes())

    def get_selected_index(self) -> Optional[int]:
        if self._selected_index is not None and 0 <= self._selected_index < len(self._shapes):
            return self._selected_index
        return None

    def image_path(self) -> Optional[str]:
        return self._image_path

    def image_size(self) -> Tuple[int, int]:
        return self._image_size

    def _image_rect(self) -> QRect:
        if self._pixmap is None:
            return QRect(0, 0, 0, 0)
        w = int(self._pixmap.width() * self._scale)
        h = int(self._pixmap.height() * self._scale)
        return QRect(0, 0, w, h)

    def _to_image_point(self, p: QPoint) -> Tuple[int, int]:
        return (int(p.x() / self._scale), int(p.y() / self._scale))

    def _to_canvas_point(self, x: float, y: float) -> QPoint:
        return QPoint(int(x * self._scale), int(y * self._scale))

    def _to_canvas_rect(self, xmin: int, ymin: int, xmax: int, ymax: int) -> QRect:
        x1 = int(xmin * self._scale)
        y1 = int(ymin * self._scale)
        x2 = int(xmax * self._scale)
        y2 = int(ymax * self._scale)
        return QRect(QPoint(x1, y1), QPoint(x2, y2)).normalized()

    def _shape_contains_canvas_point(self, shape: Dict, p: QPoint) -> bool:
        pts = shape.get("points") or []
        if len(pts) < 2:
            return False
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            r = self._to_canvas_rect(int(min(x1, x2)), int(min(y1, y2)), int(max(x1, x2)), int(max(y1, y2)))
            return r.contains(p)
        if st == annotation_io.SHAPE_TYPE_POLYGON and len(pts) >= 3:
            qpts = [QPointF(self._to_canvas_point(x, y)) for x, y in pts]
            return _point_in_polygon(QPointF(p), qpts)
        if st in (annotation_io.SHAPE_TYPE_ELLIPSE, annotation_io.SHAPE_TYPE_CIRCLE) and len(pts) >= 2:
            bbox = annotation_io.shape_to_bbox(shape)
            if bbox:
                r = self._to_canvas_rect(*bbox)
                return r.contains(p)
        return False

    def _hit_shape(self, p: QPoint) -> Optional[int]:
        for i in range(len(self._shapes) - 1, -1, -1):
            if self._shape_contains_canvas_point(self._shapes[i], p):
                return i
        return None

    def paintEvent(self, event) -> None:
        painter = QPainter(self)
        painter.fillRect(self.rect(), QColor(60, 60, 60))
        if self._pixmap is None:
            return
        scaled = self._pixmap.scaled(
            int(self._pixmap.width() * self._scale),
            int(self._pixmap.height() * self._scale),
            Qt.IgnoreAspectRatio,
            Qt.SmoothTransformation,
        )
        painter.drawPixmap(0, 0, scaled)

        default_pen = QPen(QColor(0, 255, 0), 2)
        for i, shape in enumerate(self._shapes):
            if i == self._selected_index:
                painter.setPen(QPen(QColor(255, 200, 0), 3))
            else:
                label = (shape.get("label") or "").strip()
                if label and label in self._class_colors:
                    painter.setPen(QPen(self._class_colors[label], 2))
                else:
                    painter.setPen(default_pen)
            self._draw_shape(painter, shape)
            if i == self._selected_index:
                painter.setPen(default_pen)

        if self._creating is not None:
            p1, p2 = self._creating
            painter.setPen(QPen(QColor(0, 255, 255), 2))
            painter.drawRect(QRect(p1, p2).normalized())

        if self._polygon_draft:
            painter.setPen(QPen(QColor(0, 255, 255), 2))
            for j in range(len(self._polygon_draft) - 1):
                painter.drawLine(self._polygon_draft[j], self._polygon_draft[j + 1])
            if self._polygon_mouse_pos is not None:
                painter.drawLine(self._polygon_draft[-1], self._polygon_mouse_pos)
            elif len(self._polygon_draft) >= 2:
                painter.drawLine(self._polygon_draft[-1], self._polygon_draft[0])

        if self._ellipse_draft is not None:
            p1, p2 = self._ellipse_draft
            painter.setPen(QPen(QColor(0, 255, 255), 2))
            painter.drawEllipse(QRectF(p1, p2).normalized())

    def _draw_shape(self, painter: QPainter, shape: Dict) -> None:
        pts = shape.get("points") or []
        if not pts:
            return
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            r = self._to_canvas_rect(int(min(x1, x2)), int(min(y1, y2)), int(max(x1, x2)), int(max(y1, y2)))
            painter.drawRect(r)
            return
        if st == annotation_io.SHAPE_TYPE_POLYGON and len(pts) >= 2:
            qpts = [QPointF(self._to_canvas_point(x, y)) for x, y in pts]
            poly = QPolygonF(qpts)
            painter.drawPolygon(poly)
            return
        if st in (annotation_io.SHAPE_TYPE_ELLIPSE, annotation_io.SHAPE_TYPE_CIRCLE) and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            r = QRectF(
                min(x1, x2) * self._scale, min(y1, y2) * self._scale,
                abs(x2 - x1) * self._scale, abs(y2 - y1) * self._scale,
            )
            painter.drawEllipse(r)
            return
        if len(pts) >= 2:
            bbox = annotation_io.shape_to_bbox(shape)
            if bbox:
                r = self._to_canvas_rect(*bbox)
                painter.drawRect(r)

    def _point(self, event) -> QPoint:
        pos = event.position()
        return QPoint(int(pos.x()), int(pos.y()))

    def mousePressEvent(self, event) -> None:
        self.setFocus()  # Ensure focus for waterfall table updates
        pt = self._point(event)
        if event.button() == Qt.LeftButton and self._pixmap is not None:
            ir = self._image_rect()
            if not ir.contains(pt):
                return
            if self._draw_mode == DRAW_MODE_POLYGON:
                if len(self._polygon_draft) >= 2:
                    dx = pt.x() - self._polygon_draft[0].x()
                    dy = pt.y() - self._polygon_draft[0].y()
                    if dx * dx + dy * dy <= self._polygon_close_threshold * self._polygon_close_threshold:
                        self.close_polygon_draft()
                        self._polygon_mouse_pos = None
                        self._selected_index = None
                        self.update()
                        return
                self._polygon_draft.append(pt)
                self._selected_index = None
                self.update()
                return
            if self._draw_mode in (DRAW_MODE_ELLIPSE, DRAW_MODE_CIRCLE):
                self._ellipse_draft = (pt, pt)
                self._selected_index = None
                self.update()
                return
            idx = self._hit_shape(pt)
            if idx is not None:
                self._selected_index = idx
                self._creating = None
            else:
                self._creating = (pt, pt)
                self._selected_index = None
        elif event.button() == Qt.RightButton:
            self._creating = None
            self._polygon_draft = []
            self._polygon_mouse_pos = None
            self._ellipse_draft = None
            self._selected_index = None
            self.update()
        self.update()

    def mouseMoveEvent(self, event) -> None:
        pt = self._point(event)
        if self._creating is not None:
            self._creating = (self._creating[0], pt)
            self.update()
        elif self._ellipse_draft is not None:
            self._ellipse_draft = (self._ellipse_draft[0], pt)
            self.update()
        elif self._draw_mode == DRAW_MODE_POLYGON and self._polygon_draft:
            self._polygon_mouse_pos = pt
            self.update()

    def mouseReleaseEvent(self, event) -> None:
        if event.button() != Qt.LeftButton:
            return
        if self._creating is not None:
            p1, p2 = self._creating
            x1, y1 = self._to_image_point(p1)
            x2, y2 = self._to_image_point(p2)
            xmin, xmax = min(x1, x2), max(x1, x2)
            ymin, ymax = min(y1, y2), max(y1, y2)
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
            self.update()
            return
        if self._ellipse_draft is not None:
            p1, p2 = self._ellipse_draft
            x1, y1 = self._to_image_point(p1)
            x2, y2 = self._to_image_point(p2)
            if abs(x2 - x1) >= 2 and abs(y2 - y1) >= 2:
                cls = self._default_class if isinstance(self._default_class, str) else ""
                st = annotation_io.SHAPE_TYPE_CIRCLE if self._draw_mode == DRAW_MODE_CIRCLE else annotation_io.SHAPE_TYPE_ELLIPSE
                self._shapes.append({
                    "shape_type": st,
                    "label": cls,
                    "points": [[x1, y1], [x2, y2]],
                    "difficult": 0,
                })
                self._emit_updates()
            self._ellipse_draft = None
            self.update()

    def close_polygon_draft(self) -> bool:
        """Close current polygon draft and add as shape; return True if added."""
        if len(self._polygon_draft) < 3:
            return False
        pts_img = [self._to_image_point(p) for p in self._polygon_draft]
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

    def keyPressEvent(self, event) -> None:
        if event.key() in (Qt.Key_Return, Qt.Key_Enter):
            if self._polygon_draft and self.close_polygon_draft():
                self.update()
                return
        super().keyPressEvent(event)

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

    def set_class_colors(self, color_map: Dict[str, QColor]) -> None:
        """Set per-class colors for drawing shapes (label -> QColor)."""
        self._class_colors = dict(color_map) if color_map else {}
        self.update()

# -*- coding: utf-8 -*-
"""
Waterfall flow: scrollable grid of image cards for multi-image annotation.
Each card shows one image with overlaid shapes; annotations stored in a central cache.
"""

import copy
import os
from typing import Any, Callable, Dict, List, Optional

from PySide6.QtCore import Qt, QSize, Signal, QEvent
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QScrollArea,
    QFrame,
    QLabel,
    QGridLayout,
    QSizePolicy,
    QPushButton,
)

from .canvas import AnnotatorCanvas, DRAW_MODE_RECTANGLE

CARD_WIDTH = 320
CARD_HEIGHT_MIN = 120
CARD_HEIGHT_MAX = 600
BREAKPOINT_TWO_COLS = 640
CARD_MARGIN = 12
UNDO_HISTORY_MAX = 50


def _scale_to_fit(img_w: int, img_h: int, card_w: int, card_h: int) -> float:
    if img_w <= 0 or img_h <= 0:
        return 1.0
    return min(card_w / img_w, card_h / img_h, 4.0)


def _canvas_height_for_aspect(card_w: int, img_w: int, img_h: int) -> int:
    """Height so image is 100% card width and proportional."""
    if img_w <= 0 or img_h <= 0:
        return CARD_HEIGHT_MIN
    h = round(card_w * img_h / img_w)
    return max(CARD_HEIGHT_MIN, min(CARD_HEIGHT_MAX, h))


class ImageCardWidget(QFrame):
    """One image card: canvas + filename + Undo button. Resizes with layout."""

    def __init__(
        self,
        image_path: str,
        initial_shapes: List[Dict[str, Any]],
        on_shapes_changed: Callable[[str, List[Dict[str, Any]]], None],
        on_undo: Callable[[], None],
        parent: Optional[QWidget] = None,
    ):
        super().__init__(parent)
        self._image_path = image_path
        self._on_shapes_changed = on_shapes_changed
        self._on_undo = on_undo
        self._img_w, self._img_h = 0, 0
        self._aspect_ratio = 1.0
        self.setFrameStyle(QFrame.StyledPanel)
        self.setLineWidth(1)
        self.setStyleSheet(
            "QFrame#ImageCard { background-color: #ffffff; border: 1px solid #dadce0; border-radius: 6px; }"
        )
        self.setObjectName("ImageCard")
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Minimum)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        self._canvas = AnnotatorCanvas(self)
        self._canvas.set_shapes(initial_shapes)
        self._canvas.shapes_changed.connect(self._emit_shapes)
        self._canvas.load_image(image_path)
        if self._canvas.image_size() != (0, 0):
            self._img_w, self._img_h = self._canvas.image_size()
            self._aspect_ratio = self._img_h / self._img_w if self._img_w else 1.0
            ch = _canvas_height_for_aspect(CARD_WIDTH, self._img_w, self._img_h)
            self._canvas.setFixedSize(CARD_WIDTH, ch)
            scale = CARD_WIDTH / self._img_w
            self._canvas.set_scale(min(4.0, max(0.25, scale)))
        else:
            self._canvas.setFixedSize(CARD_WIDTH, CARD_HEIGHT_MIN)
        layout.addWidget(self._canvas, 1)
        self._label = QLabel(os.path.basename(image_path))
        self._label.setAlignment(Qt.AlignCenter)
        self._label.setStyleSheet("font-size: 11px; color: #5f6368; font-weight: 500; padding: 2px 0;")
        layout.addWidget(self._label)
        undo_btn = QPushButton("Undo (撤销)")
        undo_btn.setToolTip("Undo last annotation on this image")
        undo_btn.clicked.connect(self._on_undo)
        layout.addWidget(undo_btn)

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        if self._img_w <= 0:
            return
        w = self.width() - CARD_MARGIN
        if w <= 0:
            return
        canvas_h = max(CARD_HEIGHT_MIN, min(CARD_HEIGHT_MAX, round(w * self._aspect_ratio)))
        self._canvas.setFixedSize(w, canvas_h)
        scale = w / self._img_w
        self._canvas.set_scale(min(4.0, max(0.25, scale)))
        self.setMinimumHeight(canvas_h + self._label.sizeHint().height() + 12)

    def _emit_shapes(self) -> None:
        self._on_shapes_changed(self._image_path, self._canvas.get_shapes())

    def image_path(self) -> str:
        return self._image_path

    def canvas(self) -> AnnotatorCanvas:
        return self._canvas

    def current_canvas_width(self) -> int:
        return self._canvas.width() if self._canvas else 0


class _FlowContainerWidget(QWidget):
    """Container that notifies on resize so grid can switch 1/2 columns and card width (50% when 2 cols)."""

    def __init__(self, on_resized: Callable[[int], None], parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._on_resized = on_resized

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self._on_resized(self.width())


class WaterfallFlowWidget(QWidget):
    """Scrollable grid of ImageCardWidgets. Manages annotation cache and forwards class/color/mode to all cards."""
    current_canvas_changed = Signal(object)  # AnnotatorCanvas or None
    cache_changed = Signal()  # emitted when annotation cache is updated

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._annotation_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._annotation_history: Dict[str, List[List[Dict[str, Any]]]] = {}
        self._undo_in_progress = False
        self._image_paths: List[str] = []
        self._cards: List[ImageCardWidget] = []
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self._scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOn)
        self._flow_container = _FlowContainerWidget(self._on_flow_resized)
        self._grid = QGridLayout(self._flow_container)
        self._grid.setSpacing(8)
        self._scroll.setWidget(self._flow_container)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self._scroll)

    def set_annotation_cache(self, cache: Dict[str, List[Dict[str, Any]]]) -> None:
        self._annotation_cache = cache

    def get_annotation_cache(self) -> Dict[str, List[Dict[str, Any]]]:
        return self._annotation_cache

    def _on_flow_resized(self, width: int) -> None:
        """Re-layout grid: 2 columns when width >= breakpoint (each card 50%), else 1 column."""
        if not self._cards:
            return
        ncols = 2 if width >= BREAKPOINT_TWO_COLS else 1
        for c in self._cards:
            self._grid.removeWidget(c)
        for col in range(max(1, ncols)):
            self._grid.setColumnStretch(col, 1)
        for i, card in enumerate(self._cards):
            self._grid.addWidget(card, i // ncols, i % ncols)
        self.cache_changed.emit()

    def set_images(
        self,
        image_paths: List[str],
        load_annotations_fn: Callable[[str], List[Dict[str, Any]]],
    ) -> None:
        """Build grid of cards for each image_path; load shapes from load_annotations_fn(path) into cache."""
        for c in self._cards:
            try:
                c.canvas().shapes_changed.disconnect()
            except (TypeError, RuntimeError):
                pass
            c.setParent(None)
            c.deleteLater()
        self._cards.clear()
        self._image_paths = list(image_paths)
        self._annotation_cache = {}
        self._annotation_history = {p: [] for p in self._image_paths}
        for i, path in enumerate(self._image_paths):
            shapes = load_annotations_fn(path)
            self._annotation_cache[path] = list(shapes)

            def _make_undo_callback(img_path: str) -> Callable[[], None]:
                return lambda: self._undo_for_image(img_path)

            card = ImageCardWidget(
                path,
                shapes,
                self._on_card_shapes_changed,
                _make_undo_callback(path),
            )
            card.canvas().installEventFilter(self)
            self._grid.addWidget(card, i, 0)
            self._cards.append(card)
        vw = self._scroll.viewport().width()
        self._on_flow_resized(vw if vw > 0 else BREAKPOINT_TWO_COLS)
        self.cache_changed.emit()

    def _on_card_shapes_changed(self, image_path: str, shapes: List[Dict[str, Any]]) -> None:
        if self._undo_in_progress:
            self._annotation_cache[image_path] = list(shapes)
            return
        history = self._annotation_history.get(image_path)
        if history is not None:
            old_state = copy.deepcopy(self._annotation_cache.get(image_path, []))
            history.append(old_state)
            if len(history) > UNDO_HISTORY_MAX:
                history.pop(0)
        self._annotation_cache[image_path] = list(shapes)
        self.cache_changed.emit()

    def _undo_for_image(self, image_path: str) -> bool:
        """Pop previous state from this image's history; update cache and canvas; emit cache_changed. Returns True if undo was applied."""
        history = self._annotation_history.get(image_path)
        if not history:
            return False
        self._undo_in_progress = True
        try:
            prev = history.pop()
            self._annotation_cache[image_path] = copy.deepcopy(prev)
            for c in self._cards:
                if c.image_path() == image_path:
                    c.canvas().set_shapes(prev)
                    break
            self.cache_changed.emit()
            return True
        finally:
            self._undo_in_progress = False

    def set_draw_mode(self, mode: str) -> None:
        for c in self._cards:
            c.canvas().set_draw_mode(mode)

    def set_default_class(self, class_name: str) -> None:
        for c in self._cards:
            c.canvas().set_default_class(class_name)

    def set_class_colors(self, color_map: Dict[str, QColor]) -> None:
        for c in self._cards:
            c.canvas().set_class_colors(color_map)

    def eventFilter(self, obj: QWidget, event) -> bool:
        if event.type() == QEvent.FocusIn:
            for c in self._cards:
                if c.canvas() is obj:
                    self.current_canvas_changed.emit(obj)
                    break
        return super().eventFilter(obj, event)

    def set_card_scale(self, scale: float) -> None:
        for c in self._cards:
            if c.canvas().image_size() != (0, 0):
                img_w, _ = c.canvas().image_size()
                card_w = c.current_canvas_width() or CARD_WIDTH
                base = card_w / img_w
                s = base * scale
                c.canvas().set_scale(min(4.0, max(0.25, s)))

    def get_image_path_for_canvas(self, canvas) -> Optional[str]:
        """Return image_path for the card containing this canvas, or None."""
        for c in self._cards:
            if c.canvas() is canvas:
                return c.image_path()
        return None

    def focus_card_for_image(self, image_path: str) -> None:
        """Focus the canvas of the card for the given image_path."""
        for c in self._cards:
            if c.image_path() == image_path:
                c.canvas().setFocus()
                break

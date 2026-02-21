# -*- coding: utf-8 -*-
"""
Annotation tables: global table (all images) and per-image annotation list.
Display annotations with class colors; support deletion.
"""

import os
from typing import Any, Callable, Dict, List, Optional

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QBrush
from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QPushButton,
    QLabel,
    QAbstractItemView,
    QMenu,
)

from . import annotation_io


class GlobalAnnotationTable(QWidget):
    """Table showing all annotations across all images: image, class, shape_type, bbox/polygon summary."""

    image_activated = Signal(str)  # image_path when row clicked
    annotation_deleted = Signal(str, int)  # image_path, shape_index when row deleted via context menu

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._class_colors: Dict[str, QColor] = {}
        self._annotation_cache: Dict[str, List[Dict[str, Any]]] = {}
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        title = QLabel("All Annotations (总表)")
        title.setObjectName("PanelTitle")
        layout.addWidget(title)
        self._table = QTableWidget()
        self._table.setColumnCount(5)
        self._table.setHorizontalHeaderLabels(["Image", "Class", "Type", "Position", "Color"])
        self._table.horizontalHeader().setStretchLastSection(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.itemDoubleClicked.connect(self._on_row_double_clicked)
        self._table.setContextMenuPolicy(Qt.CustomContextMenu)
        self._table.customContextMenuRequested.connect(self._on_context_menu)
        layout.addWidget(self._table)

    def set_class_colors(self, color_map: Dict[str, QColor]) -> None:
        self._class_colors = dict(color_map) if color_map else {}
        self._refresh_table()

    def set_annotation_cache(self, cache: Dict[str, List[Dict[str, Any]]]) -> None:
        self._annotation_cache = cache
        self._refresh_table()

    def _refresh_table(self) -> None:
        self._table.setRowCount(0)
        for image_path, shapes in self._annotation_cache.items():
            for shape_idx, shape in enumerate(shapes):
                row = self._table.rowCount()
                self._table.insertRow(row)
                image_name = os.path.basename(image_path)
                label = (shape.get("label") or "").strip() or "(no class)"
                shape_type = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
                pos_str = self._format_position(shape)
                self._table.setItem(row, 0, QTableWidgetItem(image_name))
                self._table.setItem(row, 1, QTableWidgetItem(label))
                self._table.setItem(row, 2, QTableWidgetItem(shape_type))
                self._table.setItem(row, 3, QTableWidgetItem(pos_str))
                color_item = QTableWidgetItem("")
                if label in self._class_colors:
                    color = self._class_colors[label]
                    color_item.setBackground(QBrush(color))
                    color_item.setToolTip(f"RGB({color.red()}, {color.green()}, {color.blue()})")
                self._table.setItem(row, 4, color_item)
                self._table.item(row, 0).setData(Qt.UserRole, (image_path, shape_idx))

    def _format_position(self, shape: Dict[str, Any]) -> str:
        pts = shape.get("points") or []
        if not pts:
            return ""
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            return f"[{int(min(x1,x2))},{int(min(y1,y2))}]-[{int(max(x1,x2))},{int(max(y1,y2))}]"
        elif st == annotation_io.SHAPE_TYPE_POLYGON:
            return f"Polygon({len(pts)} pts)"
        elif st == annotation_io.SHAPE_TYPE_ELLIPSE:
            return f"Ellipse({len(pts)} pts)"
        elif st == annotation_io.SHAPE_TYPE_CIRCLE:
            return f"Circle({len(pts)} pts)"
        return f"{len(pts)} points"

    def _on_row_double_clicked(self, item: QTableWidgetItem) -> None:
        row = item.row()
        path_item = self._table.item(row, 0)
        if path_item:
            data = path_item.data(Qt.UserRole)
            if isinstance(data, tuple) and len(data) >= 1:
                image_path = data[0]
            else:
                image_path = data
            if image_path:
                self.image_activated.emit(image_path)

    def _on_context_menu(self, pos) -> None:
        row = self._table.indexAt(pos).row()
        if row < 0:
            return
        path_item = self._table.item(row, 0)
        if not path_item:
            return
        data = path_item.data(Qt.UserRole)
        if not isinstance(data, tuple) or len(data) < 2:
            return
        image_path, shape_index = data[0], data[1]
        menu = QMenu(self)
        delete_act = menu.addAction("Delete (删除)")
        action = menu.exec(self._table.mapToGlobal(pos))
        if action == delete_act:
            self.annotation_deleted.emit(image_path, shape_index)


class ImageAnnotationList(QWidget):
    """List showing annotations for one active image; supports deletion."""

    annotation_deleted = Signal(str, int)  # image_path, shape_index
    annotation_selected = Signal(str, int)  # image_path, shape_index

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._class_colors: Dict[str, QColor] = {}
        self._current_image_path: Optional[str] = None
        self._shapes: List[Dict[str, Any]] = []
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self._title_label = QLabel("Current Image Annotations (当前图标注)")
        self._title_label.setObjectName("PanelTitle")
        layout.addWidget(self._title_label)
        self._list = QTableWidget()
        self._list.setColumnCount(5)
        self._list.setHorizontalHeaderLabels(["Index", "Class", "Type", "Position", "Color"])
        self._list.horizontalHeader().setStretchLastSection(False)
        self._list.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self._list.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self._list.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self._list.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self._list.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)
        self._list.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._list.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._list.itemDoubleClicked.connect(self._on_row_double_clicked)
        layout.addWidget(self._list)
        delete_btn = QPushButton("Delete Selected")
        delete_btn.clicked.connect(self._delete_selected)
        layout.addWidget(delete_btn)

    def set_class_colors(self, color_map: Dict[str, QColor]) -> None:
        self._class_colors = dict(color_map) if color_map else {}
        self._refresh_list()

    def set_image_annotations(self, image_path: str, shapes: List[Dict[str, Any]]) -> None:
        self._current_image_path = image_path
        self._shapes = list(shapes)
        self._title_label.setText(f"Current Image Annotations: {os.path.basename(image_path)}")
        self._refresh_list()

    def _refresh_list(self) -> None:
        self._list.setRowCount(0)
        for idx, shape in enumerate(self._shapes):
            row = self._list.rowCount()
            self._list.insertRow(row)
            label = (shape.get("label") or "").strip() or "(no class)"
            shape_type = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
            pos_str = self._format_position(shape)
            self._list.setItem(row, 0, QTableWidgetItem(str(idx)))
            self._list.setItem(row, 1, QTableWidgetItem(label))
            self._list.setItem(row, 2, QTableWidgetItem(shape_type))
            self._list.setItem(row, 3, QTableWidgetItem(pos_str))
            color_item = QTableWidgetItem("")
            if label in self._class_colors:
                color = self._class_colors[label]
                color_item.setBackground(QBrush(color))
                color_item.setToolTip(f"RGB({color.red()}, {color.green()}, {color.blue()})")
            self._list.setItem(row, 4, color_item)

    def _format_position(self, shape: Dict[str, Any]) -> str:
        pts = shape.get("points") or []
        if not pts:
            return ""
        st = shape.get("shape_type", annotation_io.SHAPE_TYPE_RECTANGLE)
        if st == annotation_io.SHAPE_TYPE_RECTANGLE and len(pts) >= 2:
            x1, y1 = pts[0][0], pts[0][1]
            x2, y2 = pts[1][0], pts[1][1]
            return f"[{int(min(x1,x2))},{int(min(y1,y2))}]-[{int(max(x1,x2))},{int(max(y1,y2))}]"
        elif st == annotation_io.SHAPE_TYPE_POLYGON:
            return f"Polygon({len(pts)} pts)"
        elif st == annotation_io.SHAPE_TYPE_ELLIPSE:
            return f"Ellipse({len(pts)} pts)"
        elif st == annotation_io.SHAPE_TYPE_CIRCLE:
            return f"Circle({len(pts)} pts)"
        return f"{len(pts)} points"

    def _on_row_double_clicked(self, item: QTableWidgetItem) -> None:
        row = item.row()
        if 0 <= row < len(self._shapes) and self._current_image_path:
            self.annotation_selected.emit(self._current_image_path, row)

    def _delete_selected(self) -> None:
        rows = sorted(set([item.row() for item in self._list.selectedItems()]), reverse=True)
        if not rows or not self._current_image_path:
            return
        for row in rows:
            if 0 <= row < len(self._shapes):
                self.annotation_deleted.emit(self._current_image_path, row)

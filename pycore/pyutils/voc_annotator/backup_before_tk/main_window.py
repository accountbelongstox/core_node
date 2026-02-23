# -*- coding: utf-8 -*-
"""
VOC Annotator main window: project/config, waterfall image grid, class list, cache.
Zoom persisted; config_path loads/saves project_name, classes, and class_colors.
"""

import os
import random
import sys
from typing import Callable, Dict, List, Optional, Tuple

if os.name == "nt":
    os.environ.setdefault("QT_QPA_PLATFORM", "windows:dpiawareness=1")

from PySide6.QtCore import Qt, QSize, QEventLoop, QTimer
from PySide6.QtGui import QAction, QIcon, QPixmap, QImage, QColor
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QToolBar,
    QPushButton,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QFileDialog,
    QMessageBox,
    QScrollArea,
    QSplitter,
    QComboBox,
    QInputDialog,
    QMenu,
    QFrame,
)

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_pyside6

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

get_third_package_pyside6()


def list_segments_from_project(project_path: str) -> List[Tuple[str, str]]:
    """List segment dirs as direct children of project_path (unified layout). Returns [(segment_id, segment_path)] newest first. No d3-check dependency."""
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


# UI theme: light, clean palette; toolbar/panels/tables/buttons styled per Qt 6 stylesheet docs
ANNOTATOR_STYLESHEET = """
QMainWindow {
    background-color: #f0f2f5;
}
QMenuBar {
    background-color: #e8eaed;
    padding: 2px 0;
    spacing: 4px;
}
QMenuBar::item {
    padding: 4px 10px;
    border-radius: 4px;
    background: transparent;
}
QMenuBar::item:selected {
    background-color: #d2d6db;
}
QMenuBar::item:pressed {
    background-color: #b8bcc4;
}
QToolBar#MainToolbar {
    background-color: #e8eaed;
    border: none;
    border-bottom: 1px solid #d0d4d8;
    padding: 6px 8px;
    spacing: 6px;
}
QToolBar QPushButton {
    min-height: 24px;
    padding: 4px 10px;
    border: 1px solid #c4c8cc;
    border-radius: 6px;
    background-color: #ffffff;
    color: #202124;
}
QToolBar QPushButton:hover {
    background-color: #f1f3f4;
    border-color: #a8acb0;
}
QToolBar QPushButton:pressed {
    background-color: #e4e6e8;
}
QToolBar QPushButton:checked {
    background-color: #1a73e8;
    color: #ffffff;
    border-color: #1a73e8;
}
QToolBar QLabel {
    color: #5f6368;
    font-weight: 500;
}
QComboBox {
    min-height: 24px;
    padding: 2px 8px;
    border: 1px solid #c4c8cc;
    border-radius: 6px;
    background-color: #ffffff;
    color: #202124;
}
QComboBox:hover {
    border-color: #a8acb0;
}
QComboBox::drop-down {
    border: none;
    padding-right: 6px;
}
QFrame#ClassPanel {
    background-color: #ffffff;
    border: 1px solid #dadce0;
    border-radius: 8px;
    padding: 10px;
    margin: 2px;
}
QFrame#ClassPanel QLabel {
    color: #5f6368;
    font-weight: 600;
    margin-bottom: 4px;
}
QListWidget {
    background-color: #ffffff;
    border: 1px solid #dadce0;
    border-radius: 6px;
    padding: 2px;
    outline: none;
}
QListWidget::item {
    padding: 6px 8px;
    border-radius: 4px;
}
QListWidget::item:selected {
    background-color: #e8f0fe;
    color: #1967d2;
}
QListWidget::item:hover {
    background-color: #f1f3f4;
}
QTableWidget {
    background-color: #ffffff;
    border: 1px solid #dadce0;
    border-radius: 6px;
    gridline-color: #e8eaed;
}
QTableWidget::item {
    padding: 4px 8px;
}
QTableWidget::item:selected {
    background-color: #e8f0fe;
    color: #1967d2;
}
QHeaderView::section {
    background-color: #e8eaed;
    color: #5f6368;
    padding: 8px 10px;
    border: none;
    border-right: 1px solid #dadce0;
    border-bottom: 1px solid #dadce0;
    font-weight: 600;
}
QHeaderView::section:first {
    border-top-left-radius: 6px;
}
QHeaderView::section:last {
    border-top-right-radius: 6px;
    border-right: none;
}
QSplitter::handle {
    background-color: #dadce0;
    width: 4px;
    height: 4px;
}
QSplitter::handle:hover {
    background-color: #1a73e8;
}
QScrollArea {
    border: none;
    background-color: #f0f2f5;
}
QStatusBar {
    background-color: #e8eaed;
    color: #5f6368;
    border-top: 1px solid #d0d4d8;
    padding: 2px 8px;
}
QLabel#PanelTitle {
    color: #3c4043;
    font-weight: 600;
    font-size: 13px;
    padding: 4px 0;
}
QWidget#GlobalTablePanel, QWidget#ImageListPanel {
    background-color: #ffffff;
    border: 1px solid #dadce0;
    border-radius: 8px;
    padding: 8px;
}
QPushButton {
    min-height: 22px;
    padding: 4px 12px;
    border: 1px solid #c4c8cc;
    border-radius: 6px;
    background-color: #ffffff;
    color: #202124;
}
QPushButton:hover {
    background-color: #f1f3f4;
    border-color: #a8acb0;
}
QPushButton:pressed {
    background-color: #e4e6e8;
}
QPushButton:disabled {
    background-color: #f1f3f4;
    color: #9aa0a6;
}
"""


def _random_rgb() -> List[int]:
    return [random.randint(60, 255), random.randint(60, 255), random.randint(60, 255)]

THUMB_MAX_HEIGHT = 72
THUMB_MAX_LIST = 800


def _thumbnail_for_image(path: str, max_height: int = THUMB_MAX_HEIGHT) -> Optional[QPixmap]:
    """Load image and return scaled pixmap for list icon; None on failure."""
    if not path or not os.path.isfile(path):
        return None
    try:
        img = QImage(path)
        if img.isNull():
            return None
        h = min(img.height(), max_height)
        if h < 1:
            h = 1
        w = int(img.width() * h / img.height()) if img.height() else h
        if w < 1:
            w = 1
        scaled = img.scaled(w, h, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        return QPixmap.fromImage(scaled)
    except OSError:
        return None


class VOCAnnotatorWindow(QMainWindow):
    def __init__(
        self,
        images_dir: Optional[str] = None,
        save_dir: Optional[str] = None,
        classes: Optional[List[str]] = None,
        project_name: Optional[str] = None,
        config_path: Optional[str] = None,
        project_path: Optional[str] = None,
        parent: Optional[QWidget] = None,
    ):
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__ start: project_path=%s, images_dir=%s" % (project_path, images_dir))
        super().__init__(parent)
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: super().__init__ done")
        self._project_path = project_path
        self._segment_list: List[Tuple[str, str]] = []  # (timestamp, segment_path)
        if project_path and os.path.isdir(project_path):
            ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: project_path is dir, resolving config and segments")
            if not config_path:
                config_path = os.path.join(project_path, "annotator_config.json")
            self._segment_list = list_segments_from_project(project_path)
            ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: list_segments_from_project returned %d segments" % len(self._segment_list))
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
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: _images_dir=%s, _config_path=%s" % (self._images_dir, self._config_path))
        self._image_list: List[str] = []
        self._current_index = -1
        self._patch_sources: List[dict] = []
        self._external_items: List[tuple] = []
        self._external_item_meta: List[tuple] = []

        self._class_colors: Dict[str, QColor] = {}
        if config_path and os.path.isfile(config_path):
            proj = project_config.load_project_config(config_path)
            self._classes = list(proj.get(project_config.CONFIG_KEY_CLASSES, []) or [])
            if not self._project_name and proj.get(project_config.CONFIG_KEY_PROJECT_NAME):
                self._project_name = proj[project_config.CONFIG_KEY_PROJECT_NAME]
            raw = proj.get(project_config.CONFIG_KEY_CLASS_COLORS) or {}
            for name, rgb in raw.items():
                if isinstance(rgb, (list, tuple)) and len(rgb) >= 3:
                    self._class_colors[str(name)] = QColor(rgb[0], rgb[1], rgb[2])
        else:
            self._classes = list(classes) if classes else []
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: loaded %d classes" % len(self._classes))
        for c in self._classes:
            if c not in self._class_colors:
                self._class_colors[c] = QColor(*_random_rgb())
        self._focused_canvas: Optional[AnnotatorCanvas] = None
        self._card_scale = 1.0

        self.setWindowTitle("VOC Annotator" + (" - " + self._project_name if self._project_name else " (pycore)"))
        self.resize(1200, 800)

        menu = self.menuBar().addMenu("&File")
        open_act = QAction("Open &Dir", self)
        open_act.setShortcut("Ctrl+O")
        open_act.triggered.connect(self._open_dir)
        menu.addAction(open_act)
        save_dir_act = QAction("Change save &dir", self)
        save_dir_act.triggered.connect(self._change_save_dir)
        menu.addAction(save_dir_act)
        save_act_menu = QAction("&Save", self)
        save_act_menu.setShortcut("Ctrl+S")
        save_act_menu.triggered.connect(self._save_current)
        menu.addAction(save_act_menu)
        menu.addSeparator()
        load_external_act = QAction("Load patch images (补丁图)", self)
        load_external_act.triggered.connect(self._load_external_dir)
        menu.addAction(load_external_act)
        gen_dataset_act = QAction("Generate YOLO dataset", self)
        gen_dataset_act.triggered.connect(self._generate_yolo_dataset)
        menu.addAction(gen_dataset_act)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)

        toolbar = QToolBar()
        toolbar.setObjectName("MainToolbar")
        self.addToolBar(toolbar)

        zoom_out_btn = QPushButton("Zoom -")
        zoom_out_btn.setToolTip("Zoom out (Ctrl+-)")
        zoom_out_btn.clicked.connect(self._zoom_out)
        toolbar.addWidget(zoom_out_btn)

        self._zoom_label = QLabel("100%")
        self._zoom_label.setMinimumWidth(52)
        toolbar.addWidget(self._zoom_label)

        zoom_in_btn = QPushButton("Zoom +")
        zoom_in_btn.setToolTip("Zoom in (Ctrl++)")
        zoom_in_btn.clicked.connect(self._zoom_in)
        toolbar.addWidget(zoom_in_btn)

        toolbar.addSeparator()
        toolbar.addWidget(QLabel(" Shape:"))
        rect_btn = QPushButton("Rect")
        rect_btn.setCheckable(True)
        rect_btn.setChecked(True)
        rect_btn.clicked.connect(lambda: self._set_shape_mode(DRAW_MODE_RECTANGLE))
        toolbar.addWidget(rect_btn)
        poly_btn = QPushButton("Polygon")
        poly_btn.setCheckable(True)
        poly_btn.clicked.connect(lambda: self._set_shape_mode(DRAW_MODE_POLYGON))
        toolbar.addWidget(poly_btn)
        ellipse_btn = QPushButton("Ellipse")
        ellipse_btn.setCheckable(True)
        ellipse_btn.clicked.connect(lambda: self._set_shape_mode(DRAW_MODE_ELLIPSE))
        toolbar.addWidget(ellipse_btn)
        circle_btn = QPushButton("Circle")
        circle_btn.setCheckable(True)
        circle_btn.clicked.connect(lambda: self._set_shape_mode(DRAW_MODE_CIRCLE))
        toolbar.addWidget(circle_btn)
        self._shape_buttons = [rect_btn, poly_btn, ellipse_btn, circle_btn]

        toolbar.addSeparator()
        save_act = QAction("Save", self)
        save_act.setShortcut("Ctrl+S")
        save_act.triggered.connect(self._save_current)
        toolbar.addAction(save_act)

        self._segment_combo: Optional[QComboBox] = None
        if self._segment_list:
            toolbar.addSeparator()
            toolbar.addWidget(QLabel(" Segment:"))
            self._segment_combo = QComboBox()
            self._segment_combo.setMinimumWidth(160)
            for ts, seg_path in self._segment_list:
                self._segment_combo.addItem(ts, seg_path)
            self._segment_combo.currentIndexChanged.connect(self._on_segment_changed)
            toolbar.addWidget(self._segment_combo)
            self._segment_combo.blockSignals(True)
            for i, (_, seg_path) in enumerate(self._segment_list):
                if os.path.normpath(self._images_dir) == os.path.normpath(os.path.join(seg_path, "frames")):
                    self._segment_combo.setCurrentIndex(i)
                    break
            else:
                self._segment_combo.setCurrentIndex(0)
            self._segment_combo.blockSignals(False)

        delete_btn = QPushButton("Delete selected box")
        delete_btn.clicked.connect(self._delete_selected)
        toolbar.addWidget(delete_btn)

        layout.addWidget(toolbar)

        main_splitter = QSplitter(Qt.Horizontal)

        self._global_table = GlobalAnnotationTable()
        self._global_table.setObjectName("GlobalTablePanel")
        self._global_table.setMaximumWidth(380)
        self._global_table.image_activated.connect(self._on_global_table_image_activated)
        self._global_table.annotation_deleted.connect(self._on_image_annotation_deleted)
        self._global_table.set_class_colors(self._class_colors)
        main_splitter.addWidget(self._global_table)

        center_splitter = QSplitter(Qt.Vertical)
        self._waterfall = WaterfallFlowWidget()
        self._waterfall.current_canvas_changed.connect(self._on_waterfall_canvas_focused)
        self._waterfall.cache_changed.connect(self._on_annotation_cache_changed)
        center_splitter.addWidget(self._waterfall)

        self._image_annotation_list = ImageAnnotationList()
        self._image_annotation_list.setObjectName("ImageListPanel")
        self._image_annotation_list.annotation_deleted.connect(self._on_image_annotation_deleted)
        self._image_annotation_list.annotation_selected.connect(self._on_image_annotation_selected)
        self._image_annotation_list.set_class_colors(self._class_colors)
        center_splitter.addWidget(self._image_annotation_list)
        center_splitter.setSizes([600, 200])
        main_splitter.addWidget(center_splitter)

        class_panel = QFrame()
        class_panel.setObjectName("ClassPanel")
        class_panel.setMaximumWidth(240)
        class_layout = QVBoxLayout(class_panel)
        self._info_frame = QFrame()
        self._info_frame.setObjectName("InfoArea")
        self._info_frame.setStyleSheet("QFrame#InfoArea { background-color: #e8eaed; border-radius: 6px; padding: 6px; margin-bottom: 6px; }")
        info_layout = QVBoxLayout(self._info_frame)
        info_layout.setContentsMargins(8, 6, 8, 6)
        self._info_current_label = QLabel("Current (for labeling): —")
        self._info_current_label.setStyleSheet("font-weight: 600; color: #3c4043; font-size: 12px;")
        info_layout.addWidget(self._info_current_label)
        self._info_color_swatch = QLabel()
        self._info_color_swatch.setFixedHeight(20)
        self._info_color_swatch.setStyleSheet("background-color: #9aa0a6; border-radius: 4px; border: 1px solid #dadce0;")
        self._info_color_swatch.setToolTip("Annotation color for current class")
        info_layout.addWidget(self._info_color_swatch)
        class_layout.addWidget(self._info_frame)
        class_layout.addWidget(QLabel("Classes (click to label):"))
        self._class_list = QListWidget()
        self._class_list.setMaximumWidth(180)
        self._class_list.setEditTriggers(QListWidget.DoubleClicked | QListWidget.SelectedClicked)
        for c in self._classes:
            item = QListWidgetItem(c)
            item.setFlags(item.flags() | Qt.ItemIsEditable)
            self._class_list.addItem(item)
        self._class_list.itemClicked.connect(self._on_class_clicked)
        self._class_list.itemChanged.connect(self._on_class_name_changed)
        class_layout.addWidget(self._class_list)
        add_class_btn = QPushButton("+")
        add_class_btn.setMaximumWidth(30)
        add_class_btn.setToolTip("Add new class")
        add_class_btn.clicked.connect(self._add_class_inline)
        class_layout.addWidget(add_class_btn)
        class_layout.addWidget(QLabel("Patch (补丁图):"))
        self._external_list = QListWidget()
        self._external_list.setMaximumWidth(180)
        self._external_list.setMaximumHeight(120)
        self._external_list.itemDoubleClicked.connect(self._on_external_item_double_clicked)
        self._external_list.setContextMenuPolicy(Qt.CustomContextMenu)
        self._external_list.customContextMenuRequested.connect(self._on_external_context_menu)
        class_layout.addWidget(self._external_list)
        load_external_btn = QPushButton("Load external dir")
        load_external_btn.clicked.connect(self._load_external_dir)
        class_layout.addWidget(load_external_btn)
        merge_external_btn = QPushButton("Merge selected to class")
        merge_external_btn.clicked.connect(self._merge_external_to_class)
        class_layout.addWidget(merge_external_btn)
        class_layout.addStretch()
        main_splitter.addWidget(class_panel)

        main_splitter.setSizes([300, 700, 200])
        layout.addWidget(main_splitter)

        self.setStyleSheet(ANNOTATOR_STYLESHEET)

        self._status_label = QLabel("")
        self.statusBar().addWidget(self._status_label)

        def _class_colors_rgb() -> Dict[str, List[int]]:
            return {k: [c.red(), c.green(), c.blue()] for k, c in self._class_colors.items()}

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
                self._class_colors[name] = QColor(*_random_rgb())
                _save_config()

        self._class_colors_rgb = _class_colors_rgb
        self._save_config = _save_config
        self._ensure_class_color = _ensure_class_color

        self._card_scale = config.get_zoom_percent() / 100.0
        self._update_zoom_label()

        if self._classes:
            self._class_list.setCurrentRow(0)
            self._waterfall.set_default_class(self._classes[0])
        self._update_class_info_area()

        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: UI built, loading images or opening dir")
        if self._images_dir and os.path.isdir(self._images_dir):
            self._load_image_list()
            ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: _load_image_list done")
        else:
            ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: no _images_dir, calling _open_dir (may show dialog)")
            self._open_dir()
            ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: _open_dir returned")

        self._reload_patch_sources()
        self._refresh_external_list()
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.__init__: finished")

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
        self._external_list.clear()
        for idx, (path, class_name) in enumerate(self._external_items):
            display_name = os.path.basename(path) if os.path.dirname(path) else path
            item = QListWidgetItem("%s  →  %s" % (display_name, class_name))
            item.setData(Qt.UserRole, (path, class_name, idx))
            thumb = _thumbnail_for_image(path, 48)
            if thumb is not None:
                item.setIcon(QIcon(thumb))
            self._external_list.addItem(item)

    def _load_external_dir(self) -> None:
        d = QFileDialog.getExistingDirectory(
            self, "Select directory of patch images (补丁图)", os.path.expanduser("~")
        )
        if not d:
            return
        items = patch_data.load_patch_dir(d)
        if not items:
            self._status_label.setText("No images in directory")
            return
        patch_data.add_patch_source(self._config_path, d, items)
        self._reload_patch_sources()
        self._refresh_external_list()
        self._status_label.setText("Patch source +%d from %s (total %d)" % (len(items), os.path.basename(d), len(self._external_items)))

    def _on_external_item_double_clicked(self, item: QListWidgetItem) -> None:
        data = item.data(Qt.UserRole)
        if not data or len(data) < 3:
            return
        path, old_class, idx = data[0], data[1], data[2]
        new_class, ok = QInputDialog.getText(self, "Edit class", "Class name for %s:" % os.path.basename(path), text=old_class)
        if not ok or not new_class.strip():
            return
        new_class = new_class.strip()
        if new_class not in self._classes:
            self._classes.append(new_class)
            self._class_list.addItem(QListWidgetItem(new_class))
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

    def _on_external_context_menu(self, pos) -> None:
        rows = [i.row() for i in self._external_list.selectedIndexes()]
        if not rows:
            return
        menu = QMenu(self)
        merge_act = QAction("Merge selected to same class", self)
        merge_act.triggered.connect(self._merge_external_to_class)
        menu.addAction(merge_act)
        remove_act = QAction("Remove selected", self)
        remove_act.triggered.connect(self._remove_external_selected)
        menu.addAction(remove_act)
        menu.exec(self._external_list.mapToGlobal(pos))

    def _remove_external_selected(self) -> None:
        rows = [i.row() for i in self._external_list.selectedIndexes()]
        to_remove = []
        for r in rows:
            if 0 <= r < len(self._external_item_meta):
                to_remove.append(self._external_item_meta[r])
        if not to_remove:
            return
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
        rows = [i.row() for i in self._external_list.selectedIndexes()]
        if not rows:
            QMessageBox.information(self, "Merge", "Select one or more external images first.")
            return
        class_name, ok = QInputDialog.getItem(
            self, "Merge to class", "Class name:", self._classes, 0, True
        )
        if not ok or not (class_name and str(class_name).strip()):
            return
        class_name = str(class_name).strip()
        if class_name not in self._classes:
            self._classes.append(class_name)
            self._class_list.addItem(QListWidgetItem(class_name))
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
        self._status_label.setText("Merged %d image(s) to class %s" % (len(rows), class_name))

    def _generate_yolo_dataset(self) -> None:
        if not self._images_dir or not os.path.isdir(self._images_dir):
            QMessageBox.warning(self, "Generate", "Open an images directory first.")
            return
        if not self._classes:
            QMessageBox.warning(self, "Generate", "Add at least one class.")
            return
        self._save_current()
        out_dir = QFileDialog.getExistingDirectory(
            self, "Output directory for YOLO dataset", self._save_dir or self._images_dir
        )
        if not out_dir:
            return
        num_syn, ok = QInputDialog.getInt(
            self, "Synthetic images", "Number of paste images (0 = only annotated):", 50, 0, 1000, 10
        )
        if not ok:
            return
        images_out = os.path.join(out_dir, yolo_data_layout.IMAGES_SUBDIR)
        labels_out = os.path.join(out_dir, yolo_data_layout.LABELS_SUBDIR)
        os.makedirs(images_out, exist_ok=True)
        os.makedirs(labels_out, exist_ok=True)
        exts = (".jpg", ".jpeg", ".png", ".bmp")
        count_annot = 0
        import shutil
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
                        bg_paths,
                        patch_items,
                        self._classes,
                        images_out,
                        labels_out,
                        num_images=num_syn,
                        patches_per_image=(2, 8),
                    )
        yolo_data_layout.write_data_yaml(out_dir, self._classes, train_subdir=yolo_data_layout.IMAGES_SUBDIR)
        msg = "Generated: %d annotated images" % count_annot
        if count_syn > 0:
            msg += ", %d synthetic (paste)" % count_syn
        msg += ". data.yaml written."
        self._status_label.setText(msg)
        QMessageBox.information(self, "Generate", msg)

    def _set_shape_mode(self, mode: str) -> None:
        self._waterfall.set_draw_mode(mode)
        modes = [DRAW_MODE_RECTANGLE, DRAW_MODE_POLYGON, DRAW_MODE_ELLIPSE, DRAW_MODE_CIRCLE]
        idx = modes.index(mode) if mode in modes else 0
        for i, btn in enumerate(self._shape_buttons):
            btn.setChecked(i == idx)
        if mode == DRAW_MODE_POLYGON:
            self._status_label.setText("Polygon: click points, then Enter to close")

    def _update_class_info_area(self) -> None:
        """Refresh info area: current labeling class and its color."""
        item = self._class_list.currentItem()
        if item:
            name = item.text().strip()
            self._info_current_label.setText("Current (for labeling): %s" % (name or "—"))
            if name and name in self._class_colors:
                c = self._class_colors[name]
                hex_color = "#%02x%02x%02x" % (c.red(), c.green(), c.blue())
                self._info_color_swatch.setStyleSheet(
                    "background-color: %s; border-radius: 4px; border: 1px solid #dadce0;" % hex_color
                )
                self._info_color_swatch.setToolTip("Annotation color: RGB(%d, %d, %d)" % (c.red(), c.green(), c.blue()))
            else:
                self._info_color_swatch.setStyleSheet("background-color: #9aa0a6; border-radius: 4px; border: 1px solid #dadce0;")
                self._info_color_swatch.setToolTip("Annotation color for current class")
        else:
            self._info_current_label.setText("Current (for labeling): —")
            self._info_color_swatch.setStyleSheet("background-color: #9aa0a6; border-radius: 4px; border: 1px solid #dadce0;")
            self._info_color_swatch.setToolTip("Select a class from the list")

    def _on_class_clicked(self, item: QListWidgetItem) -> None:
        name = item.text().strip()
        if name:
            self._waterfall.set_default_class(name)
            self._status_label.setText("Current class: %s" % name)
            self._update_class_info_area()

    def _on_class_name_changed(self, item: QListWidgetItem) -> None:
        """Handle class name edit: update _classes list at same index, save config."""
        row = self._class_list.row(item)
        if row < 0 or row >= len(self._classes):
            return
        new_name = item.text().strip()
        if not new_name:
            item.setText(self._classes[row])
            return
        old_name = self._classes[row]
        if new_name == old_name:
            return
        if new_name in self._classes and self._classes.index(new_name) != row:
            item.setText(old_name)
            self._status_label.setText("Class name already exists")
            return
        self._classes[row] = new_name
        if old_name in self._class_colors:
            self._class_colors[new_name] = self._class_colors.pop(old_name)
        self._save_config()
        self._waterfall.set_class_colors(self._class_colors)
        self._global_table.set_class_colors(self._class_colors)
        self._image_annotation_list.set_class_colors(self._class_colors)
        self._update_class_info_area()
        self._status_label.setText("Class renamed: %s → %s (ID: %d)" % (old_name, new_name, row))

    def _add_class_inline(self) -> None:
        """Add new class with auto-generated name (class0, class1, ...), no dialog."""
        base = "class"
        idx = 0
        while f"{base}{idx}" in self._classes:
            idx += 1
        name = f"{base}{idx}"
        self._classes.append(name)
        item = QListWidgetItem(name)
        item.setFlags(item.flags() | Qt.ItemIsEditable)
        self._class_list.addItem(item)
        self._ensure_class_color(name)
        self._waterfall.set_class_colors(self._class_colors)
        self._global_table.set_class_colors(self._class_colors)
        self._image_annotation_list.set_class_colors(self._class_colors)
        self._waterfall.set_default_class(name)
        self._class_list.setCurrentRow(self._class_list.count() - 1)
        self._class_list.editItem(item)
        self._update_class_info_area()
        self._status_label.setText("Added class: %s (ID: %d)" % (name, len(self._classes) - 1))

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
        """Scroll to and focus the card for this image."""
        self._waterfall.focus_card_for_image(image_path)

    def _on_image_annotation_deleted(self, image_path: str, shape_index: int) -> None:
        """Delete annotation from cache and update canvas."""
        cache = self._waterfall.get_annotation_cache()
        if image_path in cache and 0 <= shape_index < len(cache[image_path]):
            cache[image_path].pop(shape_index)
            card_canvas = None
            for c in self._waterfall._cards:
                if c.image_path() == image_path:
                    card_canvas = c.canvas()
                    card_canvas.set_shapes(cache[image_path])
                    break
            if card_canvas:
                self._focused_canvas = card_canvas
            self._update_annotation_tables()

    def _on_image_annotation_selected(self, image_path: str, shape_index: int) -> None:
        """Select annotation in canvas."""
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
        self._zoom_label.setText("%d%%" % pct)
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
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow._open_dir: opening QFileDialog.getExistingDirectory (modal)")
        sys.stdout.flush()
        d = QFileDialog.getExistingDirectory(self, "Open images directory", self._images_dir or os.path.expanduser("~"))
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow._open_dir: user chose=%s" % (d or "(cancelled)"))
        if not d:
            return
        self._images_dir = d
        config.set_last_images_dir(d)
        if not self._save_dir:
            self._save_dir = d
            config.set_last_save_dir(d)
        self._load_image_list()

    def _on_segment_changed(self, index: int) -> None:
        if not self._segment_list or index < 0 or index >= len(self._segment_list):
            return
        _, seg_path = self._segment_list[index]
        frames_dir = os.path.join(seg_path, "frames")
        if not os.path.isdir(frames_dir):
            return
        self._save_current()
        self._images_dir = frames_dir
        self._save_dir = frames_dir
        config.set_last_images_dir(frames_dir)
        config.set_last_save_dir(frames_dir)
        self._load_image_list()
        self._status_label.setText("Segment: %s" % os.path.basename(seg_path))

    def _change_save_dir(self) -> None:
        d = QFileDialog.getExistingDirectory(self, "Change save directory", self._save_dir or self._images_dir)
        if not d:
            return
        self._save_dir = d
        config.set_last_save_dir(d)
        self._status_label.setText("Save dir: %s" % d)

    def _load_annotations_for_path(self, path: str):
        size = voc_io.image_size_from_file(path)
        return annotation_io.load_annotations(path, self._save_dir, size)

    def _load_image_list(self) -> None:
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow._load_image_list: _images_dir=%s" % self._images_dir)
        self._image_list = []
        exts = (".jpg", ".jpeg", ".png", ".bmp")
        try:
            for f in sorted(os.listdir(self._images_dir)):
                if f.lower().endswith(exts):
                    self._image_list.append(os.path.join(self._images_dir, f))
        except OSError as e:
            ColorPrint.blue("[DEBUG] VOCAnnotatorWindow._load_image_list: OSError listing dir: %s" % e)
            pass
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow._load_image_list: found %d images" % len(self._image_list))
        if len(self._image_list) > THUMB_MAX_LIST:
            self._status_label.setText("%d images (showing first %d)" % (len(self._image_list), THUMB_MAX_LIST))
        else:
            self._status_label.setText("%d images" % len(self._image_list))
        if self._image_list:
            self._waterfall.set_images(self._image_list, self._load_annotations_for_path)
            self._waterfall.set_card_scale(self._card_scale)
            self._waterfall.set_class_colors(self._class_colors)
            self._global_table.set_class_colors(self._class_colors)
            self._image_annotation_list.set_class_colors(self._class_colors)
            self._waterfall.set_draw_mode(DRAW_MODE_RECTANGLE)
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
        self._status_label.setText("Saved %d image(s)" % saved)

    def _delete_selected(self) -> None:
        if self._focused_canvas and self._focused_canvas.delete_selected():
            self._status_label.setText("Deleted selected box")

    def keyPressEvent(self, event) -> None:
        super().keyPressEvent(event)

    def closeEvent(self, event) -> None:
        ColorPrint.blue("[DEBUG] VOCAnnotatorWindow.closeEvent: saving and accepting close")
        self._save_current()
        config.set_zoom_percent(int(round(self._card_scale * 100)))
        event.accept()


def run_voc_annotator(
    images_dir: Optional[str] = None,
    save_dir: Optional[str] = None,
    classes: Optional[List[str]] = None,
    project_name: Optional[str] = None,
    config_path: Optional[str] = None,
    project_path: Optional[str] = None,
    event_pump_schedule: Optional[Callable[[Callable[[], None], int], None]] = None,
) -> None:
    """Open VOC Annotator window. When event_pump_schedule(callback, delay_ms) is provided (e.g. Tk after), Qt is driven by the host loop pumping processEvents(); does not block. Otherwise blocks until closed."""
    def _log(msg: str) -> None:
        ColorPrint.blue("[DEBUG] " + msg)
        sys.stdout.flush()
        sys.stderr.flush()

    _log("run_voc_annotator entry: project_path=%s, images_dir=%s, save_dir=%s" % (project_path, images_dir, save_dir))
    created_app = False
    app = QApplication.instance()
    if app is None:
        _log("run_voc_annotator: no QApplication.instance(), creating QApplication([])")
        app = QApplication([])
        created_app = True
    else:
        _log("run_voc_annotator: using existing QApplication.instance()")
    app.setQuitOnLastWindowClosed(False)
    _log("run_voc_annotator: setQuitOnLastWindowClosed(False), creating VOCAnnotatorWindow")
    try:
        win = VOCAnnotatorWindow(
            images_dir=images_dir,
            save_dir=save_dir,
            classes=classes,
            project_name=project_name,
            config_path=config_path,
            project_path=project_path,
        )
    except Exception as e:
        _log("run_voc_annotator: VOCAnnotatorWindow() raised: %s" % type(e).__name__ + ": " + str(e))
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        raise
    _log("run_voc_annotator: VOCAnnotatorWindow created, setting WA_DeleteOnClose and event loop")
    win.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)
    loop = QEventLoop()
    win.destroyed.connect(lambda: _log("run_voc_annotator: window destroyed, event loop will exit"))
    win.destroyed.connect(loop.quit)

    def _do_show_immediate():
        _log("run_voc_annotator: (immediate) setting geometry and showing (showNormal)")
        app.processEvents()
        win.setGeometry(100, 100, 1200, 800)
        win.showNormal()
        _log("run_voc_annotator: win.showNormal() returned")
        app.processEvents()
        win.setWindowState(Qt.WindowState.WindowActive)
        win.raise_()
        win.activateWindow()
        app.processEvents()
        _log("run_voc_annotator: (immediate) raise/activate done")

    # Tk (or other host) drives Qt: show once then pump processEvents via schedule; no block.
    if event_pump_schedule is not None:
        _do_show_immediate()
        def pump_once():
            try:
                app.processEvents()
                if win.isVisible():
                    event_pump_schedule(pump_once, 50)
            except Exception:
                pass
        event_pump_schedule(pump_once, 50)
        _log("run_voc_annotator: event_pump_schedule started, returning (non-blocking)")
        return

    # Standalone: show before event loop. Deferring to QTimer can cause showNormal() to block on Windows.
    if created_app:
        _do_show_immediate()
        _log("run_voc_annotator: entering loop.exec() (block until window closed)")
        loop.exec()
    else:
        def _do_show():
            try:
                _do_show_immediate()
            except Exception as e:
                _log("run_voc_annotator: win.showNormal() raised %s: %s" % (type(e).__name__, e))
                import traceback
                traceback.print_exc()
                sys.stderr.flush()
                loop.quit()
                return
        _log("run_voc_annotator: scheduling show() on first Qt event loop tick (avoids Tk/Qt focus issues)")
        QTimer.singleShot(0, _do_show)
        _log("run_voc_annotator: entering loop.exec() (block until window closed)")
        loop.exec()
    _log("run_voc_annotator: loop.exec() returned, exiting")

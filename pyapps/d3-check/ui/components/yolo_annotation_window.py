# -*- coding: utf-8 -*-
"""
YOLO Training Data Collection Window
Screenshot + multi-class bbox annotation (rect/circle), session dir, class colors, config sync.
"""

import json
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, List, Dict, Callable, Tuple, Any
from pathlib import Path
from datetime import datetime
import copy
import re

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageTk

Image = get_third_package_PIL_Image()
ImageTk = get_third_package_PIL_ImageTk()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from providor.i18n_manager import i18n_manager
from ..unified_styles import UnifiedStyles
from ..widgets import ThemedCombobox
from ..utils.app_root import get_app_root
from d3utils.yolo_dataset_from_annotations import generate_dataset_from_screenshot_history
from providor.constants.common import YOLO_DATASET_BASE_DIR, get_yolo_collect_class_color
from providor.providor_index import get_config_value_safe, set_config_value_async

try:
    from pycore.pyutils.voc_annotator.yolo_data_layout import (
        get_yolo_generated_root,
        get_yolo_generated_dataset_path,
    )
except ImportError:
    get_yolo_generated_root = None
    get_yolo_generated_dataset_path = None

CONFIG_KEY_YOLO_COLLECT = "yolo_collect"
CONFIG_FILENAME = "yolo_collect_config.json"
SUBDATASET_SNAPSHOT_FILENAME = "current_subdataset.json"
POLYGON_CLOSE_THRESHOLD = 15


class YoloAnnotationWindow:
    """
    Window for YOLO training data collection: session dir, class list (click-to-edit, per-class color),
    screenshot history, annotations with image index column, generate dataset into session dir.
    """

    def __init__(
        self,
        initial_screenshot,
        client_mode: str,
        on_capture: Callable[[], tuple],
        parent=None,
    ):
        self.client_mode = client_mode
        self.on_capture = on_capture
        self.parent = parent
        self.class_names: List[str] = []
        self.class_colors: List[str] = []
        self.screenshot_history: List[Dict] = []
        self.current_index = -1
        self.current_pick_type = "rect"
        self.temp_points: List[tuple] = []
        self.canvas_marks: List[int] = []
        self.scale_factor = 1.0
        self.canvas_offset_x = 0
        self.canvas_offset_y = 0
        self.display_screenshot = None
        self.photo_image = None
        self._class_row_frames: List[tk.Frame] = []
        self._class_name_labels: List[tk.Label] = []
        self._class_color_labels: List[tk.Label] = []
        self._edit_entry: Optional[tk.Entry] = None
        self._edit_index: Optional[int] = None
        self._selected_class_index = 0
        self._preview_line_id = None
        self._freehand_drawing = False
        self._undo_stack: List[Tuple[str, int, Any]] = []
        self.zoom_factor = 1.0

        self.session_dir = self._resolve_session_dir()
        self._load_class_config()
        if not self.class_names:
            default_name = i18n_manager.get_ui_text("ui.yolo_collect.class_default")
            self.class_names = [default_name]
            self.class_colors = [get_yolo_collect_class_color(0)]
            self._sync_class_config()

        if initial_screenshot is not None:
            self._append_screenshot(initial_screenshot)
            self.current_index = 0

        root = parent or get_app_root()
        self.window = tk.Toplevel(root) if root else tk.Tk()
        self.window.title(i18n_manager.get_ui_text("ui.yolo_collect.window_title"))
        self._geometry_save_timer = None
        self._apply_saved_geometry()
        self.window.minsize(520, 420)
        self.window.resizable(True, True)
        self.window.bind("<Configure>", self._on_window_configure)

        self._create_ui()
        self._show_current_screenshot()

    def _apply_saved_geometry(self) -> None:
        saved = get_config_value_safe(CONFIG_KEY_YOLO_COLLECT, None)
        if isinstance(saved, dict):
            w = saved.get("window_width")
            h = saved.get("window_height")
            if isinstance(w, (int, float)) and isinstance(h, (int, float)):
                w, h = int(w), int(h)
                if 400 <= w <= 4000 and 300 <= h <= 3000:
                    self.window.geometry(f"{w}x{h}")
                    return
        self.window.geometry("1280x750")

    def _on_window_configure(self, event) -> None:
        if event.widget != self.window:
            return
        if self.window.winfo_width() < 100 or self.window.winfo_height() < 100:
            return
        if self._geometry_save_timer:
            self.window.after_cancel(self._geometry_save_timer)
        self._geometry_save_timer = self.window.after(600, self._save_window_geometry)

    def _save_window_geometry(self) -> None:
        self._geometry_save_timer = None
        if not self.window.winfo_exists():
            return
        w = self.window.winfo_width()
        h = self.window.winfo_height()
        if w < 400 or h < 300:
            return
        saved = get_config_value_safe(CONFIG_KEY_YOLO_COLLECT, None) or {}
        if not isinstance(saved, dict):
            saved = {}
        saved = dict(saved)
        saved["window_width"] = w
        saved["window_height"] = h
        set_config_value_async(CONFIG_KEY_YOLO_COLLECT, saved)

    def _list_existing_session_dirs(self) -> List[Path]:
        if get_yolo_generated_root and get_yolo_generated_dataset_path:
            root = get_yolo_generated_root()
            ct = getattr(self, "client_mode", "d3_game") or "d3_game"
            base = Path(root) / ct
            if not base.is_dir():
                return []
            out = [p for p in base.iterdir() if p.is_dir() and p.name.startswith("yolo_dataset_")]
            out.sort(key=lambda x: x.name, reverse=True)
            return out
        if not YOLO_DATASET_BASE_DIR.is_dir():
            return []
        out = [p for p in YOLO_DATASET_BASE_DIR.iterdir() if p.is_dir() and p.name.startswith("yolo_dataset_")]
        out.sort(key=lambda x: x.name, reverse=True)
        return out

    def _resolve_session_dir(self) -> Path:
        dirs = self._list_existing_session_dirs()
        saved = get_config_value_safe(CONFIG_KEY_YOLO_COLLECT, None)
        if isinstance(saved, dict):
            sd = saved.get("session_dir")
            if sd and Path(sd).is_dir():
                p = Path(sd)
                if p not in dirs:
                    dirs.insert(0, p)
                self._session_dir_list = [str(x) for x in dirs]
                return p
        if dirs:
            self._session_dir_list = [str(x) for x in dirs]
            return dirs[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if get_yolo_generated_dataset_path:
            ct = getattr(self, "client_mode", "d3_game") or "d3_game"
            new_dir = Path(get_yolo_generated_dataset_path(ct, f"yolo_dataset_{timestamp}"))
        else:
            new_dir = YOLO_DATASET_BASE_DIR / f"yolo_dataset_{timestamp}"
        new_dir.mkdir(parents=True, exist_ok=True)
        self._session_dir_list = [str(new_dir)]
        return new_dir

    def _on_session_dir_selected(self, event=None) -> None:
        val = self.session_dir_var.get().strip()
        if not val or not Path(val).is_dir():
            return
        self.session_dir = Path(val)
        self._load_class_config()
        self._rebuild_class_list_ui()
        self._update_generate_preview()
        self._sync_class_config()

    def _on_add_session_dir(self) -> None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if get_yolo_generated_dataset_path:
            ct = getattr(self, "client_mode", "d3_game") or "d3_game"
            new_dir = Path(get_yolo_generated_dataset_path(ct, f"yolo_dataset_{timestamp}"))
        else:
            new_dir = YOLO_DATASET_BASE_DIR / f"yolo_dataset_{timestamp}"
        new_dir.mkdir(parents=True, exist_ok=True)
        if str(new_dir) not in self._session_dir_list:
            self._session_dir_list.insert(0, str(new_dir))
        if getattr(self, "session_dir_combo", None):
            self.session_dir_combo["values"] = tuple(self._session_dir_list)
        self.session_dir_var.set(str(new_dir))
        self.session_dir = new_dir
        self._load_class_config()
        self._rebuild_class_list_ui()
        self._update_generate_preview()
        self._sync_class_config()

    def _load_class_config(self) -> None:
        config_path = self.session_dir / CONFIG_FILENAME
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            classes = data.get("classes") or []
            if classes:
                self.class_names = [c.get("name", "object") for c in classes]
                self.class_colors = []
                for i, c in enumerate(classes):
                    col = c.get("color")
                    if col and isinstance(col, str):
                        self.class_colors.append(col)
                    else:
                        self.class_colors.append(get_yolo_collect_class_color(i))
                self.zoom_factor = self._clamp_zoom(float(data.get("display_zoom", 1.0)))
                return
        saved = get_config_value_safe(CONFIG_KEY_YOLO_COLLECT, None)
        if isinstance(saved, dict) and saved.get("classes"):
            classes = saved["classes"]
            self.class_names = [c.get("name", "object") for c in classes]
            self.class_colors = []
            for i, c in enumerate(classes):
                col = c.get("color")
                if col and isinstance(col, str):
                    self.class_colors.append(col)
                else:
                    self.class_colors.append(get_yolo_collect_class_color(i))
            if isinstance(saved, dict):
                self.zoom_factor = self._clamp_zoom(float(saved.get("display_zoom", 1.0)))

    def _clamp_zoom(self, value: float) -> float:
        return max(0.25, min(4.0, float(value)))

    def _sync_class_config(self) -> None:
        self.session_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "session_dir": str(self.session_dir),
            "classes": [{"name": n, "color": c} for n, c in zip(self.class_names, self.class_colors)],
            "display_zoom": getattr(self, "zoom_factor", 1.0),
            "updated": datetime.now().isoformat(),
        }
        config_path = self.session_dir / CONFIG_FILENAME
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        out = {
            "session_dir": str(self.session_dir),
            "classes": payload["classes"],
            "display_zoom": payload["display_zoom"],
        }
        prev = get_config_value_safe(CONFIG_KEY_YOLO_COLLECT, None)
        if isinstance(prev, dict):
            for k in ("window_width", "window_height"):
                if k in prev:
                    out[k] = prev[k]
        set_config_value_async(CONFIG_KEY_YOLO_COLLECT, out)

    def _sync_subdataset_snapshot(self) -> None:
        """Write current screenshot_history summary (image count + annotations per image) to session dir."""
        self.session_dir.mkdir(parents=True, exist_ok=True)
        snapshot = {
            "session_dir": str(self.session_dir),
            "image_count": len(self.screenshot_history),
            "images": [
                {"index": i, "annotation_count": len(h.get("annotations") or [])}
                for i, h in enumerate(self.screenshot_history)
            ],
            "class_names": self.class_names,
            "updated": datetime.now().isoformat(),
        }
        path = self.session_dir / SUBDATASET_SNAPSHOT_FILENAME
        with open(path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, indent=2, ensure_ascii=False)
        self._update_generate_preview()

    def _build_preview_text(self, last_result: Optional[Dict] = None) -> str:
        out_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_output_dir")
        dirs_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_dirs")
        images_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_images")
        ann_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_annotations")
        train_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_train")
        val_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_val")
        classes_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_classes")
        ratio_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_ratio")
        last_gen_label = i18n_manager.get_ui_text("ui.yolo_collect.preview_last_gen")
        no_data = i18n_manager.get_ui_text("ui.yolo_collect.preview_no_data")
        n = len(self.screenshot_history)
        total_ann = sum(len(h.get("annotations") or []) for h in self.screenshot_history)
        if n == 0 or total_ann == 0:
            lines = [no_data]
        else:
            train_ratio = 0.8
            n_train = max(1, int(n * train_ratio))
            n_val = n - n_train
            if n_val == 0 and n > 1:
                n_val, n_train = 1, n - 1
            lines = [
                f"{out_label}: {self.session_dir}",
                f"{dirs_label}: images/train, images/val, labels/train, labels/val",
                f"{images_label}: {n}  ({train_label} ~{n_train}  {val_label} ~{n_val})",
                f"{ann_label}: {total_ann}  ({ratio_label} 8:2)",
                f"{classes_label}: {len(self.class_names)}  {', '.join(self.class_names[:6])}{' ...' if len(self.class_names) > 6 else ''}",
            ]
        if last_result and not last_result.get("error"):
            tc = last_result.get("train_count", 0)
            vc = last_result.get("val_count", 0)
            lines.append(f"{last_gen_label}: {train_label} {tc}  {val_label} {vc}")
        return "\n".join(lines)

    def _update_generate_preview(self, last_result: Optional[Dict] = None) -> None:
        if not getattr(self, "preview_text", None):
            return
        txt = self._build_preview_text(last_result)
        self.preview_text.configure(state=tk.NORMAL)
        self.preview_text.delete("1.0", tk.END)
        self.preview_text.insert("1.0", txt)
        self.preview_text.configure(state=tk.DISABLED)

    def _append_screenshot(self, pil_image) -> None:
        self.screenshot_history.append({
            "image": pil_image.copy() if hasattr(pil_image, "copy") else pil_image,
            "annotations": [],
            "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S"),
        })
        self._sync_subdataset_snapshot()

    def _create_ui(self) -> None:
        self._create_top_toolbar()
        main_frame = tk.Frame(self.window, bg=UnifiedStyles.COLORS["bg_primary"])
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.grid_columnconfigure(0, weight=0, minsize=260)
        main_frame.grid_columnconfigure(1, weight=1)
        main_frame.grid_rowconfigure(0, weight=1)

        self._create_left_panel(main_frame)
        self._create_canvas(main_frame)
        self._create_bottom_info_bar()
        self._update_bottom_info()

    def _create_top_toolbar(self) -> None:
        toolbar = tk.Frame(self.window, bg=UnifiedStyles.COLORS["bg_secondary"], height=40)
        toolbar.pack(fill=tk.X, side=tk.TOP)
        toolbar.pack_propagate(False)
        spacer = tk.Frame(toolbar, bg=UnifiedStyles.COLORS["bg_secondary"])
        spacer.pack(side=tk.LEFT, fill=tk.X, expand=True)
        undo_label = i18n_manager.get_ui_text("ui.yolo_collect.toolbar_undo")
        self.toolbar_undo_btn = tk.Button(
            toolbar,
            text=f"\u21b6 {undo_label}",
            command=self._on_undo,
            bg=UnifiedStyles.COLORS["bg_tertiary"],
            fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"],
            padx=10,
            pady=4,
            relief=tk.FLAT,
            cursor="hand2",
        )
        self.toolbar_clear_btn = tk.Button(
            toolbar,
            text=i18n_manager.get_ui_text("ui.yolo_collect.toolbar_clear_overlay"),
            command=self._on_clear_current_overlay,
            bg=UnifiedStyles.COLORS["bg_tertiary"],
            fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"],
            padx=10,
            pady=4,
            relief=tk.FLAT,
            cursor="hand2",
        )
        zoom_in_label = i18n_manager.get_ui_text("ui.yolo_collect.toolbar_zoom_in")
        zoom_out_label = i18n_manager.get_ui_text("ui.yolo_collect.toolbar_zoom_out")
        zoom_in_btn = tk.Button(
            toolbar, text=f"+ {zoom_in_label}",
            command=self._on_zoom_in,
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=4, relief=tk.FLAT, cursor="hand2",
        )
        zoom_out_btn = tk.Button(
            toolbar, text=f"\u2212 {zoom_out_label}",
            command=self._on_zoom_out,
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=4, relief=tk.FLAT, cursor="hand2",
        )
        zoom_out_btn.pack(side=tk.RIGHT, padx=4, pady=6)
        zoom_in_btn.pack(side=tk.RIGHT, padx=(4, 4), pady=6)
        self.toolbar_clear_btn.pack(side=tk.RIGHT, padx=4, pady=6)
        self.toolbar_undo_btn.pack(side=tk.RIGHT, padx=(4, 8), pady=6)
        self._update_toolbar_buttons()

    def _update_toolbar_buttons(self) -> None:
        if getattr(self, "toolbar_undo_btn", None):
            self.toolbar_undo_btn.configure(state=tk.NORMAL if self._undo_stack else tk.DISABLED)
        if getattr(self, "toolbar_clear_btn", None):
            has_ann = (
                self.current_index >= 0
                and self.current_index < len(self.screenshot_history)
                and len(self.screenshot_history[self.current_index].get("annotations") or []) > 0
            )
            self.toolbar_clear_btn.configure(state=tk.NORMAL if has_ann else tk.DISABLED)

    def _push_undo_add(self, img_index: int, ann_index: int) -> None:
        self._undo_stack.append(("add", img_index, ann_index))
        self._update_toolbar_buttons()

    def _push_undo_clear_all(self, img_index: int, saved_annotations: list) -> None:
        self._undo_stack.append(("clear_all", img_index, copy.deepcopy(saved_annotations)))
        self._update_toolbar_buttons()

    def _on_undo(self) -> None:
        if not self._undo_stack:
            return
        op = self._undo_stack.pop()
        self._update_toolbar_buttons()
        op_type, img_index, payload = op
        if img_index < 0 or img_index >= len(self.screenshot_history):
            return
        rec = self.screenshot_history[img_index]
        anns = rec.get("annotations") or []
        if op_type == "add":
            ann_idx = payload
            if 0 <= ann_idx < len(anns):
                anns.pop(ann_idx)
        elif op_type == "clear_all":
            rec["annotations"] = payload
        self._update_ann_tree()
        if img_index == self.current_index:
            self._redraw_canvas()
        self._sync_subdataset_snapshot()

    def _on_clear_current_overlay(self) -> None:
        if self.current_index < 0 or self.current_index >= len(self.screenshot_history):
            return
        rec = self.screenshot_history[self.current_index]
        anns = rec.get("annotations") or []
        if not anns:
            return
        self._push_undo_clear_all(self.current_index, anns)
        rec["annotations"] = []
        self._update_ann_tree()
        self._redraw_canvas()
        self._sync_subdataset_snapshot()

    def _on_zoom_in(self) -> None:
        self.zoom_factor = self._clamp_zoom(self.zoom_factor * 1.25)
        self._apply_zoom_and_save()

    def _on_zoom_out(self) -> None:
        self.zoom_factor = self._clamp_zoom(self.zoom_factor / 1.25)
        self._apply_zoom_and_save()

    def _apply_zoom_and_save(self) -> None:
        if self.current_index >= 0 and self.current_index < len(self.screenshot_history):
            rec = self.screenshot_history[self.current_index]
            img = rec.get("image")
            if img is not None:
                self._display_image(img)
                self._redraw_canvas()
        self._update_bottom_info()
        self._sync_class_config()

    def _create_bottom_info_bar(self) -> None:
        size_label = i18n_manager.get_ui_text("ui.yolo_collect.info_size")
        zoom_label = i18n_manager.get_ui_text("ui.yolo_collect.info_zoom")
        current_obj_label = i18n_manager.get_ui_text("ui.yolo_collect.info_current_object")
        self.bottom_info_var = tk.StringVar(value=f"{size_label}: —x—  {zoom_label}: —%  {current_obj_label}: —")
        self.bottom_hint_var = tk.StringVar(value="")
        bar = tk.Frame(self.window, bg=UnifiedStyles.COLORS["bg_secondary"], height=50)
        bar.pack(side=tk.BOTTOM, fill=tk.X)
        bar.pack_propagate(False)
        tk.Label(
            bar, textvariable=self.bottom_info_var,
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["small"], anchor=tk.W
        ).pack(side=tk.TOP, anchor=tk.W, padx=10, pady=(4, 0))
        tk.Label(
            bar, textvariable=self.bottom_hint_var,
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS.get("text_muted", UnifiedStyles.COLORS["text_primary"]),
            font=UnifiedStyles.FONTS["small"], anchor=tk.W
        ).pack(side=tk.TOP, anchor=tk.W, padx=10, pady=(0, 4))

    def _update_bottom_info(self, iw: Optional[int] = None, ih: Optional[int] = None) -> None:
        if not getattr(self, "bottom_info_var", None):
            return
        size_label = i18n_manager.get_ui_text("ui.yolo_collect.info_size")
        zoom_label = i18n_manager.get_ui_text("ui.yolo_collect.info_zoom")
        current_obj_label = i18n_manager.get_ui_text("ui.yolo_collect.info_current_object")
        if iw is not None and ih is not None:
            size_str = f"{size_label}: {iw}×{ih}"
        else:
            if self.current_index >= 0 and self.current_index < len(self.screenshot_history):
                img = self.screenshot_history[self.current_index].get("image")
                if img is not None:
                    iw, ih = img.size
                    size_str = f"{size_label}: {iw}×{ih}"
                else:
                    size_str = f"{size_label}: —×—"
            else:
                size_str = f"{size_label}: —×—"
        zoom_pct = int(round(self.zoom_factor * 100))
        cid = self._get_current_class_id()
        current_name = self.class_names[cid] if self.class_names and 0 <= cid < len(self.class_names) else "—"
        self.bottom_info_var.set(f"{size_str}  {zoom_label}: {zoom_pct}%  {current_obj_label}: {current_name}")
        self._update_bottom_hint()

    def _get_shape_hint_text(self) -> str:
        key = f"ui.yolo_collect.hint_{self.current_pick_type}"
        return i18n_manager.get_ui_text(key)

    def _update_bottom_hint(self) -> None:
        if not getattr(self, "bottom_hint_var", None):
            return
        self.bottom_hint_var.set(self._get_shape_hint_text())

    def _create_left_panel(self, parent: tk.Frame) -> None:
        left = tk.Frame(parent, bg=UnifiedStyles.COLORS["bg_secondary"], width=260)
        left.grid(row=0, column=0, sticky="nsew")
        left.grid_propagate(False)

        # Session dir: dropdown + add only (no separate label per project rule)
        session_row = tk.Frame(left, bg=UnifiedStyles.COLORS["bg_secondary"])
        session_row.pack(padx=10, pady=(10, 2), fill=tk.X)
        self.session_dir_var = tk.StringVar(value=str(self.session_dir))
        self.session_dir_combo = ThemedCombobox.create(
            session_row, textvariable=self.session_dir_var,
            values=getattr(self, "_session_dir_list", []) or [str(self.session_dir)],
            state="readonly", font=UnifiedStyles.FONTS["small"], width=28
        )
        self.session_dir_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.session_dir_combo.bind("<<ComboboxSelected>>", self._on_session_dir_selected)
        add_btn = tk.Button(
            session_row, text="+",
            command=self._on_add_session_dir,
            bg=UnifiedStyles.COLORS["accent"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], width=3, padx=2, pady=0, relief=tk.FLAT, cursor="hand2"
        )
        add_btn.pack(side=tk.RIGHT, padx=(4, 0))
        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=10, pady=5)

        # Classes (color + name, click name to edit, click row to select)
        tk.Label(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.classes_title"),
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["bold"]
        ).pack(padx=10, pady=(5, 2), anchor=tk.W)
        class_container = tk.Frame(left, bg=UnifiedStyles.COLORS["bg_secondary"], width=240, height=120)
        class_container.pack_propagate(False)
        class_container.pack(padx=10, pady=2, fill=tk.X, expand=False)
        scroll_class = ttk.Scrollbar(class_container)
        scroll_class.pack(side=tk.RIGHT, fill=tk.Y)
        self.class_canvas = tk.Canvas(
            class_container, bg=UnifiedStyles.COLORS["bg_secondary"], highlightthickness=0,
            width=220, height=115
        )
        self.class_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.class_inner_frame = tk.Frame(class_container, bg=UnifiedStyles.COLORS["bg_secondary"], width=220)
        self.class_canvas.create_window((0, 0), window=self.class_inner_frame, anchor="nw")
        self.class_inner_frame.bind("<Configure>", lambda e: self.class_canvas.configure(scrollregion=self.class_canvas.bbox("all")))
        self.class_canvas.configure(yscrollcommand=scroll_class.set)
        scroll_class.config(command=self.class_canvas.yview)
        self._rebuild_class_list_ui()
        tk.Button(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.add_class"),
            command=self._on_add_class,
            bg=UnifiedStyles.COLORS["accent"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=3, relief=tk.FLAT, cursor="hand2"
        ).pack(padx=10, pady=5, fill=tk.X)
        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=10, pady=5)

        # Shape
        tk.Label(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.shape_title"),
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"]
        ).pack(padx=10, pady=(5, 2), anchor=tk.W)
        self.btn_rect = tk.Button(
            left, text=i18n_manager.get_ui_text("ui.coord_picker.pick_type_rect"),
            command=lambda: self._set_shape("rect"),
            bg=UnifiedStyles.COLORS["accent"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=3, relief=tk.FLAT, cursor="hand2"
        )
        self.btn_rect.pack(padx=10, pady=2, fill=tk.X)
        self.btn_circle = tk.Button(
            left, text=i18n_manager.get_ui_text("ui.coord_picker.pick_type_circle"),
            command=lambda: self._set_shape("circle"),
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=3, relief=tk.FLAT, cursor="hand2"
        )
        self.btn_circle.pack(padx=10, pady=2, fill=tk.X)
        self.btn_polygon = tk.Button(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.shape_polygon"),
            command=lambda: self._set_shape("polygon"),
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=3, relief=tk.FLAT, cursor="hand2"
        )
        self.btn_polygon.pack(padx=10, pady=2, fill=tk.X)
        self.btn_freehand = tk.Button(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.shape_freehand"),
            command=lambda: self._set_shape("freehand"),
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=3, relief=tk.FLAT, cursor="hand2"
        )
        self.btn_freehand.pack(padx=10, pady=2, fill=tk.X)
        self.btn_close_polygon = tk.Button(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.close_polygon"),
            command=self._close_polygon,
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"], padx=8, pady=3, relief=tk.FLAT, cursor="hand2"
        )
        self.btn_close_polygon.pack(padx=10, pady=2, fill=tk.X)
        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=10, pady=5)

        # Annotations
        tk.Label(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.current_annotations"),
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"]
        ).pack(padx=10, pady=(5, 2), anchor=tk.W)
        ann_frame = tk.Frame(left, bg=UnifiedStyles.COLORS["bg_secondary"], height=140)
        ann_frame.pack_propagate(False)
        ann_frame.pack(padx=10, pady=2, fill=tk.X, expand=False)
        scroll_ann = ttk.Scrollbar(ann_frame)
        scroll_ann.pack(side=tk.RIGHT, fill=tk.Y)
        img_col_title = i18n_manager.get_ui_text("ui.yolo_collect.column_image")
        class_col_title = i18n_manager.get_ui_text("ui.yolo_collect.column_class")
        type_col_title = i18n_manager.get_ui_text("ui.yolo_collect.column_type")
        coords_col_title = i18n_manager.get_ui_text("ui.yolo_collect.column_coords")
        self.ann_tree = ttk.Treeview(ann_frame, columns=("Img", "Class", "Type", "Coords"), height=6, yscrollcommand=scroll_ann.set, show="headings")
        scroll_ann.config(command=self.ann_tree.yview)
        self.ann_tree.column("Img", width=28)
        self.ann_tree.column("Class", width=62)
        self.ann_tree.column("Type", width=44)
        self.ann_tree.column("Coords", width=80)
        self.ann_tree.heading("Img", text=img_col_title)
        self.ann_tree.heading("Class", text=class_col_title)
        self.ann_tree.heading("Type", text=type_col_title)
        self.ann_tree.heading("Coords", text=coords_col_title)
        self.ann_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.ann_tree.bind("<Delete>", lambda e: self._delete_selected_annotation())
        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=10, pady=5)

        # Actions
        tk.Button(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.refresh_screenshot"),
            command=self._on_refresh_screenshot,
            bg=UnifiedStyles.COLORS["accent"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["button"], padx=8, pady=5, relief=tk.FLAT, cursor="hand2"
        ).pack(padx=10, pady=3, fill=tk.X)
        tk.Button(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.generate_dataset"),
            command=self._on_generate_dataset,
            bg=UnifiedStyles.COLORS["success"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["button"], padx=8, pady=5, relief=tk.FLAT, cursor="hand2"
        ).pack(padx=10, pady=3, fill=tk.X)
        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=10, pady=5)

        # Generate preview
        preview_title = i18n_manager.get_ui_text("ui.yolo_collect.preview_title")
        tk.Label(
            left, text=preview_title,
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["bold"]
        ).pack(padx=10, pady=(5, 2), anchor=tk.W)
        prev_frame = tk.Frame(left, bg=UnifiedStyles.COLORS["bg_primary"], relief=tk.SUNKEN, bd=1, height=200)
        prev_frame.pack_propagate(False)
        prev_frame.pack(padx=10, pady=2, fill=tk.X, expand=False)
        self.preview_text = tk.Text(
            prev_frame, height=8, wrap=tk.WORD, state=tk.DISABLED,
            bg=UnifiedStyles.COLORS["bg_primary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["small"], padx=6, pady=4
        )
        self.preview_text.pack(fill=tk.BOTH, expand=True)
        scroll_preview = ttk.Scrollbar(prev_frame, command=self.preview_text.yview)
        scroll_preview.pack(side=tk.RIGHT, fill=tk.Y)
        self.preview_text.configure(yscrollcommand=scroll_preview.set)
        self._update_generate_preview()
        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=10, pady=5)

        # Screenshot history
        tk.Label(
            left, text=i18n_manager.get_ui_text("ui.yolo_collect.screenshot_history"),
            bg=UnifiedStyles.COLORS["bg_secondary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["label"]
        ).pack(padx=10, pady=(5, 2), anchor=tk.W)
        hist_frame = tk.Frame(left, bg=UnifiedStyles.COLORS["bg_secondary"])
        hist_frame.pack(padx=10, pady=2, fill=tk.BOTH, expand=True)
        self.history_listbox = tk.Listbox(
            hist_frame, height=6,
            bg=UnifiedStyles.COLORS["bg_primary"], fg=UnifiedStyles.COLORS["text_primary"],
            font=UnifiedStyles.FONTS["small"]
        )
        self.history_listbox.pack(fill=tk.BOTH, expand=True)
        self.history_listbox.bind("<<ListboxSelect>>", self._on_history_select)
        self.window.update_idletasks()
        self._update_class_list_canvas_after_rebuild()

    def _rebuild_class_list_ui(self) -> None:
        self._cancel_edit_class_name()
        self._selected_class_index = max(0, min(self._selected_class_index, len(self.class_names) - 1)) if self.class_names else 0
        for w in self.class_inner_frame.winfo_children():
            w.destroy()
        self._class_row_frames = []
        self._class_name_labels = []
        self._class_color_labels = []
        for i in range(len(self.class_names)):
            row = tk.Frame(self.class_inner_frame, bg=UnifiedStyles.COLORS["bg_tertiary"] if i == self._selected_class_index else UnifiedStyles.COLORS["bg_secondary"])
            row.pack(fill=tk.X, pady=1)
            color_lbl = tk.Label(row, width=2, bg=self.class_colors[i] if i < len(self.class_colors) else get_yolo_collect_class_color(0),
                                fg=self.class_colors[i], relief=tk.RIDGE, bd=1)
            color_lbl.pack(side=tk.LEFT, padx=(0, 4), pady=2)
            name_lbl = tk.Label(row, text=self.class_names[i], anchor=tk.W,
                                bg=row.cget("bg"), fg=UnifiedStyles.COLORS["text_primary"],
                                font=UnifiedStyles.FONTS["small"], cursor="xterm")
            name_lbl.pack(side=tk.LEFT, fill=tk.X, expand=True)
            row.bind("<Button-1>", lambda e, idx=i: self._select_class(idx))
            color_lbl.bind("<Button-1>", lambda e, idx=i: self._select_class(idx))
            name_lbl.bind("<Button-1>", lambda e, idx=i: self._on_class_name_click(e, idx))
            name_lbl.bind("<Double-Button-1>", lambda e, idx=i: self._on_class_name_double_click(e, idx))
            self._class_row_frames.append(row)
            self._class_color_labels.append(color_lbl)
            self._class_name_labels.append(name_lbl)
        self._update_class_list_canvas_after_rebuild()

    def _update_class_list_canvas_after_rebuild(self) -> None:
        """Refresh class list canvas scroll region and ensure new rows are visible (e.g. after add)."""
        if not getattr(self, "class_canvas", None) or not self.class_canvas.winfo_exists():
            return
        self.class_canvas.configure(scrollregion=self.class_canvas.bbox("all"))
        self.class_canvas.yview_moveto(0)
        self.class_canvas.update_idletasks()

    def _select_class(self, index: int) -> None:
        if index == self._selected_class_index:
            return
        self._selected_class_index = max(0, min(index, len(self.class_names) - 1))
        for i, row in enumerate(self._class_row_frames):
            bg = UnifiedStyles.COLORS["bg_tertiary"] if i == self._selected_class_index else UnifiedStyles.COLORS["bg_secondary"]
            row.configure(bg=bg)
            if i < len(self._class_name_labels):
                self._class_name_labels[i].configure(bg=bg)
        self._update_bottom_info()

    def _on_class_name_click(self, event, index: int) -> None:
        self._select_class(index)

    def _on_class_name_double_click(self, event, index: int) -> None:
        self._select_class(index)
        self._start_edit_class_name(index)

    def _start_edit_class_name(self, index: int) -> None:
        if index < 0 or index >= len(self.class_names):
            return
        self._finish_edit_class_name()
        row = self._class_row_frames[index]
        name_lbl = self._class_name_labels[index]
        name_lbl.pack_forget()
        self._edit_entry = tk.Entry(row, bg=UnifiedStyles.COLORS["bg_primary"], fg=UnifiedStyles.COLORS["text_primary"],
                                   font=UnifiedStyles.FONTS["small"])
        self._edit_entry.insert(0, self.class_names[index])
        self._edit_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._edit_entry.focus_set()
        self._edit_entry.select_range(0, tk.END)
        self._edit_index = index
        self._edit_entry.bind("<Return>", lambda e: self._finish_edit_class_name())
        self._edit_entry.bind("<FocusOut>", lambda e: self.window.after(50, self._finish_edit_class_name))

    def _finish_edit_class_name(self) -> None:
        if self._edit_entry is None or self._edit_index is None:
            return
        idx = self._edit_index
        new_name = self._edit_entry.get().strip()
        if self._edit_entry.winfo_exists():
            self._edit_entry.unbind("<FocusOut>")
            self._edit_entry.unbind("<Return>")
            self._edit_entry.destroy()
        self._edit_entry = None
        self._edit_index = None
        if new_name:
            self.class_names[idx] = new_name
        if idx < len(self._class_name_labels):
            lbl = self._class_name_labels[idx]
            lbl.config(text=self.class_names[idx])
            lbl.pack(side=tk.LEFT, fill=tk.X, expand=True)
            lbl.update_idletasks()
        self._sync_class_config()

    def _cancel_edit_class_name(self) -> None:
        if self._edit_entry is not None:
            if self._edit_entry.winfo_exists():
                self._edit_entry.destroy()
            self._edit_entry = None
            self._edit_index = None

    def _create_canvas(self, parent: tk.Frame) -> None:
        cf = tk.Frame(parent, bg=UnifiedStyles.COLORS["bg_primary"])
        cf.grid(row=0, column=1, sticky="nsew")
        self.canvas = tk.Canvas(cf, bg=UnifiedStyles.COLORS["bg_secondary"], highlightthickness=0, cursor="crosshair")
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.canvas.bind("<Button-1>", self._on_canvas_click)
        self.canvas.bind("<Button-3>", self._on_canvas_right_click)
        self.canvas.bind("<Motion>", self._on_canvas_motion)
        self.canvas.bind("<B1-Motion>", self._on_canvas_b1_motion)
        self.canvas.bind("<ButtonRelease-1>", self._on_canvas_b1_release)
        self.canvas.bind("<Double-Button-1>", self._on_canvas_double_click)
        self.window.bind("<Return>", self._on_polygon_shortcut_close)
        self.window.bind("<space>", self._on_polygon_shortcut_close)

    def _set_shape(self, shape: str) -> None:
        self.current_pick_type = shape
        self.temp_points = []
        self._freehand_drawing = False
        self._clear_preview_line()
        self.btn_rect.configure(bg=UnifiedStyles.COLORS["accent"] if shape == "rect" else UnifiedStyles.COLORS["bg_tertiary"])
        self.btn_circle.configure(bg=UnifiedStyles.COLORS["accent"] if shape == "circle" else UnifiedStyles.COLORS["bg_tertiary"])
        self.btn_polygon.configure(bg=UnifiedStyles.COLORS["accent"] if shape == "polygon" else UnifiedStyles.COLORS["bg_tertiary"])
        self.btn_freehand.configure(bg=UnifiedStyles.COLORS["accent"] if shape == "freehand" else UnifiedStyles.COLORS["bg_tertiary"])
        self._update_close_polygon_button()
        self._redraw_canvas()
        self._update_bottom_hint()

    def _on_canvas_right_click(self, event) -> None:
        if self.current_pick_type == "polygon" and len(self.temp_points) >= 3:
            self._close_polygon()
            return
        # allow default (e.g. context menu if any)

    def _on_polygon_shortcut_close(self, event=None) -> str:
        if self.current_pick_type == "polygon" and len(self.temp_points) >= 3:
            self._close_polygon()
            return "break"
        return None

    def _get_current_class_id(self) -> int:
        if 0 <= self._selected_class_index < len(self.class_names):
            return self._selected_class_index
        return 0

    def _get_class_color(self, class_id: int) -> str:
        if 0 <= class_id < len(self.class_colors):
            return self.class_colors[class_id]
        return get_yolo_collect_class_color(class_id) if class_id >= 0 else "#00FF00"

    def _clear_preview_line(self) -> None:
        if self._preview_line_id is not None and self.canvas.winfo_exists():
            self.canvas.delete(self._preview_line_id)
        self._preview_line_id = None

    def _update_close_polygon_button(self) -> None:
        if not getattr(self, "btn_close_polygon", None):
            return
        can_close = self.current_pick_type == "polygon" and len(self.temp_points) >= 3
        self.btn_close_polygon.configure(state=tk.NORMAL if can_close else tk.DISABLED)
        if self.btn_close_polygon.winfo_exists():
            self.btn_close_polygon.update_idletasks()

    def _close_polygon(self) -> None:
        if self.current_index < 0 or self.current_index >= len(self.screenshot_history):
            return
        if self.current_pick_type != "polygon":
            messagebox.showinfo(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.yolo_collect.close_polygon_hint_shape"),
                parent=self.window
            )
            return
        if len(self.temp_points) < 3:
            messagebox.showinfo(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.yolo_collect.close_polygon_hint_points"),
                parent=self.window
            )
            return
        cid = self._get_current_class_id()
        cname = self.class_names[cid] if cid < len(self.class_names) else i18n_manager.get_ui_text("ui.yolo_collect.class_default")
        vertices = [[int(p[0]), int(p[1])] for p in self.temp_points]
        if len(vertices) > 1 and vertices[0] != vertices[-1]:
            vertices.append(vertices[0][:])
        rec = self.screenshot_history[self.current_index]
        rec["annotations"].append({
            "class_id": cid,
            "class_name": cname,
            "type": "polygon",
            "vertices": vertices,
        })
        self._push_undo_add(self.current_index, len(rec["annotations"]) - 1)
        self.temp_points = []
        self._clear_preview_line()
        self._update_close_polygon_button()
        self._update_ann_tree()
        self._redraw_canvas()
        self._sync_subdataset_snapshot()

    def _event_to_image_coords(self, event) -> tuple:
        if not hasattr(self, "scale_factor"):
            return -1, -1
        x = int((event.x - self.canvas_offset_x) / self.scale_factor)
        y = int((event.y - self.canvas_offset_y) / self.scale_factor)
        return x, y

    def _on_canvas_motion(self, event) -> None:
        x, y = self._event_to_image_coords(event)
        if self.current_pick_type == "polygon" and len(self.temp_points) >= 1:
            self._clear_preview_line()
            c1 = self._to_canvas(self.temp_points[-1][0], self.temp_points[-1][1])
            c2 = self._to_canvas(x, y)
            self._preview_line_id = self.canvas.create_line(c1[0], c1[1], c2[0], c2[1], fill="#FFFF00", width=2, tags="preview")

    def _on_canvas_b1_motion(self, event) -> None:
        if not self._freehand_drawing or self.current_pick_type != "freehand":
            return
        if self.current_index < 0 or self.current_index >= len(self.screenshot_history):
            return
        x, y = self._event_to_image_coords(event)
        img = self.screenshot_history[self.current_index].get("image")
        if img is None:
            return
        iw, ih = img.size
        if x < 0 or y < 0 or x >= iw or y >= ih:
            return
        if not self.temp_points or (self.temp_points[-1][0] != x or self.temp_points[-1][1] != y):
            self.temp_points.append((x, y))
            self._redraw_canvas()

    def _on_canvas_b1_release(self, event) -> None:
        if not self._freehand_drawing or self.current_pick_type != "freehand":
            return
        self._freehand_drawing = False
        if self.current_index < 0 or self.current_index >= len(self.screenshot_history) or len(self.temp_points) < 3:
            self.temp_points = []
            self._redraw_canvas()
            return
        cid = self._get_current_class_id()
        cname = self.class_names[cid] if cid < len(self.class_names) else i18n_manager.get_ui_text("ui.yolo_collect.class_default")
        vertices = [[int(p[0]), int(p[1])] for p in self.temp_points]
        if vertices[0] != vertices[-1]:
            vertices.append(vertices[0][:])
        rec = self.screenshot_history[self.current_index]
        rec["annotations"].append({
            "class_id": cid,
            "class_name": cname,
            "type": "polygon",
            "vertices": vertices,
        })
        self._push_undo_add(self.current_index, len(rec["annotations"]) - 1)
        self.temp_points = []
        self._update_ann_tree()
        self._redraw_canvas()
        self._sync_subdataset_snapshot()

    def _on_canvas_double_click(self, event) -> None:
        if self.current_pick_type == "polygon" and len(self.temp_points) >= 3:
            self._close_polygon()

    def _next_class_name_with_number(self) -> str:
        base = i18n_manager.get_ui_text("ui.yolo_collect.class_default")
        prefix = base + "_"
        max_n = 0
        for s in self.class_names:
            if s and s.startswith(prefix):
                m = re.match(r"^(.+)_(\d+)$", s)
                if m and m.group(2).isdigit():
                    max_n = max(max_n, int(m.group(2)))
        return f"{prefix}{max_n + 1}"

    def _on_add_class(self) -> None:
        name = self._next_class_name_with_number()
        self.class_names.append(name)
        while len(self.class_colors) < len(self.class_names):
            self.class_colors.append(get_yolo_collect_class_color(len(self.class_colors)))
        self._selected_class_index = len(self.class_names) - 1
        self._rebuild_class_list_ui()
        self._update_class_list_canvas_after_rebuild()
        self._sync_class_config()
        self.window.after(80, self._start_edit_class_name_after_add)

    def _start_edit_class_name_after_add(self) -> None:
        idx = len(self.class_names) - 1
        if idx >= 0 and not getattr(self, "_edit_entry", None):
            self._start_edit_class_name(idx)

    def _on_refresh_screenshot(self) -> None:
        out = self.on_capture()
        if isinstance(out, tuple) and len(out) >= 2:
            img, err = out[0], out[1]
        else:
            img, err = None, "Invalid capture result"
        if err or img is None:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                err or i18n_manager.get_ui_text("ui.coord_calibration.no_game_window")
            )
            return
        self._append_screenshot(img)
        self.current_index = len(self.screenshot_history) - 1
        self._update_history_listbox()
        self._show_current_screenshot()
        ColorPrint.green("[YOLO_COLLECT] Screenshot added (annotations stacked per image)")

    def _on_generate_dataset(self) -> None:
        if not self.screenshot_history:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.yolo_collect.no_screenshots")
            )
            return
        total_ann = sum(len(h.get("annotations") or []) for h in self.screenshot_history)
        if total_ann == 0:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.yolo_collect.no_annotations")
            )
            return
        result = generate_dataset_from_screenshot_history(
            screenshot_history=self.screenshot_history,
            class_names=self.class_names,
            train_ratio=0.8,
            output_dir=self.session_dir,
        )
        if result.get("error"):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                result.get("error", i18n_manager.get_ui_text("ui.coord_calibration.unknown_error"))
            )
            return
        cmd = result.get("train_command", "")
        path_msg = result.get("dataset_dir", "")
        msg = f"{i18n_manager.get_ui_text('ui.yolo_collect.dataset_done')}\n\n{path_msg}\n\n{i18n_manager.get_ui_text('ui.yolo_collect.dataset_train_cmd_label')}\n{cmd}"
        messagebox.showinfo(
            i18n_manager.get_ui_text("ui.coord_calibration.success_title"),
            msg
        )
        if self.window.winfo_exists() and cmd:
            self.window.clipboard_clear()
            self.window.clipboard_append(cmd)
        self._sync_subdataset_snapshot()
        self._update_generate_preview(last_result=result)

    def _delete_selected_annotation(self) -> None:
        sel = self.ann_tree.selection()
        if not sel:
            return
        item = sel[0]
        if not isinstance(item, str) or not item.startswith("img") or "_ann" not in item:
            return
        parts = item.split("_ann", 1)
        if len(parts) != 2:
            return
        a, b = parts[0], parts[1]
        if not a.replace("img", "").isdigit() or not b.isdigit():
            return
        img_idx = int(a.replace("img", ""))
        ann_idx = int(b)
        if img_idx < 0 or img_idx >= len(self.screenshot_history):
            return
        anns = self.screenshot_history[img_idx].get("annotations") or []
        if ann_idx < 0 or ann_idx >= len(anns):
            return
        self.screenshot_history[img_idx]["annotations"].pop(ann_idx)
        self._update_ann_tree()
        if img_idx == self.current_index:
            self._redraw_canvas()
        self._sync_subdataset_snapshot()

    def _on_history_select(self, event) -> None:
        sel = self.history_listbox.curselection()
        if not sel:
            return
        i = sel[0]
        if 0 <= i < len(self.screenshot_history):
            self.current_index = i
            self._show_current_screenshot()

    def _update_history_listbox(self) -> None:
        self.history_listbox.delete(0, tk.END)
        for i, h in enumerate(self.screenshot_history):
            n = len(h.get("annotations") or [])
            ts = h.get("timestamp", "")
            self.history_listbox.insert(tk.END, f"#{i+1} ({n}) {ts}")
        if 0 <= self.current_index < len(self.screenshot_history):
            self.history_listbox.selection_set(self.current_index)

    def _update_ann_tree(self) -> None:
        for row in self.ann_tree.get_children():
            self.ann_tree.delete(row)
        for img_idx, rec in enumerate(self.screenshot_history):
            anns = rec.get("annotations") or []
            img_idx_str = str(img_idx + 1)
            for ann_idx, a in enumerate(anns):
                cid = a.get("class_id", 0)
                name = self.class_names[cid] if cid < len(self.class_names) else str(cid)
                t = a.get("type", "rect")
                if t == "rect":
                    coords = f"{a.get('x',0)},{a.get('y',0)} {a.get('width',0)}x{a.get('height',0)}"
                elif t == "polygon":
                    verts = a.get("vertices") or []
                    coords = f"{len(verts)} points"
                else:
                    coords = f"({a.get('x',0)},{a.get('y',0)}) r={a.get('radius',0)}"
                iid = f"img{img_idx}_ann{ann_idx}"
                self.ann_tree.insert("", tk.END, iid=iid, values=(img_idx_str, name, t, coords))

    def _show_current_screenshot(self) -> None:
        self._update_history_listbox()
        self._update_close_polygon_button()
        self._update_toolbar_buttons()
        if self.current_index < 0 or self.current_index >= len(self.screenshot_history):
            self.canvas.delete("all")
            self._update_bottom_info()
            return
        rec = self.screenshot_history[self.current_index]
        img = rec.get("image")
        if img is None:
            self._update_bottom_info()
            return
        self._update_ann_tree()
        self._display_image(img)
        self._redraw_canvas()

    def _display_image(self, pil_image) -> None:
        self.canvas.delete("all")
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        if cw <= 1 or ch <= 1:
            self.window.after(100, lambda: self._display_image(pil_image))
            return
        iw, ih = pil_image.size
        base_scale = min(cw / iw, ch / ih)
        scale = base_scale * self.zoom_factor
        nw, nh = int(iw * scale), int(ih * scale)
        self.display_screenshot = pil_image.resize((nw, nh), Image.Resampling.LANCZOS)
        self.photo_image = ImageTk.PhotoImage(self.display_screenshot)
        self.canvas.create_image(cw // 2, ch // 2, image=self.photo_image)
        self.scale_factor = scale
        self.canvas_offset_x = (cw - nw) // 2
        self.canvas_offset_y = (ch - nh) // 2
        self._update_bottom_info(iw, ih)

    def _to_canvas(self, x: int, y: int) -> tuple:
        cx = int(x * self.scale_factor) + self.canvas_offset_x
        cy = int(y * self.scale_factor) + self.canvas_offset_y
        return (cx, cy)

    def _redraw_canvas(self) -> None:
        if self.canvas.winfo_exists():
            for mid in self.canvas_marks:
                self.canvas.delete(mid)
        self.canvas_marks = []
        if self.current_index < 0 or self.current_index >= len(self.screenshot_history):
            return
        anns = self.screenshot_history[self.current_index].get("annotations") or []
        for a in anns:
            t = a.get("type", "rect")
            cid = a.get("class_id", 0)
            color = self._get_class_color(cid)
            if t == "rect":
                x, y = a.get("x", 0), a.get("y", 0)
                w, h = a.get("width", 0), a.get("height", 0)
                if w > 0 and h > 0:
                    c1 = self._to_canvas(x, y)
                    c2 = self._to_canvas(x + w, y + h)
                    mid = self.canvas.create_rectangle(c1[0], c1[1], c2[0], c2[1], outline=color, fill="", width=2)
                    self.canvas_marks.append(mid)
            elif t == "circle":
                cx, cy = a.get("x", 0), a.get("y", 0)
                r = a.get("radius", 0)
                if r > 0:
                    cc = self._to_canvas(cx, cy)
                    sr = int(r * self.scale_factor)
                    mid = self.canvas.create_oval(cc[0] - sr, cc[1] - sr, cc[0] + sr, cc[1] + sr, outline=color, fill="", width=2)
                    self.canvas_marks.append(mid)
            elif t == "polygon":
                verts = a.get("vertices") or []
                if len(verts) >= 2:
                    flat = []
                    for v in verts:
                        c = self._to_canvas(v[0], v[1])
                        flat.extend(c)
                    mid = self.canvas.create_line(*flat, fill=color, width=2, smooth=False)
                    self.canvas_marks.append(mid)
        if self.temp_points:
            if len(self.temp_points) >= 2:
                flat = []
                for p in self.temp_points:
                    c = self._to_canvas(p[0], p[1])
                    flat.extend(c)
                mid = self.canvas.create_line(*flat, fill="#FFFF00", width=2, smooth=False)
                self.canvas_marks.append(mid)
            if len(self.temp_points) == 1 or self.current_pick_type in ("rect", "circle"):
                px, py = self.temp_points[0]
                cc = self._to_canvas(px, py)
                mid = self.canvas.create_oval(cc[0] - 4, cc[1] - 4, cc[0] + 4, cc[1] + 4, outline="#FFFF00", fill="", width=2)
                self.canvas_marks.append(mid)

    def _on_canvas_click(self, event) -> None:
        if not hasattr(self, "scale_factor") or self.current_index < 0 or self.current_index >= len(self.screenshot_history):
            return
        x = int((event.x - self.canvas_offset_x) / self.scale_factor)
        y = int((event.y - self.canvas_offset_y) / self.scale_factor)
        rec = self.screenshot_history[self.current_index]
        img = rec.get("image")
        if img is None:
            return
        iw, ih = img.size
        if x < 0 or y < 0 or x >= iw or y >= ih:
            return
        cid = self._get_current_class_id()
        cname = self.class_names[cid] if cid < len(self.class_names) else "object"

        if self.current_pick_type == "rect":
            if len(self.temp_points) == 0:
                self.temp_points.append((x, y))
                self._redraw_canvas()
            elif len(self.temp_points) == 1:
                x1, y1 = self.temp_points[0]
                ann = {
                    "class_id": cid,
                    "class_name": cname,
                    "type": "rect",
                    "x": min(x, x1), "y": min(y, y1),
                    "width": abs(x - x1), "height": abs(y - y1),
                }
                rec["annotations"].append(ann)
                self._push_undo_add(self.current_index, len(rec["annotations"]) - 1)
                self.temp_points = []
                self._update_ann_tree()
                self._redraw_canvas()
                self._sync_subdataset_snapshot()
        elif self.current_pick_type == "circle":
            if len(self.temp_points) == 0:
                self.temp_points.append((x, y))
                self._redraw_canvas()
            elif len(self.temp_points) == 1:
                cx, cy = self.temp_points[0]
                r = int(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5)
                ann = {
                    "class_id": cid,
                    "class_name": cname,
                    "type": "circle",
                    "x": cx, "y": cy, "radius": max(1, r),
                }
                rec["annotations"].append(ann)
                self._push_undo_add(self.current_index, len(rec["annotations"]) - 1)
                self.temp_points = []
                self._update_ann_tree()
                self._redraw_canvas()
                self._sync_subdataset_snapshot()
        elif self.current_pick_type == "polygon":
            if len(self.temp_points) >= 3:
                x0, y0 = self.temp_points[0]
                dist = ((x - x0) ** 2 + (y - y0) ** 2) ** 0.5
                if dist <= POLYGON_CLOSE_THRESHOLD:
                    self._close_polygon()
                    return
            self.temp_points.append((x, y))
            self._update_close_polygon_button()
            self._redraw_canvas()
        elif self.current_pick_type == "freehand":
            if not self.temp_points:
                self._freehand_drawing = True
                self.temp_points.append((x, y))
                self._redraw_canvas()

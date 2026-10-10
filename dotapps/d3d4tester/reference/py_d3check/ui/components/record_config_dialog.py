# -*- coding: utf-8 -*-
"""
Record config dialog: edit record_cfg.json per GameAISDK spec, save on button. i18n.
"""

import tkinter as tk
from tkinter import ttk, messagebox

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from providor.i18n_manager import i18n_manager
from ..unified_styles import UnifiedStyles
from ..utils.app_root import get_app_root
from d3utils.yolo_record import load_record_config, save_record_config


def _t(key: str) -> str:
    return i18n_manager.get_ui_text(key) or key


class RecordConfigDialog:
    """GameAISDK record config: Debug, FrameFPS, OutputAsVideo, LogTimestamp, FrameWidth, FrameHeight."""

    def __init__(self, parent=None):
        root = parent or get_app_root()
        self.win = tk.Toplevel(root) if root else tk.Tk()
        self.win.title(_t("ui.coord_calibration.yolo_record_config_dialog.title"))
        self.win.resizable(True, False)
        self.win.geometry("420x320")
        self._vars = {}
        self._build_ui()
        self._load_config()

    def _build_ui(self):
        main = tk.Frame(self.win, bg=UnifiedStyles.COLORS["bg_primary"], padx=UnifiedStyles.SPACING["md"], pady=UnifiedStyles.SPACING["md"])
        main.pack(fill=tk.BOTH, expand=True)
        main.grid_columnconfigure(1, weight=1)
        row = 0
        pad = UnifiedStyles.SPACING["sm"]
        bg = UnifiedStyles.COLORS["bg_primary"]
        fg = UnifiedStyles.COLORS["text_primary"]
        font_l = UnifiedStyles.FONTS["label"]
        font_i = UnifiedStyles.FONTS["input"]

        def add_check(key, i18n_key):
            nonlocal row
            var = tk.BooleanVar()
            self._vars[key] = var
            cb = tk.Checkbutton(
                main, text=_t(i18n_key), variable=var,
                bg=bg, fg=fg, selectcolor=UnifiedStyles.COLORS["bg_tertiary"],
                activebackground=bg, activeforeground=fg, font=font_l,
            )
            cb.grid(row=row, column=0, columnspan=2, sticky="w", pady=pad)
            row += 1

        def add_int(key, i18n_key, min_val=1, max_val=120):
            nonlocal row
            var = tk.StringVar()
            self._vars[key] = var
            tk.Label(main, text=_t(i18n_key), bg=bg, fg=UnifiedStyles.COLORS["text_secondary"], font=font_l).grid(row=row, column=0, sticky="w", pady=pad)
            sp = ttk.Spinbox(main, textvariable=var, from_=min_val, to=max_val, width=8, font=font_i)
            sp.grid(row=row, column=1, sticky="w", pady=pad)
            row += 1

        add_check("Debug", "ui.coord_calibration.yolo_record_config_dialog.debug")
        add_int("FrameFPS", "ui.coord_calibration.yolo_record_config_dialog.frame_fps", 1, 60)
        add_check("OutputAsVideo", "ui.coord_calibration.yolo_record_config_dialog.output_as_video")
        add_check("LogTimestamp", "ui.coord_calibration.yolo_record_config_dialog.log_timestamp")
        add_int("FrameWidth", "ui.coord_calibration.yolo_record_config_dialog.frame_width", 160, 3840)
        add_int("FrameHeight", "ui.coord_calibration.yolo_record_config_dialog.frame_height", 90, 2160)
        add_int("RecordHttpPort", "ui.coord_calibration.yolo_record_config_dialog.http_port", 1024, 65535)

        btn_f = tk.Frame(main, bg=bg)
        btn_f.grid(row=row, column=0, columnspan=2, sticky="ew", pady=(UnifiedStyles.SPACING["md"], 0))
        btn_f.grid_columnconfigure(0, weight=1)
        save_btn = tk.Button(
            btn_f, text=_t("ui.coord_calibration.yolo_record_config_dialog.save"),
            command=self._on_save,
            bg=UnifiedStyles.COLORS["success"], fg=fg,
            font=UnifiedStyles.FONTS["button"], padx=UnifiedStyles.SPACING["md"], pady=pad,
            relief=tk.FLAT, cursor="hand2",
        )
        save_btn.pack(side=tk.RIGHT, padx=(0, pad))
        cancel_btn = tk.Button(
            btn_f, text=_t("ui.coord_calibration.yolo_record_config_dialog.cancel"),
            command=self.win.destroy,
            bg=UnifiedStyles.COLORS["bg_tertiary"], fg=fg,
            font=UnifiedStyles.FONTS["button"], padx=UnifiedStyles.SPACING["md"], pady=pad,
            relief=tk.FLAT, cursor="hand2",
        )
        cancel_btn.pack(side=tk.RIGHT)

    def _load_config(self):
        try:
            cfg = load_record_config()
        except (OSError, ValueError, TypeError):
            cfg = {}
        self._vars["Debug"].set(cfg.get("Debug", True))
        self._vars["FrameFPS"].set(str(cfg.get("FrameFPS", 10)))
        self._vars["OutputAsVideo"].set(cfg.get("OutputAsVideo", False))
        self._vars["LogTimestamp"].set(cfg.get("LogTimestamp", False))
        self._vars["FrameWidth"].set(str(cfg.get("FrameWidth", 640)))
        self._vars["FrameHeight"].set(str(cfg.get("FrameHeight", 360)))
        self._vars["RecordHttpPort"].set(str(cfg.get("RecordHttpPort", 52808)))

    def _gather(self):
        def int_val(key, default):
            try:
                return int(self._vars[key].get())
            except (ValueError, TypeError):
                return default
        return {
            "Debug": self._vars["Debug"].get(),
            "FrameFPS": int_val("FrameFPS", 10),
            "OutputAsVideo": self._vars["OutputAsVideo"].get(),
            "LogTimestamp": self._vars["LogTimestamp"].get(),
            "FrameWidth": int_val("FrameWidth", 640),
            "FrameHeight": int_val("FrameHeight", 360),
            "RecordHttpPort": int_val("RecordHttpPort", 52808),
        }

    def _on_save(self):
        data = self._gather()
        if data["FrameFPS"] < 1 or data["FrameFPS"] > 60:
            messagebox.showwarning(
                _t("ui.coord_calibration.warning_title"),
                _t("ui.coord_calibration.yolo_record_config_dialog.invalid_fps"),
                parent=self.win,
            )
            return
        if data["FrameWidth"] < 1 or data["FrameHeight"] < 1:
            messagebox.showwarning(
                _t("ui.coord_calibration.warning_title"),
                _t("ui.coord_calibration.yolo_record_config_dialog.invalid_resolution"),
                parent=self.win,
            )
            return
        if data["RecordHttpPort"] < 1024 or data["RecordHttpPort"] > 65535:
            messagebox.showwarning(
                _t("ui.coord_calibration.warning_title"),
                _t("ui.coord_calibration.yolo_record_config_dialog.invalid_port"),
                parent=self.win,
            )
            return
        try:
            ok, err = save_record_config(data)
            if ok:
                messagebox.showinfo(
                    _t("ui.coord_calibration.success_title"),
                    _t("ui.coord_calibration.yolo_record_config_dialog.save_success"),
                    parent=self.win,
                )
                self.win.destroy()
            else:
                messagebox.showerror(
                    _t("ui.coord_calibration.error_title"),
                    _t("ui.coord_calibration.yolo_record_config_dialog.save_failed") + " " + (err or ""),
                    parent=self.win,
                )
        except (OSError, ValueError, TypeError) as e:
            messagebox.showerror(
                _t("ui.coord_calibration.error_title"),
                _t("ui.coord_calibration.yolo_record_config_dialog.save_failed") + " " + str(e),
                parent=self.win,
            )

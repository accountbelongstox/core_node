# -*- coding: utf-8 -*-
"""
ROSBOT Update Info Panel - i18n popup.

Shows ROSBOT update info and usage. When no update is available, shows detection data and usage (i18n).
"""
import os
import tkinter as tk
from tkinter import ttk
from typing import Any, Dict, List, Optional, Callable

from providor.i18n_manager import i18n_manager
from ..unified_styles import UnifiedStyles


class RosbotUpdateInfoPanel:
    """
    ROSBOT update info popup.
    - Confirm dialog when update available
    - Usage when no update
    - i18n
    """

    def __init__(self, parent: tk.Tk):
        """
        Args:
            parent: parent window
        """
        self.parent = parent
        self.result = None
        self.dialog = None

    def show_update_available(
        self,
        region_display: str,
        version_str: str,
        zip_path: str,
        on_confirm: Optional[Callable[[], None]] = None,
        on_cancel: Optional[Callable[[], None]] = None,
    ) -> bool:
        """
        Args:
            region_display: region display name (i18n)
            version_str: version string
            zip_path: zip path
            on_confirm: confirm callback
            on_cancel: cancel callback

        Returns:
            bool: True=confirm update, False=cancel
        """
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title(i18n_manager.get_ui_text("rosbot.update_dialog_title"))
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        self.dialog.resizable(False, False)
        
        # Center
        self.dialog.update_idletasks()
        width = 500
        height = 250
        x = (self.dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (height // 2)
        self.dialog.geometry(f"{width}x{height}+{x}+{y}")
        
        # Style
        self.dialog.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        
        # Main container
        main_frame = tk.Frame(
            self.dialog,
            bg=UnifiedStyles.COLORS['bg_primary'],
            padx=20,
            pady=20
        )
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title_label = tk.Label(
            main_frame,
            text=i18n_manager.get_ui_text("rosbot.update_available_title"),
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=(UnifiedStyles.FONTS['button'][0], 14, 'bold')
        )
        title_label.pack(pady=(0, 10))
        
        # Info text
        info_text = i18n_manager.get_ui_text("rosbot.update_available_message").format(
            region=region_display,
            version=version_str or "?",
            path=zip_path
        )
        info_label = tk.Label(
            main_frame,
            text=info_text,
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
            justify=tk.LEFT,
            wraplength=width - 40
        )
        info_label.pack(pady=(0, 20))
        
        # Button frame
        button_frame = tk.Frame(
            main_frame,
            bg=UnifiedStyles.COLORS['bg_primary']
        )
        button_frame.pack()
        
        def on_yes():
            self.result = True
            self.dialog.destroy()
            if on_confirm:
                on_confirm()
        
        def on_no():
            self.result = False
            self.dialog.destroy()
            if on_cancel:
                on_cancel()
        
        # Confirm button
        yes_btn = tk.Button(
            button_frame,
            text=i18n_manager.get_ui_text("rosbot.update_confirm"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            command=on_yes,
            width=12
        )
        yes_btn.pack(side=tk.LEFT, padx=5)
        
        # Cancel button
        no_btn = tk.Button(
            button_frame,
            text=i18n_manager.get_ui_text("rosbot.update_cancel"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            command=on_no,
            width=12
        )
        no_btn.pack(side=tk.LEFT, padx=5)
        
        # Wait for window close
        self.dialog.wait_window()
        return self.result is True

    def show_no_update_info(self, detection_data: Optional[Dict[str, Any]] = None):
        """
        Show detection data and usage when no update available.

        Args:
            detection_data: optional; current_ros_dir, current_version, downloads_dir, regions to explain why no update.
        """
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title(i18n_manager.get_ui_text("rosbot.update_info_title"))
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        self.dialog.resizable(True, True)
        
        # Center
        self.dialog.update_idletasks()
        width = 640
        height = 520
        x = (self.dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (height // 2)
        self.dialog.geometry(f"{width}x{height}+{x}+{y}")
        
        # Style
        self.dialog.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        
        # Main container (scrollable)
        main_canvas = tk.Canvas(
            self.dialog,
            bg=UnifiedStyles.COLORS['bg_primary'],
            highlightthickness=0
        )
        scrollbar = tk.Scrollbar(self.dialog, orient=tk.VERTICAL, command=main_canvas.yview)
        main_frame = tk.Frame(
            main_canvas,
            bg=UnifiedStyles.COLORS['bg_primary'],
            padx=20,
            pady=20
        )
        main_frame.bind("<Configure>", lambda e: main_canvas.configure(scrollregion=main_canvas.bbox("all")))
        main_canvas.create_window((0, 0), window=main_frame, anchor=tk.NW)
        main_canvas.configure(yscrollcommand=scrollbar.set)
        main_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Title
        title_label = tk.Label(
            main_frame,
            text=i18n_manager.get_ui_text("rosbot.no_update_title"),
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=(UnifiedStyles.FONTS['button'][0], 14, 'bold')
        )
        title_label.pack(pady=(0, 10))
        
        # Detection data (why no update)
        if detection_data:
            det_frame = tk.LabelFrame(
                main_frame,
                text=i18n_manager.get_ui_text("rosbot.no_update_detection_title"),
                bg=UnifiedStyles.COLORS['bg_primary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['default']
            )
            det_frame.pack(fill=tk.X, pady=(0, 10))
            det_inner = tk.Frame(det_frame, bg=UnifiedStyles.COLORS['bg_primary'])
            det_inner.pack(fill=tk.X, padx=8, pady=6)
            cur_dir = detection_data.get("current_ros_dir") or ""
            cur_ver = detection_data.get("current_version") or "?"
            down_dir = detection_data.get("downloads_dir") or ""
            for line in [
                i18n_manager.get_ui_text("rosbot.no_update_current_path").format(path=cur_dir or "-"),
                i18n_manager.get_ui_text("rosbot.no_update_current_version").format(version=cur_ver),
                i18n_manager.get_ui_text("rosbot.no_update_downloads_dir").format(path=down_dir or "-"),
            ]:
                tk.Label(
                    det_inner,
                    text=line,
                    bg=UnifiedStyles.COLORS['bg_primary'],
                    fg=UnifiedStyles.COLORS['text_primary'],
                    font=UnifiedStyles.FONTS['default'],
                    anchor=tk.W,
                    justify=tk.LEFT,
                ).pack(anchor=tk.W)
            for reg in detection_data.get("regions") or []:
                rdisp = reg.get("region_display") or reg.get("region", "")
                candidates: List[Dict[str, Any]] = reg.get("candidates") or []
                if not candidates:
                    tk.Label(
                        det_inner,
                        text=i18n_manager.get_ui_text("rosbot.no_update_region_no_zips").format(region=rdisp),
                        bg=UnifiedStyles.COLORS['bg_primary'],
                        fg=UnifiedStyles.COLORS['text_secondary'],
                        font=UnifiedStyles.FONTS['default'],
                        anchor=tk.W,
                    ).pack(anchor=tk.W)
                else:
                    tk.Label(
                        det_inner,
                        text=i18n_manager.get_ui_text("rosbot.no_update_region_zips_not_newer").format(
                            region=rdisp, current=cur_ver, count=len(candidates)
                        ),
                        bg=UnifiedStyles.COLORS['bg_primary'],
                        fg=UnifiedStyles.COLORS['text_primary'],
                        font=UnifiedStyles.FONTS['default'],
                        anchor=tk.W,
                    ).pack(anchor=tk.W)
                    for c in candidates[:5]:
                        name = os.path.basename(c.get("path", ""))
                        ver = c.get("version_str", "?")
                        size = c.get("size_mb", 0)
                        tk.Label(
                            det_inner,
                            text=i18n_manager.get_ui_text("rosbot.no_update_zip_item").format(
                                name=name, version=ver, size_mb=size
                            ),
                            bg=UnifiedStyles.COLORS['bg_primary'],
                            fg=UnifiedStyles.COLORS['text_secondary'],
                            font=UnifiedStyles.FONTS['default'],
                            anchor=tk.W,
                        ).pack(anchor=tk.W, padx=(12, 0))
                    if len(candidates) > 5:
                        tk.Label(
                            det_inner,
                            text=i18n_manager.get_ui_text("rosbot.no_update_zip_more").format(count=len(candidates) - 5),
                            bg=UnifiedStyles.COLORS['bg_primary'],
                            fg=UnifiedStyles.COLORS['text_secondary'],
                            font=UnifiedStyles.FONTS['default'],
                            anchor=tk.W,
                        ).pack(anchor=tk.W, padx=(12, 0))
        
        # Usage text frame (scrollable)
        text_frame = tk.Frame(
            main_frame,
            bg=UnifiedStyles.COLORS['bg_primary']
        )
        text_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        text_scrollbar = tk.Scrollbar(text_frame)
        text_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        text_widget = tk.Text(
            text_frame,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
            wrap=tk.WORD,
            height=12,
            yscrollcommand=text_scrollbar.set,
            padx=10,
            pady=10
        )
        text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        text_scrollbar.config(command=text_widget.yview)
        
        usage_text = i18n_manager.get_ui_text("rosbot.update_usage_instructions")
        text_widget.insert(tk.END, usage_text)
        text_widget.config(state=tk.DISABLED)
        
        # Close button
        def _close():
            try:
                main_canvas.unbind_all("<MouseWheel>")
            except tk.TclError:
                pass
            self.dialog.destroy()
        close_btn = tk.Button(
            main_frame,
            text=i18n_manager.get_ui_text("rosbot.update_close"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            command=_close,
            width=15
        )
        close_btn.pack()
        self.dialog.protocol("WM_DELETE_WINDOW", _close)

        def _on_mousewheel(event):
            main_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        main_canvas.bind_all("<MouseWheel>", _on_mousewheel)

        # Wait for window close
        self.dialog.wait_window()

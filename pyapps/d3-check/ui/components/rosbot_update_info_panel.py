# -*- coding: utf-8 -*-
"""
ROSBOT Update Info Panel - 多语言弹出面板

用于显示 ROSBOT 更新信息和使用说明的弹出窗口。
支持多语言，在没有可用更新时显示使用说明。
"""
import tkinter as tk
from tkinter import ttk
from typing import Optional, Callable

from d3utils.i18n_manager import i18n_manager
from ..unified_styles import UnifiedStyles


class RosbotUpdateInfoPanel:
    """
    ROSBOT 更新信息面板
    
    功能：
    - 显示更新可用时的确认对话框
    - 显示无更新时的使用说明
    - 支持多语言
    """

    def __init__(self, parent: tk.Tk):
        """
        初始化面板
        
        Args:
            parent: 父窗口
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
        显示更新可用对话框
        
        Args:
            region_display: 区服显示名称（如"亚服"或"国服"）
            version_str: 版本号字符串
            zip_path: zip 文件路径
            on_confirm: 确认回调
            on_cancel: 取消回调
            
        Returns:
            bool: True=确认更新, False=取消
        """
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title(i18n_manager.get_ui_text("rosbot.update_dialog_title"))
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        self.dialog.resizable(False, False)
        
        # 居中显示
        self.dialog.update_idletasks()
        width = 500
        height = 250
        x = (self.dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (height // 2)
        self.dialog.geometry(f"{width}x{height}+{x}+{y}")
        
        # 设置样式
        self.dialog.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        
        # 主容器
        main_frame = tk.Frame(
            self.dialog,
            bg=UnifiedStyles.COLORS['bg_primary'],
            padx=20,
            pady=20
        )
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 标题
        title_label = tk.Label(
            main_frame,
            text=i18n_manager.get_ui_text("rosbot.update_available_title"),
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=(UnifiedStyles.FONTS['button'][0], 14, 'bold')
        )
        title_label.pack(pady=(0, 10))
        
        # 信息文本
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
        
        # 按钮框架
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
        
        # 确认按钮
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
        
        # 取消按钮
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
        
        # 等待窗口关闭
        self.dialog.wait_window()
        return self.result is True

    def show_no_update_info(self):
        """
        显示无更新时的使用说明
        """
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title(i18n_manager.get_ui_text("rosbot.update_info_title"))
        self.dialog.transient(self.parent)
        self.dialog.grab_set()
        self.dialog.resizable(True, True)
        
        # 居中显示
        self.dialog.update_idletasks()
        width = 600
        height = 400
        x = (self.dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (height // 2)
        self.dialog.geometry(f"{width}x{height}+{x}+{y}")
        
        # 设置样式
        self.dialog.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        
        # 主容器
        main_frame = tk.Frame(
            self.dialog,
            bg=UnifiedStyles.COLORS['bg_primary'],
            padx=20,
            pady=20
        )
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 标题
        title_label = tk.Label(
            main_frame,
            text=i18n_manager.get_ui_text("rosbot.no_update_title"),
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=(UnifiedStyles.FONTS['button'][0], 14, 'bold')
        )
        title_label.pack(pady=(0, 15))
        
        # 说明文本框架（可滚动）
        text_frame = tk.Frame(
            main_frame,
            bg=UnifiedStyles.COLORS['bg_primary']
        )
        text_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        # 滚动条
        scrollbar = tk.Scrollbar(text_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 文本区域
        text_widget = tk.Text(
            text_frame,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
            wrap=tk.WORD,
            yscrollcommand=scrollbar.set,
            padx=10,
            pady=10
        )
        text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=text_widget.yview)
        
        # 插入使用说明文本
        usage_text = i18n_manager.get_ui_text("rosbot.update_usage_instructions")
        text_widget.insert(tk.END, usage_text)
        text_widget.config(state=tk.DISABLED)  # 只读
        
        # 关闭按钮
        close_btn = tk.Button(
            main_frame,
            text=i18n_manager.get_ui_text("rosbot.update_close"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            command=self.dialog.destroy,
            width=15
        )
        close_btn.pack()
        
        # 等待窗口关闭
        self.dialog.wait_window()

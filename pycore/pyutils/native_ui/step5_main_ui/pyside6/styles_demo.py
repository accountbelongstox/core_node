#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Title Bar Styles Demo - 展示所有预设样式和自定义样式
"""

import sys
from pathlib import Path
from PySide6.QtWidgets import QApplication, QMainWindow, QWidget, QVBoxLayout, QLabel, QTextEdit
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from pycore.pyutils.native_ui.pyside6.title_bar import PySide6TitleBar
from pycore.pyutils.native_ui.pyside6.title_bar_styles import (
    get_default_style,
    get_dark_style,
    get_light_style,
    get_vibrant_style,
    get_minimal_style,
)


class StylesDemoWindow(QMainWindow):
    """样式演示窗口"""

    def __init__(self, style_name="default", style_func=None):
        super().__init__()

        # 无边框窗口
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground, False)

        # 窗口大小
        self.setMinimumSize(800, 600)
        self.resize(900, 650)

        # 设置 UI
        self._setup_ui(style_name, style_func)

    def _setup_ui(self, style_name, style_func):
        """设置用户界面"""
        central = QWidget()
        self.setCentralWidget(central)

        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 创建标题栏（使用指定样式）
        if style_func:
            self.title_bar = PySide6TitleBar(
                app_name=f"样式演示 - {style_name.upper()}",
                show_menu=True,
                styles=style_func()
            )
        else:
            self.title_bar = PySide6TitleBar(
                app_name="样式演示 - DEFAULT",
                show_menu=True
            )

        # 连接信号
        self.title_bar.close_clicked.connect(self.close)
        self.title_bar.minimize_clicked.connect(self.showMinimized)
        self.title_bar.maximize_clicked.connect(self._toggle_maximize)

        main_layout.addWidget(self.title_bar)

        # 内容区域
        content = QWidget()
        content.setStyleSheet("background-color: #ffffff;")

        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(30, 30, 30, 30)

        # 标题
        title = QLabel(f"[*] {style_name.upper()} Style Preview")
        title.setFont(QFont("Microsoft YaHei UI", 20, QFont.Bold))
        title.setStyleSheet("color: #2c3e50; padding: 10px 0;")
        content_layout.addWidget(title)

        # 说明文字
        info = QTextEdit()
        info.setReadOnly(True)
        info.setMaximumHeight(500)

        style_info = {
            "default": """
**默认样式（深色现代风格）**

• 深色渐变背景：#1a1a2e → #16213e → #0f1419
• 白色文字，带阴影效果
• 圆角按钮（8px）
• 关闭按钮红色渐变悬停效果
• 标题栏高度：40px
""",
            "dark": """
**深色主题**

• 与默认样式相同
• 适合暗色界面应用
• 保护眼睛，适合长时间使用
""",
            "light": """
**浅色主题**

• 浅色渐变背景：#f5f5f5 → #e8e8e8 → #d0d0d0
• 深色文字
• 适合明亮环境
• 清爽简洁的视觉效果
""",
            "vibrant": """
**鲜艳主题**

• 紫蓝色渐变背景
• 紫色边框装饰
• 更大的圆角（12px）
• 鲜艳的视觉冲击力
• 适合创意类应用
""",
            "minimal": """
**极简主题**

• 纯白背景，无渐变
• 较小的标题栏高度（36px）
• 低调的灰色悬停效果
• 适合专业商务应用
• 注重内容，减少干扰
"""
        }

        info.setMarkdown(style_info.get(style_name, "未知样式"))
        info.setStyleSheet("""
            QTextEdit {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 15px;
                font-family: 'Microsoft YaHei UI', 'Segoe UI';
                font-size: 11pt;
            }
        """)
        content_layout.addWidget(info)

        # 功能说明
        features = QLabel("""
💡 <b>试试这些操作：</b><br>
• 悬停按钮查看效果<br>
• 拖拽标题栏移动窗口<br>
• 双击标题栏最大化<br>
• 点击最小化/最大化/关闭按钮
        """)
        features.setStyleSheet("""
            QLabel {
                background-color: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 15px;
                border-radius: 4px;
                color: #1565c0;
            }
        """)
        content_layout.addWidget(features)

        main_layout.addWidget(content)

    def _toggle_maximize(self):
        """切换最大化"""
        if self.isMaximized():
            self.showNormal()
            self.title_bar.set_maximized(False)
        else:
            self.showMaximized()
            self.title_bar.set_maximized(True)


def main():
    """主函数"""
    app = QApplication(sys.argv)
    app.setFont(QFont("Microsoft YaHei UI", 10))

    # 可以选择不同的样式来演示
    styles = {
        "default": (get_default_style, "默认"),
        "dark": (get_dark_style, "深色"),
        "light": (get_light_style, "浅色"),
        "vibrant": (get_vibrant_style, "鲜艳"),
        "minimal": (get_minimal_style, "极简"),
    }

    # 选择要演示的样式（可以改变这里）
    style_key = "default"  # 改成 "light", "vibrant", "minimal" 等试试

    if len(sys.argv) > 1 and sys.argv[1] in styles:
        style_key = sys.argv[1]

    style_func, style_name = styles[style_key]

    window = StylesDemoWindow(style_key, style_func if style_key != "default" else None)
    window.show()

    print(f"\n[*] Style Demo: {style_name} ({style_key})")
    print(f"[!] Tip: Run 'python {sys.argv[0]} [style_name]' to view other styles")
    print(f"    Available styles: {', '.join(styles.keys())}\n")

    sys.exit(app.exec())


if __name__ == "__main__":
    main()

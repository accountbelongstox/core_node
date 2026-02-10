# -*- coding: utf-8 -*-
"""
WindowAnalyzer 全项目唯一实例，导出前不预创建，通过 get_window_analyzer() 获取；禁止各处自行 new。
"""
from pycore.pyutils.window_analyzer import WindowAnalyzer

_window_analyzer_instance: WindowAnalyzer | None = None


def get_window_analyzer() -> WindowAnalyzer:
    global _window_analyzer_instance
    if _window_analyzer_instance is None:
        _window_analyzer_instance = WindowAnalyzer()
    return _window_analyzer_instance

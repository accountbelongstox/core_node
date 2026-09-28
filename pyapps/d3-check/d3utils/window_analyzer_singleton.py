# -*- coding: utf-8 -*-
"""
WindowAnalyzer: single instance per project; obtain via get_window_analyzer(); do not instantiate elsewhere.
"""
from pycore.pyutils.window.analyzer import WindowAnalyzer

_window_analyzer_instance: WindowAnalyzer | None = None


def get_window_analyzer() -> WindowAnalyzer:
    global _window_analyzer_instance
    if _window_analyzer_instance is None:
        _window_analyzer_instance = WindowAnalyzer()
    return _window_analyzer_instance

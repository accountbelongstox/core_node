#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Root Helper
获取主窗口 root，供 Toplevel 等复用，避免多处创建 tk.Tk() 导致空白“Tk”窗口。
"""

import tkinter as tk
from typing import Optional


def get_app_root() -> Optional[tk.Tk]:
    """
    返回主应用根窗口（若已存在）。
    用于子窗口/弹窗始终挂到主 root 下，避免再建 Tk() 出现空白窗口。
    """
    try:
        from providor.common_imports import ENCYCLOPEDIA
        ui = ENCYCLOPEDIA.get("ui")
        if ui is not None and hasattr(ui, "root"):
            r = getattr(ui, "root", None)
            if r is not None and getattr(r, "winfo_exists", lambda: False)():
                return r
    except Exception:
        pass
    return None

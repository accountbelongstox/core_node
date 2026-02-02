#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application Root Helper
Get main window root for Toplevel reuse; avoid creating multiple tk.Tk() which causes blank Tk windows.
"""

import tkinter as tk
from typing import Optional

from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA


def get_app_root() -> Optional[tk.Tk]:
    """
    Return main application root window if it exists.
    Used so child/popup windows attach to the same root and do not create a new Tk().
    """
    try:
        ui = ENCYCLOPEDIA.get("ui")
        if ui is not None and hasattr(ui, "root"):
            r = getattr(ui, "root", None)
            if r is not None and getattr(r, "winfo_exists", lambda: False)():
                return r
    except Exception:
        pass
    return None

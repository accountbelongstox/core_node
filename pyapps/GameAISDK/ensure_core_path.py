# -*- coding: utf-8 -*-
"""
Ensure core_node (repo root containing pycore) is in sys.path so that
'import pycore' works when running GameAISDK from any working directory.
Call ensure_core_in_sys_path() at the very start of entry-point scripts
before any import of pycore.
"""
import os
import sys


def ensure_core_in_sys_path() -> None:
    """Prepend core_node (directory containing pycore) to sys.path if not already there."""
    if "pycore" in sys.modules:
        return
    # Start from this file: ensure_core_path.py is under pyapps/GameAISDK
    _dir = os.path.dirname(os.path.abspath(__file__))
    while _dir:
        if os.path.isdir(os.path.join(_dir, "pycore")):
            if _dir not in sys.path:
                sys.path.insert(0, _dir)
            return
        _parent = os.path.dirname(_dir)
        if _parent == _dir:
            break
        _dir = _parent

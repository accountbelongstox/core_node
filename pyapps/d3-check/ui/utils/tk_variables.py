#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tk Variable Factory
统一创建 tk.Variable，强制传入 master，避免 "no default root window"。
所有 UI 创建 Variable 时请使用本模块的工厂函数。
"""

import tkinter as tk
from typing import Union, Any

# Type for any Tk widget that can be a variable master (has winfo_toplevel)
TkMaster = Union[tk.Widget, tk.Tk, tk.Toplevel]


def var_bool(master: TkMaster, value: bool = False) -> tk.BooleanVar:
    """Create BooleanVar bound to master (required for correct root)."""
    return tk.BooleanVar(master, value=value)


def var_str(master: TkMaster, value: str = "") -> tk.StringVar:
    """Create StringVar bound to master (required for correct root)."""
    return tk.StringVar(master, value=value)


def var_int(master: TkMaster, value: int = 0) -> tk.IntVar:
    """Create IntVar bound to master (required for correct root)."""
    return tk.IntVar(master, value=value)


def var_double(master: TkMaster, value: float = 0.0) -> tk.DoubleVar:
    """Create DoubleVar bound to master (required for correct root)."""
    return tk.DoubleVar(master, value=value)

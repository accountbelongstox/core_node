# -*- coding: utf-8 -*-
"""
D3Check 项目根路径与 sys.path 注入。
统一在此计算 pyapps/d3-check 根目录，供各模块替换重复的 current_dir/sys.path.insert。
"""

import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def get_project_root() -> Path:
    """返回 pyapps/d3-check 根目录。"""
    return _PROJECT_ROOT


def ensure_d3_check_in_sys_path() -> None:
    """确保 pyapps/d3-check 在 sys.path 最前，可重复调用。"""
    s = str(_PROJECT_ROOT)
    if s not in sys.path:
        sys.path.insert(0, s)

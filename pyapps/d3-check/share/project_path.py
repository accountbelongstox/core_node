# -*- coding: utf-8 -*-
"""
D3Check project root path and sys.path injection.
Single place for pyapps/d3-check root; modules use this instead of repeating current_dir/sys.path.insert.
"""

import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def get_project_root() -> Path:
    """Return pyapps/d3-check root directory."""
    return _PROJECT_ROOT


def ensure_d3_check_in_sys_path() -> None:
    """Ensure pyapps/d3-check is at the front of sys.path; safe to call repeatedly."""
    s = str(_PROJECT_ROOT)
    if s not in sys.path:
        sys.path.insert(0, s)

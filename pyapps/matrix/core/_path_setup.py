"""
Path setup for pyMatrix

This module ensures the project root is in sys.path,
allowing imports to work whether running as module or script.
"""

import sys
from pathlib import Path

# Get project root (3 levels up from this file)
_this_file = Path(__file__).resolve()
_project_root = _this_file.parent.parent.parent

# Add to path if not already there
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

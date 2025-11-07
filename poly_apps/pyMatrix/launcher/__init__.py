"""
pyMatrix Launcher

简易UI启动器，在webview中显示前端
"""

from .webview_launcher import PyMatrixLauncher

# Also export frontend_launcher functions from parent module
import sys
from pathlib import Path
parent_dir = Path(__file__).parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

__all__ = ['PyMatrixLauncher']

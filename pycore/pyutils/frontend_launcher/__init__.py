"""
Frontend Launcher Module

Provides unified frontend compilation and startup for poly_apps

Supports:
- Nuxt (current)
- Vue, React (future)

Usage:
    from pycore.pyutils.frontend_launcher import NuxtLauncher

    launcher = NuxtLauncher(
        app_name='pymatrix',
        port=38007,
        mode='production',
        skip_build=False
    )

    # Compile and start
    launcher.start_and_wait()

    # Get static directory (for production mode)
    static_dir = launcher.get_static_dir()
"""

try:
    from .nuxt_launcher import NuxtLauncher
except ImportError:
    # nuxt_launcher depends on an optional output_capturer helper that is
    # currently absent; isolate it so the rest of the package
    # (UniversalFrontendLauncher, FrontendConfig) stays importable.
    NuxtLauncher = None

from .frontend_config import FrontendConfig
from .universal_launcher import UniversalFrontendLauncher, UniversalFrontendConfig

__all__ = ['NuxtLauncher', 'FrontendConfig', 'UniversalFrontendLauncher', 'UniversalFrontendConfig']

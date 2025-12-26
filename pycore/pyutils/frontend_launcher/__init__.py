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

from .nuxt_launcher import NuxtLauncher
from .frontend_config import FrontendConfig
<<<<<<< HEAD

__all__ = ['NuxtLauncher', 'FrontendConfig']
=======
from .universal_launcher import UniversalFrontendLauncher, UniversalFrontendConfig

__all__ = ['NuxtLauncher', 'FrontendConfig', 'UniversalFrontendLauncher', 'UniversalFrontendConfig']
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798

"""Matrix Controller Package

Controllers for managing matrix application components:
<<<<<<< HEAD
- FrontendCompiler: Compiles Nuxt frontend for production mode
- LauncherBuilder: Builds LauncherConfig for pylauncher
=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
- EventHandlers: THREAD_BUS event handlers

Architecture:
- Single entry point: matrix_main.py
- Single configuration: config.py
<<<<<<< HEAD
- All backend logic handled by shared RPC v2 service (via pylauncher)
- Frontend compiled once before launch (production mode)
- All services managed by pylauncher (no custom service starters)
"""

from pyapps.matrix.controller.frontend_compiler import compile_frontend_if_needed
from pyapps.matrix.controller.launcher_builder import build_matrix_launcher_config
from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers

__all__ = [
    'compile_frontend_if_needed',
    'build_matrix_launcher_config',
=======
- All frontend and RPC v2 logic handled by native_ui
- Matrix only provides event handlers for application-specific logic
"""

from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers

__all__ = [
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    'register_matrix_event_handlers',
]

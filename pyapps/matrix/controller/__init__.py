"""Matrix Controller Package

Controllers for managing matrix application components:
- FrontendController: Manages Nuxt frontend lifecycle
- BackendController: Manages FastAPI backend lifecycle
- MatrixService: Integrates with pylauncher

Note: UI/webview functionality is now handled by pycore.pyutils.native_ui
"""

from pyapps.matrix.controller.frontend_controller import FrontendController
from pyapps.matrix.controller.backend_controller import BackendController
from pyapps.matrix.controller.matrix_service import MatrixService, MatrixServiceConfig

__all__ = [
    'FrontendController',
    'BackendController',
    'MatrixService',
    'MatrixServiceConfig',
]

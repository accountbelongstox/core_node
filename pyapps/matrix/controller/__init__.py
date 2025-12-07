"""Matrix Controller Package

Controllers for managing matrix application components:
- EventHandlers: THREAD_BUS event handlers

Architecture:
- Single entry point: matrix_main.py
- Single configuration: config.py
- All frontend and RPC v2 logic handled by native_ui
- Matrix only provides event handlers for application-specific logic
"""

from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers

__all__ = [
    'register_matrix_event_handlers',
]

"""
PyGVar - Global Variables and Constants

Unified module for all global variables, constants, and cross-session storage:
- System constants (paths, platform info, configuration)
- WebSocket RPC constants
- Global variable manager (cross-session key-value storage)

Usage:
    from pycore.pyfoundations.pygvar import (
        # Constants
        IS_WINDOWS, PROJECT_ROOT, CPU_COUNT,
        # Manager
        GlobalVarManager,
        # WebSocket constants
        WS_RPC_CONSTANTS
    )

    # Use constants
    if IS_WINDOWS:
        print(f"Running on Windows at {PROJECT_ROOT}")

    # Use global variable manager
    gvm = GlobalVarManager()
    gvm.set("my_key", "my_value")
    value = gvm.get("my_key")
"""

# Import all constants (includes MACHINE_ID, get_machine_id)
from pycore.pyfoundations.pygvar.constants import *  # noqa: F401,F403
from pycore.pyfoundations.pygvar.constants import __all__ as _CONSTANTS_ALL

# Import WebSocket RPC constants
from pycore.pyfoundations.pygvar.ws_rpc_constants import WS_RPC_CONSTANTS

# Import global variable manager
from pycore.pyfoundations.pygvar.global_var_manager import (
    GlobalVarManager,
    GLOBAL_VARS_DIR,
    PYTOOLS_TMP_DIR
)

__all__ = [
    # All constants from constants.py
    *_CONSTANTS_ALL,
    # WebSocket constants
    'WS_RPC_CONSTANTS',
    # Global variable manager
    'GlobalVarManager',
    'GLOBAL_VARS_DIR',
    'PYTOOLS_TMP_DIR',
]

__version__ = '2.0.0'

"""
Global KEY Center for React Native Build System
All KEY names are defined here as constants
"""

# ============ Factory Build Keys ============
KEY_FACTORY_BUILD_PATH = "FACTORY_BUILD_PATH"
KEY_FACTORY_BUILD_ENABLED = "FACTORY_BUILD_ENABLED"

# ============ Metro Bundler Keys ============
KEY_METRO_PORT = "METRO_PORT"

# ============ App Switch Keys ============
KEY_APP_SWITCH_STATUS = "APP_SWITCH_STATUS"

# ============ Menu Selection Keys ============
KEY_MENU_SELECTION = "MENU_SELECTION"

# ============ Build State Keys ============
KEY_BUILD_STATE = "BUILD_STATE"

# ============ Error Keys ============
KEY_ERROR = "ERROR"

# ============ Emulator Keys ============
KEY_EMULATOR_PATH = "EMULATOR_PATH"
KEY_EMULATOR_AVD = "EMULATOR_AVD"
KEY_EMULATOR_AVAILABLE = "EMULATOR_AVAILABLE"
KEY_EMULATOR_SCAN_REQUIRED = "EMULATOR_SCAN_REQUIRED"

# ============ Junction/Symlink Keys ============
KEY_JUNCTION_SOURCE = "JUNCTION_SOURCE"
KEY_JUNCTION_TARGET = "JUNCTION_TARGET"
KEY_JUNCTION_REQUIRED = "JUNCTION_REQUIRED"

# ============ pnpm Install Keys ============
KEY_PNPM_INSTALL_REQUIRED = "PNPM_INSTALL_REQUIRED"

# ============ Command Keys ============
def get_command_key(command_type: str) -> str:
    """Get command key for specific command type"""
    return f"CMD_{command_type}"

def get_app_config_key(app_name: str) -> str:
    """Get app config key for specific app"""
    return f"APP_CONFIG_{app_name}"

def get_result_key(result_type: str) -> str:
    """Get result key for specific result type"""
    return f"RESULT_{result_type}"

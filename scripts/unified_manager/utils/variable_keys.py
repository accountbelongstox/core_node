#!/usr/bin/env python3
"""
Centralized Variable Key Management
Unified variable key definitions to prevent scattered string usage
"""


class VariableKeys:
    """Centralized variable key definitions"""

    # System Information Keys
    PLATFORM = "PLATFORM"
    IS_WINDOWS = "IS_WINDOWS"
    IS_LINUX = "IS_LINUX"
    ROOT_DIR = "ROOT_DIR"
    CACHE_DIR = "CACHE_DIR"
    TEMP_DIR = "TEMP_DIR"

    # Application Data Keys
    APP_COUNT = "APP_COUNT"
    APPS_DATA = "APPS_DATA"

    # Platform Features
    ENABLE_SYSTEMD = "ENABLE_SYSTEMD"
    ENABLE_NGINX = "ENABLE_NGINX"
    ENABLE_FIREWALL = "ENABLE_FIREWALL"
    ENABLE_DOMAIN_PROXY = "ENABLE_DOMAIN_PROXY"

    # Status and Communication
    STATUS = "STATUS"
    LAUNCH_COMMAND = "LAUNCH_COMMAND"

    # User Interface State
    CURRENT_INDEX = "CURRENT_INDEX"
    MAX_APP_NAME_WIDTH = "MAX_APP_NAME_WIDTH"

    @staticmethod
    def app_prefix(index: int) -> str:
        """Generate app-specific prefix for given index"""
        return f"APP_{index}_"

    @staticmethod
    def app_name(index: int) -> str:
        """Generate app name key for given index"""
        return f"APP_{index}_NAME"

    @staticmethod
    def app_path(index: int) -> str:
        """Generate app path key for given index"""
        return f"APP_{index}_PATH"

    @staticmethod
    def app_type(index: int) -> str:
        """Generate app type key for given index"""
        return f"APP_{index}_TYPE"

    @staticmethod
    def app_framework(index: int) -> str:
        """Generate app framework key for given index"""
        return f"APP_{index}_FRAMEWORK"

    @staticmethod
    def app_port(index: int) -> str:
        """Generate app port key for given index"""
        return f"APP_{index}_PORT"

    @staticmethod
    def app_command(index: int) -> str:
        """Generate app command key for given index"""
        return f"APP_{index}_COMMAND"

    @staticmethod
    def app_debug(index: int) -> str:
        """Generate app debug key for given index"""
        return f"APP_{index}_DEBUG"


# Status Values
class StatusValues:
    """Predefined status values"""
    SCAN_COMPLETE = "scan_complete"
    COMMAND_READY = "command_ready"
    SELECTION_UPDATED = "selection_updated"
    ERROR_INVALID_INDEX = "error_invalid_index"
    ERROR_INVALID_SCRIPT = "error_invalid_script"


# Export for easy import
__all__ = ['VariableKeys', 'StatusValues']
#!/usr/bin/env python3
"""
Unified Variable System
Combines all variable exchange functionality from gvar and step_data_exchange
"""

import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass

# Make pycore importable so the cache path resolves via the centralized
# system_paths module (matches FlutterGlobalVar.ps1 D:\programing\Users\<user>\.core_node).
_REPO_ROOT = Path(__file__).resolve()
while _REPO_ROOT != _REPO_ROOT.parent and not (_REPO_ROOT / 'pycore').is_dir():
    _REPO_ROOT = _REPO_ROOT.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
from pycore.pyfoundations.system_paths import get_system_cache_dir


@dataclass
class ImageTypeDefinition:
    """Standard definition for image types across build system"""
    type_id: str  # e.g., 'LOGO', 'BACKGROUND', 'IC_LAUNCHER'
    display_name: str  # e.g., 'Application Logo'
    usage_description: str  # Detailed usage description
    name: str  # Unified naming convention e.g., 'logo'
    final_filename: str  # Final output filename e.g., 'logo.png'
    search_patterns: List[str]  # Search patterns for finding files
    priority: int  # Processing priority (lower = higher priority)


@dataclass
class ProcessedImageInfo:
    """
    Unified information about processed images - shared between steps
    Contains all attributes required for the 7 required images:
    LOGO, BACKGROUND, SPLASH, IC_ICON, NOTIFICATION_ICON, TRANSA_LAUNCHER, IC_LAUNCHER
    """
    # Core image identification
    image_type: str  # LOGO, BACKGROUND, SPLASH, IC_ICON, NOTIFICATION_ICON, TRANSA_LAUNCHER, IC_LAUNCHER
    icon_type: str   # Same as image_type for consistency
    filename: str    # File name with extension

    # Path information - Your requested attributes
    original_path: str      # Original Path: Full path to source image
    processed_path: str     # Processed Path: Path after processing/compression (equals original_path if no compression)

    # Size information - Your requested attributes
    original_size: int      # Original Size: File size in bytes of source image
    processed_size: int     # Processed Size: File size in bytes after processing (equals original_size if no compression)

    # Status and source - Your requested attributes
    status: str             # Status: 'found', 'missing', 'fallback', 'processed'
    source: str            # Source: 'EXTERNAL', 'BUILTIN', 'COMMON'

    # Pattern and format information - Your requested attributes
    pattern: str           # Pattern: The regex pattern that matched this file
    format: str           # File extension: .png, .jpg, .webp, etc.

    # Processing configuration
    compression_mode: str = 'original'  # 'compressed' or 'original'

    # Fallback information
    is_fallback: bool = False
    fallback_from: str = ""
    fallback_reason: str = ""

    # Processing metadata
    processing_timestamp: str = ""
    replacement_mode: str = "smart_resize"  # 'smart_resize' or 'original_size'
    target_count: int = 0
    use_intelligent_scaling: bool = True
    backup_originals: bool = True
    quality_setting: int = 95

    # Additional metadata
    dimensions: tuple = (0, 0)  # (width, height)
    directory: str = ""  # Directory where image was found
    priority: int = 0   # Search priority (0=external, 1=builtin, 2=common)


@dataclass
class PlatformTargetInfo:
    """Information about platform-specific targets for replacement"""
    platform: str
    image_type: str
    target_path: str
    target_filename: str
    file_size_bytes: int
    format: str
    dimensions: tuple = (0, 0)  # (width, height)
    classification_score: float = 1.0
    file_hash: str = ""
    last_modified: str = ""
    permissions: str = ""


class UnifiedVariableSystem:
    """
    Unified Variable System that combines:
    - Flutter global variables
    - Cross-process variable exchange (PowerShell compatible)
    - Step data exchange
    - File-based variable storage
    """

    def __init__(self):
        # Initialize paths
        self.script_dir = Path(__file__).parent.parent.parent
        self.project_root = self._find_flutter_project_root()
        self.flutter_bloom_root = self.project_root

        # PowerShell-compatible paths - match FlutterGlobalVar.ps1 configuration
        core_node_base = get_system_cache_dir()
        flutter_build_base = core_node_base / ".flutter_build"

        # File-based variable storage (PowerShell compatible)
        self.temp_dir = flutter_build_base / ".cache" / "flutter_bloom"
        self._ensure_temp_dir()

        # Cross-process exchange directory - match PowerShell $Global:GVAR_EXCHANGE_DIR
        self.gvar_exchange_dir = flutter_build_base / "global_vars"

        # Core constants merged from shared/constants.py
        # Variable names - match PowerShell FlutterGlobalVar.ps1 exactly
        self.KEY_SELECTED_APP = "KEY_SELECTED_APP"
        self.KEY_SELECTED_ACTION = "KEY_SELECTED_ACTION"
        self.KEY_SELECTED_PLATFORM = "KEY_SELECTED_PLATFORM"
        self.KEY_SELECTED_ENTRY_FILE = "KEY_SELECTED_ENTRY_FILE"
        self.KEY_APP_INDEX = "KEY_APP_INDEX"
        self.KEY_DEBUG_PORT = "KEY_DEBUG_PORT"
        self.KEY_SELECTED_COMPILATION_OPTION = "KEY_SELECTED_COMPILATION_OPTION"
        self.KEY_LAST_COMPILATION_MENU_SELECTION = "KEY_LAST_COMPILATION_MENU_SELECTION"
        self.KEY_BUILD_PHASE = "KEY_BUILD_PHASE"
        self.KEY_SCRIPT_PATH = "KEY_SCRIPT_PATH"  # New: for debug script path
        self.KEY_DEBUG_SCRIPT_PATH = "KEY_DEBUG_SCRIPT_PATH"  # New: specific debug script path based on platform

        # Build info keys
        self.KEY_APP_NAME = "KEY_APP_NAME"
        self.KEY_BUILD_ACTION = "KEY_BUILD_ACTION"
        self.KEY_BUILD_PLATFORM = "KEY_BUILD_PLATFORM"

        # App selector cache keys
        self.KEY_APP_ACTION_MODE_PREFIX = "KEY_APP_ACTION_MODE_"
        self.KEY_APP_PLATFORM_MODE_PREFIX = "KEY_APP_PLATFORM_MODE_"
        self.KEY_APP_EMULATOR_MODE_PREFIX = "KEY_APP_EMULATOR_MODE_"
        self.KEY_LAST_SELECTED_APP_INDEX = "KEY_LAST_SELECTED_APP_INDEX"
        self.KEY_CURRENT_ACTIVE_APP = "KEY_CURRENT_ACTIVE_APP"
        self.KEY_CURRENT_ACTIVE_ACTION = "KEY_CURRENT_ACTIVE_ACTION"
        self.KEY_CURRENT_ACTIVE_PLATFORM = "KEY_CURRENT_ACTIVE_PLATFORM"
        self.KEY_SELECTED_EMULATOR = "KEY_SELECTED_EMULATOR"

        # Unified aliases for consistency - these point to the same values as above
        self.KEY_SELECTED_APP_NAME = "KEY_APP_NAME"  # Alias for KEY_APP_NAME for consistency

        # Operation mode keys
        self.KEY_OPERATION_MODE = "OPERATION_MODE"
        self.KEY_OPERATION_CONTEXT_APP = "OPERATION_CONTEXT_APP"
        self.KEY_OPERATION_CONTEXT_PLATFORM = "OPERATION_CONTEXT_PLATFORM"
        self.KEY_OPERATION_CONTEXT_ACTION = "OPERATION_CONTEXT_ACTION"

        # Step data exchange keys
        self.KEY_PROCESSED_IMAGES_JSON = "PROCESSED_IMAGES_JSON"
        self.KEY_PLATFORM_TARGETS_JSON = "PLATFORM_TARGETS_JSON"

        # Compilation option keys
        self.KEY_COMPILATION_OPTION = "KEY_COMPILATION_OPTION"
        self.KEY_COMPILATION_COMMAND = "KEY_COMPILATION_COMMAND"
        self.KEY_BUILD_OUTPUT_DIR = "KEY_BUILD_OUTPUT_DIR"
        self.KEY_APK_OUTPUT_PATH = "KEY_APK_OUTPUT_PATH"
        self.KEY_COMPILATION_PLATFORM = "KEY_COMPILATION_PLATFORM"

        # Additional build information keys
        self.KEY_BUILD_ROOT = "KEY_BUILD_ROOT"
        self.KEY_CLEAN_COMMAND = "KEY_CLEAN_COMMAND"
        self.KEY_BUILD_TIMESTAMP = "KEY_BUILD_TIMESTAMP"
        self.KEY_APK_FILE_NAME = "KEY_APK_FILE_NAME"

        # Script path keys for compilation
        self.KEY_COMMAND = "KEY_COMMAND"
        self.KEY_SCRIPT_PATH = "KEY_SCRIPT_PATH"  # Already defined above, but kept for clarity
        self.KEY_DEBUG_SCRIPT_PATH = "KEY_DEBUG_SCRIPT_PATH"
        self.KEY_CLEAN_SCRIPT_PATH = "KEY_CLEAN_SCRIPT_PATH"
        self.KEY_BUILD_COMMAND = "KEY_BUILD_COMMAND"
        self.KEY_BUILD_SCRIPT_PATH = "KEY_BUILD_SCRIPT_PATH"

        # Build system constants
        self.TEMP_BUILD_DIR_FILE = "temp_build_dir.txt"

    def _find_flutter_project_root(self) -> Path:
        """Find Flutter project root by looking for pubspec.yaml"""
        current = self.script_dir
        for _ in range(10):  # Max 10 levels up
            if (current / "pubspec.yaml").exists():
                return current
            if current.parent == current:  # Reached filesystem root
                break
            current = current.parent
        # Fallback to script directory
        return self.script_dir

    def _ensure_temp_dir(self):
        """Ensure temp directory exists with conflict handling"""
        try:
            self.temp_dir.mkdir(parents=True, exist_ok=True)
        except (FileExistsError, OSError):
            if self.temp_dir.parent.exists() and not self.temp_dir.parent.is_dir():
                self.temp_dir = self.script_dir / ".cache" / "flutter_bloom"
                self.temp_dir.mkdir(parents=True, exist_ok=True)
            elif not self.temp_dir.exists():
                self.temp_dir = Path(tempfile.gettempdir()) / "flutter_bloom_build"
                self.temp_dir.mkdir(parents=True, exist_ok=True)

    def _ensure_gvar_dir(self):
        """Ensure cross-process exchange directory exists"""
        self.gvar_exchange_dir.mkdir(parents=True, exist_ok=True)

    # File-based variable system (compatible with PowerShell)
    def get_file_variable(self, name: str, default: str = "") -> str:
        """Get variable from file (PowerShell compatible)"""
        # Only use PowerShell global_vars directory
        ps_var_file = self.gvar_exchange_dir / name
        try:
            if ps_var_file.exists():
                return ps_var_file.read_text(encoding='utf-8').strip()
        except Exception:
            pass
        return default

    def set_file_variable(self, name: str, value: str) -> bool:
        """Set variable to file (PowerShell compatible)"""
        try:
            # Only use PowerShell global_vars directory
            self._ensure_gvar_dir()
            ps_var_file = self.gvar_exchange_dir / name
            ps_var_file.write_text(str(value), encoding='utf-8')
            return True
        except Exception:
            return False


# Global instance
unified_vars = UnifiedVariableSystem()
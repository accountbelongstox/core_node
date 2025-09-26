#!/usr/bin/env python3
"""
Unified Variable System
Combines all variable exchange functionality from gvar and step_data_exchange
"""

import json
import os
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from datetime import datetime


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
        core_node_base = Path.home() / ".core_node"
        flutter_build_base = core_node_base / ".flutter_build"

        # File-based variable storage (PowerShell compatible)
        self.temp_dir = flutter_build_base / ".cache" / "flutter_bloom"
        self._ensure_temp_dir()

        # Cross-process exchange directory - match PowerShell $Global:GVAR_EXCHANGE_DIR
        self.gvar_exchange_dir = flutter_build_base / "global_vars"
        self.gvar_exchange_file = self.gvar_exchange_dir / "variables.txt"
        self.gvar_lock_file = self.gvar_exchange_dir / "gvar.lock"

        # Constants
        self.KEY_SELECTED_APP = "SELECTED_APP"
        self.KEY_SELECTED_ACTION = "SELECTED_ACTION"
        self.KEY_SELECTED_PLATFORM = "SELECTED_PLATFORM"
        self.KEY_SELECTED_ENTRY_FILE = "SELECTED_ENTRY_FILE"
        self.KEY_APP_INDEX = "APP_INDEX"
        self.KEY_DEBUG_PORT = "DEBUG_PORT"
        self.KEY_SELECTED_COMPILATION_OPTION = "SELECTED_COMPILATION_OPTION"
        self.KEY_BUILD_PHASE = "BUILD_PHASE"
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

    def _wait_for_lock(self, timeout: int = 30):
        """Wait for lock to be released"""
        elapsed = 0
        while self.gvar_lock_file.exists() and elapsed < timeout:
            time.sleep(0.1)
            elapsed += 0.1
        if elapsed >= timeout:
            raise Exception("Variable exchange lock timeout exceeded")

    def _set_lock(self):
        """Create lock file"""
        self._ensure_gvar_dir()
        self.gvar_lock_file.touch()

    def _release_lock(self):
        """Release lock file"""
        if self.gvar_lock_file.exists():
            self.gvar_lock_file.unlink()

    # File-based variable system (compatible with PowerShell)
    def get_file_variable(self, name: str, default: str = "") -> str:
        """Get variable from file (PowerShell compatible)"""
        # First try PowerShell global_vars directory (where PowerShell sets variables)
        ps_var_file = self.gvar_exchange_dir / name
        try:
            if ps_var_file.exists():
                return ps_var_file.read_text(encoding='utf-8').strip()
        except Exception:
            pass

        # Fallback to cache directory for Python-only variables
        var_file = self.temp_dir / f"{name}.txt"
        try:
            if var_file.exists():
                return var_file.read_text(encoding='utf-8').strip()
        except Exception:
            pass
        return default

    def set_file_variable(self, name: str, value: str) -> bool:
        """Set variable to file (PowerShell compatible)"""
        try:
            # Set in both locations for maximum compatibility
            # PowerShell global_vars directory (for PowerShell to read)
            self._ensure_gvar_dir()
            ps_var_file = self.gvar_exchange_dir / name
            ps_var_file.write_text(str(value), encoding='utf-8')

            # Cache directory (for Python consistency)
            var_file = self.temp_dir / f"{name}.txt"
            var_file.write_text(str(value), encoding='utf-8')
            return True
        except Exception:
            return False

    def get_build_info(self) -> Dict[str, str]:
        """Get build configuration information"""
        return {
            "app_name": self.get_file_variable("KEY_APP_NAME"),
            "action": self.get_file_variable("KEY_BUILD_ACTION"),
            "platform": self.get_file_variable("KEY_BUILD_PLATFORM"),
            "entry_file": self.get_file_variable(self.KEY_SELECTED_ENTRY_FILE),
            "app_index": self.get_file_variable("KEY_APP_INDEX"),
            "debug_port": self.get_file_variable(self.KEY_DEBUG_PORT),
            "compilation_option": self.get_file_variable(self.KEY_SELECTED_COMPILATION_OPTION),
            "build_phase": self.get_file_variable(self.KEY_BUILD_PHASE)
        }

    # Cross-process variable exchange (PowerShell compatible)
    def set_cross_process_variable(self, name: str, value: str) -> bool:
        """Set variable for cross-process exchange"""
        try:
            self._wait_for_lock()
            self._set_lock()

            self._ensure_gvar_dir()
            variables = {}

            if self.gvar_exchange_file.exists():
                try:
                    content = self.gvar_exchange_file.read_text(encoding='utf-8')
                    for line in content.strip().split('\n'):
                        if '=' in line:
                            k, v = line.split('=', 1)
                            variables[k] = v
                except Exception:
                    pass

            variables[name] = str(value)

            # Write back
            content = '\n'.join(f"{k}={v}" for k, v in variables.items())
            self.gvar_exchange_file.write_text(content, encoding='utf-8')

            self._release_lock()
            return True
        except Exception:
            self._release_lock()
            return False

    def get_cross_process_variable(self, name: str, default: str = "") -> str:
        """Get variable from cross-process exchange"""
        try:
            self._wait_for_lock()

            if not self.gvar_exchange_file.exists():
                return default

            content = self.gvar_exchange_file.read_text(encoding='utf-8')
            for line in content.strip().split('\n'):
                if '=' in line:
                    k, v = line.split('=', 1)
                    if k == name:
                        return v
        except Exception:
            pass
        return default

    # Step data exchange system
    def save_processed_images(self, processed_images: Dict[str, ProcessedImageInfo]) -> Dict[str, Any]:
        """Save processed images data"""
        try:
            data = {
                "timestamp": datetime.now().isoformat(),
                "step": 2,
                "processed_images": {
                    image_type: asdict(image_info)
                    for image_type, image_info in processed_images.items()
                }
            }

            processed_file = self.temp_dir / "global_vars" / "PROCESSED_IMAGES_JSON"
            processed_file.parent.mkdir(parents=True, exist_ok=True)

            with open(processed_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            return {"success": True, "file": str(processed_file)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def load_processed_images(self) -> Dict[str, ProcessedImageInfo]:
        """Load processed images data"""
        try:
            processed_file = self.temp_dir / "global_vars" / "PROCESSED_IMAGES_JSON"

            if not processed_file.exists():
                return {}

            with open(processed_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            processed_images = {}
            for image_type, image_data in data.get("processed_images", {}).items():
                processed_images[image_type] = ProcessedImageInfo(**image_data)

            return processed_images
        except Exception:
            return {}

    def save_platform_targets(self, platform_targets: List[PlatformTargetInfo]) -> Dict[str, Any]:
        """Save platform targets data"""
        try:
            # Group by platform
            platforms_data = {}
            for target in platform_targets:
                platform = target.platform
                if platform not in platforms_data:
                    platforms_data[platform] = []
                platforms_data[platform].append(asdict(target))

            data = {
                "timestamp": datetime.now().isoformat(),
                "step": 3,
                "platform_targets": platforms_data
            }

            # Save to file variable
            targets_file = self.temp_dir / "global_vars" / "PLATFORM_TARGETS_JSON"
            targets_file.parent.mkdir(parents=True, exist_ok=True)

            with open(targets_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            # Also set as file variable for PowerShell compatibility
            self.set_file_variable("PLATFORM_TARGETS_JSON", str(targets_file))

            return {
                "success": True,
                "file": str(targets_file),
                "count": len(platform_targets)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def load_platform_targets(self) -> Dict[str, List[PlatformTargetInfo]]:
        """Load platform targets data"""
        try:
            targets_file = self.temp_dir / "global_vars" / "PLATFORM_TARGETS_JSON"

            if not targets_file.exists():
                return {}

            with open(targets_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            platform_targets = {}
            for platform, targets_data in data.get("platform_targets", {}).items():
                platform_targets[platform] = [
                    PlatformTargetInfo(**target_data)
                    for target_data in targets_data
                ]

            return platform_targets
        except Exception:
            return {}


# Global instance
unified_vars = UnifiedVariableSystem()
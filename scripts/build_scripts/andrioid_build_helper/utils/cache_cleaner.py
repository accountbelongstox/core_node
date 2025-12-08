#!/usr/bin/env python3
"""
Cache Cleaner Utility
Handles complex cache cleanup operations and generates PowerShell commands
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional


class CacheCleaner:
    """
    Cache cleaner utility that generates PowerShell commands for cleanup operations
    """
    
    def __init__(self, project_root: str = ""):
        """
        Initialize cache cleaner
        Args:
            project_root: Root directory of the Flutter project
        """
        self.project_root = project_root or os.getcwd()
    
    def detect_corrupted_gradle_cache(self) -> List[str]:
        """
        Detect corrupted Gradle cache files
        Returns:
            List of corrupted cache file paths
        """
        corrupted_files = []
        gradle_cache_dir = Path.home() / ".gradle" / "caches"
        
        if not gradle_cache_dir.exists():
            return corrupted_files
        
        # Common corrupted cache patterns
        corrupted_patterns = [
            "**/metadata.bin",
            "**/groovy-dsl/**/metadata.bin",
            "**/transforms/**/metadata.bin",
            "**/build-cache/**/metadata.bin"
        ]
        
        for pattern in corrupted_patterns:
            for cache_file in gradle_cache_dir.glob(pattern):
                if cache_file.exists():
                    try:
                        # Try to read the file to check if it's corrupted
                        with open(cache_file, 'rb') as f:
                            f.read(1)
                    except (OSError, IOError):
                        corrupted_files.append(str(cache_file))
        
        return corrupted_files
    
    def detect_flutter_cache_issues(self) -> List[str]:
        """
        Detect Flutter cache issues
        Returns:
            List of problematic cache directories
        """
        problematic_dirs = []
        
        # Check Flutter pub cache
        pub_cache_dir = Path.home() / ".pub-cache"
        if pub_cache_dir.exists():
            # Check for common pub cache issues
            for item in pub_cache_dir.iterdir():
                if item.is_dir() and item.name.startswith("hosted"):
                    # Check if directory is accessible
                    try:
                        list(item.iterdir())
                    except (OSError, PermissionError):
                        problematic_dirs.append(str(item))
        
        # Check Flutter build directories
        build_dirs = [
            "build",
            ".dart_tool",
            ".flutter-plugins",
            ".flutter-plugins-dependencies"
        ]
        
        for build_dir in build_dirs:
            build_path = Path(self.project_root) / build_dir
            if build_path.exists():
                try:
                    list(build_path.iterdir())
                except (OSError, PermissionError):
                    problematic_dirs.append(str(build_path))
        
        return problematic_dirs
    
    def get_gradle_cleanup_info(self) -> Dict[str, Any]:
        """
        Get Gradle cleanup information (paths and status)
        Returns:
            Dictionary with cleanup information
        """
        info = {
            "gradle_cache_dir": str(Path.home() / ".gradle" / "caches"),
            "gradle_wrapper_dir": str(Path.home() / ".gradle" / "wrapper"),
            "gradle_daemon_dir": str(Path.home() / ".gradle" / "daemon"),
            "gradle_wrapper_path": str(Path.home() / ".gradle" / "wrapper" / "dists" / "gradle-8.11.1-bin"),
            "corrupted_files": self.detect_corrupted_gradle_cache(),
            "needs_cleanup": False
        }
        
        # Check if cleanup is needed
        if (Path(info["gradle_cache_dir"]).exists() or 
            Path(info["gradle_wrapper_dir"]).exists() or 
            Path(info["gradle_daemon_dir"]).exists() or
            info["corrupted_files"]):
            info["needs_cleanup"] = True
        
        return info
    
    def get_flutter_cleanup_info(self) -> Dict[str, Any]:
        """
        Get Flutter cleanup information (paths and status)
        Returns:
            Dictionary with cleanup information
        """
        info = {
            "build_dirs": ["build", ".dart_tool", ".flutter-plugins", ".flutter-plugins-dependencies"],
            "android_dirs": [".gradle", "build", "app/build"],
            "problematic_dirs": self.detect_flutter_cache_issues(),
            "needs_cleanup": False
        }
        
        # Check if cleanup is needed
        for build_dir in info["build_dirs"]:
            build_path = Path(self.project_root) / build_dir
            if build_path.exists():
                info["needs_cleanup"] = True
                break
        
        for android_dir in info["android_dirs"]:
            android_path = Path(self.project_root) / "android" / android_dir
            if android_path.exists():
                info["needs_cleanup"] = True
                break
        
        if info["problematic_dirs"]:
            info["needs_cleanup"] = True
        
        return info
    
    def get_kotlin_fix_info(self) -> Dict[str, Any]:
        """
        Get Kotlin fix information using KotlinConfigManager
        Returns:
            Dictionary with Kotlin fix information
        """
        from .kotlin_config_manager import KotlinConfigManager
        
        kotlin_manager = KotlinConfigManager(self.project_root)
        config_info = kotlin_manager.get_kotlin_config_info()
        
        info = {
            "gradle_properties_path": config_info["gradle_properties_path"],
            "exists": config_info["exists"],
            "needs_fix": config_info["needs_fix"],
            "missing_properties": config_info["missing_properties"],
            "all_properties": config_info["all_properties"],
            "python_script_path": str(Path(__file__).parent / "kotlin_config_manager.py")
        }
        
        return info
    
    def get_comprehensive_cleanup_info(self) -> Dict[str, Any]:
        """
        Get comprehensive cleanup information
        Returns:
            Dictionary with comprehensive cleanup information
        """
        gradle_info = self.get_gradle_cleanup_info()
        flutter_info = self.get_flutter_cleanup_info()
        kotlin_info = self.get_kotlin_fix_info()
        
        info = {
            "gradle": gradle_info,
            "flutter": flutter_info,
            "kotlin": kotlin_info,
            "needs_comprehensive_cleanup": (
                gradle_info["needs_cleanup"] or 
                flutter_info["needs_cleanup"] or 
                kotlin_info["needs_fix"]
            )
        }
        
        return info
    
    def get_retry_cleanup_info(self, attempt: int) -> Dict[str, Any]:
        """
        Get retry cleanup information
        Args:
            attempt: Retry attempt number
        Returns:
            Dictionary with retry cleanup information
        """
        info = {
            "attempt": attempt,
            "gradle": self.get_gradle_cleanup_info(),
            "flutter": self.get_flutter_cleanup_info(),
            "needs_aggressive_cleanup": True  # Always do aggressive cleanup on retry
        }
        
        return info


def normalize_path(path: str, target_format: str = "flutter") -> str:
    """
    Normalize path format
    Args:
        path: Input path
        target_format: Target format ("windows", "flutter", "auto")
    Returns:
        Normalized path
    """
    if not path or not path.strip():
        return path
    
    path = path.strip()
    
    if target_format == "flutter" or target_format == "auto":
        # Convert to Flutter format (forward slashes)
        path = re.sub(r'\\+', '/', path)
        path = re.sub(r'/+', '/', path)
        # Remove leading single slash
        if path.startswith('/') and not path.startswith('//'):
            path = path[1:]
    elif target_format == "windows":
        # Convert to Windows format (backslashes)
        path = re.sub(r'/+', '\\', path)
        path = re.sub(r'\\+', '\\', path)
        # Remove leading single backslash
        if path.startswith('\\') and not path.startswith('\\\\'):
            path = path[1:]
    
    return path


def adapt_flutter_command(command: str) -> str:
    """
    Adapt Flutter command based on command type
    Args:
        command: Original Flutter command
    Returns:
        Adapted command
    """
    if not command:
        return command
    
    # Commands that don't support -t parameter
    unsupported_commands = ["analyze", "clean", "doctor", "pub", "test", "format", "deps"]
    
    # Extract command name
    parts = command.split()
    if len(parts) >= 2:
        command_name = parts[1].lower()
        
        if command_name in unsupported_commands:
            # Remove -t parameter
            command = re.sub(r' -t [^\s]+', '', command)
        else:
            # Fix paths in -t parameter
            def replace_t_path(match):
                path = match.group(1)
                normalized_path = normalize_path(path, "flutter")
                return f" -t {normalized_path}"
            
            command = re.sub(r' -t ([^\s]+)', replace_t_path, command)
    
    return command


def generate_powershell_helpers() -> str:
    """
    Generate PowerShell helper functions
    Returns:
        PowerShell helper functions as string
    """
    helpers = '''
# Path normalization helper function
function Normalize-Path {
    param(
        [string]$Path,
        [string]$TargetFormat = "flutter",
        [bool]$Debug = $false
    )
    
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $Path
    }
    
    $Path = $Path.Trim()
    
    if ($Debug) {
        Write-Host "[PATH] Input: '$Path'" -ForegroundColor Gray
    }
    
    if ($TargetFormat -eq "flutter" -or $TargetFormat -eq "auto") {
        $Path = $Path -replace "\\\\+", "/"
        $Path = $Path -replace "\\", "/"
        $Path = $Path -replace "/+", "/"
    }
    elseif ($TargetFormat -eq "windows") {
        $Path = $Path -replace "/+", "\\"
        $Path = $Path -replace "/", "\\"
        $Path = $Path -replace "\\+", "\\"
    }
    
    if ($Path.StartsWith("/") -and -not $Path.StartsWith("//")) {
        $Path = $Path.Substring(1)
    }
    if ($Path.StartsWith("\\") -and -not $Path.StartsWith("\\\\")) {
        $Path = $Path.Substring(1)
    }
    
    if ($Debug) {
        Write-Host "[PATH] Output: '$Path'" -ForegroundColor Gray
    }
    
    return $Path
}

# Flutter command path fix helper function
function Fix-FlutterCommandPath {
    param(
        [string]$Command,
        [bool]$Debug = $false
    )
    
    if ([string]::IsNullOrWhiteSpace($Command)) {
        return $Command
    }
    
    if ($Debug) {
        Write-Host "[CMD] Original: '$Command'" -ForegroundColor Gray
    }
    
    $Command = $Command -replace " -t ([^\\s]+)", {
        $path = $matches[1]
        $normalizedPath = Normalize-Path -Path $path -TargetFormat "flutter" -Debug $Debug
        " -t $normalizedPath"
    }
    
    if ($Debug) {
        Write-Host "[CMD] Fixed: '$Command'" -ForegroundColor Gray
    }
    
    return $Command
}
'''
    return helpers.strip()

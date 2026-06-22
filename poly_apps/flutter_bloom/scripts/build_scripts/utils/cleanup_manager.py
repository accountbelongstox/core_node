#!/usr/bin/env python3
"""
Cleanup Manager
Handles all complex cleanup operations and path management
"""

import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional


class CleanupManager:
    """
    Manages all cleanup operations for Flutter projects
    """
    
    def __init__(self, project_root: str = ""):
        """
        Initialize cleanup manager
        Args:
            project_root: Root directory of the Flutter project
        """
        self.project_root = project_root or os.getcwd()
    
    def normalize_path(self, path: str, target_format: str = "windows") -> str:
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
            path = re.sub(r'/+', r'\\', path)
            path = re.sub(r'\\+', r'\\', path)
            # Remove leading single backslash
            if path.startswith('\\') and not path.startswith('\\\\'):
                path = path[1:]
        
        return path
    
    def get_gradle_paths(self) -> Dict[str, str]:
        """
        Get all Gradle-related paths
        Returns:
            Dictionary with Gradle paths
        """
        user_home = Path.home()
        
        paths = {
            "gradle_cache_dir": str(user_home / ".gradle" / "caches"),
            "gradle_wrapper_dir": str(user_home / ".gradle" / "wrapper"),
            "gradle_daemon_dir": str(user_home / ".gradle" / "daemon"),
            "gradle_wrapper_path": str(user_home / ".gradle" / "wrapper" / "dists" / "gradle-8.11.1-bin"),
            "gradle_bin_path": str(user_home / ".gradle" / "wrapper" / "dists" / "gradle-8.11.1-bin" / "*" / "gradle-8.11.1" / "bin" / "gradle.bat")
        }
        
        # Normalize all paths to Windows format
        for key, path in paths.items():
            paths[key] = self.normalize_path(path, "windows")
        
        return paths
    
    def get_flutter_paths(self) -> Dict[str, List[str]]:
        """
        Get all Flutter-related paths
        Returns:
            Dictionary with Flutter paths
        """
        paths = {
            "build_dirs": [
                "build",
                ".dart_tool",
                ".flutter-plugins",
                ".flutter-plugins-dependencies"
            ],
            "android_dirs": [
                ".gradle",
                "build",
                "app/build"
            ],
            "apk_search_paths": [
                "build/app/outputs/flutter-apk",
                "build/app/outputs/apk/release",
                "build/app/outputs/apk/debug"
            ]
        }
        
        return paths
    
    def check_path_exists(self, path: str) -> bool:
        """
        Check if path exists
        Args:
            path: Path to check
        Returns:
            True if path exists
        """
        try:
            return Path(path).exists()
        except (OSError, ValueError):
            return False
    
    def get_cleanup_paths(self, cleanup_type: str = "comprehensive") -> Dict[str, List[str]]:
        """
        Get cleanup paths based on type (no command execution)
        Args:
            cleanup_type: Type of cleanup ("comprehensive", "retry", "gradle", "flutter")
        Returns:
            Dictionary with cleanup paths
        """
        gradle_paths = self.get_gradle_paths()
        flutter_paths = self.get_flutter_paths()
        
        cleanup_paths = {
            "gradle_paths": [],
            "flutter_paths": [],
            "android_paths": [],
            "gradle_bin_path": gradle_paths["gradle_bin_path"]
        }
        
        if cleanup_type in ["comprehensive", "gradle"]:
            cleanup_paths["gradle_paths"] = [
                gradle_paths["gradle_cache_dir"],
                gradle_paths["gradle_wrapper_dir"],
                gradle_paths["gradle_daemon_dir"]
            ]
        
        if cleanup_type in ["comprehensive", "flutter"]:
            cleanup_paths["flutter_paths"] = flutter_paths["build_dirs"]
            cleanup_paths["android_paths"] = flutter_paths["android_dirs"]
        
        if cleanup_type == "retry":
            # More aggressive cleanup for retries
            cleanup_paths["flutter_paths"] = ["build", ".dart_tool"]
            cleanup_paths["android_paths"] = [".gradle", "build", "app/build"]
            cleanup_paths["gradle_paths"] = [gradle_paths["gradle_cache_dir"]]
        
        return cleanup_paths
    
    def get_apk_search_paths(self) -> List[str]:
        """
        Get APK search paths (no command execution)
        Returns:
            List of APK search paths
        """
        flutter_paths = self.get_flutter_paths()
        apk_paths = []
        
        for apk_path in flutter_paths["apk_search_paths"]:
            normalized_path = self.normalize_path(apk_path, "windows")
            apk_paths.append(normalized_path)
        
        return apk_paths
    
    def get_cleanup_info(self) -> Dict[str, Any]:
        """
        Get comprehensive cleanup information (paths only, no commands)
        Returns:
            Dictionary with cleanup information
        """
        gradle_paths = self.get_gradle_paths()
        flutter_paths = self.get_flutter_paths()
        
        info = {
            "gradle_paths": gradle_paths,
            "flutter_paths": flutter_paths,
            "comprehensive_cleanup_paths": self.get_cleanup_paths("comprehensive"),
            "retry_cleanup_paths": self.get_cleanup_paths("retry"),
            "apk_search_paths": self.get_apk_search_paths(),
            "project_root": self.project_root
        }
        
        return info


def main():
    """
    Main function for command line usage
    """
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python cleanup_manager.py <command> [project_root]")
        print("Commands: info, cleanup <type>")
        sys.exit(1)
    
    command = sys.argv[1]
    project_root = sys.argv[2] if len(sys.argv) > 2 else "."
    
    manager = CleanupManager(project_root)
    
    if command == "info":
        info = manager.get_cleanup_info()
        print(f"CLEANUP_INFO={json.dumps(info)}")
    
    elif command == "cleanup":
        cleanup_type = sys.argv[3] if len(sys.argv) > 3 else "comprehensive"
        paths = manager.get_cleanup_paths(cleanup_type)
        print(f"CLEANUP_PATHS={json.dumps(paths)}")
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()

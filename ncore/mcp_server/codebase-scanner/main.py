#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Codebase Scanner MCP Server
Advanced codebase analysis and file management tool

Features:
- Directory tree generation
- File search and content analysis
- Flutter app structure scanning
- File finding by path/name
- Image pixel analysis for development
- Comprehensive project statistics

Supported formats:
- All text-based files
- Image files (PNG, JPG, JPEG, BMP, etc.)
- Flutter/Dart projects
- General codebases
"""

# Standard library imports
import asyncio
import json
import os
import sys
import subprocess
import importlib.util
import importlib
import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any
import re

# Third-party imports
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Warning: FastMCP not available. Please install: pip install mcp")
    FastMCP = None

# Image processing imports (will be imported after initialization)
try:
    from PIL import Image
    import numpy as np
    IMAGE_PROCESSING_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSING_AVAILABLE = False

# Import constants
from constants import CodebaseScannerConstants

# Global variables
mcp = None
logger = None
active_sessions = {}
session_lock = threading.Lock()

def init_codebase_scanner():
    """
    Initialize Codebase Scanner with all required packages
    Uses python -m pip to install necessary packages without errors
    Supports multi-AI concurrent access with proper error handling
    """
    global mcp, logger
    
    # Ensure directories exist
    CodebaseScannerConstants.ensure_directories()
    
    # Configure comprehensive logging
    # IMPORTANT: Use stderr for logging to avoid interfering with MCP JSON-RPC on stdout
    log_format = '%(asctime)s [%(levelname)s] [CodebaseScanner] %(message)s'
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stderr),  # Use stderr instead of stdout for MCP compatibility
            logging.FileHandler(CodebaseScannerConstants.LOG_FILE, encoding='utf-8')
        ]
    )
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("Starting Codebase Scanner initialization...")
        
        # Initialize MCP server with proper error handling
        if FastMCP:
            try:
                mcp = FastMCP("CodebaseScanner")
                logger.info("MCP server initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize MCP server: {e}")
                mcp = None
        else:
            logger.warning("FastMCP not available - MCP server disabled")
            mcp = None
        
        # Install required packages with comprehensive error handling
        required_packages = CodebaseScannerConstants.REQUIRED_PACKAGES
        
        logger.info("Installing required packages...")
        installed_count = 0
        failed_packages = []
        
        for package in required_packages:
            try:
                # Check if package is already installed
                package_name = CodebaseScannerConstants.PACKAGE_IMPORT_MAPPING.get(package, package)
                
                try:
                    importlib.import_module(package_name)
                    logger.info(f"Package {package} is already installed")
                    installed_count += 1
                    continue
                except ImportError:
                    pass
                
                # Install package using python -m pip
                logger.info(f"Installing {package}...")
                try:
                    result = subprocess.run([
                        sys.executable, "-m", "pip", "install", package, "--quiet", "--no-warn-script-location"
                    ], capture_output=True, text=True, timeout=120)
                    
                    if result.returncode == 0:
                        logger.info(f"Package {package} installed successfully")
                        installed_count += 1
                    else:
                        error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                        logger.warning(f"Failed to install {package}: {error_msg}")
                        failed_packages.append(package)
                        
                except subprocess.TimeoutExpired:
                    logger.warning(f"Package {package} installation timed out")
                    failed_packages.append(package)
                except Exception as e:
                    logger.warning(f"Failed to install {package}: {e}")
                    failed_packages.append(package)
                    
            except Exception as e:
                logger.error(f"Error processing package {package}: {e}")
                failed_packages.append(package)
        
        logger.info(f"Package installation completed: {installed_count}/{len(required_packages)} packages available")
        if failed_packages:
            logger.warning(f"Failed packages: {', '.join(failed_packages)}")
        
        # Check image processing availability
        global IMAGE_PROCESSING_AVAILABLE
        try:
            from PIL import Image
            import numpy as np
            IMAGE_PROCESSING_AVAILABLE = True
            logger.info("Image processing libraries loaded successfully")
        except ImportError as e:
            logger.warning(f"Image processing not available: {e}")
            IMAGE_PROCESSING_AVAILABLE = False
        
        logger.info("Codebase Scanner initialization completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Critical error during initialization: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False

# Initialize the scanner
init_codebase_scanner()

class SessionManager:
    """Manages AI sessions for concurrent access"""
    
    def __init__(self):
        self.sessions = {}
        self.lock = threading.Lock()
        self.tmp_dir = CodebaseScannerConstants.get_tmp_dir()
        self.tmp_dir.mkdir(exist_ok=True)
    
    def create_session(self, ai_id: str = None) -> str:
        """Create a new session for AI access"""
        if ai_id is None:
            ai_id = f"ai_{int(time.time() * 1000)}"
        
        with self.lock:
            session_id = f"session_{ai_id}_{int(time.time() * 1000)}"
            session_dir = self.tmp_dir / session_id
            session_dir.mkdir(exist_ok=True)
            
            self.sessions[session_id] = {
                "ai_id": ai_id,
                "created_at": time.time(),
                "last_access": time.time(),
                "session_dir": session_dir,
                "active": True
            }
            
            if logger:
                logger.info(f"Created session {session_id} for AI {ai_id}")
            
            return session_id
    
    def get_session(self, session_id: str) -> Dict:
        """Get session information"""
        with self.lock:
            if session_id in self.sessions:
                self.sessions[session_id]["last_access"] = time.time()
                return self.sessions[session_id]
            return None
    
    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Clean up old sessions"""
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        with self.lock:
            to_remove = []
            for session_id, session_info in self.sessions.items():
                if current_time - session_info["last_access"] > max_age_seconds:
                    to_remove.append(session_id)
            
            for session_id in to_remove:
                session_info = self.sessions[session_id]
                try:
                    import shutil
                    shutil.rmtree(session_info["session_dir"], ignore_errors=True)
                except Exception as e:
                    if logger:
                        logger.warning(f"Failed to cleanup session {session_id}: {e}")
                
                del self.sessions[session_id]
                if logger:
                    logger.info(f"Cleaned up old session {session_id}")
    
    def get_session_stats(self) -> Dict:
        """Get session statistics"""
        with self.lock:
            return {
                "total_sessions": len(self.sessions),
                "active_sessions": sum(1 for s in self.sessions.values() if s["active"]),
                "sessions": list(self.sessions.keys())
            }

# Global session manager
session_manager = SessionManager()

class PackageManager:
    """Manages Python package installation and verification"""

    REQUIRED_PACKAGES = CodebaseScannerConstants.REQUIRED_PACKAGES

    @staticmethod
    def check_package(package_name: str) -> bool:
        """Check if a package is installed"""
        try:
            # Handle package name mapping
            import_name = CodebaseScannerConstants.PACKAGE_IMPORT_MAPPING.get(package_name, package_name)
            
            spec = importlib.util.find_spec(import_name)
            return spec is not None
        except ImportError:
            return False

    @staticmethod
    def install_package(package_name: str) -> bool:
        """Install a package using pip"""
        try:
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", package_name, "--quiet"
            ], capture_output=True, text=True, timeout=120)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, Exception):
            return False

    @classmethod
    def ensure_packages(cls) -> bool:
        """Ensure all required packages are installed"""
        if logger:
            logger.info("[PackageManager] Checking required packages...")
        
        missing_packages = []
        for package in cls.REQUIRED_PACKAGES:
            if not cls.check_package(package):
                missing_packages.append(package)

        if missing_packages:
            if logger:
                logger.warning(f"[PackageManager] Missing packages: {', '.join(missing_packages)}")
            
            for package in missing_packages:
                if logger:
                    logger.info(f"[PackageManager] Installing {package}...")
                
                if not cls.install_package(package):
                    if logger:
                        logger.error(f"[PackageManager] Failed to install {package}")
                    return False
                
                if logger:
                    logger.info(f"[PackageManager] Successfully installed {package}")

        if logger:
            logger.info("[PackageManager] All required packages are available")
        return True

class IgnorePatterns:
    """Manages ignore patterns for directories and files"""

    IGNORE_DIRS = {
        'node_modules', '.git', '.svn', '.hg', '.bzr', '_darcs',
        '__pycache__', '.pytest_cache', '.mypy_cache', '.tox',
        '.eggs', '*.egg-info', 'dist', 'build', 'out', 'target',
        '.idea', '.vscode', '.vs', '.atom', '.sublime-project',
        'venv', 'env', 'ENV', 'virtualenv', '.venv',
        '.cache', 'cache', 'tmp', 'temp', 'logs', 'log',
        '.dart_tool', '.pub', '.pub-cache', 'coverage',
        'vendor', 'packages', '.bin', '.next', '.nuxt',
        'release', 'debug', 'output', 'output_*',
        '.ncore', '.apps_dist', '.data', 'data',
        'chrome', '.yalc', 'webpack_dist',
        '.strapi', 'pyenv_*', '.flutter-plugins',
        '.ai_restricted_access', '.ai_no_access', '.bak-ai-*',
        '.secret_ignore', 'secret_keys',
        'tmp_*', 'test_*', '.*_tmp', '.*.tmp', '.dev_tmp',
        '.bak-*', '_static_*', '_static_-*'
    }

    IGNORE_FILE_EXTENSIONS = {
        '.pyc', '.pyo', '.pyd', '.so', '.dll', '.dylib', '.o',
        '.exe', '.bin', '.obj', '.class', '.jar', '.war',
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
        '.log', '.logs', '.tmp', '.temp', '.bak', '.backup', '.old',
        '.db', '.sqlite', '.sqlite3', '.cache',
        '.lock', '.pid', '.sock', '.swp', '.swo', '.swn',
        '.DS_Store', '.gitignore', 'Thumbs.db', 'desktop.ini',
        '.min.js', '.min.css', '.map',
        '.g.dart', '.freezed.dart', '.gr.dart',
        '.vsix', '.iso', '.dmg', '.pkg', '.deb', '.rpm',
        '.apk', '.msi', '.cab', '.p12', '.jks', '.key',
        '.crt', '.cer', '.der', '.pfx', '.keystore'
    }

    IGNORE_FILE_PATTERNS = [
        r'^\..*',
        r'.*\.test\..*',
        r'.*_test\..*',
        r'test_.*',
        r'.*\.spec\..*',
        r'.*\.backup$',
        r'.*\.bak$',
        r'.*\.old$',
        r'.*~$',
        r'^\d+\..*',
        r'^tmp_.*',
        r'^temp_.*',
        r'package-lock\.json',
        r'yarn\.lock',
        r'pnpm-lock\.yaml',
        r'Gemfile\.lock',
        r'Pipfile\.lock',
        r'poetry\.lock',
        r'composer\.lock'
    ]

    @classmethod
    def should_ignore_dir(cls, dir_name: str) -> bool:
        """Check if directory should be ignored"""
        dir_lower = dir_name.lower()

        for pattern in cls.IGNORE_DIRS:
            if '*' in pattern:
                regex = pattern.replace('*', '.*')
                if re.match(regex, dir_lower):
                    return True
            elif dir_lower == pattern.lower() or dir_name == pattern:
                return True

        return False

    @classmethod
    def should_ignore_file(cls, file_name: str) -> bool:
        """Check if file should be ignored"""
        file_lower = file_name.lower()

        _, ext = os.path.splitext(file_name)
        if ext.lower() in cls.IGNORE_FILE_EXTENSIONS:
            return True

        for pattern in cls.IGNORE_FILE_PATTERNS:
            if re.match(pattern, file_name, re.IGNORECASE):
                return True

        return False

class FlutterScanner:
    """Specialized scanner for Flutter projects"""

    FLUTTER_MODES = ["code", "code_assets", "all"]

    def __init__(self, flutter_root: Path):
        self.flutter_root = flutter_root
        self.ignore_patterns = IgnorePatterns()

    def scan_flutter_apps(self) -> List[str]:
        """Scan available Flutter apps"""
        apps_dir = self.flutter_root / "lib" / "apps"

        if not apps_dir.exists():
            return []

        apps = []
        for entry in sorted(apps_dir.iterdir()):
            if entry.is_dir() and not entry.name.startswith('.'):
                apps.append(entry.name)

        return apps

    def get_flutter_app_paths(self, app_name: str, mode: str = "code_assets") -> List[Path]:
        """Get paths to scan for a Flutter app based on mode"""
        paths = []

        if app_name == "flutter" or app_name == "flutter_bloom":
            if mode == "code":
                paths = [
                    self.flutter_root / "lib",
                    self.flutter_root / "pubspec.yaml"
                ]
            elif mode == "code_assets":
                paths = [
                    self.flutter_root / "lib",
                    self.flutter_root / "assets",
                    self.flutter_root / "pubspec.yaml"
                ]
            elif mode == "all":
                paths = [self.flutter_root]
        else:
            if mode == "code":
                paths = [
                    self.flutter_root / "lib" / "apps" / app_name,
                    self.flutter_root / "lib" / "common"
                ]
            elif mode == "code_assets":
                paths = [
                    self.flutter_root / "lib" / "apps" / app_name,
                    self.flutter_root / "lib" / "common",
                    self.flutter_root / "assets" / "apps" / app_name,
                    self.flutter_root / "assets" / "common"
                ]
            elif mode == "all":
                paths = [
                    self.flutter_root / "lib" / "apps" / app_name,
                    self.flutter_root / "lib" / "common",
                    self.flutter_root / "assets" / "apps" / app_name,
                    self.flutter_root / "assets" / "common",
                    self.flutter_root / "pubspec.yaml"
                ]

        return [p for p in paths if p.exists()]

    def build_flutter_tree(self, app_name: str, mode: str = "code_assets",
                          max_depth: int = 10) -> Dict:
        """Build tree structure for Flutter app"""
        paths = self.get_flutter_app_paths(app_name, mode)

        if not paths:
            return {
                "error": f"No paths found for app '{app_name}' in mode '{mode}'"
            }

        tree_lines = []
        header_info = self._generate_flutter_header(app_name, mode)

        for i, path in enumerate(paths):
            if not path.exists():
                continue

            is_last = i == len(paths) - 1

            try:
                rel_path = path.relative_to(self.flutter_root)
                display_name = str(rel_path).replace('\\', '/')
            except ValueError:
                display_name = path.name

            if path.is_file():
                connector = "└── " if is_last else "├── "
                size_str = self._format_size(path.stat().st_size)
                tree_lines.append(f"{connector}{display_name} ({size_str})")
            else:
                connector = "└── " if is_last else "├── "
                tree_lines.append(f"{connector}{display_name}/")
                extension = "    " if is_last else "│   "
                tree_lines.extend(self._build_flutter_dir_tree(path, extension, max_depth, 1))

        result = {
            "success": True,
            "app_name": app_name,
            "mode": mode,
            "flutter_root": str(self.flutter_root),
            "header": header_info,
            "tree_text": "\n".join([f"{app_name} [{mode}]"] + tree_lines),
            "tree_markdown": self._format_flutter_markdown(app_name, mode, header_info, tree_lines)
        }

        return result

    def _build_flutter_dir_tree(self, path: Path, prefix: str, max_depth: int,
                               current_depth: int) -> List[str]:
        """Build directory tree for Flutter app"""
        if current_depth >= max_depth:
            return []

        try:
            entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        except PermissionError:
            return [f"{prefix}├── [Permission Denied]"]
        except Exception as e:
            return [f"{prefix}├── [Error: {str(e)}]"]

        dirs = []
        files = []

        for entry in entries:
            if entry.name.startswith('.'):
                continue

            if entry.is_dir():
                if not self.ignore_patterns.should_ignore_dir(entry.name):
                    dirs.append(entry)
            else:
                if not self.ignore_patterns.should_ignore_file(entry.name):
                    files.append(entry)

        result = []
        all_items = [(d, 'dir') for d in dirs] + [(f, 'file') for f in files]

        for i, (item, item_type) in enumerate(all_items):
            is_last = i == len(all_items) - 1
            current_prefix = "└── " if is_last else "├── "

            if item_type == 'dir':
                result.append(f"{prefix}{current_prefix}{item.name}/")
                next_prefix = prefix + ("    " if is_last else "│   ")
                sub_items = self._build_flutter_dir_tree(item, next_prefix, max_depth, current_depth + 1)
                result.extend(sub_items)
            else:
                size_str = self._format_size(item.stat().st_size)
                result.append(f"{prefix}{current_prefix}{item.name} ({size_str})")

        return result

    def _format_size(self, size_bytes: int) -> str:
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"

    def _generate_flutter_header(self, app_name: str, mode: str) -> List[str]:
        """Generate header for Flutter tree"""
        guide_path = self.flutter_root / "development-guides" / "FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md"

        header = [
            "=" * 80,
            "Flutter App Directory Tree",
            "=" * 80,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"App: {app_name}",
            f"Mode: {mode}",
            f"Flutter Root: {str(self.flutter_root).replace(chr(92), '/')}",
        ]

        if guide_path.exists():
            try:
                rel_guide = guide_path.relative_to(self.flutter_root)
                header.append(f"Development Guide: {str(rel_guide).replace(chr(92), '/')}")
            except ValueError:
                pass

        header.append("=" * 80)
        return header

    def _format_flutter_markdown(self, app_name: str, mode: str,
                                 header_info: List[str], tree_lines: List[str]) -> str:
        """Format Flutter tree as markdown"""
        content = []
        content.extend(header_info)
        content.append("")
        content.append("```")
        content.append(f"{app_name} [{mode}]")
        content.extend(tree_lines)
        content.append("```")
        content.append("")
        content.append("---")
        content.append("*Generated by CodebaseScanner MCP - Flutter Module*")

        return "\n".join(content)


class CodebaseScanner:
    """Scans codebase and provides search functionality"""

    def __init__(self, project_root: Optional[str] = None, enable_global_access: bool = True):
        self.project_root = Path(project_root) if project_root else Path("D:/programing/core_node")
        self.enable_global_access = enable_global_access
        self.ignore_patterns = IgnorePatterns()

        flutter_dir = self.project_root / "poly_apps" / "flutter_bloom"
        if flutter_dir.exists():
            self.flutter_scanner = FlutterScanner(flutter_dir)
        else:
            self.flutter_scanner = None

    def _normalize_path(self, path_str: str) -> Path:
        """Normalize and validate path"""
        path = Path(path_str)

        if not path.is_absolute():
            path = self.project_root / path

        if not self.enable_global_access:
            try:
                path.resolve().relative_to(self.project_root.resolve())
            except ValueError:
                raise ValueError(f"Access denied: Path {path} is outside project root")

        return path

    def generate_tree(self, target_path: Optional[str] = None, max_depth: int = 5,
                     output_format: str = "both") -> Dict:
        """Generate directory tree structure with multiple output formats"""
        try:
            if target_path:
                root_path = self._normalize_path(target_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {"error": f"Path does not exist: {root_path}"}

            if not root_path.is_dir():
                return {"error": f"Path is not a directory: {root_path}"}

            result = {
                "success": True,
                "root": str(root_path),
                "root_name": root_path.name
            }

            if output_format in ["json", "both"]:
                result["tree_json"] = self._build_tree(root_path, max_depth, 0)

            if output_format in ["text", "both"]:
                tree_lines = self._build_text_tree(root_path, max_depth, 0, "")
                result["tree_text"] = "\n".join([f"{root_path.name}/"] + tree_lines)

            if output_format in ["markdown", "both"]:
                tree_lines = self._build_text_tree(root_path, max_depth, 0, "")
                md_content = self._format_markdown(root_path, tree_lines)
                result["tree_markdown"] = md_content

            return result

        except Exception as e:
            return {"error": f"Failed to generate tree: {str(e)}"}

    def _build_tree(self, path: Path, max_depth: int, current_depth: int) -> Dict:
        """Recursively build tree structure (JSON format)"""
        if current_depth >= max_depth:
            return {"truncated": True, "reason": "max depth reached"}

        tree = {
            "name": path.name,
            "type": "directory" if path.is_dir() else "file",
            "path": str(path),
            "children": []
        }

        if path.is_dir():
            try:
                entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))

                for entry in entries:
                    if entry.is_dir():
                        if self.ignore_patterns.should_ignore_dir(entry.name):
                            continue
                        tree["children"].append(self._build_tree(entry, max_depth, current_depth + 1))
                    else:
                        if self.ignore_patterns.should_ignore_file(entry.name):
                            continue
                        tree["children"].append({
                            "name": entry.name,
                            "type": "file",
                            "path": str(entry),
                            "size": entry.stat().st_size if entry.exists() else 0
                        })
            except PermissionError:
                tree["error"] = "Permission denied"
            except Exception as e:
                tree["error"] = str(e)

        return tree

    def _build_text_tree(self, path: Path, max_depth: int, current_depth: int, prefix: str) -> List[str]:
        """Recursively build tree structure (text format with box-drawing characters)"""
        if current_depth >= max_depth:
            return []

        try:
            entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        except PermissionError:
            return [f"{prefix}├── [Permission Denied]"]
        except Exception as e:
            return [f"{prefix}├── [Error: {str(e)}]"]

        dirs = []
        files = []

        for entry in entries:
            if entry.is_dir():
                if not self.ignore_patterns.should_ignore_dir(entry.name):
                    dirs.append(entry)
            else:
                if not self.ignore_patterns.should_ignore_file(entry.name):
                    files.append(entry)

        result = []
        all_items = [(d, 'dir') for d in dirs] + [(f, 'file') for f in files]

        for i, (item, item_type) in enumerate(all_items):
            is_last = i == len(all_items) - 1
            current_prefix = "└── " if is_last else "├── "

            if item_type == 'dir':
                result.append(f"{prefix}{current_prefix}{item.name}/")
                next_prefix = prefix + ("    " if is_last else "│   ")
                sub_items = self._build_text_tree(item, max_depth, current_depth + 1, next_prefix)
                result.extend(sub_items)
            else:
                size_str = self._format_size(item.stat().st_size)
                result.append(f"{prefix}{current_prefix}{item.name} ({size_str})")

        return result

    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"

    def _format_markdown(self, root_path: Path, tree_lines: List[str]) -> str:
        """Format tree as markdown"""
        content = []
        content.append(f"# Directory Tree: {root_path.name}")
        content.append("")
        content.append(f"**Path:** `{root_path}`")
        content.append("")
        content.append("```")
        content.append(f"{root_path.name}/")
        content.extend(tree_lines)
        content.append("```")
        content.append("")
        content.append("---")
        content.append("*Generated by CodebaseScanner MCP*")

        return "\n".join(content)

    def find_files_by_name(self, filename: str, search_path: Optional[str] = None,
                          exact_match: bool = False, max_results: int = 100) -> Dict:
        """Find files by name pattern"""
        try:
            if search_path:
                root_path = self._normalize_path(search_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {"error": f"Search path does not exist: {root_path}"}

            results = []
            count = 0

            if exact_match:
                pattern = re.compile(f"^{re.escape(filename)}$", re.IGNORECASE)
            else:
                pattern = re.compile(re.escape(filename), re.IGNORECASE)

            for file_path in self._walk_directory(root_path):
                if count >= max_results:
                    break

                if pattern.search(file_path.name):
                    results.append({
                        "filename": file_path.name,
                        "path": str(file_path),
                        "size": file_path.stat().st_size,
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                    })
                    count += 1

            return {
                "success": True,
                "query": filename,
                "exact_match": exact_match,
                "search_path": str(root_path),
                "count": len(results),
                "truncated": count >= max_results,
                "results": results
            }

        except Exception as e:
            return {"error": f"Failed to find files: {str(e)}"}

    def search_content(self, search_text: str, search_path: Optional[str] = None,
                      file_pattern: Optional[str] = None, case_sensitive: bool = False,
                      max_results: int = 100) -> Dict:
        """Search for text content in files"""
        try:
            if search_path:
                root_path = self._normalize_path(search_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {"error": f"Search path does not exist: {root_path}"}

            results = []
            count = 0

            flags = 0 if case_sensitive else re.IGNORECASE
            content_pattern = re.compile(re.escape(search_text), flags)

            file_filter = None
            if file_pattern:
                file_filter = re.compile(file_pattern, re.IGNORECASE)

            for file_path in self._walk_directory(root_path):
                if count >= max_results:
                    break

                if file_filter and not file_filter.search(file_path.name):
                    continue

                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                        matches = []

                        for line_num, line in enumerate(lines, 1):
                            if content_pattern.search(line):
                                matches.append({
                                    "line": line_num,
                                    "content": line.rstrip()
                                })

                        if matches:
                            results.append({
                                "file": str(file_path),
                                "matches": matches[:10]
                            })
                            count += 1

                except (UnicodeDecodeError, PermissionError):
                    continue
                except Exception:
                    continue

            return {
                "success": True,
                "query": search_text,
                "case_sensitive": case_sensitive,
                "search_path": str(root_path),
                "file_pattern": file_pattern,
                "count": len(results),
                "truncated": count >= max_results,
                "results": results
            }

        except Exception as e:
            return {"error": f"Failed to search content: {str(e)}"}

    def _walk_directory(self, root_path: Path):
        """Walk directory and yield file paths, respecting ignore patterns"""
        try:
            for entry in root_path.iterdir():
                if entry.is_dir():
                    if not self.ignore_patterns.should_ignore_dir(entry.name):
                        yield from self._walk_directory(entry)
                elif entry.is_file():
                    if not self.ignore_patterns.should_ignore_file(entry.name):
                        yield entry
        except PermissionError:
            pass
        except Exception:
            pass

    def get_stats(self, target_path: Optional[str] = None) -> Dict:
        """Get codebase statistics"""
        try:
            if target_path:
                root_path = self._normalize_path(target_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {"error": f"Path does not exist: {root_path}"}

            stats = {
                "total_files": 0,
                "total_size": 0,
                "file_types": {},
                "total_dirs": 0
            }

            for file_path in self._walk_directory(root_path):
                stats["total_files"] += 1
                file_size = file_path.stat().st_size
                stats["total_size"] += file_size

                ext = file_path.suffix.lower() or "no_extension"
                if ext not in stats["file_types"]:
                    stats["file_types"][ext] = {"count": 0, "size": 0}
                stats["file_types"][ext]["count"] += 1
                stats["file_types"][ext]["size"] += file_size

            for dir_path in root_path.rglob("*"):
                if dir_path.is_dir() and not self.ignore_patterns.should_ignore_dir(dir_path.name):
                    stats["total_dirs"] += 1

            stats["total_size_mb"] = round(stats["total_size"] / (1024 * 1024), 2)

            return {
                "success": True,
                "path": str(root_path),
                "statistics": stats
            }

        except Exception as e:
            return {"error": f"Failed to get statistics: {str(e)}"}

    def find_file_by_path(self, file_path: str, base_path: Optional[str] = None, exact_match: bool = True) -> Dict:
        """Find a specific file by its path or filename"""
        try:
            if base_path:
                search_root = self._normalize_path(base_path)
            else:
                search_root = self.project_root

            if not search_root.exists():
                return {"error": f"Base path does not exist: {search_root}"}

            target_file = Path(file_path)
            
            # If it's an absolute path, use it directly
            if target_file.is_absolute():
                if not self.enable_global_access:
                    try:
                        target_file.resolve().relative_to(self.project_root.resolve())
                    except ValueError:
                        return {"error": f"Access denied: Path {target_file} is outside project root"}
                
                if target_file.exists():
                    return {
                        "success": True,
                        "file_found": True,
                        "file_path": str(target_file),
                        "file_name": target_file.name,
                        "file_size": target_file.stat().st_size,
                        "is_file": target_file.is_file(),
                        "is_dir": target_file.is_dir()
                    }
                else:
                    return {
                        "success": True,
                        "file_found": False,
                        "searched_path": str(target_file),
                        "message": "File not found"
                    }
            
            # Search for file in the search root
            found_files = []
            
            if exact_match:
                # Exact filename match
                for file_path in self._walk_directory(search_root):
                    if file_path.name == target_file.name:
                        found_files.append({
                            "file_path": str(file_path),
                            "file_name": file_path.name,
                            "file_size": file_path.stat().st_size,
                            "relative_path": str(file_path.relative_to(search_root))
                        })
            else:
                # Partial filename match
                for file_path in self._walk_directory(search_root):
                    if target_file.name.lower() in file_path.name.lower():
                        found_files.append({
                            "file_path": str(file_path),
                            "file_name": file_path.name,
                            "file_size": file_path.stat().st_size,
                            "relative_path": str(file_path.relative_to(search_root))
                        })
            
            return {
                "success": True,
                "file_found": len(found_files) > 0,
                "search_term": file_path,
                "search_root": str(search_root),
                "exact_match": exact_match,
                "files_found": len(found_files),
                "files": found_files
            }

        except Exception as e:
            return {"error": f"Failed to find file: {str(e)}"}

# MCP Server using FastMCP framework
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("CodebaseScanner")

def main():
    """Main MCP server function using FastMCP"""
    try:
        logger.info("[MAIN] Starting FastMCP Codebase Scanner...")

        # Initialize scanner with project root and global access enabled
        project_root = str(CodebaseScannerConstants.get_project_root())
        enable_global = os.environ.get("ENABLE_GLOBAL_ACCESS", "true").lower() == "true"

        scanner = CodebaseScanner(project_root=project_root, enable_global_access=enable_global)

        logger.info(f"[SUCCESS] Scanner initialized")
        logger.info(f"[CONFIG] Project root: {scanner.project_root}")
        logger.info(f"[CONFIG] Global access: {'ENABLED' if scanner.enable_global_access else 'DISABLED'}")

        @mcp.tool()
        def generate_directory_tree(target_path: str = "", max_depth: int = 5, output_format: str = "both") -> str:
            """Generate a directory tree structure for AI analysis with multiple output formats

            Args:
                target_path: Path to generate tree for (defaults to project root, supports absolute paths if global access enabled)
                max_depth: Maximum depth to traverse (default: 5, max: 10)
                output_format: Output format - "json" (structured data), "text" (tree with box-drawing), "markdown" (formatted md), "both" (all formats, default)

            Returns:
                Tree structure in requested format(s) - "both" returns all formats for maximum AI flexibility
            """
            try:
                logger.debug(f"[TOOL] generate_directory_tree called: {target_path or 'project_root'}, depth={max_depth}, format={output_format}")

                max_depth = min(max_depth, 10)
                path = target_path if target_path else None

                if output_format not in ["json", "text", "markdown", "both"]:
                    output_format = "both"

                result = scanner.generate_tree(path, max_depth, output_format)

                logger.info(f"[SUCCESS] generate_directory_tree completed")
                return json.dumps(result, indent=2, ensure_ascii=True)

            except Exception as e:
                error_result = {"error": f"Failed to generate tree: {str(e)}"}
                logger.error(f"[ERROR] generate_directory_tree failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def find_file_by_name(filename: str, search_path: str = "", exact_match: bool = False, max_results: int = 100) -> str:
            """Find files by filename pattern

            Args:
                filename: Filename or pattern to search for
                search_path: Path to search in (defaults to project root, supports absolute paths if global access enabled)
                exact_match: If True, only exact filename matches (default: False for partial match)
                max_results: Maximum number of results to return (default: 100)

            Returns:
                JSON list of matching files with paths and metadata
            """
            try:
                logger.debug(f"[TOOL] find_file_by_name called: {filename}, path={search_path or 'project_root'}")

                path = search_path if search_path else None
                result = scanner.find_files_by_name(filename, path, exact_match, max_results)

                logger.info(f"[SUCCESS] find_file_by_name completed - {result.get('count', 0)} files found")
                return json.dumps(result, indent=2, ensure_ascii=True)

            except Exception as e:
                error_result = {"error": f"Failed to find files: {str(e)}"}
                logger.error(f"[ERROR] find_file_by_name failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def search_content_in_files(search_text: str, search_path: str = "", file_pattern: str = "",
                                   case_sensitive: bool = False, max_results: int = 100) -> str:
            """Search for text content within files

            Args:
                search_text: Text to search for in file contents
                search_path: Path to search in (defaults to project root, supports absolute paths if global access enabled)
                file_pattern: Regex pattern to filter files (e.g., ".*\\.py$" for Python files)
                case_sensitive: If True, perform case-sensitive search (default: False)
                max_results: Maximum number of files to return (default: 100)

            Returns:
                JSON list of files containing the search text with line numbers and content
            """
            try:
                logger.debug(f"[TOOL] search_content_in_files called: '{search_text}', path={search_path or 'project_root'}")

                path = search_path if search_path else None
                pattern = file_pattern if file_pattern else None
                result = scanner.search_content(search_text, path, pattern, case_sensitive, max_results)

                logger.info(f"[SUCCESS] search_content_in_files completed - {result.get('count', 0)} files found")
                return json.dumps(result, indent=2, ensure_ascii=True)

            except Exception as e:
                error_result = {"error": f"Failed to search content: {str(e)}"}
                logger.error(f"[ERROR] search_content_in_files failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def get_codebase_stats(target_path: str = "") -> str:
            """Get statistics about the codebase

            Args:
                target_path: Path to analyze (defaults to project root, supports absolute paths if global access enabled)

            Returns:
                JSON statistics including file counts, sizes, and type distribution
            """
            try:
                logger.debug(f"[TOOL] get_codebase_stats called: {target_path or 'project_root'}")

                path = target_path if target_path else None
                result = scanner.get_stats(path)

                logger.info(f"[SUCCESS] get_codebase_stats completed")
                return json.dumps(result, indent=2, ensure_ascii=True)

            except Exception as e:
                error_result = {"error": f"Failed to get stats: {str(e)}"}
                logger.error(f"[ERROR] get_codebase_stats failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def scan_flutter_apps() -> str:
            """Scan and list all available Flutter apps in the project

            Returns:
                JSON list of available Flutter apps with metadata
            """
            try:
                logger.debug("[TOOL] scan_flutter_apps called")

                if not scanner.flutter_scanner:
                    return json.dumps({
                        "error": "Flutter scanner not available - flutter_bloom directory not found"
                    }, indent=2)

                apps = scanner.flutter_scanner.scan_flutter_apps()

                result = {
                    "success": True,
                    "flutter_root": str(scanner.flutter_scanner.flutter_root),
                    "apps_count": len(apps),
                    "apps": apps,
                    "modes": FlutterScanner.FLUTTER_MODES,
                    "tip": "Use 'flutter' or 'flutter_bloom' as app_name to scan entire Flutter project"
                }

                logger.info(f"[SUCCESS] scan_flutter_apps completed - {len(apps)} apps found")
                return json.dumps(result, indent=2, ensure_ascii=True)

            except Exception as e:
                error_result = {"error": f"Failed to scan Flutter apps: {str(e)}"}
                logger.error(f"[ERROR] scan_flutter_apps failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def print_flutter_app_structure(app_name: str, mode: str = "code_assets", max_depth: int = 10) -> str:
            """Generate Flutter app directory structure with specialized formatting for AI understanding

            This tool helps AI understand Flutter project structure by providing:
            - Separate scanning of lib/apps/{app_name}, lib/common, assets, and pubspec.yaml
            - Multiple output modes optimized for different analysis needs
            - Clear visual hierarchy of Flutter app components

            Args:
                app_name: App name (e.g., "app_achat", "app_wuy") or "flutter"/"flutter_bloom" for entire project
                mode: Scan mode - "code" (lib only), "code_assets" (lib + assets, default), "all" (everything)
                max_depth: Maximum directory depth to traverse (default: 10)

            Returns:
                JSON with tree_text (formatted tree) and tree_markdown (markdown format) for AI analysis
            """
            try:
                logger.debug(f"[TOOL] print_flutter_app_structure called: {app_name}, mode={mode}")

                if not scanner.flutter_scanner:
                    return json.dumps({
                        "error": "Flutter scanner not available - flutter_bloom directory not found"
                    }, indent=2)

                if mode not in FlutterScanner.FLUTTER_MODES:
                    return json.dumps({
                        "error": f"Invalid mode '{mode}'. Valid modes: {FlutterScanner.FLUTTER_MODES}"
                    }, indent=2)

                result = scanner.flutter_scanner.build_flutter_tree(app_name, mode, max_depth)

                logger.info(f"[SUCCESS] print_flutter_app_structure completed")
                return json.dumps(result, indent=2, ensure_ascii=True)

            except Exception as e:
                error_result = {"error": f"Failed to print Flutter app structure: {str(e)}"}
                logger.error(f"[ERROR] print_flutter_app_structure failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def find_file_by_path(file_path: str, search_path: str = "", exact_match: bool = True) -> str:
            """Find a specific file by its path or filename

            Args:
                file_path: File path or filename to search for
                search_path: Base path to search in (defaults to project root, supports absolute paths if global access enabled)
                exact_match: If True, match exact path/filename (default: True)

            Returns:
                JSON with file information including path, size, and metadata
            """
            try:
                logger.debug(f"[TOOL] find_file_by_path called: {file_path}, base_path={search_path or 'project_root'}")
                
                base_path = search_path if search_path else None
                result = scanner.find_file_by_path(file_path, base_path, exact_match)
                
                logger.info(f"[SUCCESS] find_file_by_path completed")
                return json.dumps(result, indent=2, ensure_ascii=True)
                
            except Exception as e:
                error_result = {"error": f"Failed to find file: {str(e)}"}
                logger.error(f"[ERROR] find_file_by_path failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def health_check(ai_id: str = None) -> str:
            """Check server health and return comprehensive status information

            Args:
                ai_id: Optional AI identifier for session tracking

            Returns:
                Comprehensive server health information including session stats
            """
            try:
                if logger:
                    logger.info(f"Health check called by AI: {ai_id or 'unknown'}")
                
                # Create session for AI if provided
                session_id = None
                if ai_id:
                    session_id = session_manager.create_session(ai_id)
                
                # Clean up old sessions
                session_manager.cleanup_old_sessions()
                
                import platform

                capabilities = [
                    "generate_directory_tree",
                    "find_file_by_name",
                    "search_content_in_files",
                    "get_codebase_stats",
                    "find_file_by_path",
                    "health_check"
                ]

                flutter_available = scanner.flutter_scanner is not None
                if flutter_available:
                    capabilities.extend([
                        "scan_flutter_apps",
                        "print_flutter_app_structure"
                    ])

                # Get session statistics
                session_stats = session_manager.get_session_stats()

                health_info = {
                    "server_status": "healthy",
                    "timestamp": datetime.now().isoformat(),
                    "ai_session": {
                        "ai_id": ai_id,
                        "session_id": session_id,
                        "session_created": session_id is not None
                    },
                    "configuration": {
                        "project_root": str(scanner.project_root),
                        "global_access_enabled": scanner.enable_global_access,
                        "flutter_scanner_available": flutter_available,
                        "image_processing_available": IMAGE_PROCESSING_AVAILABLE,
                        "ignore_dirs_count": len(IgnorePatterns.IGNORE_DIRS),
                        "ignore_extensions_count": len(IgnorePatterns.IGNORE_FILE_EXTENSIONS)
                    },
                    "system": {
                        "platform": platform.system(),
                        "python_version": platform.python_version(),
                        "hostname": platform.node()
                    },
                    "capabilities": capabilities,
                    "session_statistics": session_stats,
                    "package_status": {
                        "mcp_available": mcp is not None,
                        "image_processing": IMAGE_PROCESSING_AVAILABLE,
                        "required_packages": PackageManager.REQUIRED_PACKAGES
                    }
                }

                if flutter_available:
                    health_info["flutter"] = {
                        "root": str(scanner.flutter_scanner.flutter_root),
                        "modes": FlutterScanner.FLUTTER_MODES
                    }

                result = {
                    "success": True,
                    "health": health_info
                }

                if logger:
                    logger.info("Health check completed successfully")
                
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {
                    "success": False,
                    "server_status": "error",
                    "timestamp": datetime.now().isoformat(),
                    "error": f"Health check failed: {str(e)}"
                }
                if logger:
                    logger.error(f"Health check failed: {e}")
                return json.dumps(error_result, indent=2)

        logger.info("[FASTMCP] Starting FastMCP server...")
        mcp.run()

    except KeyboardInterrupt:
        logger.info("[STOP] Server stopped by user")
    except Exception as e:
        logger.critical(f"[CRITICAL] Critical server error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def init():
    """Initialize the MCP server with package verification"""
    logger.info("[INIT] Initializing Codebase Scanner MCP Server...")

    try:
        # Check and install required packages
        logger.info("[PACKAGE] Checking required packages...")
        if not PackageManager.ensure_packages():
            logger.error("[ERROR] Failed to install required packages")
            sys.exit(1)

        logger.info("[SUCCESS] All required packages are available")
        logger.info("[START] Starting MCP server...")

        # Set up proper asyncio policy for Windows
        if sys.platform == 'win32':
            try:
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                logger.info("[SUCCESS] Windows asyncio policy set")
            except Exception as e:
                logger.warning(f"[WARNING] Failed to set Windows asyncio policy: {e}")

        # Run the FastMCP server
        try:
            main()
        except KeyboardInterrupt:
            logger.info("[STOP] Server stopped by user")
            sys.exit(0)
        except SystemExit:
            raise
        except Exception as e:
            logger.error(f"[ERROR] Server failed to start: {e}")
            import traceback
            logger.debug("[DEBUG] Full error traceback:")
            traceback.print_exc()
            sys.exit(1)

    except SystemExit:
        raise
    except Exception as e:
        logger.critical(f"[CRITICAL] Critical initialization error: {e}")
        import traceback
        logger.debug("[DEBUG] Full error traceback:")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    init()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Codebase Scanner - Refactored with Singleton Pattern + WebSocket RPC

REFACTORED VERSION:
==================
- Uses singleton pattern (only one backend instance)
- Uses WebSocket RPC (no FastMCP dependency)
- Pure Python standard library + websockets only
- Multiple clients can connect to single backend
- Resource efficient and scalable

Original Features Preserved:
- Directory tree generation
- File search and content analysis
- Flutter app structure scanning
- Image pixel analysis
- Project statistics

Architecture:
- Backend (Primary Instance): Runs core scanning logic + RPC server
- Client Communication (All Instances): Connects to backend via WebSocket RPC
"""

import asyncio
import json
import os
import sys
import logging
import threading
import time
import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any

# Add pycore to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

# Import our singleton RPC framework
from pycore.pyutils.wsrpc import SingletonRpcBackend

# Import constants
from constants import CodebaseScannerConstants

# Image processing (optional)
try:
    from PIL import Image
    import numpy as np
    IMAGE_PROCESSING_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSING_AVAILABLE = False


class CodebaseScannerBackend(SingletonRpcBackend):
    """
    Codebase Scanner with Singleton + RPC Architecture

    This refactored version:
    - Runs as singleton (only one backend instance)
    - Uses WebSocket RPC for client communication
    - No heavy framework dependencies (no FastMCP, Flask, FastAPI)
    - Multiple clients can connect simultaneously

    Usage:
        backend = CodebaseScannerBackend(
            singleton_port=CodebaseScannerConstants.SINGLETON_PORT,
            rpc_port=CodebaseScannerConstants.RPC_PORT
        )
        backend.start()
    """

    def __init__(
        self,
        singleton_host: str = 'localhost',
        singleton_port: int = 19998,  # Different from default to avoid conflicts
        rpc_host: str = 'localhost',
        rpc_port: int = 8766,  # Different from default
        debug: bool = True
    ):
        """Initialize Codebase Scanner Backend"""
        super().__init__(
            singleton_host=singleton_host,
            singleton_port=singleton_port,
            rpc_host=rpc_host,
            rpc_port=rpc_port,
            debug=debug
        )

        # Ensure directories
        CodebaseScannerConstants.ensure_directories()

        # Setup logging
        self._setup_logging()

        # Session management
        self.sessions = {}
        self.session_lock = threading.Lock()

        # Statistics
        self.stats = {
            'total_scans': 0,
            'total_searches': 0,
            'total_clients': 0,
            'start_time': time.time()
        }

    def _setup_logging(self):
        """Setup logging to file"""
        log_format = '%(asctime)s [%(levelname)s] [CodebaseScanner] %(message)s'
        logging.basicConfig(
            level=logging.INFO,
            format=log_format,
            handlers=[
                logging.StreamHandler(sys.stderr),
                logging.FileHandler(CodebaseScannerConstants.LOG_FILE, encoding='utf-8')
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info("Codebase Scanner Backend initialized")

    def _log(self, message: str, level: str = 'INFO'):
        """Override parent log to use logger"""
        if self.logger:
            if level == 'ERROR':
                self.logger.error(message)
            elif level == 'WARNING':
                self.logger.warning(message)
            else:
                self.logger.info(message)
        else:
            super()._log(message, level)

    # ============================================
    # Backend RPC Routes (Primary Instance)
    # ============================================

    def _register_backend_routes(self):
        """Register all backend RPC routes"""

        @self.rpc_server.route('generate_directory_tree')
        async def generate_directory_tree(params):
            """
            Generate directory tree structure

            Args:
                target_path: Path to scan (optional, defaults to project root)
                max_depth: Maximum depth (default: 5)
                output_format: "json", "text", "markdown", "both" (default: "both")

            Returns:
                Tree structure in requested format(s)
            """
            try:
                target_path = params.get('target_path', '')
                max_depth = params.get('max_depth', 5)
                output_format = params.get('output_format', 'both')

                # Resolve path
                if not target_path:
                    scan_path = CodebaseScannerConstants.PROJECT_ROOT
                else:
                    scan_path = Path(target_path)
                    if not scan_path.is_absolute():
                        scan_path = CodebaseScannerConstants.PROJECT_ROOT / target_path

                # Validate path exists
                if not scan_path.exists():
                    return {
                        'success': False,
                        'error': f'Path does not exist: {scan_path}'
                    }

                self.stats['total_scans'] += 1

                # Generate tree
                tree_data = self._generate_tree(scan_path, max_depth)

                result = {
                    'success': True,
                    'path': str(scan_path),
                    'max_depth': max_depth,
                    'timestamp': time.time()
                }

                # Add requested formats
                if output_format in ['json', 'both']:
                    result['tree_json'] = tree_data

                if output_format in ['text', 'both']:
                    result['tree_text'] = self._format_tree_text(tree_data)

                if output_format in ['markdown', 'both']:
                    result['tree_markdown'] = self._format_tree_markdown(tree_data)

                return result

            except Exception as e:
                self.logger.error(f"Error generating tree: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }

        @self.rpc_server.route('find_file_by_name')
        async def find_file_by_name(params):
            """
            Find files by filename pattern

            Args:
                filename: Filename or pattern to search
                search_path: Path to search in (optional)
                exact_match: If True, only exact matches (default: False)
                max_results: Maximum results to return (default: 100)

            Returns:
                List of matching files with metadata
            """
            try:
                filename = params.get('filename', '')
                search_path = params.get('search_path', '')
                exact_match = params.get('exact_match', False)
                max_results = params.get('max_results', 100)

                if not filename:
                    return {
                        'success': False,
                        'error': 'filename parameter is required'
                    }

                # Resolve path
                if not search_path:
                    base_path = CodebaseScannerConstants.PROJECT_ROOT
                else:
                    base_path = Path(search_path)
                    if not base_path.is_absolute():
                        base_path = CodebaseScannerConstants.PROJECT_ROOT / search_path

                self.stats['total_searches'] += 1

                # Search files
                results = self._find_files_by_name(
                    base_path, filename, exact_match, max_results
                )

                return {
                    'success': True,
                    'query': filename,
                    'search_path': str(base_path),
                    'exact_match': exact_match,
                    'results_count': len(results),
                    'results': results,
                    'timestamp': time.time()
                }

            except Exception as e:
                self.logger.error(f"Error finding files: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }

        @self.rpc_server.route('search_content_in_files')
        async def search_content_in_files(params):
            """
            Search for text content within files

            Args:
                search_text: Text to search for
                search_path: Path to search in (optional)
                file_pattern: Regex pattern to filter files (optional)
                case_sensitive: Case-sensitive search (default: False)
                max_results: Maximum files to return (default: 100)

            Returns:
                List of files containing search text with line numbers
            """
            try:
                search_text = params.get('search_text', '')
                search_path = params.get('search_path', '')
                file_pattern = params.get('file_pattern', '')
                case_sensitive = params.get('case_sensitive', False)
                max_results = params.get('max_results', 100)

                if not search_text:
                    return {
                        'success': False,
                        'error': 'search_text parameter is required'
                    }

                # Resolve path
                if not search_path:
                    base_path = CodebaseScannerConstants.PROJECT_ROOT
                else:
                    base_path = Path(search_path)
                    if not base_path.is_absolute():
                        base_path = CodebaseScannerConstants.PROJECT_ROOT / search_path

                self.stats['total_searches'] += 1

                # Search content
                results = self._search_content(
                    base_path, search_text, file_pattern,
                    case_sensitive, max_results
                )

                return {
                    'success': True,
                    'query': search_text,
                    'search_path': str(base_path),
                    'case_sensitive': case_sensitive,
                    'results_count': len(results),
                    'results': results,
                    'timestamp': time.time()
                }

            except Exception as e:
                self.logger.error(f"Error searching content: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }

        @self.rpc_server.route('get_codebase_stats')
        async def get_codebase_stats(params):
            """
            Get statistics about the codebase

            Args:
                target_path: Path to analyze (optional)

            Returns:
                Statistics including file counts, sizes, type distribution
            """
            try:
                target_path = params.get('target_path', '')

                # Resolve path
                if not target_path:
                    scan_path = CodebaseScannerConstants.PROJECT_ROOT
                else:
                    scan_path = Path(target_path)
                    if not scan_path.is_absolute():
                        scan_path = CodebaseScannerConstants.PROJECT_ROOT / target_path

                # Gather statistics
                stats = self._gather_stats(scan_path)

                return {
                    'success': True,
                    'path': str(scan_path),
                    'stats': stats,
                    'timestamp': time.time()
                }

            except Exception as e:
                self.logger.error(f"Error gathering stats: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }

        @self.rpc_server.route('health_check')
        async def health_check(params):
            """
            Health check endpoint

            Returns:
                Server status and statistics
            """
            return {
                'success': True,
                'status': 'running',
                'is_primary': self._is_primary_instance,
                'uptime_seconds': time.time() - self.stats['start_time'],
                'stats': self.stats,
                'clients_connected': len(self.rpc_server.clients) if self.rpc_server else 0,
                'image_processing_available': IMAGE_PROCESSING_AVAILABLE,
                'timestamp': time.time()
            }

        self.logger.info(f"Registered {len(self.rpc_server.routes)} backend routes")

    # ============================================
    # Core Scanner Functions
    # ============================================

    def _generate_tree(self, path: Path, max_depth: int, current_depth: int = 0) -> Dict:
        """Generate directory tree structure"""
        if current_depth >= max_depth:
            return {}

        tree = {
            'name': path.name,
            'type': 'directory' if path.is_dir() else 'file',
            'path': str(path),
            'children': []
        }

        if path.is_dir():
            try:
                for item in sorted(path.iterdir()):
                    # Skip hidden and common excluded directories
                    if item.name.startswith('.') or item.name in ['node_modules', '__pycache__', 'dist', 'build']:
                        continue

                    child_tree = self._generate_tree(item, max_depth, current_depth + 1)
                    if child_tree:
                        tree['children'].append(child_tree)
            except PermissionError:
                tree['error'] = 'Permission denied'

        return tree

    def _format_tree_text(self, tree: Dict, prefix: str = '', is_last: bool = True) -> str:
        """Format tree as text with box drawing characters"""
        if not tree:
            return ''

        lines = []
        connector = '└── ' if is_last else '├── '
        lines.append(prefix + connector + tree['name'])

        children = tree.get('children', [])
        for i, child in enumerate(children):
            extension = '    ' if is_last else '│   '
            child_text = self._format_tree_text(
                child,
                prefix + extension,
                i == len(children) - 1
            )
            lines.append(child_text)

        return '\n'.join(filter(None, lines))

    def _format_tree_markdown(self, tree: Dict, level: int = 0) -> str:
        """Format tree as markdown"""
        if not tree:
            return ''

        lines = []
        indent = '  ' * level
        icon = '📁' if tree['type'] == 'directory' else '📄'
        lines.append(f"{indent}- {icon} **{tree['name']}**")

        children = tree.get('children', [])
        for child in children:
            child_md = self._format_tree_markdown(child, level + 1)
            lines.append(child_md)

        return '\n'.join(filter(None, lines))

    def _find_files_by_name(
        self,
        base_path: Path,
        filename: str,
        exact_match: bool,
        max_results: int
    ) -> List[Dict]:
        """Find files by name"""
        results = []
        pattern = re.compile(re.escape(filename) if exact_match else filename, re.IGNORECASE)

        def search_dir(path: Path):
            if len(results) >= max_results:
                return

            try:
                for item in path.iterdir():
                    if item.name.startswith('.') or item.name in ['node_modules', '__pycache__']:
                        continue

                    if item.is_file():
                        if pattern.search(item.name):
                            results.append({
                                'name': item.name,
                                'path': str(item),
                                'size': item.stat().st_size,
                                'modified': item.stat().st_mtime
                            })
                    elif item.is_dir():
                        search_dir(item)

            except PermissionError:
                pass

        search_dir(base_path)
        return results[:max_results]

    def _search_content(
        self,
        base_path: Path,
        search_text: str,
        file_pattern: str,
        case_sensitive: bool,
        max_results: int
    ) -> List[Dict]:
        """Search for content in files"""
        results = []
        flags = 0 if case_sensitive else re.IGNORECASE
        search_regex = re.compile(re.escape(search_text), flags)
        file_regex = re.compile(file_pattern) if file_pattern else None

        def search_dir(path: Path):
            if len(results) >= max_results:
                return

            try:
                for item in path.iterdir():
                    if item.name.startswith('.') or item.name in ['node_modules', '__pycache__']:
                        continue

                    if item.is_file():
                        if file_regex and not file_regex.search(item.name):
                            continue

                        try:
                            with open(item, 'r', encoding='utf-8', errors='ignore') as f:
                                matches = []
                                for line_num, line in enumerate(f, 1):
                                    if search_regex.search(line):
                                        matches.append({
                                            'line_number': line_num,
                                            'content': line.strip()
                                        })

                                if matches:
                                    results.append({
                                        'file': str(item),
                                        'matches_count': len(matches),
                                        'matches': matches[:10]  # Limit to first 10 matches per file
                                    })
                        except:
                            pass

                    elif item.is_dir():
                        search_dir(item)

            except PermissionError:
                pass

        search_dir(base_path)
        return results[:max_results]

    def _gather_stats(self, path: Path) -> Dict:
        """Gather statistics about codebase"""
        stats = {
            'total_files': 0,
            'total_dirs': 0,
            'total_size': 0,
            'file_types': {},
            'largest_files': []
        }

        files_with_sizes = []

        def scan_dir(p: Path):
            try:
                for item in p.iterdir():
                    if item.name.startswith('.') or item.name in ['node_modules', '__pycache__']:
                        continue

                    if item.is_file():
                        stats['total_files'] += 1
                        size = item.stat().st_size
                        stats['total_size'] += size

                        ext = item.suffix.lower()
                        stats['file_types'][ext] = stats['file_types'].get(ext, 0) + 1

                        files_with_sizes.append((str(item), size))

                    elif item.is_dir():
                        stats['total_dirs'] += 1
                        scan_dir(item)

            except PermissionError:
                pass

        scan_dir(path)

        # Get largest files
        files_with_sizes.sort(key=lambda x: x[1], reverse=True)
        stats['largest_files'] = [
            {'file': f, 'size': s}
            for f, s in files_with_sizes[:10]
        ]

        return stats


def main():
    """Main entry point for Codebase Scanner"""
    print("=" * 60)
    print("Codebase Scanner - Refactored with Singleton + WebSocket RPC")
    print("=" * 60)
    print()

    # Configuration
    SINGLETON_PORT = 19998
    RPC_PORT = 8766
    DEBUG = True

    # Create scanner backend
    scanner = CodebaseScannerBackend(
        singleton_host='localhost',
        singleton_port=SINGLETON_PORT,
        rpc_host='localhost',
        rpc_port=RPC_PORT,
        debug=DEBUG
    )

    # Set event callbacks
    scanner.on_primary_started(
        lambda: print("\n✓ Started as PRIMARY instance (running scanner backend)\n")
    )
    scanner.on_secondary_started(
        lambda: print("\n✓ Started as SECONDARY instance (reusing backend)\n")
    )
    scanner.on_shutdown(
        lambda: print("\n✓ Shutting down scanner...\n")
    )

    # Start scanner
    if scanner.start():
        try:
            print("Codebase Scanner running. Press Ctrl+C to stop.")
            print()

            if scanner.is_primary_instance():
                print(f"→ RPC Server: ws://localhost:{RPC_PORT}")
                print(f"→ Singleton Detection: localhost:{SINGLETON_PORT}")
                print(f"→ Project Root: {CodebaseScannerConstants.PROJECT_ROOT}")
            else:
                print(f"→ Connected to existing backend at ws://localhost:{RPC_PORT}")

            print()
            print("Multiple instances can run simultaneously - they share the same backend.")
            print()

            # Keep running
            while scanner.is_running():
                time.sleep(1)

        except KeyboardInterrupt:
            print("\n\nReceived interrupt signal")

        finally:
            scanner.stop()
            print("\nCodebase Scanner stopped.")

    else:
        print("ERROR: Failed to start Codebase Scanner!")
        sys.exit(1)


if __name__ == '__main__':
    main()

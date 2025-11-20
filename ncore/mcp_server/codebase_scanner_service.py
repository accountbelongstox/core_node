#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Codebase Scanner Service Adapter

Wraps the original codebase-scanner MCP functionality
for use with the Unified MCP Server RPC backend.

This adapter:
- Removes FastMCP dependency
- Provides async methods compatible with RPC
- Uses only Python stdlib + minimal dependencies
- Integrates with pycore libraries
"""

import os
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Import from pycore if needed
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class CodebaseScannerService:
    """
    Codebase Scanner Service

    Provides code analysis and file management functionality:
    - Directory tree generation
    - File search by name/pattern
    - Content search in files
    - Project statistics
    """

    def __init__(self, project_root: Optional[Path] = None):
        """Initialize CodebaseScannerService"""
        if project_root is None:
            # Auto-detect project root (3 levels up from this file)
            self.project_root = Path(__file__).parent.parent.parent
        else:
            self.project_root = Path(project_root)

        # Excluded directories (common patterns to skip)
        self.excluded_dirs = {
            'node_modules', '__pycache__', '.git', 'dist', 'build',
            '.venv', 'venv', 'env', '.env', '.idea', '.vscode',
            'vendor', 'target', 'out', 'tmp', 'temp'
        }

        # Statistics
        self.stats = {
            'total_scans': 0,
            'total_searches': 0,
            'init_time': time.time()
        }

    async def generate_tree(self, params: dict) -> dict:
        """
        Generate directory tree structure

        Args:
            target_path: Path to scan (optional)
            max_depth: Maximum depth (default: 5)
            output_format: "json", "text", "markdown", "both"

        Returns:
            Tree structure in requested format(s)
        """
        try:
            target_path = params.get('target_path', '')
            max_depth = params.get('max_depth', 5)
            output_format = params.get('output_format', 'both')

            # Resolve path
            if not target_path:
                scan_path = self.project_root
            else:
                scan_path = Path(target_path)
                if not scan_path.is_absolute():
                    scan_path = self.project_root / target_path

            # Validate
            if not scan_path.exists():
                return {
                    'success': False,
                    'error': f'Path does not exist: {scan_path}'
                }

            self.stats['total_scans'] += 1

            # Generate tree
            tree_data = self._build_tree(scan_path, max_depth)

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
            return {
                'success': False,
                'error': f'Error generating tree: {e}'
            }

    async def find_file(self, params: dict) -> dict:
        """
        Find files by name or pattern

        Args:
            filename: Filename or pattern
            search_path: Path to search in (optional)
            exact_match: Exact match only (default: False)
            max_results: Maximum results (default: 100)

        Returns:
            List of matching files
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
                base_path = self.project_root
            else:
                base_path = Path(search_path)
                if not base_path.is_absolute():
                    base_path = self.project_root / search_path

            self.stats['total_searches'] += 1

            # Search
            results = self._find_files(base_path, filename, exact_match, max_results)

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
            return {
                'success': False,
                'error': f'Error finding files: {e}'
            }

    async def search_content(self, params: dict) -> dict:
        """
        Search for text content in files

        Args:
            search_text: Text to search for
            search_path: Path to search in (optional)
            file_pattern: Regex pattern for file names (optional)
            case_sensitive: Case-sensitive search (default: False)
            max_results: Maximum results (default: 100)

        Returns:
            List of files containing the search text
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
                base_path = self.project_root
            else:
                base_path = Path(search_path)
                if not base_path.is_absolute():
                    base_path = self.project_root / search_path

            self.stats['total_searches'] += 1

            # Search
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
            return {
                'success': False,
                'error': f'Error searching content: {e}'
            }

    async def get_stats(self, params: dict) -> dict:
        """
        Get codebase statistics

        Args:
            target_path: Path to analyze (optional)

        Returns:
            Statistics about the codebase
        """
        try:
            target_path = params.get('target_path', '')

            # Resolve path
            if not target_path:
                scan_path = self.project_root
            else:
                scan_path = Path(target_path)
                if not scan_path.is_absolute():
                    scan_path = self.project_root / target_path

            # Gather stats
            stats = self._gather_stats(scan_path)

            return {
                'success': True,
                'path': str(scan_path),
                'stats': stats,
                'service_stats': self.stats,
                'timestamp': time.time()
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Error gathering stats: {e}'
            }

    # ============================================
    # Internal Methods
    # ============================================

    def _build_tree(self, path: Path, max_depth: int, current_depth: int = 0) -> dict:
        """Build directory tree structure"""
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
                    # Skip excluded
                    if item.name.startswith('.') or item.name in self.excluded_dirs:
                        continue

                    child_tree = self._build_tree(item, max_depth, current_depth + 1)
                    if child_tree:
                        tree['children'].append(child_tree)

            except PermissionError:
                tree['error'] = 'Permission denied'

        return tree

    def _format_tree_text(self, tree: dict, prefix: str = '', is_last: bool = True) -> str:
        """Format tree as text"""
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

    def _format_tree_markdown(self, tree: dict, level: int = 0) -> str:
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

    def _find_files(
        self,
        base_path: Path,
        filename: str,
        exact_match: bool,
        max_results: int
    ) -> List[dict]:
        """Find files by name"""
        results = []
        pattern = re.compile(
            re.escape(filename) if exact_match else filename,
            re.IGNORECASE
        )

        def search_dir(path: Path):
            if len(results) >= max_results:
                return

            try:
                for item in path.iterdir():
                    if item.name.startswith('.') or item.name in self.excluded_dirs:
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
    ) -> List[dict]:
        """Search content in files"""
        results = []
        flags = 0 if case_sensitive else re.IGNORECASE
        search_regex = re.compile(re.escape(search_text), flags)
        file_regex = re.compile(file_pattern) if file_pattern else None

        def search_dir(path: Path):
            if len(results) >= max_results:
                return

            try:
                for item in path.iterdir():
                    if item.name.startswith('.') or item.name in self.excluded_dirs:
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
                                        'matches': matches[:10]
                                    })
                        except:
                            pass

                    elif item.is_dir():
                        search_dir(item)

            except PermissionError:
                pass

        search_dir(base_path)
        return results[:max_results]

    def _gather_stats(self, path: Path) -> dict:
        """Gather codebase statistics"""
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
                    if item.name.startswith('.') or item.name in self.excluded_dirs:
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

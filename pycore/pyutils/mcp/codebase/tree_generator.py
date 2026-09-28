#!/usr/bin/env python3
"""
Directory tree generation and codebase structure analysis
Unified from CodebaseScanner and CodebaseContentHub
"""

import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider

logger = logging.getLogger(__name__)


# Common ignore patterns for directory scanning
IGNORE_DIRS: Set[str] = {
    'node_modules', '.git', '.svn', '.hg', '.bzr', '__pycache__',
    '.pytest_cache', '.mypy_cache', '.tox', '.eggs', 'dist', 'build',
    '.idea', '.vscode', '.vs', 'venv', 'env', '.venv', '.cache',
    'tmp', 'temp', 'logs', 'log', '.dart_tool', '.pub', 'vendor',
    '.next', '.nuxt', 'release', 'debug', '.ncore', '.apps_dist',
    '.data', 'data', 'chrome', '.yalc', 'webpack_dist', '.strapi',
    'pyenv_*', '.ai_restricted_access', '.ai_no_access', '.bak-ai-*',
    '.secret_ignore', 'secret_keys', 'tmp_*', 'test_*', '.*_tmp',
    '.*.tmp', '.dev_tmp', '.bak-*', '_static_*', '_static_-*'
}

IGNORE_FILE_EXTENSIONS: Set[str] = {
    '.pyc', '.pyo', '.pyd', '.so', '.dll', '.dylib', '.o', '.exe',
    '.bin', '.obj', '.class', '.jar', '.war', '.zip', '.rar', '.7z',
    '.tar', '.gz', '.bz2', '.xz', '.log', '.logs', '.tmp', '.temp',
    '.bak', '.backup', '.old', '.db', '.sqlite', '.sqlite3', '.cache',
    '.lock', '.pid', '.sock', '.swp', '.swo', '.swn', '.DS_Store',
    '.gitignore', '.min.js', '.min.css', '.map', '.g.dart',
    '.freezed.dart', '.gr.dart', '.vsix', '.iso', '.dmg', '.pkg',
    '.deb', '.rpm', '.apk', '.msi', '.cab', '.p12', '.jks', '.key',
    '.crt', '.cer', '.der', '.pfx', '.keystore'
}


class DirectoryTreeGenerator:
    """
    Generates directory trees with customizable output formats
    Combines functionality from CodebaseScanner and CodebaseContentHub
    """

    def __init__(self, project_root: Optional[Path] = None, enable_global_access: bool = True):
        self.project_root = project_root if project_root else Path.cwd()
        self.enable_global_access = enable_global_access
        logger.debug("[DirectoryTreeGenerator] Initialized")

    def should_ignore_directory(self, dir_name: str) -> bool:
        """Check if directory should be ignored"""
        dir_lower = dir_name.lower()

        for pattern in IGNORE_DIRS:
            if '*' in pattern:
                regex = pattern.replace('*', '.*')
                if re.match(regex, dir_lower):
                    return True
            elif dir_lower == pattern.lower() or dir_name == pattern:
                return True

        return False

    def should_ignore_file(self, file_name: str) -> bool:
        """Check if file should be ignored"""
        _, ext = os.path.splitext(file_name)
        if ext.lower() in IGNORE_FILE_EXTENSIONS:
            return True

        # Ignore hidden files unless explicitly allowed
        if file_name.startswith('.'):
            return True

        return False

    def normalize_and_validate_path(self, path_str: str) -> Path:
        """
        Normalize and validate path with security checks

        Args:
            path_str: Input path string

        Returns:
            Validated Path object

        Raises:
            ValueError: If path validation fails
        """
        path = Path(path_str)

        if not path.is_absolute():
            path = self.project_root / path

        path = path.resolve()

        # Security check: prevent directory traversal
        if not self.enable_global_access:
            try:
                path.relative_to(self.project_root.resolve())
            except ValueError:
                raise ValueError(f"Access denied: Path {path} is outside project root")

        return path

    def generate_directory_tree_with_multiple_formats(
        self,
        target_path: Optional[str] = None,
        max_depth: int = 5,
        include_files: bool = True,
        include_hidden: bool = False,
        output_format: str = "both"  # "json", "text", "markdown", "both"
    ) -> Dict[str, Any]:
        """
        Generate directory tree with multiple output formats

        Args:
            target_path: Path to scan (defaults to project root)
            max_depth: Maximum recursion depth
            include_files: Include files in the tree
            include_hidden: Include hidden files/directories
            output_format: Output format(s)

        Returns:
            Tree structure in requested format(s)
        """
        try:
            if target_path:
                root_path = self.normalize_and_validate_path(target_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {'error': f"Path does not exist: {root_path}"}

            if not root_path.is_dir():
                return {'error': f"Path is not a directory: {root_path}"}

            result = {
                'success': True,
                'root': str(root_path),
                'root_name': root_path.name,
                'scan_settings': {
                    'max_depth': max_depth,
                    'include_files': include_files,
                    'include_hidden': include_hidden
                },
                'timestamp': datetime.now().isoformat()
            }

            # Generate tree in different formats
            if output_format in ['json', 'both']:
                result['tree_json'] = self._build_tree_json(
                    root_path, max_depth, 0, include_files, include_hidden
                )

            if output_format in ['text', 'both']:
                tree_lines = self._build_tree_text(
                    root_path, max_depth, 0, "", include_files, include_hidden
                )
                result['tree_text'] = "\n".join([f"{root_path.name}/"] + tree_lines)

            if output_format in ['markdown', 'both']:
                tree_lines = self._build_tree_text(
                    root_path, max_depth, 0, "", include_files, include_hidden
                )
                result['tree_markdown'] = self._format_as_markdown(root_path, tree_lines)

            return result

        except Exception as e:
            logger.error("[DirectoryTreeGenerator] Failed to generate tree: %s", e)
            return {'error': f"Failed to generate tree: {str(e)}"}

    def _build_tree_json(
        self,
        path: Path,
        max_depth: int,
        current_depth: int,
        include_files: bool,
        include_hidden: bool,
        entry_limit: int = 500
    ) -> Dict[str, Any]:
        """Build tree structure in JSON format"""
        node = {
            'name': path.name or str(path),
            'path': str(path),
            'type': 'directory' if path.is_dir() else 'file',
            'children': []
        }

        if path.is_file():
            node.update(self._get_file_metadata(path))
            return node

        if current_depth >= max_depth:
            node['truncated'] = True
            node['reason'] = 'max depth reached'
            return node

        try:
            entries = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
        except (OSError, PermissionError) as e:
            node['error'] = str(e)
            return node

        included_count = 0

        for entry in entries:
            if included_count >= entry_limit:
                node.setdefault('notes', []).append('entry limit reached')
                break

            # Skip hidden files/dirs unless explicitly allowed
            if not include_hidden and entry.name.startswith('.'):
                continue

            if entry.is_dir():
                if self.should_ignore_directory(entry.name):
                    continue

                child = self._build_tree_json(
                    entry, max_depth, current_depth + 1, include_files, include_hidden, entry_limit
                )
                node['children'].append(child)
                included_count += 1

            elif include_files:
                if self.should_ignore_file(entry.name):
                    continue

                file_node = self._get_file_metadata(entry)
                file_node['type'] = 'file'
                node['children'].append(file_node)
                included_count += 1

        return node

    def _build_tree_text(
        self,
        path: Path,
        max_depth: int,
        current_depth: int,
        prefix: str,
        include_files: bool,
        include_hidden: bool
    ) -> List[str]:
        """Build tree structure in text format with box-drawing characters"""
        if current_depth >= max_depth:
            return []

        try:
            entries = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
        except (OSError, PermissionError):
            return [f"{prefix}├── [Permission Denied]"]

        dirs = []
        files = []

        for entry in entries:
            if not include_hidden and entry.name.startswith('.'):
                continue

            if entry.is_dir():
                if not self.should_ignore_directory(entry.name):
                    dirs.append(entry)
            else:
                if include_files and not self.should_ignore_file(entry.name):
                    files.append(entry)

        result = []
        all_items = [(d, 'dir') for d in dirs] + [(f, 'file') for f in files]

        for i, (item, item_type) in enumerate(all_items):
            is_last = i == len(all_items) - 1
            current_prefix = "└── " if is_last else "├── "

            if item_type == 'dir':
                result.append(f"{prefix}{current_prefix}{item.name}/")
                next_prefix = prefix + ("    " if is_last else "│   ")
                sub_items = self._build_tree_text(
                    item, max_depth, current_depth + 1, next_prefix, include_files, include_hidden
                )
                result.extend(sub_items)
            else:
                size_str = self._format_file_size(item.stat().st_size)
                result.append(f"{prefix}{current_prefix}{item.name} ({size_str})")

        return result

    def _get_file_metadata(self, path: Path) -> Dict[str, Any]:
        """Get file metadata"""
        try:
            stat_info = path.stat()
            return {
                'path': str(path),
                'name': path.name,
                'size_bytes': stat_info.st_size,
                'size_readable': self._format_file_size(stat_info.st_size),
                'modified': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                'created': datetime.fromtimestamp(stat_info.st_ctime).isoformat(),
                'extension': path.suffix.lower()
            }
        except Exception as e:
            return {
                'path': str(path),
                'name': path.name,
                'error': str(e)
            }

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}PB"

    def _format_as_markdown(self, root_path: Path, tree_lines: List[str]) -> str:
        """Format tree as markdown"""
        content = [
            f"# Directory Tree: {root_path.name}",
            "",
            f"**Path:** `{root_path}`",
            f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "```",
            f"{root_path.name}/",
        ]
        content.extend(tree_lines)
        content.extend([
            "```",
            "",
            "---",
            "*Generated by MCP Unified Server - Codebase Module*"
        ])

        return "\n".join(content)


_TREE_GENERATOR_PROVIDER = SerializedSingletonProvider(
    DirectoryTreeGenerator,
    "mcp.directory_tree.provider",
    "MCPDirectoryTreeProviderThread",
)


def get_directory_tree_generator_singleton(
    project_root: Optional[Path] = None,
    enable_global_access: bool = True
) -> DirectoryTreeGenerator:
    """Get singleton instance of DirectoryTreeGenerator"""
    return _TREE_GENERATOR_PROVIDER.get(project_root, enable_global_access)

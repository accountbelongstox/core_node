#!/usr/bin/env python3
"""
File search and content search utilities
Unified from CodebaseScanner functionality
"""

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from pycore.pyutils.mcp.codebase.tree_generator import (
    IGNORE_DIRS,
    IGNORE_FILE_EXTENSIONS
)

logger = logging.getLogger(__name__)


class CodebaseFileSearcher:
    """
    Provides file search and content search capabilities
    Optimized for large codebases with smart filtering
    """

    def __init__(self, project_root: Optional[Path] = None, enable_global_access: bool = True):
        self.project_root = project_root if project_root else Path.cwd()
        self.enable_global_access = enable_global_access
        logger.debug("[CodebaseFileSearcher] Initialized")

    def normalize_path(self, path_str: str) -> Path:
        """Normalize and validate path"""
        path = Path(path_str)

        if not path.is_absolute():
            path = self.project_root / path

        path = path.resolve()

        if not self.enable_global_access:
            try:
                path.relative_to(self.project_root.resolve())
            except ValueError:
                raise ValueError(f"Access denied: Path {path} is outside project root")

        return path

    def find_files_by_name_or_pattern(
        self,
        filename_pattern: str,
        search_path: Optional[str] = None,
        exact_match: bool = False,
        case_sensitive: bool = False,
        max_results: int = 100
    ) -> Dict[str, Any]:
        """
        Find files by filename or pattern

        Args:
            filename_pattern: Filename or regex pattern to search for
            search_path: Path to search in (defaults to project root)
            exact_match: If True, only exact matches
            case_sensitive: If True, case-sensitive search
            max_results: Maximum number of results

        Returns:
            Search results with file paths and metadata
        """
        try:
            if search_path:
                root_path = self.normalize_path(search_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {'error': f"Search path does not exist: {root_path}"}

            results = []
            count = 0

            # Compile pattern
            flags = 0 if case_sensitive else re.IGNORECASE

            if exact_match:
                pattern = re.compile(f"^{re.escape(filename_pattern)}$", flags)
            else:
                # Try as regex first, fallback to literal search
                try:
                    pattern = re.compile(filename_pattern, flags)
                except re.error:
                    pattern = re.compile(re.escape(filename_pattern), flags)

            # Search files
            for file_path in self._walk_directory(root_path):
                if count >= max_results:
                    break

                if pattern.search(file_path.name):
                    stat_info = file_path.stat()
                    results.append({
                        'filename': file_path.name,
                        'path': str(file_path),
                        'relative_path': str(file_path.relative_to(root_path)),
                        'size_bytes': stat_info.st_size,
                        'modified': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                        'extension': file_path.suffix.lower()
                    })
                    count += 1

            return {
                'success': True,
                'query': filename_pattern,
                'search_path': str(root_path),
                'exact_match': exact_match,
                'case_sensitive': case_sensitive,
                'results_count': len(results),
                'truncated': count >= max_results,
                'max_results_limit': max_results,
                'results': results,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error("[CodebaseFileSearcher] File search failed: %s", e)
            return {'error': f"File search failed: {str(e)}"}

    def search_content_in_files(
        self,
        search_text: str,
        search_path: Optional[str] = None,
        file_pattern: Optional[str] = None,
        case_sensitive: bool = False,
        context_lines: int = 0,
        max_results: int = 100,
        max_matches_per_file: int = 10
    ) -> Dict[str, Any]:
        """
        Search for text content within files

        Args:
            search_text: Text to search for
            search_path: Path to search in
            file_pattern: Regex pattern to filter files (e.g., ".*\\.py$")
            case_sensitive: If True, case-sensitive search
            context_lines: Number of context lines before/after matches
            max_results: Maximum number of files to return
            max_matches_per_file: Maximum matches per file

        Returns:
            Search results with file paths, line numbers, and content
        """
        try:
            if search_path:
                root_path = self.normalize_path(search_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {'error': f"Search path does not exist: {root_path}"}

            results = []
            count = 0

            # Compile content pattern
            flags = 0 if case_sensitive else re.IGNORECASE
            try:
                content_pattern = re.compile(search_text, flags)
            except re.error:
                content_pattern = re.compile(re.escape(search_text), flags)

            # Compile file filter pattern
            file_filter = None
            if file_pattern:
                try:
                    file_filter = re.compile(file_pattern, re.IGNORECASE)
                except re.error:
                    file_filter = re.compile(re.escape(file_pattern), re.IGNORECASE)

            # Search files
            for file_path in self._walk_directory(root_path):
                if count >= max_results:
                    break

                # Apply file filter
                if file_filter and not file_filter.search(file_path.name):
                    continue

                # Search file content
                try:
                    matches = self._search_file_content(
                        file_path,
                        content_pattern,
                        context_lines,
                        max_matches_per_file
                    )

                    if matches:
                        results.append({
                            'file': str(file_path),
                            'relative_path': str(file_path.relative_to(root_path)),
                            'matches_count': len(matches),
                            'matches': matches
                        })
                        count += 1

                except (UnicodeDecodeError, PermissionError):
                    continue

            return {
                'success': True,
                'query': search_text,
                'search_path': str(root_path),
                'file_pattern': file_pattern,
                'case_sensitive': case_sensitive,
                'files_with_matches': len(results),
                'truncated': count >= max_results,
                'max_results_limit': max_results,
                'results': results,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error("[CodebaseFileSearcher] Content search failed: %s", e)
            return {'error': f"Content search failed: {str(e)}"}

    def get_codebase_statistics(
        self,
        target_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive codebase statistics

        Args:
            target_path: Path to analyze (defaults to project root)

        Returns:
            Statistics including file counts, sizes, and type distribution
        """
        try:
            if target_path:
                root_path = self.normalize_path(target_path)
            else:
                root_path = self.project_root

            if not root_path.exists():
                return {'error': f"Path does not exist: {root_path}"}

            stats = {
                'total_files': 0,
                'total_size_bytes': 0,
                'total_directories': 0,
                'file_types': {},
                'language_distribution': {}
            }

            # Language mapping by extension
            language_map = {
                '.py': 'Python',
                '.js': 'JavaScript',
                '.ts': 'TypeScript',
                '.jsx': 'React JSX',
                '.tsx': 'React TSX',
                '.vue': 'Vue',
                '.java': 'Java',
                '.cpp': 'C++',
                '.c': 'C',
                '.h': 'C/C++ Header',
                '.go': 'Go',
                '.rs': 'Rust',
                '.php': 'PHP',
                '.rb': 'Ruby',
                '.dart': 'Dart',
                '.swift': 'Swift',
                '.kt': 'Kotlin',
                '.sql': 'SQL',
                '.md': 'Markdown',
                '.json': 'JSON',
                '.yaml': 'YAML',
                '.yml': 'YAML',
                '.xml': 'XML',
                '.html': 'HTML',
                '.css': 'CSS',
                '.scss': 'SCSS',
                '.sass': 'Sass',
                '.sh': 'Shell',
                '.bat': 'Batch'
            }

            # Collect statistics
            for file_path in self._walk_directory(root_path):
                stats['total_files'] += 1
                file_size = file_path.stat().st_size
                stats['total_size_bytes'] += file_size

                ext = file_path.suffix.lower() or 'no_extension'

                # File type statistics
                if ext not in stats['file_types']:
                    stats['file_types'][ext] = {'count': 0, 'size_bytes': 0}
                stats['file_types'][ext]['count'] += 1
                stats['file_types'][ext]['size_bytes'] += file_size

                # Language distribution
                if ext in language_map:
                    lang = language_map[ext]
                    if lang not in stats['language_distribution']:
                        stats['language_distribution'][lang] = {'count': 0, 'size_bytes': 0}
                    stats['language_distribution'][lang]['count'] += 1
                    stats['language_distribution'][lang]['size_bytes'] += file_size

            # Count directories
            for dir_path in root_path.rglob("*"):
                if dir_path.is_dir():
                    dir_name = dir_path.name
                    if not any(dir_name.lower() == p.lower() for p in IGNORE_DIRS if '*' not in p):
                        stats['total_directories'] += 1

            # Add readable sizes
            stats['total_size_mb'] = round(stats['total_size_bytes'] / (1024 * 1024), 2)
            stats['total_size_gb'] = round(stats['total_size_bytes'] / (1024 * 1024 * 1024), 4)

            return {
                'success': True,
                'path': str(root_path),
                'statistics': stats,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error("[CodebaseFileSearcher] Statistics failed: %s", e)
            return {'error': f"Statistics failed: {str(e)}"}

    def _walk_directory(self, root_path: Path):
        """Walk directory and yield file paths, respecting ignore patterns"""
        try:
            for entry in root_path.iterdir():
                if entry.is_dir():
                    dir_name_lower = entry.name.lower()
                    # Check if directory should be ignored
                    should_ignore = False
                    for pattern in IGNORE_DIRS:
                        if '*' in pattern:
                            regex = pattern.replace('*', '.*')
                            if re.match(regex, dir_name_lower):
                                should_ignore = True
                                break
                        elif dir_name_lower == pattern.lower() or entry.name == pattern:
                            should_ignore = True
                            break

                    if not should_ignore:
                        yield from self._walk_directory(entry)

                elif entry.is_file():
                    # Check if file should be ignored
                    ext = entry.suffix.lower()
                    if ext not in IGNORE_FILE_EXTENSIONS and not entry.name.startswith('.'):
                        yield entry

        except (PermissionError, OSError):
            pass

    def _search_file_content(
        self,
        file_path: Path,
        pattern: re.Pattern,
        context_lines: int,
        max_matches: int
    ) -> List[Dict[str, Any]]:
        """Search content within a single file"""
        matches = []

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()

            for line_num, line in enumerate(lines, 1):
                if len(matches) >= max_matches:
                    break

                if pattern.search(line):
                    match_info = {
                        'line_number': line_num,
                        'content': line.rstrip()
                    }

                    # Add context lines if requested
                    if context_lines > 0:
                        start = max(0, line_num - context_lines - 1)
                        end = min(len(lines), line_num + context_lines)

                        match_info['context_before'] = [
                            lines[i].rstrip() for i in range(start, line_num - 1)
                        ]
                        match_info['context_after'] = [
                            lines[i].rstrip() for i in range(line_num, end)
                        ]

                    matches.append(match_info)

        except (UnicodeDecodeError, PermissionError):
            pass

        return matches


# Singleton instance
_file_searcher_singleton: Optional[CodebaseFileSearcher] = None


def get_codebase_file_searcher_singleton(
    project_root: Optional[Path] = None,
    enable_global_access: bool = True
) -> CodebaseFileSearcher:
    """Get singleton instance of CodebaseFileSearcher"""
    global _file_searcher_singleton
    if _file_searcher_singleton is None:
        _file_searcher_singleton = CodebaseFileSearcher(project_root, enable_global_access)
    return _file_searcher_singleton

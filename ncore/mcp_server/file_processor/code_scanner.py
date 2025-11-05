#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Code Chinese Character Scanner
Scan code files for Chinese characters with intelligent filtering
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Set, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class CodeScanner:
    """Scanner for detecting Chinese characters in code files"""

    # Default code file extensions
    DEFAULT_EXTENSIONS = {
        # JavaScript/TypeScript
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        # Python
        '.py', '.pyw', '.pyi',
        # Dart
        '.dart',
        # Vue
        '.vue',
        # Java
        '.java', '.kt', '.kts',
        # Go
        '.go',
        # Shell scripts
        '.sh', '.bash', '.zsh', '.fish',
        # PowerShell
        '.ps1', '.psm1', '.psd1',
        # C/C++
        '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
        # C#
        '.cs',
        # Ruby
        '.rb',
        # PHP
        '.php',
        # Rust
        '.rs',
        # Swift
        '.swift',
        # Kotlin
        '.kt',
        # Scala
        '.scala',
        # R
        '.r', '.R',
        # Perl
        '.pl', '.pm',
        # Lua
        '.lua',
        # SQL
        '.sql',
        # HTML/CSS
        '.html', '.htm', '.css', '.scss', '.sass', '.less',
        # Config files
        '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config',
        # Markdown
        '.md', '.markdown',
        # XML
        '.xml',
    }

    # Directories to exclude
    EXCLUDE_DIRS = {
        'node_modules', '.git', '.svn', '.hg', 'dist', 'build',
        '__pycache__', '.pytest_cache', '.mypy_cache', '.tox',
        'venv', 'env', '.env', '.venv', 'virtualenv',
        'target', 'out', 'bin', 'obj',
        '.idea', '.vscode', '.vs',
        'bower_components', 'jspm_packages',
        'coverage', '.nyc_output',
        'vendor', 'packages', 'pkg',
        '.dart_tool', '.pub-cache',
        '.gradle', 'gradle',
    }

    # Files to exclude
    EXCLUDE_FILES = {
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        'Cargo.lock', 'Gemfile.lock', 'Pipfile.lock',
        'poetry.lock', 'pubspec.lock',
        '.DS_Store', 'Thumbs.db',
    }

    # Chinese character regex pattern (CJK Unified Ideographs only)
    # Only matches actual Chinese/Japanese/Korean characters, not English/numbers
    CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]+')

    def __init__(self):
        self.results = []
        self.stats = {
            'total_files_scanned': 0,
            'files_with_chinese': 0,
            'total_chinese_chars': 0,
            'skipped_directories': 0,
            'errors': 0,
        }

    def should_skip_directory(self, dir_path: Path) -> bool:
        """Check if directory should be skipped"""
        dir_name = dir_path.name.lower()
        return dir_name in self.EXCLUDE_DIRS or dir_name.startswith('.')

    def should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped"""
        file_name = file_path.name
        return file_name in self.EXCLUDE_FILES

    def is_code_file(self, file_path: Path, extensions: Optional[Set[str]] = None) -> bool:
        """Check if file is a code file based on extension"""
        if extensions is None:
            extensions = self.DEFAULT_EXTENSIONS
        return file_path.suffix.lower() in extensions

    def find_chinese_in_line(self, line: str, line_num: int) -> List[Dict]:
        """Find all Chinese characters in a line"""
        matches = []
        for match in self.CHINESE_PATTERN.finditer(line):
            matches.append({
                'line_number': line_num,
                'column': match.start() + 1,
                'text': match.group(),
                'line_content': line.rstrip()
            })
        return matches

    def scan_file(self, file_path: Path) -> Optional[Dict]:
        """Scan a single file for Chinese characters"""
        try:
            # Try multiple encodings
            encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5']
            content = None
            used_encoding = None

            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                    used_encoding = encoding
                    break
                except (UnicodeDecodeError, LookupError):
                    continue

            if content is None:
                logger.warning(f"Could not decode file: {file_path}")
                self.stats['errors'] += 1
                return None

            # Find Chinese characters
            chinese_found = []
            lines = content.split('\n')

            for line_num, line in enumerate(lines, 1):
                matches = self.find_chinese_in_line(line, line_num)
                if matches:
                    chinese_found.extend(matches)

            if chinese_found:
                self.stats['files_with_chinese'] += 1
                self.stats['total_chinese_chars'] += sum(len(m['text']) for m in chinese_found)

                return {
                    'file_path': str(file_path),
                    'encoding': used_encoding,
                    'occurrences': len(chinese_found),
                    'matches': chinese_found
                }

            return None

        except Exception as e:
            logger.error(f"Error scanning file {file_path}: {e}")
            self.stats['errors'] += 1
            return None

    def scan_directory(
        self,
        directory: str,
        extensions: Optional[List[str]] = None,
        max_depth: int = -1
    ) -> Dict:
        """
        Scan directory recursively for Chinese characters in code files

        Args:
            directory: Root directory to scan
            extensions: List of file extensions to scan (e.g., ['.py', '.js'])
                       If None, scans all default code file types
            max_depth: Maximum recursion depth (-1 for unlimited)

        Returns:
            Dictionary with scan results and statistics
        """
        directory = Path(directory)

        if not directory.exists():
            return {
                'success': False,
                'error': f"Directory not found: {directory}"
            }

        if not directory.is_dir():
            return {
                'success': False,
                'error': f"Path is not a directory: {directory}"
            }

        # Convert extensions list to set
        ext_set = None
        if extensions:
            ext_set = {ext if ext.startswith('.') else f'.{ext}' for ext in extensions}

        # Reset results
        self.results = []
        self.stats = {
            'total_files_scanned': 0,
            'files_with_chinese': 0,
            'total_chinese_chars': 0,
            'skipped_directories': 0,
            'errors': 0,
        }

        # Scan directory
        self._scan_recursive(directory, ext_set, max_depth, 0)

        return {
            'success': True,
            'directory': str(directory),
            'extensions': list(ext_set) if ext_set else 'all',
            'stats': self.stats,
            'files': self.results
        }

    def _scan_recursive(
        self,
        current_dir: Path,
        extensions: Optional[Set[str]],
        max_depth: int,
        current_depth: int
    ):
        """Recursive directory scanning"""
        # Check depth limit
        if max_depth >= 0 and current_depth > max_depth:
            return

        try:
            for item in current_dir.iterdir():
                # Skip hidden files/directories
                if item.name.startswith('.') and item.name not in {'.dart_tool'}:
                    continue

                if item.is_dir():
                    # Check if directory should be skipped
                    if self.should_skip_directory(item):
                        self.stats['skipped_directories'] += 1
                        continue

                    # Recurse into subdirectory
                    self._scan_recursive(item, extensions, max_depth, current_depth + 1)

                elif item.is_file():
                    # Check if file should be skipped
                    if self.should_skip_file(item):
                        continue

                    # Check if it's a code file
                    if self.is_code_file(item, extensions):
                        self.stats['total_files_scanned'] += 1

                        # Scan file
                        result = self.scan_file(item)
                        if result:
                            self.results.append(result)

        except PermissionError:
            logger.warning(f"Permission denied: {current_dir}")
            self.stats['errors'] += 1
        except Exception as e:
            logger.error(f"Error scanning directory {current_dir}: {e}")
            self.stats['errors'] += 1

    def format_results_text(self, results: Dict) -> str:
        """Format scan results as readable text"""
        if not results['success']:
            return f"Error: {results.get('error', 'Unknown error')}"

        lines = []
        lines.append("=" * 80)
        lines.append("CODE CHINESE CHARACTER SCAN RESULTS")
        lines.append("=" * 80)
        lines.append(f"Directory: {results['directory']}")
        lines.append(f"Extensions: {results['extensions']}")
        lines.append("")

        # Statistics
        stats = results['stats']
        lines.append("Statistics:")
        lines.append(f"  Total files scanned: {stats['total_files_scanned']}")
        lines.append(f"  Files with Chinese: {stats['files_with_chinese']}")
        lines.append(f"  Total Chinese characters: {stats['total_chinese_chars']}")
        lines.append(f"  Skipped directories: {stats['skipped_directories']}")
        lines.append(f"  Errors: {stats['errors']}")
        lines.append("")

        # Files with Chinese
        if results['files']:
            lines.append("=" * 80)
            lines.append("FILES WITH CHINESE CHARACTERS")
            lines.append("=" * 80)
            lines.append("")

            for file_info in results['files']:
                lines.append(f"File: {file_info['file_path']}")
                lines.append(f"Encoding: {file_info['encoding']}")
                lines.append(f"Occurrences: {file_info['occurrences']}")
                lines.append("-" * 80)

                for match in file_info['matches']:
                    lines.append(f"  Line {match['line_number']}, Column {match['column']}")
                    lines.append(f"  Chinese: {match['text']}")
                    lines.append(f"  Content: {match['line_content'][:100]}")
                    lines.append("")

                lines.append("")
        else:
            lines.append("No Chinese characters found in code files.")

        lines.append("=" * 80)

        return '\n'.join(lines)


# Singleton instance
scanner = CodeScanner()

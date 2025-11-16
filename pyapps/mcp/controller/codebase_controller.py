#!/usr/bin/env python3
"""
Codebase controller for MCP unified server
Provides simplified interface to codebase analysis operations
"""

import os
from pathlib import Path
from typing import Dict, Optional, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.mcp.codebase import (
    get_directory_tree_generator_singleton,
    get_codebase_file_searcher_singleton,
    get_codebase_content_analyzer_singleton
)


class CodebaseController:
    """
    Controller for codebase operations in MCP unified server
    Provides high-level interface to codebase analysis utilities
    """

    def __init__(self, project_root: Optional[Path] = None):
        # Determine project root
        if project_root:
            self.project_root = project_root
        else:
            # Auto-detect from environment or use current working directory
            env_root = os.environ.get('MCP_PROJECT_ROOT')
            self.project_root = Path(env_root) if env_root else Path.cwd()

        # Determine global access setting
        self.enable_global_access = os.environ.get('MCP_ALLOW_ALL_PATHS', 'false').lower() == 'true'

        # Initialize utilities with shared settings
        self.tree_generator = get_directory_tree_generator_singleton(
            project_root=self.project_root,
            enable_global_access=self.enable_global_access
        )
        self.file_searcher = get_codebase_file_searcher_singleton(
            project_root=self.project_root,
            enable_global_access=self.enable_global_access
        )
        self.content_analyzer = get_codebase_content_analyzer_singleton(
            project_root=self.project_root,
            enable_global_access=self.enable_global_access
        )

        ColorPrint.green(f"[CodebaseController] Initialized with project root: {self.project_root}")

    async def get_directory_tree_with_multiple_formats(
        self,
        target_path: Optional[str] = None,
        max_depth: int = 5,
        include_files: bool = True,
        include_hidden: bool = False,
        output_format: str = "both"
    ) -> Dict[str, Any]:
        """
        Generate directory tree in multiple formats

        Args:
            target_path: Path to scan (defaults to project root)
            max_depth: Maximum recursion depth
            include_files: Include files in tree
            include_hidden: Include hidden files/directories
            output_format: "json", "text", "markdown", or "both"

        Returns:
            Directory tree in requested format(s)
        """
        try:
            result = self.tree_generator.generate_directory_tree_with_multiple_formats(
                target_path=target_path,
                max_depth=max_depth,
                include_files=include_files,
                include_hidden=include_hidden,
                output_format=output_format
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] Tree generation failed: {e}")
            return {'error': str(e)}

    async def find_files_by_pattern(
        self,
        filename_pattern: str,
        search_path: Optional[str] = None,
        exact_match: bool = False,
        case_sensitive: bool = False,
        max_results: int = 100
    ) -> Dict[str, Any]:
        """
        Find files by name or pattern

        Args:
            filename_pattern: Filename or regex pattern
            search_path: Path to search in
            exact_match: If True, only exact matches
            case_sensitive: If True, case-sensitive search
            max_results: Maximum results

        Returns:
            Search results with file paths and metadata
        """
        try:
            result = self.file_searcher.find_files_by_name_or_pattern(
                filename_pattern=filename_pattern,
                search_path=search_path,
                exact_match=exact_match,
                case_sensitive=case_sensitive,
                max_results=max_results
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] File search failed: {e}")
            return {'error': str(e)}

    async def search_content_in_files(
        self,
        search_text: str,
        search_path: Optional[str] = None,
        file_pattern: Optional[str] = None,
        case_sensitive: bool = False,
        context_lines: int = 0,
        max_results: int = 100
    ) -> Dict[str, Any]:
        """
        Search for text content within files

        Args:
            search_text: Text to search for
            search_path: Path to search in
            file_pattern: Regex to filter files
            case_sensitive: Case-sensitive search
            context_lines: Context lines before/after matches
            max_results: Maximum files to return

        Returns:
            Search results with line numbers and content
        """
        try:
            result = self.file_searcher.search_content_in_files(
                search_text=search_text,
                search_path=search_path,
                file_pattern=file_pattern,
                case_sensitive=case_sensitive,
                context_lines=context_lines,
                max_results=max_results
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] Content search failed: {e}")
            return {'error': str(e)}

    async def get_file_content_with_comprehensive_analysis(
        self,
        file_path: str,
        max_chars: int = 16000,
        include_ocr: bool = True,
        include_color_analysis: bool = True,
        include_document_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Get file content with comprehensive analysis

        For images: OCR, color analysis, metadata
        For documents: Text extraction, metadata, page info
        For code/text: Content with syntax detection

        Args:
            file_path: Path to file
            max_chars: Maximum characters to return
            include_ocr: Include OCR for images
            include_color_analysis: Include color analysis for images
            include_document_metadata: Include document metadata

        Returns:
            Comprehensive file analysis
        """
        try:
            result = await self.content_analyzer.get_file_content_with_comprehensive_analysis(
                file_path=file_path,
                max_chars=max_chars,
                include_ocr=include_ocr,
                include_color_analysis=include_color_analysis,
                include_document_metadata=include_document_metadata
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] File content analysis failed: {e}")
            return {'error': str(e)}

    async def analyze_codebase_statistics(
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
            result = self.file_searcher.get_codebase_statistics(
                target_path=target_path
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] Statistics failed: {e}")
            return {'error': str(e)}

    async def describe_directory_with_summary(
        self,
        directory_path: str,
        include_file_count: bool = True,
        include_size_stats: bool = True,
        include_type_distribution: bool = True
    ) -> Dict[str, Any]:
        """
        Describe directory with file overview

        Args:
            directory_path: Path to directory
            include_file_count: Include file counts
            include_size_stats: Include size statistics
            include_type_distribution: Include file type distribution

        Returns:
            Directory description with statistics
        """
        try:
            result = self.content_analyzer.describe_directory_with_file_overview(
                directory_path=directory_path,
                include_file_count=include_file_count,
                include_size_stats=include_size_stats,
                include_type_distribution=include_type_distribution
            )

            return result

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] Directory description failed: {e}")
            return {'error': str(e)}

    async def scan_for_framework_applications(
        self,
        scan_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scan for common framework applications (Flutter, Vue, React, etc.)

        Args:
            scan_path: Path to scan (defaults to project root)

        Returns:
            Detected frameworks and application structures
        """
        try:
            scan_root = Path(scan_path) if scan_path else self.project_root

            detected_frameworks = {
                'flutter': [],
                'vue': [],
                'react': [],
                'laravel': [],
                'django': [],
                'fastapi': []
            }

            # Scan for Flutter apps
            flutter_apps_dir = scan_root / "lib" / "apps"
            if flutter_apps_dir.exists():
                flutter_apps = [
                    d.name for d in flutter_apps_dir.iterdir()
                    if d.is_dir() and not d.name.startswith('.')
                ]
                detected_frameworks['flutter'] = flutter_apps

            # Scan for Vue apps
            vue_apps_dir = scan_root / "apps"
            if vue_apps_dir.exists():
                vue_apps = [
                    d.name for d in vue_apps_dir.iterdir()
                    if d.is_dir() and (d / "app.vue").exists()
                ]
                detected_frameworks['vue'] = vue_apps

            # Scan for React apps
            react_src_dir = scan_root / "src"
            if react_src_dir.exists() and (scan_root / "package.json").exists():
                detected_frameworks['react'] = ['main']

            # Scan for Laravel apps
            laravel_apps_dir = scan_root / "app" / "Apps"
            if laravel_apps_dir.exists():
                laravel_apps = [
                    d.name for d in laravel_apps_dir.iterdir()
                    if d.is_dir() and not d.name.startswith('.')
                ]
                detected_frameworks['laravel'] = laravel_apps

            return {
                'success': True,
                'scan_path': str(scan_root),
                'detected_frameworks': detected_frameworks,
                'total_applications': sum(len(apps) for apps in detected_frameworks.values())
            }

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] Framework scan failed: {e}")
            return {'error': str(e)}

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on codebase subsystem

        Returns:
            Health check results
        """
        try:
            return {
                'success': True,
                'subsystem': 'codebase',
                'project_root': str(self.project_root),
                'global_access_enabled': self.enable_global_access,
                'utilities': {
                    'tree_generator': 'active',
                    'file_searcher': 'active',
                    'content_analyzer': 'active'
                }
            }

        except Exception as e:
            ColorPrint.red(f"[CodebaseController] Health check failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance
_codebase_controller_singleton: Optional[CodebaseController] = None


def get_codebase_controller_singleton(project_root: Optional[Path] = None) -> CodebaseController:
    """Get singleton instance of CodebaseController"""
    global _codebase_controller_singleton
    if _codebase_controller_singleton is None:
        _codebase_controller_singleton = CodebaseController(project_root)
    return _codebase_controller_singleton

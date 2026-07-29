#!/usr/bin/env python3
"""
File content analysis with multi-format support
Integrates with MCP file processing for comprehensive file analysis
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider

from pycore.pyutils.mcp.file_info_extractor_with_ocr_text_positions_color_palette_and_metadata import get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats

logger = logging.getLogger(__name__)


class CodebaseContentAnalyzer:
    """
    Analyzes file content with support for multiple formats
    Integrates with existing file_processing module for images, PDFs, documents, etc.
    """

    def __init__(self, project_root: Optional[Path] = None, enable_global_access: bool = True):
        self.project_root = project_root if project_root else Path.cwd()
        self.enable_global_access = enable_global_access

        logger.debug("[CodebaseContentAnalyzer] Initialized")

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

        For images: Returns OCR text, positions, color palette, size
        For documents: Returns text, metadata, page info
        For code/text: Returns content with syntax detection

        Args:
            file_path: Path to file
            max_chars: Maximum characters to return
            include_ocr: Include OCR for images
            include_color_analysis: Include color analysis for images
            include_document_metadata: Include metadata for documents

        Returns:
            Comprehensive file analysis
        """
        try:
            resolved_path = self.normalize_path(file_path)

            if not resolved_path.exists():
                return {'error': f"File not found: {file_path}"}

            if not resolved_path.is_file():
                return {'error': f"Path is not a file: {file_path}"}

            # Get file extension to determine processing strategy
            file_ext = resolved_path.suffix.lower()

            # Use file_processing module for comprehensive analysis
            if file_ext in {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp', '.svg'}:
                # Image file - use file processing utility
                options = {
                    'enable_ocr': include_ocr,
                    'extract_color_palette': include_color_analysis,
                    'ocr_model': 'auto'
                }
                result = await get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
                    file_path=str(resolved_path),
                    options=options
                )

                return {
                    'success': True,
                    'file_type': 'image',
                    'path': str(resolved_path),
                    'analysis': result,
                    'timestamp': datetime.now().isoformat()
                }

            elif file_ext in {'.pdf', '.docx', '.xlsx', '.pptx'}:
                # Document file - use file processing utility
                options = {
                    'enable_ocr': False,  # Documents already have text extraction
                    'extract_color_palette': False
                }
                result = await get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
                    file_path=str(resolved_path),
                    options=options
                )

                return {
                    'success': True,
                    'file_type': 'document',
                    'path': str(resolved_path),
                    'analysis': result,
                    'timestamp': datetime.now().isoformat()
                }

            else:
                # Text/code file - simple text reading
                content = self._read_text_file(resolved_path, max_chars)

                return {
                    'success': True,
                    'file_type': 'text',
                    'path': str(resolved_path),
                    'metadata': self._get_file_metadata(resolved_path),
                    'content': content,
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error("[CodebaseContentAnalyzer] File analysis failed: %s", e)
            return {'error': f"File analysis failed: {str(e)}"}

    def describe_directory_with_file_overview(
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
            resolved_path = self.normalize_path(directory_path)

            if not resolved_path.exists():
                return {'error': f"Directory not found: {directory_path}"}

            if not resolved_path.is_dir():
                return {'error': f"Path is not a directory: {directory_path}"}

            summary = {
                'path': str(resolved_path),
                'name': resolved_path.name
            }

            if include_file_count:
                files = list(resolved_path.glob('*'))
                summary['total_items'] = len(files)
                summary['directories'] = sum(1 for f in files if f.is_dir())
                summary['files'] = sum(1 for f in files if f.is_file())

            if include_size_stats:
                total_size = sum(
                    f.stat().st_size for f in resolved_path.glob('*') if f.is_file()
                )
                summary['total_size_bytes'] = total_size
                summary['total_size_mb'] = round(total_size / (1024 * 1024), 2)

            if include_type_distribution:
                type_dist = {}
                for file in resolved_path.glob('*'):
                    if file.is_file():
                        ext = file.suffix.lower() or 'no_extension'
                        type_dist[ext] = type_dist.get(ext, 0) + 1
                summary['file_type_distribution'] = type_dist

            return {
                'success': True,
                'summary': summary,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error("[CodebaseContentAnalyzer] Directory description failed: %s", e)
            return {'error': f"Directory description failed: {str(e)}"}

    def _read_text_file(self, file_path: Path, max_chars: int) -> Dict[str, Any]:
        """Read text file content"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(max_chars)

            return {
                'text': content,
                'truncated': len(content) >= max_chars,
                'encoding': 'utf-8',
                'lines': content.count('\n') + 1 if content else 0
            }

        except Exception as e:
            return {'error': str(e)}

    def _get_file_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Get basic file metadata"""
        try:
            stat_info = file_path.stat()
            return {
                'size_bytes': stat_info.st_size,
                'size_mb': round(stat_info.st_size / (1024 * 1024), 4),
                'modified': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                'created': datetime.fromtimestamp(stat_info.st_ctime).isoformat(),
                'extension': file_path.suffix.lower(),
                'filename': file_path.name
            }
        except Exception as e:
            return {'error': str(e)}


_CONTENT_ANALYZER_PROVIDER = SerializedSingletonProvider(
    CodebaseContentAnalyzer,
    "mcp.codebase_content_analyzer.provider",
    "MCPCodebaseContentAnalyzerProviderThread",
)


def get_codebase_content_analyzer_singleton(
    project_root: Optional[Path] = None,
    enable_global_access: bool = True
) -> CodebaseContentAnalyzer:
    """Get singleton instance of CodebaseContentAnalyzer"""
    return _CONTENT_ANALYZER_PROVIDER.get(project_root, enable_global_access)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document + conversion MCP tool wrappers for the File Processor MCP Server.

Extracted from main.py. Each tool is registered against the shared mcp instance
passed into register_document_tools(mcp). Runtime globals (parser, converter)
are read via function-local imports from server to avoid stale captures and
circular imports.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from package_manager import PackageManager

logger = logging.getLogger(__name__)


def register_document_tools(mcp):
    """Register document parsing / conversion / writing MCP tools."""

    @mcp.tool()
    def initialize_packages(
        format_types: Optional[List[str]] = None,
        force_reinstall: bool = False
    ) -> Dict[str, Any]:
        """
        Initialize and install required packages for document processing.

        Args:
            format_types: List of format types to initialize (pdf, xmind, office, etc.)
                     If None, initializes all packages
            force_reinstall: Force reinstallation of packages

        Returns:
            Dictionary containing initialization results
        """
        try:
            logger.info("Starting package initialization...")

            if force_reinstall:
                # Clear installation cache
                PackageManager._installation_status.clear()

            # Determine which packages to install
            if format_types is None:
                format_types = list(PackageManager.PACKAGE_MAPPING.keys())

            results = {
                "requested_formats": format_types,
                "installation_results": {},
                "successful_formats": [],
                "failed_formats": []
            }

            # Install packages for each format type
            for format_type in format_types:
                if format_type in PackageManager.PACKAGE_MAPPING:
                    logger.info(f"Initializing packages for {format_type}...")
                    success = PackageManager.ensure_packages(format_type)

                    results["installation_results"][format_type] = {
                        "success": success,
                        "packages": PackageManager.PACKAGE_MAPPING[format_type]
                    }

                    if success:
                        results["successful_formats"].append(format_type)
                    else:
                        results["failed_formats"].append(format_type)
                else:
                    results["installation_results"][format_type] = {
                        "success": False,
                        "error": "Unknown format type"
                    }
                    results["failed_formats"].append(format_type)

            logger.info(f"Package initialization completed. Success: {len(results['successful_formats'])}, Failed: {len(results['failed_formats'])}")
            return results

        except Exception as e:
            error_msg = f"Package initialization failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def parse_document(
        file_path: str,
        output_format: str = "json",
        extract_tables: bool = True,
        extract_images: bool = False,
        ocr_confidence: int = 30
    ) -> Dict[str, Any]:
        """
        Parse various document formats and extract AI-readable content.

        Supported formats:
        - PDF files (text extraction and OCR)
        - XMind files (mind maps)
        - Word documents (.docx, .doc)
        - Excel spreadsheets (.xlsx, .xls)
        - PowerPoint presentations (.pptx, .ppt)
        - Images (OCR extraction)
        - Text files (.txt, .md, .json, .xml)

        Args:
            file_path: Path to the document file
            output_format: Output format (json, xml, markdown)
            extract_tables: Whether to extract tables (for supported formats)
            extract_images: Whether to extract images (for supported formats)
            ocr_confidence: Minimum OCR confidence threshold (0-100)

        Returns:
            Dictionary containing parsed content, metadata, and structure
        """
        try:
            # Normalize path
            file_path = os.path.abspath(file_path)

            logger.info(f"Parsing document: {file_path}")
            logger.info(f"Output format: {output_format}")

            # parser is a runtime singleton owned by server.
            from server import parser

            # Parse document
            result = parser.parse_file(
                file_path=file_path,
                output_format=output_format,
                extract_tables=extract_tables,
                extract_images=extract_images,
                ocr_confidence=ocr_confidence
            )

            # Format output based on requested format
            if output_format.lower() == "xml" and "error" not in result:
                try:
                    if PackageManager.ensure_packages('xml'):
                        from dicttoxml import dicttoxml
                        xml_content = dicttoxml(result, custom_root='document', attr_type=False)
                        result["xml_output"] = xml_content.decode('utf-8')
                except Exception as e:
                    logger.warning(f"XML conversion failed: {e}")

            elif output_format.lower() == "markdown" and "error" not in result:
                try:
                    if PackageManager.ensure_packages('markdown'):
                        # Convert to markdown format
                        md_parts = []

                        # Add title
                        if "metadata" in result and "file_name" in result["metadata"]:
                            md_parts.append(f"# {result['metadata']['file_name']}")

                        # Add metadata
                        if "metadata" in result:
                            md_parts.append("## Metadata")
                            for key, value in result["metadata"].items():
                                md_parts.append(f"- **{key}**: {value}")

                        # Add content
                        if "content" in result:
                            md_parts.append("## Content")
                            if "text" in result["content"]:
                                md_parts.append(result["content"]["text"])

                        result["markdown_output"] = "\n\n".join(md_parts)
                except Exception as e:
                    logger.warning(f"Markdown conversion failed: {e}")

            logger.info(f"Document parsing completed: {result.get('type', 'unknown')} format")
            return result

        except Exception as e:
            error_msg = f"Document parsing failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg, "file_path": file_path}

    @mcp.tool()
    def list_supported_formats() -> Dict[str, Any]:
        """
        List all supported document formats and their capabilities.

        Returns:
            Dictionary containing supported formats and their features
        """
        return {
            "supported_formats": {
                "PDF": {
                    "extensions": [".pdf"],
                    "features": ["text_extraction", "table_extraction", "metadata"],
                    "description": "Portable Document Format - text and table extraction"
                },
                "XMind": {
                    "extensions": [".xmind"],
                    "features": ["structure_extraction", "text_extraction"],
                    "description": "Mind mapping files - structure and content extraction"
                },
                "Word": {
                    "extensions": [".docx", ".doc"],
                    "features": ["text_extraction", "table_extraction", "metadata", "style_preservation"],
                    "description": "Microsoft Word documents"
                },
                "Excel": {
                    "extensions": [".xlsx", ".xls"],
                    "features": ["data_extraction", "worksheet_separation", "metadata"],
                    "description": "Microsoft Excel spreadsheets"
                },
                "PowerPoint": {
                    "extensions": [".pptx", ".ppt"],
                    "features": ["text_extraction", "slide_separation", "notes_extraction"],
                    "description": "Microsoft PowerPoint presentations"
                },
                "Images": {
                    "extensions": [".jpg", ".jpeg", ".png", ".bmp", ".tiff"],
                    "features": ["ocr_extraction", "confidence_filtering"],
                    "description": "Image files with OCR text extraction"
                },
                "Text": {
                    "extensions": [".txt", ".md"],
                    "features": ["encoding_detection", "line_counting"],
                    "description": "Plain text and Markdown files"
                },
                "Structured": {
                    "extensions": [".json", ".xml"],
                    "features": ["structure_preservation", "data_extraction"],
                    "description": "JSON and XML structured data files"
                }
            },
            "output_formats": ["json", "xml", "markdown"],
            "ai_optimizations": [
                "Smart content extraction",
                "Structure preservation",
                "Metadata extraction",
                "Error handling",
                "Multi-format support"
            ]
        }

    @mcp.tool()
    def convert_document(
        input_data: str,
        from_format: str,
        to_format: str,
        output_path: Optional[str] = None,
        title: str = "Document",
        page_size: str = "A4",
        encoding: str = "UTF-8",
        ignore_links: bool = False,
        ignore_images: bool = False
    ) -> Dict[str, Any]:
        """
        Convert between different document formats.

        Supported conversions:
        - HTML to Markdown, PDF, Word (DOCX)
        - Markdown to HTML, PDF, Word (DOCX)
        - Text to HTML
        - JSON to Excel
        - Excel to JSON (requires file path as input_data)

        Args:
            input_data: Input content (string) or file path (for Excel to JSON)
            from_format: Source format (html, markdown, text, json, excel)
            to_format: Target format (markdown, html, pdf, docx, excel, json)
            output_path: Output file path (required for file formats like PDF, DOCX, Excel)
            title: Document title (for HTML generation)
            page_size: PDF page size (A4, Letter, etc.)
            encoding: Text encoding
            ignore_links: Ignore links in HTML to Markdown conversion
            ignore_images: Ignore images in HTML to Markdown conversion

        Returns:
            Dictionary containing conversion result or converted content
        """
        try:
            logger.info(f"Converting from {from_format} to {to_format}")

            # converter is a runtime singleton owned by server.
            from server import converter

            # Special handling for Excel to JSON (requires file path)
            if from_format == 'excel' and to_format == 'json':
                if not os.path.exists(input_data):
                    return {"error": f"Excel file not found: {input_data}"}
                result_data = converter.excel_to_json(input_data)
                return {
                    "success": True,
                    "from_format": from_format,
                    "to_format": to_format,
                    "data": result_data
                }

            # For JSON to Excel, parse input if it's a string
            if from_format == 'json':
                if isinstance(input_data, str):
                    try:
                        input_data = json.loads(input_data)
                    except json.JSONDecodeError as e:
                        return {"error": f"Invalid JSON data: {e}"}

            # Perform conversion
            result = converter.convert_format(
                input_data=input_data,
                from_format=from_format,
                to_format=to_format,
                output_path=output_path,
                title=title,
                page_size=page_size,
                encoding=encoding,
                ignore_links=ignore_links,
                ignore_images=ignore_images
            )

            if output_path and isinstance(result, bool):
                # File was created
                if result:
                    return {
                        "success": True,
                        "from_format": from_format,
                        "to_format": to_format,
                        "output_path": output_path,
                        "file_created": True
                    }
                else:
                    return {"error": "Conversion failed"}
            else:
                # String result
                return {
                    "success": True,
                    "from_format": from_format,
                    "to_format": to_format,
                    "content": result
                }

        except Exception as e:
            error_msg = f"Document conversion failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def write_document(
        content: str,
        output_path: str,
        format_type: str = "auto",
        metadata: Optional[Dict[str, Any]] = None,
        encoding: str = "utf-8"
    ) -> Dict[str, Any]:
        """
        Write content to a document file in various formats.

        Args:
            content: Content to write
            output_path: Output file path
            format_type: Document format (auto, text, json, html, markdown, xml)
            metadata: Optional metadata to include
            encoding: Text encoding

        Returns:
            Dictionary containing write operation result
        """
        try:
            logger.info(f"Writing document to: {output_path}")

            # Auto-detect format from file extension
            if format_type == "auto":
                ext = Path(output_path).suffix.lower()
                format_mapping = {
                    '.txt': 'text',
                    '.md': 'markdown',
                    '.html': 'html',
                    '.htm': 'html',
                    '.json': 'json',
                    '.xml': 'xml'
                }
                format_type = format_mapping.get(ext, 'text')

            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            if format_type == 'json':
                # Write as JSON
                try:
                    data = json.loads(content) if isinstance(content, str) else content
                    if metadata:
                        data = {"metadata": metadata, "content": data}
                    with open(output_path, 'w', encoding=encoding) as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                except json.JSONDecodeError:
                    # Content is not JSON, wrap it
                    data = {"content": content}
                    if metadata:
                        data["metadata"] = metadata
                    with open(output_path, 'w', encoding=encoding) as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)

            elif format_type == 'html':
                # Write as HTML
                if not content.strip().startswith('<!DOCTYPE html>'):
                    # Convert plain text to HTML
                    from server import converter
                    html_content = converter.text_to_html(
                        content,
                        title=metadata.get('title', 'Document') if metadata else 'Document'
                    )
                    content = html_content

                with open(output_path, 'w', encoding=encoding) as f:
                    f.write(content)

            elif format_type == 'xml':
                # Write as XML
                if not content.strip().startswith('<?xml'):
                    # Wrap content in XML
                    xml_content = f'<?xml version="1.0" encoding="{encoding}"?>\n<document>\n<content>{content}</content>\n</document>'
                    content = xml_content

                with open(output_path, 'w', encoding=encoding) as f:
                    f.write(content)

            else:
                # Write as plain text
                with open(output_path, 'w', encoding=encoding) as f:
                    f.write(content)

            file_size = os.path.getsize(output_path)

            return {
                "success": True,
                "output_path": output_path,
                "format_type": format_type,
                "file_size": file_size,
                "encoding": encoding
            }

        except Exception as e:
            error_msg = f"Document write failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def batch_convert(
        input_directory: str,
        output_directory: str,
        from_format: str,
        to_format: str,
        file_pattern: str = "*",
        recursive: bool = False
    ) -> Dict[str, Any]:
        """
        Batch convert multiple documents from one format to another.

        Args:
            input_directory: Directory containing input files
            output_directory: Directory for output files
            from_format: Source format
            to_format: Target format
            file_pattern: File pattern to match (e.g., "*.html")
            recursive: Search subdirectories recursively

        Returns:
            Dictionary containing batch conversion results
        """
        try:
            from pathlib import Path
            import glob

            logger.info(f"Batch converting {from_format} to {to_format}")
            logger.info(f"Input: {input_directory}, Output: {output_directory}")

            # converter is a runtime singleton owned by server.
            from server import converter

            # Ensure output directory exists
            os.makedirs(output_directory, exist_ok=True)

            # Find files
            search_pattern = os.path.join(input_directory, "**" if recursive else "", file_pattern)
            files = glob.glob(search_pattern, recursive=recursive)

            results = {
                "total_files": len(files),
                "successful": 0,
                "failed": 0,
                "details": []
            }

            for file_path in files:
                try:
                    # Read input file
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Generate output filename
                    input_name = Path(file_path).stem
                    output_ext = {
                        'html': '.html',
                        'markdown': '.md',
                        'pdf': '.pdf',
                        'docx': '.docx',
                        'text': '.txt',
                        'json': '.json',
                        'excel': '.xlsx'
                    }.get(to_format, '.txt')

                    output_path = os.path.join(output_directory, f"{input_name}{output_ext}")

                    # Convert
                    result = converter.convert_format(
                        input_data=content,
                        from_format=from_format,
                        to_format=to_format,
                        output_path=output_path if to_format in ['pdf', 'docx', 'excel'] else None
                    )

                    if to_format not in ['pdf', 'docx', 'excel'] and isinstance(result, str):
                        # Save string result
                        with open(output_path, 'w', encoding='utf-8') as f:
                            f.write(result)

                    results["successful"] += 1
                    results["details"].append({
                        "input_file": file_path,
                        "output_file": output_path,
                        "status": "success"
                    })

                except Exception as e:
                    results["failed"] += 1
                    results["details"].append({
                        "input_file": file_path,
                        "error": str(e),
                        "status": "failed"
                    })
                    logger.error(f"Failed to convert {file_path}: {e}")

            return results

        except Exception as e:
            error_msg = f"Batch conversion failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def list_conversion_formats() -> Dict[str, Any]:
        """
        List all supported format conversions.

        Returns:
            Dictionary containing all supported conversion mappings
        """
        return {
            "supported_conversions": {
                "html": ["markdown", "pdf", "docx"],
                "markdown": ["html", "pdf", "docx"],
                "text": ["html"],
                "json": ["excel"],
                "excel": ["json"]
            },
            "file_output_formats": ["pdf", "docx", "excel"],
            "string_output_formats": ["html", "markdown", "json"],
            "write_formats": ["text", "html", "markdown", "json", "xml"],
            "batch_supported": True,
            "ai_optimizations": [
                "Smart content extraction",
                "Format-aware conversion",
                "Metadata preservation",
                "Batch processing",
                "Error handling"
            ]
        }

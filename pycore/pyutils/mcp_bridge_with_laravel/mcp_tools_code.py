#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Code-scanning MCP tool wrappers for the File Processor MCP Server.

Extracted from main.py. Two thin wrappers that forward to the sibling
code_scanner module. CODE_SCANNER_AVAILABLE / code_scanner are runtime globals
owned by server, read via function-local imports to avoid stale captures and
circular imports.
"""

import logging
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


def register_code_tools(mcp):
    """Register code-scanning MCP tools (thin wrappers over code_scanner)."""

    @mcp.tool()
    def scan_code_for_chinese(
        directory: str,
        extensions: Optional[List[str]] = None,
        max_depth: int = -1,
        output_format: str = "text"
    ) -> Union[str, Dict[str, Any]]:
        """
        Scan code files for Chinese characters in a directory.

        This tool recursively scans code files and detects Chinese characters,
        useful for code cleanup, internationalization audits, or finding hardcoded strings.

        Args:
            directory: Root directory to scan
            extensions: List of file extensions to scan (e.g., ['py', 'js', 'dart'])
                       If None, scans all default code file types:
                       - JavaScript/TypeScript: .js, .jsx, .ts, .tsx, .mjs, .cjs
                       - Python: .py, .pyw, .pyi
                       - Dart: .dart
                       - Vue: .vue
                       - Java/Kotlin: .java, .kt, .kts
                       - Go: .go
                       - Shell: .sh, .bash, .zsh, .fish, .ps1, .psm1, .psd1
                       - C/C++: .c, .cpp, .cc, .h, .hpp
                       - C#: .cs
                       - And many more...
            max_depth: Maximum directory depth to scan (-1 for unlimited, default: -1)
            output_format: Output format - 'text' for readable format or 'json' for structured data

        Returns:
            Scan results with statistics and locations of Chinese characters.
            Format depends on output_format parameter.

        Excluded directories:
            node_modules, .git, dist, build, __pycache__, venv, target, vendor, etc.

        Example usage:
            # Scan all code files
            scan_code_for_chinese("/path/to/project")

            # Scan only Python files
            scan_code_for_chinese("/path/to/project", extensions=["py"])

            # Scan with depth limit
            scan_code_for_chinese("/path/to/project", max_depth=3)

            # Get JSON output
            scan_code_for_chinese("/path/to/project", output_format="json")
        """
        try:
            from server import CODE_SCANNER_AVAILABLE, code_scanner

            if not CODE_SCANNER_AVAILABLE:
                error_msg = "Code scanner is not available. Please check installation."
                logger.error(error_msg)
                if output_format == "json":
                    return {"success": False, "error": error_msg}
                return f"Error: {error_msg}"

            # Scan directory
            results = code_scanner.scan_directory(
                directory=directory,
                extensions=extensions,
                max_depth=max_depth
            )

            # Format output
            if output_format == "json":
                return results
            else:
                return code_scanner.format_results_text(results)

        except Exception as e:
            error_msg = f"Code scanning failed: {str(e)}"
            logger.error(error_msg)
            if output_format == "json":
                return {"success": False, "error": error_msg}
            return f"Error: {error_msg}"

    @mcp.tool()
    def list_code_extensions() -> Dict[str, Any]:
        """
        List all supported code file extensions for Chinese character scanning.

        Returns:
            Dictionary containing all supported extensions organized by language/category.

        Example usage:
            list_code_extensions()
        """
        try:
            from server import CODE_SCANNER_AVAILABLE, code_scanner

            if not CODE_SCANNER_AVAILABLE:
                return {"error": "Code scanner is not available"}

            extensions_by_category = {
                "JavaScript/TypeScript": [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
                "Python": [".py", ".pyw", ".pyi"],
                "Dart": [".dart"],
                "Vue": [".vue"],
                "Java/Kotlin": [".java", ".kt", ".kts"],
                "Go": [".go"],
                "Shell Scripts": [".sh", ".bash", ".zsh", ".fish"],
                "PowerShell": [".ps1", ".psm1", ".psd1"],
                "C/C++": [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"],
                "C#": [".cs"],
                "Ruby": [".rb"],
                "PHP": [".php"],
                "Rust": [".rs"],
                "Swift": [".swift"],
                "Scala": [".scala"],
                "R": [".r", ".R"],
                "Perl": [".pl", ".pm"],
                "Lua": [".lua"],
                "SQL": [".sql"],
                "Web": [".html", ".htm", ".css", ".scss", ".sass", ".less"],
                "Config": [".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".config"],
                "Markdown": [".md", ".markdown"],
                "XML": [".xml"]
            }

            return {
                "success": True,
                "total_extensions": sum(len(exts) for exts in extensions_by_category.values()),
                "categories": extensions_by_category,
                "excluded_directories": list(code_scanner.EXCLUDE_DIRS),
                "excluded_files": list(code_scanner.EXCLUDE_FILES),
                "usage": "Use extensions parameter in scan_code_for_chinese() to filter by extension"
            }

        except Exception as e:
            return {"error": str(e)}

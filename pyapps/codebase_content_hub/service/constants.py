#!/usr/bin/env python3
"""Constants for the Codebase Content Hub MCP server."""

from pathlib import Path


class ContentHubConstants:
    """Centralized configuration for the combined codebase and file inspector."""

    SERVICE_NAME = "CodebaseContentHub"
    SERVICE_VERSION = "0.1.0"
    SERVICE_DESCRIPTION = (
        "Unified directory tree and file content inspector with OCR support"
    )

    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "content_hub.log"

    REQUIRED_PACKAGES = [
        "mcp",
        "Pillow",
        "numpy",
        "pypdf",
        "python-docx",
        "openpyxl",
        "python-pptx",
        "pymupdf",
        "paddleocr",
        "pytesseract",
    ]

    PACKAGE_IMPORT_MAPPING = {
        "Pillow": "PIL",
        "numpy": "numpy",
        "pypdf": "pypdf",
        "python-docx": "docx",
        "openpyxl": "openpyxl",
        "python-pptx": "pptx",
        "pymupdf": "fitz",
        "paddleocr": "paddleocr",
        "pytesseract": "pytesseract",
    }

    ENV_VARS = {
        "MCP_ALLOW_ALL_PATHS": "true",
    }

    TOOL_CAPABILITIES = [
        "get_directory_tree",
        "describe_directory",
        "get_file_content",
        "health_check",
    ]

    AUTO_APPROVE_TOOLS = TOOL_CAPABILITIES.copy()

    @classmethod
    def ensure_directories(cls) -> None:
        cls.TMP_DIR.mkdir(exist_ok=True)

    @classmethod
    def get_env_vars(cls) -> dict:
        return cls.ENV_VARS.copy()

    @classmethod
    def get_mcp_config(cls) -> dict:
        return {
            "command": "cmd",
            "args": [
                "/c",
                "python",
                "pymain.py",
                "app=codebase_content_hub",
            ],
            "env": cls.get_env_vars(),
            "disabled": False,
            "autoApprove": cls.AUTO_APPROVE_TOOLS,
        }

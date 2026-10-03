# -*- coding: utf-8 -*-
"""Constants of the read-only pycore-dev MCP server."""

from pycore.pyfoundations.service_contract import path_value

DEV_MCP_SERVER_NAME = "pycore-dev"
DEV_MCP_PATH = path_value("pycore_dev_mcp")
DEV_MCP_INSTRUCTIONS = (
    "Development observation: Chrome tabs, Colab cell output, terminal window text. "
    "chrome_screenshot raises the browser window and captures it at OS level (page, tab strip, DevTools). "
    "No keystroke, shell or permission tool exists on this server."
)
FORWARDING_HEADER_PREFIXES = ("x-forwarded-", "tailscale-")
FORWARDING_HEADERS = frozenset({"forwarded", "x-real-ip", "via", "x-original-forwarded-for"})
FORBIDDEN_STATUS = 403
ERROR_NOT_DIRECT_LOOPBACK = "dev_mcp_direct_loopback_only"

WINDOW_CAPTURE_THREAD = "DevMcpBrowserCaptureThread"
WINDOW_CAPTURE_MAX_WIDTH = 1920
WINDOW_CAPTURE_JPEG_QUALITY = 85
SCREENSHOT_MODE_WINDOW = "window"
SCREENSHOT_MODE_PAGE = "page"
PAGE_TEXT_DEFAULT_MAX_CHARS = 20000

TERMINAL_DEFAULT_LINES = 200
TERMINAL_SOURCE_AUTO = "auto"
TERMINAL_SOURCE_OCR = "ocr"
TERMINAL_SOURCE_BACKUP = "backup"
TERMINAL_OCR_MODEL = "general"
TERMINAL_TMP_DIR_NAME = "pycore_dev_mcp"
TERMINAL_TMP_IMAGE_TEMPLATE = "terminal-{token}.png"
TERMINAL_LIST_THREAD = "DevMcpTerminalListThread"
TERMINAL_READ_THREAD = "DevMcpTerminalReadThread"

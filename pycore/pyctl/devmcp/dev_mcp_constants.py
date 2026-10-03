# -*- coding: utf-8 -*-
"""Constants of the read-only pycore-dev MCP server."""

import re

from pycore.pyfoundations.service_contract import build_url, host, path_value, port

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

CHROME_MCP_URL = build_url("http", host("loopback"), port("mcp_chrome"), "mcp")
CHROME_CONNECT_TIMEOUT_SECONDS = 10.0
CHROME_READ_TIMEOUT_SECONDS = 180.0
CHROME_TOOL_TABS = "get_windows_and_tabs"
CHROME_TOOL_SCREENSHOT = "chrome_screenshot"
CHROME_TOOL_JAVASCRIPT = "chrome_javascript"
CHROME_TOOL_SWITCH_TAB = "chrome_switch_tab"
WINDOW_CAPTURE_THREAD = "DevMcpBrowserCaptureThread"
WINDOW_CAPTURE_MAX_WIDTH = 1920
WINDOW_CAPTURE_JPEG_QUALITY = 85
SCREENSHOT_MODE_WINDOW = "window"
SCREENSHOT_MODE_PAGE = "page"
CHROME_SCREENSHOT_WIDTH = 1600
CHROME_SCREENSHOT_HEIGHT = 1000
CHROME_JS_TIMEOUT_MS = 30000
CHROME_JS_MAX_OUTPUT_BYTES = 8 * 1024 * 1024
JPEG_BASE64_PREFIX = "/9j/"
MIME_JPEG = "image/jpeg"
MIME_PNG = "image/png"
PAGE_TEXT_DEFAULT_MAX_CHARS = 20000
PAGE_TEXT_SCRIPT = (
    "return JSON.stringify({title: document.title, url: location.href, "
    "text: document.body ? document.body.innerText : ''});"
)

COLAB_DEFAULT_URL_PART = "colab.research.google.com"
COLAB_DEFAULT_TAIL_LINES = 200
COLAB_MAX_CHARS = 2_000_000
COLAB_OUTPUT_SCRIPT = """
const model = window.colab.global.notebookModel;
const raw = model.getLastResolvedNotebookJson();
const notebook = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
const outputs = (notebook.cells || []).flatMap((cell) => cell.outputs || []);
const text = outputs.map((output) => [].concat(output.text || []).join('')
  + [].concat((output.data || {})['text/plain'] || []).join('')).join('');
return JSON.stringify({total: text.length, text: text.slice(-MAX_CHARS)});
""".replace("MAX_CHARS", str(COLAB_MAX_CHARS))
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07")

TERMINAL_DEFAULT_LINES = 200
TERMINAL_SOURCE_AUTO = "auto"
TERMINAL_SOURCE_OCR = "ocr"
TERMINAL_SOURCE_BACKUP = "backup"
TERMINAL_OCR_MODEL = "general"
TERMINAL_TMP_DIR_NAME = "pycore_dev_mcp"
TERMINAL_TMP_IMAGE_TEMPLATE = "terminal-{token}.png"
TERMINAL_LIST_THREAD = "DevMcpTerminalListThread"
TERMINAL_READ_THREAD = "DevMcpTerminalReadThread"

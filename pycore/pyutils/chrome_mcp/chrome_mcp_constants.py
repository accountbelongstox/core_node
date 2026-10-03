# -*- coding: utf-8 -*-
"""Constants of the mcp-chrome MCP client and the Colab notebook DOM scripts."""

import re

from pycore.pyfoundations.service_contract import build_url, host, port

CHROME_MCP_URL = build_url("http", host("loopback"), port("mcp_chrome"), "mcp")
CHROME_CONNECT_TIMEOUT_SECONDS = 10.0
CHROME_READ_TIMEOUT_SECONDS = 180.0
CHROME_TOOL_TABS = "get_windows_and_tabs"
CHROME_TOOL_SCREENSHOT = "chrome_screenshot"
CHROME_TOOL_JAVASCRIPT = "chrome_javascript"
CHROME_TOOL_SWITCH_TAB = "chrome_switch_tab"
CHROME_TOOL_NAVIGATE = "chrome_navigate"
CHROME_SCREENSHOT_WIDTH = 1600
CHROME_SCREENSHOT_HEIGHT = 1000
CHROME_JS_TIMEOUT_MS = 30000
CHROME_JS_MAX_OUTPUT_BYTES = 8 * 1024 * 1024
JPEG_BASE64_PREFIX = "/9j/"
MIME_JPEG = "image/jpeg"
MIME_PNG = "image/png"
PAGE_TEXT_SCRIPT = (
    "return JSON.stringify({title: document.title, url: location.href, "
    "text: document.body ? document.body.innerText : ''});"
)

COLAB_DEFAULT_URL_PART = "colab.research.google.com"
COLAB_DEFAULT_TAIL_LINES = 200
COLAB_MAX_CHARS = 2_000_000
# Live cell output comes from the rendered outputs; the notebook model only holds
# the last saved outputs (a previous run while a cell executes).
COLAB_OUTPUT_SCRIPT = """
const live = [...document.querySelectorAll('.cell.code colab-static-output-renderer')]
  .map((item) => item.innerText).join('\\n');
if (live) { return JSON.stringify({total: live.length, text: live.slice(-MAX_CHARS)}); }
const model = window.colab.global.notebookModel;
const raw = model.getLastResolvedNotebookJson();
const notebook = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
const outputs = (notebook.cells || []).flatMap((cell) => cell.outputs || []);
const text = outputs.map((output) => [].concat(output.text || []).join('')
  + [].concat((output.data || {})['text/plain'] || []).join('')).join('');
return JSON.stringify({total: text.length, text: text.slice(-MAX_CHARS)});
""".replace("MAX_CHARS", str(COLAB_MAX_CHARS))
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07")

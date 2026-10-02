# -*- coding: utf-8 -*-
"""Read-only proxy to the mcp-chrome MCP server (tabs, screenshot, DOM text)."""

import json
from typing import Any, Dict, List, Optional

from pycore.pyctl.devmcp.dev_mcp_constants import (
    CHROME_CONNECT_TIMEOUT_SECONDS,
    CHROME_JS_MAX_OUTPUT_BYTES,
    CHROME_JS_TIMEOUT_MS,
    CHROME_MCP_URL,
    CHROME_READ_TIMEOUT_SECONDS,
    CHROME_SCREENSHOT_HEIGHT,
    CHROME_SCREENSHOT_WIDTH,
    CHROME_TOOL_JAVASCRIPT,
    CHROME_TOOL_SCREENSHOT,
    CHROME_TOOL_TABS,
    JPEG_BASE64_PREFIX,
    MIME_JPEG,
    MIME_PNG,
    PAGE_TEXT_SCRIPT,
)
from pycore.pyfoundations.third_party.api import get_third_package_httpx, get_third_package_mcp

mcp_package = get_third_package_mcp()
httpx = get_third_package_httpx()


class ChromeBridge:
    async def call_text(self, tool: str, arguments: Dict[str, Any]) -> str:
        timeout = httpx.Timeout(CHROME_READ_TIMEOUT_SECONDS, connect=CHROME_CONNECT_TIMEOUT_SECONDS)
        async with httpx.AsyncClient(timeout=timeout) as http_client:
            async with mcp_package.streamable_http_client(
                CHROME_MCP_URL, http_client=http_client, terminate_on_close=False
            ) as (read_stream, write_stream, _session_id):
                async with mcp_package.ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    result = await session.call_tool(tool, arguments)
        text = "".join(item.text for item in result.content if item.type == "text")
        if result.isError:
            raise RuntimeError(f"{tool}: {text}")
        return text

    async def tabs(self) -> List[Dict[str, Any]]:
        document = json.loads(await self.call_text(CHROME_TOOL_TABS, {}))
        return [
            {**tab, "windowId": window["windowId"]}
            for window in document.get("windows") or []
            for tab in window.get("tabs") or []
        ]

    async def matching_tabs(
        self,
        tab_id: int = 0,
        url_contains: str = "",
        title_contains: str = "",
    ) -> List[Dict[str, Any]]:
        tabs = await self.tabs()
        if tab_id:
            matches = [tab for tab in tabs if int(tab["tabId"]) == int(tab_id)]
        elif url_contains or title_contains:
            matches = [
                tab
                for tab in tabs
                if url_contains.lower() in str(tab.get("url") or "").lower()
                and title_contains.lower() in str(tab.get("title") or "").lower()
            ]
        else:
            raise ValueError("chrome_tab_selector_required")
        if not matches:
            raise LookupError("chrome_tab_not_found")
        return sorted(matches, key=lambda tab: not tab.get("active"))

    async def evaluate(self, tab_id: int, code: str) -> Any:
        text = await self.call_text(
            CHROME_TOOL_JAVASCRIPT,
            {
                "tabId": tab_id,
                "code": code,
                "timeoutMs": CHROME_JS_TIMEOUT_MS,
                "maxOutputBytes": CHROME_JS_MAX_OUTPUT_BYTES,
            },
        )
        result: Any = json.loads(text)
        if isinstance(result, dict) and "result" in result:
            result = result["result"]
        return json.loads(result) if isinstance(result, str) else result

    async def screenshot(self, tab_id: int, full_page: bool) -> Dict[str, str]:
        text = await self.call_text(
            CHROME_TOOL_SCREENSHOT,
            {
                "tabId": tab_id,
                "fullPage": full_page,
                "background": True,
                "storeBase64": True,
                "savePng": False,
                "width": CHROME_SCREENSHOT_WIDTH,
                "height": CHROME_SCREENSHOT_HEIGHT,
            },
        )
        data = str(json.loads(text).get("base64Data") or "")
        if not data:
            raise RuntimeError("chrome_screenshot_empty")
        return {"data": data, "mime": MIME_JPEG if data.startswith(JPEG_BASE64_PREFIX) else MIME_PNG}

    async def page_text(self, tab_id: int) -> Dict[str, Any]:
        return await self.evaluate(tab_id, PAGE_TEXT_SCRIPT)


chrome_bridge = ChromeBridge()

__all__ = ["ChromeBridge", "chrome_bridge"]

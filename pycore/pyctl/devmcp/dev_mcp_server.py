# -*- coding: utf-8 -*-
"""Read-only pycore-dev MCP server: observation tools behind a direct-loopback gate."""

import functools
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional

from pycore.pyctl.devmcp.chrome_bridge import chrome_bridge
from pycore.pyctl.devmcp.colab_reader import colab_reader
from pycore.pyctl.devmcp.dev_mcp_constants import (
    COLAB_DEFAULT_TAIL_LINES,
    COLAB_DEFAULT_URL_PART,
    DEV_MCP_INSTRUCTIONS,
    DEV_MCP_PATH,
    DEV_MCP_SERVER_NAME,
    ERROR_NOT_DIRECT_LOOPBACK,
    FORBIDDEN_STATUS,
    FORWARDING_HEADER_PREFIXES,
    FORWARDING_HEADERS,
    PAGE_TEXT_DEFAULT_MAX_CHARS,
    TERMINAL_DEFAULT_LINES,
    TERMINAL_SOURCE_AUTO,
)
from pycore.pyctl.devmcp.terminal_reader import terminal_reader
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_mcp
from pycore.pyutils.common.local_rpc_guard import host_header_is_loopback, is_loopback_peer
from pycore.pyutils.rpc.http.local_rpc_middleware import scope_headers

mcp_package = get_third_package_mcp()


def is_direct_loopback(scope: Dict[str, Any]) -> bool:
    """True only for a loopback peer with a loopback Host and no proxy or forwarding header."""
    headers = scope_headers(scope)
    peer = (scope.get("client") or ("", 0))[0]
    forwarded = any(
        name in FORWARDING_HEADERS or name.startswith(FORWARDING_HEADER_PREFIXES)
        for name in headers
    )
    return is_loopback_peer(peer) and host_header_is_loopback(headers.get("host", "")) and not forwarded


def observed(tool_name: str) -> Callable:
    """Tool boundary: report the failure with its context and return it as a tool error."""

    def decorate(handler: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(handler)
        async def run(*args: Any, **kwargs: Any) -> Any:
            try:
                return await handler(*args, **kwargs)
            except Exception as error:
                ColorPrint.red(f"[DevMcp] {tool_name} failed: {type(error).__name__}: {error}")
                raise mcp_package.ToolError(f"{tool_name}: {type(error).__name__}: {error}") from error

        return run

    return decorate


class DevMcpEndpoint:
    """ASGI endpoint for the Streamable HTTP MCP transport."""

    def __init__(self) -> None:
        self._server = None
        self._manager = None

    def build(self) -> None:
        self._server = mcp_package.FastMCP(
            DEV_MCP_SERVER_NAME,
            instructions=DEV_MCP_INSTRUCTIONS,
            stateless_http=True,
            json_response=True,
            streamable_http_path="/",
        )
        self._register_tools(self._server)
        self._server.streamable_http_app()
        self._manager = self._server.session_manager

    @asynccontextmanager
    async def lifespan(self) -> AsyncIterator[None]:
        async with self._manager.run():
            yield

    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any) -> None:
        if not is_direct_loopback(scope):
            ColorPrint.yellow(f"[DevMcp] rejected non-direct request from {(scope.get('client') or ('?',))[0]}")
            body = json.dumps({"success": False, "error": {"code": ERROR_NOT_DIRECT_LOOPBACK}}).encode("utf-8")
            await send({
                "type": "http.response.start",
                "status": FORBIDDEN_STATUS,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
            })
            await send({"type": "http.response.body", "body": body})
            return
        await self._manager.handle_request(scope, receive, send)

    def _register_tools(self, server: Any) -> None:
        image_content = mcp_package.types.ImageContent
        text_content = mcp_package.types.TextContent

        @server.tool(structured_output=False)
        @observed("chrome_tabs")
        async def chrome_tabs() -> List[Dict[str, Any]]:
            """List open Chrome tabs (tab id, window id, title, url, active)."""
            return await chrome_bridge.tabs()

        @server.tool(structured_output=False)
        @observed("chrome_screenshot")
        async def chrome_screenshot(
            tab_id: int = 0,
            url_contains: str = "",
            title_contains: str = "",
            full_page: bool = False,
        ) -> List[Any]:
            """Screenshot a Chrome tab selected by tab_id or by url/title substring, without focusing it."""
            tab = (await chrome_bridge.matching_tabs(tab_id, url_contains, title_contains))[0]
            shot = await chrome_bridge.screenshot(int(tab["tabId"]), full_page)
            return [
                image_content(type="image", data=shot["data"], mimeType=shot["mime"]),
                text_content(type="text", text=f"tab_id={tab['tabId']} title={tab.get('title')} url={tab.get('url')}"),
            ]

        @server.tool(structured_output=False)
        @observed("chrome_page_text")
        async def chrome_page_text(
            tab_id: int = 0,
            url_contains: str = "",
            title_contains: str = "",
            max_chars: int = PAGE_TEXT_DEFAULT_MAX_CHARS,
        ) -> Dict[str, Any]:
            """Read the visible text (document.body.innerText) of a Chrome tab."""
            tab = (await chrome_bridge.matching_tabs(tab_id, url_contains, title_contains))[0]
            page = await chrome_bridge.page_text(int(tab["tabId"]))
            text = str(page.get("text") or "")
            return {
                "tab_id": tab["tabId"],
                "title": page.get("title"),
                "url": page.get("url"),
                "total_chars": len(text),
                "text": text[:max_chars],
            }

        @server.tool(structured_output=False)
        @observed("colab_output")
        async def colab_output(
            url_contains: str = COLAB_DEFAULT_URL_PART,
            title_contains: str = "",
            grep: Optional[str] = None,
            tail: int = COLAB_DEFAULT_TAIL_LINES,
        ) -> Dict[str, Any]:
            """Read Colab cell output text (ANSI stripped); regex grep filter, then the last `tail` lines."""
            return await colab_reader.read(url_contains, title_contains, grep, tail)

        @server.tool(structured_output=False)
        @observed("terminal_list")
        async def terminal_list() -> List[Dict[str, Any]]:
            """List terminal windows (window id, terminal number, titles, online, rect)."""
            return await terminal_reader.list_windows()

        @server.tool(structured_output=False)
        @observed("terminal_read")
        async def terminal_read(
            window_id: str = "",
            title_contains: str = "",
            lines: int = TERMINAL_DEFAULT_LINES,
            source: str = TERMINAL_SOURCE_AUTO,
        ) -> Dict[str, Any]:
            """Read terminal text: source ocr (live screenshot OCR), backup (latest stored export) or auto."""
            return await terminal_reader.read(window_id, title_contains, lines, source)


dev_mcp_endpoint = DevMcpEndpoint()

__all__ = ["DEV_MCP_PATH", "DevMcpEndpoint", "dev_mcp_endpoint", "is_direct_loopback", "mcp_package"]

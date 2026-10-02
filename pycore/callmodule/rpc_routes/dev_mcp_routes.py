# -*- coding: utf-8 -*-
from pycore.pyctl.devmcp.dev_mcp_server import DEV_MCP_PATH, dev_mcp_endpoint, mcp_package
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_dev_mcp_routes(server) -> None:
    if mcp_package is None:
        ColorPrint.yellow("[DevMcp] mcp package unavailable; pycore-dev MCP endpoint not mounted")
        return
    try:
        dev_mcp_endpoint.build()
        server.mount_asgi_endpoint(DEV_MCP_PATH, dev_mcp_endpoint, dev_mcp_endpoint.lifespan)
    except Exception as error:
        ColorPrint.red(f"[DevMcp] pycore-dev MCP endpoint not mounted: {type(error).__name__}: {error}")
        return
    ColorPrint.green(f"[DevMcp] pycore-dev MCP mounted at {DEV_MCP_PATH}")

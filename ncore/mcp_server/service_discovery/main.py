import asyncio
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from constants import ServiceDiscoveryConstants
from network_scanner import NetworkScanner

try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent
    import mcp.server.stdio
except ImportError as e:
    print(f"ERROR: Failed to import MCP: {e}", file=sys.stderr)
    sys.exit(1)

ServiceDiscoveryConstants.TMP_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr),
        logging.FileHandler(ServiceDiscoveryConstants.LOG_FILE)
    ]
)

logger = logging.getLogger(__name__)

app = Server(ServiceDiscoveryConstants.SERVICE_NAME)
scanner = NetworkScanner()

laravel_service_url = None

@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="discover_laravel_service",
            description="Discover Laravel backend service (port 9000) in LAN. Static discovery performed at startup. Returns service URL or maintenance status.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="discover_pycore_service",
            description="Discover PyCore service (port 59000). First checks localhost, then scans LAN if not found. Dynamic retry discovery.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="discover_ncore_service",
            description="Discover NCore service (port 58000). First checks localhost, then scans LAN if not found. Dynamic retry discovery.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="get_local_network_info",
            description="Get local IP address, network segment, and gateway information",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
        Tool(
            name="health_check",
            description="Check service discovery system health status",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    global laravel_service_url

    try:
        if name == "discover_laravel_service":
            result = await scanner.discover_laravel_static()
            laravel_service_url = result.get("service_url")
            return [TextContent(type="text", text=str(result))]

        elif name == "discover_pycore_service":
            result = await scanner.discover_service_dynamic(
                ServiceDiscoveryConstants.DEFAULT_PYCORE_PORT,
                "PyCore"
            )
            return [TextContent(type="text", text=str(result))]

        elif name == "discover_ncore_service":
            result = await scanner.discover_service_dynamic(
                ServiceDiscoveryConstants.DEFAULT_NCORE_PORT,
                "NCore"
            )
            return [TextContent(type="text", text=str(result))]

        elif name == "get_local_network_info":
            network_info = scanner.get_local_ip_and_network()
            gateway_accessible = await scanner.check_gateway_accessible(network_info["gateway_ip"])
            network_info["gateway_accessible"] = gateway_accessible
            return [TextContent(type="text", text=str(network_info))]

        elif name == "health_check":
            health_status = {
                "service": ServiceDiscoveryConstants.SERVICE_NAME,
                "version": ServiceDiscoveryConstants.SERVICE_VERSION,
                "status": "healthy",
                "laravel_service": laravel_service_url or "not discovered",
                "capabilities": ServiceDiscoveryConstants.TOOL_CAPABILITIES
            }
            return [TextContent(type="text", text=str(health_status))]

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.error(f"Error executing tool {name}: {e}", exc_info=True)
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def startup_discovery():
    global laravel_service_url

    logger.info("Performing Laravel service static discovery at startup...")
    result = await scanner.discover_laravel_static()
    laravel_service_url = result.get("service_url")
    logger.info(f"Laravel discovery result: {result}")

async def main():
    logger.info(f"Starting {ServiceDiscoveryConstants.SERVICE_NAME} v{ServiceDiscoveryConstants.SERVICE_VERSION}")

    await startup_discovery()

    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())

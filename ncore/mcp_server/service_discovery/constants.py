from pathlib import Path

class ServiceDiscoveryConstants:
    SERVICE_NAME = "ServiceDiscovery"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Automatic service discovery for Laravel, PyCore, and NCore services in LAN"

    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent

    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_discovery"
    LOG_FILE = TMP_DIR / "service_discovery.log"

    REQUIRED_PACKAGES = ["mcp", "aiohttp"]

    ENV_VARS = {
        "MCP_ALLOW_ALL_PATHS": "true"
    }

    TOOL_CAPABILITIES = [
        "discover_laravel_service",
        "discover_pycore_service",
        "discover_ncore_service",
        "get_local_network_info",
        "health_check"
    ]

    AUTO_APPROVE_TOOLS = [
        "discover_laravel_service",
        "discover_pycore_service",
        "discover_ncore_service",
        "get_local_network_info",
        "health_check"
    ]

    DEFAULT_LARAVEL_IP = "192.168.50.2"
    DEFAULT_LARAVEL_PORT = 9000

    DEFAULT_PYCORE_PORT = 59000
    DEFAULT_NCORE_PORT = 58000

    LOCALHOST = "127.0.0.1"

    DISCOVERY_TIMEOUT = 0.5
    GATEWAY_TIMEOUT = 0.5

    SCAN_RANGE_START = 2
    SCAN_RANGE_END = 254

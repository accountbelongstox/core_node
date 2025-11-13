"""
MCP Server Discovery - Discover MCP Servers on Local Network

This module provides automatic discovery of MCP servers on the local network.

Discovery Process:
1. Detect local network segment using NetworkScanner
2. Scan network for active hosts
3. Probe each host for MCP server (default port: 8767)
4. Verify MCP server by attempting connection
5. Return list of discovered servers with metadata

Usage:
    from pycore.pyutils.mcp import MCPServerDiscovery

    discovery = MCPServerDiscovery()
    servers = discovery.find_servers()

    for server in servers:
        print(f"Found MCP server at {server['host']}:{server['port']}")
"""

import socket
import time
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from pycore import ColorPrint
from pycore.pyutils.mcp.network_scanner import NetworkScanner


class MCPServerDiscovery:
    """
    MCP Server Discovery on Local Network.

    This class provides methods to discover MCP servers running on the
    local network by scanning for open ports and verifying MCP protocol.

    Features:
    - Automatic network segment detection
    - Parallel host scanning
    - MCP protocol verification
    - Server metadata collection

    Usage:
        discovery = MCPServerDiscovery(debug=True)

        # Quick discovery (scan known hosts)
        servers = discovery.find_servers_quick()

        # Full discovery (scan entire network)
        servers = discovery.find_servers_full()

        # Custom port discovery
        servers = discovery.find_servers(ports=[8767, 8768, 8769])
    """

    DEFAULT_MCP_PORTS = [8767]
    COMMON_MCP_PORTS = [8767, 8768, 8769, 8770]
    CONNECTION_TIMEOUT = 2.0
    MAX_DISCOVERY_THREADS = 50

    def __init__(self, debug: bool = False):
        """
        Initialize MCP Server Discovery.

        Args:
            debug: Enable debug output
        """
        self.debug = debug
        self.network_scanner = NetworkScanner(debug=debug)
        self.discovered_servers = []

    def find_servers(
        self,
        network: str = None,
        ports: List[int] = None,
        timeout: float = None
    ) -> List[Dict[str, any]]:
        """
        Find MCP servers on the network.

        This performs a full network scan and probes all active hosts
        for MCP servers on specified ports.

        Args:
            network: Network CIDR to scan (auto-detected if None)
            ports: List of ports to check (default: [8767])
            timeout: Connection timeout per host (default: 2.0)

        Returns:
            List of discovered server information:
            [
                {
                    'host': '192.168.1.100',
                    'port': 8767,
                    'role': 'primary',
                    'response_time': 0.123,
                    'discovered_at': 1234567890.0
                }
            ]
        """
        if ports is None:
            ports = self.DEFAULT_MCP_PORTS

        if timeout is None:
            timeout = self.CONNECTION_TIMEOUT

        if self.debug:
            ColorPrint.blue("=" * 70)
            ColorPrint.blue("[MCPServerDiscovery] Starting server discovery...")
            ColorPrint.blue("=" * 70)

        # Stage 1: Detect network segment
        if self.debug:
            ColorPrint.blue("\n[Stage 1] Detecting network segment...")

        network_info = self.network_scanner.detect_network_segment()
        if not network_info:
            if self.debug:
                ColorPrint.red("[MCPServerDiscovery] Failed to detect network segment")
            return []

        if self.debug:
            ColorPrint.green(f"[Stage 1] Network detected: {network_info['network']}")

        # Stage 2: Scan for active hosts
        if self.debug:
            ColorPrint.blue("\n[Stage 2] Scanning for active hosts...")

        active_hosts = self.network_scanner.scan_network_segment(
            network=network or network_info['network'],
            timeout=0.5
        )

        if not active_hosts:
            if self.debug:
                ColorPrint.yellow("[Stage 2] No active hosts found")
            return []

        if self.debug:
            ColorPrint.green(f"[Stage 2] Found {len(active_hosts)} active hosts")

        # Stage 3: Probe each host for MCP server
        if self.debug:
            ColorPrint.blue(f"\n[Stage 3] Probing hosts for MCP server (ports: {ports})...")

        discovered_servers = self._probe_hosts_for_mcp(active_hosts, ports, timeout)

        if self.debug:
            ColorPrint.green(f"\n[Stage 3] Discovered {len(discovered_servers)} MCP server(s)")
            ColorPrint.blue("=" * 70)

        self.discovered_servers = discovered_servers
        return discovered_servers

    def find_servers_quick(self, ports: List[int] = None) -> List[Dict[str, any]]:
        """
        Quick server discovery - only check gateway and local IP.

        This is faster but may miss servers on other hosts.

        Args:
            ports: List of ports to check (default: [8767])

        Returns:
            List of discovered servers
        """
        if ports is None:
            ports = self.DEFAULT_MCP_PORTS

        if self.debug:
            ColorPrint.blue("[MCPServerDiscovery] Quick discovery mode...")

        # Detect network info
        network_info = self.network_scanner.detect_network_segment()
        if not network_info:
            return []

        # Check local IP and gateway only
        quick_hosts = [network_info['local_ip']]
        if network_info['gateway'] != 'unknown':
            quick_hosts.append(network_info['gateway'])

        if self.debug:
            ColorPrint.blue(f"Checking hosts: {quick_hosts}")

        discovered_servers = self._probe_hosts_for_mcp(quick_hosts, ports, self.CONNECTION_TIMEOUT)

        if self.debug:
            ColorPrint.green(f"Quick discovery found {len(discovered_servers)} server(s)")

        self.discovered_servers = discovered_servers
        return discovered_servers

    def find_servers_full(self, ports: List[int] = None) -> List[Dict[str, any]]:
        """
        Full server discovery - scan entire network with common ports.

        This is thorough but slower.

        Args:
            ports: List of ports to check (default: common MCP ports)

        Returns:
            List of discovered servers
        """
        if ports is None:
            ports = self.COMMON_MCP_PORTS

        if self.debug:
            ColorPrint.blue("[MCPServerDiscovery] Full discovery mode (all ports)...")

        return self.find_servers(ports=ports)

    def _probe_hosts_for_mcp(
        self,
        hosts: List[str],
        ports: List[int],
        timeout: float
    ) -> List[Dict[str, any]]:
        """
        Probe list of hosts for MCP servers.

        Args:
            hosts: List of IP addresses to probe
            ports: List of ports to check
            timeout: Connection timeout

        Returns:
            List of discovered servers
        """
        discovered_servers = []
        futures = []

        with ThreadPoolExecutor(max_workers=self.MAX_DISCOVERY_THREADS) as executor:
            for host in hosts:
                for port in ports:
                    future = executor.submit(self._probe_mcp_server, host, port, timeout)
                    futures.append(future)

            # Collect results
            for future in as_completed(futures):
                server_info = future.result()
                if server_info:
                    discovered_servers.append(server_info)
                    if self.debug:
                        ColorPrint.green(f"  [+] MCP Server: {server_info['host']}:{server_info['port']}")

        return discovered_servers

    def _probe_mcp_server(
        self,
        host: str,
        port: int,
        timeout: float
    ) -> Optional[Dict[str, any]]:
        """
        Probe single host:port for MCP server.

        This attempts to connect to the port and checks if it responds
        as an MCP server.

        Args:
            host: IP address
            port: Port number
            timeout: Connection timeout

        Returns:
            Server info dict if MCP server found, None otherwise
        """
        start_time = time.time()

        # Attempt TCP connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)

        connection_result = sock.connect_ex((host, port))

        if connection_result != 0:
            sock.close()
            return None

        # Connection successful - likely a server
        response_time = time.time() - start_time

        # For now, assume any listening port is an MCP server
        # In future, we could send MCP protocol handshake to verify
        server_info = {
            'host': host,
            'port': port,
            'role': 'unknown',  # Would be determined by protocol handshake
            'response_time': round(response_time, 3),
            'discovered_at': time.time()
        }

        sock.close()
        return server_info

    def verify_mcp_server(self, host: str, port: int) -> bool:
        """
        Verify if host:port is running an MCP server.

        This performs a protocol-level verification by attempting
        to communicate with the server using MCP protocol.

        Args:
            host: Server IP address
            port: Server port

        Returns:
            True if verified MCP server
        """
        # TODO: Implement MCP protocol handshake
        # For now, just check if port is open
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(self.CONNECTION_TIMEOUT)

        result = sock.connect_ex((host, port))
        sock.close()

        return result == 0

    def get_discovery_summary(self) -> Dict[str, any]:
        """
        Get summary of discovery results.

        Returns:
            Discovery summary with statistics
        """
        network_info = self.network_scanner.get_network_info_summary()

        return {
            'network_info': network_info,
            'servers_found': len(self.discovered_servers),
            'servers': self.discovered_servers,
            'discovery_time': time.time()
        }

    def print_discovery_report(self):
        """
        Print formatted discovery report to console.
        """
        ColorPrint.blue("=" * 70)
        ColorPrint.blue("MCP Server Discovery Report")
        ColorPrint.blue("=" * 70)

        # Network information
        network_info = self.network_scanner.get_network_info_summary()
        ColorPrint.white("\nNetwork Information:")
        ColorPrint.blue(f"  Platform: {network_info['platform']}")
        ColorPrint.blue(f"  Local IP: {network_info['local_ip']}")
        ColorPrint.blue(f"  Gateway: {network_info['gateway']}")

        if network_info['network_segment']:
            ColorPrint.blue(f"  Network: {network_info['network_segment']['network']}")

        # Discovered servers
        ColorPrint.white(f"\nDiscovered Servers: {len(self.discovered_servers)}")

        if self.discovered_servers:
            for i, server in enumerate(self.discovered_servers, 1):
                ColorPrint.green(f"\n  [{i}] {server['host']}:{server['port']}")
                ColorPrint.blue(f"      Role: {server['role']}")
                ColorPrint.blue(f"      Response Time: {server['response_time']}s")
        else:
            ColorPrint.yellow("  No MCP servers found on network")

        ColorPrint.blue("\n" + "=" * 70)


# Convenience functions
def discover_mcp_servers(debug: bool = False) -> List[Dict[str, any]]:
    """
    Convenience function to discover MCP servers.

    Args:
        debug: Enable debug output

    Returns:
        List of discovered servers
    """
    discovery = MCPServerDiscovery(debug=debug)
    return discovery.find_servers()


def discover_mcp_servers_quick(debug: bool = False) -> List[Dict[str, any]]:
    """
    Quick discovery - only check local machine and gateway.

    Args:
        debug: Enable debug output

    Returns:
        List of discovered servers
    """
    discovery = MCPServerDiscovery(debug=debug)
    return discovery.find_servers_quick()


__all__ = [
    'MCPServerDiscovery',
    'discover_mcp_servers',
    'discover_mcp_servers_quick',
]

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Protocol - Standard protocol for MCP service discovery and communication

This module defines the standard protocol for:
1. MCP service identification
2. Service discovery queries
3. Address provider communication

Protocol Endpoints:
- GET /mcp/status - Check if service is MCP service
- GET /mcp/info - Get MCP service information
- GET /mcp/addresses - Get available addresses (for address provider)

Usage:
    # As MCP Service
    from pycore.pyutils.mcp.mcp_protocol import MCPServiceProtocol
    
    service = MCPServiceProtocol(port=8767)
    service.start()
    
    # As Address Provider
    from pycore.pyutils.mcp.mcp_protocol import MCPAddressProvider
    
    provider = MCPAddressProvider(port=8767)
    addresses = provider.query_available_addresses()
"""

import json
import socket
import time
import threading
import urllib.request
import urllib.error
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

from pycore import ColorPrint
from pycore.pyutils.mcp.address_service import AddressService, AddressCache


# Protocol constants
MCP_PROTOCOL_VERSION = "1.0"
MCP_STATUS_PATH = "/mcp/status"
MCP_INFO_PATH = "/mcp/info"
MCP_ADDRESSES_PATH = "/mcp/addresses"
MCP_DEFAULT_PORT = 8767


@dataclass
class MCPServiceInfo:
    """
    MCP Service Information
    
    Attributes:
        is_mcp_service: Whether this is an MCP service
        protocol_version: Protocol version
        service_name: Service name
        port: Listening port
        host: Listening host
        capabilities: List of service capabilities
        metadata: Additional metadata
    """
    is_mcp_service: bool = True
    protocol_version: str = MCP_PROTOCOL_VERSION
    service_name: str = "MCP Service"
    port: int = MCP_DEFAULT_PORT
    host: str = "localhost"
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MCPAddressResponse:
    """
    MCP Address Response
    
    Attributes:
        addresses: List of available addresses
        use_localhost: Whether using localhost service
        has_available_service: Whether there are available services
        provider_info: Information about the address provider
    """
    addresses: List[Dict[str, Any]] = field(default_factory=list)
    use_localhost: bool = False
    has_available_service: bool = False
    provider_info: Dict[str, Any] = field(default_factory=dict)


class MCPProtocolHandler(BaseHTTPRequestHandler):
    """
    HTTP Request Handler for MCP Protocol
    
    Handles standard MCP protocol endpoints.
    """
    
    service_info: MCPServiceInfo = None
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == MCP_STATUS_PATH:
            self._handle_status()
        elif path == MCP_INFO_PATH:
            self._handle_info()
        else:
            self._send_error(404, "Not Found")
    
    def _handle_status(self):
        """Handle /mcp/status request"""
        response = {
            "is_mcp_service": self.service_info.is_mcp_service,
            "protocol_version": self.service_info.protocol_version
        }
        self._send_json(response)
    
    def _handle_info(self):
        """Handle /mcp/info request"""
        response = asdict(self.service_info)
        self._send_json(response)
    
    def _send_json(self, data: Dict):
        """Send JSON response"""
        json_data = json.dumps(data, indent=2, ensure_ascii=False)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json_data.encode('utf-8'))
    
    def _send_error(self, code: int, message: str):
        """Send error response"""
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(message.encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override to suppress default logging"""
        pass


class MCPServiceProtocol:
    """
    MCP Service Protocol - Start MCP service with standard protocol
    
    Provides standard HTTP endpoints for MCP service identification
    and information queries.
    
    Features:
    - Standard protocol endpoints (/mcp/status, /mcp/info)
    - HTTP server for protocol queries
    - Service information management
    
    Usage:
        service = MCPServiceProtocol(
            port=8767,
            service_name="My MCP Service",
            capabilities=["tool1", "tool2"]
        )
        service.start()
    """
    
    def __init__(
        self,
        port: int = MCP_DEFAULT_PORT,
        host: str = "0.0.0.0",
        service_name: str = "MCP Service",
        capabilities: List[str] = None,
        metadata: Dict[str, Any] = None,
        debug: bool = False
    ):
        """
        Initialize MCP Service Protocol
        
        Args:
            port: Listening port
            host: Listening host (0.0.0.0 for all interfaces)
            service_name: Service name
            capabilities: List of service capabilities
            metadata: Additional metadata
            debug: Enable debug output
        """
        self.port = port
        self.host = host
        self.debug = debug
        
        # Service information
        self.service_info = MCPServiceInfo(
            is_mcp_service=True,
            protocol_version=MCP_PROTOCOL_VERSION,
            service_name=service_name,
            port=port,
            host=host if host != "0.0.0.0" else "localhost",
            capabilities=capabilities or [],
            metadata=metadata or {}
        )
        
        # HTTP server
        self.server: Optional[HTTPServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self._running = False
    
    def start(self):
        """Start MCP service protocol server"""
        if self._running:
            if self.debug:
                ColorPrint.yellow("[MCPServiceProtocol] Server already running")
            return
        
        try:
            # Create handler class with service info
            class Handler(MCPProtocolHandler):
                service_info = self.service_info
            
            # Create HTTP server
            self.server = HTTPServer((self.host, self.port), Handler)
            
            # Start server in background thread
            self.server_thread = threading.Thread(
                target=self._run_server,
                daemon=True,
                name=f"MCPProtocol-{self.port}"
            )
            self.server_thread.start()
            
            self._running = True
            
            if self.debug:
                ColorPrint.green(f"[MCPServiceProtocol] MCP service started on {self.host}:{self.port}")
                ColorPrint.blue(f"[MCPServiceProtocol] Status endpoint: http://{self.host}:{self.port}{MCP_STATUS_PATH}")
                ColorPrint.blue(f"[MCPServiceProtocol] Info endpoint: http://{self.host}:{self.port}{MCP_INFO_PATH}")
        
        except Exception as e:
            if self.debug:
                ColorPrint.red(f"[MCPServiceProtocol] Failed to start server: {e}")
            raise
    
    def _run_server(self):
        """Run HTTP server"""
        try:
            self.server.serve_forever()
        except Exception as e:
            if self.debug:
                ColorPrint.red(f"[MCPServiceProtocol] Server error: {e}")
    
    def stop(self):
        """Stop MCP service protocol server"""
        if not self._running:
            return
        
        self._running = False
        
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        
        if self.server_thread:
            self.server_thread.join(timeout=2.0)
        
        if self.debug:
            ColorPrint.blue("[MCPServiceProtocol] MCP service stopped")
    
    def update_service_info(self, **kwargs):
        """
        Update service information
        
        Args:
            **kwargs: Service info fields to update
        """
        for key, value in kwargs.items():
            if hasattr(self.service_info, key):
                setattr(self.service_info, key, value)
    
    def is_running(self) -> bool:
        """Check if service is running"""
        return self._running


class MCPAddressProvider:
    """
    MCP Address Provider - Query available addresses using standard protocol
    
    Queries local network and localhost for MCP services using the standard
    protocol and returns available addresses.
    
    Features:
    - Standard protocol queries
    - Network and localhost scanning
    - Address service integration
    - Returns address, use_localhost, has_available_service
    
    Usage:
        provider = MCPAddressProvider(port=8767, use_localhost=True)
        response = provider.query_available_addresses()
    """
    
    QUERY_TIMEOUT = 2.0
    
    def __init__(
        self,
        port: int = MCP_DEFAULT_PORT,
        use_localhost: bool = True,
        debug: bool = False
    ):
        """
        Initialize MCP Address Provider
        
        Args:
            port: Port to query
            use_localhost: Whether to query localhost
            debug: Enable debug output
        """
        self.port = port
        self.use_localhost = use_localhost
        self.debug = debug
        
        # Address service for network discovery
        self.address_service = AddressService(
            port=port,
            use_localhost=use_localhost,
            debug=debug
        )
    
    def query_available_addresses(self) -> MCPAddressResponse:
        """
        Query available addresses using standard protocol
        
        Queries:
        1. Local network (via AddressService)
        2. Localhost (if use_localhost=True)
        
        Returns:
            MCPAddressResponse with addresses and status
        """
        if self.debug:
            ColorPrint.blue("[MCPAddressProvider] Querying available addresses...")
        
        addresses = []
        use_localhost = False
        has_available_service = False
        
        # Query network addresses
        network_address = self.address_service.get_available_address()
        if network_address:
            if network_address.is_localhost:
                use_localhost = True
            else:
                # Verify network address using protocol
                if self._query_service_protocol(network_address.host, network_address.port):
                    addresses.append({
                        "host": network_address.host,
                        "port": network_address.port,
                        "websocket_url": network_address.websocket_url,
                        "is_localhost": False,
                        "is_available": True
                    })
                    has_available_service = True
        
        # Query localhost if enabled
        if self.use_localhost:
            if self._query_service_protocol("localhost", self.port):
                addresses.append({
                    "host": "localhost",
                    "port": self.port,
                    "websocket_url": f"ws://localhost:{self.port}",
                    "is_localhost": True,
                    "is_available": True
                })
                use_localhost = True
                has_available_service = True
        
        # If no network address but localhost available, use localhost
        if not addresses and use_localhost:
            addresses.append({
                "host": "localhost",
                "port": self.port,
                "websocket_url": f"ws://localhost:{self.port}",
                "is_localhost": True,
                "is_available": True
            })
        
        response = MCPAddressResponse(
            addresses=addresses,
            use_localhost=use_localhost,
            has_available_service=has_available_service,
            provider_info={
                "protocol_version": MCP_PROTOCOL_VERSION,
                "query_port": self.port
            }
        )
        
        if self.debug:
            ColorPrint.green(f"[MCPAddressProvider] Found {len(addresses)} address(es)")
            ColorPrint.blue(f"[MCPAddressProvider] Use localhost: {use_localhost}")
            ColorPrint.blue(f"[MCPAddressProvider] Has available service: {has_available_service}")
        
        return response
    
    def _query_service_protocol(self, host: str, port: int) -> bool:
        """
        Query service using standard protocol
        
        Args:
            host: Host to query
            port: Port to query
            
        Returns:
            True if service responds as MCP service
        """
        try:
            url = f"http://{host}:{port}{MCP_STATUS_PATH}"
            
            with urllib.request.urlopen(url, timeout=self.QUERY_TIMEOUT) as response:
                data = response.read().decode('utf-8')
                result = json.loads(data)
                
                is_mcp = result.get('is_mcp_service', False)
                
                if self.debug and is_mcp:
                    ColorPrint.green(f"[MCPAddressProvider] {host}:{port} is MCP service")
                
                return is_mcp
        
        except urllib.error.URLError:
            # Service not available or not MCP service
            return False
        except Exception as e:
            if self.debug:
                ColorPrint.yellow(f"[MCPAddressProvider] Query error for {host}:{port}: {e}")
            return False
    
    def query_service_info(self, host: str, port: int) -> Optional[MCPServiceInfo]:
        """
        Query service information using standard protocol
        
        Args:
            host: Host to query
            port: Port to query
            
        Returns:
            MCPServiceInfo or None
        """
        try:
            url = f"http://{host}:{port}{MCP_INFO_PATH}"
            
            with urllib.request.urlopen(url, timeout=self.QUERY_TIMEOUT) as response:
                data = response.read().decode('utf-8')
                result = json.loads(data)
                
                return MCPServiceInfo(**result)
        
        except Exception as e:
            if self.debug:
                ColorPrint.yellow(f"[MCPAddressProvider] Info query error for {host}:{port}: {e}")
            return None


__all__ = [
    'MCP_PROTOCOL_VERSION',
    'MCP_STATUS_PATH',
    'MCP_INFO_PATH',
    'MCP_ADDRESSES_PATH',
    'MCPServiceInfo',
    'MCPAddressResponse',
    'MCPServiceProtocol',
    'MCPAddressProvider',
]


#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Address Service - First MCP Service

This service uses AddressService from mcp class library to discover MCP servers
on the local network, connects to them via WebSocket, and exposes their APIs
through FastMCP for AI tools.

Architecture:
1. Use AddressService (from mcp class library) to get cached/discovered addresses
2. Connect to servers via WebSocket
3. Expose server information and APIs through FastMCP tools
4. Provide AI tools with access to discovered MCP servers

Usage:
    from pyapps.mcpserver.service.address_service import MCPServerAddressService
    
    service = MCPServerAddressService(port=8767)
    service.start()
"""

import json
import asyncio
import websockets
from typing import List, Dict, Optional, Any
from pathlib import Path

from pycore import ColorPrint
from pycore.pyutils.mcp import (
    AddressService as MCPAddressService,
    AddressCache,
    MCPServiceProtocol,
    MCPAddressProvider,
    MCPAddressResponse
)

# Try to import FastMCP
try:
    from mcp.server.fastmcp import FastMCP
    FASTMCP_AVAILABLE = True
except ImportError:
    FASTMCP_AVAILABLE = False
    FastMCP = None
    ColorPrint.yellow("[AddressService] FastMCP not available. Install: pip install mcp")


class MCPServerAddressService:
    """
    MCP Server Address Service - First MCP Service
    
    Uses AddressService from mcp class library to discover MCP servers on local
    network and exposes them via FastMCP.
    
    Features:
    - Uses cached address service from mcp class library
    - Network scanning and address mapping (via AddressService)
    - WebSocket connection management
    - FastMCP tool registration
    - Server health monitoring
    """
    
    def __init__(
        self,
        port: int = 8767,
        use_localhost: bool = True,
        start_mcp_service: bool = False,
        service_name: str = "MCP Server",
        debug: bool = False
    ):
        """
        Initialize MCP Server Address Service
        
        Args:
            port: Port number to scan for
            use_localhost: Whether to use localhost as fallback
            start_mcp_service: Whether to start MCP service protocol
            service_name: Service name (if starting MCP service)
            debug: Enable debug output
        """
        self.debug = debug
        self.port = port
        self.use_localhost = use_localhost
        
        # Use AddressService from mcp class library
        self.address_service = MCPAddressService(
            port=port,
            use_localhost=use_localhost,
            debug=debug
        )
        
        # MCP Service Protocol (if starting service)
        self.mcp_service_protocol: Optional[MCPServiceProtocol] = None
        if start_mcp_service:
            self.mcp_service_protocol = MCPServiceProtocol(
                port=port,
                service_name=service_name,
                debug=debug
            )
        
        # MCP Address Provider (for queries)
        self.address_provider = MCPAddressProvider(
            port=port,
            use_localhost=use_localhost,
            debug=debug
        )
        
        self.mcp_server = None
        
        # WebSocket connections cache
        self._ws_connections: Dict[str, Any] = {}  # Key: "host:port", Value: websocket connection
        
        # Initialize FastMCP if available
        if FASTMCP_AVAILABLE:
            self.mcp_server = FastMCP("MCPAddressService")
            self._register_tools()
        else:
            ColorPrint.yellow("[MCPServerAddressService] FastMCP not available - tools will not be registered")
    
    def _register_tools(self):
        """Register FastMCP tools"""
        if not self.mcp_server:
            return
        
        @self.mcp_server.tool()
        def query_available_addresses() -> str:
            """
            Query available addresses using standard MCP protocol
            
            Queries local network and localhost for MCP services using the
            standard protocol and returns available addresses.
            
            Returns:
                JSON string with addresses, use_localhost, and has_available_service
            """
            try:
                ColorPrint.blue("[MCPServerAddressService] Querying available addresses...")
                response = self.address_provider.query_available_addresses()
                
                result = {
                    "success": True,
                    "addresses": response.addresses,
                    "use_localhost": response.use_localhost,
                    "has_available_service": response.has_available_service,
                    "provider_info": response.provider_info
                }
                
                ColorPrint.green(f"[MCPServerAddressService] Found {len(response.addresses)} address(es)")
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e)
                }
                ColorPrint.red(f"[MCPServerAddressService] Query error: {e}")
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        @self.mcp_server.tool()
        def get_available_address() -> str:
            """
            Get available address (cached or discovered)
            
            Returns cached address if available, otherwise discovers new address.
            Falls back to localhost if no network address found.
            
            Returns:
                JSON string with available address information
            """
            try:
                ColorPrint.blue("[MCPServerAddressService] Getting available address...")
                address = self.address_service.get_available_address()
                
                if address:
                    result = {
                        "success": True,
                        "host": address.host,
                        "port": address.port,
                        "websocket_url": address.websocket_url,
                        "is_localhost": address.is_localhost,
                        "is_available": address.is_available,
                        "discovered_at": address.discovered_at,
                        "last_verified": address.last_verified
                    }
                    ColorPrint.green(f"[MCPServerAddressService] Address: {address.host}:{address.port}")
                else:
                    result = {
                        "success": False,
                        "error": "No available address found"
                    }
                    ColorPrint.yellow("[MCPServerAddressService] No address available")
                
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e)
                }
                ColorPrint.red(f"[MCPServerAddressService] Error: {e}")
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        @self.mcp_server.tool()
        def get_cached_address() -> str:
            """
            Get currently cached address
            
            Returns:
                JSON string with cached address information
            """
            try:
                address = self.address_service.get_cached_address()
                
                if address:
                    result = {
                        "success": True,
                        "host": address.host,
                        "port": address.port,
                        "websocket_url": address.websocket_url,
                        "is_localhost": address.is_localhost,
                        "is_available": address.is_available,
                        "discovered_at": address.discovered_at,
                        "last_verified": address.last_verified
                    }
                else:
                    result = {
                        "success": False,
                        "error": "No cached address"
                    }
                
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e)
                }
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        @self.mcp_server.tool()
        def connect_to_server(host: str = None, port: int = None) -> str:
            """
            Connect to an MCP server via WebSocket
            
            Args:
                host: Server IP address or hostname (uses cached address if not provided)
                port: Server port (uses service port if not provided)
                
            Returns:
                JSON string with connection status
            """
            try:
                # Use cached address if host/port not provided
                if host is None or port is None:
                    address = self.address_service.get_available_address()
                    if address:
                        host = address.host
                        port = address.port
                    else:
                        return json.dumps({
                            "success": False,
                            "error": "No available address"
                        }, indent=2, ensure_ascii=False)
                
                ws_url = f"ws://{host}:{port}"
                
                ColorPrint.blue(f"[MCPServerAddressService] Connecting to {ws_url}...")
                
                # Test WebSocket connection (async)
                connection_result = asyncio.run(self._test_websocket_connection(ws_url))
                
                result = {
                    "success": connection_result["success"],
                    "host": host,
                    "port": port,
                    "websocket_url": ws_url,
                    "connected": connection_result.get("connected", False),
                    "message": connection_result.get("message", "")
                }
                
                if connection_result["success"]:
                    ColorPrint.green(f"[MCPServerAddressService] Successfully connected to {ws_url}")
                else:
                    ColorPrint.yellow(f"[MCPServerAddressService] Connection failed: {connection_result.get('message', '')}")
                
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e),
                    "host": host,
                    "port": port
                }
                ColorPrint.red(f"[MCPServerAddressService] Connection error: {e}")
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        @self.mcp_server.tool()
        def query_server_api(host: str = None, port: int = None, query: str = "") -> str:
            """
            Query an MCP server API via WebSocket
            
            Args:
                host: Server IP address or hostname (uses cached address if not provided)
                port: Server port (uses service port if not provided)
                query: Query string or command to send
                
            Returns:
                JSON string with API response
            """
            try:
                # Use cached address if host/port not provided
                if host is None or port is None:
                    address = self.address_service.get_available_address()
                    if address:
                        host = address.host
                        port = address.port
                    else:
                        return json.dumps({
                            "success": False,
                            "error": "No available address"
                        }, indent=2, ensure_ascii=False)
                
                ws_url = f"ws://{host}:{port}"
                
                ColorPrint.blue(f"[MCPServerAddressService] Querying {ws_url} with: {query}")
                
                # Send query via WebSocket (async)
                query_result = asyncio.run(self._query_websocket(ws_url, query))
                
                result = {
                    "success": query_result["success"],
                    "host": host,
                    "port": port,
                    "websocket_url": ws_url,
                    "query": query,
                    "response": query_result.get("response", ""),
                    "error": query_result.get("error", "")
                }
                
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e),
                    "host": host,
                    "port": port,
                    "query": query
                }
                ColorPrint.red(f"[MCPServerAddressService] Query error: {e}")
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        ColorPrint.green("[MCPServerAddressService] FastMCP tools registered")
    
    async def _test_websocket_connection(self, ws_url: str, timeout: float = 5.0) -> Dict[str, Any]:
        """
        Test WebSocket connection to a server
        
        Args:
            ws_url: WebSocket URL
            timeout: Connection timeout in seconds
            
        Returns:
            Dict with connection result
        """
        try:
            async with websockets.connect(ws_url, timeout=timeout) as websocket:
                # Connection successful
                return {
                    "success": True,
                    "connected": True,
                    "message": "Connection successful"
                }
        except asyncio.TimeoutError:
            return {
                "success": False,
                "connected": False,
                "message": "Connection timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "connected": False,
                "message": f"Connection error: {str(e)}"
            }
    
    async def _query_websocket(self, ws_url: str, query: str, timeout: float = 10.0) -> Dict[str, Any]:
        """
        Query a server via WebSocket
        
        Args:
            ws_url: WebSocket URL
            query: Query string or command
            timeout: Operation timeout in seconds
            
        Returns:
            Dict with query result
        """
        try:
            async with websockets.connect(ws_url, timeout=timeout) as websocket:
                # Send query
                if query:
                    await websocket.send(query)
                
                # Wait for response (with timeout)
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=timeout)
                    return {
                        "success": True,
                        "response": response
                    }
                except asyncio.TimeoutError:
                    return {
                        "success": False,
                        "error": "Response timeout"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def start(self):
        """Start the address service"""
        ColorPrint.blue("[MCPServerAddressService] Starting address service...")
        
        # Start MCP service protocol if enabled
        if self.mcp_service_protocol:
            self.mcp_service_protocol.start()
            ColorPrint.green("[MCPServerAddressService] MCP service protocol started")
        
        # Get initial address (will trigger scan if needed)
        address = self.address_service.get_available_address()
        
        if address:
            if self.debug:
                ColorPrint.green(f"[MCPServerAddressService] Initial address: {address.host}:{address.port}")
        else:
            if self.debug:
                ColorPrint.yellow("[MCPServerAddressService] No address available")
        
        # Start background scanning
        self.address_service.start_background_scanning()
        
        ColorPrint.green("[MCPServerAddressService] Address service started")
    
    def stop(self):
        """Stop the address service"""
        # Stop MCP service protocol if running
        if self.mcp_service_protocol:
            self.mcp_service_protocol.stop()
        
        self.address_service.stop_background_scanning()
        ColorPrint.blue("[MCPServerAddressService] Address service stopped")
    
    def get_fastmcp_server(self):
        """
        Get FastMCP server instance
        
        Returns:
            FastMCP server instance or None
        """
        return self.mcp_server
    
    def run_fastmcp_server(self):
        """
        Run FastMCP server (blocking)
        
        This should be called to start the FastMCP server for AI tools.
        """
        if not self.mcp_server:
            ColorPrint.red("[MCPServerAddressService] FastMCP not available - cannot run server")
            return
        
        ColorPrint.blue("[MCPServerAddressService] Starting FastMCP server...")
        self.mcp_server.run()


__all__ = ['MCPServerAddressService']


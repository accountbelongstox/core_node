#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Middleware - Integrates FastMCP with RPC

This middleware layer:
1. Uses FastMCP as frontend to communicate with AI tools
2. Uses FastMCP singleton pattern
3. Calls RPC address provider to get available LAN or localhost address
4. If no service found, starts local RPC server based on returned info
5. Provides either a usable LAN RPC address or localhost address
6. Provides other parameters, optionally starts local MCP service

Architecture:
- FastMCP (singleton) <-> MCP Middleware <-> RPC Address Provider <-> RPC Server
"""

import asyncio
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from pycore import ColorPrint
from pycore.pyutils.rpc import UnifiedRpcServer, RPCAddressProvider, RPCAddress, get_rpc_config

# Try to import FastMCP
try:
    from mcp.server.fastmcp import FastMCP
    FASTMCP_AVAILABLE = True
except ImportError:
    FASTMCP_AVAILABLE = False
    FastMCP = None
    ColorPrint.yellow("[MCPMiddleware] FastMCP not available. Install: pip install mcp")


@dataclass
class MCPMiddlewareConfig:
    """Configuration for MCP Middleware"""
    auto_start_server: bool = True  # Auto-start RPC server if no service found
    server_port: Optional[int] = None  # RPC server port (uses config if None)
    server_host: str = "0.0.0.0"  # RPC server host
    debug: bool = False
    project_root: Optional[Path] = None  # Project root directory (auto-detected if None)


class MCPMiddleware:
    """
    MCP Middleware - Integrates FastMCP with RPC
    
    Features:
    - FastMCP singleton pattern for AI tool communication
    - RPC address discovery (LAN or localhost)
    - Automatic RPC server startup if needed
    - First MCP service: project directory scanner
    """
    
    _instance: Optional['MCPMiddleware'] = None
    _lock = threading.Lock()
    
    def __new__(cls, config: Optional[MCPMiddlewareConfig] = None):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, config: Optional[MCPMiddlewareConfig] = None):
        """Initialize MCP Middleware (singleton)"""
        if hasattr(self, '_initialized'):
            return  # Already initialized
        
        self.config = config or MCPMiddlewareConfig()
        self._initialized = True
        
        # Auto-detect project root
        if self.config.project_root is None:
            # Auto-detect: D:\programing\core_node
            current_file = Path(__file__)
            # Go up from pyapps/mcpserver/service/mcp_middleware.py to core_node
            self.config.project_root = current_file.parent.parent.parent.parent
        
        self.debug = self.config.debug
        
        # RPC configuration
        self.rpc_config = get_rpc_config()
        self.server_port = self.config.server_port or self.rpc_config.get_port()
        self.server_host = self.config.server_host
        
        # RPC Address Provider
        self.address_provider = RPCAddressProvider(debug=self.debug)
        
        # RPC Server (started if needed)
        self.rpc_server: Optional[UnifiedRpcServer] = None
        self._server_task: Optional[asyncio.Task] = None
        self._server_lock = threading.Lock()
        
        # FastMCP server (singleton)
        self.mcp_server: Optional[FastMCP] = None
        if FASTMCP_AVAILABLE:
            self.mcp_server = FastMCP("MCPMiddleware")
            self._register_tools()
        else:
            ColorPrint.yellow("[MCPMiddleware] FastMCP not available - tools will not be registered")
    
    def _register_tools(self):
        """Register FastMCP tools"""
        if not self.mcp_server:
            return
        
        @self.mcp_server.tool()
        def get_rpc_address(start_local_server: bool = True) -> str:
            """
            Get available RPC address (LAN or localhost)
            
            Discovers available RPC services on local network. If no service found
            and start_local_server is True, starts local RPC server.
            
            Args:
                start_local_server: Whether to start local server if no service found
            
            Returns:
                JSON string with RPC address information:
                {
                    "host": str,
                    "port": int,
                    "http_url": str,
                    "websocket_url": str,
                    "is_localhost": bool,
                    "is_local_lan": bool,
                    "server_started": bool  # Whether server was started by this call
                }
            """
            try:
                if self.debug:
                    ColorPrint.blue("[MCPMiddleware] Getting RPC address...")
                
                # Get available addresses
                addresses = self.address_provider.get_available_addresses(use_localhost=True)
                
                # Prefer LAN address over localhost
                selected_address: Optional[RPCAddress] = None
                for addr in addresses:
                    if addr.is_local_lan and addr.is_available:
                        selected_address = addr
                        break
                
                # Fallback to localhost
                if not selected_address:
                    for addr in addresses:
                        if addr.is_localhost and addr.is_available:
                            selected_address = addr
                            break
                
                server_started = False
                
                # If no address found and auto-start enabled, start local server
                if not selected_address and start_local_server and self.config.auto_start_server:
                    if self.debug:
                        ColorPrint.yellow("[MCPMiddleware] No RPC service found, starting local server...")
                    
                    # Start local RPC server
                    success = self._start_local_rpc_server()
                    if success:
                        server_started = True
                        # Get localhost address
                        selected_address = self.address_provider.get_localhost_address()
                
                if not selected_address:
                    error_result = {
                        "success": False,
                        "error": "No RPC address available and server startup failed",
                        "server_started": False
                    }
                    import json
                    return json.dumps(error_result, indent=2, ensure_ascii=False)
                
                result = {
                    "success": True,
                    "host": selected_address.host,
                    "port": selected_address.port,
                    "http_url": selected_address.http_url,
                    "websocket_url": selected_address.websocket_url,
                    "is_localhost": selected_address.is_localhost,
                    "is_local_lan": selected_address.is_local_lan,
                    "server_started": server_started
                }
                
                if self.debug:
                    ColorPrint.green(f"[MCPMiddleware] RPC address: {selected_address.host}:{selected_address.port}")
                
                import json
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e),
                    "server_started": False
                }
                ColorPrint.red(f"[MCPMiddleware] Error getting RPC address: {e}")
                import json
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        @self.mcp_server.tool()
        def scan_project_directory(
            directory: str = "",
            recursive: bool = True,
            include_hidden: bool = False,
            max_depth: int = 10
        ) -> str:
            """
            Scan project directory structure
            
            Scans the project directory (D:\\programing\\core_node) and returns
            file and directory structure using relative paths.
            
            Args:
                directory: Subdirectory to scan (relative to project root, empty = root)
                recursive: Whether to scan recursively
                include_hidden: Whether to include hidden files/directories
                max_depth: Maximum depth for recursive scan
            
            Returns:
                JSON string with directory structure:
                {
                    "directory": str,
                    "files": List[str],  # Relative paths
                    "directories": List[str],  # Relative paths
                    "total_files": int,
                    "total_dirs": int
                }
            """
            try:
                if self.debug:
                    ColorPrint.blue(f"[MCPMiddleware] Scanning directory: {directory}")
                
                # Resolve directory path
                project_root = self.config.project_root
                if directory:
                    target_dir = (project_root / directory).resolve()
                else:
                    target_dir = project_root
                
                # Ensure target is within project root
                try:
                    target_dir.relative_to(project_root)
                except ValueError:
                    error_result = {
                        "error": f"Directory outside project root: {directory}",
                        "directory": str(target_dir),
                        "files": [],
                        "directories": [],
                        "total_files": 0,
                        "total_dirs": 0
                    }
                    import json
                    return json.dumps(error_result, indent=2, ensure_ascii=False)
                
                if not target_dir.exists():
                    error_result = {
                        "error": f"Directory not found: {target_dir}",
                        "directory": str(target_dir),
                        "files": [],
                        "directories": [],
                        "total_files": 0,
                        "total_dirs": 0
                    }
                    import json
                    return json.dumps(error_result, indent=2, ensure_ascii=False)
                
                files = []
                directories = []
                
                def scan_dir(path: Path, depth: int = 0):
                    """Recursive directory scanner"""
                    if depth > max_depth:
                        return
                    
                    try:
                        for item in path.iterdir():
                            if not include_hidden and item.name.startswith('.'):
                                continue
                            
                            rel_path = item.relative_to(project_root)
                            
                            if item.is_file():
                                files.append(str(rel_path).replace('\\', '/'))
                            elif item.is_dir():
                                directories.append(str(rel_path).replace('\\', '/'))
                                if recursive and depth < max_depth:
                                    scan_dir(item, depth + 1)
                    except PermissionError:
                        pass  # Skip directories without permission
                
                scan_dir(target_dir)
                
                result = {
                    "directory": str(target_dir.relative_to(project_root)).replace('\\', '/') if directory else ".",
                    "files": sorted(files),
                    "directories": sorted(directories),
                    "total_files": len(files),
                    "total_dirs": len(directories),
                    "project_root": str(project_root)
                }
                
                if self.debug:
                    ColorPrint.green(f"[MCPMiddleware] Scanned {len(files)} files, {len(directories)} directories")
                
                import json
                return json.dumps(result, indent=2, ensure_ascii=False)
                
            except Exception as e:
                error_result = {
                    "error": str(e),
                    "directory": directory,
                    "files": [],
                    "directories": [],
                    "total_files": 0,
                    "total_dirs": 0
                }
                ColorPrint.red(f"[MCPMiddleware] Scan error: {e}")
                import json
                return json.dumps(error_result, indent=2, ensure_ascii=False)
        
        ColorPrint.green("[MCPMiddleware] FastMCP tools registered")
    
    def _start_local_rpc_server(self) -> bool:
        """
        Start local RPC server
        
        Returns:
            True if server started successfully
        """
        with self._server_lock:
            if self.rpc_server is not None:
                if self.debug:
                    ColorPrint.yellow("[MCPMiddleware] RPC server already running")
                return True
            
            try:
                if self.debug:
                    ColorPrint.blue("[MCPMiddleware] Starting local RPC server...")
                
                # Create RPC server
                self.rpc_server = UnifiedRpcServer(options={
                    'port': self.server_port,
                    'host': self.server_host,
                    'debug': self.debug
                })
                
                # Register scan_directory route
                self.rpc_server.route('scan_directory', self._scan_directory_handler)
                
                # Start server in background
                def run_server():
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(self.rpc_server.start())
                    loop.run_forever()
                
                server_thread = threading.Thread(target=run_server, daemon=True)
                server_thread.start()
                
                # Wait a bit for server to start
                import time
                time.sleep(1)
                
                if self.debug:
                    ColorPrint.green(f"[MCPMiddleware] RPC server started on {self.server_host}:{self.server_port}")
                
                return True
                
            except Exception as e:
                ColorPrint.red(f"[MCPMiddleware] Failed to start RPC server: {e}")
                self.rpc_server = None
                return False
    
    def _scan_directory_handler(self, params: Dict[str, Any], request_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        RPC route handler for scan_directory
        
        This is the same handler used by the RPC server.
        """
        directory = params.get('directory', '')
        recursive = params.get('recursive', True)
        include_hidden = params.get('include_hidden', False)
        max_depth = params.get('max_depth', 10)
        
        # Resolve directory path
        project_root = self.config.project_root
        if directory:
            target_dir = (project_root / directory).resolve()
        else:
            target_dir = project_root
        
        # Ensure target is within project root
        try:
            target_dir.relative_to(project_root)
        except ValueError:
            return {
                'error': f'Directory outside project root: {directory}',
                'directory': str(target_dir),
                'files': [],
                'directories': [],
                'total_files': 0,
                'total_dirs': 0
            }
        
        if not target_dir.exists():
            return {
                'error': f'Directory not found: {target_dir}',
                'directory': str(target_dir),
                'files': [],
                'directories': [],
                'total_files': 0,
                'total_dirs': 0
            }
        
        files = []
        directories = []
        
        def scan_dir(path: Path, depth: int = 0):
            """Recursive directory scanner"""
            if depth > max_depth:
                return
            
            try:
                for item in path.iterdir():
                    if not include_hidden and item.name.startswith('.'):
                        continue
                    
                    rel_path = item.relative_to(project_root)
                    
                    if item.is_file():
                        files.append(str(rel_path).replace('\\', '/'))
                    elif item.is_dir():
                        directories.append(str(rel_path).replace('\\', '/'))
                        if recursive and depth < max_depth:
                            scan_dir(item, depth + 1)
            except PermissionError:
                pass  # Skip directories without permission
        
        scan_dir(target_dir)
        
        return {
            'directory': str(target_dir.relative_to(project_root)).replace('\\', '/') if directory else '.',
            'files': sorted(files),
            'directories': sorted(directories),
            'total_files': len(files),
            'total_dirs': len(directories),
            'project_root': str(project_root)
        }
    
    def get_fastmcp_server(self) -> Optional[FastMCP]:
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
            ColorPrint.red("[MCPMiddleware] FastMCP not available - cannot run server")
            return
        
        ColorPrint.blue("[MCPMiddleware] Starting FastMCP server...")
        self.mcp_server.run()
    
    def stop(self):
        """Stop middleware and cleanup"""
        if self.rpc_server:
            # Stop RPC server
            try:
                asyncio.run(self.rpc_server.stop())
            except Exception as e:
                ColorPrint.yellow(f"[MCPMiddleware] Error stopping RPC server: {e}")
            self.rpc_server = None
        
        ColorPrint.blue("[MCPMiddleware] Middleware stopped")


# Singleton getter
def get_mcp_middleware(config: Optional[MCPMiddlewareConfig] = None) -> MCPMiddleware:
    """
    Get MCP Middleware singleton instance
    
    Args:
        config: Optional configuration (only used on first call)
    
    Returns:
        MCPMiddleware singleton instance
    """
    return MCPMiddleware(config)


__all__ = ['MCPMiddleware', 'MCPMiddlewareConfig', 'get_mcp_middleware']


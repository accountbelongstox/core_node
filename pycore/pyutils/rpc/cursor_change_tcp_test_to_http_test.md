

修复返回类型问题，确保所有工具函数返回 JSON 字符串：


```python
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
                    return {
                        "success": False,
                        "error": "No RPC address available and server startup failed",
                        "server_started": False
                    }
                
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


```


修复 `get_rpc_address` 的返回类型问题：


```python
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


```


修复 `mcpserver_main.py` 中访问 FastMCP 工具的方式：


```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server Application - Entry Point

Usage:
    python pymain.py app=mcpserver
"""

import sys
import webbrowser
import threading
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import NativeUILauncher, LaunchMode
from pycore.pyutils.native_ui.step1_config.tray_config import TrayConfig, TrayMenuItem, TrayBackend
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import get_bus_manager, BusSignals
from pycore.pyutils.native_ui.step0_i18n import i18n
from pyapps.mcpserver.config import Config
from pyapps.mcpserver.mcpserver_bus_keys import MCPServerBusKeys, register_bus_keys
from pyapps.mcpserver.mcpserver_i18n import MCPServerI18nKeys


def main_app_entry():
    """Main application entry point - initialize services and configure tray"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MCP SERVER - STARTING SERVICES")
    ColorPrint.blue("=" * 70)
    
    # Initialize address service (first MCP service)
    from pyapps.mcpserver.service.address_service import MCPServerAddressService
    address_service = MCPServerAddressService(port=8767, use_localhost=True, debug=True)
    address_service.start()
    
    ColorPrint.green("MCP Server services initialized")
    ColorPrint.yellow("Services will be started from tray menu")
    
    # Setup tray configuration via THREAD_BUS manager
    _configure_tray_menu()


def on_closing():
    """Cleanup callback when app closes"""
    ColorPrint.yellow(f"[MCP Server] {i18n.get(MCPServerI18nKeys.CLOSING)}")
    ColorPrint.yellow("Stopping all services...")


def _create_tray_menu_items():
    """Create tray menu items using TrayMenuItem from tray_config"""
    menu_items = [
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_START_MCP_SERVER,
            signal=MCPServerBusKeys.TRAY_START_MCP_SERVER
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_START_MAIN_SERVER,
            signal=MCPServerBusKeys.TRAY_START_MAIN_SERVER
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_START_AS_CLIENT,
            signal=MCPServerBusKeys.TRAY_START_AS_CLIENT
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_OPEN_WEB_UI,
            signal=MCPServerBusKeys.TRAY_OPEN_WEB_UI
        ),
        TrayMenuItem(
            text_key=MCPServerI18nKeys.TRAY_RESTART,
            signal=MCPServerBusKeys.TRAY_RESTART
        ),
        TrayMenuItem.SEPARATOR,
    ]
    
    return menu_items


def _create_language_submenu():
    """Create language selection submenu"""
    supported_languages = i18n.get_supported_languages()
    current_language = i18n.get_current_language()
    
    submenu_items = []
    for lang in supported_languages:
        # Get language name key from i18n_manager (dynamically from base_config)
        name_key = i18n.get_language_name_key(lang)
        
        # Use unique signal per language: signal.{lang} to pass language code
        signal = f"{MCPServerBusKeys.TRAY_SET_LANGUAGE}.{lang}"
        
        submenu_items.append(TrayMenuItem(
            text_key=name_key,
            signal=signal,
            checkable=True,
            checked=(lang == current_language)
        ))
    
    return submenu_items


def _append_original_menu_items(menu_items):
    """Append original menu items from mcpserver_old"""
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_SHOW_STATUS,
        signal=MCPServerBusKeys.TRAY_SHOW_STATUS
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_SHOW_INFO,
        signal=MCPServerBusKeys.TRAY_SHOW_INFO
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    
    # Add language selection menu with submenu
    language_submenu = _create_language_submenu()
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_LANGUAGE,
        signal="",  # No direct action, only submenu
        submenu=language_submenu
    ))
    menu_items.append(TrayMenuItem.SEPARATOR)
    
    menu_items.append(TrayMenuItem(
        text_key=MCPServerI18nKeys.TRAY_EXIT,
        signal=MCPServerBusKeys.TRAY_EXIT
    ))
    
    return menu_items


def _configure_tray_menu():
    """Configure tray menu via THREAD_BUS manager"""
    icon_path = str(PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png")
    
    menu_items = _create_tray_menu_items()
    menu_items = _append_original_menu_items(menu_items)
    
    tray_config = TrayConfig(
        enabled=True,
        backend=TrayBackend.TKINTER,
        app_name=i18n.get(MCPServerI18nKeys.APP_NAME),
        icon_path=icon_path if Path(icon_path).exists() else None,
        menu_items=menu_items,
        show_on_minimize=True,
        start_minimized=False,
        close_to_tray=True
    )
    
    bus_mgr = get_bus_manager()
    bus_mgr.set_tray_config(tray_config)
    
    ColorPrint.green("[MCP Server] Tray configuration stored in THREAD_BUS")


def _setup_tray_signal_handlers():
    """Setup THREAD_BUS event handlers for tray menu actions"""
    from pyapps.mcpserver.service.mcp_middleware import get_mcp_middleware, MCPMiddlewareConfig
    
    # Initialize MCP middleware (singleton)
    middleware_config = MCPMiddlewareConfig(
        auto_start_server=True,
        debug=True,
        project_root=PROJECT_ROOT
    )
    mcp_middleware = get_mcp_middleware(middleware_config)
    
    def handle_start_mcp_server(event_data):
        """Start MCP server (FastMCP + RPC)"""
        ColorPrint.blue("[MCP Server] Starting MCP server...")
        
        try:
            # Ensure RPC server is available by calling get_rpc_address
            # This will auto-start server if needed
            import json
            try:
                # Directly call the middleware method to get RPC address
                # This will trigger server startup if needed
                addresses = mcp_middleware.address_provider.get_available_addresses(use_localhost=True)
                
                if not addresses:
                    # No address found, start local server
                    ColorPrint.blue("[MCP Server] No RPC service found, starting local server...")
                    success = mcp_middleware._start_local_rpc_server()
                    if success:
                        ColorPrint.green("[MCP Server] Local RPC server started")
                        # Get localhost address
                        localhost_addr = mcp_middleware.address_provider.get_localhost_address()
                        ColorPrint.green(f"[MCP Server] RPC address: {localhost_addr.host}:{localhost_addr.port}")
                    else:
                        ColorPrint.red("[MCP Server] Failed to start local RPC server")
                else:
                    # Use first available address (prefer LAN)
                    selected = None
                    for addr in addresses:
                        if addr.is_local_lan and addr.is_available:
                            selected = addr
                            break
                    if not selected:
                        for addr in addresses:
                            if addr.is_localhost and addr.is_available:
                                selected = addr
                                break
                    
                    if selected:
                        ColorPrint.green(f"[MCP Server] RPC address: {selected.host}:{selected.port}")
            except Exception as e:
                ColorPrint.yellow(f"[MCP Server] Error getting RPC address: {e}")
                import traceback
                traceback.print_exc()
            
            # Start FastMCP server in background thread
            def run_fastmcp():
                try:
                    mcp_middleware.run_fastmcp_server()
                except Exception as e:
                    ColorPrint.red(f"[MCP Server] FastMCP server error: {e}")
            
            fastmcp_thread = threading.Thread(target=run_fastmcp, daemon=True)
            fastmcp_thread.start()
            
            ColorPrint.green("[MCP Server] MCP server started (FastMCP + RPC)")
            
        except Exception as e:
            ColorPrint.red(f"[MCP Server] Failed to start MCP server: {e}")
    
    def handle_start_main_server(event_data):
        ColorPrint.blue("[MCP Server] Starting main server...")
    
    def handle_start_as_client(event_data):
        ColorPrint.blue("[MCP Server] Starting as client...")
    
    def handle_open_web_ui(event_data):
        web_url = f"http://localhost:{Config.WEB_PORT}"
        webbrowser.open(web_url)
        ColorPrint.blue(f"[MCP Server] Opened web UI: {web_url}")
    
    def handle_restart(event_data):
        ColorPrint.blue("[MCP Server] Restarting application...")
        THREAD_BUS.trigger_event(BusSignals.TRAY_STOP, {"source": "restart_handler"})
    
    def handle_exit(event_data):
        ColorPrint.yellow("[MCP Server] Exiting application...")
        on_closing()
        THREAD_BUS.trigger_event(BusSignals.TRAY_STOP, {"source": "exit_handler"})
    
    def handle_show_status(event_data):
        ColorPrint.blue("[MCP Server] Show status requested")
        ColorPrint.green("MCP Server Status:")
        ColorPrint.green("  Services: Initialized")
        ColorPrint.green("  Ready for commands")
    
    def handle_show_info(event_data):
        ColorPrint.blue("[MCP Server] Show info requested")
        ColorPrint.green("MCP Server - Global Backend")
        ColorPrint.green("  • Unified RPC server for all MCP services")
        ColorPrint.green("  • WebSocket RPC: ws://localhost:8767")
        ColorPrint.green("  • Singleton Port: 19997")
    
    # Setup language change handler (using library function)
    bus_mgr = get_bus_manager()
    bus_mgr.setup_language_change_handler(MCPServerBusKeys.TRAY_SET_LANGUAGE)
    
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_START_MCP_SERVER, handle_start_mcp_server)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_START_MAIN_SERVER, handle_start_main_server)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_START_AS_CLIENT, handle_start_as_client)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_OPEN_WEB_UI, handle_open_web_ui)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_RESTART, handle_restart)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_SHOW_STATUS, handle_show_status)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_SHOW_INFO, handle_show_info)
    THREAD_BUS.register_event_handler(MCPServerBusKeys.TRAY_EXIT, handle_exit)


def start():
    """Standard entry point for pymain.py launcher"""
    # Register app-specific BusKeys (required)
    register_bus_keys()
    
    # Extend i18n with app-specific translations (base translations already loaded)
    app_dir = Path(__file__).parent
    i18n.extend_translations(
        app_dir=str(app_dir),
        app_name="mcpserver",
        use_system_language=True
    )
    
    # Setup tray signal handlers before launching
    _setup_tray_signal_handlers()
    
    # Create launcher
    launcher = NativeUILauncher(
        app_id="mcpserver",
        port_start=55000,
        port_range=100,
        timeout=1.0,
        debug=True
    )
    
    icon_path = str(PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png")
    
    # Launch using NativeUILauncher.launch() method
    result = launcher.launch(
        app_name=i18n.get(MCPServerI18nKeys.APP_NAME),
        main_entry=main_app_entry,
        mode=LaunchMode.TRAY_ONLY,
        startup_width=600,
        startup_height=500,
        min_display_time=2.0,
        icon_path=icon_path if Path(icon_path).exists() else None,
        enable_language_selector=True
    )
    
    if not result.success:
        if result.existing_instance:
            ColorPrint.yellow(f"[MCP Server] Instance already running at port {result.existing_port}")
        else:
            ColorPrint.red(f"[MCP Server] Launch failed: {result.message}")
        return
    
    ColorPrint.green(f"[MCP Server] Launched successfully on port {result.port}")
    ColorPrint.green("[MCP Server] Tray menu started. Right-click tray icon to access menu.")


if __name__ == "__main__":
    start()


```


## 完成的工作

### 1. 创建 MCP 中间层 (`mcp_middleware.py`)
- 使用 FastMCP 单例模式与 AI 工具通信
- 集成 RPC 地址提供者，获取可用局域网或本机地址
- 未找到服务时自动启动本地 RPC 服务器
- 提供配置参数，可选是否启动本地 MCP 服务

### 2. 实现第一个 MCP 服务：项目目录扫描
- 工具函数：`scan_project_directory`
- 自动定位项目根目录：`D:\programing\core_node`
- 使用相对路径返回文件结构
- 支持递归扫描、隐藏文件过滤、最大深度限制

### 3. 集成到托盘菜单
- 在 `mcpserver_main.py` 中集成中间层
- 托盘菜单项 "Start MCP Server" 启动 MCP 服务
- 启动流程：
  1. 发现可用 RPC 地址（优先局域网）
  2. 如未找到，自动启动本地 RPC 服务器
  3. 在后台线程启动 FastMCP 服务器

### 4. 核心功能
- `get_rpc_address`: 获取可用 RPC 地址（局域网或本地）
- `scan_project_directory`: 扫描项目目录结构
- 自动服务器启动：未找到服务时自动启动
- 单例模式：确保全局只有一个中间层实例

## 使用方式

1. 从托盘菜单启动：右键托盘图标 → "Start MCP Server"
2. 程序会自动：
   - 发现可用的 RPC 服务（局域网或本地）
   - 如未找到，启动本地 RPC 服务器
   - 启动 FastMCP 服务器供 AI 工具使用

## FastMCP 工具

1. `get_rpc_address(start_local_server=True)`: 获取 RPC 地址
2. `scan_project_directory(directory="", recursive=True, include_hidden=False, max_depth=10)`: 扫描项目目录

代码已就绪，可通过托盘菜单启动 MCP 服务。

---

**User**

D:\programing\core_node\pycore\pyutils\rpc 将util类库中的端口配置为一个不容易被占用的端口，不要使用8080之类的。

---

**Cursor**


查看当前端口配置，并改为不易被占用的高位端口：



将默认端口从 8080 改为不易被占用的高位端口：


```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Constants

Defines all constants used by the RPC framework (HTTP + WebSocket).
Moved from pycore.pygvar.ws_rpc_constants.
"""

class RPC_CONSTANTS:
    """RPC framework constants (HTTP + WebSocket)"""

    MESSAGE_TYPES = {
        'REQUEST': 'request',
        'RESPONSE': 'response',
        'EVENT': 'event',
        'WELCOME': 'welcome',
        'ERROR': 'error',
        'PING': 'ping',
        'PONG': 'pong',
        'AUTH': 'auth',
        'AUTH_RESPONSE': 'auth_response',
        'SUBSCRIBE': 'subscribe',
        'UNSUBSCRIBE': 'unsubscribe',
        'BROADCAST': 'broadcast',
        'CANCEL': 'cancel',
        'ACK': 'ack',  # Acknowledgment - client confirms receipt
        'ACK_REQUEST': 'ack_request'  # Server requests acknowledgment
    }

    DEFAULTS = {
        'SERVER_PORT': 58765,  # High port to avoid conflicts (changed from 8080)
        'SERVER_HOST': '0.0.0.0',
        'REQUEST_TIMEOUT': 30.0,
        'RECONNECT_INTERVAL': 3.0,
        'MAX_RECONNECT_ATTEMPTS': 10,
        'HEARTBEAT_INTERVAL': 30.0,
        'HEARTBEAT_TIMEOUT': 5.0,
        'MAX_PAYLOAD_SIZE': 10485760,  # 10MB
        'COMPRESSION_THRESHOLD': 1024,  # 1KB
        'MAX_LISTENERS': 100
    }

    CONNECTION = {
        'STATE_CONNECTING': 0,
        'STATE_OPEN': 1,
        'STATE_CLOSING': 2,
        'STATE_CLOSED': 3
    }

    ERROR_CODES = {
        'ROUTE_NOT_FOUND': 'ROUTE_NOT_FOUND',
        'TIMEOUT': 'TIMEOUT',
        'UNAUTHORIZED': 'UNAUTHORIZED',
        'FORBIDDEN': 'FORBIDDEN',
        'PAYLOAD_TOO_LARGE': 'PAYLOAD_TOO_LARGE',
        'INTERNAL_ERROR': 'INTERNAL_ERROR',
        'INVALID_MESSAGE': 'INVALID_MESSAGE',
        'CONNECTION_LOST': 'CONNECTION_LOST',
        'CANCELLED': 'CANCELLED'
    }

    EVENTS = {
        'CONNECTION': 'connection',
        'DISCONNECT': 'disconnect',
        'ERROR': 'error',
        'RECONNECT': 'reconnect',
        'RECONNECT_FAILED': 'reconnect_failed',
        'AUTHENTICATED': 'authenticated',
        'UNAUTHORIZED': 'unauthorized',
        'MESSAGE': 'message',
        'LATENCY': 'latency'
    }

    # HTTP RPC specific
    HTTP_METHODS = {
        'GET': 'GET',
        'POST': 'POST',
        'PUT': 'PUT',
        'DELETE': 'DELETE',
        'PATCH': 'PATCH'
    }

    # WebSocket RPC specific
    WS_PATH = '/rpc/ws'  # WebSocket endpoint path
    HTTP_PATH_PREFIX = '/rpc'  # HTTP RPC endpoint prefix


```


检查是否还有其他需要更新的地方：



更新测试文件，使其使用共享配置而不是硬编码端口：


```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Simple test to check client connection"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pycore import ColorPrint
from pycore.pyutils.rpc.protocol.rpc_protocol import RPCProtocolClient
from pycore.pyutils.rpc import get_rpc_config

def main():
    ColorPrint.blue("Testing RPC service connection...")
    
    # Use shared configuration
    config = get_rpc_config()
    port = config.get_port()
    
    client = RPCProtocolClient(host='localhost', port=port, debug=True)
    
    ColorPrint.blue(f"Checking localhost:{port}...")
    result = client.check_rpc_service()
    ColorPrint.blue(f"Result: {result}")
    
    if result:
        ColorPrint.green("RPC service is available!")
        info = client.query_service_info()
        if info:
            ColorPrint.blue(f"Service Info: {info}")
    else:
        ColorPrint.yellow("RPC service not found")

if __name__ == '__main__':
    main()


```


已将 RPC 类库的默认端口从 8080 改为 58765（高位端口，不易被占用）。

## 更改内容

1. **`pycore/pyutils/rpc/config/constants.py`**
   - 将 `DEFAULTS['SERVER_PORT']` 从 `8080` 改为 `58765`
   - 添加注释说明这是高位端口，避免冲突

2. **`pyapps/mcpserver/test_client_simple.py`**
   - 移除硬编码的端口 8080
   - 改为使用共享配置 `get_rpc_config().get_port()`

## 端口说明

- 新端口：58765（高位端口，不易被占用）
- 旧端口：8080（常见端口，容易被其他服务占用）

所有使用 `get_rpc_config()` 的组件会自动使用新端口。如需自定义，可通过环境变量 `RPC_PORT` 设置，或在代码中调用 `config.set_port(port)`。

注意：`pyapps/mcpserver/config/__init__.py` 中的 `WEB_PORT = 8080` 是应用特定配置，不是 RPC 类库配置，因此未修改。


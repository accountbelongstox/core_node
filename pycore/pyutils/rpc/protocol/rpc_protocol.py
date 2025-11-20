#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Protocol - Standard protocol for RPC service discovery and communication

This module defines the standard protocol for:
1. RPC service identification
2. Service discovery queries
3. Address provider communication
4. Protocol synchronization confirmation

Protocol Endpoints:
- GET /rpc/status - Check if service is RPC service
- GET /rpc/info - Get RPC service information
- GET /rpc/addresses - Get available addresses (for address provider)
- POST /rpc/protocol/sync - Protocol synchronization confirmation

Uses shared port configuration from RPCConfig.
"""

import json
import socket
import sys
import time
import threading
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

from pycore import ColorPrint
from pycore.pyutils.rpc.config.rpc_config import get_rpc_config
from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS

# Protocol constants
RPC_PROTOCOL_VERSION = "1.0"
RPC_STATUS_PATH = "/rpc/status"
RPC_INFO_PATH = "/rpc/info"
RPC_ADDRESSES_PATH = "/rpc/addresses"
RPC_PROTOCOL_SYNC_PATH = "/rpc/protocol/sync"


@dataclass
class RPCServiceInfo:
    """
    RPC Service Information
    
    Attributes:
        is_rpc_service: Whether this is an RPC service
        protocol_version: Protocol version
        service_name: Service name
        port: Listening port (from shared config)
        host: Listening host
        capabilities: List of service capabilities
        metadata: Additional metadata
    """
    is_rpc_service: bool = True
    protocol_version: str = RPC_PROTOCOL_VERSION
    service_name: str = "RPC Service"
    port: int = None  # Will be set from config
    host: str = "localhost"
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RPCAddressResponse:
    """
    RPC Address Response
    
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


@dataclass
class RPCProtocolVersion:
    """RPC Protocol Version"""
    version: str = RPC_PROTOCOL_VERSION


class RPCProtocolHandler(BaseHTTPRequestHandler):
    """
    HTTP Request Handler for RPC Protocol
    
    Handles standard RPC protocol endpoints.
    """
    
    service_info: RPCServiceInfo = None
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == RPC_STATUS_PATH:
            self._handle_status()
        elif path == RPC_INFO_PATH:
            self._handle_info()
        elif path == RPC_ADDRESSES_PATH:
            self._handle_addresses()
        else:
            self._send_error(404, "Not Found")
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == RPC_PROTOCOL_SYNC_PATH:
            self._handle_protocol_sync()
        else:
            self._send_error(404, "Not Found")
    
    def _handle_status(self):
        """Handle /rpc/status request"""
        response = {
            "is_rpc_service": self.service_info.is_rpc_service,
            "protocol_version": self.service_info.protocol_version
        }
        self._send_json(response)
    
    def _handle_info(self):
        """Handle /rpc/info request"""
        response = asdict(self.service_info)
        self._send_json(response)
    
    def _handle_addresses(self):
        """Handle /rpc/addresses request (for address provider)"""
        # This should be implemented by address provider
        response = {
            "addresses": [],
            "use_localhost": False,
            "has_available_service": False
        }
        self._send_json(response)
    
    def _handle_protocol_sync(self):
        """Handle /rpc/protocol/sync request (protocol synchronization confirmation)"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
            else:
                data = {}
            
            # Protocol synchronization confirmation
            response = {
                "status": "synced",
                "protocol_version": self.service_info.protocol_version,
                "timestamp": time.time(),
                "received_data": data
            }
            self._send_json(response)
        except Exception as e:
            self._send_error(500, str(e))
    
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


class RPCProtocolServer:
    """
    RPC Protocol Server - Start RPC service with standard protocol
    
    Provides standard HTTP endpoints for RPC service identification
    and information queries. Uses shared port configuration.
    
    Features:
    - Standard protocol endpoints (/rpc/status, /rpc/info, /rpc/protocol/sync)
    - HTTP server for protocol queries
    - Service information management
    - Protocol synchronization confirmation
    
    Usage:
        server = RPCProtocolServer(
            port=None,  # Uses shared config port
            service_name="My RPC Service",
            capabilities=["http", "websocket"]
        )
        server.start()
    """
    
    def __init__(
        self,
        port: Optional[int] = None,
        host: str = "0.0.0.0",
        service_name: str = "RPC Service",
        capabilities: List[str] = None,
        metadata: Dict[str, Any] = None,
        debug: bool = False
    ):
        """
        Initialize RPC Protocol Server
        
        Args:
            port: Listening port (uses shared config port if None)
            host: Listening host (0.0.0.0 for all interfaces)
            service_name: Service name
            capabilities: List of service capabilities
            metadata: Additional metadata
            debug: Enable debug output
        """
        self.config = get_rpc_config()
        self.port = port or self.config.get_port()
        self.host = host
        self.debug = debug
        
        # Service information
        self.service_info = RPCServiceInfo(
            is_rpc_service=True,
            protocol_version=RPC_PROTOCOL_VERSION,
            service_name=service_name,
            port=self.port,
            host=host if host != "0.0.0.0" else "localhost",
            capabilities=capabilities or [],
            metadata=metadata or {}
        )
        
        # HTTP server
        self.server: Optional[HTTPServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self._running = False
    
    def start(self):
        """Start RPC protocol server"""
        if self._running:
            if self.debug:
                ColorPrint.yellow("[RPCProtocolServer] Server already running")
            return
        
        try:
            # Create handler class with service info
            class Handler(RPCProtocolHandler):
                service_info = self.service_info
            
            # Create HTTP server
            self.server = HTTPServer((self.host, self.port), Handler)
            
            # Start server in background thread
            self.server_thread = threading.Thread(
                target=self._run_server,
                daemon=True,
                name=f"RPCProtocol-{self.port}"
            )
            self.server_thread.start()
            
            self._running = True
            
            if self.debug:
                ColorPrint.green(f"[RPCProtocolServer] RPC service started on {self.host}:{self.port}")
                ColorPrint.blue(f"[RPCProtocolServer] Status endpoint: http://{self.host}:{self.port}{RPC_STATUS_PATH}")
                ColorPrint.blue(f"[RPCProtocolServer] Info endpoint: http://{self.host}:{self.port}{RPC_INFO_PATH}")
                ColorPrint.blue(f"[RPCProtocolServer] Protocol sync endpoint: http://{self.host}:{self.port}{RPC_PROTOCOL_SYNC_PATH}")
        
        except Exception as e:
            if self.debug:
                ColorPrint.red(f"[RPCProtocolServer] Failed to start server: {e}")
            raise
    
    def _run_server(self):
        """Run HTTP server"""
        try:
            self.server.serve_forever()
        except Exception as e:
            if self.debug:
                ColorPrint.red(f"[RPCProtocolServer] Server error: {e}")
    
    def stop(self):
        """Stop RPC protocol server"""
        if not self._running:
            return
        
        self._running = False
        
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        
        if self.server_thread:
            self.server_thread.join(timeout=2.0)
        
        if self.debug:
            ColorPrint.blue("[RPCProtocolServer] RPC service stopped")
    
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


class RPCProtocolClient:
    """
    RPC Protocol Client - Query RPC services using standard protocol
    
    Queries local network and localhost for RPC services using the standard
    protocol and returns available addresses. Uses shared port configuration.
    
    Features:
    - Standard protocol queries
    - Network and localhost scanning
    - Protocol synchronization confirmation
    - Returns address, use_localhost, has_available_service
    
    Usage:
        client = RPCProtocolClient(host="localhost", port=None)  # Uses shared config port
        is_rpc = client.check_rpc_service()
        info = client.query_service_info()
    """
    
    QUERY_TIMEOUT = 2.0
    
    def __init__(
        self,
        host: str = "localhost",
        port: Optional[int] = None,
        debug: bool = False
    ):
        """
        Initialize RPC Protocol Client
        
        Args:
            host: Host to query
            port: Port to query (uses shared config port if None)
            debug: Enable debug output
        """
        self.config = get_rpc_config()
        self.host = host
        self.port = port or self.config.get_port()
        self.debug = debug
    
    def check_rpc_service(self) -> bool:
        """
        Check if host is an RPC service using standard protocol
        
        Returns:
            True if service responds as RPC service
        """
        # Check if interpreter is shutting down
        if sys.is_finalizing():
            return False
        
        try:
            url = f"http://{self.host}:{self.port}{RPC_STATUS_PATH}"
            
            # Use socket directly instead of urllib to avoid asyncio issues
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.QUERY_TIMEOUT)
            try:
                sock.connect((self.host, self.port))
                # Send HTTP request
                request = f"GET {RPC_STATUS_PATH} HTTP/1.1\r\nHost: {self.host}:{self.port}\r\nConnection: close\r\n\r\n"
                sock.sendall(request.encode('utf-8'))
                
                # Read response
                response_data = b''
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    response_data += chunk
                    if b'\r\n\r\n' in response_data:
                        break
                
                sock.close()
                
                # Parse response
                if response_data:
                    response_str = response_data.decode('utf-8', errors='ignore')
                    # Extract JSON from response body
                    if '\r\n\r\n' in response_str:
                        body = response_str.split('\r\n\r\n', 1)[1]
                        result = json.loads(body)
                        is_rpc = result.get('is_rpc_service', False)
                        
                        if self.debug and is_rpc:
                            ColorPrint.green(f"[RPCProtocolClient] {self.host}:{self.port} is RPC service")
                        
                        return is_rpc
                
                return False
                
            except (socket.timeout, socket.error, OSError):
                return False
            finally:
                try:
                    sock.close()
                except:
                    pass
        
        except (RuntimeError, SystemError) as e:
            # Interpreter shutdown or system error
            if 'shutdown' in str(e).lower() or 'finalizing' in str(e).lower():
                return False
            if self.debug:
                ColorPrint.yellow(f"[RPCProtocolClient] Query error for {self.host}:{self.port}: {e}")
            return False
        except Exception as e:
            if self.debug:
                ColorPrint.yellow(f"[RPCProtocolClient] Query error for {self.host}:{self.port}: {e}")
            return False
    
    def query_service_info(self) -> Optional[RPCServiceInfo]:
        """
        Query service information using standard protocol
        
        Returns:
            RPCServiceInfo or None
        """
        # Check if interpreter is shutting down
        if sys.is_finalizing():
            return None
        
        try:
            # Use socket directly instead of urllib to avoid asyncio issues
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.QUERY_TIMEOUT)
            try:
                sock.connect((self.host, self.port))
                # Send HTTP request
                request = f"GET {RPC_INFO_PATH} HTTP/1.1\r\nHost: {self.host}:{self.port}\r\nConnection: close\r\n\r\n"
                sock.sendall(request.encode('utf-8'))
                
                # Read response
                response_data = b''
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    response_data += chunk
                    if b'\r\n\r\n' in response_data:
                        break
                
                # Parse response
                if response_data:
                    response_str = response_data.decode('utf-8', errors='ignore')
                    # Extract JSON from response body
                    if '\r\n\r\n' in response_str:
                        body = response_str.split('\r\n\r\n', 1)[1]
                        result = json.loads(body)
                        return RPCServiceInfo(**result)
                
                return None
                
            except (socket.timeout, socket.error, OSError):
                return None
            finally:
                try:
                    sock.close()
                except:
                    pass
        
        except (RuntimeError, SystemError) as e:
            # Interpreter shutdown or system error
            if 'shutdown' in str(e).lower() or 'finalizing' in str(e).lower():
                return None
            if self.debug:
                ColorPrint.yellow(f"[RPCProtocolClient] Info query error for {self.host}:{self.port}: {e}")
            return None
        except Exception as e:
            if self.debug:
                ColorPrint.yellow(f"[RPCProtocolClient] Info query error for {self.host}:{self.port}: {e}")
            return None
    
    def confirm_protocol_sync(self, sync_data: Optional[Dict] = None) -> Optional[Dict]:
        """
        Confirm protocol synchronization
        
        Args:
            sync_data: Optional synchronization data to send
        
        Returns:
            Response dictionary or None
        """
        # Check if interpreter is shutting down
        if sys.is_finalizing():
            return None
        
        try:
            # Use socket directly instead of urllib to avoid asyncio issues
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.QUERY_TIMEOUT)
            try:
                sock.connect((self.host, self.port))
                
                # Prepare POST data
                data = sync_data or {}
                json_data = json.dumps(data).encode('utf-8')
                
                # Send HTTP POST request
                request = (
                    f"POST {RPC_PROTOCOL_SYNC_PATH} HTTP/1.1\r\n"
                    f"Host: {self.host}:{self.port}\r\n"
                    f"Content-Type: application/json\r\n"
                    f"Content-Length: {len(json_data)}\r\n"
                    f"Connection: close\r\n\r\n"
                ).encode('utf-8') + json_data
                
                sock.sendall(request)
                
                # Read response
                response_data = b''
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    response_data += chunk
                    if b'\r\n\r\n' in response_data:
                        break
                
                # Parse response
                if response_data:
                    response_str = response_data.decode('utf-8', errors='ignore')
                    # Extract JSON from response body
                    if '\r\n\r\n' in response_str:
                        body = response_str.split('\r\n\r\n', 1)[1]
                        result = json.loads(body)
                        
                        if self.debug:
                            ColorPrint.green(f"[RPCProtocolClient] Protocol sync confirmed: {self.host}:{self.port}")
                        
                        return result
                
                return None
                
            except (socket.timeout, socket.error, OSError):
                return None
            finally:
                try:
                    sock.close()
                except:
                    pass
        
        except (RuntimeError, SystemError) as e:
            # Interpreter shutdown or system error
            if 'shutdown' in str(e).lower() or 'finalizing' in str(e).lower():
                return None
            if self.debug:
                ColorPrint.yellow(f"[RPCProtocolClient] Protocol sync error for {self.host}:{self.port}: {e}")
            return None
        except Exception as e:
            if self.debug:
                ColorPrint.yellow(f"[RPCProtocolClient] Protocol sync error for {self.host}:{self.port}: {e}")
            return None


__all__ = [
    'RPC_PROTOCOL_VERSION',
    'RPC_STATUS_PATH',
    'RPC_INFO_PATH',
    'RPC_ADDRESSES_PATH',
    'RPC_PROTOCOL_SYNC_PATH',
    'RPCServiceInfo',
    'RPCAddressResponse',
    'RPCProtocolVersion',
    'RPCProtocolServer',
    'RPCProtocolClient',
]


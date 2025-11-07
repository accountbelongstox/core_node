#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server Main Entry Point

Unified MCP Server using Singleton Pattern with WebSocket RPC

Architecture:
- Single backend instance serves all MCP services
- Multiple clients can connect via WebSocket RPC
- All MCP tools registered as RPC routes
- No heavy frameworks (FastMCP, Flask, FastAPI removed)
- Uses only Python stdlib + websockets + pycore libraries

MCP Services Integrated:
1. codebase-scanner: Code analysis and file management
2. file-processor: Document parsing and OCR
3. placeholder-image-generator: Image generation and replacement
4. mcp-alchemy: Database operations
5. ai-collaboration: AI session management
6. (More services can be added easily)

Usage:
    python main.py --app=mcpserver
    python mcpserver_main.py

The first instance becomes PRIMARY (runs backend)
Additional instances become SECONDARY (connect to backend)
"""

import sys
import os
import time
from pathlib import Path

# Add paths for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import singleton RPC backend
from pycore.pyutils.wsrpc.singleton_rpc_example import SingletonRpcBackend

# Import MCP service implementations
# These will be loaded dynamically


class UnifiedMCPServer(SingletonRpcBackend):
    """
    Unified MCP Server with all services integrated

    This server combines all MCP services into a single backend:
    - Codebase Scanner
    - File Processor
    - Placeholder Image Generator
    - MCP Alchemy (Database)
    - AI Collaboration
    - And more...

    All services are accessible via WebSocket RPC routes.
    """

    def __init__(
        self,
        singleton_host: str = 'localhost',
        singleton_port: int = 19997,  # Unique port for MCP server
        rpc_host: str = 'localhost',
        rpc_port: int = 8767,  # Unique RPC port for MCP
        debug: bool = True
    ):
        """Initialize Unified MCP Server"""
        super().__init__(
            singleton_host=singleton_host,
            singleton_port=singleton_port,
            rpc_host=rpc_host,
            rpc_port=rpc_port,
            debug=debug
        )

        self.project_root = PROJECT_ROOT
        self.mcp_services_dir = PROJECT_ROOT / 'ncore' / 'mcp_server'

        # Service statistics
        self.service_stats = {
            'services_loaded': [],
            'total_requests': 0,
            'start_time': time.time()
        }

        # Service instances (lazy loaded)
        self._service_instances = {}

        self._log("Unified MCP Server initialized")

    def _register_backend_routes(self):
        """Register all MCP service routes"""

        # ============================================
        # Codebase Scanner Routes
        # ============================================

        @self.rpc_server.route('codebase.generate_tree')
        async def codebase_generate_tree(params):
            """Generate directory tree structure"""
            return await self._call_codebase_scanner('generate_tree', params)

        @self.rpc_server.route('codebase.find_file')
        async def codebase_find_file(params):
            """Find files by name or pattern"""
            return await self._call_codebase_scanner('find_file', params)

        @self.rpc_server.route('codebase.search_content')
        async def codebase_search_content(params):
            """Search content in files"""
            return await self._call_codebase_scanner('search_content', params)

        @self.rpc_server.route('codebase.get_stats')
        async def codebase_get_stats(params):
            """Get codebase statistics"""
            return await self._call_codebase_scanner('get_stats', params)

        # ============================================
        # File Processor Routes
        # ============================================

        @self.rpc_server.route('file.parse_document')
        async def file_parse_document(params):
            """Parse various document formats"""
            return await self._call_file_processor('parse_document', params)

        @self.rpc_server.route('file.convert_document')
        async def file_convert_document(params):
            """Convert between document formats"""
            return await self._call_file_processor('convert_document', params)

        @self.rpc_server.route('file.ocr_recognize')
        async def file_ocr_recognize(params):
            """OCR recognition on images"""
            return await self._call_file_processor('ocr_recognize', params)

        # ============================================
        # Placeholder Image Generator Routes
        # ============================================

        @self.rpc_server.route('image.generate_placeholder')
        async def image_generate_placeholder(params):
            """Generate placeholder images"""
            return await self._call_image_generator('generate_placeholder', params)

        @self.rpc_server.route('image.replace_placeholder')
        async def image_replace_placeholder(params):
            """Replace existing images with placeholders"""
            return await self._call_image_generator('replace_placeholder', params)

        @self.rpc_server.route('image.scan_directory')
        async def image_scan_directory(params):
            """Scan directory for placeholder images"""
            return await self._call_image_generator('scan_directory', params)

        # ============================================
        # Database (MCP Alchemy) Routes
        # ============================================

        @self.rpc_server.route('db.execute_query')
        async def db_execute_query(params):
            """Execute SQL query"""
            return await self._call_db_service('execute_query', params)

        @self.rpc_server.route('db.list_tables')
        async def db_list_tables(params):
            """List all tables in database"""
            return await self._call_db_service('list_tables', params)

        @self.rpc_server.route('db.get_schema')
        async def db_get_schema(params):
            """Get table schema"""
            return await self._call_db_service('get_schema', params)

        # ============================================
        # AI Collaboration Routes
        # ============================================

        @self.rpc_server.route('ai.register_role')
        async def ai_register_role(params):
            """Register AI role"""
            return await self._call_ai_collaboration('register_role', params)

        @self.rpc_server.route('ai.write_log')
        async def ai_write_log(params):
            """Write AI work log"""
            return await self._call_ai_collaboration('write_log', params)

        @self.rpc_server.route('ai.ask_question')
        async def ai_ask_question(params):
            """Ask question to another AI"""
            return await self._call_ai_collaboration('ask_question', params)

        # ============================================
        # System Routes
        # ============================================

        @self.rpc_server.route('system.health')
        async def system_health(params):
            """Get system health status"""
            return {
                'success': True,
                'status': 'running',
                'is_primary': self._is_primary_instance,
                'uptime_seconds': time.time() - self.service_stats['start_time'],
                'services_loaded': self.service_stats['services_loaded'],
                'total_requests': self.service_stats['total_requests'],
                'clients_connected': len(self.rpc_server.clients),
                'timestamp': time.time()
            }

        @self.rpc_server.route('system.list_services')
        async def system_list_services(params):
            """List all available services"""
            return {
                'success': True,
                'services': {
                    'codebase': ['generate_tree', 'find_file', 'search_content', 'get_stats'],
                    'file': ['parse_document', 'convert_document', 'ocr_recognize'],
                    'image': ['generate_placeholder', 'replace_placeholder', 'scan_directory'],
                    'db': ['execute_query', 'list_tables', 'get_schema'],
                    'ai': ['register_role', 'write_log', 'ask_question'],
                    'system': ['health', 'list_services', 'get_info']
                },
                'timestamp': time.time()
            }

        @self.rpc_server.route('system.get_info')
        async def system_get_info(params):
            """Get server information"""
            return {
                'success': True,
                'server_name': 'Unified MCP Server',
                'version': '1.0.0',
                'project_root': str(self.project_root),
                'architecture': 'Singleton + WebSocket RPC',
                'python_version': sys.version,
                'timestamp': time.time()
            }

        self._log(f"Registered {len(self.rpc_server.routes)} RPC routes")

    # ============================================
    # Service Call Handlers
    # ============================================

    async def _call_codebase_scanner(self, method: str, params: dict) -> dict:
        """Call codebase scanner service"""
        self.service_stats['total_requests'] += 1

        # Lazy load service
        if 'codebase_scanner' not in self._service_instances:
            try:
                # Import and initialize codebase scanner
                from ncore.mcp_server.codebase_scanner_service import CodebaseScannerService
                self._service_instances['codebase_scanner'] = CodebaseScannerService()
                self.service_stats['services_loaded'].append('codebase_scanner')
                self._log("Loaded codebase_scanner service")
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Failed to load codebase_scanner service: {e}'
                }

        # Call method
        service = self._service_instances['codebase_scanner']
        try:
            if hasattr(service, method):
                return await getattr(service, method)(params)
            else:
                return {
                    'success': False,
                    'error': f'Method {method} not found in codebase_scanner'
                }
        except Exception as e:
            self._log(f"Error calling codebase.{method}: {e}", 'ERROR')
            return {
                'success': False,
                'error': str(e)
            }

    async def _call_file_processor(self, method: str, params: dict) -> dict:
        """Call file processor service"""
        self.service_stats['total_requests'] += 1

        # For now, return not implemented
        return {
            'success': False,
            'error': 'File processor service not yet implemented',
            'method': method,
            'params': params
        }

    async def _call_image_generator(self, method: str, params: dict) -> dict:
        """Call placeholder image generator service"""
        self.service_stats['total_requests'] += 1

        # For now, return not implemented
        return {
            'success': False,
            'error': 'Image generator service not yet implemented',
            'method': method,
            'params': params
        }

    async def _call_db_service(self, method: str, params: dict) -> dict:
        """Call database service"""
        self.service_stats['total_requests'] += 1

        # For now, return not implemented
        return {
            'success': False,
            'error': 'Database service not yet implemented',
            'method': method,
            'params': params
        }

    async def _call_ai_collaboration(self, method: str, params: dict) -> dict:
        """Call AI collaboration service"""
        self.service_stats['total_requests'] += 1

        # For now, return not implemented
        return {
            'success': False,
            'error': 'AI collaboration service not yet implemented',
            'method': method,
            'params': params
        }


def main():
    """Main entry point for Unified MCP Server"""
    print("=" * 70)
    print("Unified MCP Server - Singleton Pattern + WebSocket RPC")
    print("=" * 70)
    print()
    print("All MCP services integrated into single backend:")
    print("  • Codebase Scanner")
    print("  • File Processor")
    print("  • Placeholder Image Generator")
    print("  • Database Operations")
    print("  • AI Collaboration")
    print()

    # Configuration
    SINGLETON_PORT = 19997
    RPC_PORT = 8767
    DEBUG = True

    # Create unified MCP server
    server = UnifiedMCPServer(
        singleton_host='localhost',
        singleton_port=SINGLETON_PORT,
        rpc_host='localhost',
        rpc_port=RPC_PORT,
        debug=DEBUG
    )

    # Set event callbacks
    server.on_primary_started(
        lambda: print("\n✓ Started as PRIMARY instance (running MCP backend)\n")
    )
    server.on_secondary_started(
        lambda: print("\n✓ Started as SECONDARY instance (reusing MCP backend)\n")
    )
    server.on_shutdown(
        lambda: print("\n✓ Shutting down MCP server...\n")
    )

    # Start server
    if server.start():
        try:
            print("=" * 70)
            print("MCP Server Status")
            print("=" * 70)

            if server.is_primary_instance():
                print(f"Role: PRIMARY (Backend Running)")
                print(f"RPC Server: ws://localhost:{RPC_PORT}")
                print(f"Singleton Detection: localhost:{SINGLETON_PORT}")
                print(f"Project Root: {server.project_root}")
            else:
                print(f"Role: SECONDARY (Client Only)")
                print(f"Connected to: ws://localhost:{RPC_PORT}")

            print()
            print("Multiple instances can run - they share the same backend.")
            print("Press Ctrl+C to stop.")
            print("=" * 70)
            print()

            # Keep running
            while server.is_running():
                time.sleep(1)

        except KeyboardInterrupt:
            print("\n\nReceived interrupt signal")

        finally:
            server.stop()
            print("\nMCP Server stopped.")

    else:
        print("ERROR: Failed to start MCP Server!")
        sys.exit(1)


def start():
    """Alternative entry point (for compatibility)"""
    main()


if __name__ == '__main__':
    main()

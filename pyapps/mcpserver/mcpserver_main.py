#!/usr/bin/env python3
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
import traceback
from pathlib import Path

# Add paths for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import pycore utilities
from pycore import ColorPrint

# Import singleton RPC backend
from pycore.pyutils.wsrpc import SingletonRpcBackend

# Import services (using absolute imports)
from pyapps.mcpserver.services.document_offline_service import DocumentOfflineService
from pyapps.mcpserver.services.webview_service import WebviewService
from pyapps.mcpserver.services.icon_info_service import IconInfoService
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

        # Initialize services
        self.document_offline_service = DocumentOfflineService()
        self.webview_service = WebviewService()
        # Temporarily disabled to test
        # self.icon_info_service = IconInfoService()
        try:
            self.icon_info_service = IconInfoService()
            ColorPrint.blue("Icon Info Service initialized")
        except Exception as e:
            ColorPrint.red(f"Failed to initialize Icon Info Service: {e}")
            self.icon_info_service = None

        ColorPrint.blue("Unified MCP Server initialized")

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
        # Document Offline Routes
        # ============================================

        @self.rpc_server.route('document_offline.start_crawl')
        async def document_offline_start_crawl(params):
            """Start document offline crawl"""
            return await self.document_offline_service.start_crawl(params)

        @self.rpc_server.route('document_offline.get_status')
        async def document_offline_get_status(params):
            """Get crawl status"""
            return await self.document_offline_service.get_status(params)

        @self.rpc_server.route('document_offline.stop_crawl')
        async def document_offline_stop_crawl(params):
            """Stop active crawl"""
            return await self.document_offline_service.stop_crawl(params)

        @self.rpc_server.route('document_offline.list_crawls')
        async def document_offline_list_crawls(params):
            """List all crawls"""
            return await self.document_offline_service.list_crawls(params)

        # ============================================
        # Webview Launcher Routes
        # ============================================

        @self.rpc_server.route('webview.create_launcher')
        async def webview_create_launcher(params):
            """Create a new webview launcher"""
            return await self.webview_service.create_launcher(params)

        @self.rpc_server.route('webview.start_launcher')
        async def webview_start_launcher(params):
            """Start a webview launcher"""
            return await self.webview_service.start_launcher(params)

        @self.rpc_server.route('webview.stop_launcher')
        async def webview_stop_launcher(params):
            """Stop a webview launcher"""
            return await self.webview_service.stop_launcher(params)

        @self.rpc_server.route('webview.reload_webview')
        async def webview_reload_webview(params):
            """Reload webview window"""
            return await self.webview_service.reload_webview(params)

        @self.rpc_server.route('webview.launch_pymatrix')
        async def webview_launch_pymatrix(params):
            """Launch pyMatrix with webview GUI"""
            return await self.webview_service.launch_pymatrix(params)

        @self.rpc_server.route('webview.list_launchers')
        async def webview_list_launchers(params):
            """List all active launchers"""
            return await self.webview_service.list_launchers(params)

        @self.rpc_server.route('webview.get_status')
        async def webview_get_status(params):
            """Get launcher status"""
            return await self.webview_service.get_launcher_status(params)

        # ============================================
        # Icon Information Routes - TESTING ONE BY ONE
        # ============================================

        try:
            self._log("Attempting to register icon routes...")

            # Test with simplest route first
            if self.icon_info_service is not None:
                @self.rpc_server.route('icon.get_metadata')
                async def icon_get_metadata(params):
                    """Get basic image metadata (dimensions, format)"""
                    return await self.icon_info_service.get_icon_metadata(params)

                self._log("Successfully registered icon.get_metadata route")
            else:
                self._log("Icon service is None, skipping icon routes", level='WARNING')

        except Exception as e:
            self._log(f"Error registering icon routes: {e}", level='ERROR')
            self._log(f"Traceback: {traceback.format_exc()}", level='ERROR')

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
                    'document_offline': ['start_crawl', 'get_status', 'stop_crawl', 'list_crawls'],
                    'webview': ['create_launcher', 'start_launcher', 'stop_launcher', 'reload_webview', 'launch_pymatrix', 'list_launchers', 'get_status'],
                    # 'icon': ['analyze', 'get_metadata', 'extract_text', 'analyze_colors', 'batch_analyze', 'find_similar', 'scan_directory', 'get_hash', 'slice_equal', 'slice_custom', 'slice_grid', 'slice_sprite', 'crop', 'create_grid'],
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
    # Immediate startup output
    print("\n" + "=" * 70)
    print("MCP Server Main - Entry Point Called")
    print("=" * 70)
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"PID: {os.getpid()}")
    print(f"CWD: {os.getcwd()}")
    print(f"Project Root: {PROJECT_ROOT}")
    print("=" * 70 + "\n")

    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Unified MCP Server - Singleton Pattern + WebSocket RPC")
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("")
    ColorPrint.blue("All MCP services integrated into single backend:")
    ColorPrint.blue("  • Codebase Scanner")
    ColorPrint.blue("  • File Processor")
    ColorPrint.blue("  • Placeholder Image Generator")
    ColorPrint.blue("  • Database Operations")
    ColorPrint.blue("  • AI Collaboration")
    ColorPrint.blue("")

    # Configuration
    SINGLETON_PORT = 19997
    RPC_PORT = 8767
    DEBUG = True

    ColorPrint.blue(f"Configuration:")
    ColorPrint.blue(f"  • Singleton Port: {SINGLETON_PORT}")
    ColorPrint.blue(f"  • RPC Port: {RPC_PORT}")
    ColorPrint.blue(f"  • Debug Mode: {DEBUG}")
    ColorPrint.blue("")

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
        lambda: ColorPrint.green("\n✓ Started as PRIMARY instance (running MCP backend)\n")
    )
    server.on_secondary_started(
        lambda: ColorPrint.green("\n✓ Started as SECONDARY instance (reusing MCP backend)\n")
    )
    server.on_shutdown(
        lambda: ColorPrint.blue("\n✓ Shutting down MCP server...\n")
    )

    # Start server
    if server.start():
        try:
            ColorPrint.blue("=" * 70)
            ColorPrint.blue("MCP Server Status")
            ColorPrint.blue("=" * 70)

            if server.is_primary_instance():
                ColorPrint.green(f"Role: PRIMARY (Backend Running)")
                ColorPrint.blue(f"RPC Server: ws://localhost:{RPC_PORT}")
                ColorPrint.blue(f"Singleton Detection: localhost:{SINGLETON_PORT}")
                ColorPrint.blue(f"Project Root: {server.project_root}")
            else:
                ColorPrint.green(f"Role: SECONDARY (Client Only)")
                ColorPrint.blue(f"Connected to: ws://localhost:{RPC_PORT}")

            ColorPrint.blue("")
            ColorPrint.blue("Multiple instances can run - they share the same backend.")
            ColorPrint.blue("Press Ctrl+C to stop.")
            ColorPrint.blue("=" * 70)
            ColorPrint.blue("")

            # Keep running
            while server.is_running():
                time.sleep(1)

        except KeyboardInterrupt:
            ColorPrint.yellow("\n\nReceived interrupt signal")

        finally:
            server.stop()
            ColorPrint.blue("\nMCP Server stopped.")

    else:
        ColorPrint.red("ERROR: Failed to start MCP Server!")
        sys.exit(1)


def start():
    """Alternative entry point (for compatibility)"""
    main()


if __name__ == '__main__':
    main()

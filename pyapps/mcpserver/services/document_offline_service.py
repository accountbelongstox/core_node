#!/usr/bin/env python3
"""
Document Offline RPC Service

RPC service layer for document offline functionality
Handles RPC route registration and delegates to controller
"""

import time
from typing import Dict, Any, Optional
from pyapps.mcpserver.controllers.document_offline import DocumentOfflineController


class DocumentOfflineService:
    """
    Document Offline RPC Service

    Manages document offline crawling operations via RPC
    Architecture:
    - Service layer: RPC route handling (this class)
    - Controller layer: Business logic (DocumentOfflineController)
    """

    def __init__(self):
        """Initialize service"""
        self.controller: Optional[DocumentOfflineController] = None
        self.active_crawls: Dict[str, Dict[str, Any]] = {}
        self.crawl_counter = 0

    def register_routes(self, rpc_server):
        """
        Register RPC routes to server

        Args:
            rpc_server: WsRpcServer instance
        """

        @rpc_server.route('document_offline.start_crawl')
        async def start_crawl(params):
            """
            Start document offline crawl

            Params:
                target_url: URL to crawl
                depth: Max recursion depth (default: 3)
                fetcher_type: http|puppeteer|iframe (default: http)
                scope_type: full|path (default: full)
                disable_js: bool (default: False)
                screenshot: bool (default: False)
                debug: bool (default: False)
                output_dir: str (optional)

            Returns:
                {
                    success: bool,
                    crawl_id: str,
                    output_dir: str,
                    message: str
                }
            """
            return await self.start_crawl(params)

        @rpc_server.route('document_offline.get_status')
        async def get_status(params):
            """
            Get crawl status

            Params:
                crawl_id: str (optional, if not provided returns all)

            Returns:
                {
                    success: bool,
                    crawls: {...} or [...],
                    active_count: int
                }
            """
            return await self.get_status(params)

        @rpc_server.route('document_offline.stop_crawl')
        async def stop_crawl(params):
            """
            Stop active crawl

            Params:
                crawl_id: str

            Returns:
                {
                    success: bool,
                    message: str
                }
            """
            return await self.stop_crawl(params)

        @rpc_server.route('document_offline.list_crawls')
        async def list_crawls(params):
            """
            List all crawls (active and completed)

            Returns:
                {
                    success: bool,
                    crawls: [...]
                }
            """
            return await self.list_crawls(params)

    # ============================================
    # Service Methods
    # ============================================

    async def start_crawl(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start new crawl

        Args:
            params: Crawl parameters

        Returns:
            Result dictionary
        """
        try:
            # Validate required params
            if 'target_url' not in params:
                return {
                    'success': False,
                    'error': 'target_url is required'
                }

            # Generate crawl ID
            self.crawl_counter += 1
            crawl_id = f"crawl_{self.crawl_counter}_{int(time.time())}"

            # Create new controller instance for this crawl
            controller = DocumentOfflineController()

            # Store crawl info
            self.active_crawls[crawl_id] = {
                'crawl_id': crawl_id,
                'controller': controller,
                'params': params,
                'status': 'starting',
                'start_time': time.time(),
                'end_time': None,
                'result': None
            }

            # Start crawl (async)
            result = await controller.start(params)

            # Update crawl info
            self.active_crawls[crawl_id]['status'] = 'completed' if result.get('success') else 'failed'
            self.active_crawls[crawl_id]['end_time'] = time.time()
            self.active_crawls[crawl_id]['result'] = result

            return {
                'success': True,
                'crawl_id': crawl_id,
                'output_dir': result.get('output_dir'),
                'statistics': result.get('statistics'),
                'message': 'Crawl completed successfully' if result.get('success') else result.get('error', 'Crawl failed')
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    async def get_status(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get crawl status

        Args:
            params: Parameters with optional crawl_id

        Returns:
            Status dictionary
        """
        try:
            crawl_id = params.get('crawl_id')

            if crawl_id:
                # Get specific crawl
                if crawl_id not in self.active_crawls:
                    return {
                        'success': False,
                        'error': f'Crawl {crawl_id} not found'
                    }

                crawl_info = self.active_crawls[crawl_id]
                return {
                    'success': True,
                    'crawl': {
                        'crawl_id': crawl_info['crawl_id'],
                        'status': crawl_info['status'],
                        'start_time': crawl_info['start_time'],
                        'end_time': crawl_info['end_time'],
                        'target_url': crawl_info['params'].get('target_url'),
                        'statistics': crawl_info.get('result', {}).get('statistics')
                    }
                }
            else:
                # Get all crawls
                crawls = []
                for cid, info in self.active_crawls.items():
                    crawls.append({
                        'crawl_id': info['crawl_id'],
                        'status': info['status'],
                        'start_time': info['start_time'],
                        'end_time': info['end_time'],
                        'target_url': info['params'].get('target_url')
                    })

                return {
                    'success': True,
                    'crawls': crawls,
                    'active_count': sum(1 for c in crawls if c['status'] == 'running'),
                    'total_count': len(crawls)
                }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    async def stop_crawl(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stop active crawl

        Args:
            params: Parameters with crawl_id

        Returns:
            Result dictionary
        """
        try:
            crawl_id = params.get('crawl_id')

            if not crawl_id:
                return {
                    'success': False,
                    'error': 'crawl_id is required'
                }

            if crawl_id not in self.active_crawls:
                return {
                    'success': False,
                    'error': f'Crawl {crawl_id} not found'
                }

            crawl_info = self.active_crawls[crawl_id]

            if crawl_info['status'] != 'running':
                return {
                    'success': False,
                    'error': f'Crawl {crawl_id} is not running (status: {crawl_info["status"]})'
                }

            # Stop crawl
            controller = crawl_info['controller']
            await controller.cleanup_fetcher()

            # Update status
            self.active_crawls[crawl_id]['status'] = 'stopped'
            self.active_crawls[crawl_id]['end_time'] = time.time()

            return {
                'success': True,
                'message': f'Crawl {crawl_id} stopped successfully'
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    async def list_crawls(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        List all crawls

        Args:
            params: Parameters (unused)

        Returns:
            List of crawls
        """
        try:
            crawls = []
            for crawl_id, info in self.active_crawls.items():
                crawls.append({
                    'crawl_id': info['crawl_id'],
                    'status': info['status'],
                    'start_time': info['start_time'],
                    'end_time': info['end_time'],
                    'target_url': info['params'].get('target_url'),
                    'depth': info['params'].get('depth', 3),
                    'fetcher_type': info['params'].get('fetcher_type', 'http')
                })

            return {
                'success': True,
                'crawls': crawls,
                'total_count': len(crawls)
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

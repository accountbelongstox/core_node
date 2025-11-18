#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tampermonkey Server

WebSocket and HTTP server for communication with Tampermonkey userscripts
Enables advanced crawling scenarios where userscripts inject code and send page data
"""

import json
import asyncio
import time
from typing import Dict, Any, Optional, Callable, Set
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from pycore.pyutils.pybrowser.utils.logger import Logger

logger = Logger({'prefix': 'TampermonkeyServer'})

# Singleton instance
_shared_instance = None
_shared_start_promise = None


class TampermonkeyHandler(BaseHTTPRequestHandler):
    """HTTP request handler for Tampermonkey server"""

    def log_message(self, format, *args):
        """Override to use custom logger"""
        pass  # Disable default logging

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/status':
            self.handle_status()
        elif self.path == '/ping':
            self.handle_ping()
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())

    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/page':
            self.handle_page_upload()
        elif self.path == '/complete':
            self.handle_complete()
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())

    def send_cors_headers(self):
        """Send CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def handle_status(self):
        """Handle status check"""
        uptime = 0
        if self.server.statistics['startTime']:
            uptime = (time.time() - self.server.statistics['startTime'])

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()

        response = {
            'isRunning': self.server.is_running,
            'statistics': {
                **self.server.statistics,
                'uptime': uptime,
                'receivedPagesCount': len(self.server.received_pages)
            }
        }
        self.wfile.write(json.dumps(response).encode())

    def handle_ping(self):
        """Handle ping"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({'pong': True}).encode())

    def handle_page_upload(self):
        """Handle page data upload"""
        self.send_cors_headers()

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        page_data = json.loads(body)

        self.server.process_page_payload(page_data)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()

        response = {
            'success': True,
            'message': 'Page received',
            'totalPages': self.server.statistics['totalPages']
        }
        self.wfile.write(json.dumps(response).encode())

    def handle_complete(self):
        """Handle crawl completion"""
        self.send_cors_headers()

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        complete_data = json.loads(body)

        self.server.process_completion_payload(complete_data)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()

        response = {
            'success': True,
            'message': 'Completion acknowledged'
        }
        self.wfile.write(json.dumps(response).encode())


class TampermonkeyServer:
    """
    WebSocket and HTTP server for Tampermonkey userscript integration

    Singleton pattern for managing userscript communication
    """

    def __init__(self, options: Dict[str, Any] = None):
        options = options or {}
        self.port = options.get('port', 8765)
        self.host = options.get('host', '127.0.0.1')
        self.server = None
        self.server_thread = None
        self.is_running = False
        self.auto_start = options.get('autoStart', True)
        self.on_page_received = options.get('onPageReceived')
        self.on_complete = options.get('onComplete')
        self.on_error = options.get('onError')
        self.received_pages = []
        self.max_pages = 2000

        self.statistics = {
            'totalPages': 0,
            'totalBytes': 0,
            'startTime': None,
            'endTime': None,
            'sourceCount': {
                'page': 0,
                'iframe': 0
            }
        }

        self.callbacks = {
            'page': [],
            'complete': [],
            'error': []
        }

        if self.on_page_received:
            self.callbacks['page'].append(self.on_page_received)
        if self.on_complete:
            self.callbacks['complete'].append(self.on_complete)
        if self.on_error:
            self.callbacks['error'].append(self.on_error)

    @staticmethod
    def get_instance(options: Dict[str, Any] = None) -> 'TampermonkeyServer':
        """Get singleton instance"""
        global _shared_instance

        if not _shared_instance:
            _shared_instance = TampermonkeyServer(options or {})
            if _shared_instance.auto_start:
                _shared_instance.start()
        elif options and (options.get('port') or options.get('host')):
            logger.warn('[TAMPERMONKEY-SERVER] Singleton already initialized, ignoring configuration override')

        return _shared_instance

    @staticmethod
    def ensure_started(options: Dict[str, Any] = None) -> 'TampermonkeyServer':
        """Ensure server is started"""
        instance = TampermonkeyServer.get_instance(options)
        if not instance.is_running:
            instance.start()
        return instance

    def start(self) -> Dict[str, Any]:
        """
        Start server

        Returns:
            Server info (host, port, url)
        """
        if self.is_running:
            logger.warn('[TAMPERMONKEY-SERVER] Server is already running')
            return {
                'host': self.host,
                'port': self.port,
                'url': f'http://{self.host}:{self.port}'
            }

        self.server = HTTPServer((self.host, self.port), TampermonkeyHandler)
        self.server.statistics = self.statistics
        self.server.received_pages = self.received_pages
        self.server.is_running = True
        self.server.process_page_payload = self.process_page_payload
        self.server.process_completion_payload = self.process_completion_payload

        self.port = self.server.server_address[1]
        self.is_running = True
        self.statistics['startTime'] = time.time()

        self.server_thread = Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()

        logger.info(f'[TAMPERMONKEY-SERVER] Listening on http://{self.host}:{self.port}')

        return {
            'host': self.host,
            'port': self.port,
            'url': f'http://{self.host}:{self.port}'
        }

    def stop(self):
        """Stop server"""
        if not self.is_running:
            return

        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None

        if self.server_thread:
            self.server_thread.join(timeout=5)
            self.server_thread = None

        self.is_running = False
        self.statistics['endTime'] = time.time()
        logger.info('[TAMPERMONKEY-SERVER] Server stopped')

    def process_page_payload(self, page_data: Dict[str, Any]):
        """Process page data from userscript"""
        if not page_data or not page_data.get('content') or not page_data.get('url'):
            raise ValueError('Invalid page payload received')

        source_type = (page_data.get('sourceType') or 'page').lower()
        if source_type not in self.statistics['sourceCount']:
            self.statistics['sourceCount'][source_type] = 0

        self.statistics['sourceCount'][source_type] += 1
        self.statistics['totalPages'] += 1
        self.statistics['totalBytes'] += page_data.get('contentLength', len(page_data.get('content', '')))

        logger.info(f"[TAMPERMONKEY-SERVER] Received page: {page_data['url']}")
        logger.info(f"  Source: {source_type}, Depth: {page_data.get('depth')}, Content length: {page_data.get('contentLength')}")

        self.received_pages.append(page_data)
        if len(self.received_pages) > self.max_pages:
            self.received_pages.pop(0)

        self.emit('page', page_data)

    def process_completion_payload(self, payload: Dict[str, Any]):
        """Process crawl completion from userscript"""
        completion_source = (payload.get('sourceType') or 'page').lower()
        logger.info('[TAMPERMONKEY-SERVER] Crawl completed')
        logger.info(f"  Mode: {completion_source}")
        logger.info(f"  Total pages: {payload.get('totalPages')}")
        logger.info(f"  Failed URLs: {len(payload.get('failedUrls', []))}")

        self.statistics['endTime'] = time.time()
        self.emit('complete', payload)

    def emit(self, event_type: str, data: Any):
        """Emit event to registered callbacks"""
        if event_type in self.callbacks:
            for callback in self.callbacks[event_type]:
                callback(data)

    def on(self, event_type: str, callback: Callable):
        """Register event callback"""
        if event_type not in self.callbacks:
            self.callbacks[event_type] = []
        self.callbacks[event_type].append(callback)

    def get_statistics(self) -> Dict[str, Any]:
        """Get server statistics"""
        return {
            **self.statistics,
            'receivedPagesCount': len(self.received_pages)
        }

    def get_received_pages(self) -> list:
        """Get received pages"""
        return self.received_pages

    def clear_received_pages(self):
        """Clear received pages"""
        self.received_pages.clear()
        self.statistics['totalPages'] = 0
        self.statistics['totalBytes'] = 0

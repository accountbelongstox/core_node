#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resource Proxy Server

HTTP server for receiving resource uploads from browser pages
Provides alternative download method when direct download is not possible
"""

import os
import json
import hashlib
import tempfile
import asyncio
from typing import Dict, Any, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from pathlib import Path
from pycore.pyutils.pybrowser.utils.logger import Logger

logger = Logger({'prefix': 'ResourceProxyServer'})


class ResourceProxyHandler(BaseHTTPRequestHandler):
    """HTTP request handler for resource proxy server"""

    def log_message(self, format, *args):
        """Override to use custom logger"""
        pass  # Disable default logging

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Resource-Url, X-Resource-Name, X-Download-Id')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.handle_health()
        elif self.path.startswith('/status/'):
            download_id = self.path[8:]
            self.handle_status_check(download_id)
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())

    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/upload':
            self.handle_upload()
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())

    def handle_health(self):
        """Handle health check"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            'status': 'ok',
            'stats': self.server.stats,
            'isRunning': self.server.is_running
        }
        self.wfile.write(json.dumps(response).encode())

    def handle_upload(self):
        """Handle resource upload"""
        resource_url = self.headers.get('X-Resource-Url')
        resource_name = self.headers.get('X-Resource-Name')
        download_id = self.headers.get('X-Download-Id') or self.server.generate_download_id()

        if not resource_url:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing X-Resource-Url header'}).encode())
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))

            if content_length > self.server.max_body_size:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Resource too large'}).encode())
                return

            logger.debug(f'[PROXY] Receiving resource: {resource_url} ({download_id})')

            buffer = self.rfile.read(content_length)
            file_name = resource_name or self.server.generate_file_name(resource_url)
            file_path = os.path.join(self.server.temp_dir, file_name)

            with open(file_path, 'wb') as f:
                f.write(buffer)

            self.server.stats['successfulDownloads'] += 1
            self.server.stats['bytesReceived'] += len(buffer)

            download_info = {
                'downloadId': download_id,
                'resourceUrl': resource_url,
                'fileName': file_name,
                'filePath': file_path,
                'size': len(buffer),
                'timestamp': asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 0,
                'success': True
            }

            self.server.downloaded_resources[download_id] = download_info

            if download_id in self.server.pending_downloads:
                future = self.server.pending_downloads[download_id]
                if not future.done():
                    future.set_result(download_info)
                del self.server.pending_downloads[download_id]

            logger.info(f'[PROXY] Resource received: {file_name} ({len(buffer)} bytes)')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                'success': True,
                'downloadId': download_id,
                'fileName': file_name,
                'size': len(buffer)
            }
            self.wfile.write(json.dumps(response).encode())
        except Exception as error:
            self.server.stats['failedDownloads'] += 1
            logger.error(f'[PROXY] Failed to save resource: {error}')

            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(error)}).encode())

    def handle_status_check(self, download_id: str):
        """Handle download status check"""
        download_info = self.server.downloaded_resources.get(download_id)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        if download_info:
            response = {
                'status': 'completed',
                'downloadInfo': download_info
            }
        else:
            response = {
                'status': 'pending',
                'downloadId': download_id
            }

        self.wfile.write(json.dumps(response).encode())


class ResourceProxyServer:
    """
    HTTP server for receiving resource uploads from browser

    Provides alternative download method via fetch() + upload
    """

    def __init__(self, options: Dict[str, Any] = None):
        options = options or {}
        self.port = options.get('port', 0)
        self.host = options.get('host', 'localhost')
        self.server = None
        self.server_thread = None
        self.is_running = False
        self.downloaded_resources = {}
        self.pending_downloads = {}
        self.temp_dir = options.get('tempDir', os.path.join(tempfile.gettempdir(), 'spider_proxy'))
        self.max_body_size = options.get('maxBodySize', 100 * 1024 * 1024)
        self.download_timeout = options.get('downloadTimeout', 60000)

        self.stats = {
            'totalRequests': 0,
            'successfulDownloads': 0,
            'failedDownloads': 0,
            'bytesReceived': 0
        }

        self.ensure_temp_directory()

    def ensure_temp_directory(self):
        """Create temp directory if it doesn't exist"""
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir, exist_ok=True)
            logger.info(f'Created temp directory: {self.temp_dir}')

    def start(self) -> Dict[str, Any]:
        """
        Start proxy server

        Returns:
            Server info (host, port, url)
        """
        if self.is_running:
            logger.warn('Resource proxy server is already running')
            return {
                'host': self.host,
                'port': self.port,
                'url': f'http://{self.host}:{self.port}'
            }

        try:
            self.server = HTTPServer((self.host, self.port), ResourceProxyHandler)
            self.server.stats = self.stats
            self.server.downloaded_resources = self.downloaded_resources
            self.server.pending_downloads = self.pending_downloads
            self.server.temp_dir = self.temp_dir
            self.server.max_body_size = self.max_body_size
            self.server.is_running = True
            self.server.generate_download_id = lambda: hashlib.md5(os.urandom(16)).hexdigest()
            self.server.generate_file_name = self.generate_file_name

            self.port = self.server.server_address[1]
            self.is_running = True

            self.server_thread = Thread(target=self.server.serve_forever, daemon=True)
            self.server_thread.start()

            logger.info(f'Resource proxy server started at http://{self.host}:{self.port}')

            return {
                'host': self.host,
                'port': self.port,
                'url': f'http://{self.host}:{self.port}'
            }
        except Exception as error:
            logger.error(f'Failed to start proxy server: {error}')
            raise

    def stop(self):
        """Stop proxy server"""
        if not self.is_running:
            return

        try:
            if self.server:
                self.server.shutdown()
                self.server.server_close()
                self.server = None

            if self.server_thread:
                self.server_thread.join(timeout=5)
                self.server_thread = None

            self.is_running = False
            logger.info('Resource proxy server stopped')
        except Exception as error:
            logger.error(f'Error stopping proxy server: {error}')

    def generate_download_id(self) -> str:
        """Generate unique download ID"""
        return hashlib.md5(os.urandom(16)).hexdigest()

    def generate_file_name(self, url: str) -> str:
        """Generate file name from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            file_name = os.path.basename(parsed.path)

            if not file_name or file_name == '/':
                file_name = f'download_{int(asyncio.get_event_loop().time() * 1000)}'

            ext = os.path.splitext(file_name)[1]
            if not ext:
                file_name += '.bin'

            return file_name
        except Exception:
            return f'download_{int(asyncio.get_event_loop().time() * 1000)}.bin'

    async def wait_for_download(self, download_id: str, timeout: int = 60000) -> Dict[str, Any]:
        """
        Wait for download to complete

        Args:
            download_id: Download identifier
            timeout: Timeout in milliseconds

        Returns:
            Download information
        """
        if download_id in self.downloaded_resources:
            return self.downloaded_resources[download_id]

        loop = asyncio.get_event_loop()
        future = loop.create_future()
        self.pending_downloads[download_id] = future

        try:
            result = await asyncio.wait_for(future, timeout=timeout / 1000)
            return result
        except asyncio.TimeoutError:
            if download_id in self.pending_downloads:
                del self.pending_downloads[download_id]
            raise TimeoutError(f'Download timeout: {download_id}')

    def get_download_info(self, download_id: str) -> Optional[Dict[str, Any]]:
        """Get download information by ID"""
        return self.downloaded_resources.get(download_id)

    def get_all_downloads(self) -> list:
        """Get all download information"""
        return list(self.downloaded_resources.values())

    def get_stats(self) -> Dict[str, Any]:
        """Get server statistics"""
        return {
            **self.stats,
            'activeDownloads': len(self.pending_downloads),
            'completedDownloads': len(self.downloaded_resources)
        }

    def clear_downloads(self):
        """Clear all download records"""
        self.downloaded_resources.clear()
        logger.info('Cleared all download records')

    def cleanup_temp_files(self):
        """Cleanup temporary files"""
        try:
            files = os.listdir(self.temp_dir)
            cleaned_count = 0

            for file_name in files:
                file_path = os.path.join(self.temp_dir, file_name)
                try:
                    os.unlink(file_path)
                    cleaned_count += 1
                except Exception as error:
                    logger.warn(f'Failed to delete temp file: {file_path}', error)

            if cleaned_count > 0:
                logger.info(f'Cleaned up {cleaned_count} temp files')
        except Exception as error:
            logger.warn(f'Failed to cleanup temp files: {error}')

    def get_server_url(self) -> Optional[str]:
        """Get server URL"""
        if not self.is_running:
            return None
        return f'http://{self.host}:{self.port}'

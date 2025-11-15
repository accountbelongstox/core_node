#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller - Native HTTP Service

Generic HTTP API for calling pycore modules dynamically.
Uses only Python standard library (no external dependencies).
Trust programming mode: no exception handling, clean imports.
"""

import sys
import json
import importlib
import importlib.util
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Add pycore to path
PYCORE_ROOT = Path(__file__).parent
sys.path.insert(0, str(PYCORE_ROOT))


class PycoreHTTPHandler(BaseHTTPRequestHandler):
    """HTTP request handler for pycore module calls"""

    def _send_json_response(self, data, status_code=200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _read_json_body(self):
        """Read and parse JSON body"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode('utf-8'))

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/health':
            self._send_json_response({
                'success': True,
                'service': 'Pycore Module Caller',
                'status': 'healthy',
                'pycore_root': str(PYCORE_ROOT)
            })
        else:
            self._send_json_response({
                'success': False,
                'error': f'Unknown endpoint: {path}'
            }, 404)

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        data = self._read_json_body()

        if path == '/call':
            self._handle_module_call(data)
        else:
            self._send_json_response({
                'success': False,
                'error': f'Unknown endpoint: {path}'
            }, 404)

    def _load_module_from_file(self, module_file_path: Path, module_name: str):
        """Load Python module directly from file path"""
        spec = importlib.util.spec_from_file_location(module_name, module_file_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module

    def _handle_module_call(self, data):
        """Handle dynamic module call - generic for any pycore module"""
        module_path = data.get('module')
        function_name = data.get('function')
        args = data.get('args', [])
        kwargs = data.get('kwargs', {})
        use_file_import = data.get('use_file_import', False)

        if not module_path or not function_name:
            self._send_json_response({
                'success': False,
                'error': 'module and function are required'
            }, 400)
            return

        # Choose import method
        if use_file_import:
            # Direct file import (bypass package __init__)
            # module_path should be like: pycore/pyutils/ocr/ocr_manager.py
            module_file = PYCORE_ROOT / module_path
            module_name = module_file.stem
            module = self._load_module_from_file(module_file, module_name)
        else:
            # Standard import (e.g., 'pycore.pyutils.ocr.ocr_manager')
            module = importlib.import_module(module_path)

        # Navigate to function/attribute
        func_parts = function_name.split('.')
        obj = module
        for part in func_parts:
            obj = getattr(obj, part)

        # Call function
        result = obj(*args, **kwargs)

        self._send_json_response({
            'success': True,
            'result': result
        })

    def log_message(self, format, *args):
        """Override to customize logging"""
        print(f"[{self.log_date_time_string()}] {format % args}")


def run_server(host='127.0.0.1', port=59000):
    """Run HTTP server"""
    server_address = (host, port)
    httpd = HTTPServer(server_address, PycoreHTTPHandler)
    print(f"Pycore Module Caller HTTP Server started on {host}:{port}")
    print(f"Health check: http://{host}:{port}/health")
    print(f"Generic call endpoint: POST http://{host}:{port}/call")
    httpd.serve_forever()


if __name__ == '__main__':
    run_server()

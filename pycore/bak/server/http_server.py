# -*- coding: utf-8 -*-
"""
Unified HTTP Server - Web API and Dashboard

Provides:
- REST API for calling pycore modules
- Web dashboard for monitoring and testing
- Health check endpoint
"""

import json
import urllib.parse
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Optional

from ..global_config import get_global_config
from ..core.module_loader import ModuleLoader


class UnifiedHTTPHandler(BaseHTTPRequestHandler):
    """
    Unified HTTP request handler for Pycore Module Caller.

    Handles both API requests and web dashboard.
    """

    def log_message(self, format, *args):
        """Override to customize logging"""
        config = get_global_config()
        if config.debug_mode:
            print(f"[{self.log_date_time_string()}] {format % args}")

    def _send_json_response(self, data: dict, status_code: int = 200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))

    def _send_html_response(self, html: str, status_code: int = 200):
        """Send HTML response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def _read_json_body(self) -> dict:
        """Read and parse JSON body"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode('utf-8'))

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        # Check if API is enabled
        if not config.api_enabled and not path in ['/', '/health']:
            self._send_json_response({
                'success': False,
                'error': 'API is currently disabled'
            }, 403)
            return

        # Route requests
        if path == '/':
            self._handle_dashboard()
        elif path == '/health':
            self._handle_health()
        elif path == '/api/status':
            self._handle_status()
        elif path == '/api/history':
            self._handle_history()
        else:
            self._send_json_response({
                'success': False,
                'error': f'Unknown endpoint: {path}'
            }, 404)

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        # Check if API is enabled
        if not config.api_enabled:
            self._send_json_response({
                'success': False,
                'error': 'API is currently disabled'
            }, 403)
            return

        # Route requests
        if path == '/api/call':
            self._handle_module_call()
        else:
            self._send_json_response({
                'success': False,
                'error': f'Unknown endpoint: {path}'
            }, 404)

    # ========== Handlers ==========

    def _handle_dashboard(self):
        """Handle / - Web dashboard"""
        config = get_global_config()

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pycore Module Caller</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        .header {{
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .header h1 {{
            color: #667eea;
            margin-bottom: 10px;
        }}
        .status {{
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 15px;
        }}
        .status-item {{
            background: #f7fafc;
            padding: 10px 15px;
            border-radius: 6px;
            border-left: 3px solid #667eea;
        }}
        .status-item strong {{
            color: #667eea;
        }}
        .card {{
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .card h2 {{
            color: #2d3748;
            margin-bottom: 15px;
            border-bottom: 2px solid #edf2f7;
            padding-bottom: 10px;
        }}
        .form-group {{
            margin-bottom: 15px;
        }}
        .form-group label {{
            display: block;
            margin-bottom: 5px;
            color: #4a5568;
            font-weight: 500;
        }}
        .form-group input, .form-group textarea {{
            width: 100%;
            padding: 10px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
        }}
        .form-group textarea {{
            min-height: 80px;
            resize: vertical;
        }}
        button {{
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.2s;
        }}
        button:hover {{
            background: #5a67d8;
        }}
        .response {{
            margin-top: 15px;
            padding: 15px;
            background: #f7fafc;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 400px;
            overflow-y: auto;
        }}
        .example {{
            background: #fffbeb;
            border-left: 3px solid #f59e0b;
            padding: 12px;
            margin: 10px 0;
            border-radius: 4px;
            font-size: 13px;
        }}
        .example code {{
            background: #fef3c7;
            padding: 2px 6px;
            border-radius: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Pycore Module Caller</h1>
            <p>Dynamic HTTP API for calling pycore modules</p>
            <div class="status">
                <div class="status-item">
                    <strong>Status:</strong> {'🟢 RUNNING' if config.server_running else '🔴 STOPPED'}
                </div>
                <div class="status-item">
                    <strong>Port:</strong> {config.http_port}
                </div>
                <div class="status-item">
                    <strong>API:</strong> {'✅ ENABLED' if config.api_enabled else '❌ DISABLED'}
                </div>
                <div class="status-item">
                    <strong>Debug:</strong> {'ON' if config.debug_mode else 'OFF'}
                </div>
                <div class="status-item">
                    <strong>Calls:</strong> {len(config.call_history)}
                </div>
            </div>
        </div>

        <div class="card">
            <h2>API Tester</h2>
            <div class="example">
                <strong>Example:</strong> Call <code>ocr_manager.get_available_models()</code>
                <div style="margin-top: 5px;">
                    Module: <code>pycore.pyutils.ocr.ocr_manager</code><br>
                    Function: <code>ocr_manager.get_available_models</code>
                </div>
            </div>

            <form id="testForm">
                <div class="form-group">
                    <label>Module Path:</label>
                    <input type="text" id="module" value="pycore.pyutils.ocr.ocr_manager" placeholder="pycore.module.path">
                </div>
                <div class="form-group">
                    <label>Function Path:</label>
                    <input type="text" id="function" value="ocr_manager.get_available_models" placeholder="function.name">
                </div>
                <div class="form-group">
                    <label>Args (JSON array):</label>
                    <input type="text" id="args" value="[]" placeholder='["arg1", "arg2"]'>
                </div>
                <div class="form-group">
                    <label>Kwargs (JSON object):</label>
                    <input type="text" id="kwargs" value="{{}}" placeholder='{{"key": "value"}}'>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="useFileImport"> Use file import (bypass __init__)
                    </label>
                </div>
                <button type="submit">🚀 Call Module</button>
            </form>

            <div class="response" id="response" style="display: none;"></div>
        </div>

        <div class="card">
            <h2>📚 API Documentation</h2>
            <p><strong>Base URL:</strong> http://{config.host}:{config.http_port}</p>
            <br>
            <p><strong>Endpoints:</strong></p>
            <ul style="list-style: none; padding-left: 0;">
                <li style="margin: 10px 0;">
                    <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px;">GET /health</code> - Health check
                </li>
                <li style="margin: 10px 0;">
                    <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px;">GET /api/status</code> - Service status
                </li>
                <li style="margin: 10px 0;">
                    <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px;">GET /api/history</code> - Call history
                </li>
                <li style="margin: 10px 0;">
                    <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px;">POST /api/call</code> - Call module function
                </li>
            </ul>
        </div>
    </div>

    <script>
        document.getElementById('testForm').addEventListener('submit', async (e) => {{
            e.preventDefault();

            const module = document.getElementById('module').value;
            const func = document.getElementById('function').value;
            const args = JSON.parse(document.getElementById('args').value || '[]');
            const kwargs = JSON.parse(document.getElementById('kwargs').value || '{{}}');
            const useFileImport = document.getElementById('useFileImport').checked;

            const responseEl = document.getElementById('response');
            responseEl.style.display = 'block';
            responseEl.textContent = 'Calling...';

            try {{
                const response = await fetch('/api/call', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{
                        module: module,
                        function: func,
                        args: args,
                        kwargs: kwargs,
                        use_file_import: useFileImport
                    }})
                }});

                const data = await response.json();
                responseEl.textContent = JSON.stringify(data, null, 2);
            }} catch (err) {{
                responseEl.textContent = 'Error: ' + err.message;
            }}
        }});
    </script>
</body>
</html>
"""
        self._send_html_response(html)

    def _handle_health(self):
        """Handle /health - Health check"""
        config = get_global_config()
        self._send_json_response({
            'success': True,
            'service': 'Pycore Module Caller',
            'status': 'healthy',
            'pycore_root': str(config.pycore_root),
            'api_enabled': config.api_enabled
        })

    def _handle_status(self):
        """Handle /api/status - Get service status"""
        config = get_global_config()
        self._send_json_response({
            'success': True,
            'status': config.get_status()
        })

    def _handle_history(self):
        """Handle /api/history - Get call history"""
        config = get_global_config()
        self._send_json_response({
            'success': True,
            'history': config.call_history
        })

    def _handle_module_call(self):
        """Handle /api/call - Call module function"""
        config = get_global_config()
        loader = ModuleLoader()

        try:
            data = self._read_json_body()

            module_path = data.get('module')
            function_path = data.get('function')
            args = data.get('args', [])
            kwargs = data.get('kwargs', {})
            use_file_import = data.get('use_file_import', False)

            if not module_path or not function_path:
                self._send_json_response({
                    'success': False,
                    'error': 'module and function are required'
                }, 400)
                return

            # Call the module function
            result = loader.call_module_function(
                module_path=module_path,
                function_path=function_path,
                args=args,
                kwargs=kwargs,
                use_file_import=use_file_import
            )

            # Log success
            config.add_call_history(module_path, function_path, True)

            self._send_json_response({
                'success': True,
                'result': result
            })

        except Exception as e:
            # Log failure
            module = data.get('module', 'unknown') if 'data' in locals() else 'unknown'
            function = data.get('function', 'unknown') if 'data' in locals() else 'unknown'
            config.add_call_history(module, function, False, str(e))

            error_detail = traceback.format_exc() if config.debug_mode else str(e)

            self._send_json_response({
                'success': False,
                'error': str(e),
                'traceback': error_detail if config.debug_mode else None
            }, 500)


class UnifiedHTTPServer:
    """Unified HTTP server wrapper"""

    def __init__(self, host: str = '127.0.0.1', port: int = 59000):
        self.host = host
        self.port = port
        self.httpd = None

    def start(self):
        """Start the HTTP server"""
        config = get_global_config()
        config.server_running = True

        server_address = (self.host, self.port)
        self.httpd = HTTPServer(server_address, UnifiedHTTPHandler)

        print(f"=" * 60)
        print(f"Pycore Module Caller HTTP Server Started")
        print(f"=" * 60)
        print(f"Dashboard:    http://{self.host}:{self.port}/")
        print(f"Health check: http://{self.host}:{self.port}/health")
        print(f"API endpoint: POST http://{self.host}:{self.port}/api/call")
        print(f"=" * 60)

        try:
            self.httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            config.server_running = False
        finally:
            if self.httpd:
                self.httpd.shutdown()


def start_server(host: str = '127.0.0.1', port: int = 59000):
    """
    Start the unified HTTP server.

    Args:
        host: Host to bind to
        port: Port to bind to
    """
    server = UnifiedHTTPServer(host, port)
    server.start()

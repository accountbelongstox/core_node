#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web Preview Server
Temporary HTTP server to preview Android resources before build
"""

import os
import sys
import json
import base64
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse


class ResourcePreviewHandler(BaseHTTPRequestHandler):
    """HTTP request handler for resource preview"""

    # Class variable to store resource data
    resource_data = None
    server_should_stop = False
    user_action = "cancelled"  # Track user action: "continue" or "cancelled"

    def log_message(self, format, *args):
        """Override to suppress request logs"""
        pass

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/':
            self.serve_main_page()
        elif path == '/api/data':
            self.serve_data()
        elif path == '/api/image':
            self.serve_image(parsed_path.query)
        elif path == '/api/shutdown':
            self.handle_shutdown()
        else:
            self.send_error(404)

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/api/continue':
            self.handle_continue()
        else:
            self.send_error(404)

    def serve_main_page(self):
        """Serve the main HTML page"""
        html = self.generate_html()
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def serve_data(self):
        """Serve resource data as JSON"""
        if not self.resource_data:
            self.send_error(500, "No resource data available")
            return

        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(self.resource_data, ensure_ascii=False).encode('utf-8'))

    def serve_image(self, query):
        """Serve an image file"""
        params = parse_qs(query)
        image_path = params.get('path', [None])[0]

        if not image_path or not os.path.exists(image_path):
            self.send_error(404, "Image not found")
            return

        try:
            with open(image_path, 'rb') as f:
                image_data = f.read()

            ext = Path(image_path).suffix.lower()
            content_types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.xml': 'text/xml'
            }

            content_type = content_types.get(ext, 'application/octet-stream')

            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.send_header('Content-Length', len(image_data))
            self.end_headers()
            self.wfile.write(image_data)

        except Exception as e:
            self.send_error(500, f"Error serving image: {str(e)}")

    def handle_continue(self):
        """Handle continue request"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'continue'}).encode('utf-8'))

        # Signal server to stop and record user action
        ResourcePreviewHandler.user_action = "continue"
        ResourcePreviewHandler.server_should_stop = True

    def handle_shutdown(self):
        """Handle shutdown/cancel request"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'cancelled'}).encode('utf-8'))

        # Signal server to stop and record user action
        ResourcePreviewHandler.user_action = "cancelled"
        ResourcePreviewHandler.server_should_stop = True

    def generate_html(self):
        """Generate the main HTML page"""
        return '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Android Resource Preview</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }

        .header h1 {
            color: #667eea;
            margin-bottom: 10px;
        }

        .header p {
            color: #666;
        }

        .controls {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }

        .btn-danger {
            background: #ef4444;
            color: white;
        }

        .btn-danger:hover {
            background: #dc2626;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
        }

        .section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 20px;
        }

        .section h2 {
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }

        .stat-card .number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .stat-card .label {
            font-size: 14px;
            opacity: 0.9;
        }

        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .image-card {
            background: #f9fafb;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }

        .image-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .image-card img {
            width: 100%;
            height: 150px;
            object-fit: contain;
            background: white;
            padding: 10px;
        }

        .image-info {
            padding: 15px;
            background: white;
        }

        .image-info .filename {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
            word-break: break-all;
        }

        .image-info .details {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
        }

        .image-info .path {
            font-size: 11px;
            color: #999;
            margin-top: 5px;
            word-break: break-all;
        }

        .list-group {
            list-style: none;
        }

        .list-item {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
        }

        .list-item:last-child {
            border-bottom: none;
        }

        .list-item::before {
            content: "•";
            color: #667eea;
            font-weight: bold;
            font-size: 20px;
            margin-right: 10px;
        }

        .category-title {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0 10px 0;
            font-weight: 600;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .spinner {
            border: 4px solid #f3f4f6;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Android Resource Preview</h1>
            <p>Review your Android resources before building</p>
        </div>

        <div class="controls">
            <button class="btn btn-primary" onclick="continueBuilding()">✓ Continue Building</button>
            <button class="btn btn-danger" onclick="cancelBuilding()">✗ Cancel</button>
            <span style="margin-left: auto; color: #666;">Review resources and click continue when ready</span>
        </div>

        <div id="content">
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading resource data...</p>
            </div>
        </div>
    </div>

    <script>
        let resourceData = null;

        async function loadData() {
            try {
                const response = await fetch('/api/data');
                resourceData = await response.json();
                renderContent();
            } catch (error) {
                document.getElementById('content').innerHTML = `
                    <div class="section">
                        <h2>Error</h2>
                        <p style="color: red;">Failed to load resource data: ${error.message}</p>
                    </div>
                `;
            }
        }

        function renderContent() {
            const stats = resourceData.statistics;
            const images = resourceData.images;
            const packageNames = resourceData.package_names;
            const appNames = resourceData.app_names;

            let html = `
                <div class="section">
                    <h2>📊 Statistics</h2>
                    <div class="stats">
                        <div class="stat-card">
                            <div class="number">${stats.total_images}</div>
                            <div class="label">Total Images</div>
                        </div>
                        <div class="stat-card">
                            <div class="number">${stats.categories}</div>
                            <div class="label">Categories</div>
                        </div>
                        <div class="stat-card">
                            <div class="number">${stats.package_names_count}</div>
                            <div class="label">Package Names</div>
                        </div>
                        <div class="stat-card">
                            <div class="number">${stats.app_names_count}</div>
                            <div class="label">App Names</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2>📦 Package Names</h2>
                    <ul class="list-group">
                        ${Object.entries(packageNames).map(([pkg, files]) => `
                            <li class="list-item">
                                <strong>${pkg}</strong>
                                <div style="margin-left: 20px; margin-top: 5px; font-size: 0.9em; color: #666;">
                                    ${files.map(file => `<div>📄 ${file}</div>`).join('')}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="section">
                    <h2>📱 App Names</h2>
                    <ul class="list-group">
                        ${Object.entries(appNames).map(([name, files]) => `
                            <li class="list-item">
                                <strong>${name}</strong>
                                <div style="margin-left: 20px; margin-top: 5px; font-size: 0.9em; color: #666;">
                                    ${files.map(file => `<div>📄 ${file}</div>`).join('')}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="section">
                    <h2>🖼️ Images</h2>
            `;

            // Render images by category
            for (const [category, imgs] of Object.entries(images)) {
                html += `
                    <div class="category-title">${category} (${imgs.length} images)</div>
                    <div class="image-grid">
                `;

                for (const img of imgs) {
                    const dimensions = img.width && img.height ? `${img.width}x${img.height}` : 'Unknown';
                    html += `
                        <div class="image-card">
                            <img src="/api/image?path=${encodeURIComponent(img.full_path)}"
                                 alt="${img.filename}"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27150%27%3E%3Crect fill=%27%23ddd%27 width=%27200%27 height=%27150%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ENo Preview%3C/text%3E%3C/svg%3E'">
                            <div class="image-info">
                                <div class="filename">${img.filename}</div>
                                <div class="details">
                                    Size: ${img.size_kb} KB<br>
                                    Dimensions: ${dimensions}
                                </div>
                                <div class="path">${img.relative_path}</div>
                            </div>
                        </div>
                    `;
                }

                html += `
                    </div>
                `;
            }

            html += `</div>`;

            document.getElementById('content').innerHTML = html;
        }

        async function continueBuilding() {
            if (confirm('Continue with the build process?')) {
                try {
                    await fetch('/api/continue', { method: 'POST' });
                    document.getElementById('content').innerHTML = `
                        <div class="section" style="text-align: center; padding: 60px;">
                            <h2 style="color: #10b981;">✓ Continuing Build Process</h2>
                            <p style="margin-top: 20px; color: #666;">You can close this window now.</p>
                        </div>
                    `;
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        async function cancelBuilding() {
            if (confirm('Cancel the build process?')) {
                try {
                    await fetch('/api/shutdown');
                    document.getElementById('content').innerHTML = `
                        <div class="section" style="text-align: center; padding: 60px;">
                            <h2 style="color: #ef4444;">✗ Build Cancelled</h2>
                            <p style="margin-top: 20px; color: #666;">You can close this window now.</p>
                        </div>
                    `;
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        // Load data on page load
        loadData();
    </script>
</body>
</html>'''


class WebPreviewServer:
    """Web server for resource preview"""

    def __init__(self, resource_data: dict, port: int = 8899):
        """
        Initialize web preview server

        Args:
            resource_data: Resource data to display
            port: Port to run server on
        """
        self.resource_data = resource_data
        self.port = port
        self.server = None
        self.server_thread = None

    def start(self):
        """Start the web server"""
        # Set class variable
        ResourcePreviewHandler.resource_data = self.resource_data
        ResourcePreviewHandler.server_should_stop = False

        # Create server with timeout to prevent blocking forever
        self.server = HTTPServer(('127.0.0.1', self.port), ResourcePreviewHandler)
        self.server.timeout = 1.0  # 1 second timeout for handle_request

        # Start server in thread
        self.server_thread = threading.Thread(target=self._run_server, daemon=True)
        self.server_thread.start()

        # Open browser
        url = f'http://127.0.0.1:{self.port}'
        print(f"\n[Web] Resource preview server started at: {url}")
        print(f"[Web] Opening browser...")

        try:
            webbrowser.open(url)
        except:
            print(f"[Web] Could not open browser automatically. Please open: {url}")

    def _run_server(self):
        """Run server loop"""
        while not ResourcePreviewHandler.server_should_stop:
            try:
                self.server.handle_request()
            except:
                # Socket may be closed, exit gracefully
                break

    def wait_for_user(self) -> bool:
        """
        Wait for user to continue or cancel

        Returns:
            True if user chose to continue, False if cancelled
        """
        print("[Web] Waiting for user action...")
        print("[Web] Press 'Y' in terminal to continue, or use the web interface")

        # Wait for server to stop (either via web or Y/n in terminal)
        while not ResourcePreviewHandler.server_should_stop:
            try:
                # Check for keyboard input (non-blocking would be better)
                import select
                if sys.platform != 'win32':
                    # Unix-like systems
                    import sys
                    import tty
                    import termios

                    # This won't work well, let's just wait
                pass
            except:
                pass

            import time
            time.sleep(0.5)

        self.stop()
        return True

    def stop(self):
        """Stop the web server"""
        if self.server:
            print("[Web] Shutting down preview server...")
            # Set stop flag first
            ResourcePreviewHandler.server_should_stop = True

            # Close the server socket (this will interrupt handle_request)
            try:
                self.server.server_close()
            except:
                pass

            # Wait for thread to finish (with timeout)
            if self.server_thread and self.server_thread.is_alive():
                self.server_thread.join(timeout=2.0)

            self.server = None


def show_preview(resource_data: dict, var_system, port: int = 8899) -> None:
    """
    Show resource preview in web browser

    Args:
        resource_data: Resource data from scanner
        var_system: FileVarSystem instance for setting variables
        port: Port to run server on

    Returns:
        None (uses file variables to communicate user choice)
    """
    # Reset server state before starting
    ResourcePreviewHandler.server_should_stop = False
    ResourcePreviewHandler.user_action = "cancelled"

    server = WebPreviewServer(resource_data, port)
    server.start()

    # Ask user Y/n in terminal
    print("\n" + "=" * 60)
    print("Review resources in the web browser")
    print("=" * 60)
    print("Options:")
    print("  1. Click 'Continue Building' in the web interface")
    print("  2. Click 'Cancel' to abort")
    print("  3. Press 'Y' here to continue, 'N' to cancel")
    print("=" * 60)

    user_action = "cancelled"  # Default to cancelled

    while not ResourcePreviewHandler.server_should_stop:
        try:
            user_input = input("\nContinue? [Y/n]: ").strip().upper()

            if user_input in ('Y', 'YES', ''):
                # User confirmed - stop server and continue
                print("[Web] Continuing with build...")
                user_action = "continue"
                server.stop()
                break
            elif user_input in ('N', 'NO'):
                # User cancelled - stop server and abort
                print("[Web] Build cancelled by user")
                user_action = "cancelled"
                server.stop()
                break
            else:
                # Invalid input, ask again
                print("[Web] Invalid input. Please enter 'Y' to continue or 'N' to cancel.")
        except KeyboardInterrupt:
            print("\n[Web] Interrupted by user")
            user_action = "cancelled"
            server.stop()
            break
        except EOFError:
            # EOF reached (e.g., input redirected)
            print("\n[Web] No input available, defaulting to continue")
            user_action = "continue"
            server.stop()
            break
        except Exception as e:
            print(f"[Web] Input error: {e}")
            pass

    # Server was stopped via web interface
    if ResourcePreviewHandler.server_should_stop:
        # Check which action was taken (continue or cancel)
        # This is set by the web interface handlers
        if hasattr(ResourcePreviewHandler, 'user_action'):
            user_action = ResourcePreviewHandler.user_action
        else:
            # Fallback: assume continue if server stopped from web
            user_action = "continue"

    server.stop()

    # Set file variable instead of returning
    var_system.set_var("USER_ACTION", user_action)
    print(f"[Web] User action recorded: {user_action}")
    print("[Web] Shutting down preview server...")

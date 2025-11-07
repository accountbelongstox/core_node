#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Synchronization Tool - Server and Client
Provides web interface and API for file browsing and batch downloading
Supports concurrent downloads, resume capability, and progress tracking

AI SPECIAL ATTENTION RULES:
- This file uses ONLY Python standard library for server functionality
- Virtual environment is auto-initialized on first run
- Client uses requests and tqdm (installed in venv)
- DO NOT add Flask or any non-standard server dependencies
"""

import os
import sys
import json
import hashlib
import threading
import time
import subprocess
import urllib.parse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import HTTPServer, BaseHTTPRequestHandler
from io import BytesIO

# =============================================================================
# Virtual Environment Auto-Initialization
# =============================================================================

def is_venv():
    """Check if running in virtual environment"""
    return hasattr(sys, 'real_prefix') or (
        hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix
    )

def get_script_dir():
    """Get the directory of this script"""
    return os.path.dirname(os.path.abspath(__file__))

def init_venv_if_needed():
    """Initialize virtual environment if not present and relaunch in venv"""
    script_dir = get_script_dir()
    venv_dir = os.path.join(script_dir, '.venv')

    # If already in venv, check for client dependencies
    if is_venv():
        # Only check client dependencies if running client mode
        if len(sys.argv) > 1 and sys.argv[1] == 'client':
            try:
                import requests
                import tqdm
            except ImportError:
                print("Installing client dependencies...")
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', 'requests', 'tqdm'])
        return

    # Not in venv, check if venv exists
    if not os.path.exists(venv_dir):
        print("=" * 70)
        print("First-time setup: Creating virtual environment...")
        print("=" * 70)

        # Create virtual environment
        print("\n[1/2] Creating virtual environment...")
        try:
            subprocess.check_call([sys.executable, '-m', 'venv', venv_dir])
            print("✓ Virtual environment created")
        except subprocess.CalledProcessError as e:
            print(f"\n✗ Failed to create virtual environment: {e}")
            print("\nOn Ubuntu/Debian, you may need to install:")
            print("  sudo apt-get install python3-venv python3-full")
            sys.exit(1)

        # Install client dependencies
        print("\n[2/2] Installing client dependencies (requests, tqdm)...")
        venv_python = os.path.join(venv_dir, 'Scripts' if sys.platform == 'win32' else 'bin', 'python')
        try:
            subprocess.check_call([venv_python, '-m', 'pip', 'install', '-q', 'requests', 'tqdm'])
            print("✓ Dependencies installed")
        except subprocess.CalledProcessError as e:
            print(f"\n✗ Failed to install dependencies: {e}")
            sys.exit(1)

        print("\n" + "=" * 70)
        print("Setup completed! Restarting in virtual environment...")
        print("=" * 70 + "\n")

    # Relaunch in venv
    venv_python = os.path.join(venv_dir, 'Scripts' if sys.platform == 'win32' else 'bin', 'python')
    if not os.path.exists(venv_python):
        venv_python = venv_python + '.exe' if sys.platform == 'win32' else venv_python

    if os.path.exists(venv_python):
        os.execv(venv_python, [venv_python] + sys.argv)
    else:
        print(f"Error: Virtual environment Python not found at {venv_python}")
        sys.exit(1)

# Initialize venv before importing any non-standard libraries
init_venv_if_needed()

# Now safe to import client dependencies (only needed for client mode)
if len(sys.argv) > 1 and sys.argv[1] == 'client':
    try:
        import requests
        from tqdm import tqdm
    except ImportError:
        print("Error: Client dependencies not found. Please run:")
        print(f"  {sys.executable} -m pip install requests tqdm")
        sys.exit(1)


# =============================================================================
# Configuration
# =============================================================================

class Config:
    """Configuration settings"""
    SERVER_ROOT = "/www/wwwroot"
    CLIENT_ROOT = r"D:\www\wwwroot"
    EXCLUDE_DIRS = ["core_node"]
    DEFAULT_PORT = 8888
    CHUNK_SIZE = 8192  # 8KB chunks for file transfer
    MAX_CONCURRENT_DOWNLOADS = 20
    RETRY_ATTEMPTS = 3
    RETRY_DELAY = 2  # seconds


# =============================================================================
# Utility Functions
# =============================================================================

def calculate_file_hash(file_path: str, algorithm: str = "md5") -> Optional[str]:
    """Calculate file hash for integrity verification"""
    try:
        hash_obj = hashlib.new(algorithm)
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(Config.CHUNK_SIZE), b""):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()
    except Exception as e:
        print(f"Error calculating hash for {file_path}: {e}")
        return None


def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable size"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def should_exclude_path(path: str, exclude_dirs: List[str]) -> bool:
    """Check if path should be excluded"""
    path_parts = Path(path).parts
    return any(excluded in path_parts for excluded in exclude_dirs)


# =============================================================================
# Native HTTP Server Implementation
# =============================================================================

class FileServerHandler(BaseHTTPRequestHandler):
    """HTTP request handler for file server"""

    def log_message(self, format, *args):
        """Override to customize logging"""
        # Suppress default logging, we'll handle it ourselves
        pass

    def send_json_response(self, data: dict, status: int = 200):
        """Send JSON response"""
        json_data = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(json_data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json_data)

    def send_html_response(self, html: str, status: int = 200):
        """Send HTML response"""
        html_data = html.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(html_data)))
        self.end_headers()
        self.wfile.write(html_data)

    def send_file_response(self, file_path: str):
        """Send file with range support"""
        try:
            file_size = os.path.getsize(file_path)
            start_byte = 0
            end_byte = file_size - 1

            # Check for Range header
            range_header = self.headers.get('Range')
            if range_header:
                range_match = range_header.replace('bytes=', '').split('-')
                start_byte = int(range_match[0]) if range_match[0] else 0
                end_byte = int(range_match[1]) if len(range_match) > 1 and range_match[1] else end_byte

                self.send_response(206)  # Partial Content
                self.send_header('Content-Range', f'bytes {start_byte}-{end_byte}/{file_size}')
            else:
                self.send_response(200)

            content_length = end_byte - start_byte + 1
            filename = os.path.basename(file_path)

            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(content_length))
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()

            # Send file content
            with open(file_path, 'rb') as f:
                f.seek(start_byte)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(Config.CHUNK_SIZE, remaining)
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)

        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        # Route requests
        if path == '/':
            self.handle_index()
        elif path == '/api/list':
            self.handle_api_list(query)
        elif path == '/api/tree':
            self.handle_api_tree()
        elif path == '/api/download':
            self.handle_api_download(query)
        else:
            self.send_json_response({"error": "Not found"}, 404)

    def handle_index(self):
        """Serve web interface"""
        self.send_html_response(WEB_TEMPLATE)

    def handle_api_list(self, query: dict):
        """API endpoint to list files"""
        path = query.get('path', [''])[0]
        root_dir = self.server.root_dir
        full_path = os.path.join(root_dir, path.lstrip('/'))

        if not os.path.exists(full_path):
            self.send_json_response({"error": "Path not found"}, 404)
            return

        if not os.path.isdir(full_path):
            self.send_json_response({"error": "Not a directory"}, 400)
            return

        try:
            items = []
            for item_name in sorted(os.listdir(full_path)):
                item_path = os.path.join(full_path, item_name)
                relative_path = os.path.relpath(item_path, root_dir)

                # Skip excluded directories
                if should_exclude_path(relative_path, Config.EXCLUDE_DIRS):
                    continue

                item_info = {
                    "name": item_name,
                    "path": relative_path.replace(os.sep, '/'),
                    "is_dir": os.path.isdir(item_path)
                }

                if not item_info["is_dir"]:
                    try:
                        stat = os.stat(item_path)
                        item_info["size"] = stat.st_size
                        item_info["modified"] = stat.st_mtime
                    except:
                        item_info["size"] = 0
                        item_info["modified"] = 0

                items.append(item_info)

            self.send_json_response({
                "path": path,
                "items": items
            })
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

    def handle_api_tree(self):
        """API endpoint to get complete file tree"""
        root_dir = self.server.root_dir
        files = []

        for root, dirs, filenames in os.walk(root_dir):
            # Filter excluded directories
            dirs[:] = [d for d in dirs if not should_exclude_path(
                os.path.relpath(os.path.join(root, d), root_dir),
                Config.EXCLUDE_DIRS
            )]

            for filename in filenames:
                file_path = os.path.join(root, filename)
                relative_path = os.path.relpath(file_path, root_dir)

                try:
                    stat = os.stat(file_path)
                    files.append({
                        "path": relative_path.replace(os.sep, '/'),
                        "size": stat.st_size,
                        "modified": stat.st_mtime
                    })
                except:
                    continue

        self.send_json_response({
            "total_files": len(files),
            "files": files
        })

    def handle_api_download(self, query: dict):
        """API endpoint to download a file"""
        path = query.get('path', [''])[0]
        root_dir = self.server.root_dir
        full_path = os.path.join(root_dir, path.lstrip('/'))

        if not os.path.exists(full_path):
            self.send_json_response({"error": "File not found"}, 404)
            return

        if os.path.isdir(full_path):
            self.send_json_response({"error": "Cannot download directory"}, 400)
            return

        self.send_file_response(full_path)


class FileServer:
    """File server with web interface and API"""

    def __init__(self, root_dir: str, port: int = Config.DEFAULT_PORT):
        self.root_dir = os.path.abspath(root_dir)
        self.port = port
        self.httpd = None

    def run(self):
        """Start the server"""
        print(f"Starting file server...")
        print(f"Root directory: {self.root_dir}")
        print(f"Server URL: http://0.0.0.0:{self.port}")
        print(f"API Endpoints:")
        print(f"  - File list: http://0.0.0.0:{self.port}/api/list?path=/")
        print(f"  - File tree: http://0.0.0.0:{self.port}/api/tree")
        print(f"  - Download: http://0.0.0.0:{self.port}/api/download?path=<file_path>")
        print(f"\nPress Ctrl+C to stop the server")

        # Create server with custom handler
        self.httpd = HTTPServer(('0.0.0.0', self.port), FileServerHandler)
        self.httpd.root_dir = self.root_dir

        try:
            self.httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nShutting down server...")
            self.httpd.shutdown()


# =============================================================================
# Client Implementation
# =============================================================================

class DownloadProgress:
    """Track download progress for multiple files"""

    def __init__(self):
        self.lock = threading.Lock()
        self.completed_files = 0
        self.total_files = 0
        self.failed_files = 0
        self.skipped_files = 0
        self.downloaded_bytes = 0
        self.total_bytes = 0
        self.start_time = time.time()

    def add_file(self, size: int):
        """Add a file to track"""
        with self.lock:
            self.total_files += 1
            self.total_bytes += size

    def mark_completed(self, size: int):
        """Mark a file as completed"""
        with self.lock:
            self.completed_files += 1
            self.downloaded_bytes += size

    def mark_failed(self):
        """Mark a file as failed"""
        with self.lock:
            self.failed_files += 1

    def mark_skipped(self, size: int):
        """Mark a file as skipped"""
        with self.lock:
            self.skipped_files += 1
            self.downloaded_bytes += size

    def get_summary(self) -> str:
        """Get progress summary"""
        with self.lock:
            elapsed = time.time() - self.start_time
            speed = self.downloaded_bytes / elapsed if elapsed > 0 else 0

            return (
                f"Progress: {self.completed_files}/{self.total_files} files | "
                f"Downloaded: {format_size(self.downloaded_bytes)}/{format_size(self.total_bytes)} | "
                f"Speed: {format_size(speed)}/s | "
                f"Failed: {self.failed_files} | "
                f"Skipped: {self.skipped_files}"
            )


class FileClient:
    """File synchronization client"""

    def __init__(self, server_ip: str, port: int = Config.DEFAULT_PORT):
        self.server_url = f"http://{server_ip}:{port}"
        self.download_root = Config.CLIENT_ROOT
        self.progress = DownloadProgress()

    def get_file_list(self) -> List[Dict]:
        """Get complete file list from server"""
        try:
            print(f"Fetching file list from {self.server_url}...")
            response = requests.get(f"{self.server_url}/api/tree", timeout=30)
            response.raise_for_status()

            data = response.json()
            files = data.get("files", [])

            print(f"Found {len(files)} files on server")
            return files
        except Exception as e:
            print(f"Error fetching file list: {e}")
            return []

    def should_download_file(self, remote_file: Dict, local_path: str) -> bool:
        """Check if file should be downloaded"""
        if not os.path.exists(local_path):
            return True

        try:
            local_stat = os.stat(local_path)
            local_size = local_stat.st_size
            remote_size = remote_file["size"]

            # If sizes match, assume file is complete
            if local_size == remote_size:
                return False

            # If local file is smaller, can resume
            if local_size < remote_size:
                return True

            # If local file is larger, re-download
            return True
        except:
            return True

    def download_file(self, file_info: Dict) -> bool:
        """Download a single file with resume support"""
        remote_path = file_info["path"]
        remote_size = file_info["size"]
        local_path = os.path.join(self.download_root, remote_path)

        # Check if download is needed
        if not self.should_download_file(file_info, local_path):
            self.progress.mark_skipped(remote_size)
            return True

        # Create directory if needed
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        # Check for partial download
        start_byte = 0
        if os.path.exists(local_path):
            start_byte = os.path.getsize(local_path)

        # Attempt download with retries
        for attempt in range(Config.RETRY_ATTEMPTS):
            try:
                headers = {}
                if start_byte > 0:
                    headers['Range'] = f'bytes={start_byte}-'

                url = f"{self.server_url}/api/download?path={remote_path}"
                response = requests.get(url, headers=headers, stream=True, timeout=30)
                response.raise_for_status()

                # Open file in append mode if resuming
                mode = 'ab' if start_byte > 0 else 'wb'

                with open(local_path, mode) as f:
                    for chunk in response.iter_content(chunk_size=Config.CHUNK_SIZE):
                        if chunk:
                            f.write(chunk)

                # Verify file size
                if os.path.getsize(local_path) == remote_size:
                    self.progress.mark_completed(remote_size)
                    return True
                else:
                    print(f"Size mismatch for {remote_path}, retrying...")
                    continue

            except Exception as e:
                if attempt < Config.RETRY_ATTEMPTS - 1:
                    print(f"Download failed for {remote_path} (attempt {attempt + 1}), retrying...")
                    time.sleep(Config.RETRY_DELAY)
                else:
                    print(f"Download failed for {remote_path}: {e}")
                    self.progress.mark_failed()
                    return False

        return False

    def start_sync(self):
        """Start file synchronization"""
        print(f"Starting file synchronization from {self.server_url}")
        print(f"Download directory: {self.download_root}")
        print()

        # Create download directory
        os.makedirs(self.download_root, exist_ok=True)

        # Get file list
        files = self.get_file_list()
        if not files:
            print("No files to download")
            return

        # Initialize progress tracking
        for file_info in files:
            self.progress.add_file(file_info["size"])

        print(f"\nStarting download of {len(files)} files...")
        print(f"Maximum concurrent downloads: {Config.MAX_CONCURRENT_DOWNLOADS}")
        print()

        # Download files concurrently
        with ThreadPoolExecutor(max_workers=Config.MAX_CONCURRENT_DOWNLOADS) as executor:
            futures = {executor.submit(self.download_file, file_info): file_info
                      for file_info in files}

            # Progress display thread
            def show_progress():
                while len(futures) > 0:
                    print(f"\r{self.progress.get_summary()}", end='', flush=True)
                    time.sleep(0.5)

            progress_thread = threading.Thread(target=show_progress, daemon=True)
            progress_thread.start()

            # Wait for completion
            for future in as_completed(futures):
                file_info = futures[future]
                try:
                    result = future.result()
                except Exception as e:
                    print(f"\nError downloading {file_info['path']}: {e}")

        # Final summary
        print(f"\n\n{self.progress.get_summary()}")
        print("\nSynchronization completed!")

        elapsed = time.time() - self.progress.start_time
        print(f"Total time: {elapsed:.2f} seconds")


# =============================================================================
# Web Template
# =============================================================================

WEB_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>File Server Browser</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .breadcrumb {
            background: #f8f9fa;
            padding: 15px 30px;
            border-bottom: 1px solid #dee2e6;
        }
        .breadcrumb a {
            color: #667eea;
            text-decoration: none;
            margin-right: 5px;
        }
        .breadcrumb a:hover {
            text-decoration: underline;
        }
        .file-list {
            padding: 20px 30px;
        }
        .file-item {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        .file-item:hover {
            background: #f8f9fa;
        }
        .file-icon {
            font-size: 24px;
            margin-right: 15px;
            width: 30px;
            text-align: center;
        }
        .file-info {
            flex: 1;
        }
        .file-name {
            font-weight: 500;
            color: #333;
        }
        .file-meta {
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
        .api-info {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 30px;
        }
        .api-info h3 {
            color: #856404;
            margin-bottom: 10px;
        }
        .api-info code {
            background: #fff;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📁 File Server Browser</h1>
            <p>Browse and download files from the server</p>
        </div>

        <div class="api-info">
            <h3>API Endpoints</h3>
            <p><strong>File Tree:</strong> <code>/api/tree</code> - Get complete file list</p>
            <p><strong>List Directory:</strong> <code>/api/list?path=/</code> - List directory contents</p>
            <p><strong>Download File:</strong> <code>/api/download?path=<file_path></code> - Download a file</p>
        </div>

        <div class="breadcrumb" id="breadcrumb">
            <a href="#" onclick="loadPath(''); return false;">🏠 Root</a>
        </div>

        <div class="file-list" id="fileList">
            <div class="loading">Loading...</div>
        </div>
    </div>

    <script>
        let currentPath = '';

        function formatSize(bytes) {
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let size = bytes;
            let unitIndex = 0;
            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }
            return size.toFixed(2) + ' ' + units[unitIndex];
        }

        function formatDate(timestamp) {
            return new Date(timestamp * 1000).toLocaleString();
        }

        function updateBreadcrumb(path) {
            const breadcrumb = document.getElementById('breadcrumb');
            let html = '<a href="#" onclick="loadPath(\\'\\'); return false;">🏠 Root</a>';

            if (path) {
                const parts = path.split('/').filter(p => p);
                let currentPath = '';
                parts.forEach((part, index) => {
                    currentPath += '/' + part;
                    html += ` / <a href="#" onclick="loadPath('${currentPath}'); return false;">${part}</a>`;
                });
            }

            breadcrumb.innerHTML = html;
        }

        function loadPath(path) {
            currentPath = path;
            updateBreadcrumb(path);

            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '<div class="loading">Loading...</div>';

            fetch('/api/list?path=' + encodeURIComponent(path))
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        fileList.innerHTML = '<div class="loading">Error: ' + data.error + '</div>';
                        return;
                    }

                    if (data.items.length === 0) {
                        fileList.innerHTML = '<div class="loading">Empty directory</div>';
                        return;
                    }

                    let html = '';
                    data.items.forEach(item => {
                        const icon = item.is_dir ? '📁' : '📄';
                        const onclick = item.is_dir
                            ? `loadPath('/${item.path}')`
                            : `downloadFile('/${item.path}')`;

                        html += `
                            <div class="file-item" onclick="${onclick}">
                                <div class="file-icon">${icon}</div>
                                <div class="file-info">
                                    <div class="file-name">${item.name}</div>
                                    ${!item.is_dir ? `<div class="file-meta">Size: ${formatSize(item.size)} | Modified: ${formatDate(item.modified)}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });

                    fileList.innerHTML = html;
                })
                .catch(error => {
                    fileList.innerHTML = '<div class="loading">Error loading files</div>';
                    console.error('Error:', error);
                });
        }

        function downloadFile(path) {
            window.location.href = '/api/download?path=' + encodeURIComponent(path);
        }

        // Load root directory on page load
        loadPath('');
    </script>
</body>
</html>
"""


# =============================================================================
# Command Line Interface
# =============================================================================

def main():
    """Main program entry point"""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python file_sync_tool.py server [--port PORT]")
        print("  python file_sync_tool.py client --server SERVER_URL [--path PATH]")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'server':
        # Parse server arguments
        port = Config.DEFAULT_PORT
        for i, arg in enumerate(sys.argv):
            if arg == '--port' and i + 1 < len(sys.argv):
                port = int(sys.argv[i + 1])

        root_dir = Config.SERVER_ROOT
        if not os.path.exists(root_dir):
            print(f"Warning: Server root directory does not exist: {root_dir}")
            print("Creating directory...")
            os.makedirs(root_dir, exist_ok=True)

        server = FileServer(root_dir, port)
        server.run()

    elif command == 'client':
        # Parse client arguments
        server_url = None
        for i, arg in enumerate(sys.argv):
            if arg == '--server' and i + 1 < len(sys.argv):
                server_url = sys.argv[i + 1]

        if not server_url:
            print("Error: --server argument is required")
            print("Usage: python file_sync_tool.py client --server http://SERVER_IP:PORT")
            sys.exit(1)

        # Extract IP and port from URL
        server_url = server_url.replace('http://', '').replace('https://', '')
        if ':' in server_url:
            server_ip, port = server_url.split(':')
            port = int(port)
        else:
            server_ip = server_url
            port = Config.DEFAULT_PORT

        client = FileClient(server_ip, port)
        client.start_sync()

    else:
        print(f"Unknown command: {command}")
        print("Available commands: server, client")
        sys.exit(1)


if __name__ == "__main__":
    main()

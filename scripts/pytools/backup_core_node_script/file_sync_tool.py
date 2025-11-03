#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Synchronization Tool - Server and Client
Provides web interface and API for file browsing and batch downloading
Supports concurrent downloads, resume capability, and progress tracking
"""

import os
import sys
import json
import hashlib
import threading
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from flask import Flask, jsonify, send_file, request, render_template_string
    import requests
    from tqdm import tqdm
except ImportError as e:
    print("=" * 70)
    print("ERROR: Missing required packages")
    print("=" * 70)
    print(f"\nImport error: {e}")
    print("\nThis script requires: flask, requests, tqdm")
    print("\nTo fix this issue, run the initialization script first:")
    print("\n  python init_env.py")
    print("\nThen use one of these methods to run:")
    if sys.platform.startswith('win'):
        print("\n  Method 1: .\\run_server.ps1")
        print("  Method 2: .\\activate.ps1 && python file_sync_tool.py server")
    else:
        print("\n  Method 1: ./run_server.sh")
        print("  Method 2: source ./activate.sh && python file_sync_tool.py server")
    print("\n" + "=" * 70)
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
# Server Implementation
# =============================================================================

class FileServer:
    """File server with web interface and API"""

    def __init__(self, root_dir: str, port: int = Config.DEFAULT_PORT):
        self.root_dir = os.path.abspath(root_dir)
        self.port = port
        self.app = Flask(__name__)
        self.setup_routes()

    def setup_routes(self):
        """Setup Flask routes"""

        @self.app.route('/')
        def index():
            """Main web interface"""
            return render_template_string(WEB_TEMPLATE)

        @self.app.route('/api/list')
        def api_list_files():
            """API endpoint to list files"""
            path = request.args.get('path', '')
            full_path = os.path.join(self.root_dir, path.lstrip('/'))

            if not os.path.exists(full_path):
                return jsonify({"error": "Path not found"}), 404

            if not os.path.isdir(full_path):
                return jsonify({"error": "Not a directory"}), 400

            try:
                items = []
                for item_name in sorted(os.listdir(full_path)):
                    item_path = os.path.join(full_path, item_name)
                    relative_path = os.path.relpath(item_path, self.root_dir)

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

                return jsonify({
                    "path": path,
                    "items": items
                })
            except Exception as e:
                return jsonify({"error": str(e)}), 500

        @self.app.route('/api/download')
        def api_download_file():
            """API endpoint to download a file"""
            path = request.args.get('path', '')
            full_path = os.path.join(self.root_dir, path.lstrip('/'))

            if not os.path.exists(full_path):
                return jsonify({"error": "File not found"}), 404

            if os.path.isdir(full_path):
                return jsonify({"error": "Cannot download directory"}), 400

            # Support range requests for resume capability
            return send_file(full_path, as_attachment=True, conditional=True)

        @self.app.route('/api/tree')
        def api_file_tree():
            """API endpoint to get complete file tree"""
            files = []

            for root, dirs, filenames in os.walk(self.root_dir):
                # Filter excluded directories
                dirs[:] = [d for d in dirs if not should_exclude_path(
                    os.path.relpath(os.path.join(root, d), self.root_dir),
                    Config.EXCLUDE_DIRS
                )]

                for filename in filenames:
                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, self.root_dir)

                    try:
                        stat = os.stat(file_path)
                        files.append({
                            "path": relative_path.replace(os.sep, '/'),
                            "size": stat.st_size,
                            "modified": stat.st_mtime
                        })
                    except:
                        continue

            return jsonify({
                "total_files": len(files),
                "files": files
            })

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

        self.app.run(host='0.0.0.0', port=self.port, threaded=True)


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
# Menu System
# =============================================================================

def show_menu():
    """Display main menu"""
    print("\n" + "=" * 60)
    print("File Synchronization Tool".center(60))
    print("=" * 60)
    print("\n1. Start Server (Share files from /www/wwwroot/)")
    print("2. Start Client (Download files from server)")
    print("3. Exit")
    print("\n" + "=" * 60)


def start_server():
    """Start file server"""
    print("\n" + "=" * 60)
    print("Starting File Server".center(60))
    print("=" * 60 + "\n")

    root_dir = Config.SERVER_ROOT
    if not os.path.exists(root_dir):
        print(f"Warning: Server root directory does not exist: {root_dir}")
        create = input("Create directory? (y/n): ").strip().lower()
        if create == 'y':
            os.makedirs(root_dir, exist_ok=True)
            print(f"Created directory: {root_dir}")
        else:
            print("Cannot start server without root directory")
            return

    port = input(f"Enter port (default: {Config.DEFAULT_PORT}): ").strip()
    if not port:
        port = Config.DEFAULT_PORT
    else:
        try:
            port = int(port)
        except:
            print("Invalid port, using default")
            port = Config.DEFAULT_PORT

    server = FileServer(root_dir, port)
    server.run()


def start_client():
    """Start file client"""
    print("\n" + "=" * 60)
    print("Starting File Client".center(60))
    print("=" * 60 + "\n")

    server_ip = input("Enter server IP address: ").strip()
    if not server_ip:
        print("Server IP is required")
        return

    port = input(f"Enter server port (default: {Config.DEFAULT_PORT}): ").strip()
    if not port:
        port = Config.DEFAULT_PORT
    else:
        try:
            port = int(port)
        except:
            print("Invalid port, using default")
            port = Config.DEFAULT_PORT

    print(f"\nConnecting to {server_ip}:{port}...")

    client = FileClient(server_ip, port)
    client.start_sync()

    print("\nPress Enter to continue...")
    input()


def main():
    """Main program entry point"""
    while True:
        show_menu()
        choice = input("\nEnter your choice (1-3): ").strip()

        if choice == '1':
            try:
                start_server()
            except KeyboardInterrupt:
                print("\n\nServer stopped by user")
            except Exception as e:
                print(f"\nServer error: {e}")
            input("\nPress Enter to continue...")

        elif choice == '2':
            try:
                start_client()
            except KeyboardInterrupt:
                print("\n\nClient stopped by user")
            except Exception as e:
                print(f"\nClient error: {e}")
            input("\nPress Enter to continue...")

        elif choice == '3':
            print("\nExiting...")
            sys.exit(0)

        else:
            print("\nInvalid choice. Please enter 1, 2, or 3.")
            input("Press Enter to continue...")


if __name__ == "__main__":
    main()

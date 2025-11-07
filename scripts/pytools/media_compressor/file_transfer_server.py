"""
File Transfer Server Module
Provides HTTP server for sharing files with resume support
"""

import os
import re
import socket
import json
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, quote


class FileTransferRequestHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for file transfer"""

    def log_message(self, format, *args):
        """Custom log message"""
        print(f"[{self.client_address[0]}] {format % args}")

    def log_error(self, format, *args):
        """Override to suppress verbose error logging for connection issues"""
        # Only log non-connection errors
        if 'ConnectionAbortedError' not in str(args) and 'BrokenPipeError' not in str(args):
            print(f"[ERROR] {format % args}")

    def do_GET(self):
        """Handle GET requests"""
        try:
            if self.path == '/':
                # Return HTML page with file list
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()

                file_map = self.server.file_map
                html = self._generate_html_page(file_map)
                self.wfile.write(html.encode('utf-8'))

            elif self.path == '/api/files':
                # Return JSON file map
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()

                json_data = json.dumps(self.server.file_map, ensure_ascii=False, indent=2)
                self.wfile.write(json_data.encode('utf-8'))

            elif self.path.startswith('/download/'):
                # Handle file download with resume support
                file_path = unquote(self.path[10:])  # Remove '/download/'
                self._handle_file_download(file_path)

            else:
                self.send_error(404, "Not Found")

        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError) as e:
            # Client disconnected, just log and continue
            print(f"[{self.client_address[0]}] Connection closed by client")
        except Exception as e:
            print(f"[{self.client_address[0]}] Error handling request: {e}")
            try:
                self.send_error(500, "Internal Server Error")
            except:
                pass  # Connection already closed

    def _generate_html_page(self, file_map):
        """Generate HTML page with file list"""
        total_size = sum(f['size'] for f in file_map['files'].values())
        total_files = len(file_map['files'])

        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>File Transfer Server</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #4CAF50; color: white; padding: 15px; border-radius: 5px; }}
        .stats {{ margin: 20px 0; padding: 10px; background: #f0f0f0; border-radius: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #4CAF50; color: white; }}
        tr:hover {{ background-color: #f5f5f5; }}
        a {{ color: #4CAF50; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .footer {{ margin-top: 20px; padding: 10px; text-align: center; color: #666; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>File Transfer Server</h1>
        <p>Source: {file_map['source_dir']}</p>
    </div>

    <div class="stats">
        <h2>Statistics</h2>
        <p><strong>Total Files:</strong> {total_files}</p>
        <p><strong>Total Size:</strong> {self._format_size(total_size)}</p>
        <p><strong>Server Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>

    <h2>File List</h2>
    <p><a href="/api/files" target="_blank">Download JSON File Map</a></p>

    <table>
        <tr>
            <th>File Path</th>
            <th>Size</th>
            <th>Modified</th>
            <th>Download</th>
        </tr>
"""

        for rel_path, info in sorted(file_map['files'].items()):
            size_str = self._format_size(info['size'])
            modified_date = info.get('modified', 'N/A')
            if modified_date != 'N/A':
                # Format date nicely
                try:
                    dt = datetime.fromisoformat(modified_date)
                    modified_date = dt.strftime('%Y-%m-%d %H:%M')
                except:
                    pass
            download_url = f"/download/{rel_path}"

            html += f"""        <tr>
            <td>{rel_path}</td>
            <td>{size_str}</td>
            <td>{modified_date}</td>
            <td><a href="{download_url}" download>Download</a></td>
        </tr>
"""

        html += """    </table>

    <div class="footer">
        <p>File Transfer Server - Use client mode to download all files</p>
    </div>
</body>
</html>"""

        return html

    def _handle_file_download(self, rel_path):
        """Handle file download with resume support"""
        try:
            file_info = self.server.file_map['files'].get(rel_path)
            if not file_info:
                self.send_error(404, "File not found in map")
                return

            full_path = Path(file_info['full_path'])
            if not full_path.exists():
                self.send_error(404, "File not found on disk")
                return

            file_size = full_path.stat().st_size

            # Check for Range header (resume support)
            range_header = self.headers.get('Range')
            start_byte = 0

            if range_header:
                # Parse Range header: bytes=start-end
                range_match = re.match(r'bytes=(\d+)-', range_header)
                if range_match:
                    start_byte = int(range_match.group(1))

            # Send headers
            if start_byte > 0:
                self.send_response(206)  # Partial Content
                self.send_header('Content-Range', f'bytes {start_byte}-{file_size-1}/{file_size}')
                self.send_header('Content-Length', str(file_size - start_byte))
            else:
                self.send_response(200)
                self.send_header('Content-Length', str(file_size))

            self.send_header('Content-Type', 'application/octet-stream')

            # Handle filename encoding for non-ASCII characters (RFC 2231)
            filename = full_path.name
            try:
                # Try to encode as ASCII
                filename.encode('ascii')
                # ASCII filename, use simple format
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            except UnicodeEncodeError:
                # Non-ASCII filename, use RFC 2231 format
                encoded_filename = quote(filename, safe='')
                self.send_header('Content-Disposition',
                                f"attachment; filename*=UTF-8''{encoded_filename}")

            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()

            # Send file content
            bytes_sent = 0
            try:
                # Use larger buffer for better performance (256KB)
                with open(full_path, 'rb', buffering=262144) as f:
                    if start_byte > 0:
                        f.seek(start_byte)

                    # Use larger chunk size for better throughput (256KB)
                    chunk_size = 262144
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                            bytes_sent += len(chunk)
                        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                            # Connection closed by client during transfer
                            print(f"  Transfer interrupted at {self._format_size(bytes_sent)}/{self._format_size(file_size)}: {rel_path}")
                            return

                print(f"  ✓ Sent: {rel_path} ({self._format_size(file_size)}, from byte {start_byte})")

            except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                print(f"  Transfer interrupted: {rel_path}")
                return

        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            # Connection closed, silently return
            return
        except Exception as e:
            print(f"  Error downloading file {rel_path}: {e}")
            try:
                self.send_error(500, "Download error")
            except:
                pass  # Connection already closed

    def _format_size(self, size_bytes: int) -> str:
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"


class FileTransferServer:
    """File Transfer Server - Scan and serve files via HTTP"""

    def __init__(self, source_dir: Path, host='0.0.0.0', port=8000):
        self.source_dir = source_dir
        self.host = host
        self.port = port
        self.file_map = None
        self.server = None

    def _get_local_ip(self) -> str:
        """Get local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

    def scan_files(self):
        """Scan all files in source directory"""
        print(f"\n{'='*60}")
        print(f"Scanning files for transfer: {self.source_dir}")
        print(f"{'='*60}")

        file_map = {
            'version': '1.0',
            'source_dir': str(self.source_dir),
            'scan_time': datetime.now().isoformat(),
            'files': {}
        }

        file_count = 0
        for root, dirs, filenames in os.walk(self.source_dir):
            # Skip temp and compress directories
            if '_tmp' in root or '_compress' in root:
                continue

            for filename in filenames:
                # Skip cache JSON
                if filename == 'compression_cache.json':
                    continue

                filepath = Path(root) / filename
                try:
                    rel_path = filepath.relative_to(self.source_dir)
                    file_size = filepath.stat().st_size

                    file_map['files'][str(rel_path)] = {
                        'full_path': str(filepath),
                        'size': file_size,
                        'modified': datetime.fromtimestamp(filepath.stat().st_mtime).isoformat()
                    }

                    file_count += 1

                    if file_count % 100 == 0:
                        print(f"  Scanned {file_count} files...")

                except Exception as e:
                    print(f"Error scanning {filepath}: {e}")

        print(f"\n{'='*60}")
        print(f"Scan completed: {file_count} files")
        print(f"{'='*60}")

        return file_map

    def start_server(self):
        """Start HTTP server"""
        print(f"\n{'='*60}")
        print(f"Starting File Transfer Server")
        print(f"{'='*60}")

        # Scan files
        self.file_map = self.scan_files()

        if not self.file_map['files']:
            print("No files to serve!")
            return

        # Create server with optimized settings
        self.server = HTTPServer((self.host, self.port), FileTransferRequestHandler)
        self.server.file_map = self.file_map

        # Optimize socket settings for better performance
        try:
            # Enable TCP_NODELAY to disable Nagle's algorithm
            self.server.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            # Increase send buffer size to 1MB
            self.server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1024 * 1024)
            # Increase receive buffer size to 1MB
            self.server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024)
            # Enable SO_REUSEADDR to allow quick restart
            self.server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        except Exception as e:
            print(f"Warning: Could not optimize socket settings: {e}")

        local_ip = self._get_local_ip()

        print(f"\n{'='*60}")
        print(f"Server started successfully!")
        print(f"{'='*60}")
        print(f"Local URL:    http://127.0.0.1:{self.port}")
        print(f"Network URL:  http://{local_ip}:{self.port}")
        print(f"\nClient command: Use option 6 and enter: {local_ip}:{self.port}")
        print(f"\nOptimizations enabled:")
        print(f"  - Chunk size: 256KB")
        print(f"  - Socket buffer: 1MB")
        print(f"  - TCP_NODELAY: enabled")
        print(f"\nPress Ctrl+C to stop server")
        print(f"{'='*60}\n")

        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped by user")
        finally:
            self.server.server_close()

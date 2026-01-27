#!/usr/bin/env python3
# Simple HTTP server for serving backup files
# Usage: python3 serve_backup_download.py <backup_file_path> [port]

import os
import sys
import http.server
import socketserver
import socket
from pathlib import Path

def get_local_ip():
    """Get local IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class BackupFileHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, backup_file=None, **kwargs):
        self.backup_file = backup_file
        super().__init__(*args, **kwargs)

    def do_GET(self):
        if self.path == '/' or self.path == '/download':
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'attachment; filename="{os.path.basename(self.backup_file)}"')
            self.send_header('Content-Length', str(os.path.getsize(self.backup_file)))
            self.end_headers()
            
            with open(self.backup_file, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'File not found')

    def log_message(self, format, *args):
        pass

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 serve_backup_download.py <backup_file_path> [port]")
        sys.exit(1)

    backup_file = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8888

    if not os.path.exists(backup_file):
        print(f"Error: Backup file not found: {backup_file}")
        sys.exit(1)

    backup_file = os.path.abspath(backup_file)
    backup_dir = os.path.dirname(backup_file)
    backup_filename = os.path.basename(backup_file)

    os.chdir(backup_dir)

    handler = lambda *args, **kwargs: BackupFileHandler(*args, backup_file=backup_file, **kwargs)

    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            local_ip = get_local_ip()
            print(f"Backup download server started")
            print(f"Local access: http://127.0.0.1:{port}/download")
            print(f"Network access: http://{local_ip}:{port}/download")
            print(f"Backup file: {backup_filename}")
            print(f"Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    except OSError as e:
        if e.errno == 98:
            print(f"Error: Port {port} is already in use")
        else:
            print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()


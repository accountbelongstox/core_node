#!/usr/bin/env python3
# Backup Web Management Server
# Complete web UI for backup management
# Usage: python3 backup_web_manager.py [port] [backup_base_dir]

import os
import sys
import json
import urllib.parse
import http.server
import socketserver
import socket
from pathlib import Path
from datetime import datetime

# Import API handlers
api_dir = os.path.join(os.path.dirname(__file__), 'web_ui', 'api')
if not os.path.exists(api_dir):
    api_dir = os.path.join(os.path.dirname(__file__), 'api')

sys.path.insert(0, api_dir)
try:
    from verify_handler import verify_backup_file
    from statistics_handler import calculate_statistics
    from restore_handler import restore_backup
except ImportError:
    # Fallback if handlers not found
    verify_backup_file = None
    calculate_statistics = None
    restore_backup = None

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

def format_size(size_bytes):
    """Format file size in human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def get_backup_info(backup_path):
    """Get backup file information"""
    if not os.path.exists(backup_path):
        return None
    
    stat = os.stat(backup_path)
    return {
        'name': os.path.basename(backup_path),
        'path': backup_path,
        'size': stat.st_size,
        'size_formatted': format_size(stat.st_size),
        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
        'modified_timestamp': stat.st_mtime
    }

def list_backups(backup_base_dir):
    """List all backups organized by namespace"""
    backups = {}
    
    if not os.path.exists(backup_base_dir):
        return backups
    
    for namespace in os.listdir(backup_base_dir):
        namespace_path = os.path.join(backup_base_dir, namespace)
        if not os.path.isdir(namespace_path):
            continue
        
        namespace_backups = []
        for file in os.listdir(namespace_path):
            file_path = os.path.join(namespace_path, file)
            if os.path.isfile(file_path) and (file.endswith('.zip') or file.endswith('.tar.gz')):
                backup_info = get_backup_info(file_path)
                if backup_info:
                    namespace_backups.append(backup_info)
        
        if namespace_backups:
            namespace_backups.sort(key=lambda x: x['modified_timestamp'], reverse=True)
            backups[namespace] = namespace_backups
    
    return backups

class BackupWebHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, backup_base_dir=None, script_dir=None, **kwargs):
        self.backup_base_dir = backup_base_dir
        self.script_dir = script_dir
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        # Serve static files
        if path.startswith('/static/'):
            self.serve_static_file(path[8:])
            return
        
        # API endpoints
        if path == '/api/backups':
            self.serve_backup_list()
            return
        elif path == '/api/statistics':
            self.serve_statistics()
            return
        elif path.startswith('/api/download/'):
            self.serve_backup_download(path[14:])
            return
        elif path.startswith('/api/info/'):
            self.serve_backup_info(path[10:])
            return
        elif path.startswith('/api/verify/'):
            self.serve_backup_verify(path[12:])
            return
        elif path.startswith('/api/restore/'):
            self.serve_backup_restore(path[13:])
            return
        
        # Serve main HTML page
        if path == '/' or path == '/index.html':
            self.serve_index()
        else:
            self.send_error(404, "Not Found")
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path.startswith('/api/delete/'):
            self.serve_backup_delete(path[12:])
        else:
            self.send_error(404, "Not Found")
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path.startswith('/api/restore/'):
            self.serve_backup_restore(path[13:])
        elif path == '/api/batch/delete':
            self.serve_batch_delete()
        else:
            self.send_error(404, "Not Found")
    
    def serve_static_file(self, filename):
        """Serve static files (HTML, CSS, JS)"""
        # Support both old structure and new web_ui structure
        # filename format: css/base.css or js/utils.js
        possible_paths = [
            os.path.join(self.script_dir, filename),
            os.path.join(self.script_dir, 'web_ui', filename),
            os.path.join(os.path.dirname(self.script_dir), 'web_ui', filename)
        ]
        
        file_path = None
        for path in possible_paths:
            if os.path.exists(path) and os.path.isfile(path):
                file_path = path
                break
        
        if not file_path:
            self.send_error(404, "File not found")
            return
        
        # Determine content type
        content_type = 'text/plain'
        if filename.endswith('.html'):
            content_type = 'text/html'
        elif filename.endswith('.css'):
            content_type = 'text/css'
        elif filename.endswith('.js'):
            content_type = 'application/javascript'
        elif filename.endswith('.json'):
            content_type = 'application/json'
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {str(e)}")
    
    def serve_index(self):
        """Serve main HTML page"""
        # Support both old structure and new web_ui structure
        possible_paths = [
            os.path.join(self.script_dir, 'index.html'),
            os.path.join(self.script_dir, 'web_ui', 'index.html'),
            os.path.join(os.path.dirname(self.script_dir), 'web_ui', 'index.html')
        ]
        
        index_path = None
        for path in possible_paths:
            if os.path.exists(path):
                index_path = path
                break
        
        if not index_path:
            self.send_error(404, "index.html not found")
            return
        
        try:
            with open(index_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading index.html: {str(e)}")
    
    def serve_backup_list(self):
        """Serve backup list as JSON"""
        try:
            backups = list_backups(self.backup_base_dir)
            response = json.dumps(backups, indent=2).encode('utf-8')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def serve_backup_download(self, encoded_path):
        """Serve backup file for download"""
        try:
            backup_path = urllib.parse.unquote(encoded_path)
            full_path = os.path.join(self.backup_base_dir, backup_path)
            
            # Security check: ensure path is within backup_base_dir
            full_path = os.path.abspath(full_path)
            backup_base_abs = os.path.abspath(self.backup_base_dir)
            if not full_path.startswith(backup_base_abs):
                self.send_error(403, "Access denied")
                return
            
            if not os.path.exists(full_path) or not os.path.isfile(full_path):
                self.send_error(404, "Backup file not found")
                return
            
            with open(full_path, 'rb') as f:
                content = f.read()
            
            filename = os.path.basename(full_path)
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error downloading file: {str(e)}")
    
    def serve_backup_delete(self, encoded_path):
        """Delete backup file"""
        try:
            backup_path = urllib.parse.unquote(encoded_path)
            full_path = os.path.join(self.backup_base_dir, backup_path)
            
            # Security check: ensure path is within backup_base_dir
            full_path = os.path.abspath(full_path)
            backup_base_abs = os.path.abspath(self.backup_base_dir)
            if not full_path.startswith(backup_base_abs):
                self.send_error(403, "Access denied")
                return
            
            if not os.path.exists(full_path):
                self.send_error(404, "Backup file not found")
                return
            
            os.remove(full_path)
            
            response = json.dumps({'success': True, 'message': 'Backup deleted successfully'}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def serve_backup_info(self, encoded_path):
        """Get backup file information"""
        try:
            backup_path = urllib.parse.unquote(encoded_path)
            full_path = os.path.join(self.backup_base_dir, backup_path)
            
            # Security check: ensure path is within backup_base_dir
            full_path = os.path.abspath(full_path)
            backup_base_abs = os.path.abspath(self.backup_base_dir)
            if not full_path.startswith(backup_base_abs):
                self.send_error(403, "Access denied")
                return
            
            backup_info = get_backup_info(full_path)
            if not backup_info:
                self.send_error(404, "Backup file not found")
                return
            
            response = json.dumps(backup_info, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def serve_statistics(self):
        """Serve backup statistics"""
        try:
            if calculate_statistics:
                stats = calculate_statistics(self.backup_base_dir)
            else:
                # Fallback calculation
                stats = self._calculate_statistics_fallback()
            
            response = json.dumps(stats, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def serve_backup_verify(self, encoded_path):
        """Verify backup file"""
        try:
            backup_path = urllib.parse.unquote(encoded_path)
            full_path = os.path.join(self.backup_base_dir, backup_path)
            
            # Security check
            full_path = os.path.abspath(full_path)
            backup_base_abs = os.path.abspath(self.backup_base_dir)
            if not full_path.startswith(backup_base_abs):
                self.send_error(403, "Access denied")
                return
            
            if not os.path.exists(full_path):
                self.send_error(404, "Backup file not found")
                return
            
            if verify_backup_file:
                result = verify_backup_file(full_path)
            else:
                result = self._verify_backup_fallback(full_path)
            
            response = json.dumps(result, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'error': str(e), 'valid': False}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def serve_backup_restore(self, encoded_path):
        """Restore backup"""
        try:
            backup_path = urllib.parse.unquote(encoded_path)
            full_path = os.path.join(self.backup_base_dir, backup_path)
            
            # Security check
            full_path = os.path.abspath(full_path)
            backup_base_abs = os.path.abspath(self.backup_base_dir)
            if not full_path.startswith(backup_base_abs):
                self.send_error(403, "Access denied")
                return
            
            if not os.path.exists(full_path):
                self.send_error(404, "Backup file not found")
                return
            
            # Read request body for namespace
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body) if body else {}
            namespace = data.get('namespace', '')
            
            if not namespace:
                # Try to detect from path
                namespace = os.path.dirname(backup_path).split(os.sep)[-1] if os.path.dirname(backup_path) else ''
            
            if restore_backup:
                result = restore_backup(full_path, namespace, self.backup_base_dir)
            else:
                result = {'success': False, 'message': 'Restore handler not available'}
            
            response = json.dumps(result, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'success': False, 'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def serve_batch_delete(self):
        """Batch delete backups"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            paths = data.get('paths', [])
            
            if not paths:
                self.send_error(400, "No paths provided")
                return
            
            deleted_count = 0
            errors = []
            
            for encoded_path in paths:
                try:
                    backup_path = urllib.parse.unquote(encoded_path)
                    full_path = os.path.join(self.backup_base_dir, backup_path)
                    
                    # Security check
                    full_path = os.path.abspath(full_path)
                    backup_base_abs = os.path.abspath(self.backup_base_dir)
                    if not full_path.startswith(backup_base_abs):
                        errors.append(f"Access denied: {backup_path}")
                        continue
                    
                    if os.path.exists(full_path):
                        os.remove(full_path)
                        deleted_count += 1
                except Exception as e:
                    errors.append(f"Error deleting {encoded_path}: {str(e)}")
            
            result = {
                'success': True,
                'deleted_count': deleted_count,
                'total_requested': len(paths),
                'errors': errors
            }
            
            response = json.dumps(result, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            error_response = json.dumps({'success': False, 'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_response)))
            self.end_headers()
            self.wfile.write(error_response)
    
    def _calculate_statistics_fallback(self):
        """Fallback statistics calculation"""
        stats = {
            'total_backups': 0,
            'total_size': 0,
            'namespaces': {}
        }
        
        if not os.path.exists(self.backup_base_dir):
            return stats
        
        for namespace in os.listdir(self.backup_base_dir):
            namespace_path = os.path.join(self.backup_base_dir, namespace)
            if not os.path.isdir(namespace_path):
                continue
            
            namespace_stats = {'count': 0, 'size': 0}
            for file in os.listdir(namespace_path):
                file_path = os.path.join(namespace_path, file)
                if os.path.isfile(file_path) and (file.endswith('.zip') or file.endswith('.tar.gz')):
                    namespace_stats['count'] += 1
                    namespace_stats['size'] += os.path.getsize(file_path)
            
            if namespace_stats['count'] > 0:
                stats['namespaces'][namespace] = namespace_stats
                stats['total_backups'] += namespace_stats['count']
                stats['total_size'] += namespace_stats['size']
        
        return stats
    
    def _verify_backup_fallback(self, backup_path):
        """Fallback verification"""
        import tarfile
        import zipfile
        
        try:
            if backup_path.endswith('.tar.gz') or backup_path.endswith('.tgz'):
                with tarfile.open(backup_path, 'r:gz') as tar:
                    tar.getmembers()
                return {'valid': True, 'format': 'tar.gz', 'message': 'Archive is valid'}
            elif backup_path.endswith('.zip'):
                with zipfile.ZipFile(backup_path, 'r') as zip_file:
                    zip_file.testzip()
                return {'valid': True, 'format': 'zip', 'message': 'Archive is valid'}
            else:
                return {'valid': False, 'format': 'unknown', 'message': 'Unknown format'}
        except Exception as e:
            return {'valid': False, 'format': 'unknown', 'message': str(e)}
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

def main():
    # Get script directory - support both old and new structure
    script_file = os.path.abspath(__file__)
    script_dir = os.path.dirname(script_file)
    
    # Check if we're in web_ui directory or parent directory
    if os.path.basename(script_dir) == 'web_ui':
        # Running from web_ui directory
        pass
    elif os.path.exists(os.path.join(script_dir, 'web_ui')):
        # Running from parent directory, use web_ui subdirectory
        script_dir = os.path.join(script_dir, 'web_ui')
    else:
        # Fallback: assume web_ui structure exists at same level
        pass
    
    # Default values
    port = 8888
    backup_base_dir = None
    
    # Parse arguments
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}, using default 8888")
    
    if len(sys.argv) > 2:
        backup_base_dir = sys.argv[2]
    else:
        # Try to get from environment or use default
        # This should match the backup directory structure
        # Try common locations
        possible_paths = [
            "/www/backups",
            os.path.join(os.path.expanduser("~"), "www", "backups"),
            os.path.join("/mnt", "d", "www", "backups"),
        ]
        
        backup_base_dir = None
        for path in possible_paths:
            if os.path.exists(path):
                backup_base_dir = path
                break
        
        if not backup_base_dir:
            # Use first path as default
            backup_base_dir = possible_paths[0]
    
    backup_base_dir = os.path.abspath(backup_base_dir)
    
    if not os.path.exists(backup_base_dir):
        print(f"Warning: Backup directory does not exist: {backup_base_dir}")
        print("Creating directory...")
        os.makedirs(backup_base_dir, exist_ok=True)
    
    print(f"Backup Web Manager Server")
    print(f"Script directory: {script_dir}")
    print(f"Backup base directory: {backup_base_dir}")
    print(f"Port: {port}")
    print()
    
    # Verify web_ui structure exists
    if not os.path.exists(os.path.join(script_dir, 'index.html')):
        print(f"Warning: index.html not found in {script_dir}")
        print("Trying alternative locations...")
        alt_paths = [
            os.path.join(os.path.dirname(script_dir), 'web_ui'),
            os.path.join(script_dir, 'web_ui')
        ]
        for alt_path in alt_paths:
            if os.path.exists(os.path.join(alt_path, 'index.html')):
                script_dir = alt_path
                print(f"Found web_ui at: {script_dir}")
                break
    
    handler = lambda *args, **kwargs: BackupWebHandler(
        *args, 
        backup_base_dir=backup_base_dir,
        script_dir=script_dir,
        **kwargs
    )
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            local_ip = get_local_ip()
            print(f"Server started successfully!")
            print(f"Local access: http://127.0.0.1:{port}")
            print(f"Network access: http://{local_ip}:{port}")
            print(f"Press Ctrl+C to stop the server")
            print()
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


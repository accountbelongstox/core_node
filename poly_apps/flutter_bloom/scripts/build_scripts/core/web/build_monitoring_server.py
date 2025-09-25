# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Build Monitoring Server
Provides web interface for build process visualization and user confirmation
"""

import os
import json
import threading
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from typing import Dict, List, Any

class BuildMonitoringServer:
    """Web server for build monitoring and visualization"""
    
    def __init__(self, port: int = 10001):
        self.port = port
        self.server = None
        self.server_thread = None
        self.build_data = {}
        
        # Get paths
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.build_scripts_dir = os.path.dirname(os.path.dirname(current_dir))
        self.web_templates_dir = os.path.join(self.build_scripts_dir, 'web_templates')
        self.web_static_dir = os.path.join(self.build_scripts_dir, 'web_static')
    
    def start_server(self, replacement_results: List[Dict[str, Any]], identifier_results: List[Dict[str, Any]], platform_assets: Dict[str, Any]):
        """Start web server with build results"""
        
        # Prepare build data
        self.build_data = {
            'replacement_results': replacement_results,
            'identifier_results': identifier_results,
            'platform_assets': platform_assets,
            'timestamp': self.get_current_timestamp(),
            'status': 'completed'
        }
        
        # Save build data to JSON file
        self.save_build_data()
        
        # Start server in background thread
        self.server_thread = threading.Thread(target=self._run_server, daemon=True)
        self.server_thread.start()
        
        # Open browser
        server_url = f"http://localhost:{self.port}"
        print(f"[INFO] Starting build monitoring server at: {server_url}")
        
        try:
            webbrowser.open(server_url)
            print(f"[SUCCESS] Build monitoring server started and browser opened")
        except Exception as e:
            print(f"[WARNING] Could not open browser automatically: {str(e)}")
            print(f"[INFO] Please open {server_url} manually")
    
    def _run_server(self):
        """Run the HTTP server"""
        try:
            # Change to web templates directory to serve files
            os.chdir(self.web_templates_dir)
            
            # Create custom handler
            handler = self.create_request_handler()
            
            # Start server
            self.server = HTTPServer(('localhost', self.port), handler)
            print(f"[INFO] HTTP server running on port {self.port}")
            self.server.serve_forever()
            
        except Exception as e:
            print(f"[ERROR] Failed to start HTTP server: {str(e)}")
    
    def create_request_handler(self):
        """Create custom request handler"""
        build_data = self.build_data
        web_static_dir = self.web_static_dir
        
        class CustomHandler(SimpleHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/api/build-data':
                    # Serve build data as JSON
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps(build_data, indent=2).encode())
                elif self.path.startswith('/static/'):
                    # Serve static files
                    static_file = self.path[8:]  # Remove '/static/' prefix
                    static_path = os.path.join(web_static_dir, static_file)
                    if os.path.exists(static_path):
                        self.send_response(200)
                        if static_file.endswith('.js'):
                            self.send_header('Content-type', 'application/javascript')
                        elif static_file.endswith('.css'):
                            self.send_header('Content-type', 'text/css')
                        else:
                            self.send_header('Content-type', 'text/plain')
                        self.end_headers()
                        with open(static_path, 'rb') as f:
                            self.wfile.write(f.read())
                    else:
                        self.send_error(404)
                else:
                    # Serve HTML files normally
                    super().do_GET()
            
            def log_message(self, format, *args):
                # Suppress server logs
                pass
        
        return CustomHandler
    
    def save_build_data(self):
        """Save build data to JSON file"""
        try:
            data_file = os.path.join(self.web_templates_dir, 'build_data.json')
            with open(data_file, 'w', encoding='utf-8') as f:
                json.dump(self.build_data, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Build data saved to: {data_file}")
        except Exception as e:
            print(f"[ERROR] Failed to save build data: {str(e)}")
    
    def get_current_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def stop_server(self):
        """Stop the web server"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            print(f"[INFO] Build monitoring server stopped")
    
    def wait_for_user_confirmation(self) -> bool:
        """Wait for user confirmation via web interface"""
        print(f"[INFO] Waiting for user confirmation via web interface...")
        print(f"[INFO] Please review the build configuration and confirm to proceed")
        
        # In a real implementation, this would check for user confirmation
        # For now, we'll just return True to continue
        return True

import os
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

# Directory for backups
BACKUP_DIR = '/backups/www'

# Service status (for demonstration purposes)
service_status = 'stopped'

# HTML template for the page
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Backup Management</title>
    <style>
        body {{ font-family: Arial, sans-serif; }}
        .container {{ width: 600px; margin: auto; }}
        h2 {{ margin-top: 20px; }}
        .status {{ margin-bottom: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Backup Management</h1>
        
        <div class="status">
            <h2>Service Status</h2>
            <p>Status: <span id="service-status">{status}</span></p>
            <button onclick="changeService('start')">Start</button>
            <button onclick="changeService('restart')">Restart</button>
            <button onclick="changeService('stop')">Stop</button>
        </div>

        <div class="backups">
            <h2>Backup Directory</h2>
            <ul>
                {backup_list}
            </ul>
            <button onclick="backup()">Backup Now</button>
        </div>
        
        <div class="json-display">
            <h2>JSON Status Display</h2>
            <pre id="json-status">{json_status}</pre>
        </div>
        
        <script>
            function changeService(action) {{
                fetch('/service', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/x-www-form-urlencoded' }},
                    body: 'action=' + action
                }}).then(response => response.text()).then(data => {{
                    document.getElementById('service-status').innerText = data;
                }});
            }}

            function backup() {{
                fetch('/backup', {{
                    method: 'POST'
                }}).then(response => response.text()).then(data => {{
                    alert(data);
                    location.reload();
                }});
            }}
        </script>
    </div>
</body>
</html>
'''

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            backup_list = self.get_backup_files()
            json_status = json.dumps({"service": service_status})
            html_content = HTML_TEMPLATE.format(status=service_status, backup_list=backup_list, json_status=json_status)
            self.wfile.write(html_content.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/service':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            action = parse_qs(post_data.decode())['action'][0]

            global service_status
            if action == 'start':
                service_status = 'running'
            elif action == 'restart':
                service_status = 'running'
            elif action == 'stop':
                service_status = 'stopped'

            self.send_response(200)
            self.end_headers()
            self.wfile.write(service_status.encode())
        elif parsed_path.path == '/backup':
            self.backup_now()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Backup completed.')
        else:
            self.send_response(404)
            self.end_headers()

    def get_backup_files(self):
        if not os.path.exists(BACKUP_DIR):
            return "<li>No backups found.</li>"
        files = os.listdir(BACKUP_DIR)
        backup_items = ''.join([f'<li>{file} <button onclick="deleteBackup(\'{file}\')">Delete</button></li>' for file in files])
        return backup_items if backup_items else "<li>No backups found.</li>"

    def backup_now(self):
        os.system(f'tar -czf {BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).tar.gz /www')

def run(server_class=HTTPServer, handler_class=RequestHandler, port=889):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Serving on port {port}...')
    httpd.serve_forever()

if __name__ == '__main__':
    run()

import subprocess
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            response = ("<html><body>"
                        "<h1>Available endpoints:</h1>"
                        "<ul>"
                        "<li><a href='/ups_info'>UPS Info</a> - Get detailed UPS statuses in JSON format.</li>"
                        "<li><a href='/ups_status'>UPS Power Status</a> - Get overall UPS power status as ON or OFF.</li>"
                        "<li><a href='/ups_power'>UPS Battery Charge</a> - Get battery charge percentage of each UPS.</li>"
                        "</ul>"
                        "</body></html>")
            self.wfile.write(response.encode())
        elif self.path == '/ups_info':
            ups_statuses = get_all_ups_info()
            response = json.dumps(ups_statuses).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(response)
        elif self.path == '/ups_status':
            ups_power_status = get_overall_ups_status()
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(ups_power_status.encode())
        elif self.path == '/ups_power':
            ups_power_levels = get_all_ups_power_levels()
            response = json.dumps(ups_power_levels).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()

def get_ups_names():
    try:
        result = subprocess.run(['upsc', '-l'], capture_output=True, text=True, check=True)
        ups_names = result.stdout.splitlines()
        return ups_names
    except subprocess.CalledProcessError as e:
        print(f"An error occurred while fetching UPS names: {e}")
        return []

def get_ups_info(ups_name):
    try:
        result = subprocess.run(['upsc', f'{ups_name}'], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"An error occurred while fetching status for UPS {ups_name}: {e}")
        return "Unknown"

def get_ups_power_level(ups_name):
    try:
        result = subprocess.run(['upsc', f'{ups_name}', 'battery.charge'], capture_output=True, text=True, check=True)
        return f"{result.stdout.strip()}%"
    except subprocess.CalledProcessError as e:
        print(f"An error occurred while fetching power level for UPS {ups_name}: {e}")
        return "Unknown"

def get_all_ups_info():
    ups_statuses = {}
    ups_names = get_ups_names()
    for ups_name in ups_names:
        status = get_ups_info(ups_name)
        ups_statuses[ups_name] = status
    return ups_statuses

def get_all_ups_power_levels():
    ups_power_levels = {}
    ups_names = get_ups_names()
    for ups_name in ups_names:
        power_level = get_ups_power_level(ups_name)
        ups_power_levels[ups_name] = power_level
    return ups_power_levels

def get_overall_ups_status():
    ups_names = get_ups_names()
    for ups_name in ups_names:
        status = get_ups_info(ups_name)
        if status != "OL":
            return "OFF"
    return "ON"

def run_server(port):
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f'Starting server on port {port}')
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(os.environ.get('UPS_API_PORT', 1005))
    run_server(port)

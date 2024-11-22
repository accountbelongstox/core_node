from flask import request as flask_request, jsonify, redirect, url_for
import socket
import struct
import fcntl
from pycore.base.base import Base
from pycore.practicals_linux import flasktool, linux
from apps.deploy.pyscript.monitor.ups_monitor import ups
from apps.deploy.pyscript.monitor.safe_shutdown import safe_shutdown

class FlaskRouter(Base):
    correct_password = "12345678"

    def __init__(self, app, config):
        self.app = app
        self.config = config
        self.setup_routes()

    def setup_routes(self):
        @self.app.route('/', methods=['GET'])
        def index():
            password = flask_request.args.get('p')
            remote_addr = flask_request.remote_addr
            self.success(f"FlaskRouter: Serving index to {remote_addr}")

            response = (f"<html><body>"
                        f"<h1>Available endpoints for {remote_addr}:</h1>"
                        f"<ul>"
                        f"<li><a href='/ups_infos'>Full UPS Info</a> - Get detailed UPS statuses in JSON format.</li>"
                        f"<li><a href='/ups_status'>UPS Status</a> - Get overall UPS power status as ON or OFF.</li>"
                        f"<li><a href='/net'>Network Check</a> - Check network status.</li>"
                        f"<li><a href='/net_status'>Network Status</a> - Get network status.</li>"
                        f"<li><a href='/change_password?username=user&password=pass&p={password}'>Change Password</a> - Change user password (requires root access).</li>"
                        f"<li><a href='/battery_charge'>Battery Charge</a> - Get UPS battery charge.</li>"
                        f"<li><a href='/view_logs?p={password}'>View Logs</a> - View service logs.</li>"
                        f"</ul>"
                        f"</body></html>")

            return response

        @self.app.route('/ups_infos', methods=['GET'])
        def ups_infos():
            ups_infos = ups.get_all_ups_info()
            return jsonify(ups_infos)

        @self.app.route('/ups_status', methods=['GET'])
        def ups_status():
            status_battery = ups.get_overall_ups_status()
            return status_battery

        @self.app.route('/net', methods=['GET'])
        def net():
            overall_status = ups.ping_subnet_and_check_network()
            return jsonify(overall_status)

        @self.app.route('/net_status', methods=['GET'])
        def net_status():
            overall_status = ups.ping_subnet_and_check_network()
            return str(overall_status.get("is_network_up"))

        @self.app.route('/battery_charge', methods=['GET'])
        def battery_charge():
            charge = ups.get_battery_charge()
            return f"{charge}"

        @self.app.route('/change_password', methods=['GET'])
        def change_password():
            password = flask_request.args.get('p')

            if password != self.correct_password:
                return '''
                <html>
                <body>
                    <h2>Password Required</h2>
                    <form action="/" method="get">
                        <label for="p">Password:</label>
                        <input type="password" id="p" name="p">
                        <input type="submit" value="Submit">
                    </form>
                </body>
                </html>
                '''
            username = flask_request.args.get('username')
            password = flask_request.args.get('password')
            remote_ip = flask_request.remote_addr

            if not username or not password:
                return jsonify({
                    "error": "Invalid parameters",
                    "message": "Please provide both 'username' and 'password' as query parameters.",
                    "example_url": "/change_password?username=user&password=pass"
                }), 400

            try:
                local_ip = get_local_ip()
                netmask = get_network_info('eth0')[1]  # Replace 'eth0' with the correct network interface name

                if not is_same_subnet(local_ip, remote_ip, netmask):
                    return jsonify({
                        "error": "Forbidden",
                        "message": "The remote IP is not in the same subnet as the local machine."
                    }), 403

                linux.change_user_password(username, password)
                return jsonify({
                    "success": True,
                    "message": f"Password for user {username} changed successfully."
                })
            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": f"Failed to change password for user {username}. Error: {str(e)}"
                }), 500

        @self.app.route('/view_logs', methods=['GET'])
        def view_logs():
            logs = safe_shutdown.read_log()
            return f"<pre>{logs}</pre>"

        def get_local_ip():
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            return local_ip

        def ip_to_long(ip):
            packed_ip = socket.inet_aton(ip)
            return struct.unpack("!L", packed_ip)[0]

        def get_network_info(ifname):
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            ip = fcntl.ioctl(s.fileno(), 0x8915, struct.pack('256s', ifname[:15].encode('utf-8')))[20:24]
            netmask = fcntl.ioctl(s.fileno(), 0x891b, struct.pack('256s', ifname[:15].encode('utf-8')))[20:24]
            return socket.inet_ntoa(ip), socket.inet_ntoa(netmask)

        def is_same_subnet(ip1, ip2, netmask):
            return (ip_to_long(ip1) & ip_to_long(netmask)) == (ip_to_long(ip2) & ip_to_long(netmask))

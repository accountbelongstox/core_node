import os
import platform
import re
import sys
import subprocess
import configparser
from pycore.base.base import Base
from pycore.utils_linux import plattools
from pycore.globalvar.env import Env
import threading
import getpass

class Linux(Base):
    def __init__(self):
        super().__init__()
        self.firewall_cache = []
        self.sys_type = self.detect_system_type()
        self.shutdown_lock = threading.Lock()

    def detect_system_type(self):
        system = platform.system()
        release = platform.release()
        if system == 'Linux':
            if os.path.exists('/etc/debian_version'):
                return 'debian_ubuntu_remote'
            elif os.path.exists('/etc/redhat-release'):
                if 'CentOS Linux release 7' in open('/etc/redhat-release').read():
                    return 'centos7'
                elif 'CentOS Linux release 8' in open('/etc/redhat-release').read():
                    return 'centos8'
                elif 'CentOS Linux release 9' in open('/etc/redhat-release').read():
                    return 'centos9'
                else:
                    return 'centos'
            elif 'Ubuntu' in platform.platform():
                return 'ubuntu'
            else:
                return 'unknown'
        else:
            return 'unsupported'

    def get_default_firewall(self):
        possible_firewalls = ["ufw", "iptables"]  # Add more as needed
        for firewall in possible_firewalls:
            if self.sys_type == 'debian_ubuntu_remote' or self.sys_type == 'ubuntu':
                result = plattools.exec_cmd(f"sudo systemctl status {firewall}", info=False)
            elif self.sys_type.startswith('centos'):
                result = plattools.exec_cmd(f"sudo systemctl status {firewall}.service", info=False)
            else:
                self.warn(f"Unsupported system: {self.sys_type}")
                return None
            if "Active: active" in result:
                self.firewall_cache.append(firewall)
                self.info(f"{firewall} firewall detected and cached.")

        return self.firewall_cache if self.firewall_cache else None

    def has_ufw_rule(self,rules_list, port, protocol, firewall):
        for rule in rules_list:
            if rule['port'] == port and rule['protocol'] == protocol:
                if firewall == 'ufw':
                    return rule['allow']
                elif firewall == 'iptables':
                    if rule['target'] == 'ACCEPT':
                        return True
                    elif rule['target'] == 'DROP' or rule['target'] == 'REJECT':
                        return False
                    else:
                        return None

        return None

    def get_ufw_rules(self):
        command = "sudo ufw status numbered"
        result = plattools.exec_cmd(command,info=False)
        if result:
            rules = []
            sections = re.split(r'\]', result, maxsplit=1)
            if len(sections) > 1:
                result = sections[1]
            lines = result.splitlines()
            for line in lines:
                line = line.strip()
                if line:
                    parts = line.split(']', maxsplit=1)
                    if len(parts) > 1:
                        line = parts[1].strip()
                    parts = line.split()
                    if len(parts) >= 3:
                        port_proto = parts[0].split('/')
                        port = port_proto[0]
                        proto = port_proto[1] if len(port_proto) > 1 else 'tcp'
                        allow_status = parts[1] == 'ALLOW'
                        from_anywhere = parts[2] in ['Anywhere', 'Anywhere (v6)']
                        rules.append({
                            'port': port,
                            'protocol': proto,
                            'allow': allow_status,
                            'from_anywhere': from_anywhere
                        })
            self.pprint(rules)
            return rules
        else:
            self.warn("Failed to retrieve UFW rules.")
            return []

    def get_iptables_rules(self):
        command = "sudo iptables -L INPUT -n"
        result = plattools.exec_cmd(command,info=False)
        if not result:
            self.warn("Failed to retrieve iptables rules.")
            return []
        rules = []
        sections = result.split('destination')
        if len(sections) > 1:
            result = sections[1]
        lines = result.splitlines()
        for line in lines:
            line = line.strip()
            if line and not line.startswith('Chain'):
                parts = line.split()
                if len(parts) >= 4:
                    protocol = parts[0]
                    target = parts[1]
                    source = parts[3]
                    destination = parts[4]

                    rules.append({
                        'protocol': protocol,
                        'target': target,
                        'source': source,
                        'destination': destination
                    })

        self.pprint(rules)
        return rules


    def shutdown_system(self):
        # Acquire lock to ensure no concurrent shutdowns
        self.shutdown_lock.acquire()
        try:
            # Stop Docker containers first
            docker_stop_cmd = "sudo docker stop $(sudo docker ps -aq)"
            docker_stop_result = plattools.exec_cmd(docker_stop_cmd)
            self.info(docker_stop_result)
            # Determine shutdown command based on system type
            if self.sys_type in ['debian_ubuntu_remote', 'ubuntu']:
                shutdown_cmd = 'sudo shutdown -h now'
            elif self.sys_type.startswith('centos'):
                shutdown_cmd = 'sudo systemctl poweroff'
            else:
                self.warn(f"Unsupported system: {self.sys_type}")
                return
            # Execute system shutdown command
            shutdown_result = plattools.exec_cmd(shutdown_cmd)
            self.info(shutdown_result)
        finally:
            # Release lock after shutdown process completes
            self.shutdown_lock.release()


    def open_port(self, ports, protocol=['tcp', 'udp']):
        if not isinstance(ports, list):
            ports = [ports]

        if not self.firewall_cache:
            self.get_default_firewall()

        if self.firewall_cache:
            results = []
            opened_ports = []
            skipped_ports = []
            messages = []
            firewall_rules = {}

            for firewall in self.firewall_cache:
                if firewall == "ufw":
                    firewall_rules[firewall] = self.get_ufw_rules()
                elif firewall == "iptables":
                    firewall_rules[firewall] = self.get_iptables_rules()

            for firewall in self.firewall_cache:
                for port in ports:
                    port_str_tcp = f"{port}/tcp"
                    port_str_udp = f"{port}/udp"

                    skip_tcp = self.has_ufw_rule(firewall_rules[firewall], port, 'tcp', firewall)
                    skip_udp = self.has_ufw_rule(firewall_rules[firewall], port, 'udp', firewall)

                    if skip_tcp and skip_udp:
                        skipped_ports.append(f"{port} (tcp/udp) ({firewall})")
                        messages.append(f"Skipped {port}/tcp and {port}/udp (already open)")
                    else:
                        # Attempt to open the port
                        if firewall == "ufw":
                            if not skip_tcp and not skip_udp:
                                command_allow = f"sudo ufw allow {port}"
                            elif not skip_tcp:
                                command_allow = f"sudo ufw allow {port_str_tcp}"
                            elif not skip_udp:
                                command_allow = f"sudo ufw allow {port_str_udp}"
                            result_allow = plattools.exec_cmd(command_allow)
                            if result_allow:
                                opened_ports.append(f"{port} (tcp/udp) ({firewall})")
                                messages.append(f"Opened {port}/tcp and {port}/udp using ufw.")
                            else:
                                self.warn(f"Failed to open port {port}/tcp or {port}/udp using ufw.")
                                messages.append(f"Failed to open {port}/tcp or {port}/udp using ufw.")

                        elif firewall == "iptables":
                            if not skip_tcp and not skip_udp:
                                command_allow = f"sudo iptables -A INPUT -p tcp --dport {port} -j ACCEPT && sudo iptables -A INPUT -p udp --dport {port} -j ACCEPT"
                            elif not skip_tcp:
                                command_allow = f"sudo iptables -A INPUT -p tcp --dport {port} -j ACCEPT"
                            elif not skip_udp:
                                command_allow = f"sudo iptables -A INPUT -p udp --dport {port} -j ACCEPT"
                            result_allow = plattools.exec_cmd(command_allow)
                            if result_allow:
                                opened_ports.append(f"{port} (tcp/udp) ({firewall})")
                                messages.append(f"Opened {port}/tcp and/or {port}/udp using iptables.")
                            else:
                                self.warn(f"Failed to open port {port}/tcp or {port}/udp using iptables.")
                                messages.append(f"Failed to open {port}/tcp or {port}/udp using iptables.")
                        else:
                            self.warn(f"Unsupported firewall: {firewall}")

            # Print all accumulated messages
            for message in messages:
                print(message)

            # Reload firewall if any changes were made
            if opened_ports:
                self.success(f"Opened ports: {', '.join(opened_ports)}")
                self.reload_firewall()

            if skipped_ports:
                self.info(f"Skipped ports (already open): {', '.join(skipped_ports)}")

            return results
        else:
            self.warn("No active firewalls detected.")
            return None

    def open_all_ports(self):
        if not self.firewall_cache:
            self.get_default_firewall()

        if self.firewall_cache:
            results = []
            messages = []
            for firewall in self.firewall_cache:
                if firewall == "ufw":
                    command_allow = "sudo ufw default allow incoming"
                    result_allow = plattools.exec_cmd(command_allow)
                    if result_allow:
                        messages.append("All incoming ports opened using ufw.")
                    else:
                        self.warn("Failed to open all ports using ufw.")
                        messages.append("Failed to open all ports using ufw.")

                elif firewall == "iptables":
                    command_allow = "sudo iptables -P INPUT ACCEPT"
                    result_allow = plattools.exec_cmd(command_allow)
                    if result_allow:
                        messages.append("All incoming ports opened using iptables.")
                    else:
                        self.warn("Failed to open all ports using iptables.")
                        messages.append("Failed to open all ports using iptables.")

                else:
                    self.warn(f"Unsupported firewall: {firewall}")

            # Print all accumulated messages
            for message in messages:
                print(message)

            return results
        else:
            self.warn("No active firewalls detected.")
            return None

    def reload_firewall(self):
        if not self.firewall_cache:
            self.get_default_firewall()

        if self.firewall_cache:
            results = []
            for firewall in self.firewall_cache:
                if firewall == "ufw":
                    command = "sudo ufw reload"
                elif firewall == "iptables":
                    command = "sudo iptables-save | sudo iptables-restore"
                else:
                    self.warn(f"Unsupported firewall: {firewall}")
                    continue
                result = plattools.exec_cmd(command)
                self.info(f"Reloaded firewall: {firewall}.")
                results.append(result)
            return results
        else:
            self.warn("No active firewalls detected.")
            return None

    def set_pip_source(self, index_url="https://repo.huaweicloud.com/repository/pypi/simple"):
        pip_conf_path = "/etc/pip.conf"

        # Create directory if it doesn't exist
        pip_conf_dir = os.path.dirname(pip_conf_path)
        if not os.path.exists(pip_conf_dir):
            os.makedirs(pip_conf_dir, exist_ok=True)

        # Read existing pip.conf if it exists
        config = configparser.ConfigParser()
        if os.path.exists(pip_conf_path):
            config.read(pip_conf_path)

        if not config.has_section('global'):
            config.add_section('global')

        if config.has_option('global', 'index-url'):
            current_index_url = config.get('global', 'index-url')
            if current_index_url == index_url:
                self.info(f"Pip index-url is already set to {index_url}")
                return

        config.set('global', 'index-url', index_url)

        # Write to the global pip.conf
        with open(pip_conf_path, 'w', encoding='utf-8') as configfile:
            config.write(configfile)

        self.info(f"Set pip index-url to {index_url}")


    def show_usb_devices(self):
        command = "lsusb"
        result = plattools.exec_cmd(command, info=False)

        if result:
            lines = result.strip().split('\n')
            formatted_output = []
            for line in lines:
                parts = line.split()
                if len(parts) >= 6:
                    bus = parts[1]
                    device = parts[3][:3]
                    device_path = f"/dev/bus/usb/{bus}/{device}"
                    formatted_line = f"{line} {device_path}"
                    formatted_output.append(formatted_line)
                else:
                    formatted_output.append(line)

            for line in formatted_output:
                self.success(line)
        else:
            self.warn("No USB devices found.")

    def allow_ssh_root_login(self):
        ssh_env = Env('/etc/ssh','sshd_config',delimiter=" ")
        changed = False

        if ssh_env.get_env('PasswordAuthentication') != 'yes':
            ssh_env.set_env('PasswordAuthentication', 'yes')
            self.info("Set PasswordAuthentication to 'yes'.")
            changed = True
        else:
            self.info("PasswordAuthentication is already set to 'yes'.")

        # Check and modify PermitRootLogin
        if ssh_env.get_env('PermitRootLogin') != 'no':
            ssh_env.set_env('PermitRootLogin', 'no')
            self.info("Set PermitRootLogin to 'no'.")
            changed = True
        else:
            self.info("PermitRootLogin is already set to 'no'.")

        # If there were changes, restart SSH service
        if changed:
            self.restart_ssh_service()

    def restart_ssh_service(self):
        if self.sys_type in ['debian_ubuntu_remote', 'ubuntu']:
            restart_cmd = 'sudo systemctl restart ssh'
        elif self.sys_type.startswith('centos'):
            restart_cmd = 'sudo systemctl restart sshd'
        else:
            self.warn(f"Unsupported system: {self.sys_type}")
            return

        result = plattools.exec_cmd(restart_cmd)
        if result:
            self.info("SSH service restarted successfully.")
        else:
            self.warn("Failed to restart SSH service.")

    def set_autostart_script(self, script_path=None):
        if not script_path:
            script_path = sys.argv[3] if len(sys.argv) > 3 else None
        print(f"script_path {script_path}")
        if not script_path:
            self.warn("No script path provided and not found in arguments.")
            return

        # Get the script name without path
        script_name = os.path.basename(script_path)

        # Check if script is already set to autostart
        autostart_dir = os.path.expanduser("~/.config/autostart")
        autostart_file = os.path.join(autostart_dir, f"{script_name}.desktop")

        if os.path.exists(autostart_file):
            self.info(f"Script {script_name} is already set to autostart.")
            return

        # Create autostart directory if it doesn't exist
        os.makedirs(autostart_dir, exist_ok=True)

        # Create .desktop file
        desktop_file_content = f"""
        [Desktop Entry]
        Type=Application
        Exec={script_path}
        Hidden=false
        NoDisplay=false
        X-GNOME-Autostart-enabled=true
        Name[en_US]={script_name}
        Name={script_name}
        Comment[en_US]=Start {script_name} on login
        Comment=Start {script_name} on login
        """
        with open(autostart_file, 'w', encoding='utf-8') as desktop_file:
            desktop_file.write(desktop_file_content.strip())

        self.info(f"Script {script_name} set to autostart.")

    def create_service(self, script_path, service_name=None, service_description=None, force_restart=True):
        script_base_name = os.path.basename(script_path)
        default_service_name = os.path.splitext(script_base_name)[0]
        service_name = service_name if service_name else default_service_name
        service_content = f"""
        [Unit]
        Description={service_description if service_description else 'Service to start script'}
        After=network.target

        [Service]
        Type=simple
        ExecStart={script_path}
        Restart=always
        RestartSec=3
        User=root

        [Install]
        WantedBy=multi-user.target
        """

        service_path = f"/etc/systemd/system/{service_name}.service"

        # Check if the service already exists
        if os.path.exists(service_path):
            if force_restart:
                self.info(f"Service {service_name} already exists. Restarting service.")
                try:
                    restart_cmd = f"sudo systemctl restart {service_name}.service"
                    plattools.exec_cmd(restart_cmd)
                    self.info(f"Service {service_name} restarted.")
                except Exception as e:
                    self.warn(f"Failed to restart service: {str(e)}")
            else:
                self.info(f"Service {service_name} already exists. No changes made.")
                return

        # Create or update the service file
        try:
            with open(service_path, 'w', encoding='utf-8') as service_file:
                service_file.write(service_content.strip())
            self.info(f"Service file created or updated at {service_path}")

            # Reload systemd to recognize the new or updated service
            reload_cmd = "sudo systemctl daemon-reload"
            plattools.exec_cmd(reload_cmd)
            self.info("Systemd daemon reloaded.")

            # Enable and start the service
            enable_cmd = f"sudo systemctl enable {service_name}.service"
            start_cmd = f"sudo systemctl start {service_name}.service"
            plattools.exec_cmd(enable_cmd)
            plattools.exec_cmd(start_cmd)
            self.info(f"Service {service_name} enabled and started.")

        except Exception as e:
            self.warn(f"Failed to create or update service: {str(e)}")

    def change_user_password(self, username, password):
        try:
            command = f'echo "{username}:{password}" | sudo chpasswd'
            result = plattools.exec_cmd(command, info=False)
            if result:
                self.info(f"Password for user {username} changed successfully.")
            else:
                self.warn(f"Failed to change password for user {username}.")

        except Exception as e:
            self.warn(f"Failed to change password for user {username}. Exception: {str(e)}")

    def get_user_info(self, username=None):
        if not username:
            username = self.get_username()
        command = f"id {username}"
        result = plattools.exec_cmd(command, info=False)
        if result:
            self.success(f"\nUser info for {username}: {result.strip()}")
        else:
            self.warn(f"\nFailed to retrieve user info for {username}.")

    def get_username(self):
        try:
            username = getpass.getuser()
        except Exception as e:
            username = os.environ.get('USER') or os.environ.get('LOGNAME') or 'Unknown User'
            if username == 'Unknown User':
                self.error('Username: Unknown User')
            else:
                print(f"Username: {username}")
        return username
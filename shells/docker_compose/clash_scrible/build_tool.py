import os
import json
import argparse
import subprocess

class DockerBuildTool:
    def __init__(self):
        self.docker_daemon_file = self.find_docker_daemon_file()
        self.docker_config = self.read_docker_config()
        self.insecure_registry = "192.168.100.6:15000"  # 直接在代码中设置 registry

    def find_docker_daemon_file(self):
        try:
            # Use docker info command to get Docker configuration information
            docker_info = subprocess.check_output(['docker', 'info', '--format', '{{json .}}'])
            info = json.loads(docker_info)
            
            # Get configuration file path from Docker information
            config_file = info.get('DockerRootDir', '')
            if config_file:
                daemon_json = os.path.join(os.path.dirname(config_file), 'daemon.json')
                if os.path.exists(daemon_json):
                    return daemon_json
            
            # If the above method fails, try common locations
            possible_locations = [
                '/etc/docker/daemon.json',
                os.path.expanduser('~/.docker/daemon.json'),
                'C:\\ProgramData\\Docker\\config\\daemon.json'
            ]
            for location in possible_locations:
                if os.path.exists(location):
                    return location
            
            print("Warning: Unable to find daemon.json file.")
            return None
        except subprocess.CalledProcessError:
            print("Error: Unable to execute docker info command. Please ensure Docker is installed and the current user has permission to execute Docker commands.")
            return None
        except json.JSONDecodeError:
            print("Error: Unable to parse Docker information.")
            return None

    def read_docker_config(self):
        if self.docker_daemon_file:
            try:
                with open(self.docker_daemon_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                print(f"Error: {self.docker_daemon_file} is not a valid JSON file.")
            except IOError:
                print(f"Error: Unable to read {self.docker_daemon_file}.")
        return {}

    def check_docker_mirror(self):
        if 'registry-mirrors' in self.docker_config:
            print("Docker mirror is set:")
            for mirror in self.docker_config['registry-mirrors']:
                print(f"  - {mirror}")
        else:
            print("No Docker mirror is set.")

    def build_image(self):
        print("Building Docker image...")
        subprocess.run(["docker", "build", "-t", "clash_subscribe_image", "."])

    def run_container(self):
        print("Running Docker container...")
        subprocess.run([
            "docker", "run", "-d",
            "--name", "clash_subscribe",
            "-p", "18100:18100",
            "-p", "18200:18200",
            "-v", "$(pwd)/.data_cache:/usr/src/app/.data_cache",
            "clash_subscribe_image"
        ])

    def push_image(self):
        print("Pushing Docker image...")
        subprocess.run(["docker", "push", "games129/clash_subscribe:latest"])

    def set_insecure_registry(self):
        if not self.docker_daemon_file:
            print("Error: Docker daemon file not found. Cannot set insecure registry.")
            return

        config = self.docker_config
        if 'insecure-registries' not in config:
            config['insecure-registries'] = []

        if self.insecure_registry not in config['insecure-registries']:
            config['insecure-registries'].append(self.insecure_registry)
            try:
                with open(self.docker_daemon_file, 'w') as f:
                    json.dump(config, f, indent=2)
                print(f"Added {self.insecure_registry} to insecure-registries.")
                print("Please restart Docker for the changes to take effect.")
            except IOError:
                print(f"Error: Unable to write to {self.docker_daemon_file}.")
        else:
            print(f"{self.insecure_registry} is already in insecure-registries.")

        print("Current insecure-registries:")
        for reg in config['insecure-registries']:
            print(f"  - {reg}")

def main():
    parser = argparse.ArgumentParser(description="Docker Build Tool")
    parser.add_argument('action', nargs='?', choices=['build', 'run', 'push', 'check_mirror', 'set_registry'],
                        help='Action to perform: build, run, push, check_mirror, or set_registry')

    args = parser.parse_args()

    tool = DockerBuildTool()

    if args.action == 'build':
        tool.build_image()
    elif args.action == 'run':
        tool.run_container()
    elif args.action == 'push':
        tool.push_image()
    elif args.action == 'check_mirror':
        tool.check_docker_mirror()
    elif args.action == 'set_registry':
        tool.set_insecure_registry()
    else:
        print("Please specify an action: build, run, push, check_mirror, or set_registry")
        print("Usage examples:")
        print("  python build_tool.py build")
        print("  python build_tool.py run")
        print("  python build_tool.py push")
        print("  python build_tool.py check_mirror")
        print("  python build_tool.py set_registry")

if __name__ == "__main__":
    main()

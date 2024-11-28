import os
import subprocess
import threading
import configparser
from pycore.base.base import Base
from pycore.utils_linux import plattools
from pycore.globalvar.env import Env

class Docker(Base):
    def __init__(self):
        super().__init__()
        self.env = Env()

    def get_all_docker_containers(self):
        """Get all Docker containers and return as a dictionary."""
        containers = {}
        cmd = "docker ps -a --format '{{.ID}}:{{.Names}}:{{.Status}}'"
        output = plattools.exec_cmd(cmd)
        for line in output.split('\n'):
            parts = line.split(':')
            if len(parts) == 3:
                container_id, name, status = parts
                containers[container_id] = {'name': name, 'status': status}
        return containers

    def get_stopped_containers(self):
        """Get all stopped Docker containers and print them."""
        containers = self.get_all_docker_containers()
        stopped_containers = {cid: info for cid, info in containers.items() if 'Exited' in info['status']}
        if stopped_containers:
            print("Stopped containers:")
            for cid, info in stopped_containers.items():
                print(f"Container ID: {cid}, Name: {info['name']}, Status: {info['status']}")
        else:
            print("No stopped containers found.")
        return stopped_containers

    def start_stopped_containers(self):
        """Start all stopped Docker containers and print logs."""
        stopped_containers = self.get_stopped_containers()
        if not stopped_containers:
            print("No stopped containers to start.")
            return

        for cid, info in stopped_containers.items():
            cmd = f"docker start {cid}"
            print(f"Starting container {info['name']} (ID: {cid})...")
            output = plattools.exec_cmd(cmd)
            print(f"Start log for container {info['name']} (ID: {cid}):")
            print(output)

import os
import time
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from pycore.utils_linux import plattools, mail
from pycore.base.base import Base

class AntiVirus(Base, FileSystemEventHandler):
    def __init__(self, watch_paths=["/www/wwwroot"], log_dir="/home/"):
        super().__init__()
        self.watch_paths = watch_paths
        self.log_dir = log_dir
        self.encrypted_files = self.scan_encrypted_files()
        self.log_file_path = self.get_log_file_path()
        self.log_encrypted_files()
        self.observer = None

    def get_log_file_path(self):
        current_time = datetime.now().strftime("%Y_%m_%d_%H")
        return os.path.join(self.log_dir, f"anti_virus_logfile_{current_time}")

    def scan_encrypted_files(self):
        encrypted_files = []
        for path in self.watch_paths:
            for root, dirs, files in os.walk(path):
                for file in files:
                    if file.endswith(".encrypted"):
                        encrypted_files.append(os.path.join(root, file))
        return encrypted_files

    def log_encrypted_files(self):
        with open(self.log_file_path, "a") as log:
            log.write(f"Initial scan at {time.ctime()}: {len(self.encrypted_files)} encrypted files found.\n")
            for file in self.encrypted_files:
                log.write(f"{file}\n")

    def on_created(self, event):
        if event.is_directory:
            return
        print(f"New file created: {event.src_path}")
        htop_output = plattools.exe_cmd(['htop', '-s', 'PERCENT_CPU'])
        cpu_usage_data = self.parse_htop_output(htop_output)
        self.print_cpu_usage(cpu_usage_data)
        self.tick()

        # Organize email content
        new_files = [event.src_path]
        email_content = (
            f"New encrypted files detected.\n\n"
            f"New files: {', '.join(new_files) if new_files else 'None'}\n"
            f"Timestamp: {time.ctime()}\n\n"
            f"HTOP Info:\n{htop_output}"
        )
        # Send email
        mail.Mail().send_default_email("New Encrypted Files Detected", email_content)

    def tick(self):
        current_encrypted_files = self.scan_encrypted_files()
        new_files = set(current_encrypted_files) - set(self.encrypted_files)
        removed_files = set(self.encrypted_files) - set(current_encrypted_files)

        if new_files or removed_files:
            change = len(new_files) - len(removed_files)
            self.log_file_path = self.get_log_file_path()  # 更新日志文件路径，每小时旋转日志
            with open(self.log_file_path, "a") as log:
                log.write(f"Tick at {time.ctime()}: {len(current_encrypted_files)} encrypted files found.\n")
                log.write(f"Change: {change} files.\n")
                if new_files:
                    log.write(f"New files: {', '.join(new_files)}\n")
                if removed_files:
                    log.write(f"Removed files: {', '.join(removed_files)}\n")

        self.encrypted_files = current_encrypted_files

    def parse_htop_output(self, htop_output):
        lines = htop_output.strip().split('\n')
        data = []
        for line in lines:
            parts = line.split()
            if len(parts) > 0 and parts[0].isdigit() and float(parts[8]) > 0:  # Assuming the CPU usage is in the 9th column
                data.append({
                    'pid': parts[0],
                    'user': parts[1],
                    'cpu': parts[8],
                    'command': ' '.join(parts[11:])
                })
        return data

    def print_cpu_usage(self, cpu_usage_data):
        print("Processes with CPU usage > 0:")
        for entry in cpu_usage_data:
            print(f"PID: {entry['pid']}, User: {entry['user']}, CPU: {entry['cpu']}%, Command: {entry['command']}")

    def start(self, watch_paths=None, log_dir=None):
        if self.observer is not None:
            print("Already started, operation ignored.")
            return
        if watch_paths:
            self.watch_paths = watch_paths
        if log_dir:
            self.log_dir = log_dir
        event_handler = self
        self.observer = Observer()
        for path in self.watch_paths:
            self.observer.schedule(event_handler, path, recursive=True)
        self.observer.start()
        print("Monitoring started.")

    def stop(self):
        if self.observer is None:
            print("Not running.")
            return
        self.observer.stop()
        self.observer.join()
        self.observer = None
        print("Monitoring stopped.")

anti_virus = AntiVirus()

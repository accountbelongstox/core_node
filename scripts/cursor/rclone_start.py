import os
import subprocess
import threading
import time
from collections import deque
from colorama import Fore, Style, init

# Initialize colorama for colored output
init(autoreset=True)

class ConsoleDisplay:
    def __init__(self, max_lines=15):
        self.header = []
        self.middle = deque(maxlen=max_lines)
        self.footer = [
            "[ Control Panel ]",
            "Ctrl+C: Exit program"
        ]
        self.lock = threading.Lock()
        self.last_height = 0

    def _clear_screen(self):
        print("\033[2J\033[H", end="")  # ANSI escape codes for clear screen

    def _print_section(self, lines, color=Fore.WHITE):
        for line in lines:
            print(f"{color}{line}")
        print(Style.RESET_ALL)

    def update_display(self):
        with self.lock:
            # Calculate needed space
            total_lines = len(self.header) + len(self.middle) + len(self.footer)
            # Clear previous output
            self._clear_screen()
            
            # Header section
            self._print_section(self.header, Fore.CYAN)
            print("-" * 50)
            
            # Middle section
            self._print_section(self.middle, Fore.MAGENTA)
            print("-" * 50)
            
            # Footer section
            self._print_section(self.footer, Fore.YELLOW)
            
            # Track display height for next clear
            self.last_height = total_lines + 4  # Add separator lines

class RcloneService:
    def __init__(self):
        self._process = None
        self._worker_thread = None
        self._stop_flag = threading.Event()
        self._command = self._build_mount_command()
        self.display = ConsoleDisplay()
        self._validate_environment()
        
        # Initialize header
        self.display.header = [
            "Rclone Mount Service".center(50),
            f"Status: {'INITIALIZING':<15} Mount Path: {self._parse_mount_path()}"
        ]

    def _build_mount_command(self):
        exe_path = r"D:\lang_compiler\environments\rclone.exe"
        mount_point = r"D:\programing\ftp-199-dict-server-client"
        return fr'{exe_path} mount ftp-199-dict-server-client: "{mount_point}" --vfs-cache-mode writes'

    def _parse_mount_path(self):
        return self._command.split('"')[1]

    def _validate_environment(self):
        if not os.path.exists(self._command.split()[0]):
            raise FileNotFoundError("Rclone executable missing")

    def _execute_with_realtime_output(self):
        try:
            self._process = subprocess.Popen(
                self._command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                encoding='utf-8',
                errors='replace'
            )

            while not self._stop_flag.is_set():
                line = self._process.stdout.readline()
                if line:
                    self._add_middle_line(f"[PROCESS] {line.strip()}")
                time.sleep(0.1)

        except Exception as e:
            self._add_middle_line(f"Execution error: {str(e)}", Fore.RED)
        finally:
            self._cleanup_process()

    def _add_middle_line(self, text, color=Fore.MAGENTA):
        with self.display.lock:
            self.display.middle.append(f"{color}{text}")

    def _cleanup_process(self):
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
            self._process = None

    def _update_header_status(self, status):
        self.display.header[1] = f"Status: {status:<15} Mount Path: {self._parse_mount_path()}"

    def start_worker(self):
        """Start the rclone service worker"""
        self._stop_flag.clear()
        self._worker_thread = threading.Thread(
            target=self._execute_with_realtime_output,
            daemon=True
        )
        self._worker_thread.start()
        self._update_header_status("RUNNING")
        self._add_middle_line("Worker started", Fore.GREEN)

    def stop_worker(self):
        """Stop the rclone service worker"""
        self._stop_flag.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=10)
        self._cleanup_process()
        self._update_header_status("STOPPED")
        self._add_middle_line("Worker stopped", Fore.YELLOW)

    def run(self):
        """Main control loop"""
        self.start_worker()

        try:
            while True:
                self.display.update_display()
                time.sleep(0.5)  # 更快的刷新频率
        except KeyboardInterrupt:
            self.stop_worker()
            self._update_header_status("SHUTDOWN")
            self.display.update_display()

if __name__ == "__main__":
    service = RcloneService()
    service.run()

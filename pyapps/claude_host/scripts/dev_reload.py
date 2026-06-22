"""Development hot-reload wrapper for claude_host.

Watches pyapps/claude_host for *.py changes and auto-restarts the app.
Must be run from the core_node root directory.

Usage:
    python -u pyapps/claude_host/scripts/dev_reload.py
"""
import subprocess
import sys
import time
from pathlib import Path

WATCH_DIR = Path("pyapps/claude_host")
APP_CMD = [sys.executable, "-u", "pymain.py", "app=claude_host"]

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("[dev-reload] watchdog not found. Installing...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-q", "watchdog>=4.0"]
    )
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler


class ReloadHandler(FileSystemEventHandler):
    def __init__(self):
        self.process = None
        self._last_restart = 0
        self.start_process()

    def start_process(self):
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        print("[dev-reload] Starting claude_host...")
        self.process = subprocess.Popen(APP_CMD)
        self._last_restart = time.time()

    def on_modified(self, event):
        if not event.src_path.endswith(".py"):
            return
        # Debounce: ignore events within 1 second of last restart
        if time.time() - self._last_restart < 1.0:
            return
        print(f"\n[dev-reload] File changed: {event.src_path}")
        print("[dev-reload] Restarting claude_host...\n")
        self.start_process()

    def on_created(self, event):
        self.on_modified(event)


def main():
    if not WATCH_DIR.is_dir():
        print(f"[dev-reload] ERROR: {WATCH_DIR} not found. Run from core_node root.")
        sys.exit(1)

    print(f"[dev-reload] Watching {WATCH_DIR} for *.py changes...")
    print("[dev-reload] Press Ctrl+C to stop.\n")

    handler = ReloadHandler()
    observer = Observer()
    observer.schedule(handler, str(WATCH_DIR), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
            # If the child process exited unexpectedly, restart it
            if handler.process and handler.process.poll() is not None:
                code = handler.process.returncode
                print(f"\n[dev-reload] Process exited with code {code}. Restarting in 2s...")
                time.sleep(2)
                handler.start_process()
    except KeyboardInterrupt:
        print("\n[dev-reload] Shutting down...")
        observer.stop()
        if handler.process:
            handler.process.terminate()
            try:
                handler.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                handler.process.kill()
    observer.join()


if __name__ == "__main__":
    main()

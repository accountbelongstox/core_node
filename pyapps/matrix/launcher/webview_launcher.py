"""
PyMatrix WebView Launcher

Uses webview to display Nuxt frontend in a window
"""

import subprocess
import time
import threading
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.third_party import requests, webview

WEBVIEW_AVAILABLE = True

from ..config import Config


class PyMatrixLauncher:
    """
    PyMatrix Launcher

    Features:
    1. Start Python FastAPI backend
    2. Start Nuxt frontend (pnpm dev)
    3. Display frontend in webview window
    """

    def __init__(self):
        self.backend_process: Optional[subprocess.Popen] = None
        self.frontend_process: Optional[subprocess.Popen] = None
        self.window = None

    def start_backend(self) -> bool:
        """
        Start FastAPI backend

        Returns:
            Whether startup was successful
        """
        try:
            print("Starting Python backend...")

            # Start FastAPI service
            main_py = Path(__file__).parent.parent / "main.py"

            self.backend_process = subprocess.Popen(
                ["python", str(main_py), "--no-launcher"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Wait for backend to start
            for i in range(30):
                try:
                    response = requests.get(
                        f"http://{Config.WEB_HOST}:{Config.WEB_PORT}/health",
                        timeout=1
                    )
                    if response.status_code == 200:
                        print(f"✓ Backend started successfully: http://{Config.WEB_HOST}:{Config.WEB_PORT}")
                        return True
                except:
                    pass
                time.sleep(1)

            print("✗ Backend startup timeout")
            return False

        except Exception as e:
            print(f"✗ Backend startup failed: {e}")
            return False

    def start_frontend(self) -> bool:
        """
        Start Nuxt frontend

        Returns:
            Whether startup was successful
        """
        try:
            print("Starting Nuxt frontend...")

            frontend_dir = Config.FRONTEND_DIR

            if not frontend_dir.exists():
                print(f"✗ Frontend directory does not exist: {frontend_dir}")
                return False

            # Set environment variables
            import os
            env = os.environ.copy()
            env["APP_ENTRY"] = "pymatrix"

            # Start pnpm dev
            self.frontend_process = subprocess.Popen(
                ["pnpm", "dev"],
                cwd=str(frontend_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=True  # Windows requires shell=True
            )

            # Wait for frontend to start
            print("Waiting for frontend to start...")
            for i in range(60):  # Wait up to 60 seconds
                try:
                    response = requests.get(Config.FRONTEND_URL, timeout=1)
                    if response.status_code in [200, 304]:
                        print(f"✓ Frontend started successfully: {Config.FRONTEND_URL}")
                        return True
                except:
                    pass
                time.sleep(1)

            print("✗ Frontend startup timeout")
            return False

        except Exception as e:
            print(f"✗ Frontend startup failed: {e}")
            return False

    def open_webview(self):
        """Open frontend in webview window"""
        if not WEBVIEW_AVAILABLE:
            print("pywebview not installed, opening in browser...")
            import webbrowser
            webbrowser.open(Config.FRONTEND_URL)
            return

        try:
            print("Opening WebView window...")

            # Create webview window
            self.window = webview.create_window(
                title="pyMatrix - Device Control",
                url=Config.FRONTEND_URL,
                width=1400,
                height=900,
                resizable=True,
                fullscreen=False,
                min_size=(1200, 800)
            )

            # Start webview (blocks until window closes)
            webview.start()

        except Exception as e:
            print(f"WebView startup failed: {e}")
            print("Falling back to browser...")
            import webbrowser
            webbrowser.open(Config.FRONTEND_URL)

    def stop(self):
        """Stop all processes"""
        print("\nStopping services...")

        if self.frontend_process:
            print("Stopping frontend process...")
            self.frontend_process.terminate()
            try:
                self.frontend_process.wait(timeout=5)
            except:
                self.frontend_process.kill()

        if self.backend_process:
            print("Stopping backend process...")
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except:
                self.backend_process.kill()

        print("✓ All services stopped")

    def run(self):
        """
        Run launcher

        Process:
        1. Start backend
        2. Start frontend
        3. Open webview
        4. Wait for window to close
        5. Stop all services
        """
        try:
            # 1. Start backend
            if not self.start_backend():
                print("Backend startup failed, exiting...")
                return

            # 2. Start frontend
            if not self.start_frontend():
                print("Frontend startup failed, exiting...")
                self.stop()
                return

            # 3. Open webview
            self.open_webview()

            # webview.start() is blocking, execution continues after window closes

        except KeyboardInterrupt:
            print("\nReceived interrupt signal...")

        finally:
            # 4. Stop all services
            self.stop()


def main():
    """Launcher entry point"""
    launcher = PyMatrixLauncher()
    launcher.run()


if __name__ == '__main__':
    main()

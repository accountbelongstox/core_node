"""Frontend Controller

Manages Nuxt frontend lifecycle for Matrix application
"""

import os
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint


class FrontendController:
    """
    Frontend Controller

    Manages Nuxt frontend lifecycle:
    - Switch app entry point (index.vue)
    - Mirror project to factory directory
    - Start development server
    - Health check monitoring
    """

    def __init__(self, project_root: Optional[Path] = None, frontend_port: int = 3007):
        """
        Initialize frontend controller

        Args:
            project_root: Project root directory
            frontend_port: Frontend server port
        """
        if project_root is None:
            # Auto-detect: pyapps/matrix -> core_node
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.frontend_port = frontend_port
        self.frontend_url = f"http://localhost:{frontend_port}"

        self.nuxt_main_dir = self.project_root / "poly_apps" / "nuxt_main"
        self.scripts_dir = self.nuxt_main_dir / "scripts"

        # Scripts
        self.switch_entry_script = self.scripts_dir / "switch-app-entry.js"
        self.switch_plus_script = self.scripts_dir / "switch-app-entry-plus.js"

        # State
        self.running = False
        self.ready = False
        self.process: Optional[subprocess.Popen] = None
        self.temp_script: Optional[Path] = None

    def validate_paths(self) -> bool:
        """Validate required paths exist"""
        if not self.nuxt_main_dir.exists():
            ColorPrint.red(f"Nuxt directory not found: {self.nuxt_main_dir}")
            return False

        if not self.switch_entry_script.exists():
            ColorPrint.red(f"Script not found: {self.switch_entry_script}")
            return False

        if not self.switch_plus_script.exists():
            ColorPrint.red(f"Script not found: {self.switch_plus_script}")
            return False

        return True

    def switch_entry_point(self) -> bool:
        """
        Switch app entry point (Step 1)

        Executes: node switch-app-entry.js pymatrix
        Synchronously switches index.vue to pymatrix

        Returns:
            True if successful
        """
        ColorPrint.green("[FrontendController] Step 1: Switching entry point...")
        ColorPrint.gray(f"Command: node \"{self.switch_entry_script}\" pymatrix")

        try:
            result = subprocess.run(
                ["node", str(self.switch_entry_script), "pymatrix"],
                cwd=str(self.nuxt_main_dir),
                capture_output=True,
                text=True,
                encoding='utf-8'
            )

            if result.returncode != 0:
                ColorPrint.red(f"[ERROR] Failed to switch entry point:")
                ColorPrint.red(result.stderr)
                return False

            # Print output
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    ColorPrint.white(f"  {line}")

            ColorPrint.green("[SUCCESS] Entry point switched")
            return True

        except Exception as e:
            ColorPrint.red(f"[ERROR] Exception during entry point switch: {e}")
            import traceback
            traceback.print_exc()
            return False

    def start_factory_sync(self) -> bool:
        """
        Start factory sync and dev server (Step 2)

        Executes: node switch-app-entry-plus.js pymatrix --mode dev
        Asynchronously starts factory sync and Nuxt dev server in new console

        Returns:
            True if started successfully
        """
        ColorPrint.green("[FrontendController] Step 2: Starting factory sync and dev server...")
        ColorPrint.gray(f"Command: node \"{self.switch_plus_script}\" pymatrix --mode dev")

        try:
            import platform

            if platform.system() == 'Windows':
                # Create temporary batch script for new console window
                fd, temp_script_path = tempfile.mkstemp(suffix='.bat', text=True)
                self.temp_script = Path(temp_script_path)

                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write('@echo off\n')
                    f.write('title Matrix Frontend - Factory Sync\n')
                    f.write(f'cd /d "{self.nuxt_main_dir}"\n')
                    f.write(f'node "{self.switch_plus_script}" pymatrix --mode dev\n')
                    f.write('echo.\n')
                    f.write('echo Frontend process ended. Press any key to close...\n')
                    f.write('pause > nul\n')

                # Launch in new console window
                self.process = subprocess.Popen(
                    str(self.temp_script),
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    shell=True
                )

            else:
                # Linux: Launch in background
                self.process = subprocess.Popen(
                    ["node", str(self.switch_plus_script), "pymatrix", "--mode", "dev"],
                    cwd=str(self.nuxt_main_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            self.running = True
            ColorPrint.green("[SUCCESS] Factory sync launched")
            return True

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to start factory sync: {e}")
            import traceback
            traceback.print_exc()
            return False

    def wait_for_ready(self, timeout: int = 120, check_interval: int = 2) -> bool:
        """
        Wait for frontend to become ready

        Args:
            timeout: Maximum wait time in seconds
            check_interval: Time between checks in seconds

        Returns:
            True if frontend is ready
        """
        import requests

        ColorPrint.yellow(f"[FrontendController] Waiting for frontend: {self.frontend_url}")
        ColorPrint.white(f"Timeout: {timeout}s | Check interval: {check_interval}s")
        ColorPrint.white("")

        elapsed = 0
        dots = 0

        while elapsed < timeout:
            try:
                response = requests.get(self.frontend_url, timeout=2)
                if response.status_code == 200:
                    ColorPrint.white("")
                    ColorPrint.green(f"[SUCCESS] Frontend ready at {self.frontend_url}")
                    self.ready = True
                    return True
            except:
                pass

            # Print progress
            dots = (dots + 1) % 4
            print(f"\r[WAITING] Connecting{'.' * dots}{' ' * (3 - dots)}", end='', flush=True)

            time.sleep(check_interval)
            elapsed += check_interval

        ColorPrint.white("")
        ColorPrint.red(f"[ERROR] Frontend did not start within {timeout} seconds")
        return False

    def start(self) -> bool:
        """
        Start frontend (full flow)

        Returns:
            True if started successfully
        """
        if not self.validate_paths():
            return False

        # Step 1: Switch entry point
        if not self.switch_entry_point():
            return False

        # Step 2: Start factory sync
        if not self.start_factory_sync():
            return False

        return True

    def start_and_wait(self, timeout: int = 120) -> bool:
        """
        Start frontend and wait for ready

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            True if started and ready
        """
        if not self.start():
            return False

        return self.wait_for_ready(timeout=timeout)

    def stop(self):
        """Stop frontend"""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except:
                self.process.kill()

        if self.temp_script and self.temp_script.exists():
            try:
                os.remove(self.temp_script)
            except:
                pass

        self.running = False
        self.ready = False
        ColorPrint.yellow("[FrontendController] Frontend stopped")

    def is_running(self) -> bool:
        """Check if frontend is running"""
        return self.running

    def is_ready(self) -> bool:
        """Check if frontend is ready"""
        return self.ready

    def get_url(self) -> str:
        """Get frontend URL"""
        return self.frontend_url

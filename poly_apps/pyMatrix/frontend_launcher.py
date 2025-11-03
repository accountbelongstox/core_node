"""Frontend launcher module for pyMatrix"""

# Setup path
try:
    from . import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import os
import subprocess
import tempfile
import asyncio
from pathlib import Path
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint


class FrontendLauncher:
    """
    Frontend launcher for pyMatrix

    Responsibilities:
    - Generate Windows batch script to launch frontend
    - Launch frontend in non-blocking manner using explorer
    - Wait for frontend connection via health check endpoint
    - Provide connection status updates
    """

    def __init__(self, project_root: Optional[Path] = None):
        """
        Initialize frontend launcher

        Args:
            project_root: Project root directory (defaults to auto-detect)
        """
        if project_root is None:
            # Auto-detect: poly_apps/pyMatrix -> core_node
            self.project_root = Path(__file__).parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.nuxt_main_dir = self.project_root / "poly_apps" / "nuxt_main"
        self.package_json = self.nuxt_main_dir / "package.json"
        self.batch_script: Optional[Path] = None

    def validate_paths(self) -> bool:
        """
        Validate that required paths exist

        Returns:
            True if paths are valid
        """
        if not self.nuxt_main_dir.exists():
            ColorPrint.red(f"Nuxt main directory not found: {self.nuxt_main_dir}")
            return False

        if not self.package_json.exists():
            ColorPrint.red(f"package.json not found: {self.package_json}")
            return False

        return True

    def get_start_script_path(self) -> Path:
        """
        Get path to the start.ps1 script

        Returns:
            Path to the start.ps1 script
        """
        scripts_dir = self.nuxt_main_dir / "scripts"
        start_script = scripts_dir / "start.ps1"

        if not start_script.exists():
            ColorPrint.red(f"Start script not found: {start_script}")
            return None

        return start_script

    def launch_frontend(self) -> subprocess.Popen:
        """
        Launch frontend using PowerShell start.ps1 script with direct output capture

        Returns:
            subprocess.Popen object or None
        """
        try:
            if not self.validate_paths():
                return None

            # Get start.ps1 script path
            start_script = self.get_start_script_path()
            if not start_script:
                return None

            # Launch PowerShell with start.ps1 script (pymatrix in debug mode)
            ColorPrint.blue("Starting frontend with PowerShell start.ps1...")
            ColorPrint.blue(f"Command: powershell.exe -ExecutionPolicy Bypass -File {start_script} pymatrix debug")

            process = subprocess.Popen(
                [
                    'powershell.exe',
                    '-ExecutionPolicy', 'Bypass',
                    '-File', str(start_script),
                    'pymatrix',
                    'debug'
                ],
                cwd=str(self.nuxt_main_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                encoding='utf-8',
                errors='replace'
            )

            # Start a thread to print output
            def print_output():
                try:
                    for line in process.stdout:
                        print(f"[Frontend] {line.rstrip()}")
                except UnicodeDecodeError as e:
                    ColorPrint.yellow(f"[Frontend] Warning: Unicode decode error: {e}")
                except Exception as e:
                    ColorPrint.red(f"[Frontend] Error reading output: {e}")

            import threading
            threading.Thread(target=print_output, daemon=True).start()

            ColorPrint.green(f"Frontend process started (PID: {process.pid})")
            self.batch_script = None  # No batch script used
            return process

        except Exception as e:
            ColorPrint.red(f"Failed to launch frontend: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def wait_for_frontend_connection(
        self,
        frontend_url: str = "http://localhost:3007",
        timeout: int = 120,
        check_interval: int = 2
    ) -> bool:
        """
        Wait for frontend to become available

        Args:
            frontend_url: Frontend URL to check (default: http://localhost:3007 for pymatrix)
            timeout: Maximum wait time in seconds
            check_interval: Time between checks in seconds

        Returns:
            True if frontend connected successfully
        """
        import requests

        ColorPrint.blue(f"Waiting for frontend to start at {frontend_url}...")
        ColorPrint.blue(f"Timeout: {timeout}s, checking every {check_interval}s")

        elapsed = 0
        dots = 0

        while elapsed < timeout:
            try:
                # Try root path first (Nuxt dev server)
                response = requests.get(
                    frontend_url,
                    timeout=2
                )
                if response.status_code == 200:
                    ColorPrint.green(f"\n✓ Frontend connected successfully at {frontend_url}")
                    return True

            except (requests.RequestException, Exception):
                # Frontend not ready yet
                pass

            # Print progress dots
            dots = (dots + 1) % 4
            print(f"\rWaiting{'.' * dots}{' ' * (3 - dots)}", end='', flush=True)

            await asyncio.sleep(check_interval)
            elapsed += check_interval

        ColorPrint.red(f"\n✗ Frontend did not start within {timeout} seconds")
        ColorPrint.yellow("You can manually start the frontend:")
        ColorPrint.yellow(f"  cd {self.nuxt_main_dir}\\scripts")
        ColorPrint.yellow("  .\\start.ps1 pymatrix")
        return False

    def cleanup(self):
        """Clean up temporary batch script"""
        if self.batch_script and self.batch_script.exists():
            try:
                os.remove(self.batch_script)
                ColorPrint.blue(f"Cleaned up batch script: {self.batch_script}")
            except Exception as e:
                ColorPrint.yellow(f"Failed to clean up batch script: {e}")

    async def launch_and_wait(
        self,
        frontend_url: str = "http://localhost:3007",
        timeout: int = 120
    ) -> bool:
        """
        Launch frontend and wait for connection

        Args:
            frontend_url: Frontend URL to check (default: http://localhost:3007 for pymatrix)
            timeout: Maximum wait time in seconds

        Returns:
            True if frontend launched and connected successfully
        """
        print("=" * 60)
        ColorPrint.blue("pyMatrix Frontend Launcher")
        print("=" * 60)

        # Launch frontend
        process = self.launch_frontend()
        if not process:
            return False

        print()

        # Wait for connection
        connected = await self.wait_for_frontend_connection(
            frontend_url=frontend_url,
            timeout=timeout
        )

        if connected:
            print()
            print("=" * 60)
            ColorPrint.green("Frontend and Backend are ready!")
            print("=" * 60)
            ColorPrint.blue(f"Frontend: {frontend_url}")
            ColorPrint.blue("Backend:  http://0.0.0.0:8000/api")
            ColorPrint.blue("API Docs: http://0.0.0.0:8000/docs")
            print("=" * 60)

        return connected


async def launch_frontend_with_wait(
    project_root: Optional[Path] = None,
    frontend_url: str = "http://localhost:3007",
    timeout: int = 120
) -> bool:
    """
    Convenience function to launch frontend and wait for connection

    Args:
        project_root: Project root directory
        frontend_url: Frontend URL to check (default: http://localhost:3007 for pymatrix)
        timeout: Maximum wait time in seconds

    Returns:
        True if successful
    """
    launcher = FrontendLauncher(project_root)
    try:
        return await launcher.launch_and_wait(frontend_url, timeout)
    finally:
        launcher.cleanup()


# For testing
if __name__ == "__main__":
    import asyncio

    async def test_launcher():
        success = await launch_frontend_with_wait()
        if success:
            print("\n[TEST] Launcher test passed!")
        else:
            print("\n[TEST] Launcher test failed!")

    asyncio.run(test_launcher())

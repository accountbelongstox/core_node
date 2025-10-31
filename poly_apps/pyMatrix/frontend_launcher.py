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

    def create_batch_script(self) -> Path:
        """
        Create temporary Windows batch script to launch frontend

        Returns:
            Path to the created batch script
        """
        # Create batch script content
        batch_content = f"""@echo off
cd /d "{self.nuxt_main_dir}"
echo Starting pyMatrix frontend...
echo Working directory: %CD%
echo.

REM Check if yarn is available
where yarn >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] yarn is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] node_modules not found, running yarn install...
    yarn install
)

REM Launch dev:pymatrix
echo Running: yarn dev:pymatrix
yarn dev:pymatrix

pause
"""

        # Create temporary batch file
        temp_dir = Path(tempfile.gettempdir())
        batch_file = temp_dir / "pymatrix_frontend_launcher.bat"

        with open(batch_file, 'w', encoding='utf-8') as f:
            f.write(batch_content)

        self.batch_script = batch_file
        ColorPrint.blue(f"Created batch script: {batch_file}")
        return batch_file

    def launch_frontend(self) -> bool:
        """
        Launch frontend using Windows explorer (non-blocking)

        Returns:
            True if launch successful
        """
        try:
            if not self.validate_paths():
                return False

            # Create batch script
            batch_file = self.create_batch_script()

            # Launch using explorer (opens in new window, non-blocking)
            ColorPrint.blue("Launching frontend in new window...")
            subprocess.Popen(['explorer', str(batch_file)], shell=False)

            ColorPrint.green(f"Frontend launcher started: {batch_file}")
            ColorPrint.blue("Frontend will start in a new command window")
            return True

        except Exception as e:
            ColorPrint.red(f"Failed to launch frontend: {e}")
            return False

    async def wait_for_frontend_connection(
        self,
        frontend_url: str = "http://localhost:3000",
        timeout: int = 120,
        check_interval: int = 2
    ) -> bool:
        """
        Wait for frontend to become available

        Args:
            frontend_url: Frontend URL to check
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
                response = requests.get(
                    f"{frontend_url}/pymatrix",
                    timeout=2
                )
                if response.status_code == 200:
                    ColorPrint.green(f"\n✓ Frontend connected successfully at {frontend_url}/pymatrix")
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
        ColorPrint.yellow(f"  cd {self.nuxt_main_dir}")
        ColorPrint.yellow("  yarn dev:pymatrix")
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
        frontend_url: str = "http://localhost:3000",
        timeout: int = 120
    ) -> bool:
        """
        Launch frontend and wait for connection

        Args:
            frontend_url: Frontend URL to check
            timeout: Maximum wait time in seconds

        Returns:
            True if frontend launched and connected successfully
        """
        print("=" * 60)
        ColorPrint.blue("pyMatrix Frontend Launcher")
        print("=" * 60)

        # Launch frontend
        if not self.launch_frontend():
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
            ColorPrint.blue(f"Frontend: {frontend_url}/pymatrix")
            ColorPrint.blue("Backend:  http://0.0.0.0:8000/api")
            ColorPrint.blue("API Docs: http://0.0.0.0:8000/docs")
            print("=" * 60)

        return connected


async def launch_frontend_with_wait(
    project_root: Optional[Path] = None,
    frontend_url: str = "http://localhost:3000",
    timeout: int = 120
) -> bool:
    """
    Convenience function to launch frontend and wait for connection

    Args:
        project_root: Project root directory
        frontend_url: Frontend URL to check
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

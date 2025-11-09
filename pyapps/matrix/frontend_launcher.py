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

    def launch_frontend(self) -> Optional[Path]:
        """
        Launch frontend by directly calling Node.js scripts

        Executes:
        1. switch-app-entry.js - Switch entry point (index.vue)
        2. switch-app-entry-plus.js - Factory sync and dev server

        Returns:
            Path to switch-app-entry-plus.js script or None
        """
        try:
            if not self.validate_paths():
                return None

            # Calculate script paths
            scripts_dir = self.nuxt_main_dir / "scripts"
            switch_entry_script = scripts_dir / "switch-app-entry.js"
            switch_plus_script = scripts_dir / "switch-app-entry-plus.js"

            # Validate scripts exist
            if not switch_entry_script.exists():
                ColorPrint.red(f"Script not found: {switch_entry_script}")
                return None
            if not switch_plus_script.exists():
                ColorPrint.red(f"Script not found: {switch_plus_script}")
                return None

            # Print detailed startup flow
            ColorPrint.blue("=" * 70)
            ColorPrint.blue(" MATRIX FRONTEND STARTUP FLOW")
            ColorPrint.blue("=" * 70)
            ColorPrint.white("")

            ColorPrint.yellow("Step 1: Switch app entry point")
            ColorPrint.white("  Script: switch-app-entry.js pymatrix")
            ColorPrint.white("  Action: Copy index.pymatrix.vue -> index.vue")
            ColorPrint.white("")

            ColorPrint.yellow("Step 2: Factory sync and dev server")
            ColorPrint.white("  Script: switch-app-entry-plus.js pymatrix --mode dev")
            ColorPrint.white("  Actions:")
            ColorPrint.white("    - Mirror project to .build_dir/nuxt_factory/_app_pymatrix")
            ColorPrint.white("    - Start file watcher (sync every 2 seconds)")
            ColorPrint.white("    - Execute: pnpm dev:pymatrix")
            ColorPrint.white("")

            ColorPrint.yellow("Step 3: Nuxt dev server starts")
            ColorPrint.white("  Host: 0.0.0.0 (network accessible)")
            ColorPrint.white("  Port: 3007")
            ColorPrint.white("  URL:  http://localhost:3007")
            ColorPrint.white("")
            ColorPrint.blue("=" * 70)
            ColorPrint.white("")

            # Execute Step 1: Switch app entry point
            ColorPrint.green("[EXECUTING] Step 1: Switching app entry point...")
            ColorPrint.gray(f"Command: node \"{switch_entry_script}\" pymatrix")
            ColorPrint.white("")

            result = subprocess.run(
                ["node", str(switch_entry_script), "pymatrix"],
                cwd=str(self.nuxt_main_dir),
                capture_output=True,
                text=True,
                encoding='utf-8'
            )

            if result.returncode != 0:
                ColorPrint.red(f"[ERROR] Failed to switch entry point:")
                ColorPrint.red(result.stderr)
                return None

            # Print output from switch-app-entry.js
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    ColorPrint.white(f"  {line}")

            ColorPrint.green("[SUCCESS] Entry point switched successfully")
            ColorPrint.white("")
            ColorPrint.blue("=" * 70)
            ColorPrint.white("")

            # Execute Step 2: Launch factory sync and dev server in new console
            ColorPrint.green("[EXECUTING] Step 2: Starting factory sync and dev server...")
            ColorPrint.gray(f"Command: node \"{switch_plus_script}\" pymatrix --mode dev")
            ColorPrint.white("")

            import platform
            if platform.system() == 'Windows':
                # Create temporary batch script for console window
                fd, temp_script_path = tempfile.mkstemp(suffix='.bat', text=True)
                temp_script = Path(temp_script_path)

                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write('@echo off\n')
                    f.write('title Matrix Frontend - Factory Sync\n')
                    f.write(f'cd /d "{self.nuxt_main_dir}"\n')
                    f.write(f'node "{switch_plus_script}" pymatrix --mode dev\n')
                    f.write('echo.\n')
                    f.write('echo Frontend process ended. Press any key to close...\n')
                    f.write('pause > nul\n')

                # Launch in new console window
                subprocess.Popen(
                    str(temp_script),
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    shell=True
                )

                self.batch_script = temp_script
            else:
                # Linux: Launch in background
                subprocess.Popen(
                    ["node", str(switch_plus_script), "pymatrix", "--mode", "dev"],
                    cwd=str(self.nuxt_main_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                self.batch_script = None

            ColorPrint.green("[SUCCESS] Frontend factory sync launched in new console window")
            ColorPrint.white("")
            ColorPrint.blue("=" * 70)
            ColorPrint.blue(" WAITING FOR FRONTEND TO BECOME READY")
            ColorPrint.blue("=" * 70)
            ColorPrint.white("")

            return switch_plus_script

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to launch frontend: {e}")
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

        ColorPrint.yellow(f"Checking frontend availability: {frontend_url}")
        ColorPrint.white(f"Timeout: {timeout}s | Check interval: {check_interval}s")
        ColorPrint.white("")
        ColorPrint.white("This process includes:")
        ColorPrint.gray("  1. Switching entry point (index.vue)")
        ColorPrint.gray("  2. Mirroring project to factory directory")
        ColorPrint.gray("  3. Installing dependencies")
        ColorPrint.gray("  4. Starting Nuxt dev server")
        ColorPrint.gray("  5. Compiling Vue components")
        ColorPrint.white("")

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
                    ColorPrint.white("")
                    ColorPrint.green("=" * 70)
                    ColorPrint.green(" FRONTEND READY")
                    ColorPrint.green("=" * 70)
                    ColorPrint.green(f"[SUCCESS] Frontend is now available at {frontend_url}")
                    ColorPrint.white("")
                    return True

            except (requests.RequestException, Exception):
                # Frontend not ready yet
                pass

            # Print progress dots
            dots = (dots + 1) % 4
            print(f"\r[WAITING] Connecting{'.' * dots}{' ' * (3 - dots)}", end='', flush=True)

            await asyncio.sleep(check_interval)
            elapsed += check_interval

        ColorPrint.white("")
        ColorPrint.red("=" * 70)
        ColorPrint.red(" FRONTEND TIMEOUT")
        ColorPrint.red("=" * 70)
        ColorPrint.red(f"[ERROR] Frontend did not start within {timeout} seconds")
        ColorPrint.white("")
        ColorPrint.yellow("Manual startup instructions:")
        ColorPrint.white(f"  cd {self.nuxt_main_dir}\\scripts")
        ColorPrint.white("  .\\start.ps1 pymatrix")
        ColorPrint.white("")
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
        # Launch frontend (returns temporary script path)
        script_path = self.launch_frontend()
        if not script_path:
            return False

        # Wait for connection
        connected = await self.wait_for_frontend_connection(
            frontend_url=frontend_url,
            timeout=timeout
        )

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

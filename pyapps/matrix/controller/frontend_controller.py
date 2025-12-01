"""Frontend Controller

Manages Nuxt frontend lifecycle for Matrix application

Uses poly_apps/nuxt_main/scripts/start.py for launching frontend
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

        # New unified launcher (Python version - equivalent to start.ps1)
        self.start_script = self.scripts_dir / "start.py"

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

        if not self.start_script.exists():
            ColorPrint.red(f"Start script not found: {self.start_script}")
            return False

        return True

    def start_nuxt_frontend(self) -> bool:
        """
        Start Nuxt frontend using start.py launcher

        Executes: python start.py pymatrix
        This will:
        1. Switch pages directory to pymatrix
        2. Start factory sync and Nuxt dev server

        Returns:
            True if started successfully
        """
        ColorPrint.green("[FrontendController] Starting Nuxt frontend for pymatrix...")
        ColorPrint.gray(f"Command: python \"{self.start_script}\" pymatrix")
        ColorPrint.gray(f"Port: {self.frontend_port}")

        try:
            import platform

            if platform.system() == 'Windows':
                # Windows: Launch in new console window
                fd, temp_script_path = tempfile.mkstemp(suffix='.bat', text=True)
                self.temp_script = Path(temp_script_path)

                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write('@echo off\n')
                    f.write('title Matrix Frontend - Nuxt Dev Server\n')
                    f.write(f'cd /d "{self.nuxt_main_dir}"\n')
                    # Set NUXT_PORT environment variable for Matrix frontend
                    f.write(f'set NUXT_PORT={self.frontend_port}\n')
                    f.write(f'set NUXT_HOST=0.0.0.0\n')
                    f.write(f'python "{self.start_script}" pymatrix debug\n')
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
                # Linux/Mac: Launch in background
                env = os.environ.copy()
                env['NUXT_PORT'] = str(self.frontend_port)
                env['NUXT_HOST'] = '0.0.0.0'
                self.process = subprocess.Popen(
                    ["python3", str(self.start_script), "pymatrix", "debug"],
                    cwd=str(self.nuxt_main_dir),
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            self.running = True
            ColorPrint.green("[SUCCESS] Nuxt frontend launcher started")
            return True

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to start Nuxt frontend: {e}")
            import traceback
            traceback.print_exc()
            return False

    def wait_for_ready(self, timeout: int = 120, check_interval: int = 2) -> bool:
        """
        Wait for frontend to become ready with detailed progress reporting

        Args:
            timeout: Maximum wait time in seconds
            check_interval: Time between checks in seconds

        Returns:
            True if frontend is ready
        """
        import requests

        ColorPrint.blue("=" * 79)
        ColorPrint.blue("[FrontendController] 等待前端初始化")
        ColorPrint.blue("=" * 79)
        ColorPrint.cyan(f"目标地址: {self.frontend_url}")
        ColorPrint.cyan(f"超时时间: {timeout}s | 检测间隔: {check_interval}s")
        ColorPrint.blue("=" * 79)
        ColorPrint.white("")

        start_time = time.time()
        elapsed = 0
        attempt = 0
        dots = 0

        while elapsed < timeout:
            attempt += 1
            current_elapsed = time.time() - start_time

            try:
                response = requests.get(self.frontend_url, timeout=2)
                if response.status_code == 200:
                    ColorPrint.white("")
                    ColorPrint.blue("=" * 79)
                    ColorPrint.green(f"✓ 前端就绪: {self.frontend_url}")
                    ColorPrint.green(f"✓ 启动耗时: {current_elapsed:.2f}秒")
                    ColorPrint.green(f"✓ 检测次数: {attempt}次")
                    ColorPrint.blue("=" * 79)
                    self.ready = True
                    return True
            except requests.exceptions.ConnectionError:
                # Connection refused - service not ready yet
                pass
            except requests.exceptions.Timeout:
                # Request timeout - service may be starting
                pass
            except Exception as e:
                # Other errors - log but continue
                ColorPrint.gray(f"\r[检测 #{attempt}] 异常: {str(e)[:50]}", end='', flush=True)

            # Print animated progress with time and attempt count
            dots = (dots + 1) % 4
            progress_bar = '.' * dots + ' ' * (3 - dots)
            print(
                f"\r[等待前端初始化{progress_bar}] "
                f"已耗时: {current_elapsed:>5.1f}s | "
                f"检测次数: {attempt:>3} | "
                f"剩余: {timeout - current_elapsed:>5.1f}s",
                end='',
                flush=True
            )

            time.sleep(check_interval)
            elapsed = time.time() - start_time

        # Timeout reached
        ColorPrint.white("")
        ColorPrint.blue("=" * 79)
        ColorPrint.red(f"✗ 前端启动超时: {elapsed:.2f}秒")
        ColorPrint.red(f"✗ 检测次数: {attempt}次")
        ColorPrint.yellow(f"⚠ 请检查前端进程是否正常启动")
        ColorPrint.blue("=" * 79)
        return False

    def start(self) -> bool:
        """
        Start frontend (full flow)

        Uses start.py launcher which handles:
        - Switching pages directory
        - Starting factory sync
        - Starting Nuxt dev server

        Returns:
            True if started successfully
        """
        if not self.validate_paths():
            return False

        # Start Nuxt frontend using unified launcher
        if not self.start_nuxt_frontend():
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

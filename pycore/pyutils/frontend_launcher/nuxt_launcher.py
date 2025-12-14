"""
Nuxt Launcher

Handles Nuxt frontend compilation and startup
"""

import os
import sys
import time
import platform
import subprocess
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import tempfile
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint
from .frontend_config import FrontendConfig
from .output_capturer import OutputCapturer


class NuxtLauncher:
    """
    Nuxt Frontend Launcher

    Supports both dev and production modes
    """

    def __init__(self, config: Optional[FrontendConfig] = None, **kwargs):
        """
        Initialize Nuxt launcher

        Args:
            config: Frontend configuration
            **kwargs: Config parameters (if config not provided)
        """
        if config is None:
            config = FrontendConfig(**kwargs)

        self.config = config
        self.running = False
        self.ready = False
        self.process: Optional[subprocess.Popen] = None
        self.temp_script: Optional[Path] = None

        # Paths
        self.project_root = self.config.project_root
        self.nuxt_main_dir = self.project_root / "poly_apps" / "nuxt_main"
        self.scripts_dir = self.nuxt_main_dir / "scripts"

        # Scripts
        self.start_dev_script = self.scripts_dir / "start_simple.py"
        self.start_production_script = self.scripts_dir / "start_production.py"

        # Factory directory (for production builds)
        self.factory_app_dir = self._get_factory_app_dir()
        self.output_dir = self.factory_app_dir / ".output"
        self.static_dir = self.output_dir / "public"

        # Output capturer
        self.capturer = OutputCapturer(prefix=f"[Nuxt:{self.config.app_name}]")

        ColorPrint.blue(f"[NuxtLauncher] Initialized for {self.config.app_name}")
        ColorPrint.blue(f"[NuxtLauncher] Mode: {self.config.mode}")
        ColorPrint.blue(f"[NuxtLauncher] Port: {self.config.port}")

    def _get_factory_app_dir(self) -> Path:
        """Get factory directory for this app"""
        if platform.system() == 'Windows':
            base_dir = Path('D:/programing')
        else:
            base_dir = Path('/www')
            if not base_dir.exists():
                base_dir = Path('/mnt/d/programing')

        factory_root = base_dir / '.build_dir' / 'nuxt_factory'

        if platform.system() == 'Windows':
            app_dir = factory_root / f'_app_{self.config.app_name}'
        else:
            app_dir = factory_root / 'linux' / f'_app_{self.config.app_name}'

        return app_dir

    def validate_paths(self) -> bool:
        """Validate required paths exist"""
        if not self.nuxt_main_dir.exists():
            ColorPrint.red(f"[NuxtLauncher] Nuxt directory not found: {self.nuxt_main_dir}")
            return False

        # Check appropriate script based on mode
        if self.config.mode == "production":
            if not self.start_production_script.exists():
                ColorPrint.red(f"[NuxtLauncher] Production script not found: {self.start_production_script}")
                return False
        else:
            if not self.start_dev_script.exists():
                ColorPrint.red(f"[NuxtLauncher] Dev script not found: {self.start_dev_script}")
                return False

        return True

    def compile(self) -> bool:
        """
        Compile Nuxt application (production mode only)

        Returns:
            True if compilation successful
        """
        if self.config.mode != 'production':
            ColorPrint.yellow("[NuxtLauncher] Compile skipped (dev mode)")
            return True

        ColorPrint.blue("=" * 79)
        ColorPrint.blue(" NUXT COMPILATION - STARTING")
        ColorPrint.blue("=" * 79)
        ColorPrint.cyan(f"  App: {self.config.app_name}")
        ColorPrint.cyan(f"  Port: {self.config.port}")
        ColorPrint.cyan(f"  Factory Dir: {self.factory_app_dir}")
        ColorPrint.cyan(f"  Skip Build: {self.config.skip_build}")
        ColorPrint.cyan(f"  Force Rebuild: {self.config.force_rebuild}")
        ColorPrint.blue("=" * 79)
        ColorPrint.white("")

        # Build command
        cmd = [
            sys.executable,
            str(self.start_production_script),
            self.config.app_name,
            str(self.config.port)
        ]

        if self.config.skip_build:
            cmd.append("--skip-build")
        elif self.config.force_rebuild:
            cmd.append("--rebuild")

        ColorPrint.yellow(f"[NuxtLauncher] Executing: {' '.join(cmd)}")
        ColorPrint.white("")

        try:
            # Run compilation with real-time output
            process = subprocess.Popen(
                cmd,
                cwd=str(self.nuxt_main_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Capture output in real-time
            exit_code = self.capturer.wait_and_capture(process, timeout=600)

            if exit_code != 0:
                ColorPrint.red(f"[NuxtLauncher] Compilation failed with exit code {exit_code}")
                return False

            # Verify build output exists
            if not self.output_dir.exists():
                ColorPrint.red(f"[NuxtLauncher] Build output not found: {self.output_dir}")
                return False

            ColorPrint.white("")
            ColorPrint.green("=" * 79)
            ColorPrint.green(" NUXT COMPILATION - COMPLETED")
            ColorPrint.green("=" * 79)
            ColorPrint.green(f"  Output Directory: {self.output_dir}")
            ColorPrint.green(f"  Static Directory: {self.static_dir}")
            ColorPrint.green("=" * 79)
            ColorPrint.white("")

            return True

        except Exception as e:
            ColorPrint.red(f"[NuxtLauncher] Compilation error: {e}")
            import traceback
            traceback.print_exc()
            return False

    def serve_dev(self) -> bool:
        """
        Start Nuxt development server (dev mode only)

        Returns:
            True if started successfully
        """
        if self.config.mode != 'dev':
            ColorPrint.yellow("[NuxtLauncher] Dev server skipped (production mode)")
            return True

        ColorPrint.green("[NuxtLauncher] Starting Nuxt dev server...")
        ColorPrint.gray(f"Command: python \"{self.start_dev_script}\" {self.config.app_name} {self.config.port}")

        try:
            import platform as plat

            if plat.system() == 'Windows':
                # Windows: Launch in new console window
                fd, temp_script_path = tempfile.mkstemp(suffix='.bat', text=True)
                self.temp_script = Path(temp_script_path)

                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write('@echo off\n')
                    f.write(f'title Nuxt Dev Server - {self.config.app_name}\n')
                    f.write(f'cd /d "{self.nuxt_main_dir}"\n')
                    f.write(f'set NUXT_PORT={self.config.port}\n')
                    f.write(f'set NUXT_HOST=0.0.0.0\n')
                    f.write(f'python "{self.start_dev_script}" {self.config.app_name} {self.config.port}\n')
                    f.write('echo.\n')
                    f.write('echo Dev server ended. Press any key to close...\n')
                    f.write('pause > nul\n')

                # Launch in new console
                self.process = subprocess.Popen(
                    str(self.temp_script),
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    shell=True
                )

            else:
                # Linux/Mac: Launch in background
                env = os.environ.copy()
                env['NUXT_PORT'] = str(self.config.port)
                env['NUXT_HOST'] = '0.0.0.0'

                self.process = subprocess.Popen(
                    [sys.executable, str(self.start_dev_script), self.config.app_name, str(self.config.port)],
                    cwd=str(self.nuxt_main_dir),
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            self.running = True
            ColorPrint.green("[NuxtLauncher] Dev server started")
            return True

        except Exception as e:
            ColorPrint.red(f"[NuxtLauncher] Failed to start dev server: {e}")
            import traceback
            traceback.print_exc()
            return False

    def wait_for_ready(self) -> bool:
        """
        Wait for frontend to become ready (HTTP health check)

        Returns:
            True if frontend is ready
        """
        import requests

        url = f"http://localhost:{self.config.port}"
        timeout = self.config.health_check_timeout
        check_interval = 2

        ColorPrint.blue("=" * 79)
        ColorPrint.blue("[NuxtLauncher] Waiting for frontend to be ready")
        ColorPrint.blue("=" * 79)
        ColorPrint.cyan(f"  URL: {url}")
        ColorPrint.cyan(f"  Timeout: {timeout}s | Check Interval: {check_interval}s")
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
                response = requests.get(url, timeout=2)
                if response.status_code == 200:
                    ColorPrint.white("")
                    ColorPrint.blue("=" * 79)
                    ColorPrint.green(f"✓ Frontend ready: {url}")
                    ColorPrint.green(f"✓ Startup time: {current_elapsed:.2f}s")
                    ColorPrint.green(f"✓ Attempts: {attempt}")
                    ColorPrint.blue("=" * 79)
                    ColorPrint.white("")
                    self.ready = True
                    return True
            except requests.exceptions.ConnectionError:
                pass
            except requests.exceptions.Timeout:
                pass
            except Exception as e:
                ColorPrint.gray(f"\r[Check #{attempt}] Exception: {str(e)[:50]}", end='', flush=True)

            # Animated progress
            dots = (dots + 1) % 4
            progress_bar = '.' * dots + ' ' * (3 - dots)
            print(
                f"\r[Waiting for frontend{progress_bar}] "
                f"Elapsed: {current_elapsed:>5.1f}s | "
                f"Attempts: {attempt:>3} | "
                f"Remaining: {timeout - current_elapsed:>5.1f}s",
                end='',
                flush=True
            )

            time.sleep(check_interval)
            elapsed = time.time() - start_time

        # Timeout reached
        ColorPrint.white("")
        ColorPrint.blue("=" * 79)
        ColorPrint.red(f"✗ Frontend startup timeout: {elapsed:.2f}s")
        ColorPrint.red(f"✗ Attempts: {attempt}")
        ColorPrint.yellow(f"⚠ Please check frontend process")
        ColorPrint.blue("=" * 79)
        ColorPrint.white("")
        return False

    def start_and_wait(self) -> bool:
        """
        Start frontend and wait for ready

        Returns:
            True if started and ready
        """
        if not self.validate_paths():
            return False

        # Production mode: compile (if needed) and verify output
        if self.config.mode == 'production':
            # Check if we need to compile
            if self.config.skip_build:
                ColorPrint.yellow("[NuxtLauncher] Skip build enabled, checking existing build...")
                if not self.output_dir.exists():
                    ColorPrint.red(f"[NuxtLauncher] Build output not found: {self.output_dir}")
                    ColorPrint.red("[NuxtLauncher] Please run build first or set skip_build=False")
                    return False

                ColorPrint.green(f"[NuxtLauncher] Using existing build: {self.output_dir}")
                ColorPrint.green(f"[NuxtLauncher] Static directory: {self.static_dir}")
            else:
                # Compile
                if not self.compile():
                    return False

            # Verify static directory exists
            if not self.static_dir.exists():
                ColorPrint.red(f"[NuxtLauncher] Static directory not found: {self.static_dir}")
                return False

            ColorPrint.green("[NuxtLauncher] Production build ready")
            self.ready = True
            return True

        # Dev mode: start dev server and wait
        else:
            if not self.serve_dev():
                return False

            # Wait for dev server to be ready
            return self.wait_for_ready()

    def get_static_dir(self) -> Optional[Path]:
        """
        Get static files directory (production mode only)

        Returns:
            Path to static directory or None
        """
        if self.config.mode != 'production':
            ColorPrint.yellow("[NuxtLauncher] Static dir not available in dev mode")
            return None

        if not self.static_dir.exists():
            ColorPrint.yellow(f"[NuxtLauncher] Static dir not found: {self.static_dir}")
            return None

        return self.static_dir

    def get_output_dir(self) -> Optional[Path]:
        """
        Get build output directory (production mode only)

        Returns:
            Path to .output directory or None
        """
        if self.config.mode != 'production':
            return None

        if not self.output_dir.exists():
            return None

        return self.output_dir

    def stop(self):
        """Stop frontend process"""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except:
                try:
                    self.process.kill()
                except:
                    pass

        if self.temp_script and self.temp_script.exists():
            try:
                os.remove(self.temp_script)
            except:
                pass

        self.running = False
        self.ready = False
        ColorPrint.yellow("[NuxtLauncher] Stopped")

    def is_running(self) -> bool:
        """Check if frontend is running"""
        return self.running

    def is_ready(self) -> bool:
        """Check if frontend is ready"""
        return self.ready

    def get_url(self) -> str:
        """Get frontend URL"""
        return f"http://localhost:{self.config.port}"

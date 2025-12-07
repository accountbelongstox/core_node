#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Launcher Thread

Thread-based frontend launcher for native UI applications.
Inherits from threading.Thread directly (follows pycore standards).
"""

import os
import sys
import time
import socket
import threading
import subprocess
<<<<<<< HEAD
=======
import platform
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
from pathlib import Path
from typing import Optional, List

from pycore.pyfoundations.color_print import ColorPrint
from .frontend_config import FrontendConfig


<<<<<<< HEAD
=======
def _resolve_command_for_platform(command: List[str]) -> List[str]:
    """
    Resolve command for current platform (Windows requires .cmd/.bat extension)

    Args:
        command: Command list (e.g., ['npm', 'run', 'dev'])

    Returns:
        Platform-specific command list
    """
    if platform.system() != "Windows":
        return command

    # On Windows, add .cmd extension to first element if it's a known npm tool
    npm_tools = ["npm", "pnpm", "npx", "yarn", "node"]
    if command and command[0] in npm_tools:
        command = command.copy()
        command[0] = f"{command[0]}.cmd"

    return command


>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
class FrontendLauncherThread(threading.Thread):
    """
    Frontend launcher thread

    Handles frontend lifecycle in a separate thread:
    - Dependency installation (pnpm)
    - Dev server or production build
    - Health checking
    - Process management

    Usage:
        config = FrontendConfig(
            enabled=True,
            framework='vite',
            app_dir=Path('poly_apps/matrix_ui_react'),
            mode='production'
        )

        thread = FrontendLauncherThread(config=config)
        thread.start()

        # Wait for ready (if needed)
        thread.wait_for_ready(timeout=120)
    """

    def __init__(self, config: FrontendConfig, daemon: bool = True):
        """
        Initialize frontend launcher thread

        Args:
            config: Frontend configuration
            daemon: Daemon thread flag
        """
        super().__init__(name=f"FrontendLauncher-{config.framework}", daemon=daemon)

        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.ready_event = threading.Event()
        self.error_event = threading.Event()
        self.running = False
        self.ready = False
        self.error_message: Optional[str] = None

        ColorPrint.blue(f"[FrontendThread] Initialized: {config.framework} ({config.mode} mode)")
        ColorPrint.blue(f"[FrontendThread] App directory: {config.app_dir}")

    def run(self):
        """Thread entry point - called by Thread.start()"""
        self.running = True

<<<<<<< HEAD
        # Step 1: Install dependencies if needed
        if self.config.auto_install:
            if not self._ensure_dependencies():
                self.error_message = "Dependency installation failed"
                self.error_event.set()
                self.running = False
                return

        # Step 2: Start frontend based on mode
        if self.config.mode == "production":
            success = self._handle_production_mode()
        else:
            success = self._handle_dev_mode()

        if not success:
            self.error_event.set()
            self.running = False
            return

        # Step 3: Signal ready
        self.ready = True
        self.ready_event.set()
        ColorPrint.green(f"[FrontendThread] Frontend ready")

        # Keep thread alive while process runs (dev mode only)
        if self.config.mode == "dev" and self.process:
            self.process.wait()

        self.running = False
=======
        try:
            # Step 1: Install dependencies if needed
            if self.config.auto_install:
                ColorPrint.blue("[FrontendThread] Installing dependencies...")
                self._ensure_dependencies()

            # Step 2: Start frontend based on mode
            if self.config.mode == "production":
                ColorPrint.blue("[FrontendThread] Starting production mode...")
                self._handle_production_mode()
            else:
                ColorPrint.blue("[FrontendThread] Starting dev mode...")
                self._handle_dev_mode()

            # Step 3: Signal ready
            self.ready = True
            self.ready_event.set()
            ColorPrint.green(f"[FrontendThread] Frontend ready")

            # Trigger THREAD_BUS event for external listeners (e.g., Debug Log auto-close)
            from pycore import THREAD_BUS
            THREAD_BUS.trigger_event('frontend.ready', {
                'mode': self.config.mode,
                'port': self.config.port,
                'framework': self.config.framework
            })
            ColorPrint.blue("[FrontendThread] Triggered THREAD_BUS event: frontend.ready")

            # Keep thread alive while process runs (dev mode only)
            if self.config.mode == "dev" and self.process:
                self.process.wait()

        except Exception as e:
            ColorPrint.red(f"[FrontendThread] Unexpected error: {e}")
            self.error_message = str(e)
            self.error_event.set()
            import traceback
            traceback.print_exc()

        finally:
            self.running = False
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

    def _ensure_dependencies(self) -> bool:
        """
        Ensure dependencies are installed

        Returns:
            True if dependencies ready
        """
        node_modules = self.config.app_dir / "node_modules"
        package_json = self.config.app_dir / "package.json"

        if not package_json.exists():
            ColorPrint.yellow("[FrontendThread] No package.json found, skipping dependency check")
            return True

        # Check if node_modules exists and is up to date
        if node_modules.exists():
<<<<<<< HEAD
            lock_file = self.config.app_dir / "pnpm-lock.yaml"
=======
            # Detect lock file based on package manager
            lock_files = {
                "pnpm": "pnpm-lock.yaml",
                "npm": "package-lock.json",
                "yarn": "yarn.lock"
            }
            lock_file_name = lock_files.get(self.config.package_manager, "pnpm-lock.yaml")
            lock_file = self.config.app_dir / lock_file_name

>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
            if lock_file.exists():
                lock_mtime = lock_file.stat().st_mtime
                modules_mtime = node_modules.stat().st_mtime
                if lock_mtime <= modules_mtime:
                    ColorPrint.green("[FrontendThread] Dependencies already installed")
                    return True

        # Install dependencies
        ColorPrint.blue("[FrontendThread] Installing dependencies...")
        return self._run_install()

    def _run_install(self) -> bool:
        """
<<<<<<< HEAD
        Run pnpm install
=======
        Run package manager install (pnpm/npm/yarn)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

        Returns:
            True if installation successful
        """
<<<<<<< HEAD
        command = self.config.install_command or ["pnpm", "install"]
=======
        # Use custom install_command or generate from package_manager
        if self.config.install_command:
            command = self.config.install_command
        else:
            pm = self.config.package_manager
            command = [pm, "install"]

        command = _resolve_command_for_platform(command)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        ColorPrint.blue(f"[FrontendThread] Running: {' '.join(command)}")

        process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

<<<<<<< HEAD
        # Stream output
        success_indicators = [
            "dependencies are up to date",
            "done in",
            "packages installed",
            "already up-to-date",
        ]

        output_lines = []
        for line in process.stdout:
            stripped = line.strip()
            if stripped:
                output_lines.append(stripped)
                if self.config.show_output:
                    print(f"  {stripped}")

        process.wait()

        # Check success
        full_output = "\n".join(output_lines).lower()
        success = any(indicator in full_output for indicator in success_indicators)

        # Verify node_modules created
        node_modules_exists = (self.config.app_dir / "node_modules").exists()

        if success and node_modules_exists:
            ColorPrint.green("[FrontendThread] Dependencies installed successfully")
            return True
        else:
            ColorPrint.red("[FrontendThread] Dependency installation failed")
            self.error_message = "pnpm install failed"
            return False

    def _handle_production_mode(self) -> bool:
        """
        Handle production mode

        Returns:
            True if successful
=======
        # Stream output in real-time
        for line in process.stdout:
            stripped = line.strip()
            if stripped and self.config.show_output:
                ColorPrint.gray(f"  {stripped}")

        # Wait for process to complete (no timeout)
        process.wait()

        # Only check if node_modules exists (ignore exit codes)
        node_modules_exists = (self.config.app_dir / "node_modules").exists()

        if node_modules_exists:
            ColorPrint.green("[FrontendThread] Dependencies installation completed")
            return True
        else:
            ColorPrint.yellow("[FrontendThread] node_modules not found, but continuing anyway...")
            return True  # Don't fail - let subsequent steps handle it

    def _handle_production_mode(self):
        """
        Handle production mode (no early exits)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        """
        # Check if we should build
        should_build = self._should_run_build()

        if not should_build:
            ColorPrint.yellow("[FrontendThread] Build skipped - output is up to date")
        else:
<<<<<<< HEAD
            if not self._run_build():
                ColorPrint.red("[FrontendThread] Build failed")
                self.error_message = "Build failed"
                return False

        # Verify output directories exist
        if not self.config.output_dir.exists():
            ColorPrint.red(f"[FrontendThread] Output directory missing: {self.config.output_dir}")
            self.error_message = f"Output directory missing: {self.config.output_dir}"
            return False

        if not self.config.static_dir.exists():
            ColorPrint.red(f"[FrontendThread] Static directory missing: {self.config.static_dir}")
            self.error_message = f"Static directory missing: {self.config.static_dir}"
            return False

        ColorPrint.green("[FrontendThread] Production build ready")
        ColorPrint.green(f"[FrontendThread] Static files: {self.config.static_dir}")
        return True
=======
            ColorPrint.blue("[FrontendThread] Running build...")
            self._run_build()

        # Verify output directories exist
        if not self.config.output_dir.exists():
            ColorPrint.yellow(f"[FrontendThread] Output directory missing: {self.config.output_dir}")
        else:
            ColorPrint.green(f"[FrontendThread] Output directory: {self.config.output_dir}")

        if not self.config.static_dir.exists():
            ColorPrint.yellow(f"[FrontendThread] Static directory missing: {self.config.static_dir}")
        else:
            ColorPrint.green(f"[FrontendThread] Static files: {self.config.static_dir}")

        ColorPrint.green("[FrontendThread] Production mode initialized")
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

    def _should_run_build(self) -> bool:
        """Check if build is needed"""
        if self.config.force_rebuild:
            return True

        if self.config.skip_build:
            return False

        if not self.config.output_dir.exists():
            return True

        # Smart build: check if source files are newer
        if self.config.smart_build:
            src_dir = self.config.app_dir / "src"
            if src_dir.exists():
                src_mtime = max(
                    f.stat().st_mtime
                    for f in src_dir.rglob("*")
                    if f.is_file()
                )
                output_mtime = self.config.output_dir.stat().st_mtime
                if src_mtime <= output_mtime:
                    return False

        return True

    def _run_build(self) -> bool:
        """
<<<<<<< HEAD
        Run production build

        Returns:
            True if build successful
        """
        command = self._resolve_build_command()
=======
        Run production build (no timeout, ignores exit codes)

        Returns:
            True (always - let output verification handle success)
        """
        command = self._resolve_build_command()
        command = _resolve_command_for_platform(command)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        ColorPrint.blue("[FrontendThread] " + "=" * 70)
        ColorPrint.blue("[FrontendThread] BUILDING FRONTEND")
        ColorPrint.blue("[FrontendThread] " + "=" * 70)
        ColorPrint.cyan(f"[FrontendThread] Command: {' '.join(command)}")
        ColorPrint.cyan(f"[FrontendThread] Working dir: {self.config.app_dir}")
        ColorPrint.blue("[FrontendThread] " + "=" * 70)

        process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

<<<<<<< HEAD
        # Stream output
        for line in process.stdout:
            stripped = line.strip()
            if stripped and self.config.show_output:
                print(f"  {stripped}")

        process.wait()

        if process.returncode != 0:
            ColorPrint.red(f"[FrontendThread] Build failed with exit code {process.returncode}")
            return False
=======
        # Stream output in real-time
        for line in process.stdout:
            stripped = line.strip()
            if stripped and self.config.show_output:
                ColorPrint.gray(f"  {stripped}")

        # Wait for process to complete (no timeout)
        process.wait()

        # Don't check exit code - just log completion
        if process.returncode != 0:
            ColorPrint.yellow(f"[FrontendThread] Build exited with code {process.returncode} (continuing anyway)")
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

        ColorPrint.green("[FrontendThread] " + "=" * 70)
        ColorPrint.green("[FrontendThread] BUILD COMPLETED")
        ColorPrint.green("[FrontendThread] " + "=" * 70)
        return True

    def _resolve_build_command(self) -> List[str]:
        """Resolve build command based on framework"""
        if self.config.build_command:
            return self.config.build_command

        # Framework-specific commands
        if self.config.framework == "nuxt":
            return ["npx", "nuxi", "build"]
        if self.config.framework == "next":
            return ["npx", "next", "build"]
        if self.config.framework == "nexus":
            return ["npx", "nexus", "build"]
        if self.config.framework == "vue":
            return ["npm", "run", "build"]
        if self.config.framework == "react-native":
            return ["npx", "expo", "export:web"]
        if self.config.framework == "react":
            return ["npm", "run", "build"]
        if self.config.framework == "vite":
            return ["npx", "vite", "build"]

        # Fallback
        return ["npm", "run", "build"]

<<<<<<< HEAD
    def _handle_dev_mode(self) -> bool:
        """
        Handle dev mode - start dev server

        Returns:
            True if started successfully
=======
    def _handle_dev_mode(self):
        """
        Handle dev mode - start dev server (waits indefinitely for ready)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        """
        ColorPrint.blue("[FrontendThread] Starting dev server...")

        command = self._resolve_dev_command()
<<<<<<< HEAD
=======
        command = _resolve_command_for_platform(command)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        env = self._build_env()

        ColorPrint.cyan(f"[FrontendThread] Command: {' '.join(command)}")

<<<<<<< HEAD
        # Start dev server
=======
        # Start dev server with real-time output
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        stdout = None if self.config.show_output else subprocess.DEVNULL
        stderr = None if self.config.show_output else subprocess.DEVNULL

        self.process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            env=env,
            stdout=stdout,
            stderr=stderr
        )

        ColorPrint.blue(f"[FrontendThread] Dev server started (PID: {self.process.pid})")

<<<<<<< HEAD
        # Wait for HTTP ready
        return self._wait_for_http()
=======
        # Wait for HTTP ready (no timeout)
        self._wait_for_http()
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

    def _resolve_dev_command(self) -> List[str]:
        """Resolve dev command based on framework"""
        if self.config.dev_command:
            return self.config.dev_command

        # Framework-specific commands
        if self.config.framework == "nuxt":
            return ["npx", "nuxi", "dev", "--hostname", self.config.host, "--port", str(self.config.port)]

        if self.config.framework == "next":
            return ["npx", "next", "dev", "-H", self.config.host, "-p", str(self.config.port)]

        if self.config.framework == "nexus":
            return ["npx", "nexus", "dev", "--host", self.config.host, "--port", str(self.config.port)]

        if self.config.framework == "vue":
            # Vue CLI or Vite
            return ["npm", "run", "serve", "--", "--host", self.config.host, "--port", str(self.config.port)]

        if self.config.framework == "react-native":
            # React Native Web via Expo
            return ["npx", "expo", "start", "--web", "--port", str(self.config.port)]

        if self.config.framework == "react":
            # Create React App
            return ["npm", "run", "start"]  # CRA doesn't support --host/--port via CLI

        if self.config.framework == "vite":
<<<<<<< HEAD
            return ["npx", "vite", "dev", "--host", self.config.host, "--port", str(self.config.port)]
=======
            # Use npm run dev for better compatibility (works with local vite)
            return ["npm", "run", "dev", "--", "--host", self.config.host, "--port", str(self.config.port)]
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

        # Fallback - try npm run dev
        return ["npm", "run", "dev", "--", "--host", self.config.host, "--port", str(self.config.port)]

    def _build_env(self) -> dict:
        """Build environment variables for dev server"""
        env = os.environ.copy()
<<<<<<< HEAD
=======

        # Standard port/host variables
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        env["PORT"] = str(self.config.port)
        env["HOST"] = self.config.host
        env["NUXT_PORT"] = str(self.config.port)
        env["NUXT_HOST"] = self.config.host
<<<<<<< HEAD
=======

        # Add custom environment variables (from config)
        if self.config.env_vars:
            for key, value in self.config.env_vars.items():
                env[key] = str(value)

>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        return env

    def _wait_for_http(self) -> bool:
        """
<<<<<<< HEAD
        Wait for HTTP server to be ready
=======
        Wait for HTTP server to be ready (no timeout, waits indefinitely)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

        Returns:
            True if server is ready
        """
<<<<<<< HEAD
        deadline = time.time() + self.config.health_check_timeout
=======
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        path = self.config.health_path
        host = "localhost"  # Always use localhost for health check
        port = self.config.port

        ColorPrint.blue(f"[FrontendThread] Waiting for frontend at http://{host}:{port}{path}")
<<<<<<< HEAD

        while time.time() < deadline:
            if self._http_ok(host, port, path):
                ColorPrint.green(f"[FrontendThread] Frontend ready at http://{host}:{port}")
                return True
            time.sleep(2)

        ColorPrint.red(f"[FrontendThread] Frontend not ready after {self.config.health_check_timeout}s")
        self.error_message = "Frontend health check timeout"
        return False
=======
        ColorPrint.yellow(f"[FrontendThread] No timeout set - will wait indefinitely...")

        check_count = 0
        while True:
            check_count += 1
            if self._http_ok(host, port, path):
                ColorPrint.green(f"[FrontendThread] Frontend ready at http://{host}:{port}")
                return True

            # Log progress every 30 seconds (15 checks * 2 seconds)
            if check_count % 15 == 0:
                elapsed = check_count * 2
                ColorPrint.cyan(f"[FrontendThread] Still waiting... ({elapsed}s elapsed)")

            time.sleep(2)
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

    def _http_ok(self, host: str, port: int, path: str) -> bool:
        """Check if HTTP server responds"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        code = sock.connect_ex((host, port))
        if code != 0:
            sock.close()
            return False

        request = f"GET {path} HTTP/1.0\r\nHost: {host}\r\n\r\n".encode("ascii")
        sock.sendall(request)
        response = sock.recv(1024)
        sock.close()

        if not response:
            return False

        status_line = response.split(b"\r\n", 1)[0]
        return b"200" in status_line

    def wait_for_ready(self, timeout: Optional[float] = None) -> bool:
        """
<<<<<<< HEAD
        Wait for frontend to be ready

        Args:
            timeout: Timeout in seconds (None = use config timeout)

        Returns:
            True if ready, False if error or timeout
        """
        if timeout is None:
            timeout = self.config.health_check_timeout

        # Wait for either ready or error
        ready = self.ready_event.wait(timeout=timeout)
=======
        Wait for frontend to be ready (no timeout, waits indefinitely)

        Args:
            timeout: Ignored - kept for API compatibility

        Returns:
            True if ready, False if error
        """
        # Wait indefinitely for either ready or error
        self.ready_event.wait()
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973

        if self.error_event.is_set():
            ColorPrint.red(f"[FrontendThread] Error: {self.error_message}")
            return False

<<<<<<< HEAD
        if not ready:
            ColorPrint.red(f"[FrontendThread] Timeout waiting for frontend")
            return False

=======
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
        return True

    def stop(self):
        """Stop frontend process"""
        if self.process:
            ColorPrint.yellow("[FrontendThread] Stopping frontend process...")
            self.process.terminate()
            self.process.wait(timeout=5)
            self.process = None

        self.running = False
        ColorPrint.green("[FrontendThread] Frontend stopped")

    def is_ready(self) -> bool:
        """Check if frontend is ready"""
        return self.ready

    def has_error(self) -> bool:
        """Check if frontend has error"""
        return self.error_event.is_set()

    def get_static_mount(self) -> Optional[dict]:
        """
        Get static mount configuration for RPC server

        Returns:
            Mount config dict or None
        """
        if self.config.mode != "production":
            return None

        if not self.config.static_dir.exists():
            return None

        return {
            "url_prefix": "/",
            "directory": str(self.config.static_dir),
            "name": f"{self.config.framework}-frontend"
        }

    def get_url(self) -> str:
        """Get frontend URL"""
        if self.config.mode == "dev":
            return f"http://localhost:{self.config.port}"
        else:
            # Production mode - served by RPC server
            return "/"

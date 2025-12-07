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
from pathlib import Path
from typing import Optional, List

from pycore.pyfoundations.color_print import ColorPrint
from .frontend_config import FrontendConfig


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
            lock_file = self.config.app_dir / "pnpm-lock.yaml"
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
        Run pnpm install

        Returns:
            True if installation successful
        """
        command = self.config.install_command or ["pnpm", "install"]
        ColorPrint.blue(f"[FrontendThread] Running: {' '.join(command)}")

        process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

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
        """
        # Check if we should build
        should_build = self._should_run_build()

        if not should_build:
            ColorPrint.yellow("[FrontendThread] Build skipped - output is up to date")
        else:
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
        Run production build

        Returns:
            True if build successful
        """
        command = self._resolve_build_command()
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

        # Stream output
        for line in process.stdout:
            stripped = line.strip()
            if stripped and self.config.show_output:
                print(f"  {stripped}")

        process.wait()

        if process.returncode != 0:
            ColorPrint.red(f"[FrontendThread] Build failed with exit code {process.returncode}")
            return False

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

    def _handle_dev_mode(self) -> bool:
        """
        Handle dev mode - start dev server

        Returns:
            True if started successfully
        """
        ColorPrint.blue("[FrontendThread] Starting dev server...")

        command = self._resolve_dev_command()
        env = self._build_env()

        ColorPrint.cyan(f"[FrontendThread] Command: {' '.join(command)}")

        # Start dev server
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

        # Wait for HTTP ready
        return self._wait_for_http()

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
            # Use npm run dev for better compatibility (works with local vite)
            return ["npm", "run", "dev", "--", "--host", self.config.host, "--port", str(self.config.port)]

        # Fallback - try npm run dev
        return ["npm", "run", "dev", "--", "--host", self.config.host, "--port", str(self.config.port)]

    def _build_env(self) -> dict:
        """Build environment variables for dev server"""
        env = os.environ.copy()
        env["PORT"] = str(self.config.port)
        env["HOST"] = self.config.host
        env["NUXT_PORT"] = str(self.config.port)
        env["NUXT_HOST"] = self.config.host
        return env

    def _wait_for_http(self) -> bool:
        """
        Wait for HTTP server to be ready

        Returns:
            True if server is ready
        """
        deadline = time.time() + self.config.health_check_timeout
        path = self.config.health_path
        host = "localhost"  # Always use localhost for health check
        port = self.config.port

        ColorPrint.blue(f"[FrontendThread] Waiting for frontend at http://{host}:{port}{path}")

        while time.time() < deadline:
            if self._http_ok(host, port, path):
                ColorPrint.green(f"[FrontendThread] Frontend ready at http://{host}:{port}")
                return True
            time.sleep(2)

        ColorPrint.red(f"[FrontendThread] Frontend not ready after {self.config.health_check_timeout}s")
        self.error_message = "Frontend health check timeout"
        return False

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

        if self.error_event.is_set():
            ColorPrint.red(f"[FrontendThread] Error: {self.error_message}")
            return False

        if not ready:
            ColorPrint.red(f"[FrontendThread] Timeout waiting for frontend")
            return False

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

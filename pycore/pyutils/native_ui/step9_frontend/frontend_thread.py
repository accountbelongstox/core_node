#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Launcher Thread

Thread-based frontend launcher for native UI applications.
Inherits from threading.Thread directly (follows pycore standards).

Frontend Singleton Support:
- Detects existing frontend instances using dedicated port range (55000-55099)
- Automatically shuts down old frontend when new one starts
- Uses THREAD_BUS events for graceful frontend-only shutdown
"""

import os
import sys
import time
import socket
import threading
import platform
from pathlib import Path
from typing import Optional, List

from pycore import THREAD_BUS
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon import exec_realtime, exec_silent
from .frontend_config import FrontendConfig
from .frontend_singleton_detector import FrontendSingletonDetector
import subprocess


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
        self._process_lock = threading.Lock()  # Protect process access
        self.ready_event = threading.Event()
        self.error_event = threading.Event()
        self.running = False
        self.ready = False
        self.error_message: Optional[str] = None

        # Frontend singleton detector
        self.singleton_detector: Optional[FrontendSingletonDetector] = None
        self._shutdown_requested = threading.Event()

        ColorPrint.blue(f"[FrontendThread] Initialized: {config.framework} ({config.mode} mode)")
        ColorPrint.blue(f"[FrontendThread] App directory: {config.app_dir}")

    def _on_singleton_shutdown_request(self):
        """
        Called when another frontend requests this one to shutdown

        This is just a notification callback - actual shutdown is handled by THREAD_BUS
        The frontend singleton detector will call THREAD_BUS.request_shutdown()
        which triggers all shutdown handlers in priority order

        Just set flags here to help run() exit early
        """
        ColorPrint.yellow("[FrontendThread] Singleton shutdown requested by new frontend instance")

        # Set flags to help run() exit early if it's still starting up
        self._shutdown_requested.set()
        self.running = False

        # Don't call stop() here - THREAD_BUS shutdown handler will do it
        # This callback is just for notification

    def _shutdown_handler(self):
        """
        Shutdown handler called by THREAD_BUS (runs in caller's thread)

        Just set flags and call stop() - let stop() handle all the cleanup logic
        """
        ColorPrint.yellow("[FrontendThread] Shutdown handler called by THREAD_BUS")

        self._shutdown_requested.set()
        self.running = False

        # Call stop() to handle process cleanup (it has all the polling logic)
        self.stop()

    def run(self):
        """Thread entry point - called by Thread.start()"""
        self.running = True

        # Register shutdown handler with THREAD_BUS
        # This ensures proper cleanup when shutdown is requested
        # Priority=50 ensures frontend stops BEFORE RPC(70) and Singleton(95)
        # Lower priority = stops first (子进程先关)
        THREAD_BUS.register_shutdown_handler(
            name='frontend',
            handler=self._shutdown_handler,
            priority=50  # Low priority - stop frontend FIRST
        )
        ColorPrint.blue("[FrontendThread] Registered shutdown handler with THREAD_BUS (priority=50)")

        try:
            # Step 0: Frontend singleton detection (before starting frontend)
            # This ensures only one frontend instance runs at a time
            ColorPrint.blue("[FrontendThread] Performing frontend singleton detection...")
            app_id = f"frontend_{self.config.framework}_{self.config.port}"
            self.singleton_detector = FrontendSingletonDetector(
                app_id=app_id,
                port_start=55000,
                port_range=100,
                debug=os.environ.get('FRONTEND_SINGLETON_DEBUG', '').lower() in ('1', 'true', 'yes'),
                on_shutdown_request=self._on_singleton_shutdown_request
            )

            detection_result = self.singleton_detector.detect_and_bind(shutdown_existing=True)

            if not detection_result.is_primary:
                # Failed to become primary (shouldn't happen with shutdown_existing=True)
                ColorPrint.red(f"[FrontendThread] Failed to become primary frontend: {detection_result.message}")
                self.error_message = f"Frontend singleton detection failed: {detection_result.message}"
                self.error_event.set()
                return

            ColorPrint.green(f"[FrontendThread] Became PRIMARY frontend on singleton port {detection_result.port}")

            # Check if shutdown was requested during singleton detection
            # This can happen if new instance starts while we're in the middle of detection
            if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
                ColorPrint.yellow("[FrontendThread] Shutdown requested before starting frontend, exiting...")
                return

            # Step 1: Install dependencies if needed
            if self.config.auto_install:
                ColorPrint.blue("[FrontendThread] Installing dependencies...")
                self._ensure_dependencies()

            # Check shutdown flag again before starting frontend
            if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
                ColorPrint.yellow("[FrontendThread] Shutdown requested after dependency check, exiting...")
                return

            # Step 2: Start frontend based on mode
            if self.config.mode == "production":
                ColorPrint.blue("[FrontendThread] Starting production mode...")
                self._handle_production_mode()
            else:
                ColorPrint.blue("[FrontendThread] Starting dev mode...")
                self._handle_dev_mode()

            # Check if we were interrupted during frontend start
            # _handle_dev_mode() may return early if shutdown was requested
            if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
                ColorPrint.yellow("[FrontendThread] Shutdown detected after frontend start attempt, exiting...")
                return

            # Verify process actually started
            if self.config.mode == "dev" and not self.process:
                ColorPrint.red("[FrontendThread] Dev mode but no process created, exiting...")
                self.error_message = "Failed to start frontend process"
                self.error_event.set()
                return

            # Step 3: Signal ready
            self.ready = True
            self.ready_event.set()
            ColorPrint.green(f"[FrontendThread] Frontend ready")

            # Trigger THREAD_BUS event for external listeners (e.g., Debug Log auto-close)
            THREAD_BUS.trigger_event('frontend.ready', {
                'mode': self.config.mode,
                'port': self.config.port,
                'framework': self.config.framework,
                'singleton_port': detection_result.port
            })
            ColorPrint.blue("[FrontendThread] Triggered THREAD_BUS event: frontend.ready")

            # Keep thread alive while process runs (dev mode only)
            # Monitor for shutdown requests while waiting
            if self.config.mode == "dev" and self.process:
                ColorPrint.blue("[FrontendThread] Monitoring process, waiting for shutdown or process exit...")
                while self.process and self.process.poll() is None:
                    # Check for shutdown request
                    # Note: stop() will be called by THREAD_BUS shutdown handler
                    # We just need to break from the loop to let the thread exit
                    if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
                        ColorPrint.yellow("[FrontendThread] Shutdown requested, exiting monitoring loop...")
                        # Break immediately - no mechanical wait!
                        # The shutdown handler will call stop() to terminate the process
                        break
                    time.sleep(0.5)

                ColorPrint.blue("[FrontendThread] Process monitoring loop exited")

        except Exception as e:
            ColorPrint.red(f"[FrontendThread] Unexpected error: {e}")
            self.error_message = str(e)
            self.error_event.set()
            import traceback
            traceback.print_exc()

        finally:
            self.running = False

            # Cleanup frontend process if still running
            # This ensures vite is stopped even if we exit early
            ColorPrint.blue("[FrontendThread] Cleaning up in finally block...")
            self.stop()

            # Cleanup singleton detector
            if self.singleton_detector:
                self.singleton_detector.stop()

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
            # Detect lock file based on package manager
            lock_files = {
                "pnpm": "pnpm-lock.yaml",
                "npm": "package-lock.json",
                "yarn": "yarn.lock"
            }
            lock_file_name = lock_files.get(self.config.package_manager, "pnpm-lock.yaml")
            lock_file = self.config.app_dir / lock_file_name

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
        Run package manager install (pnpm/npm/yarn)

        Returns:
            True if installation successful
        """
        # Use custom install_command or generate from package_manager
        if self.config.install_command:
            command = self.config.install_command
        else:
            pm = self.config.package_manager
            command = [pm, "install"]

        command = _resolve_command_for_platform(command)
        ColorPrint.blue(f"[FrontendThread] Running: {' '.join(command)}")

        process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )

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
        """
        # Check if we should build
        should_build = self._should_run_build()

        if not should_build:
            ColorPrint.yellow("[FrontendThread] Build skipped - output is up to date")
        else:
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
        Run production build (no timeout, ignores exit codes)

        Returns:
            True (always - let output verification handle success)
        """
        command = self._resolve_build_command()
        command = _resolve_command_for_platform(command)
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
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )

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

    def _handle_dev_mode(self):
        """
        Handle dev mode - start dev server (waits indefinitely for ready)
        """
        # Check shutdown BEFORE starting anything
        if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
            ColorPrint.yellow("[FrontendThread] Shutdown requested before _handle_dev_mode, exiting...")
            return

        ColorPrint.blue("[FrontendThread] Starting dev server...")

        # Step 0: Wait for frontend port to be available
        # Frontend singleton detection should have already triggered old instance shutdown
        # Wait for graceful shutdown instead of force killing
        ColorPrint.blue(f"[FrontendThread] Checking if port {self.config.port} is occupied...")
        from .port_killer import is_port_available

        if not is_port_available(self.config.port, self.config.host):
            ColorPrint.yellow(f"[FrontendThread] Port {self.config.port} is occupied")
            ColorPrint.blue(f"[FrontendThread] Waiting for old frontend instance to release port...")

            # Wait up to 10 seconds for port to be released (old instance shutting down)
            max_wait = 10.0
            wait_interval = 0.5
            waited = 0.0

            while waited < max_wait:
                # Check shutdown while waiting
                if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
                    ColorPrint.yellow("[FrontendThread] Shutdown requested while waiting for port, exiting...")
                    return

                time.sleep(wait_interval)
                waited += wait_interval

                if is_port_available(self.config.port, self.config.host):
                    ColorPrint.green(f"[FrontendThread] Port {self.config.port} released after {waited:.1f}s")
                    break
            else:
                # Port still occupied after timeout - old instance didn't exit
                # This means singleton takeover failed
                # Don't throw exception - just exit gracefully and let launcher retry
                ColorPrint.red(f"[FrontendThread] Port {self.config.port} still occupied after {max_wait}s")
                ColorPrint.red(f"[FrontendThread] Old instance did not release port - singleton takeover failed")
                ColorPrint.red(f"[FrontendThread] This instance will exit to avoid conflicts")
                self.error_message = f"Port {self.config.port} still in use - old instance not shutdown"
                self.error_event.set()
                return  # Exit gracefully instead of raising exception
        else:
            ColorPrint.green(f"[FrontendThread] Port {self.config.port} is available")

        # Final check before starting vite
        if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
            ColorPrint.yellow("[FrontendThread] Shutdown requested before starting vite, exiting...")
            return

        command = self._resolve_dev_command()
        command = _resolve_command_for_platform(command)
        env = self._build_env()

        ColorPrint.blue("[FrontendThread] " + "=" * 70)
        ColorPrint.cyan(f"[FrontendThread] STARTING VITE DEV SERVER")
        ColorPrint.cyan(f"[FrontendThread] Command: {' '.join(command)}")
        ColorPrint.cyan(f"[FrontendThread] Port: {self.config.port}")
        ColorPrint.cyan(f"[FrontendThread] Host: {self.config.host}")
        ColorPrint.blue("[FrontendThread] " + "=" * 70)

        # Start dev server with PIPE to prevent SIGPIPE and process blocking
        # We create a background thread to consume the output
        self.process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )

        # Start background thread to consume stdout (prevent blocking)
        def consume_output():
            try:
                for line in self.process.stdout:
                    stripped = line.strip()
                    if not stripped:
                        continue

                    # Always show important messages (ready, errors, warnings)
                    # even if show_output is False
                    is_important = any(keyword in stripped.lower() for keyword in [
                        'ready', 'vite v', 'local:', 'network:', 'error', 'warn',
                        'failed', 'port', 'http://'
                    ])

                    if is_important:
                        # Highlight important messages in cyan/green
                        if 'ready' in stripped.lower() or 'local:' in stripped.lower():
                            ColorPrint.green(f"  [vite] {stripped}")
                        elif 'error' in stripped.lower() or 'failed' in stripped.lower():
                            ColorPrint.red(f"  [vite] {stripped}")
                        elif 'warn' in stripped.lower():
                            ColorPrint.yellow(f"  [vite] {stripped}")
                        else:
                            ColorPrint.cyan(f"  [vite] {stripped}")
                    elif self.config.show_output:
                        # Show all other output in gray if show_output=True
                        ColorPrint.gray(f"  [vite] {stripped}")
            except:
                pass

        import threading
        output_thread = threading.Thread(target=consume_output, daemon=True)
        output_thread.start()

        ColorPrint.blue(f"[FrontendThread] Dev server started (PID: {self.process.pid})")

        # Wait for HTTP ready (no timeout)
        # If shutdown is requested during wait, abort immediately
        if not self._wait_for_http():
            ColorPrint.yellow("[FrontendThread] HTTP wait aborted due to shutdown request")
            return

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

        # Standard port/host variables
        env["PORT"] = str(self.config.port)
        env["HOST"] = self.config.host
        env["NUXT_PORT"] = str(self.config.port)
        env["NUXT_HOST"] = self.config.host
        env["VITE_PORT"] = str(self.config.port)  # For Vite
        env["VITE_HOST"] = self.config.host  # For Vite

        # Add custom environment variables (from config)
        if self.config.env_vars:
            for key, value in self.config.env_vars.items():
                env[key] = str(value)

        return env

    def _wait_for_http(self) -> bool:
        """
        Wait for HTTP server to be ready (no timeout, waits indefinitely)

        Returns:
            True if server is ready, False if shutdown requested
        """
        path = self.config.health_path
        host = "localhost"  # Always use localhost for health check
        port = self.config.port

        ColorPrint.blue(f"[FrontendThread] Waiting for frontend at http://{host}:{port}{path}")
        ColorPrint.yellow(f"[FrontendThread] No timeout set - will wait indefinitely...")

        check_count = 0
        while True:
            # Check for shutdown before attempting HTTP check
            if THREAD_BUS.is_shutdown_requested() or self._shutdown_requested.is_set():
                ColorPrint.yellow("[FrontendThread] Shutdown requested during HTTP wait, aborting...")
                return False

            check_count += 1
            if self._http_ok(host, port, path):
                ColorPrint.green(f"[FrontendThread] Frontend ready at http://{host}:{port}")
                return True

            # Log progress every 30 seconds (15 checks * 2 seconds)
            if check_count % 15 == 0:
                elapsed = check_count * 2
                ColorPrint.cyan(f"[FrontendThread] Still waiting... ({elapsed}s elapsed)")

            time.sleep(2)

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
        Wait for frontend to be ready (no timeout, waits indefinitely)

        Args:
            timeout: Ignored - kept for API compatibility

        Returns:
            True if ready, False if error
        """
        # Wait indefinitely for either ready or error
        self.ready_event.wait()

        if self.error_event.is_set():
            ColorPrint.red(f"[FrontendThread] Error: {self.error_message}")
            return False

        return True

    def stop(self):
        """Stop frontend process gracefully (thread-safe)"""
        with self._process_lock:
            if not self.process:
                ColorPrint.gray("[FrontendThread] No process to stop (already stopped or not started)")
                self.running = False
                return

            ColorPrint.yellow("[FrontendThread] Stopping frontend process...")

            try:
                pid = self.process.pid

                # Step 1: Send SIGTERM
                self.process.terminate()
                ColorPrint.blue(f"[FrontendThread] Sent SIGTERM to process {pid}")

                # Step 1.5: Close stdout/stderr pipes to allow process to exit
                # If pipes are not closed, process may hang waiting for pipe to be read
                try:
                    if self.process.stdout:
                        self.process.stdout.close()
                    if self.process.stderr:
                        self.process.stderr.close()
                except Exception as pipe_err:
                    ColorPrint.gray(f"[FrontendThread] Error closing pipes: {pipe_err}")

                # Step 2: Poll to check if process exited (don't assume fixed time)
                max_wait = 10.0
                interval = 0.5
                waited = 0.0

                while waited < max_wait:
                    # Check if process has exited
                    if self.process.poll() is not None:
                        ColorPrint.green(f"[FrontendThread] Process terminated gracefully after {waited:.1f}s")
                        break

                    time.sleep(interval)
                    waited += interval
                else:
                    # Timeout - need to force kill
                    # Don't use self.process.kill() - it has bugs
                    # Use os.kill with SIGKILL instead
                    ColorPrint.yellow(f"[FrontendThread] Graceful shutdown timeout after {max_wait}s")
                    ColorPrint.yellow(f"[FrontendThread] Force killing process {pid}...")

                    try:
                        import os
                        import signal
                        os.kill(pid, signal.SIGKILL)
                        ColorPrint.blue(f"[FrontendThread] Sent SIGKILL to process {pid}")

                        # Poll again to verify it's dead
                        killed_wait = 0.0
                        killed_max = 5.0

                        while killed_wait < killed_max:
                            if self.process.poll() is not None:
                                ColorPrint.green(f"[FrontendThread] Process force killed after {killed_wait:.1f}s")
                                break

                            time.sleep(0.5)
                            killed_wait += 0.5
                        else:
                            ColorPrint.red(f"[FrontendThread] Failed to kill process {pid} even with SIGKILL")

                    except ProcessLookupError:
                        ColorPrint.green("[FrontendThread] Process already exited")
                    except Exception as kill_err:
                        ColorPrint.red(f"[FrontendThread] Error killing process: {kill_err}")

            except Exception as e:
                ColorPrint.red(f"[FrontendThread] Error stopping process: {e}")
            finally:
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

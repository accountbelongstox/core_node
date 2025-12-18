"""
Universal Frontend Launcher

Supports Nuxt/React/Vite/Next style projects with a unified dev and production
workflow. Dev mode runs the framework dev server and blocks until HTTP is
reachable. Production mode runs the build command and exposes the static
directory for mounting or for the built-in static HTTP server.

Features:
- Automatic dependency installation with pnpm
- Output-based success detection (no exit code reliance)
- Smart build detection in production mode
- Relative path resolution

THREAD_BUS Integration:
- Checks is_shutdown_requested() in wait loops
- Registers shutdown handler for static server if started
- No persistent service threads (utility class)
- Backwards compatible: keeps existing functionality
"""

import os
import re
import socket
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.color_print import ColorPrint
import threading
import time
from dataclasses import dataclass
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import List, Optional, Tuple
import subprocess


@dataclass
class UniversalFrontendConfig:
    """
    Universal frontend configuration

    Attributes:
        app_name: Application name, used for logs and default paths
        framework: One of nuxt|react|vite|next
        app_dir: Path to the frontend project root (can be absolute or relative)
        port: Dev server port
        host: Dev server host
        mode: dev|production
        dev_command: Override dev command list; tokens like {port} and {host} are formatted
        build_command: Override build command list; tokens like {port} are formatted
        install_command: Override install command list (default: pnpm install)
        static_dir: Production static directory path (e.g., dist, .output/public)
        output_dir: Production output directory (optional)
        health_path: HTTP path used for readiness probe
        skip_build: Skip build in production (use existing static_dir)
        force_rebuild: Force rebuild even if output exists
        auto_install: Automatically run pnpm install if needed (default: True)
        smart_build: Only build if source files are newer than output (default: True)
        health_check_timeout: Seconds to wait for readiness in dev mode
        show_output: Whether to stream child process stdout/stderr
    """
    app_name: str
    framework: str
    app_dir: Path
    port: int = 3000
    host: str = "0.0.0.0"
    mode: str = "production"
    dev_command: Optional[List[str]] = None
    build_command: Optional[List[str]] = None
    install_command: Optional[List[str]] = None
    static_dir: Optional[Path] = None
    output_dir: Optional[Path] = None
    health_path: str = "/"
    skip_build: bool = False
    force_rebuild: bool = False
    auto_install: bool = True
    smart_build: bool = True
    health_check_timeout: int = 120
    show_output: bool = True

    def __post_init__(self):
        if self.mode not in ("dev", "production"):
            raise ValueError("mode must be 'dev' or 'production'")
        framework_lower = self.framework.lower()
        if framework_lower not in ("nuxt", "react", "vite", "next"):
            raise ValueError("framework must be one of: nuxt, react, vite, next")
        self.framework = framework_lower

        # Convert to absolute path and resolve relative paths
        self.app_dir = Path(self.app_dir).resolve()
        if not self.app_dir.exists():
            raise ValueError(f"app_dir does not exist: {self.app_dir}")

        # Set default directories relative to app_dir
        if self.static_dir is None:
            self.static_dir = self._default_static_dir()
        else:
            self.static_dir = self.app_dir / self.static_dir if not Path(self.static_dir).is_absolute() else Path(self.static_dir)

        if self.output_dir is None:
            self.output_dir = self._default_output_dir()
        else:
            self.output_dir = self.app_dir / self.output_dir if not Path(self.output_dir).is_absolute() else Path(self.output_dir)

    def _default_static_dir(self) -> Path:
        if self.framework == "nuxt":
            return self.app_dir / ".output" / "public"
        if self.framework == "next":
            return self.app_dir / ".next" / "static"
        return self.app_dir / "dist"

    def _default_output_dir(self) -> Path:
        if self.framework == "nuxt":
            return self.app_dir / ".output"
        if self.framework == "next":
            return self.app_dir / ".next"
        return self.app_dir / "dist"


class UniversalFrontendLauncher:
    """Unified launcher for Nuxt/React/Vite/Next applications."""

    def __init__(self, config: UniversalFrontendConfig):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self._static_http_thread: Optional[threading.Thread] = None
        self._static_server: Optional[ThreadingHTTPServer] = None
        self._last_install_check: Optional[float] = None

    def start_dev_and_wait(self) -> bool:
        """Start dev server and block until HTTP responds."""
        # Auto-install dependencies if needed
        if self.config.auto_install and not self._ensure_dependencies_installed():
            ColorPrint.red("[UniversalFrontend] Dependency installation failed")
            return False

        command = self._resolve_dev_command()
        env = self._build_env()
        stdout = None if self.config.show_output else subprocess.DEVNULL
        stderr = None if self.config.show_output else subprocess.DEVNULL
        self.process = subprocess.Popen(command, cwd=str(self.config.app_dir), env=env, stdout=stdout, stderr=stderr)
        ColorPrint.blue(f"[UniversalFrontend] Dev server started (pid={self.process.pid})")
        return self._wait_for_http_ready()

    def build_production(self) -> bool:
        """Run production build and verify static assets."""
        # Auto-install dependencies if needed
        if self.config.auto_install and not self._ensure_dependencies_installed():
            ColorPrint.red("[UniversalFrontend] Dependency installation failed")
            return False

        # Check if build is needed
        should_build = self._should_run_build()
        if not should_build:
            ColorPrint.yellow("[UniversalFrontend] Build skipped - output is up to date")
        else:
            if not self._run_build():
                ColorPrint.red("[UniversalFrontend] Build failed")
                return False

        # Verify output directories exist
        output_exists = self.config.output_dir.exists()
        static_exists = self.config.static_dir.exists()
        if not output_exists:
            ColorPrint.red(f"[UniversalFrontend] Output directory missing: {self.config.output_dir}")
        if not static_exists:
            ColorPrint.red(f"[UniversalFrontend] Static directory missing: {self.config.static_dir}")
        return output_exists and static_exists

    def start_static_server(self, port: int, host: str = "0.0.0.0") -> bool:
        """
        Serve built static files via built-in HTTP server.

        THREAD_BUS Integration:
        - Registers shutdown handler to stop static server gracefully
        """
        if not self.config.static_dir.exists():
            ColorPrint.red(f"[UniversalFrontend] Cannot start static server, static_dir missing: {self.config.static_dir}")
            return False
        handler = self._build_static_handler(self.config.static_dir)
        server = ThreadingHTTPServer((host, port), handler)
        self._static_server = server
        thread = threading.Thread(target=server.serve_forever, name="UniversalFrontendStaticServer", daemon=True)
        thread.start()
        self._static_http_thread = thread

        # THREAD_BUS Integration: Register shutdown handler
        # Priority=60 for auxiliary services (stops before main services)
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=60,
            name=f"universal_frontend_static_{self.config.app_name}"
        )
        ColorPrint.blue(f"[UniversalFrontend] Registered THREAD_BUS shutdown handler (priority=60)")

        ColorPrint.green(f"[UniversalFrontend] Static server running at http://{host}:{port}")
        return True

    def stop(self):
        """Stop dev process and static server if running."""
        if self.process is not None:
            self.process.terminate()
            self.process.wait(timeout=10)
            self.process = None
        if self._static_server is not None:
            self._static_server.shutdown()
            self._static_server.server_close()
            self._static_server = None
        self._static_http_thread = None

    def get_static_mount(self, url_prefix: str = "/") -> Optional[dict]:
        """Return mount info for external HTTP routers."""
        if not self.config.static_dir.exists():
            return None
        return {
            "url_prefix": url_prefix,
            "directory": str(self.config.static_dir),
            "name": f"{self.config.app_name}-static"
        }

    def _resolve_dev_command(self) -> List[str]:
        if self.config.dev_command:
            return self._format_tokens(self.config.dev_command)
        if self.config.framework == "nuxt":
            return ["npx", "nuxi", "dev", "--hostname", self.config.host, "--port", str(self.config.port)]
        if self.config.framework == "next":
            return ["npx", "next", "dev", "-H", self.config.host, "-p", str(self.config.port)]
        if self.config.framework == "react":
            return ["npm", "run", "start", "--", "--host", self.config.host, "--port", str(self.config.port)]
        return ["npm", "run", "dev", "--", "--host", self.config.host, "--port", str(self.config.port)]

    def _resolve_build_command(self) -> List[str]:
        if self.config.build_command:
            return self._format_tokens(self.config.build_command)
        if self.config.framework == "nuxt":
            command = ["npx", "nuxi", "build"]
            if self.config.force_rebuild:
                command.append("--force")
            return command
        if self.config.framework == "next":
            return ["npx", "next", "build"]
        return ["npm", "run", "build"]

    def _format_tokens(self, command: List[str]) -> List[str]:
        formatted = []
        for token in command:
            formatted.append(token.format(
                port=self.config.port,
                host=self.config.host,
                app=self.config.app_name
            ))
        return formatted

    def _build_env(self) -> dict:
        env = os.environ.copy()
        env["PORT"] = str(self.config.port)
        env["HOST"] = self.config.host
        env["NUXT_PORT"] = str(self.config.port)
        env["NUXT_HOST"] = self.config.host
        return env

    def _wait_for_http_ready(self) -> bool:
        """
        Wait for HTTP server to become ready

        THREAD_BUS Integration:
        - Checks is_shutdown_requested() to exit early during shutdown
        """
        deadline = time.time() + self.config.health_check_timeout
        path = self.config.health_path or "/"
        host = self.config.host
        port = self.config.port
        while time.time() < deadline:
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow("[UniversalFrontend] THREAD_BUS shutdown detected, stopping health check...")
                return False

            if self._http_ok(host, port, path):
                ColorPrint.green(f"[UniversalFrontend] Frontend ready at http://{host}:{port}{path}")
                return True
            time.sleep(1.5)
        ColorPrint.red(f"[UniversalFrontend] Frontend not ready after {self.config.health_check_timeout}s")
        return False

    def _http_ok(self, host: str, port: int, path: str) -> bool:
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

    def _build_static_handler(self, directory: Path):
        class StaticHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(directory), **kwargs)
        return StaticHandler

    def _ensure_dependencies_installed(self) -> bool:
        """
        Check if dependencies are installed and install them if needed.
        Returns True if dependencies are ready, False otherwise.
        """
        node_modules = self.config.app_dir / "node_modules"
        package_json = self.config.app_dir / "package.json"
        pnpm_lock = self.config.app_dir / "pnpm-lock.yaml"

        # Check if package.json exists
        if not package_json.exists():
            ColorPrint.yellow("[UniversalFrontend] No package.json found, skipping dependency check")
            return True

        # Check if node_modules exists
        if not node_modules.exists():
            ColorPrint.blue("[UniversalFrontend] node_modules not found, installing dependencies...")
            return self._run_install()

        # Check if pnpm-lock.yaml is newer than node_modules
        if pnpm_lock.exists():
            lock_mtime = pnpm_lock.stat().st_mtime
            modules_mtime = node_modules.stat().st_mtime
            if lock_mtime > modules_mtime:
                ColorPrint.blue("[UniversalFrontend] Lock file updated, reinstalling dependencies...")
                return self._run_install()

        ColorPrint.green("[UniversalFrontend] Dependencies already installed")
        return True

    def _run_install(self) -> bool:
        """Run pnpm install and verify success through output parsing."""
        command = self.config.install_command or ["pnpm", "install"]
        ColorPrint.blue(f"[UniversalFrontend] Running: {' '.join(command)}")

        process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        output_lines = []
        success_indicators = [
            "dependencies are up to date",
            "done in",
            "packages installed",
            "already up-to-date",
            "✓"
        ]

        # Stream and collect output
        for line in process.stdout:
            stripped = line.strip()
            if stripped:
                output_lines.append(stripped)
                if self.config.show_output:
                    print(f"  {stripped}")

        process.wait()

        # Parse output to detect success (don't rely on exit code)
        full_output = "\n".join(output_lines).lower()
        success = any(indicator in full_output for indicator in success_indicators)

        # Verify node_modules directory was created
        node_modules_exists = (self.config.app_dir / "node_modules").exists()

        if success and node_modules_exists:
            ColorPrint.green("[UniversalFrontend] Dependencies installed successfully")
            return True
        else:
            ColorPrint.red("[UniversalFrontend] Dependency installation verification failed")
            if not node_modules_exists:
                ColorPrint.red("[UniversalFrontend] node_modules directory not found after install")
            return False

    def _should_run_build(self) -> bool:
        """Determine if build should run based on smart_build logic."""
        # Force rebuild overrides everything
        if self.config.force_rebuild:
            ColorPrint.blue("[UniversalFrontend] Force rebuild enabled")
            return True

        # Skip build overrides everything
        if self.config.skip_build:
            ColorPrint.blue("[UniversalFrontend] Skip build enabled")
            return False

        # If output doesn't exist, must build
        if not self.config.output_dir.exists():
            ColorPrint.blue("[UniversalFrontend] Output directory missing, build required")
            return True

        # If smart_build is disabled, always build
        if not self.config.smart_build:
            ColorPrint.blue("[UniversalFrontend] Smart build disabled, building")
            return True

        # Smart build: check if source files are newer than output
        source_patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.vue", "package.json"]
        newest_source_time = 0.0

        for pattern in source_patterns:
            for source_file in self.config.app_dir.glob(pattern):
                # Skip files in output and node_modules
                if str(self.config.output_dir) in str(source_file):
                    continue
                if "node_modules" in str(source_file):
                    continue
                if source_file.is_file():
                    file_mtime = source_file.stat().st_mtime
                    if file_mtime > newest_source_time:
                        newest_source_time = file_mtime

        # Get output directory modification time
        output_mtime = self.config.output_dir.stat().st_mtime

        if newest_source_time > output_mtime:
            ColorPrint.blue("[UniversalFrontend] Source files newer than output, build required")
            return True

        ColorPrint.blue("[UniversalFrontend] Output is up to date")
        return False

    def _run_build(self) -> bool:
        """Run build command and verify success through output parsing."""
        command = self._resolve_build_command()
        env = self._build_env()
        ColorPrint.blue(f"[UniversalFrontend] Running build: {' '.join(command)}")

        process = subprocess.Popen(
            command,
            cwd=str(self.config.app_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        output_lines = []
        success_indicators = [
            "build complete",
            "compiled successfully",
            "built in",
            "✓ built",
            "done in",
            "build succeeded"
        ]
        error_indicators = [
            "error:",
            "failed",
            "exception",
            "fatal"
        ]

        # Stream and collect output
        for line in process.stdout:
            stripped = line.strip()
            if stripped:
                output_lines.append(stripped)
                if self.config.show_output:
                    print(f"  {stripped}")

        process.wait()

        # Parse output to detect success/failure
        full_output = "\n".join(output_lines).lower()
        has_success = any(indicator in full_output for indicator in success_indicators)
        has_error = any(indicator in full_output for indicator in error_indicators)

        # Verify output directory was created
        output_exists = self.config.output_dir.exists()

        if has_success and output_exists and not has_error:
            ColorPrint.green("[UniversalFrontend] Build completed successfully")
            return True
        else:
            if has_error:
                ColorPrint.red("[UniversalFrontend] Build output contains errors")
            if not output_exists:
                ColorPrint.red(f"[UniversalFrontend] Output directory not found: {self.config.output_dir}")
            return False

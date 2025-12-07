#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Configuration

Unified frontend configuration for native UI applications.
Adapted from pycore.pyutils.frontend_launcher but integrated into native_ui.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Literal


@dataclass
class FrontendConfig:
    """
    Frontend configuration for native UI applications

    Supports: Nuxt | React | Vite | Next

    Attributes:
        enabled: Whether to start frontend (False = no frontend management)
        framework: Frontend framework type
        app_dir: Frontend project directory (absolute or relative to project_root)
        mode: dev or production
        port: Frontend dev server port
        host: Frontend dev server host
        auto_install: Auto-install dependencies (pnpm install)
        skip_build: Skip build in production mode (use existing)
        force_rebuild: Force rebuild in production mode
        smart_build: Only build if source files are newer
        dev_command: Override dev command
        build_command: Override build command
        static_dir: Production static directory (relative to app_dir)
        output_dir: Production output directory (relative to app_dir)
        health_check_timeout: Seconds to wait for readiness
        show_output: Show frontend process output
        block_until_ready: Block until frontend is ready (debug mode)
    """

    # Core settings
    enabled: bool = False
    """Whether to start frontend service"""

    framework: Literal["nuxt", "react", "react-native", "vite", "vue", "next", "nexus"] = "vite"
    """Frontend framework type (nuxt|react|react-native|vite|vue|next|nexus)"""

    app_dir: Optional[Path] = None
    """Frontend project directory (required if enabled=True)"""

    mode: Literal["dev", "production"] = "production"
    """Frontend mode"""

    # Network settings
    port: int = 3000
    """Frontend dev server port"""

    host: str = "0.0.0.0"
    """Frontend dev server host"""

    # Build settings
    auto_install: bool = True
<<<<<<< HEAD
=======
<<<<<<< HEAD
    """Auto-install dependencies with pnpm"""
=======
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
    """Auto-install dependencies"""

    package_manager: Literal["pnpm", "npm", "yarn"] = "pnpm"
    """Package manager to use (pnpm|npm|yarn). Default: pnpm"""
<<<<<<< HEAD
=======
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

    skip_build: bool = False
    """Skip build in production mode"""

    force_rebuild: bool = False
    """Force rebuild in production mode"""

    smart_build: bool = True
    """Only build if source files changed"""

    # Custom commands (optional)
    dev_command: Optional[List[str]] = None
    """Override dev command (e.g., ['npm', 'run', 'dev'])"""

    build_command: Optional[List[str]] = None
    """Override build command (e.g., ['npm', 'run', 'build'])"""

    install_command: Optional[List[str]] = None
<<<<<<< HEAD
    """Override install command (auto-generated from package_manager if None)"""
=======
<<<<<<< HEAD
    """Override install command (default: ['pnpm', 'install'])"""
=======
    """Override install command (auto-generated from package_manager if None)"""
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

    # Output directories
    static_dir: Optional[Path] = None
    """Static directory path (relative to app_dir, auto-detected if None)"""

    output_dir: Optional[Path] = None
    """Output directory path (relative to app_dir, auto-detected if None)"""

    # Health check
    health_path: str = "/"
    """HTTP path for health check"""

    health_check_timeout: int = 120
<<<<<<< HEAD
    """Deprecated - no longer used. Frontend now waits indefinitely for readiness."""
=======
<<<<<<< HEAD
    """Seconds to wait for frontend to be ready"""
=======
    """Deprecated - no longer used. Frontend now waits indefinitely for readiness."""
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

    # Debug settings
    show_output: bool = True
    """Show frontend process output"""

    block_until_ready: bool = False
    """Block until frontend is ready (useful for debug mode)"""

<<<<<<< HEAD
=======
<<<<<<< HEAD
=======
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
    # Environment variables
    env_vars: Optional[dict] = None
    """Custom environment variables to pass to frontend process"""

<<<<<<< HEAD
=======
>>>>>>> 84af4ea25b9227227201b8adaa090ef48e754973
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
    def __post_init__(self):
        """Validate and normalize configuration"""
        if not self.enabled:
            return

        # Validate required fields
        if self.app_dir is None:
            raise ValueError("app_dir is required when frontend.enabled=True")

        # Convert app_dir to absolute path
        self.app_dir = Path(self.app_dir).resolve()
        if not self.app_dir.exists():
            raise ValueError(f"Frontend app_dir does not exist: {self.app_dir}")

        # Validate framework
        valid_frameworks = ("nuxt", "react", "react-native", "vite", "vue", "next", "nexus")
        if self.framework not in valid_frameworks:
            raise ValueError(f"Invalid framework: {self.framework}. Supported: {valid_frameworks}")

        # Validate mode
        if self.mode not in ("dev", "production"):
            raise ValueError(f"Invalid mode: {self.mode}")

        # Auto-detect static_dir if not specified
        if self.static_dir is None:
            self.static_dir = self._default_static_dir()
        else:
            # Make relative to app_dir
            if not Path(self.static_dir).is_absolute():
                self.static_dir = self.app_dir / self.static_dir

        # Auto-detect output_dir if not specified
        if self.output_dir is None:
            self.output_dir = self._default_output_dir()
        else:
            # Make relative to app_dir
            if not Path(self.output_dir).is_absolute():
                self.output_dir = self.app_dir / self.output_dir

    def _default_static_dir(self) -> Path:
        """Get default static directory based on framework"""
        if self.framework == "nuxt":
            return self.app_dir / ".output" / "public"
        if self.framework == "next":
            return self.app_dir / ".next" / "static"
        if self.framework == "nexus":
            return self.app_dir / ".next" / "static"
        if self.framework == "vue":
            return self.app_dir / "dist"
        if self.framework == "react-native":
            # React Native Web build output
            return self.app_dir / "web-build"
        # React/Vite default
        return self.app_dir / "dist"

    def _default_output_dir(self) -> Path:
        """Get default output directory based on framework"""
        if self.framework == "nuxt":
            return self.app_dir / ".output"
        if self.framework == "next":
            return self.app_dir / ".next"
        if self.framework == "nexus":
            return self.app_dir / ".next"
        if self.framework == "vue":
            return self.app_dir / "dist"
        if self.framework == "react-native":
            return self.app_dir / "web-build"
        # React/Vite default
        return self.app_dir / "dist"

    def get_dev_url(self) -> str:
        """Get frontend dev server URL"""
        return f"http://localhost:{self.port}"

    def to_dict(self) -> dict:
        """Convert to dictionary for logging"""
        return {
            'enabled': self.enabled,
            'framework': self.framework,
            'app_dir': str(self.app_dir) if self.app_dir else None,
            'mode': self.mode,
            'port': self.port,
            'host': self.host,
            'auto_install': self.auto_install,
            'static_dir': str(self.static_dir) if self.static_dir else None,
            'block_until_ready': self.block_until_ready,
        }

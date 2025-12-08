#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Application Configuration

Unified configuration dataclass for native UI applications.
Simplifies application launch with sensible defaults.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional, List, Dict, Tuple, Union, Literal
from pathlib import Path


@dataclass
class NativeUIConfig:
    """
    Native UI application configuration

    This is the single configuration class for launching native UI applications.
    All parameters have sensible defaults.

    Example:
        config = NativeUIConfig(
            app_id="matrix",
            app_name="Matrix Application",
            main_entry=main_app_entry,
            url="http://localhost:3000"
        )
        launch_native_app(config)
    """

    # ========== Required Parameters ==========
    app_id: str
    """Application unique identifier (for singleton detection)"""

    app_name: str
    """Application display name (supports i18n keys like 'matrix.app_name')"""

    main_entry: Callable
    """Main application entry function (called after startup)"""

    # ========== Debug Window ==========
    show_debug_window: bool = True
    """Whether to show debug log window during startup"""

    debug_window_width: int = 650
    """Debug window width in pixels"""

    debug_window_height: int = 500
    """Debug window height in pixels"""

    min_display_time: float = 2.0
    """Minimum time to display debug window (seconds)"""

    # ========== System Tray ==========
    enable_tray: bool = False
    """Whether to enable system tray icon"""

    tray_type: Literal["tk", "pyside6"] = "pyside6"
    """Tray implementation type"""

    tray_menu_items: List[Dict] = field(default_factory=list)
    """
    Tray menu items (list of dicts with 'text' and 'callback' keys)

    Example:
        [
            {"text": "Open Frontend", "callback": open_frontend_func},
            {"text": "Open API Docs", "callback": open_docs_func}
        ]
    """

    minimize_to_tray: bool = True
    """Minimize to tray instead of closing"""

    # ========== Main Window URL ==========
    url: str = ""
    """
    Main window URL (supports multiple types)

    Examples:
        - Remote: "http://localhost:3000"
        - Static: "file:///path/to/index.html" or "path/to/index.html"
        - Nuxt app: "app_pymatrix"
        - Vue dist: "/path/to/dist"
    """

    url_type: Literal["remote", "static", "nuxt_app", "vue_dist", "auto"] = "auto"
    """
    URL type (auto-detected if 'auto')

    Types:
        - remote: Remote HTTP/HTTPS URL
        - static: Local static HTML file
        - nuxt_app: Nuxt application (auto-starts dev server)
        - vue_dist: Vue build distribution directory
        - auto: Automatic detection based on URL string
    """

    # ========== UI Style ==========
    window_size: Union[Tuple[int, int], Literal["fullscreen"]] = (1280, 900)
    """Window size (width, height) or 'fullscreen'"""

    show_on_start: bool = True
    """Whether to show window immediately on start (False = starts hidden)"""

    frameless: bool = True
    """Frameless window (custom title bar)"""

    loading_style: int = 10
    """Loading animation style (1-14)"""

    window_title_key: Optional[str] = None
    """
    Window title i18n key (fixed format)

    Auto-generated as "{app_id}.window.title" if not provided.
    This is a STANDARD key that should exist in all translation files.

    Example:
        window_title_key="matrix.window.title"
        translations_zh.json: {"matrix.window.title": "星灿传媒科技-云矩阵"}
        translations_en.json: {"matrix.window.title": "Xingcan Cloud Matrix"}
    """

    # ========== Icons and Logo ==========
    icon_path: Optional[str] = None
    """Window icon path (.ico or .png), auto-detected if None"""

    logo_path: Optional[str] = None
    """Logo image path (.png), auto-detected if None"""

    logo_size: int = 24
    """Logo size in pixels"""

    # ========== Multi-Language ==========
    enable_language_selector: bool = True
    """Enable language selector in debug window"""

    # ========== Callbacks (Queue-based) ==========
    on_ready_callbacks: List[Callable] = field(default_factory=list)
    """
    Callback queue when UI is ready

    Native UI will execute built-in ready logic first, then user callbacks.
    Example: [callback1, callback2, callback3]
    """

    on_closed_callbacks: List[Callable] = field(default_factory=list)
    """
    Callback queue when UI is closed

    Native UI will execute built-in cleanup first, then user callbacks.
    Example: [callback1, callback2, callback3]
    """

    on_closing_callbacks: List[Callable] = field(default_factory=list)
    """
    Callback queue before UI closes (for cleanup)

    Native UI will execute user callbacks first, then built-in cleanup.
    Example: [stop_services, cleanup_resources, save_state]
    """

    # ========== Frontend Management ==========
    frontend_enabled: bool = False
    """Enable integrated frontend launcher"""

    frontend_framework: Optional[str] = None
    """Frontend framework (nuxt|react|react-native|vite|vue|next|nexus)"""

    frontend_app_dir: Optional[Path] = None
    """Frontend project directory (absolute or relative to project_root)"""

    frontend_mode: str = "production"
    """Frontend mode (dev|production)"""

    frontend_port: int = 3000
    """Frontend dev server port"""

    frontend_auto_install: bool = True
    """Auto-install frontend dependencies"""

    frontend_package_manager: str = "pnpm"
    """Package manager to use (pnpm|npm|yarn). Default: pnpm"""

    frontend_skip_build: bool = False
    """Skip build in production mode (use existing build)"""

    frontend_block_until_ready: bool = False
    """Block until frontend is ready (useful for debug mode)"""

    # ========== RPC v2 Management ==========
    rpc_enabled: bool = False
    """Enable RPC v2 backend service"""

    rpc_port: int = 8000
    """RPC v2 service port"""

    rpc_host: str = "0.0.0.0"
    """RPC v2 service host"""

    rpc_debug: bool = True
    """RPC v2 debug mode"""

    rpc_routers: List = field(default_factory=list)
    """
    FastAPI router list (passed to RPC v2)

    Example:
        from my_app.api import user_router, data_router
        rpc_routers = [user_router, data_router]
    """

    rpc_allow_origins: List[str] = field(default_factory=lambda: ["*"])
    """CORS allowed origins list"""

    rpc_init_callback: Optional[Callable] = None
    """
    Optional callback function to initialize RPC v2 routes

    Called after RPC v2 server is created, before it starts accepting connections.
    Signature: def callback(rpc_server) -> None

    Example:
        def init_routes(rpc_server):
            rpc_server.route('my.route', my_handler)

        config = NativeUIConfig(
            rpc_init_callback=init_routes
        )
    """

    rpc_auto_mount_frontend: bool = True
    """
    Auto-mount frontend static files (from frontend_thread)

    If enabled:
    - Production mode: RPC v2 will mount compiled frontend at '/'
    - Dev mode: RPC v2 only serves API (frontend runs on separate port)
    """

    # ========== Timer Management ==========
    enable_timer: bool = False
    """Enable built-in timer manager (singleton, auto-started)"""

    # ========== Restart Support ==========
    enable_restart: bool = False
    """Enable restart functionality"""

    on_restart_callback: Optional[Callable] = None
    """Callback when restart is triggered (optional custom logic)"""

    # ========== Advanced Options ==========
    force: bool = False
    """Force close existing instance if found"""

    debug: bool = False
    """Enable debug output"""

    project_root: Optional[Path] = None
    """Project root directory (auto-detected if None)"""

    def validate(self) -> None:
        """
        Validate configuration

        Raises:
            ValueError: If configuration is invalid
        """
        # Required fields
        if not self.app_id:
            raise ValueError("app_id is required")
        if not self.app_name:
            raise ValueError("app_name is required")
        if not callable(self.main_entry):
            raise ValueError("main_entry must be a callable function")

        # Window size validation
        if isinstance(self.window_size, tuple):
            if len(self.window_size) != 2:
                raise ValueError("window_size must be (width, height) or 'fullscreen'")
            width, height = self.window_size
            if width <= 0 or height <= 0:
                raise ValueError("window_size dimensions must be positive")

        # Loading style validation
        if not (1 <= self.loading_style <= 14):
            raise ValueError("loading_style must be between 1 and 14")

        # Tray type validation
        if self.tray_type not in ("tk", "pyside6"):
            raise ValueError("tray_type must be 'tk' or 'pyside6'")

        # URL type validation
        if self.url_type not in ("remote", "static", "nuxt_app", "vue_dist", "auto"):
            raise ValueError(
                "url_type must be 'remote', 'static', 'nuxt_app', 'vue_dist', or 'auto'"
            )

        # Frontend validation
        if self.frontend_enabled:
            if not self.frontend_framework:
                raise ValueError("frontend_framework is required when frontend_enabled=True")
            if not self.frontend_app_dir:
                raise ValueError("frontend_app_dir is required when frontend_enabled=True")

            valid_frameworks = ("nuxt", "react", "react-native", "vite", "vue", "next", "nexus")
            if self.frontend_framework not in valid_frameworks:
                raise ValueError(f"frontend_framework must be one of: {valid_frameworks}")

            if self.frontend_mode not in ("dev", "production"):
                raise ValueError("frontend_mode must be 'dev' or 'production'")

        # RPC v2 validation
        if self.rpc_enabled:
            if self.rpc_port <= 0 or self.rpc_port > 65535:
                raise ValueError("rpc_port must be between 1 and 65535")

            if not self.rpc_host:
                raise ValueError("rpc_host cannot be empty when rpc_enabled=True")

            # Validate routers are provided (though empty list is allowed for testing)
            if not isinstance(self.rpc_routers, list):
                raise ValueError("rpc_routers must be a list")

            # Validate allow_origins
            if not isinstance(self.rpc_allow_origins, list):
                raise ValueError("rpc_allow_origins must be a list")

    def auto_detect_paths(self) -> None:
        """
        Auto-detect icon and logo paths if not provided

        Searches in: pyapps/{app_id}/icon.ico
        """
        if self.project_root is None:
            # Auto-detect project root (4 levels up from this file)
            self.project_root = Path(__file__).parent.parent.parent.parent.parent

        app_dir = self.project_root / "pyapps" / self.app_id

        # Auto-detect icon path
        if self.icon_path is None:
            icon_ico = app_dir / "icon.ico"
            if icon_ico.exists():
                self.icon_path = str(icon_ico)
                if self.debug:
                    from pycore import ColorPrint
                    ColorPrint.print_info(f"[Config] Auto-detected icon: {self.icon_path}")

        # Auto-detect logo path (same as icon by default)
        if self.logo_path is None:
            if self.icon_path:
                self.logo_path = self.icon_path

    def __post_init__(self):
        """Post-initialization: validate, auto-detect paths, and generate keys"""
        self.validate()
        self.auto_detect_paths()
        self._generate_keys()

    def _generate_keys(self) -> None:
        """
        Generate standard i18n keys if not provided

        Standard keys:
        - window_title_key: "{app_id}.window.title"
        """
        # Auto-generate window title key
        if self.window_title_key is None:
            self.window_title_key = f"{self.app_id}.window.title"
            if self.debug:
                from pycore import ColorPrint
                ColorPrint.print_info(
                    f"[Config] Auto-generated window title key: {self.window_title_key}"
                )


# Convenience type alias
# DEPRECATED: Use TrayMenuItemDict instead to avoid conflict with tray_config.TrayMenuItem
TrayMenuItemDict = Dict[str, Union[str, Callable]]
"""Type alias for simple tray menu item dict: {'text': str, 'callback': Callable}"""

# Keep old name for backward compatibility but mark as deprecated
TrayMenuItem = TrayMenuItemDict
"""
DEPRECATED: Use TrayMenuItemDict instead.
This conflicts with tray_config.TrayMenuItem dataclass.
Type alias for simple tray menu item dict: {'text': str, 'callback': Callable}
"""

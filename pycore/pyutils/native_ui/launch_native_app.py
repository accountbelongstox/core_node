#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native App Launcher - Simplified Main Entry Point

Unified entry point for launching native UI applications.
Handles all complexity internally:
- Auto port allocation
- Singleton detection
- i18n initialization
- Debug window
- URL processing
- PySide6 UI creation
- System tray

Usage:
    from pycore.pyutils.native_ui import launch_native_app, NativeUIConfig

    config = NativeUIConfig(
        app_id="matrix",
        app_name="Matrix Application",
        main_entry=main_app_entry,
        url="http://localhost:3000"
    )
    launch_native_app(config)
"""

from typing import Optional
from pathlib import Path

from pycore.pyfoundations import ColorPrint
from pycore.pyutils.native_ui.app_config import NativeUIConfig
from pycore.pyutils.native_ui.port_allocator import get_port_range
from pycore.pyutils.native_ui.url_handler import process_url


def launch_native_app(config: NativeUIConfig) -> None:
    """
    Launch native UI application with simplified API

    This is the main entry point for launching applications with Native UI.
    All complexity is handled internally.

    Args:
        config: NativeUIConfig instance with application configuration

    Example:
        config = NativeUIConfig(
            app_id="matrix",
            app_name="Matrix Application",
            main_entry=main_app_entry,
            url="http://localhost:3000",
            enable_tray=True
        )
        launch_native_app(config)

    Features:
        - Auto port allocation based on app_id
        - Singleton detection (prevents duplicate instances)
        - Auto i18n initialization (if {appname}_i18n/ exists)
        - Debug window with logs (optional)
        - URL processing (remote/static/nuxt/vue)
        - PySide6 main window
        - System tray (optional)

    Raises:
        ValueError: If configuration is invalid
        RuntimeError: If launch fails
    """
    # Validate configuration
    try:
        config.validate()
    except ValueError as e:
        ColorPrint.red(f"[NativeApp] Configuration error: {e}")
        raise

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(f" {config.app_name.upper()} - LAUNCHING")
    ColorPrint.blue("=" * 70)
    ColorPrint.white("")

    # ========== Step 1: Auto port allocation ==========
    port_start, port_range = get_port_range(config.app_id, debug=config.debug)

    if config.debug:
        ColorPrint.blue(
            f"[NativeApp] Port range: {port_start}-{port_start + port_range - 1}"
        )

    # ========== Step 2: Auto i18n initialization ==========
    _initialize_i18n(config)

    # ========== Step 3: Process URL ==========
    final_url, detected_url_type, url_metadata = process_url(
        url=config.url,
        url_type=config.url_type,
        project_root=config.project_root,
        debug=config.debug
    )

    if config.debug:
        ColorPrint.blue(f"[NativeApp] Final URL: {final_url}")
        ColorPrint.blue(f"[NativeApp] URL type: {detected_url_type}")
        if url_metadata:
            ColorPrint.blue(f"[NativeApp] URL metadata: {url_metadata}")

    # ========== Step 4: Create launcher and detect singleton ==========
    from pycore.pylauncher import NativeUILauncher, LaunchMode

    launcher = NativeUILauncher(
        app_id=config.app_id,
        port_start=port_start,
        port_range=port_range,
        debug=config.debug
    )

    # Determine launch mode
    if config.enable_tray and config.show_debug_window:
        mode = LaunchMode.DEBUG_WITH_TRAY
    elif config.enable_tray:
        mode = LaunchMode.TRAY_ONLY
    elif config.show_debug_window:
        mode = LaunchMode.DEBUG_ONLY
    else:
        mode = LaunchMode.PRODUCTION

    # Get app name (resolve i18n if needed)
    app_name_display = _resolve_i18n_text(config.app_name)

    # ========== Step 5: Launch application ==========
    # TODO: This still uses the old launcher.launch() API
    # TODO: Need to integrate URL processing into the launch flow
    # TODO: Pass config.url to PySide6 UI

    ColorPrint.yellow("[NativeApp] TODO: Complete integration with new URL system")
    ColorPrint.yellow("[NativeApp] TODO: Pass final_url to PySide6 WebView")

    result = launcher.launch(
        app_name=app_name_display,
        main_entry=config.main_entry,
        mode=mode,
        startup_width=config.debug_window_width,
        startup_height=config.debug_window_height,
        min_display_time=config.min_display_time,
        icon_path=config.icon_path,
        logo_path=config.logo_path,
        enable_language_selector=config.enable_language_selector,
        force=config.force
    )

    # Check launch result
    if not result.success:
        if result.existing_instance:
            ColorPrint.yellow("")
            ColorPrint.yellow("=" * 70)
            ColorPrint.yellow(f"{config.app_name} is already running!")
            ColorPrint.yellow(f"Existing instance detected at port {result.existing_port}")
            ColorPrint.yellow("Please close the existing instance first.")
            ColorPrint.yellow("=" * 70)
        else:
            ColorPrint.red("")
            ColorPrint.red("=" * 70)
            ColorPrint.red(f"Failed to launch {config.app_name}: {result.message}")
            ColorPrint.red("=" * 70)
        return

    ColorPrint.green("")
    ColorPrint.green("=" * 70)
    ColorPrint.green(f" {config.app_name.upper()} - READY")
    ColorPrint.green("=" * 70)


def _initialize_i18n(config: NativeUIConfig) -> None:
    """
    Auto-initialize i18n if translation directory exists

    Searches for: pyapps/{app_id}/{app_id}_i18n/

    Args:
        config: Application configuration
    """
    if config.project_root is None:
        config.project_root = Path(__file__).parent.parent.parent.parent

    i18n_dir = config.project_root / "pyapps" / config.app_id / f"{config.app_id}_i18n"

    if not i18n_dir.exists():
        if config.debug:
            ColorPrint.yellow(f"[NativeApp] No i18n directory found: {i18n_dir}")
        return

    # Initialize i18n
    from pycore.pyutils.native_ui.i18n import get_i18n_manager

    i18n = get_i18n_manager()

    try:
        i18n.initialize(
            config_dir=str(i18n_dir),
            use_system_language=True
        )
        ColorPrint.blue(
            f"[NativeApp] i18n initialized with language: {i18n.get_current_language()}"
        )
    except Exception as e:
        ColorPrint.yellow(f"[NativeApp] Failed to initialize i18n: {e}")
        # Create default config
        i18n._create_default_config()


def _resolve_i18n_text(text: str) -> str:
    """
    Resolve i18n key to actual text

    If text looks like an i18n key (e.g., "matrix.app_name"),
    try to resolve it using i18n manager.

    Args:
        text: Text or i18n key

    Returns:
        Resolved text
    """
    # Check if it looks like an i18n key (contains a dot)
    if "." not in text:
        return text

    try:
        from pycore.pyutils.native_ui.i18n import get_i18n_manager
        i18n = get_i18n_manager()

        # Try to get translation
        resolved = i18n.get(text)

        # If resolved text is different from input, use it
        # (i18n.get() returns the key itself if not found)
        if resolved != text:
            return resolved

        # Otherwise, return original text
        return text

    except Exception:
        # If i18n fails, return original text
        return text


# Convenience function for kwargs-style usage
def launch(**kwargs) -> None:
    """
    Convenience function for launching with keyword arguments

    Usage:
        launch(
            app_id="matrix",
            app_name="Matrix Application",
            main_entry=main_app_entry,
            url="http://localhost:3000",
            enable_tray=True
        )

    All keyword arguments are passed to NativeUIConfig.
    """
    config = NativeUIConfig(**kwargs)
    launch_native_app(config)

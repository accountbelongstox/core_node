#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service starters for the native UI launcher.

Holds the four service-starter helpers extracted from launch_native_app:
  - _start_frontend            -> delegates to step9_frontend.start_frontend_if_needed
  - _start_rpc_v2_service      -> delegates to pylauncher.ServiceLauncher (rpc_v2 starter)
                                  + common.port_utils.ensure_ports_available
  - _start_pylauncher_tray_service -> delegates to pylauncher.ServiceLauncher (tray starter)
  - _start_singleton_detector  -> delegates to pylauncher.singleton_detector.SingletonDetector

Also exposes make_busy_state_checker(): the shared busy-state state_checker
callback, reusing ServiceLauncher._singleton_detect's pattern (the body is
byte-identical to the former inline singleton_state_checker closure).

CIRCULAR IMPORT NOTE:
    A documented cycle (pylauncher -> pythreadpool -> native_ui.step6_tray ->
    native_ui -> step3_launcher -> pylauncher) is broken by LAZY, function-local
    imports of pylauncher / step6_tray / port_utils below. These MUST stay
    function-local; moving them to module top-level re-bites the cycle.
"""

from pathlib import Path
from typing import Optional, Any, TYPE_CHECKING

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.native_ui.step1_config import NativeUIConfig
from pycore.pyutils.native_ui.step7_managers.callback_manager import CallbackManager
from pycore.pyutils.native_ui.step9_frontend import (
    FrontendConfig,
    start_frontend_if_needed
)
from pycore.pylauncher.singleton_detector import SingletonDetector

if TYPE_CHECKING:
    from pycore.pyutils.native_ui.step9_frontend import FrontendLauncherThread


def make_busy_state_checker():
    """
    Build a busy-state state_checker callback for SingletonDetector.

    Reuses ServiceLauncher._singleton_detect's pattern: reports THREAD_BUS
    busy state so external monitors can query can_shutdown via STATUS. The
    returned closure body is byte-identical to the former inline
    singleton_state_checker closure in launch_native_app.
    """
    def state_checker():
        """Check if application can shutdown (based on busy state)"""
        is_busy = THREAD_BUS.is_busy()
        return {
            'can_shutdown': not is_busy,
            'message': THREAD_BUS.get_busy_reason() if is_busy else 'Ready to shutdown'
        }

    return state_checker


def _start_singleton_detector(
    config: NativeUIConfig,
    port_start: int,
    port_range: int
):
    """
    Run singleton detection with shutdown_existing takeover.

    Args:
        config: Native UI configuration.
        port_start: Start of the allocated port range.
        port_range: Size of the allocated port range.

    Returns:
        The detection result if this instance became primary, or None if it
        failed (caller should abort launch).
    """
    # ========== Phase 5: Singleton Detection ==========
    # Create singleton detector with shutdown_existing=True
    # This means: if an old instance exists, notify it to shutdown and take over

    # Define singleton callbacks (from launcher.py:204-218)
    def handle_singleton_message(msg):
        """Handle incoming messages from new instances"""
        if msg.get('type') == 'SHUTDOWN':
            ColorPrint.yellow(f"[Singleton] Received shutdown request from new instance (PID {msg.get('pid')})")
            THREAD_BUS.request_shutdown(
                f"Shutdown by new instance (PID {msg.get('pid')})",
                execute_handlers=True
            )

    detector = SingletonDetector(
        app_id=config.app_id,
        port_start=port_start,
        port_range=port_range,
        timeout=1.0,
        debug=config.debug,
        on_message=handle_singleton_message,
        state_checker=make_busy_state_checker(),
        shutdown_existing=True  # New instance will shutdown old instance and take over
    )

    detection = detector.detect_and_bind()

    # Check if became primary
    if not detection.is_primary:
        if detection.existing_instance:
            # Should not happen with shutdown_existing=True, but handle it anyway
            ColorPrint.print_error(f"[NativeLauncher] Failed to take over from existing instance at port {detection.existing_port}")
        else:
            ColorPrint.print_error("[NativeLauncher] No available ports in range")
        return None

    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 5: Became primary instance on port {detection.port}")

    return detection


def _start_frontend(config: NativeUIConfig) -> Optional['FrontendLauncherThread']:
    """
    Start frontend service if enabled.

    Delegates to step9_frontend.start_frontend_if_needed (does NOT reimplement
    the frontend launch logic).

    Args:
        config: Native UI configuration

    Returns:
        FrontendLauncherThread instance or None if failed
    """
    if not config.frontend_enabled:
        return None

    # Validate frontend configuration
    if not config.frontend_framework:
        ColorPrint.print_error("[Frontend] frontend_framework is required when frontend_enabled=True")
        return None

    if not config.frontend_app_dir:
        ColorPrint.print_error("[Frontend] frontend_app_dir is required when frontend_enabled=True")
        return None

    # Resolve frontend_app_dir relative to project_root if needed
    frontend_app_dir = Path(config.frontend_app_dir)
    if not frontend_app_dir.is_absolute() and config.project_root:
        frontend_app_dir = Path(config.project_root) / frontend_app_dir

    # Build environment variables for frontend (pass backend URL)
    frontend_env_vars = {}
    if config.rpc_enabled:
        backend_url = f"http://localhost:{config.rpc_port}"
        # Vite environment variables (VITE_ prefix)
        frontend_env_vars["VITE_API_URL"] = backend_url
        frontend_env_vars["VITE_API_PORT"] = str(config.rpc_port)
        frontend_env_vars["VITE_API_HOST"] = config.rpc_host
        # React/CRA environment variables (REACT_APP_ prefix)
        frontend_env_vars["REACT_APP_API_URL"] = backend_url
        frontend_env_vars["REACT_APP_API_PORT"] = str(config.rpc_port)
        # Next.js environment variables (NEXT_PUBLIC_ prefix)
        frontend_env_vars["NEXT_PUBLIC_API_URL"] = backend_url
        frontend_env_vars["NEXT_PUBLIC_API_PORT"] = str(config.rpc_port)

    # Create frontend configuration
    frontend_config = FrontendConfig(
        enabled=True,
        framework=config.frontend_framework,
        app_dir=frontend_app_dir,
        mode=config.frontend_mode,
        port=config.frontend_port,
        auto_install=config.frontend_auto_install,
        package_manager=config.frontend_package_manager,
        skip_build=config.frontend_skip_build,
        block_until_ready=config.frontend_block_until_ready,
        show_output=config.debug,
        env_vars=frontend_env_vars if frontend_env_vars else None
    )

    # Start frontend
    frontend_thread = start_frontend_if_needed(
        config=frontend_config,
        block=config.frontend_block_until_ready
    )

    if frontend_thread and config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 4.6: Frontend started ({config.frontend_framework})")

    return frontend_thread


def _start_rpc_v2_service(
    config: NativeUIConfig,
    frontend_thread: Optional['FrontendLauncherThread'],
    callback_manager: CallbackManager
):
    """
    Start RPC v2 service and coordinate static file mounting.

    Delegates to pylauncher.ServiceLauncher (which dispatches to the registered
    rpc_v2 starter in pythreadpool) and to common.port_utils.ensure_ports_available
    for post-takeover port release. Does NOT reimplement either.

    Args:
        config: Native UI configuration
        frontend_thread: Frontend thread (for static mount config)
        callback_manager: Callback manager (for registering cleanup callbacks)

    Returns:
        RPC v2 service instance or None
    """
    # Lazy import to avoid circular dependency:
    # pylauncher -> pythreadpool -> native_ui.step6_tray -> native_ui -> step3_launcher -> pylauncher
    from pycore.pylauncher import LauncherConfig, ServiceLauncher

    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Phase 4.7: Starting RPC v2 service...")

    try:
        # ========== 0. Ensure RPC port is available ==========
        # After singleton takeover, wait for old instance's ports to be released
        from pycore.pyutils.common.port_utils import ensure_ports_available

        ports_to_check = [config.rpc_port]
        # Only check frontend port in production mode (dev mode frontend is already running)
        if config.frontend_enabled and hasattr(config, 'frontend_port') and config.frontend_mode == 'production':
            ports_to_check.append(config.frontend_port)

        ColorPrint.blue(f"[NativeLauncher] Ensuring ports are available: {ports_to_check}")
        ColorPrint.blue(f"[NativeLauncher] Waiting for old instance to shutdown gracefully...")

        # Wait for old instance to shutdown gracefully (via singleton detection)
        # Singleton detection already sent shutdown request, so old instance should exit
        # Give it reasonable time (15s) to complete shutdown handlers
        if not ensure_ports_available(ports_to_check, timeout=15.0, force_kill=False):
            ColorPrint.print_error(f"[NativeLauncher] Failed to release ports: {ports_to_check}")
            ColorPrint.print_error("[NativeLauncher] Old instance did not shutdown within 15 seconds")
            ColorPrint.print_error("[NativeLauncher] Please manually stop the old instance or check for hanging processes")
            return None

        # ========== 1. Prepare static mount config ==========
        static_mounts = []

        # Get static mount config from frontend_thread (if enabled and production mode)
        if config.rpc_auto_mount_frontend and frontend_thread:
            frontend_static_mount = frontend_thread.get_static_mount()
            if frontend_static_mount:
                static_mounts.append(frontend_static_mount)
                if config.debug:
                    ColorPrint.green(
                        f"[NativeLauncher] Frontend static mount: "
                        f"{frontend_static_mount['url_prefix']} -> {frontend_static_mount['directory']}"
                    )
            elif config.debug:
                if config.frontend_mode == "dev":
                    ColorPrint.yellow("[NativeLauncher] No static mount from frontend (using dev server)")
                else:
                    ColorPrint.yellow("[NativeLauncher] No static mount from frontend (not ready yet)")

        # ========== 2. Create RPC v2 service config ==========
        rpc_v2_config = {
            'port': config.rpc_port,
            'host': config.rpc_host,
            'debug': config.rpc_debug,
            'fastapi_routers': config.rpc_routers,
            'static_mounts': static_mounts,
            'allow_origins': config.rpc_allow_origins,
            'init_callback': config.rpc_init_callback  # Pass callback to register routes
        }

        if config.debug:
            ColorPrint.blue(f"[NativeLauncher] RPC v2 config:")
            ColorPrint.blue(f"  - Host: {config.rpc_host}:{config.rpc_port}")
            ColorPrint.blue(f"  - Routers: {len(config.rpc_routers)}")
            ColorPrint.blue(f"  - Static mounts: {len(static_mounts)}")

        # ========== 3. Start RPC v2 via ServiceLauncher ==========
        launcher_config = LauncherConfig(
            app_id=f"{config.app_id}_rpc",
            app_name=f"{config.app_name} RPC",
            singleton=False,  # native_ui already handles singleton
            services={
                'heartbeat': {},
                'rpc_v2': rpc_v2_config
            }
        )

        launcher = ServiceLauncher(launcher_config)
        success = launcher.start()

        if not success:
            ColorPrint.print_error("[NativeLauncher] Phase 4.7: Failed to start RPC v2 service")
            return None

        # ========== 4. Register shutdown callback (cleanup RPC v2) ==========
        def cleanup_rpc_v2():
            if config.debug:
                ColorPrint.print_info("[NativeLauncher] Stopping RPC v2 service...")
            try:
                launcher.stop()
                ColorPrint.green("[NativeLauncher] RPC v2 service stopped")
            except Exception as e:
                ColorPrint.print_error(f"[NativeLauncher] Error stopping RPC v2: {e}")

        callback_manager.add_closing_callback(cleanup_rpc_v2)

        # ========== 5. Return RPC v2 service instance ==========
        rpc_service = launcher.get_service('rpc_v2')

        if config.debug:
            ColorPrint.print_success(
                f"[NativeLauncher] Phase 4.7: RPC v2 started on {config.rpc_host}:{config.rpc_port}"
            )
            ColorPrint.blue(f"  - HTTP API: http://{config.rpc_host}:{config.rpc_port}/rpc/<route>")
            ColorPrint.blue(f"  - WebSocket: ws://{config.rpc_host}:{config.rpc_port}/rpc/ws")
            if static_mounts:
                ColorPrint.blue(f"  - Frontend: http://{config.rpc_host}:{config.rpc_port}/")

        # ========== 6. Trigger frontend.ready event (production mode with static files) ==========
        if static_mounts:
            THREAD_BUS.trigger_event('frontend.ready', {
                'mode': 'production',
                'port': config.rpc_port,
                'framework': 'rpc_v2_static'
            })
            ColorPrint.blue("[NativeLauncher] Triggered THREAD_BUS event: frontend.ready (production mode)")

        return rpc_service

    except Exception as e:
        ColorPrint.print_error(f"[NativeLauncher] Phase 4.7: Failed to start RPC v2: {e}")
        import traceback
        traceback.print_exc()
        return None


def _start_pylauncher_tray_service(config: NativeUIConfig) -> Optional[Any]:
    """
    Start pylauncher tray service (pystray backend).

    Delegates to pylauncher.ServiceLauncher (which dispatches to the registered
    tray starter in pythreadpool). Does NOT reimplement.

    Args:
        config: Native UI configuration

    Returns:
        Tray service instance or None
    """
    # Lazy import to avoid circular dependency
    from pycore.pylauncher import LauncherConfig, ServiceLauncher

    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Starting pylauncher tray service (pystray backend)...")

    try:
        # Convert NativeUIConfig tray_menu_items to TrayMenuItem format
        # NativeUIConfig uses simple dicts, need to convert to proper format
        from pycore.pyutils.native_ui.step6_tray import TrayMenuItem
        import webbrowser

        tray_menu_items = []

        # If no menu items provided, create default menu
        if not config.tray_menu_items:
            ColorPrint.blue("[NativeLauncher] No tray menu items provided, creating default menu...")

            # Default menu items (using i18n keys for multi-language support)
            # 1. Open Frontend / Show Window
            open_item = TrayMenuItem(
                text="tray.menu.show",  # i18n key - will be translated by TkinterSystemTray
                action_signal="tray_action_open",
                default=True
            )
            tray_menu_items.append(open_item)

            # Register handler for open
            def handle_open(event_data):
                # Try to open frontend URL
                frontend_url = f"http://localhost:{config.frontend_port}" if config.frontend_enabled else f"http://localhost:{config.rpc_port}"
                ColorPrint.blue(f"[Tray] Opening {frontend_url}...")
                webbrowser.open(frontend_url)

            THREAD_BUS.register_event_handler('tray_action_open', handle_open)

            # 2. Separator
            tray_menu_items.append(TrayMenuItem.SEPARATOR)

            # 3. Exit
            exit_item = TrayMenuItem(
                text="tray.menu.exit",  # i18n key - will be translated by TkinterSystemTray
                action_signal="tray_action_exit"
            )
            tray_menu_items.append(exit_item)

            # Register handler for exit
            def handle_exit(event_data):
                ColorPrint.yellow("[Tray] Exit requested...")
                if not THREAD_BUS.is_shutdown_requested():
                    THREAD_BUS.request_shutdown(reason="Tray exit requested", execute_handlers=True)

            THREAD_BUS.register_event_handler('tray_action_exit', handle_exit)

            ColorPrint.green(f"[NativeLauncher] Created default tray menu with {len(tray_menu_items)} items (i18n support)")
        else:
            # Convert user-provided menu items
            for item in config.tray_menu_items:
                if isinstance(item, dict):
                    # Convert dict to TrayMenuItem
                    text = item.get('text', '')
                    callback = item.get('callback')

                    # Create action signal name from text (convert to snake_case)
                    action_signal = f"tray_action_{text.lower().replace(' ', '_')}"

                    tray_item = TrayMenuItem(
                        text=text,
                        action_signal=action_signal
                    )
                    tray_menu_items.append(tray_item)

                    # Register callback for this signal if provided
                    if callback:
                        THREAD_BUS.register_event_handler(action_signal, lambda event_data, cb=callback: cb())
                else:
                    tray_menu_items.append(item)

        # Create tray service configuration
        tray_config = {
            'app_name': config.app_name,
            'icon_path': config.icon_path,
            'menu_items': tray_menu_items,
            'trigger_shutdown_on_exit': True
        }

        # Use pylauncher to start tray service
        launcher_config = LauncherConfig(
            app_id=f"{config.app_id}_tray",
            app_name=f"{config.app_name} Tray",
            singleton=False,  # native_ui already handles singleton
            services={
                'tray': tray_config
            }
        )

        launcher = ServiceLauncher(launcher_config)
        success = launcher.start()

        if not success:
            ColorPrint.print_error("[NativeLauncher] Failed to start pylauncher tray service")
            return None

        ColorPrint.green(f"[NativeLauncher] Pylauncher tray service started (pystray backend)")
        return launcher.get_service('tray')

    except Exception as e:
        ColorPrint.print_error(f"[NativeLauncher] Failed to start pylauncher tray service: {e}")
        import traceback
        traceback.print_exc()
        return None

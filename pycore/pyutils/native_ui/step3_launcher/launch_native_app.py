#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Launcher - Simplified main entry point

Provides a single function launch_native_app() that handles everything:
- Auto port allocation
- Auto i18n initialization
- URL processing
- Singleton detection
- Debug window
- Main UI creation
- Lifecycle management
"""

from typing import Optional, TYPE_CHECKING
from pathlib import Path
from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.native_ui.step1_config import NativeUIConfig
from pycore.pyutils.native_ui.step2_port_url import get_port_range, process_url
from pycore.pyutils.native_ui.step7_managers.callback_manager import CallbackManager
from pycore.pyutils.native_ui.step9_frontend import (
    FrontendConfig,
    start_frontend_if_needed
)

if TYPE_CHECKING:
    from pycore.pyutils.native_ui.step9_frontend import FrontendLauncherThread


def launch_native_app(config: NativeUIConfig) -> None:
    """
    Launch native UI application with simplified API

    This is the main entry point for native UI applications.
    Handles everything automatically based on configuration.

    Args:
        config: NativeUIConfig instance

    Example:
        config = NativeUIConfig(
            app_id="matrix",
            app_name="Matrix Application",
            main_entry=main_app_entry,
            url="http://localhost:3000",
            enable_tray=True,
            tray_menu_items=[
                {"text": "Open Frontend", "callback": open_frontend},
                {"text": "Exit", "callback": exit_app}
            ]
        )
        launch_native_app(config)
    """
    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Starting native UI application...")

    # ========== Phase 1: Auto Port Allocation ==========
    port_start, port_range = get_port_range(config.app_id, debug=config.debug)
    if config.debug:
        ColorPrint.print_info(
            f"[NativeLauncher] Phase 1: Port range allocated: {port_start}-{port_start+port_range-1}"
        )

    # ========== Phase 2: Process URL ==========
    final_url, detected_url_type, url_metadata = process_url(
        config.url, config.url_type, project_root=config.project_root, debug=config.debug
    )
    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 3: URL processed: {final_url} (type: {detected_url_type})")

    # ========== Phase 4: Initialize Callback Manager ==========
    callback_manager = CallbackManager(debug=config.debug)

    # Add user callbacks from config
    for callback in config.on_ready_callbacks:
        callback_manager.add_ready_callback(callback)
    for callback in config.on_closed_callbacks:
        callback_manager.add_closed_callback(callback)
    for callback in config.on_closing_callbacks:
        callback_manager.add_closing_callback(callback)
    if config.on_restart_callback:
        callback_manager.set_restart_callback(config.on_restart_callback)

    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 4: Callback manager initialized")

    # ========== Phase 4.5: Auto-start Timer Manager ==========
    if config.enable_timer:
        _initialize_timer_manager(config)

    # ========== Phase 4.55: Pre-register frontend.ready handler (if debug window enabled) ==========
    # IMPORTANT: This must happen BEFORE frontend starts to catch the frontend.ready event
    startup_thread_ref = {'thread': None, 'frontend_ready': False} if config.show_debug_window else None

    if config.show_debug_window:
        def handle_frontend_ready_early(event_data):
            """
            Handle frontend.ready event - auto-close debug window

            This handler is registered BEFORE frontend starts to ensure
            it catches the frontend.ready event when it's triggered.

            Triggered by:
            - Dev mode: HTTP health check passes (frontend_thread.py)
            - Production mode: RPC v2 started with static files mounted (launch_native_app.py)
            """
            import time

            # Mark that frontend is ready
            startup_thread_ref['frontend_ready'] = True

            thread = startup_thread_ref['thread']
            if thread is None:
                if config.debug:
                    ColorPrint.yellow("[NativeLauncher] frontend.ready received - waiting for startup window thread")
                return

            ColorPrint.green("[DebugLog] Frontend is ready, closing debug window...")
            thread.log("Frontend ready, closing debug window...", "success")
            thread.set_status("Frontend ready, closing...")
            time.sleep(1.0)  # Brief delay to show message

            # Unregister ColorPrint callback
            ColorPrint.unregister_callback(thread._colorprint_callback)

            # Close debug window
            thread.request_close()

        # Register handler with high priority to ensure it runs first
        THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready_early, priority=100)

        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Phase 4.55: Registered frontend.ready handler (pre-frontend startup)")

    # ========== Phase 4.6: Start Frontend (if enabled) ==========
    frontend_thread = None
    if config.frontend_enabled:
        frontend_thread = _start_frontend(config)

        # Register frontend shutdown handler to THREAD_BUS
        if frontend_thread:
            def stop_frontend():
                ColorPrint.blue("[frontend] Stopping frontend thread...")
                frontend_thread.stop()

            THREAD_BUS.register_shutdown_handler(
                handler=stop_frontend,
                priority=30,  # Stop before RPC v2 (priority 50)
                name="frontend"
            )
            if config.debug:
                ColorPrint.blue("[frontend] Registered shutdown handler (priority=30)")

        # Update final_url if frontend is in dev mode
        if frontend_thread and config.frontend_mode == "dev":
            final_url = f"http://localhost:{config.frontend_port}"
            ColorPrint.cyan(f"[NativeLauncher] Updated URL to frontend dev server: {final_url}")

    # ========== Phase 4.7: Start RPC v2 (if enabled) ==========
    rpc_service = None
    if config.rpc_enabled:
        rpc_service = _start_rpc_v2_service(config, frontend_thread, callback_manager)

        # Update final_url if RPC v2 is serving frontend (production mode)
        if rpc_service and config.rpc_auto_mount_frontend:
            if config.frontend_mode == "production" and config.frontend_enabled:
                final_url = f"http://localhost:{config.rpc_port}"
                ColorPrint.cyan(f"[NativeLauncher] Updated URL to RPC v2 (with frontend): {final_url}")
            elif not config.frontend_enabled:
                # RPC only mode (no frontend)
                final_url = f"http://localhost:{config.rpc_port}"
                if config.debug:
                    ColorPrint.cyan(f"[NativeLauncher] RPC v2 URL: {final_url}")

    # ========== Phase 4.8: Register app.close event handlers for cleanup ==========
    def handle_app_close(event_data):
        """
        Handle app.close event - trigger THREAD_BUS shutdown

        Triggered by:
        - Window close (main_window.py closeEvent)
        - Tray exit action
        - Ctrl+C / KeyboardInterrupt

        IMPORTANT: Don't manually stop services here!
        Let THREAD_BUS.request_shutdown() handle service shutdown via shutdown stack.
        This ensures proper shutdown order (RPC v2 → Heartbeat → etc.)
        """
        source = event_data.get('source', 'unknown')
        ColorPrint.yellow(f"[NativeLauncher] Handling app.close event (source: {source})")

        # CRITICAL FIX: Stop startup thread (if it exists and is running)
        # This must be done manually as it's not registered in shutdown stack
        if startup_thread_ref and startup_thread_ref.get('thread'):
            thread = startup_thread_ref['thread']
            if thread and thread.is_alive():
                ColorPrint.blue("[NativeLauncher] Stopping startup thread (debug window/tray)...")
                thread.request_close()

        # Trigger THREAD_BUS shutdown to stop all services in proper order
        # Don't manually stop services - let shutdown stack handle it
        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.blue("[NativeLauncher] Triggering THREAD_BUS shutdown...")
            THREAD_BUS.request_shutdown(
                reason=f"app.close event (source: {source})",
                execute_handlers=True
            )
        else:
            ColorPrint.yellow("[NativeLauncher] Shutdown already requested, skipping")

    # Register with high priority to ensure cleanup happens early
    THREAD_BUS.register_event_handler('app.close', handle_app_close, priority=90)
    ColorPrint.blue("[NativeLauncher] Registered app.close event handler for THREAD_BUS shutdown")

    # ========== Phase 5: Singleton Detection ==========
    from pycore.pylauncher.singleton_detector import SingletonDetector

    # Create singleton detector with shutdown_existing=True
    # This means: if an old instance exists, notify it to shutdown and take over
    detector = SingletonDetector(
        app_id=config.app_id,
        port_start=port_start,
        port_range=port_range,
        timeout=1.0,
        debug=config.debug,
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
        return

    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 5: Became primary instance on port {detection.port}")

    # ========== Print Startup Summary ==========
    if config.debug:
        ColorPrint.print_success("\n" + "=" * 70)
        ColorPrint.print_success("  SERVICES INITIALIZED")
        ColorPrint.print_success("=" * 70)
        if frontend_thread and config.frontend_enabled:
            ColorPrint.cyan(f"  Frontend:  {final_url}  ({config.frontend_framework} {config.frontend_mode})")
        if config.rpc_enabled:
            rpc_url = f"http://{config.rpc_host}:{config.rpc_port}"
            ColorPrint.cyan(f"  Backend:   {rpc_url}/rpc/<route>  ({len(config.rpc_routers)} routes)")
        ColorPrint.cyan(f"  Window:    {config.window_size[0]}x{config.window_size[1]}" + (" (frameless)" if config.frameless else ""))
        ColorPrint.print_success("=" * 70 + "\n")

    # ========== Phase 6: Launch with or without startup window ==========
    # Create wrapped main_entry that integrates PySide6 UI
    def _wrapped_main_entry():
        """Wrapped main entry that creates PySide6 UI with callbacks"""
        # Call user's main_entry first (for service setup, etc.)
        if config.main_entry:
            config.main_entry()

        # Create PySide6 UI if URL is provided (regardless of enable_tray)
        if final_url:
            _create_pyside6_ui(config, final_url, callback_manager)

    # Check if we should show debug window
    if config.show_debug_window:
        # Launch with startup window
        from pycore.pyutils.native_ui.step3_launcher.launcher_with_startup import launch_app_with_startup

        launch_app_with_startup(
            app_name=config.app_name,
            main_entry=_wrapped_main_entry,
            startup_width=config.debug_window_width,
            startup_height=config.debug_window_height,
            min_display_time=config.min_display_time,
            icon_path=config.icon_path,
            logo_path=config.logo_path,
            enable_language_selector=config.enable_language_selector,
            enable_tray=config.enable_tray,
            startup_thread_ref=startup_thread_ref  # Pass reference for early handler
        )
    else:
        # Launch directly without startup window
        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Phase 6: Launching directly (no debug window)")

        try:
            _wrapped_main_entry()
        except KeyboardInterrupt:
            ColorPrint.yellow("\nKeyboard interrupt received")
        except Exception as e:
            ColorPrint.print_error(f"\nERROR: Main application failed: {e}")
            import traceback
            traceback.print_exc()
            raise


def _start_frontend(config: NativeUIConfig) -> Optional['FrontendLauncherThread']:
    """
    Start frontend service if enabled

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


def _initialize_timer_manager(config: NativeUIConfig) -> None:
    """
    Initialize and start built-in timer manager (singleton)

    The timer manager is auto-started if enable_timer=True.
    Users can register tasks anytime using:
        from pycore.pyutils.native_ui import get_timer_manager
        timer_mgr = get_timer_manager()
        timer_mgr.register_task("my_task", interval=5.0, callback=my_callback)
    """
    from pycore.pyutils.native_ui.step7_managers.timer_manager import get_timer_manager

    timer_mgr = get_timer_manager()

    if not timer_mgr.is_running():
        timer_mgr.start()
        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Phase 4.5: Timer manager started (singleton)")
    else:
        if config.debug:
            ColorPrint.print_warn("[NativeLauncher] Phase 4.5: Timer manager already running")


def _start_rpc_v2_service(
    config: NativeUIConfig,
    frontend_thread: Optional['FrontendLauncherThread'],
    callback_manager: CallbackManager
):
    """
    启动 RPC v2 服务，协调静态文件挂载

    Args:
        config: Native UI 配置
        frontend_thread: 前端线程（用于获取静态挂载配置）
        callback_manager: 回调管理器（用于注册清理回调）

    Returns:
        RPC v2 服务实例或 None
    """
    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Phase 4.7: Starting RPC v2 service...")

    try:
        from pycore.pylauncher import LauncherConfig, ServiceLauncher

        # ========== 1. 准备静态挂载配置 ==========
        static_mounts = []

        # 从 frontend_thread 获取静态挂载配置（如果启用且为生产模式）
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

        # ========== 2. 创建 RPC v2 服务配置 ==========
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

        # ========== 3. 使用 ServiceLauncher 启动 RPC v2 ==========
        launcher_config = LauncherConfig(
            app_id=f"{config.app_id}_rpc",
            app_name=f"{config.app_name} RPC",
            singleton=False,  # native_ui 已经处理了单例
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

        # ========== 4. 注册关闭回调（清理 RPC v2）==========
        def cleanup_rpc_v2():
            if config.debug:
                ColorPrint.print_info("[NativeLauncher] Stopping RPC v2 service...")
            try:
                launcher.stop()
                ColorPrint.green("[NativeLauncher] RPC v2 service stopped")
            except Exception as e:
                ColorPrint.print_error(f"[NativeLauncher] Error stopping RPC v2: {e}")

        callback_manager.add_closing_callback(cleanup_rpc_v2)

        # ========== 5. 返回 RPC v2 服务实例 ==========
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


def _create_pyside6_ui(config: NativeUIConfig, url: str, callback_manager: CallbackManager) -> None:
    """
    Create PySide6 UI with webview and system tray

    Integrates callback_manager with PySide6 lifecycle events.
    """
    # Import PySide6 via third_party manager (will auto-install if needed)
    from pycore.pyfoundations.third_party import get_third_package_pyside6
    get_third_package_pyside6()  # Ensure PySide6 is installed

    from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
        PySide6Framework,
        PySide6UIConfig,
        PySide6TrayMenuItem
    )

    if config.debug:
        ColorPrint.print_info("[NativeLauncher] Phase 7: Creating PySide6 UI...")

    # Convert tray menu items
    pyside6_tray_items = []
    if config.tray_menu_items:
        for item in config.tray_menu_items:
            pyside6_tray_items.append(
                PySide6TrayMenuItem(
                    text=item.get("text", ""),
                    callback=item.get("callback")
                )
            )

    # Extract window size (support tuple or "fullscreen")
    if isinstance(config.window_size, tuple):
        window_width, window_height = config.window_size
    elif config.window_size == "fullscreen":
        # Get screen size for fullscreen
        from PySide6.QtWidgets import QApplication
        from PySide6.QtGui import QGuiApplication
        screen = QGuiApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            window_width, window_height = screen_geometry.width(), screen_geometry.height()
            if config.debug:
                ColorPrint.green(f"[NativeLauncher] Fullscreen mode: {window_width}x{window_height}")
        else:
            window_width, window_height = 1920, 1080  # Fallback
    else:
        window_width, window_height = 1280, 900  # Default

    # Create PySide6 UI config
    ui_config = PySide6UIConfig(
        app_name=config.app_name,
        app_id=config.app_id,  # ← 添加 app_id
        webview_url=url,
        window_size=(window_width, window_height),
        show_on_start=config.show_on_start,
        frameless=config.frameless,
        icon_path=config.icon_path,
        enable_tray=config.enable_tray,
        tray_menu_items=pyside6_tray_items
    )

    # Wire callbacks from callback_manager
    ui_config.on_ready = lambda: callback_manager.execute_ready_callbacks()
    ui_config.on_closing = lambda: callback_manager.execute_closing_callbacks()
    ui_config.on_closed = lambda: callback_manager.execute_closed_callbacks()

    # Create and start PySide6 framework
    framework = PySide6Framework(ui_config)

    if config.debug:
        ColorPrint.print_success("[NativeLauncher] Phase 7: PySide6 UI created, starting event loop...")

    framework.start()  # Blocks until window closes


# Alias for convenience
launch = launch_native_app

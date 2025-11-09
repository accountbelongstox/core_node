#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Launcher - Main Implementation

Manages lifecycle of all services with multi-threaded architecture
"""

import sys
import threading
import time
import signal
from typing import Dict, Optional, Callable, Any
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pylauncher.config import LauncherConfig


class ServiceThread:
    """
    Service Thread Wrapper

    Wraps each service in a separate thread with lifecycle management
    """

    def __init__(
        self,
        name: str,
        target: Callable,
        config: Any,
        daemon: bool = True
    ):
        """
        Initialize service thread

        Args:
            name: Service name
            target: Service entry point function
            config: Service-specific configuration
            daemon: Run as daemon thread
        """
        self.name = name
        self.target = target
        self.config = config
        self.daemon = daemon

        # Thread state
        self.thread: Optional[threading.Thread] = None
        self.running = False
        self.started = False
        self.error: Optional[Exception] = None

        # Service instance (if applicable)
        self.service_instance = None

    def start(self):
        """Start service thread"""
        if self.started:
            ColorPrint.yellow(f"[{self.name}] Already started")
            return

        ColorPrint.blue(f"[{self.name}] Starting service thread...")

        def thread_wrapper():
            """Thread wrapper with error handling"""
            try:
                self.running = True
                ColorPrint.green(f"[{self.name}] Thread started")

                # Execute service entry point
                result = self.target(self.config)

                # Store service instance if returned
                if result is not None:
                    self.service_instance = result

            except Exception as e:
                self.error = e
                ColorPrint.red(f"[{self.name}] Thread error: {e}")
                import traceback
                traceback.print_exc()
            finally:
                self.running = False
                ColorPrint.yellow(f"[{self.name}] Thread stopped")

        self.thread = threading.Thread(
            target=thread_wrapper,
            name=f"Service-{self.name}",
            daemon=self.daemon
        )

        self.thread.start()
        self.started = True

        ColorPrint.green(f"[{self.name}] Service thread launched")

    def stop(self, timeout: int = 10):
        """
        Stop service thread

        Args:
            timeout: Timeout in seconds
        """
        if not self.started:
            return

        ColorPrint.yellow(f"[{self.name}] Stopping service...")

        # Signal service to stop
        self.running = False

        # Stop service instance if it has stop method
        if self.service_instance and hasattr(self.service_instance, 'stop'):
            try:
                self.service_instance.stop()
            except Exception as e:
                ColorPrint.yellow(f"[{self.name}] Error during stop: {e}")

        # Wait for thread to finish
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=timeout)

            if self.thread.is_alive():
                ColorPrint.red(f"[{self.name}] Thread did not stop within timeout")
            else:
                ColorPrint.green(f"[{self.name}] Service stopped")

        self.started = False

    def is_alive(self) -> bool:
        """Check if thread is alive"""
        return self.thread is not None and self.thread.is_alive()

    def get_status(self) -> Dict[str, Any]:
        """Get thread status"""
        return {
            'name': self.name,
            'started': self.started,
            'running': self.running,
            'alive': self.is_alive(),
            'error': str(self.error) if self.error else None,
        }


class UnifiedLauncher:
    """
    Unified Launcher - Multi-Service Orchestrator

    Manages lifecycle of all services:
    - Web Service (FastAPI + WebSocket)
    - MCP Service (Model Context Protocol)
    - UI Service (Native UI Framework)
    - Selenium Service (Browser Automation)

    Architecture:
    - Each service runs in its own thread
    - Unified configuration and lifecycle management
    - Graceful startup and shutdown
    - Error handling and recovery

    Example:
        ```python
        from pycore.pylauncher import UnifiedLauncher, LauncherConfig

        # Create configuration
        config = LauncherConfig()

        # Create launcher
        launcher = UnifiedLauncher(config)

        # Start all services
        launcher.start_all()

        # Keep running
        launcher.wait()
        ```
    """

    def __init__(self, config: LauncherConfig):
        """
        Initialize unified launcher

        Args:
            config: Launcher configuration
        """
        self.config = config
        self.services: Dict[str, ServiceThread] = {}
        self.running = False

        # Signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        ColorPrint.green("=" * 60)
        ColorPrint.green(" Unified Launcher Initialized")
        ColorPrint.green("=" * 60)

        self._print_config()

    def _print_config(self):
        """Print launcher configuration"""
        ColorPrint.blue("\nEnabled Services:")
        enabled = self.config.get_enabled_services()

        for service_name in enabled:
            ColorPrint.blue(f"  - {service_name}")

        if not enabled:
            ColorPrint.yellow("  (No services enabled)")

        ColorPrint.green("\n" + "=" * 60 + "\n")

    def _signal_handler(self, signum, frame):
        """Handle termination signals"""
        ColorPrint.yellow(f"\nReceived signal {signum}, shutting down...")
        self.stop_all()
        sys.exit(0)

    # ============================================
    # Service Entry Points
    # ============================================

    def _web_service_entry(self, config):
        """Web service entry point"""
        from pycore.pyutils.web.http_bridge import start_http_server

        ColorPrint.green(f"[WebService] Starting HTTP server on {config.host}:{config.http_port}")

        # Start HTTP/WebSocket server
        # This is a blocking call
        start_http_server(
            host=config.host,
            port=config.http_port,
            # Additional configuration can be passed here
        )

    def _mcp_service_entry(self, config):
        """MCP service entry point"""
        from pyapps.mcpserver.mcpserver_main import UnifiedMCPServer

        ColorPrint.green(f"[MCPService] Starting MCP server on port {config.rpc_port}")

        # Create and start MCP server
        mcp_server = UnifiedMCPServer(
            singleton_host=config.host,
            singleton_port=config.singleton_port,
            rpc_host=config.host,
            rpc_port=config.rpc_port,
            debug=config.debug
        )

        # Start MCP server (blocking)
        mcp_server.start()

        return mcp_server

    def _ui_service_entry(self, config):
        """UI service entry point (Framework Mode)"""
        from pycore.pyutils.native_ui import create_ui_framework, UIConfig

        ColorPrint.green(f"[UIService] Starting native UI: {config.app_name}")

        # Create UI configuration
        ui_config = UIConfig(
            app_name=config.app_name,
            window_size=config.window_size,
            min_window_size=config.min_window_size,
            frameless=config.frameless,
            show_on_start=config.show_on_start,
            resizable=config.resizable,
            ui_source=config.ui_source,
            debug=config.debug
        )

        # Create UI framework
        ui_framework = create_ui_framework(**ui_config.__dict__)

        # Start UI (blocking - runs Tkinter mainloop)
        ui_framework.start()

        return ui_framework

    def _ui_thread_service_entry(self, config):
        """UI service entry point (Thread Mode) - Uses NativeUIThread"""
        from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig
        from pycore.pyutils.native_ui import SystemTray, TrayMenuItem

        ColorPrint.green(f"[UIThreadService] Starting native UI thread: {config.app_name}")

        # Create UI thread configuration
        ui_thread_config = NativeUIThreadConfig(
            app_name=config.app_name,
            width=config.window_size[0] if config.window_size else 800,
            height=config.window_size[1] if config.window_size else 600,
            show_on_start=config.show_on_start,
            resizable=config.resizable,
            frameless=config.frameless,
            theme=config.theme if hasattr(config, 'theme') else 'dark',
            debug=config.debug
        )

        # Create and start UI thread
        ui_thread = NativeUIThread(
            config=ui_thread_config,
            thread_name="UIService-Thread"
        )

        ui_thread.start()

        # Wait for UI to be ready
        ui_thread.wait_until_ready()

        ColorPrint.green(f"[UIThreadService] UI thread ready")

        # Create system tray if enabled
        system_tray = None
        if hasattr(config, 'enable_tray') and config.enable_tray:
            ColorPrint.blue("[UIThreadService] Creating system tray...")

            # Define tray menu callbacks
            def on_show():
                """Show window callback"""
                ColorPrint.blue("[SystemTray] Show window requested")
                if ui_thread and hasattr(ui_thread, 'show'):
                    ui_thread.show()

            def on_hide():
                """Hide window callback"""
                ColorPrint.blue("[SystemTray] Hide window requested")
                if ui_thread and hasattr(ui_thread, 'hide'):
                    ui_thread.hide()

            def on_exit():
                """Exit application callback"""
                ColorPrint.yellow("[SystemTray] Exit requested")
                if ui_thread:
                    ui_thread.stop()

            # Create tray menu items
            tray_items = [
                TrayMenuItem("Show", on_show, default=True),
                TrayMenuItem("Hide", on_hide),
                TrayMenuItem.SEPARATOR,
                TrayMenuItem("Exit", on_exit)
            ]

            # Create and start system tray
            tooltip = config.tray_tooltip if hasattr(config, 'tray_tooltip') and config.tray_tooltip else config.app_name
            icon_path = config.tray_icon_path if hasattr(config, 'tray_icon_path') else None

            system_tray = SystemTray(
                app_name=config.app_name,
                menu_items=tray_items,
                icon_path=icon_path,
                tooltip=tooltip,
                on_left_click=on_show
            )

            system_tray.start_async()
            ColorPrint.green("[UIThreadService] System tray started")

        # Keep thread running (this entry point keeps the service thread alive)
        try:
            while ui_thread.is_running():
                time.sleep(0.1)
        except Exception as e:
            ColorPrint.red(f"[UIThreadService] Thread error: {e}")
        finally:
            # Stop system tray
            if system_tray:
                system_tray.stop()

        return ui_thread

    def _selenium_service_entry(self, config):
        """Selenium service entry point (ThreadedBrowser mode)"""
        from pycore.pyutils.pybrowser import BrowserFactory

        ColorPrint.green(f"[SeleniumService] Starting browser automation: {config.browser_type}")

        # Create browser configuration
        browser_config = {
            'headless': config.headless,
        }

        # Add optional args
        if config.disable_gpu:
            browser_config.setdefault('args', []).append('--disable-gpu')
        if config.no_sandbox:
            browser_config.setdefault('args', []).append('--no-sandbox')

        # Add driver configuration if specified
        if hasattr(config, 'driver_mode') and config.driver_mode:
            browser_config['driver_mode'] = config.driver_mode
        if hasattr(config, 'driver_path') and config.driver_path:
            browser_config['driver_path'] = config.driver_path
        if hasattr(config, 'binary_path') and config.binary_path:
            browser_config['binary_path'] = config.binary_path

        # Create browser instance (as thread)
        browser = BrowserFactory.create(
            browser_type=config.browser_type,
            config=browser_config,
            thread_name='SeleniumService-Browser',
            auto_start=True  # Auto-start the thread
        )

        # Wait for browser to be ready
        if not browser.wait_until_ready(timeout=30):
            ColorPrint.red(f"[SeleniumService] Browser failed to start within timeout")
            return None

        ColorPrint.green(f"[SeleniumService] Browser ready and running")

        # Keep service running
        try:
            while self.services['selenium_service'].running:
                time.sleep(0.1)
        except Exception as e:
            ColorPrint.red(f"[SeleniumService] Error in service loop: {e}")
        finally:
            # Cleanup
            ColorPrint.yellow(f"[SeleniumService] Stopping browser...")
            browser.stop()
            browser.join()
            ColorPrint.green(f"[SeleniumService] Browser stopped")

        return browser

    # ============================================
    # Service Management
    # ============================================

    def register_custom_service(
        self,
        service_name: str,
        entry_point: Callable,
        config: Any,
        daemon: bool = True
    ):
        """
        Register a custom service

        Args:
            service_name: Unique service name
            entry_point: Service entry point function
            config: Service configuration object
            daemon: Run as daemon thread

        Example:
            ```python
            def my_service_entry(config):
                # Service implementation
                pass

            launcher.register_custom_service(
                'my_service',
                my_service_entry,
                my_config
            )
            launcher.start_service('my_service')
            ```
        """
        if service_name in self.services:
            ColorPrint.yellow(f"[{service_name}] Already registered")
            return

        # Create service thread
        service_thread = ServiceThread(
            name=service_name,
            target=entry_point,
            config=config,
            daemon=daemon
        )

        # Register (but don't start)
        self.services[service_name] = service_thread

        ColorPrint.green(f"[{service_name}] Custom service registered")

    def start_service(self, service_name: str):
        """
        Start a specific service

        Args:
            service_name: Service name (web_service, mcp_service, ui_service, ui_thread_service, selenium_service, or custom service name)
        """
        # Check if already started
        if service_name in self.services:
            service_thread = self.services[service_name]
            if service_thread.started:
                ColorPrint.yellow(f"[{service_name}] Already started")
                return
            else:
                # Custom service registered but not started
                service_thread.start()
                time.sleep(self.config.startup_delay)
                return

        # Map service names to configurations and entry points
        service_map = {
            'web_service': (self.config.web_service, self._web_service_entry),
            'mcp_service': (self.config.mcp_service, self._mcp_service_entry),
            'ui_service': (self.config.ui_service, self._ui_service_entry),
            'ui_thread_service': (self.config.ui_service, self._ui_thread_service_entry),
            'selenium_service': (self.config.selenium_service, self._selenium_service_entry),
        }

        if service_name not in service_map:
            ColorPrint.red(f"Unknown service: {service_name}")
            return

        config, entry_point = service_map[service_name]

        # Create service thread
        service_thread = ServiceThread(
            name=service_name,
            target=entry_point,
            config=config,
            daemon=True
        )

        # Register and start
        self.services[service_name] = service_thread
        service_thread.start()

        # Startup delay
        time.sleep(self.config.startup_delay)

    def stop_service(self, service_name: str):
        """
        Stop a specific service

        Args:
            service_name: Service name
        """
        if service_name not in self.services:
            ColorPrint.yellow(f"[{service_name}] Not running")
            return

        service_thread = self.services[service_name]
        service_thread.stop(timeout=self.config.graceful_shutdown_timeout)

        del self.services[service_name]

    def start_all(self):
        """Start all enabled services"""
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue(" Starting All Services")
        ColorPrint.blue("=" * 60 + "\n")

        enabled_services = self.config.get_enabled_services()

        for service_name in enabled_services:
            self.start_service(service_name)

        self.running = True

        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" All Services Started")
        ColorPrint.green("=" * 60 + "\n")

    def stop_all(self):
        """Stop all running services"""
        ColorPrint.yellow("\n" + "=" * 60)
        ColorPrint.yellow(" Stopping All Services")
        ColorPrint.yellow("=" * 60 + "\n")

        self.running = False

        # Stop services in reverse order
        service_names = list(self.services.keys())
        for service_name in reversed(service_names):
            self.stop_service(service_name)

        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" All Services Stopped")
        ColorPrint.green("=" * 60 + "\n")

    def wait(self):
        """Wait for all services to finish (blocking)"""
        try:
            while self.running:
                time.sleep(1)

                # Check if any service has stopped unexpectedly
                for service_name, service_thread in list(self.services.items()):
                    if not service_thread.is_alive() and service_thread.error:
                        ColorPrint.red(f"[{service_name}] Service crashed: {service_thread.error}")

        except KeyboardInterrupt:
            ColorPrint.yellow("\nKeyboard interrupt received")
            self.stop_all()

    def get_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        return {
            'running': self.running,
            'services': {
                name: thread.get_status()
                for name, thread in self.services.items()
            }
        }

    def restart_service(self, service_name: str):
        """
        Restart a specific service

        Args:
            service_name: Service name
        """
        ColorPrint.blue(f"[{service_name}] Restarting service...")
        self.stop_service(service_name)
        time.sleep(1)
        self.start_service(service_name)

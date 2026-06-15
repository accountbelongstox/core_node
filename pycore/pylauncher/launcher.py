#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from typing import Dict, Any, Optional
from dataclasses import dataclass, field

from pycore import ColorPrint, THREAD_BUS
from pycore.pythreadpool import get_global_thread_pool, SERVICE_STARTERS
from pycore.pylauncher.singleton_detector import SingletonDetector, on_singleton_superseded


# ============================================================
# Configuration
# ============================================================

@dataclass
class LauncherConfig:
    """
    Unified service launcher configuration

    Supports both modern dict-based API and legacy boolean flags.
    Legacy flags automatically convert to services dict.

    Modern Usage:
        config = LauncherConfig(
            services={'rpc_v2': {'port': 58100}}
        )

    Legacy Usage (backward compatible):
        config = LauncherConfig(
            enable_rpc_v2=True,
            rpc_v2_port=58100
        )
    """
    # Modern API - Primary interface
    services: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    app_id: str = "default_app"
    app_name: str = "Application"
    singleton: bool = False
    singleton_port_start: int = 54000
    singleton_port_range: int = 100
    force_launch: bool = False
    shutdown_existing: bool = False

    # Tray Configuration (Cross-platform)
    enable_tray: bool = False
    tray_backend: str = "auto"          # "auto", "pystray", "pyside6"
    tray_icon_path: Optional[str] = None
    tray_menu_items: list = field(default_factory=list)

    # Legacy API - Auto-converts to services dict
    enable_heartbeat: bool = True
    enable_rpc_v2: bool = False
    rpc_v2_port: int = 58100
    rpc_v2_host: str = "0.0.0.0"
    rpc_v2_debug: bool = True
    enable_speech: bool = False
    speech_mode: str = "single"
    enable_ui: bool = False
    singleton_check: bool = False  # Maps to 'singleton'

    def __post_init__(self):
        """Convert legacy flags to modern services dict"""
        # If using legacy API (any enable_* flag), convert to services
        legacy_used = (
            self.enable_rpc_v2 or
            self.enable_speech or
            self.enable_ui or
            not self.enable_heartbeat
        )

        if legacy_used and not self.services:
            # Build services from legacy flags
            if self.enable_heartbeat:
                self.services['heartbeat'] = {}

            if self.enable_rpc_v2:
                self.services['rpc_v2'] = {
                    'port': self.rpc_v2_port,
                    'host': self.rpc_v2_host,
                    'debug': self.rpc_v2_debug
                }

            if self.enable_speech:
                self.services['speech'] = {'mode': self.speech_mode}

            if self.enable_ui:
                self.services['ui'] = {}

            # Map legacy singleton_check to singleton
            if self.singleton_check:
                self.singleton = True

    @classmethod
    def rpc_v2_only(cls, port: int = 58100, singleton: bool = False):
        """Quick config for RPC v2 only"""
        return cls(
            app_id="rpc_v2_app",
            app_name="RPC v2 Service",
            singleton=singleton,
            services={
                'heartbeat': {},
                'rpc_v2': {'port': port, 'host': '0.0.0.0', 'debug': True}
            }
        )

    @classmethod
    def speech_only(cls, mode: str = "single", singleton: bool = False):
        """Quick config for Speech only"""
        return cls(
            app_id="speech_app",
            app_name="Speech Service",
            singleton=singleton,
            services={
                'heartbeat': {},
                'speech': {'mode': mode}
            }
        )


# ============================================================
# Service Launcher
# ============================================================

class ServiceLauncher:
    """Service launcher - thin wrapper calling pythreadpool starters"""

    def __init__(self, config: LauncherConfig):
        """
        Initialize launcher

        Args:
            config: LauncherConfig (supports both modern and legacy API)
        """
        self.config = config
        self.services = {}
        self.singleton_detector = None
        self.detection_result = None  # Singleton detection result
        self._started = False

        # Ensure heartbeat is always enabled
        if 'heartbeat' not in config.services:
            config.services['heartbeat'] = {}

    def start(self) -> bool:
        """Start all configured services"""
        if self._started:
            ColorPrint.yellow("[Launcher] Already started")
            return False

        ColorPrint.green(f"=== Launching {self.config.app_name} ===")

        # Singleton detection
        if self.config.singleton and not self._singleton_detect():
            return False

        # Start services (call pythreadpool starters)
        success_count = 0
        for name, cfg in self.config.services.items():
            if name not in SERVICE_STARTERS:
                ColorPrint.red(f"[Launcher] Unknown service: {name}")
                continue

            try:
                instance = SERVICE_STARTERS[name](cfg)
                if instance:
                    self.services[name] = instance
                    success_count += 1
            except Exception as e:
                ColorPrint.red(f"[Launcher] Failed to start {name}: {e}")
                import traceback
                traceback.print_exc()

        self._started = True
        THREAD_BUS.signal("launcher.services.started", {
            'app_name': self.config.app_name,
            'services': list(self.services.keys()),
            'success_count': success_count
        })

        ColorPrint.green(f"=== Launched {success_count}/{len(self.config.services)} services ===")

        # Signal that third-party packages are loaded (all services started)
        # This allows tk startup window (TkinterStartupThread) to auto-close if configured
        THREAD_BUS.trigger_event('system.third_party_packages_loaded', {
            'message': 'All required third-party packages have been loaded',
            'app_name': self.config.app_name,
            'services': list(self.services.keys())
        })
        ColorPrint.blue("[Launcher] Third-party packages loaded signal sent")

        return success_count > 0

    def _singleton_detect(self) -> bool:
        """
        Perform singleton detection

        Simplified: Just calls SingletonDetector once.
        All retry logic is handled inside SingletonDetector.
        """
        ColorPrint.blue(f"[Singleton] Detecting {self.config.app_id}...")

        # Inter-instance takeover (newest-wins) is owned entirely by the detector:
        # it fires 'singleton.superseded' and triggers the graceful shutdown when a
        # newer instance arrives, so no on_message shutdown handler is needed here
        # (that path was redundant with request_shutdown). state_checker still
        # reports busy state for STATUS queries (external monitors), but no longer
        # gates a sibling takeover.
        def state_checker():
            """Report whether the app is busy (for STATUS queries only)."""
            is_busy = THREAD_BUS.is_busy()
            return {
                'can_shutdown': not is_busy,
                'message': THREAD_BUS.get_busy_reason() if is_busy else 'Ready to shutdown'
            }

        # Create detector with all configuration
        self.singleton_detector = SingletonDetector(
            app_id=self.config.app_id,
            port_start=self.config.singleton_port_start,
            port_range=self.config.singleton_port_range,
            debug=True,
            state_checker=state_checker,
            shutdown_existing=self.config.shutdown_existing  # Pass config to detector
        )

        # Detect and bind (handles retry internally)
        detection = self.singleton_detector.detect_and_bind()
        self.detection_result = detection

        # Check result
        if detection.is_primary:
            ColorPrint.green(f"[Singleton] PRIMARY on port {detection.port}")
            return True
        elif detection.existing_instance and not self.config.force_launch:
            if detection.yielded_to_newer:
                ColorPrint.yellow("[Singleton] A NEWER instance is already running; yielding to it")
            ColorPrint.yellow(f"[Singleton] Existing instance at {detection.existing_port}")
            ColorPrint.yellow(f"[Singleton] {detection.message}")
            return False
        elif self.config.force_launch:
            ColorPrint.yellow("[Singleton] force_launch=True, continuing anyway")
            return True
        else:
            ColorPrint.red("[Singleton] Failed to become PRIMARY")
            return False

    def stop(self) -> bool:
        """Stop all services via THREAD_BUS shutdown stack"""
        if not self._started:
            ColorPrint.yellow("[Launcher] Not started")
            return False

        ColorPrint.yellow("[Launcher] Stopping services...")
        THREAD_BUS.request_shutdown("Launcher shutdown", execute_handlers=True)

        if self.singleton_detector:
            self.singleton_detector.stop()

        self._started = False
        ColorPrint.green("[Launcher] All services stopped")
        return True

    def get_service(self, name: str):
        """
        Get service instance by name

        Returns the actual service instance started by pythreadpool.
        Use this to access service-specific APIs.

        Args:
            name: Service name ('rpc_v2', 'heartbeat', 'speech', etc.)

        Returns:
            Service instance or None

        Example:
            # Get RPC v2 server and register custom route
            rpc = launcher.get_service('rpc_v2')
            if rpc:
                rpc.server.route('custom', handler_func, sync=True)

            # Get heartbeat system
            heartbeat = launcher.get_service('heartbeat')
            if heartbeat:
                heartbeat.pause()  # See HeartbeatSystem API
        """
        return self.services.get(name)

    def is_running(self, service_name: str = None) -> bool:
        """
        Check if launcher or specific service is running

        Args:
            service_name: Optional service name to check. If None, checks if launcher is running

        Returns:
            True if launcher (or specified service) is running

        Example:
            launcher.is_running()              # Check if launcher started
            launcher.is_running('rpc_v2')      # Check if RPC v2 service is running
            launcher.is_running('heartbeat')   # Check if heartbeat is running
        """
        if service_name is None:
            return self._started
        return service_name in self.services and self.services[service_name] is not None


# ============================================================
# Convenience Functions
# ============================================================

def launch_services(config: LauncherConfig) -> ServiceLauncher:
    """Convenience function to launch services"""
    launcher = ServiceLauncher(config)
    launcher.start()
    return launcher


def stop_services(launcher: ServiceLauncher):
    """Convenience function to stop services"""
    launcher.stop()


__all__ = [
    'LauncherConfig',
    'ServiceLauncher',
    'launch_services',
    'stop_services',
    'SingletonDetector',
    'on_singleton_superseded',
]



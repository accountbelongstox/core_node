#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Modular Service Launcher

Purpose: Launch application services selectively (UI, RPC, Speech, Heartbeat)
Supports selective service startup via parameters.

Services:
- UI: Native UI with tray support
- RPC: HTTP/WebSocket RPC server
- Speech: TTS/STT processing
- Heartbeat: Task scheduling system

Usage:
    from pycore.pylauncher import launch_services, ServiceConfig

    # Launch RPC only
    launch_services(ServiceConfig(enable_rpc=True))

    # Launch UI with Speech
    launch_services(ServiceConfig(enable_ui=True, enable_speech=True))

    # Launch all services
    launch_services(ServiceConfig.all_services())
"""

import time
from typing import Callable, Optional, Any, Dict
from enum import Enum
from dataclasses import dataclass, field

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.singleton_detector import SingletonDetector
from pycore.pyutils.native_ui import get_bus_manager


# ============================================================
# Service Configuration
# ============================================================

@dataclass
class ServiceConfig:
    """Configuration for service launcher"""
    # UI Service
    enable_ui: bool = False
    ui_mode: str = "debug_with_tray"  # debug_only, debug_with_tray, tray_only
    startup_width: int = 600
    startup_height: int = 500
    min_display_time: float = 2.0
    icon_path: Optional[str] = None
    logo_path: Optional[str] = None
    enable_language_selector: bool = True

    # RPC Service
    enable_rpc: bool = False
    rpc_port: int = 8080
    rpc_host: str = "0.0.0.0"
    rpc_debug: bool = True

    # Speech Service
    enable_speech: bool = False
    speech_mode: str = "single"  # single or dual
    mic_language: str = "zh-CN"
    system_language: str = "en-US"

    # Heartbeat Service
    enable_heartbeat: bool = False
    heartbeat_tick_interval: float = 1.0

    # TTS Switch
    enable_tts_switch: bool = False
    tts_default_provider: str = "edge"  # edge, azure, both

    # STT Switch
    enable_stt_switch: bool = False
    stt_default_provider: str = "auto"  # azure, local, auto
    stt_max_queue_size: int = 50
    tts_max_queue_size: int = 50

    # General
    app_id: str = "default_app"
    app_name: str = "Application"
    port_start: int = 54000
    port_range: int = 100
    singleton_check: bool = True
    force_launch: bool = False

    @classmethod
    def rpc_only(cls, port: int = 8080, host: str = "0.0.0.0") -> 'ServiceConfig':
        """Configuration for RPC service only"""
        return cls(
            enable_rpc=True,
            rpc_port=port,
            rpc_host=host,
            enable_heartbeat=True,
            enable_tts_switch=True,
            singleton_check=False
        )

    @classmethod
    def speech_only(cls, mode: str = "single") -> 'ServiceConfig':
        """Configuration for speech service only"""
        return cls(
            enable_speech=True,
            speech_mode=mode,
            enable_tts_switch=True,
            singleton_check=False
        )

    @classmethod
    def ui_only(cls) -> 'ServiceConfig':
        """Configuration for UI only"""
        return cls(enable_ui=True)

    @classmethod
    def all_services(cls) -> 'ServiceConfig':
        """Configuration for all services"""
        return cls(
            enable_ui=True,
            enable_rpc=True,
            enable_speech=True,
            enable_heartbeat=True,
            enable_tts_switch=True
        )


# ============================================================
# Launch Mode
# ============================================================

class LaunchMode(Enum):
    """Native UI launch modes"""
    DEBUG_ONLY = "debug_only"           # Debug window only (closes after init)
    DEBUG_WITH_TRAY = "debug_with_tray" # Debug window + Tray (tray persists)
    TRAY_ONLY = "tray_only"             # Tray only (no debug window)


# ============================================================
# Launch Result
# ============================================================

@dataclass
class LaunchResult:
    """Result of launch attempt"""
    success: bool
    is_primary: bool
    port: int
    existing_instance: bool
    existing_port: Optional[int]
    message: str
    detector: Optional[SingletonDetector]


# ============================================================
# Native UI Launcher (Parameter Forwarder)
# ============================================================

class NativeUILauncher:
    """
    Native UI Launcher - Simple Parameter Forwarder

    Purpose:
    - Forward parameters to native_ui
    - Add singleton detection
    - No complex logic
    """

    def __init__(
        self,
        app_id: str,
        port_start: int = 54000,
        port_range: int = 100,
        timeout: float = 1.0,
        debug: bool = True
    ):
        """Initialize launcher"""
        self.app_id = app_id
        self.port_start = port_start
        self.port_range = port_range
        self.timeout = timeout
        self.debug = debug
        self._detector: Optional[SingletonDetector] = None
        self._bus_mgr = get_bus_manager()

    def launch(
        self,
        app_name: str,
        main_entry: Callable,
        mode: LaunchMode = LaunchMode.DEBUG_WITH_TRAY,
        startup_width: int = 600,
        startup_height: int = 500,
        min_display_time: float = 2.0,
        icon_path: Optional[str] = None,
        logo_path: Optional[str] = None,
        enable_language_selector: bool = True,
        force: bool = False
    ) -> LaunchResult:
        """
        Launch application (forward parameters + singleton detection)

        Steps:
        1. Singleton detection
        2. Forward all parameters to native_ui
        3. Return result
        """
        # Step 1: Singleton detection
        self._detector = SingletonDetector(
            app_id=self.app_id,
            port_start=self.port_start,
            port_range=self.port_range,
            timeout=self.timeout,
            debug=self.debug
        )

        detection = self._detector.detect_and_bind()

        # Check existing instance
        if detection.existing_instance:
            if not force:
                return LaunchResult(
                    success=False,
                    is_primary=False,
                    port=0,
                    existing_instance=True,
                    existing_port=detection.existing_port,
                    message=f"Found existing instance at port {detection.existing_port}",
                    detector=None
                )

        # Check if became PRIMARY
        if not detection.is_primary:
            return LaunchResult(
                success=False,
                is_primary=False,
                port=0,
                existing_instance=False,
                existing_port=None,
                message="No available ports in range",
                detector=None
            )

        # Step 2: Forward parameters to native_ui
        from pycore.pyutils.native_ui import launch_app_with_startup

        enable_tray = (mode == LaunchMode.DEBUG_WITH_TRAY or mode == LaunchMode.TRAY_ONLY)

        # Store launcher info in THREAD_BUS
        THREAD_BUS.signal("ui.launcher.state", "starting")
        THREAD_BUS.signal("ui.launcher.port", detection.port)
        THREAD_BUS.signal("ui.launcher.app_id", self.app_id)

        # Forward to native_ui
        launch_app_with_startup(
            app_name=app_name,
            main_entry=main_entry,
            startup_width=startup_width,
            startup_height=startup_height,
            min_display_time=min_display_time,
            icon_path=icon_path,
            logo_path=logo_path,
            enable_language_selector=enable_language_selector,
            enable_tray=enable_tray
        )

        # Step 3: Return result
        THREAD_BUS.signal("ui.launcher.state", "running")

        return LaunchResult(
            success=True,
            is_primary=True,
            port=detection.port,
            existing_instance=False,
            existing_port=None,
            message=f"Launched successfully on port {detection.port}",
            detector=self._detector
        )

    def stop(self):
        """Stop launcher"""
        if self._detector:
            self._detector.stop()


# ============================================================
# Convenience Function
# ============================================================

def launch_native_ui(
    app_id: str,
    app_name: str,
    main_entry: Callable,
    mode: LaunchMode = LaunchMode.DEBUG_WITH_TRAY,
    port_start: int = 54000,
    enable_speech: bool = False,
    speech_mode: str = "single",
    **kwargs
) -> LaunchResult:
    """
    Convenience function for launching with optional speech

    Args:
        app_id: Application ID
        app_name: Application name
        main_entry: Main entry function
        mode: Launch mode
        port_start: Starting port
        enable_speech: Enable speech transcription thread
        speech_mode: Speech mode ("single" or "dual")
        **kwargs: Additional parameters

    Returns:
        LaunchResult
    """
    launcher = NativeUILauncher(
        app_id=app_id,
        port_start=port_start,
        debug=True
    )
    result = launcher.launch(
        app_name=app_name,
        main_entry=main_entry,
        mode=mode,
        **kwargs
    )

    # Start speech thread if enabled
    if enable_speech:
        start_speech_thread(mode=speech_mode)

    return result


# ============================================================
# Speech Launcher
# ============================================================

def launch_speech_only(
    mode: str = "single",
    mic_language: str = "zh-CN",
    system_language: str = "en-US",
    check_platform: bool = True,
    enable_rpc: bool = False,
    rpc_port: int = 8080,
    rpc_host: str = "0.0.0.0"
) -> bool:
    """
    Launch speech transcription only (no UI)

    Platform-specific handling:
    - Windows: Full support (WASAPI loopback)
    - Linux: Check for PulseAudio/ALSA
    - macOS: Requires BlackHole for system audio

    Args:
        mode: Transcription mode ("single" or "dual")
        mic_language: Language for microphone
        system_language: Language for system audio
        check_platform: Check platform compatibility
        enable_rpc: Start RPC HTTP service (default: False)
        rpc_port: RPC server port (default: 8080)
        rpc_host: RPC server host (default: 0.0.0.0)

    Returns:
        True if launched successfully
    """
    import platform
    current_platform = platform.system()

    # Platform compatibility check
    if check_platform:
        ColorPrint.blue(f"[Launcher] Platform: {current_platform}")

        if current_platform == "Linux":
            # Check for audio requirements on Linux
            if not _check_linux_audio_support():
                ColorPrint.yellow("[Launcher] Limited audio support on Linux")
                ColorPrint.yellow("[Launcher] Ensure PulseAudio or ALSA is installed")

                user_input = input("Continue anyway? (y/n) [default: y]: ").strip().lower()
                if user_input == 'n':
                    ColorPrint.red("[Launcher] Launch cancelled by user")
                    return False

        elif current_platform == "Darwin":
            ColorPrint.yellow("[Launcher] macOS detected")
            ColorPrint.yellow("[Launcher] System audio requires BlackHole or Soundflower")

    # Start RPC service if enabled (must be started before speech thread)
    rpc_instances = None
    if enable_rpc:
        ColorPrint.blue(f"[Launcher] Starting RPC HTTP service on {rpc_host}:{rpc_port}")
        from pycore.pyctl.speech.launch_speech_rpc import launch_speech_rpc_service
        rpc_instances = launch_speech_rpc_service(
            port=rpc_port,
            host=rpc_host,
            tts_provider="edge",
            debug=True
        )
        if rpc_instances and rpc_instances.rpc_server:
            ColorPrint.green(f"[Launcher] RPC HTTP service started: http://{rpc_host}:{rpc_port}")
        else:
            ColorPrint.red("[Launcher] Failed to start RPC service")

    # Create and start speech thread
    from pycore.pyctl.speech.speech_thread import SpeechTranscriptionThread

    thread = SpeechTranscriptionThread(
        mode=mode,
        mic_language=mic_language,
        system_language=system_language,
        daemon=False  # Not daemon for standalone mode
    )

    ColorPrint.green(f"[Launcher] Starting speech transcription - Mode: {mode}")
    thread.start()

    # Send start event
    THREAD_BUS.signal("speech.launcher.started", {
        "mode": mode,
        "platform": current_platform,
        "mic_language": mic_language,
        "system_language": system_language,
        "rpc_enabled": enable_rpc,
        "rpc_port": rpc_port if enable_rpc else None
    })

    # Wait for thread to complete (blocking)
    thread.join()

    # Cleanup RPC if started
    if rpc_instances:
        ColorPrint.blue("[Launcher] Stopping RPC service...")
        from pycore.pylauncher import stop_services
        stop_services(rpc_instances)

    ColorPrint.blue("[Launcher] Speech transcription completed")
    return True


def start_speech_thread(
    mode: str = "single",
    mic_language: str = "zh-CN",
    system_language: str = "en-US",
    daemon: bool = True
) -> Optional['SpeechTranscriptionThread']:
    """
    Start speech transcription thread (non-blocking)

    Args:
        mode: Transcription mode ("single" or "dual")
        mic_language: Language for microphone
        system_language: Language for system audio
        daemon: Run as daemon thread

    Returns:
        SpeechTranscriptionThread instance or None if failed
    """
    from pycore.pyctl.speech.speech_thread import SpeechTranscriptionThread

    thread = SpeechTranscriptionThread(
        mode=mode,
        mic_language=mic_language,
        system_language=system_language,
        daemon=daemon
    )

    ColorPrint.green(f"[Launcher] Starting speech thread - Mode: {mode}")
    thread.start()

    # Send start event
    THREAD_BUS.signal("speech.thread.launched", {
        "mode": mode,
        "daemon": daemon
    })

    return thread


def launch_speech_service(
    auto_start: bool = False,
    daemon: bool = True
) -> Optional['SpeechServiceThread']:
    """
    Launch speech service thread (background service)

    Service can be controlled via THREAD_BUS commands:
    - "speech.service.start" - Start transcription
    - "speech.service.stop" - Stop service
    - "speech.service.status" - Query status

    Args:
        auto_start: Auto-start transcription on launch
        daemon: Run as daemon thread

    Returns:
        SpeechServiceThread instance or None if failed
    """
    from pycore.pyctl.speech.speech_thread import SpeechServiceThread

    thread = SpeechServiceThread(
        auto_start=auto_start,
        daemon=daemon
    )

    ColorPrint.green(f"[Launcher] Starting speech service - Auto-start: {auto_start}")
    thread.start()

    # Send start event
    THREAD_BUS.signal("speech.service.launched", {
        "auto_start": auto_start,
        "daemon": daemon
    })

    return thread


def _check_linux_audio_support() -> bool:
    """
    Check Linux audio support

    Returns:
        True if audio support detected
    """
    import subprocess
    import shutil

    # Check for PulseAudio
    if shutil.which("pulseaudio"):
        ColorPrint.green("[Launcher] PulseAudio detected")
        return True

    # Check for pactl
    if shutil.which("pactl"):
        try:
            result = subprocess.run(
                ["pactl", "info"],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0:
                ColorPrint.green("[Launcher] PulseAudio running")
                return True
        except:
            pass

    # Check for ALSA
    if shutil.which("aplay"):
        ColorPrint.yellow("[Launcher] ALSA detected (basic support)")
        return True

    ColorPrint.yellow("[Launcher] No audio system detected")
    return False


# ============================================================
# Modular Service Launcher
# ============================================================

@dataclass
class ServiceInstances:
    """Container for started service instances"""
    heartbeat_system: Optional[Any] = None
    tts_switch: Optional[Any] = None
    stt_switch: Optional[Any] = None
    rpc_server: Optional[Any] = None
    speech_thread: Optional[Any] = None
    ui_launcher: Optional[NativeUILauncher] = None
    singleton_detector: Optional[SingletonDetector] = None


def launch_services(
    config: ServiceConfig,
    main_entry: Optional[Callable] = None
) -> ServiceInstances:
    """
    Launch application services based on configuration

    Args:
        config: ServiceConfig specifying which services to start
        main_entry: Main entry function for UI (required if enable_ui=True)

    Returns:
        ServiceInstances containing all started service instances
    """
    instances = ServiceInstances()

    ColorPrint.green(f"=== Launching Services for {config.app_name} ===")

    # Step 1: Singleton check (if enabled)
    if config.singleton_check:
        detector = SingletonDetector(
            app_id=config.app_id,
            port_start=config.port_start,
            port_range=config.port_range,
            debug=True
        )
        detection = detector.detect_and_bind()

        if detection.existing_instance and not config.force_launch:
            ColorPrint.yellow(f"[Launcher] Existing instance at port {detection.existing_port}")
            return instances

        if detection.is_primary:
            instances.singleton_detector = detector
            ColorPrint.green(f"[Launcher] Primary instance on port {detection.port}")

    # Step 2: Start Heartbeat System
    if config.enable_heartbeat:
        ColorPrint.blue("[Launcher] Starting Heartbeat System...")
        from pycore.pyheartbeat import initialize_heartbeat_system
        instances.heartbeat_system = initialize_heartbeat_system()
        instances.heartbeat_system.start()
        ColorPrint.green("[Launcher] Heartbeat System started")

    # Step 3: Start Unified Speech Switch (replaces TTS Switch + STT Switch)
    if config.enable_tts_switch or config.enable_stt_switch:
        ColorPrint.blue("[Launcher] Starting Unified Speech Switch...")
        from pycore.pyutils.common import initialize_speech_switch, get_provider_status

        # Initialize unified speech switch
        instances.speech_switch = initialize_speech_switch()

        # Register with heartbeat if enabled
        if config.enable_heartbeat:
            instances.speech_switch.register_with_heartbeat()

        # Get provider status for reporting
        provider_status = get_provider_status()
        status = provider_status.get_all_status()

        # Report available providers
        tts_providers = [p for p, info in status['tts'].items() if info['available']]
        stt_providers = [p for p, info in status['stt'].items() if info['available']]

        ColorPrint.green(f"[Launcher] Speech Switch started")
        ColorPrint.green(f"[Launcher]   TTS providers: {tts_providers}")
        ColorPrint.green(f"[Launcher]   STT providers: {stt_providers}")

        # Store references for backward compatibility
        instances.tts_switch = instances.speech_switch
        instances.stt_switch = instances.speech_switch

    # Step 4: Start RPC Server (thread-based, non-blocking)
    if config.enable_rpc:
        ColorPrint.blue("[Launcher] Starting RPC Server Thread...")
        # Use ThreadedRpcServer - pure thread-based, NO asyncio
        from pycore.pyutils.rpc import get_threaded_rpc_server
        instances.rpc_server = get_threaded_rpc_server()
        instances.rpc_server.configure(
            host=config.rpc_host,
            port=config.rpc_port,
            debug=config.rpc_debug if hasattr(config, 'rpc_debug') else True  # Enable debug by default
        )
        # Start as thread (Thread.start())
        instances.rpc_server.start()
        ColorPrint.green(f"[Launcher] RPC Server Thread started (port: {config.rpc_port})")
        ColorPrint.blue(f"[Launcher] HTTP RPC: http://{config.rpc_host}:{config.rpc_port}/rpc/<route>")

        # NOTE: RPC Server does NOT register to GlobalThreadPool
        # It is an HTTP interface layer, not a task processor
        # Only task processors (SpeechSwitch) should register

        # Store in THREAD_BUS for other modules to access
        THREAD_BUS.send_message("launcher.rpc_server", instances.rpc_server)
        THREAD_BUS.signal("launcher.rpc.started", {
            'port': config.rpc_port,
            'host': config.rpc_host
        })

    # Step 5: Start Speech Service
    if config.enable_speech:
        ColorPrint.blue("[Launcher] Starting Speech Service...")
        instances.speech_thread = start_speech_thread(
            mode=config.speech_mode,
            mic_language=config.mic_language,
            system_language=config.system_language,
            daemon=True
        )
        ColorPrint.green(f"[Launcher] Speech Service started (mode: {config.speech_mode})")

    # Step 6: Start UI (if enabled)
    if config.enable_ui:
        if main_entry is None:
            ColorPrint.red("[Launcher] main_entry required for UI launch")
        else:
            ColorPrint.blue("[Launcher] Starting UI...")
            mode_map = {
                "debug_only": LaunchMode.DEBUG_ONLY,
                "debug_with_tray": LaunchMode.DEBUG_WITH_TRAY,
                "tray_only": LaunchMode.TRAY_ONLY
            }
            ui_mode = mode_map.get(config.ui_mode, LaunchMode.DEBUG_WITH_TRAY)

            instances.ui_launcher = NativeUILauncher(
                app_id=config.app_id,
                port_start=config.port_start,
                port_range=config.port_range
            )
            instances.ui_launcher.launch(
                app_name=config.app_name,
                main_entry=main_entry,
                mode=ui_mode,
                startup_width=config.startup_width,
                startup_height=config.startup_height,
                min_display_time=config.min_display_time,
                icon_path=config.icon_path,
                logo_path=config.logo_path,
                enable_language_selector=config.enable_language_selector
            )
            ColorPrint.green("[Launcher] UI started")

    # Broadcast launch complete
    THREAD_BUS.signal("launcher.services.started", {
        'heartbeat': config.enable_heartbeat,
        'tts_switch': config.enable_tts_switch,
        'rpc': config.enable_rpc,
        'speech': config.enable_speech,
        'ui': config.enable_ui
    })

    ColorPrint.green(f"=== All Services Launched ===")
    return instances


def stop_services(instances: ServiceInstances):
    """
    Stop all running services

    Args:
        instances: ServiceInstances to stop
    """
    ColorPrint.yellow("[Launcher] Stopping services...")

    if instances.speech_thread and hasattr(instances.speech_thread, 'stop'):
        instances.speech_thread.stop()

    if instances.rpc_server and hasattr(instances.rpc_server, 'stop'):
        ColorPrint.blue("[Launcher] Stopping RPC Server...")
        instances.rpc_server.stop()

    if instances.stt_switch:
        ColorPrint.blue("[Launcher] Stopping STT Switch...")
        instances.stt_switch.stop()

    if instances.tts_switch:
        ColorPrint.blue("[Launcher] Stopping TTS Switch...")
        instances.tts_switch.stop()

    if instances.heartbeat_system:
        instances.heartbeat_system.stop()

    if instances.ui_launcher:
        instances.ui_launcher.stop()

    if instances.singleton_detector:
        instances.singleton_detector.stop()

    ColorPrint.blue("[Launcher] All services stopped")


def get_rpc_server_from_launcher() -> Optional[Any]:
    """
    Get RPC server instance from launcher

    Returns:
        UnifiedRpcServer instance or None
    """
    return THREAD_BUS.receive_message("launcher.rpc_server", block=False)


# ============================================================
# Speech Module Integration Helper
# ============================================================

def create_speech_service_config(
    rpc_port: int = 8080,
    rpc_host: str = "0.0.0.0",
    tts_provider: str = "edge"
) -> ServiceConfig:
    """
    Create ServiceConfig for pyctl/speech module

    This configuration enables RPC only (no UI).

    Args:
        rpc_port: RPC server port
        rpc_host: RPC server host
        tts_provider: Default TTS provider

    Returns:
        ServiceConfig for speech service
    """
    return ServiceConfig(
        app_id="speech_service",
        app_name="Speech Service",
        enable_ui=False,
        enable_rpc=True,
        rpc_port=rpc_port,
        rpc_host=rpc_host,
        enable_speech=False,  # Speech handled by pyctl/speech
        enable_heartbeat=True,
        enable_tts_switch=True,
        tts_default_provider=tts_provider,
        enable_stt_switch=True,  # STT processor (symmetric with TTS)
        singleton_check=False
    )

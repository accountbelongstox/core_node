#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Initialization Manager

统一初始化管理器 - 前置条件模式

核心原则：初始化是启动其他模块的前置条件，而不是其他模块去调用初始化

所有初始化在应用启动时完成，运行时不再检查
"""

import sys
from pathlib import Path
from typing import Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint


class InitializationManager:
    """
    统一初始化管理器

    按阶段初始化系统：
    - Phase 1: 全局工具（scrcpy, adb, jar）
    - Phase 2: 核心服务（单例实例化）
    - Phase 3: ADB服务（设备管理）
    """

    def __init__(self):
        self._initialized_phases = set()
        self._scrcpy_paths = None
        self._scrcpy_manager = None

    def initialize_phase1_global_tools(self) -> dict:
        """
        Phase 1: 全局工具初始化

        初始化所有外部依赖工具和文件：
        - scrcpy tools (adb.exe, scrcpy.exe)
        - scrcpy-server.jar (7MB+)
        - 必要目录（logs, cache, config）

        Returns:
            dict: 初始化结果，包含工具路径
        """
        if 'phase1' in self._initialized_phases:
            ColorPrint.yellow("[InitManager] Phase 1 already initialized, skipping")
            return {
                'scrcpy_paths': self._scrcpy_paths,
                'scrcpy_manager': self._scrcpy_manager
            }

        ColorPrint.blue("=" * 80)
        ColorPrint.blue("[InitManager] Phase 1: Global Tools Initialization")
        ColorPrint.blue("=" * 80)

        # ========== STEP 1.1: Initialize scrcpy and ADB ==========
        ColorPrint.blue("[InitManager] 1.1 Initializing scrcpy and ADB tools...")

        from pycore.pyutils.device.scrcpy_init import get_initializer

        scrcpy_initializer = get_initializer()

        # Ensure scrcpy is initialized (extracts adb.exe, scrcpy.exe from package)
        if not scrcpy_initializer.is_initialized():
            ColorPrint.blue("[InitManager] Scrcpy not initialized, initializing now...")
            if scrcpy_initializer.initialize():
                ColorPrint.green("[InitManager] ✓ Scrcpy initialized successfully")
            else:
                ColorPrint.red("[InitManager] ✗ Failed to initialize scrcpy")
                raise RuntimeError("Failed to initialize scrcpy")
        else:
            ColorPrint.green("[InitManager] ✓ Scrcpy already initialized")

        # Get and cache tool paths
        self._scrcpy_paths = scrcpy_initializer.get_paths()
        ColorPrint.green(f"[InitManager] ✓ ADB path: {self._scrcpy_paths['adb']}")
        ColorPrint.green(f"[InitManager] ✓ Scrcpy path: {self._scrcpy_paths['scrcpy']}")
        ColorPrint.green(f"[InitManager] ✓ Scrcpy directory: {self._scrcpy_paths['scrcpy_dir']}")

        # ========== STEP 1.2: Initialize scrcpy-server.jar ==========
        ColorPrint.blue("[InitManager] 1.2 Initializing scrcpy-server.jar...")

        from pycore.pyutils.device.scrcpy_server_manager import get_scrcpy_server_manager
        from pyapps.matrix.matrix_config import Config

        # Use the ADB path from scrcpy_init
        adb_path = str(self._scrcpy_paths['adb']) if self._scrcpy_paths['adb'] else Config.get_adb_path()

        self._scrcpy_manager = get_scrcpy_server_manager(
            adb_path=adb_path,
            jar_path=Config.get_scrcpy_server_jar()
        )

        # Download and validate jar file (with retry support)
        # This will block here, but BEFORE any device scanning starts
        if self._scrcpy_manager.ensure_local_jar(auto_download=True):
            jar_path = self._scrcpy_manager._validated_jar_path or self._scrcpy_manager.jar_path
            jar_size = jar_path.stat().st_size if jar_path.exists() else 0
            ColorPrint.green(f"[InitManager] ✓ scrcpy-server.jar ready: {jar_path}")
            ColorPrint.green(f"[InitManager] ✓ File size: {jar_size / 1024 / 1024:.2f} MB")
        else:
            ColorPrint.red("[InitManager] ✗ Failed to ensure scrcpy-server.jar")
            raise RuntimeError("Failed to ensure scrcpy-server.jar")

        # ========== STEP 1.3: Ensure directories ==========
        ColorPrint.blue("[InitManager] 1.3 Ensuring directories...")
        self._ensure_directories()
        ColorPrint.green("[InitManager] ✓ All directories ensured")

        self._initialized_phases.add('phase1')
        ColorPrint.green("=" * 80)
        ColorPrint.green("[InitManager] ✓ Phase 1 complete - All global tools ready")
        ColorPrint.green("=" * 80)

        return {
            'scrcpy_paths': self._scrcpy_paths,
            'scrcpy_manager': self._scrcpy_manager
        }

    def initialize_phase2_core_services(self, rpc_server=None) -> dict:
        """
        Phase 2: 核心服务初始化

        强制实例化所有懒加载单例服务，建立服务间引用关系

        Args:
            rpc_server: RPC server instance (optional)

        Returns:
            dict: 初始化的服务实例
        """
        if 'phase2' in self._initialized_phases:
            ColorPrint.yellow("[InitManager] Phase 2 already initialized, skipping")
            return {}

        ColorPrint.blue("=" * 80)
        ColorPrint.blue("[InitManager] Phase 2: Core Services Initialization")
        ColorPrint.blue("=" * 80)

        services = {}

        # ========== 2.1 Config Service ==========
        ColorPrint.blue("[InitManager] 2.1 Initializing ConfigService...")
        from pyapps.matrix.services.config_service import ConfigService
        services['config'] = ConfigService.instance()
        ColorPrint.green("[InitManager] ✓ ConfigService initialized")

        # ========== 2.2 Logging Service ==========
        ColorPrint.blue("[InitManager] 2.2 Initializing LoggingService...")
        from pyapps.matrix.services.logging_service import LoggingService
        services['logging'] = LoggingService.instance()
        # Note: LoggingService may already be initialized in matrix_main.py startup
        ColorPrint.green("[InitManager] ✓ LoggingService initialized")

        # ========== 2.3 Device ID Manager ==========
        ColorPrint.blue("[InitManager] 2.3 Initializing DeviceIDManager...")
        from pyapps.matrix.services.device_id_manager import DeviceIDManager
        services['device_id_manager'] = DeviceIDManager.instance()
        ColorPrint.green("[InitManager] ✓ DeviceIDManager initialized")

        # ========== 2.4 Video Stream Service ==========
        ColorPrint.blue("[InitManager] 2.4 Initializing VideoStreamService...")
        from pyapps.matrix.services.video_stream_service import VideoStreamService
        services['video_stream'] = VideoStreamService.instance()
        ColorPrint.green("[InitManager] ✓ VideoStreamService initialized")

        # ========== 2.5 Video Health Service ==========
        ColorPrint.blue("[InitManager] 2.5 Initializing VideoStreamHealthService...")
        from pyapps.matrix.services.video_stream_health_service import get_video_stream_health_service
        services['video_health'] = get_video_stream_health_service()
        if rpc_server:
            services['video_health'].set_rpc_server(rpc_server)
        ColorPrint.green("[InitManager] ✓ VideoStreamHealthService initialized")

        # ========== 2.6 Device State Coordinator ==========
        ColorPrint.blue("[InitManager] 2.6 Initializing DeviceStateCoordinator...")
        from pyapps.matrix.services.device_state_coordinator import get_device_state_coordinator

        # Establish service coordination
        services['video_health'].set_video_stream_service(services['video_stream'])

        services['device_state_coordinator'] = get_device_state_coordinator()
        services['device_state_coordinator'].initialize()
        ColorPrint.green("[InitManager] ✓ DeviceStateCoordinator initialized")

        self._initialized_phases.add('phase2')
        ColorPrint.green("=" * 80)
        ColorPrint.green("[InitManager] ✓ Phase 2 complete - All core services ready")
        ColorPrint.green("=" * 80)

        return services

    def initialize_phase3_adb_service(self, adb_path: str, rpc_server=None) -> object:
        """
        Phase 3: ADB服务初始化

        初始化ADB心跳服务

        Args:
            adb_path: ADB executable path
            rpc_server: RPC server instance (optional)

        Returns:
            ADB service instance
        """
        ColorPrint.blue("=" * 80)
        ColorPrint.blue("[InitManager] Phase 3: ADB Service Initialization")
        ColorPrint.blue("=" * 80)

        from pyapps.matrix.adb_device_manager.adb_heartbeat_service import init_adb_heartbeat_service

        adb_service = init_adb_heartbeat_service(adb_path=adb_path)

        if rpc_server:
            adb_service.set_rpc_server(rpc_server)
            ColorPrint.green("[InitManager] ✓ RPC server attached to ADB service")

        ColorPrint.green("=" * 80)
        ColorPrint.green("[InitManager] ✓ Phase 3 complete - ADB service ready")
        ColorPrint.green("=" * 80)

        return adb_service

    def _ensure_directories(self):
        """确保所有必要目录存在"""
        from pyapps.matrix.matrix_config import Config

        dirs = [
            Config.LOG_DIR,
            Config.CACHE_DIR_PATH / "matrix",
            Config.get_config_dir(),
        ]

        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
            ColorPrint.blue(f"[InitManager] ✓ Directory ensured: {dir_path}")


# ========== Global Singleton ==========
_init_manager: Optional[InitializationManager] = None


def get_initialization_manager() -> InitializationManager:
    """获取全局InitializationManager实例"""
    global _init_manager
    if _init_manager is None:
        _init_manager = InitializationManager()
    return _init_manager


__all__ = ['InitializationManager', 'get_initialization_manager']

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Service Launcher (Thin Wrapper)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  IMPORTANT: Launcher职责边界
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

本模块 **仅负责** 以下两件事：

1. 单例拦截 (Singleton Detection)
   - 检测是否已有同应用实例在运行
   - 可选：关闭旧实例 (shutdown_existing)
   - 确保成为 PRIMARY 实例

2. 线程调度 (Thread Scheduling)
   - 根据配置启动指定服务
   - 调用 pythreadpool 中的 starter 函数
   - 协调关闭顺序（via THREAD_BUS shutdown stack）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 本模块 **不负责** 具体线程的功能扩展
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

如需对具体线程进行操作（如 RPC v2 路由注册、Speech 配置等），
请：
1. 查看对应线程的文档和源代码
2. 通过 launcher.get_service(name) 获取线程实例
3. 调用线程实例的 API

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 示例：RPC v2 路由扩展
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from pycore.pylauncher import LauncherConfig, ServiceLauncher

# 1. 启动 RPC v2 服务
config = LauncherConfig(services={'rpc_v2': {'port': 58100}})
launcher = ServiceLauncher(config)
launcher.start()

# 2. 获取 RPC v2 实例
rpc_server = launcher.get_service('rpc_v2')  # FastAPIRPCServerRunner

# 3. 注册自定义路由（查看 pycore.pyutils.rpc_v2 文档）
def my_handler(params):
    return {'result': 'Hello from my route'}

rpc_server.server.route('my_route', my_handler, sync=True)

# 4. 现在可以调用: POST http://localhost:58100/rpc/my_route

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 线程文档位置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- RPC v2:      pycore/pyutils/rpc_v2/__init__.py + FastAPIRPCServer
- Heartbeat:   pycore/pyheartbeat/__init__.py + HeartbeatSystem
- Speech:      pycore/pyctl/speech/speech_thread.py
- 所有服务:    pycore/pythreadpool/starters.py (启动函数)
              pycore/pythreadpool/registry.py (元数据)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass, field

from pycore import ColorPrint, THREAD_BUS
from pycore.pythreadpool import get_global_thread_pool, SERVICE_STARTERS
from pycore.pylauncher.singleton_detector import SingletonDetector


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
        return success_count > 0

    def _singleton_detect(self) -> bool:
        """Perform singleton detection"""
        ColorPrint.blue(f"[Singleton] Detecting {self.config.app_id}...")

        def on_msg(msg):
            if msg.get('type') == 'SHUTDOWN':
                THREAD_BUS.request_shutdown(
                    f"Shutdown by PID {msg.get('pid')}",
                    execute_handlers=True
                )

        self.singleton_detector = SingletonDetector(
            app_id=self.config.app_id,
            port_start=self.config.singleton_port_start,
            port_range=self.config.singleton_port_range,
            debug=True,
            on_message=on_msg
        )
        detection = self.singleton_detector.detect_and_bind()

        # Handle existing instance
        if detection.existing_instance:
            ColorPrint.yellow(f"[Singleton] Found existing at port {detection.existing_port}")

            if self.config.shutdown_existing:
                # Use singleton detector's shutdown method
                success = self.singleton_detector.send_shutdown_to_existing(detection.existing_port)

                if success:
                    ColorPrint.green("[Singleton] Old instance shutdown, retrying detection")
                    # Re-create detector and retry
                    self.singleton_detector = SingletonDetector(
                        app_id=self.config.app_id,
                        port_start=self.config.singleton_port_start,
                        port_range=self.config.singleton_port_range,
                        debug=True,
                        on_message=on_msg
                    )
                    detection = self.singleton_detector.detect_and_bind()
                else:
                    ColorPrint.red("[Singleton] Failed to shutdown existing instance")
                    return False

            elif not self.config.force_launch:
                ColorPrint.yellow("[Singleton] Exiting (use shutdown_existing=True to replace)")
                return False
            else:
                ColorPrint.yellow("[Singleton] force_launch=True, continuing anyway")

        # Verify PRIMARY
        if detection.is_primary:
            ColorPrint.green(f"[Singleton] PRIMARY on port {detection.port}")
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

    def is_running(self) -> bool:
        """Check if launcher is running"""
        return self._started


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
]


# ============================================================
# Usage Examples
# ============================================================

"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
完整使用示例
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

示例1: 简单启动
────────────────────────────────────────────────────────────────────────

from pycore.pylauncher import LauncherConfig, ServiceLauncher

config = LauncherConfig(
    services={
        'heartbeat': {},
        'rpc_v2': {'port': 58100, 'host': '0.0.0.0', 'debug': True}
    }
)

launcher = ServiceLauncher(config)
launcher.start()

# ... 应用运行 ...

launcher.stop()


示例2: 单例模式启动
────────────────────────────────────────────────────────────────────────

config = LauncherConfig(
    app_id="my_app",
    singleton=True,                # 启用单例检测
    singleton_port_start=54000,
    shutdown_existing=True,        # 自动关闭旧实例
    services={'rpc_v2': {'port': 58100}}
)

launcher = ServiceLauncher(config)
if launcher.start():
    print("成功成为 PRIMARY 实例")


示例3: 扩展 RPC v2 路由（查看 rpc_v2 文档）
────────────────────────────────────────────────────────────────────────

# 启动 launcher
launcher = ServiceLauncher(config)
launcher.start()

# 获取 RPC v2 实例
rpc_server = launcher.get_service('rpc_v2')

# 注册自定义路由（需查看 FastAPIRPCServer 文档）
def handle_custom_task(params):
    task_id = params.get('task_id')
    # ... 处理逻辑 ...
    return {'status': 'completed', 'task_id': task_id}

rpc_server.server.route(
    name='process_task',
    handler=handle_custom_task,
    sync=True,  # 同步响应
    description='Process custom task'
)

# 现在可以调用: POST http://localhost:58100/rpc/process_task


示例4: 使用 Legacy API (向后兼容)
────────────────────────────────────────────────────────────────────────

from pycore.pylauncher import LauncherConfig

# 旧代码风格依然可用 - 自动转换为 services dict
config = LauncherConfig(
    enable_rpc_v2=True,
    rpc_v2_port=58100,
    singleton_check=True
)

launcher = ServiceLauncher(config)
launcher.start()


示例5: 获取 Heartbeat 系统（查看 heartbeat 文档）
────────────────────────────────────────────────────────────────────────

launcher = ServiceLauncher(config)
launcher.start()

# 获取 heartbeat 实例
heartbeat = launcher.get_service('heartbeat')

# 使用 HeartbeatSystem API
heartbeat.pause()
heartbeat.resume()
stats = heartbeat.get_stats()


示例6: 获取 Speech 服务（查看 speech 文档）
────────────────────────────────────────────────────────────────────────

config = LauncherConfig(
    services={
        'speech': {
            'mode': 'single',
            'mic_language': 'zh-CN',
            'system_language': 'en-US'
        }
    }
)

launcher = ServiceLauncher(config)
launcher.start()

# 获取 speech 实例
speech = launcher.get_service('speech')

# 使用 SpeechTranscriptionThread API
speech.pause()
speech.resume()


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
重要提醒
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. launcher 只负责启动和关闭
2. 具体功能扩展需要查看对应线程的文档
3. 通过 get_service() 获取实例后，调用线程自己的 API
4. 线程定义在 pycore/pythreadpool/starters.py
5. 线程元数据在 pycore/pythreadpool/registry.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


● 好的，让我先给出完整的重构方案：

● 🎯 Pycore 架构重构方案

  一、当前问题分析

  ❌ 职责混乱

  pycore/callmodule/platform/launcher.py:
    ✗ 构建配置（LauncherConfig）
    ✗ 定义托盘菜单（_build_tray_menu_items）
    ✗ 注册事件处理器（_register_tray_event_handlers）
    ✗ 启动服务（launcher.start()）
    ✗ 等待退出（while 循环）

  pycore/pylauncher/launcher.py:
    ✓ 单例检测
    ✓ 启动服务（调用 SERVICE_STARTERS）
    ✓ 管理服务生命周期

  冲突：两个 launcher.py 都在管理启动流程！

  ---
  二、新架构设计

  📦 职责分层

  ┌─────────────────────────────────────────────────────┐
  │  pycore_module_caller.py (入口点)                    │
  │  - 调用 build_launcher_config() 获取配置              │
  │  - 调用 ServiceLauncher(config).start()               │
  │  - 调用 register_event_handlers()                    │
  │  - 等待退出信号                                       │
  └─────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
  ┌──────────────┐  ┌──────────────────┐  ┌─────────────┐
  │ callmodule/  │  │ pylauncher/      │  │pythreadpool/│
  │ (配置层)     │  │ (启动管理层)     │  │ (服务层)    │
  ├──────────────┤  ├──────────────────┤  ├─────────────┤
  │config.py     │→│launcher.py       │→│starters.py  │
  │ 构建配置     │  │ 单例检测         │  │ 启动服务    │
  │              │  │ 启动服务         │  │             │
  │tray_menu.py  │  │ 生命周期管理     │  │registry.py  │
  │ 托盘菜单定义 │  │                  │  │ 服务元数据  │
  │              │  │singleton.py      │  │             │
  │handlers.py   │  │ 单例协议         │  │             │
  │ 事件处理器   │  │                  │  │             │
  └──────────────┘  └──────────────────┘  └─────────────┘

  ---
  三、文件结构重构

  3.1 删除/重命名

  删除: pycore/callmodule/platform/launcher.py       # 职责分散到下面3个文件
  删除: pycore/callmodule/platform/linux_service.py  # 不再需要
  删除: pycore/callmodule/platform/windows_tray.py   # 不再需要
  删除: pycore/callmodule/platform/server_setup.py   # 不再需要

  保留: pycore/callmodule/platform/__init__.py        # 空文件或删除
  保留: pycore/callmodule/platform/windows_startup_manager.py  # 开机自启动工具

  3.2 新建文件

  新建: pycore/callmodule/config.py          # 构建 LauncherConfig
  新建: pycore/callmodule/tray_menu.py       # 托盘菜单定义
  新建: pycore/callmodule/event_handlers.py  # THREAD_BUS 事件处理器

  ---
  四、代码重构详细方案

  4.1 pycore/callmodule/config.py

  # -*- coding: utf-8 -*-
  """
  LauncherConfig Builder for Pycore Module Caller

  Builds LauncherConfig for different platforms.
  Does NOT start any threads or services.
  """

  import platform
  from pathlib import Path

  from pycore.pylauncher import LauncherConfig
  from pycore.callmodule.tray_menu import build_tray_menu

  IS_WINDOWS = platform.system() == 'Windows'


  def build_launcher_config(host='0.0.0.0', port=59000, debug=False):
      """
      Build LauncherConfig for Pycore Module Caller

      Args:
          host: RPC v2 server host
          port: RPC v2 server port
          debug: Debug mode

      Returns:
          LauncherConfig instance
      """
      # Base services (common to all platforms)
      services = {
          'heartbeat': {},
          'rpc_v2': {
              'port': port,
              'host': host,
              'debug': debug
          },
      }

      # Add Windows-specific tray service
      if IS_WINDOWS:
          # Get icon path
          PYCORE_ROOT = Path(__file__).parent.parent
          icon_path = PYCORE_ROOT / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
          if not icon_path.exists():
              icon_path = None

          # Build tray menu (singleton_port will be updated later)
          tray_menu = build_tray_menu(port=port, singleton_port=None)

          # Add tray service
          services['tray'] = {
              'app_name': 'Pycore RPC Server',
              'icon_path': str(icon_path) if icon_path else None,
              'menu_items': tray_menu,
              'trigger_shutdown_on_exit': True
          }

      # Create launcher configuration
      config = LauncherConfig(
          app_id="pycore_module_caller",
          app_name="Pycore Module Caller",
          singleton=True,
          shutdown_existing=True,
          singleton_port_start=59100,
          singleton_port_range=100,
          services=services
      )

      return config


  def update_tray_menu_with_singleton(launcher, port: int, singleton_port: int):
      """
      Update tray menu with singleton port info

      Args:
          launcher: ServiceLauncher instance
          port: RPC v2 server port
          singleton_port: Singleton port
      """
      if not IS_WINDOWS:
          return

      tray = launcher.get_service('tray')
      if not tray:
          return

      # Rebuild menu with singleton port
      updated_menu = build_tray_menu(port=port, singleton_port=singleton_port)
      tray.update_menu(updated_menu)

  ---
  4.2 pycore/callmodule/tray_menu.py

  # -*- coding: utf-8 -*-
  """
  Tray Menu Builder

  Builds tray menu items with dynamic state getters.
  """

  from typing import List
  import platform

  from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TrayMenuItem
  from pycore.callmodule.platform.windows_startup_manager import WindowsStartupManager
  from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

  IS_WINDOWS = platform.system() == 'Windows'


  def build_tray_menu(port: int, singleton_port: int = None) -> List[TrayMenuItem]:
      """Build tray menu items with dynamic state getters"""

      # State getters
      def get_code_sync_state():
          manager = get_code_sync_manager()
          mode = manager.get_mode()
          return {"server": "[S]", "client": "[C]"}.get(mode, "[ ]")

      def get_autostart_state():
          if IS_WINDOWS:
              startup_manager = WindowsStartupManager()
              return "[X]" if startup_manager.is_enabled() else "[ ]"
          return "[ ]"

      # Build menu
      menu_items = [
          TrayMenuItem(text="Open Web Interface", action_signal="tray_action_open", default=True),
          TrayMenuItem.SEPARATOR,
          TrayMenuItem(text=f"RPC v2 Server: {port}", action_signal="", enabled=False),
      ]

      if singleton_port is not None:
          menu_items.append(
              TrayMenuItem(text=f"Singleton Port: {singleton_port}", action_signal="", enabled=False)
          )

      menu_items.extend([
          TrayMenuItem.SEPARATOR,
          TrayMenuItem(text="Code Sync", action_signal="tray_action_toggle_code_sync",
                      state_getter=get_code_sync_state),
          TrayMenuItem(text="Voice Subtitle Window", action_signal="tray_action_toggle_voice_subtitle"),
          TrayMenuItem(text="Auto-Start on Boot", action_signal="tray_action_toggle_startup",
                      state_getter=get_autostart_state),
          TrayMenuItem.SEPARATOR,
          TrayMenuItem(text="Restart", action_signal="tray_action_restart"),
          TrayMenuItem(text="Exit", action_signal="tray_action_exit")
      ])

      return menu_items

  ---
  4.3 pycore/callmodule/event_handlers.py

  # -*- coding: utf-8 -*-
  """
  Event Handlers for Tray Actions

  Registers THREAD_BUS event handlers.
  """

  import os
  import sys
  import webbrowser

  from pycore import ColorPrint, THREAD_BUS
  from pycore.pylauncher import ServiceLauncher
  from pycore.callmodule.platform.windows_startup_manager import WindowsStartupManager
  from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager


  def register_event_handlers(launcher: ServiceLauncher, port: int):
      """Register THREAD_BUS event handlers for tray actions"""

      ColorPrint.blue("[EventHandlers] Registering tray event handlers...")

      # Event handlers
      def handle_tray_open(event_data):
          ColorPrint.blue("[Tray] Opening web interface...")
          webbrowser.open(f"http://localhost:{port}/")

      def handle_tray_restart(event_data):
          ColorPrint.yellow("[Tray] Restarting application...")
          launcher.stop()
          python = sys.executable
          os.execv(python, [python] + sys.argv)

      def handle_tray_exit(event_data):
          ColorPrint.yellow("[Tray] Shutting down...")
          launcher.stop()

      def handle_tray_toggle_startup(event_data):
          startup_manager = WindowsStartupManager()
          result = startup_manager.toggle()
          if result['success']:
              status = "enabled" if result['enabled'] else "disabled"
              ColorPrint.green(f"[Tray] Auto-start {status}")
          else:
              ColorPrint.red(f"[Tray] Failed: {result['message']}")

      def handle_tray_toggle_voice_subtitle(event_data):
          ColorPrint.blue("[Tray] Toggling voice subtitle window...")
          THREAD_BUS.trigger_event('voice_subtitle_ui.toggle', {})

      def handle_tray_toggle_code_sync(event_data):
          ColorPrint.blue("[Tray] Toggling code sync mode...")
          manager = get_code_sync_manager()
          manager.toggle_mode()
          ColorPrint.green(f"[Tray] Code sync mode: {manager.get_mode()}")

      # Register all handlers
      THREAD_BUS.register_event_handler('tray_action_open', handle_tray_open)
      THREAD_BUS.register_event_handler('tray_action_restart', handle_tray_restart)
      THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)
      THREAD_BUS.register_event_handler('tray_action_toggle_startup', handle_tray_toggle_startup)
      THREAD_BUS.register_event_handler('tray_action_toggle_voice_subtitle', handle_tray_toggle_voice_subtitle)
      THREAD_BUS.register_event_handler('tray_action_toggle_code_sync', handle_tray_toggle_code_sync)

      ColorPrint.green("[EventHandlers] Registered 6 event handlers")

  ---
  4.4 pycore_module_caller.py (入口点)

  #!/usr/bin/env python3
  # -*- coding: utf-8 -*-
  """
  Pycore Module Caller - Entry Point

  Launches Pycore Module Caller with platform-aware configuration.
  """

  import sys
  import signal
  import time
  from pathlib import Path

  PYCORE_ROOT = Path(__file__).parent
  sys.path.insert(0, str(PYCORE_ROOT))

  from pycore import ColorPrint, THREAD_BUS
  from pycore.pylauncher import ServiceLauncher
  from pycore.callmodule.config import build_launcher_config, update_tray_menu_with_singleton
  from pycore.callmodule.event_handlers import register_event_handlers


  def main(host='0.0.0.0', port=59000, debug=False):
      """
      Main entry point

      Args:
          host: RPC v2 server host
          port: RPC v2 server port
          debug: Debug mode
      """
      ColorPrint.blue("=" * 70)
      ColorPrint.blue("Pycore Module Caller - Starting")
      ColorPrint.blue("=" * 70)

      # 1. Build configuration (callmodule 负责)
      config = build_launcher_config(host=host, port=port, debug=debug)

      # 2. Start services (pylauncher 负责)
      launcher = ServiceLauncher(config)
      if not launcher.start():
          ColorPrint.yellow("[Main] Failed to start (singleton conflict or error)")
          return

      # Get singleton port
      singleton_port = launcher.detection_result.port if launcher.detection_result else None

      ColorPrint.green(f"[Main] Services started successfully")
      if singleton_port:
          ColorPrint.blue(f"[Main] Singleton Port: {singleton_port}")

      # 3. Register event handlers (callmodule 负责)
      register_event_handlers(launcher, port)

      # 4. Update tray menu with singleton port (callmodule 负责)
      if singleton_port:
          update_tray_menu_with_singleton(launcher, port, singleton_port)

      ColorPrint.green("=" * 70)
      ColorPrint.green(f"[Main] RPC v2: http://localhost:{port}/")
      if singleton_port:
          ColorPrint.green(f"[Main] Singleton: {singleton_port}")
      ColorPrint.green("=" * 70)

      # 5. Setup signal handler for Ctrl+C
      def signal_handler(signum, frame):
          if not THREAD_BUS.is_shutdown_requested():
              ColorPrint.yellow("\n[Main] Keyboard interrupt (Ctrl+C)")
              THREAD_BUS.request_shutdown(reason="Keyboard interrupt", execute_handlers=True)
          else:
              ColorPrint.yellow("\n[Main] Already shutting down...")

      signal.signal(signal.SIGINT, signal_handler)

      # 6. Wait for shutdown signal
      ColorPrint.blue("[Main] Running... (Press Ctrl+C or use tray to exit)")

      while not THREAD_BUS.is_shutdown_requested():
          time.sleep(0.5)

      ColorPrint.blue("[Main] Shutdown signal received")
      ColorPrint.blue("[Main] Shutting down...")
      launcher.stop()
      ColorPrint.green("[Main] Shutdown complete")


  if __name__ == '__main__':
      import argparse

      parser = argparse.ArgumentParser(description="Pycore Module Caller")
      parser.add_argument('--host', default='0.0.0.0', help='Host to bind')
      parser.add_argument('--port', type=int, default=59000, help='Port to bind')
      parser.add_argument('--debug', action='store_true', help='Enable debug mode')

      args = parser.parse_args()
      main(host=args.host, port=args.port, debug=args.debug)

  ---
  五、线程管理规范

  ✅ 正确的线程启动流程

  pycore_module_caller.py (主线程)
    │
    ├─ 构建配置 (callmodule/config.py)
    │   └─ LauncherConfig with services={'heartbeat', 'rpc_v2', 'tray'}
    │
    ├─ 启动服务 (pylauncher/launcher.py)
    │   ├─ 单例检测 (singleton_detector.py)
    │   └─ 调用 SERVICE_STARTERS (pythreadpool/starters.py)
    │       ├─ start_heartbeat() → HeartbeatThread (继承 Thread)
    │       ├─ start_rpc_v2() → Uvicorn 后台线程 (daemon=True)
    │       └─ start_tray() → SystemTray 后台线程 (daemon=True)
    │
    ├─ 注册事件 (callmodule/event_handlers.py)
    │   └─ THREAD_BUS.register_event_handler(...)
    │
    └─ 等待退出
        └─ while not THREAD_BUS.is_shutdown_requested()

  关键点：
  1. ✅ callmodule 只构建配置和注册事件，不启动线程
  2. ✅ pylauncher 负责单例检测和调用服务启动器
  3. ✅ pythreadpool 负责实际启动线程
  4. ✅ THREAD_BUS 作为唯一的事件中心

  ---
  六、实施步骤

  Step 1: 创建新文件

  - pycore/callmodule/tray_menu.py
  - pycore/callmodule/event_handlers.py
  - pycore/callmodule/config.py

  Step 2: 更新入口点

  - 重写 pycore_module_caller.py

  Step 3: 删除旧文件

  - 删除 pycore/callmodule/platform/launcher.py
  - 删除 pycore/callmodule/platform/windows_tray.py
  - 删除 pycore/callmodule/platform/linux_service.py
  - 删除 pycore/callmodule/platform/server_setup.py

  Step 4: 修复 daemon 线程问题

  - 修改 starters.py 中的 tray 启动逻辑为 daemon=True
  - 移除 join() 等待

  Step 5: 测试验证

  - 启动测试
  - 单例测试
  - 退出测试
  - 托盘功能测试

  ---
  七、优势对比

  | 项目   | 当前架构    | 新架构               |
  |------|---------|-------------------|
  | 职责清晰 | ❌ 混乱    | ✅ 分层清晰            |
  | 可维护性 | ❌ 难维护   | ✅ 易维护             |
  | 可测试性 | ❌ 难测试   | ✅ 易测试             |
  | 可扩展性 | ⚠️ 一般   | ✅ 易扩展             |
  | 线程管理 | ❌ 分散    | ✅ 统一 (pylauncher) |
  | 事件中心 | ⚠️ 部分使用 | ✅ 完全使用 THREAD_BUS |

  ---
  需要我开始实施这个方案吗？
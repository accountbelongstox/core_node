
● 📊 全面切换到 launcher.py 的架构分析方案

  一、当前架构分析

  1.1 当前启动流程 (pycore_module_caller.py)

  pycore_module_caller.py
    └─> launch_platform_aware()
        ├─> ServiceLauncher(只启动 heartbeat)
        ├─> 手动启动 start_voice_subtitle_ui()
        └─> 平台特定启动器
            ├─> Windows: launch_windows_tray()
            │   ├─> 手动启动 RPC v2 服务器
            │   └─> 创建系统托盘 TkinterSystemTray
            └─> Linux: launch_linux_service()
                └─> 手动启动 RPC v2 服务器

  1.2 当前涉及的 Native UI 组件

  文件位置分析：

  1. 系统托盘 (pycore/callmodule/platform/windows_tray.py:16-24)
    - TkinterSystemTray - 基于 pystray 的系统托盘
    - 功能：菜单、打开网页、重启、退出、开机启动、语音字幕切换
  2. 语音字幕窗口 (pycore/pyctl/desktop/ui/__init__.py:10-71)
    - start_voice_subtitle_ui() - PySide6 窗口
    - WebView 显示 http://localhost:59000/web/subtitle
    - 通过 THREAD_BUS 事件控制显示/隐藏
  3. 启动管理器 (windows_tray.py:21)
    - WindowsStartupManager - 管理开机自启动

  ---
  二、目标架构（launcher.py）现状

  2.1 launcher.py 已有功能

  | 功能模块         | 实现状态   | 配置方式                                     |
  |--------------|--------|------------------------------------------|
  | Singleton 检测 | ✅ 完整实现 | singleton=True                           |
  | Heartbeat 服务 | ✅ 自动启用 | services={'heartbeat': {}}               |
  | RPC v2 服务    | ✅ 完整实现 | services={'rpc_v2': {port, host, debug}} |
  | Speech 服务    | ✅ 完整实现 | services={'speech': {mode}}              |
  | UI 服务        | ⚠️ 占位符 | services={'ui': {}} - 未实现                |
  | 系统托盘         | ❌ 缺失   | 无配置选项                                    |

  2.2 SERVICE_STARTERS 注册状态

  当前已注册的服务启动器（pycore/pythreadpool/starters.py:144-147）：

  SERVICE_STARTERS['heartbeat'] = start_heartbeat  # ✅ 完整
  SERVICE_STARTERS['rpc_v2'] = start_rpc_v2        # ✅ 完整
  SERVICE_STARTERS['speech'] = start_speech        # ✅ 完整
  SERVICE_STARTERS['ui'] = start_ui                # ⚠️ 占位符（只有 print）

  缺失：
  - ❌ SERVICE_STARTERS['tray'] - 系统托盘启动器
  - ❌ SERVICE_STARTERS['voice_subtitle_ui'] - 或者合并到 'ui' 中

  ---
  三、需要扩展的功能（Gap Analysis）

  3.1 launcher.py 配置扩展

  在 LauncherConfig 中需要添加：

  @dataclass
  class LauncherConfig:
      # 现有配置...
      services: Dict[str, Dict[str, Any]] = field(default_factory=dict)

      # 需要新增的服务配置：
      # 1. 系统托盘配置
      services = {
          'tray': {
              'enable': True,              # 是否启用系统托盘
              'icon_path': str,            # 托盘图标路径
              'menu_items': List[...],     # 自定义菜单项
              'platform': 'auto',          # 'windows', 'linux', 'auto'
          },

          # 2. UI 配置（语音字幕窗口）
          'ui': {
              'type': 'voice_subtitle',    # UI 类型
              'show_on_start': True,       # 启动时是否显示
              'webview_url': str,          # WebView URL
              'window_size': (1000, 180),
              'frameless': False,
              'enable_dev_tools': False,
          },

          # 3. RPC v2 配置（已有，但需要确保兼容）
          'rpc_v2': {
              'port': 59000,
              'host': '0.0.0.0',
              'debug': False
          }
      }

  3.2 需要实现的 Starters

  3.2.1 完整实现 start_ui (starters.py:134-137)

  当前代码：
  def start_ui(config: Dict[str, Any]) -> Any:
      """Start UI service (placeholder)"""
      ColorPrint.yellow("[ui] UI Service not implemented yet")
      return None

  需要改造为：
  def start_ui(config: Dict[str, Any]) -> Any:
      """Start UI service (voice subtitle window)"""
      from pycore.pyctl.desktop.ui import start_voice_subtitle_ui

      ColorPrint.blue("[ui] Starting Voice Subtitle UI...")

      # 从配置获取参数
      webview_url = config.get('webview_url', 'http://localhost:59000/web/subtitle')
      window_size = config.get('window_size', (1000, 180))
      show_on_start = config.get('show_on_start', True)

      # 启动 UI
      ui_thread = start_voice_subtitle_ui()

      # 注册关闭处理器
      def stop_ui():
          ColorPrint.blue("[ui] Stopping Voice Subtitle UI...")
          from pycore import THREAD_BUS
          THREAD_BUS.trigger_event('voice_subtitle_ui.close', {})

      THREAD_BUS.register_shutdown_handler(
          handler=stop_ui,
          priority=THREAD_REGISTRY['ui']['shutdown_priority'],
          name="ui"
      )

      ColorPrint.green("[ui] Voice Subtitle UI started")
      return ui_thread

  3.2.2 新增 start_tray (新文件)

  创建 pycore/pythreadpool/tray_starter.py:

  def start_tray(config: Dict[str, Any]) -> Any:
      """Start system tray service"""
      import platform

      platform_name = config.get('platform', 'auto')
      if platform_name == 'auto':
          platform_name = 'windows' if platform.system() == 'Windows' else 'linux'

      if platform_name == 'windows':
          return _start_windows_tray(config)
      else:
          ColorPrint.yellow("[tray] Linux tray not implemented")
          return None

  def _start_windows_tray(config: Dict[str, Any]) -> Any:
      """Start Windows system tray"""
      from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import (
          TkinterSystemTray, TrayMenuItem, PYSTRAY_AVAILABLE
      )

      if not PYSTRAY_AVAILABLE:
          ColorPrint.red("[tray] pystray not available")
          return None

      # 从配置构建托盘
      icon_path = config.get('icon_path')
      menu_items = config.get('menu_items', [])
      app_name = config.get('app_name', 'Application')

      ColorPrint.blue(f"[tray] Starting system tray: {app_name}")

      tray = TkinterSystemTray(
          app_name=app_name,
          icon_path=icon_path,
          menu_items=menu_items
      )

      # 在后台线程启动托盘（非阻塞）
      import threading
      def run_tray():
          try:
              tray.run()
          except Exception as e:
              ColorPrint.red(f"[tray] Error: {e}")

      tray_thread = threading.Thread(target=run_tray, daemon=False)
      tray_thread.start()

      # 注册关闭处理器
      def stop_tray():
          ColorPrint.blue("[tray] Stopping system tray...")
          tray.stop()

      THREAD_BUS.register_shutdown_handler(
          handler=stop_tray,
          priority=80,  # 高优先级，最后关闭
          name="tray"
      )

      ColorPrint.green("[tray] System tray started")
      return tray

  # 注册到 SERVICE_STARTERS
  SERVICE_STARTERS['tray'] = start_tray

  3.3 registry.py 扩展

  在 pycore/pythreadpool/registry.py 中添加新服务的元数据：

  THREAD_REGISTRY = {
      # 现有服务...
      'heartbeat': {...},
      'rpc_v2': {...},
      'speech': {...},

      # 新增服务
      'ui': {
          'name': 'Voice Subtitle UI',
          'description': 'PySide6 voice subtitle window',
          'shutdown_priority': 70,  # 在托盘之前关闭
          'dependencies': ['rpc_v2'],  # 依赖 RPC v2 提供 WebView 内容
      },

      'tray': {
          'name': 'System Tray',
          'description': 'Platform-specific system tray',
          'shutdown_priority': 80,  # 最后关闭（保持可见直到最后）
          'dependencies': [],
      }
  }

  ---
  四、迁移方案

  4.1 重构目标

  将当前的 手动分散启动 模式改为 配置驱动的统一启动 模式：

  之前：
  # platform/launcher.py 中手动启动各组件
  launcher.start()  # 只启动 heartbeat
  start_voice_subtitle_ui()  # 手动启动 UI
  start_rpc_server_background()  # 手动启动 RPC
  launch_windows_tray()  # 手动启动托盘

  之后：
  # 统一通过 launcher.py 配置启动
  config = LauncherConfig(
      app_id="pycore_module_caller",
      app_name="Pycore Module Caller",
      singleton=True,
      services={
          'heartbeat': {},
          'rpc_v2': {'port': 59000, 'host': '0.0.0.0'},
          'ui': {'type': 'voice_subtitle', 'show_on_start': True},
          'tray': {'platform': 'auto', 'menu_items': [...]}
      }
  )
  launcher = ServiceLauncher(config)
  launcher.start()  # 一次性启动所有服务

  4.2 分步实施计划

  阶段 1：扩展 Starters（必需）

  1. ✅ 完整实现 start_ui() in starters.py
  2. ✅ 新增 start_tray() 并注册到 SERVICE_STARTERS
  3. ✅ 在 THREAD_REGISTRY 中添加 'ui' 和 'tray' 元数据

  阶段 2：重构 platform/launcher.py（核心）

  1. ✅ 移除手动启动逻辑（start_voice_subtitle_ui(), start_rpc_server_background()）
  2. ✅ 将所有服务配置移入 LauncherConfig.services
  3. ✅ 简化 launch_platform_aware() 为单一配置构造

  重构后的 platform/launcher.py:
  def launch_platform_aware(host='0.0.0.0', port=59000, debug=False):
      """Launch with unified configuration"""

      # 构建托盘菜单项（如果是 Windows）
      tray_config = {}
      if platform.system() == 'Windows':
          tray_config = {
              'app_name': 'Pycore RPC Server',
              'platform': 'windows',
              'menu_items': _build_tray_menu(port)  # 独立函数构建菜单
          }

      # 统一配置
      config = LauncherConfig(
          app_id="pycore_module_caller",
          app_name="Pycore Module Caller",
          singleton=True,
          shutdown_existing=True,
          services={
              'heartbeat': {},
              'rpc_v2': {
                  'port': port,
                  'host': host,
                  'debug': debug
              },
              'ui': {
                  'type': 'voice_subtitle',
                  'webview_url': f'http://localhost:{port}/web/subtitle',
                  'show_on_start': True
              },
              'tray': tray_config  # 仅 Windows 有效
          }
      )

      # 一次性启动所有服务
      launcher = ServiceLauncher(config)
      if not launcher.start():
          return

      ColorPrint.green("=== All services started ===")

      # 等待托盘关闭（阻塞主线程）
      if 'tray' in config.services:
          tray = launcher.get_service('tray')
          if tray:
              tray.wait()  # 阻塞直到托盘退出

  阶段 3：清理遗留代码（可选）

  1. ✅ 删除或标记废弃 windows_tray.py 中的 launch_windows_tray()
  2. ✅ 删除或标记废弃 server_setup.py 中的 start_rpc_server_background()
  3. ✅ 更新文档和注释

  ---
  五、配置示例对比

  5.1 当前方式 (pycore_module_caller.py)

  # 命令行参数 → 手动传递给分散的启动函数
  run_server(host='0.0.0.0', port=59000)
    └─> launch_platform_aware(host, port, debug)
        └─> 手动启动 4 个组件

  5.2 目标方式 (launcher.py)

  # 配置对象 → 统一管理所有服务
  config = LauncherConfig(
      app_id="pycore_module_caller",
      app_name="Pycore Module Caller",
      singleton=True,
      services={
          'heartbeat': {},
          'rpc_v2': {'port': 59000, 'host': '0.0.0.0', 'debug': False},
          'ui': {
              'type': 'voice_subtitle',
              'show_on_start': True,
              'webview_url': 'http://localhost:59000/web/subtitle',
              'window_size': (1000, 180)
          },
          'tray': {
              'platform': 'auto',  # 自动检测平台
              'app_name': 'Pycore RPC Server',
              'menu_items': [
                  {'text': 'Open Web Interface', 'signal': 'tray_action_open'},
                  {'text': 'Exit', 'signal': 'tray_action_exit'}
              ]
          }
      }
  )

  launcher = ServiceLauncher(config)
  launcher.start()

  ---
  六、关键问题与解决方案

  问题 1：托盘阻塞主线程

  当前：tray.run() 阻塞主线程，直到托盘退出。

  解决方案：
  - 方案 A：在 start_tray() 中用后台线程启动托盘，返回托盘实例，主线程调用 tray.wait() 阻塞
  - 方案 B：托盘作为最后一个服务启动，launcher.start() 后主动等待托盘关闭

  推荐：方案 A（已在上面代码中体现）

  问题 2：托盘菜单构建逻辑

  当前：托盘菜单在 windows_tray.py 中硬编码。

  解决方案：
  - 将菜单构建逻辑提取为独立函数 _build_tray_menu(port, singleton_port)
  - 在配置中传递菜单项，或者在 start_tray() 中动态构建

  问题 3：UI 与 RPC v2 的依赖关系

  当前：UI 需要 RPC v2 提供 WebView 内容 (http://localhost:{port}/web/subtitle)。

  解决方案：
  - 在 THREAD_REGISTRY['ui']['dependencies'] 中声明依赖 'rpc_v2'
  - 在 ServiceLauncher.start() 中添加依赖检查逻辑（可选，当前未实现）

  问题 4：平台差异处理

  当前：launch_platform_aware() 分别调用 launch_windows_tray() 和 launch_linux_service()。

  解决方案：
  - 在 start_tray() 内部处理平台差异
  - 配置中设置 'tray': {'platform': 'auto'} 自动检测

  ---
  七、验证清单

  完成迁移后，需要验证以下功能：

  - ✅ Singleton 检测：多实例启动时正确检测并退出
  - ✅ RPC v2 服务器：http://localhost:59000/ 可访问
  - ✅ 语音字幕 UI：PySide6 窗口正常显示
  - ✅ 系统托盘：Windows 托盘图标显示，菜单可用
  - ✅ 托盘功能：
    - 打开 Web 界面
    - 切换语音字幕窗口
    - 开机自启动切换
    - 重启应用
    - 退出应用
  - ✅ 优雅关闭：所有服务按优先级顺序关闭
  - ✅ Linux 兼容性：Linux 下不启动托盘，但其他服务正常

  ---
  八、总结

● 核心扩展点：

  | 扩展项             | 当前状态          | 需要做什么                 |
  |-----------------|---------------|-----------------------|
  | start_ui()      | ⚠️ 占位符        | 实现完整的语音字幕 UI 启动逻辑     |
  | start_tray()    | ❌ 不存在         | 新增系统托盘启动器             |
  | THREAD_REGISTRY | ⚠️ 缺少 UI/tray | 添加 'ui' 和 'tray' 元数据  |
  | LauncherConfig  | ✅ 基础完整        | 可选：添加 UI/tray 的快捷配置方法 |

  最小实施路径（推荐）：

  1. 实现 start_ui() in starters.py → 调用 start_voice_subtitle_ui()
  2. 实现 start_tray() in 新文件 tray_starter.py → 封装 TkinterSystemTray
  3. 更新 launch_platform_aware() → 将所有服务移入 LauncherConfig.services
  4. 测试验证 → 确保所有功能正常

  收益：

  ✅ 统一配置：一个配置对象管理所有服务
  ✅ 易于扩展：新增服务只需添加 starter 函数
  ✅ 平台透明：平台差异在 starter 内部处理
  ✅ 生命周期管理：自动处理启动/关闭顺序
  ✅ 可测试性：配置驱动，易于单元测试

  ---
  这个方案已经给出了完整的迁移路径和代码示例。你可以按照这个方案逐步实施。需要我帮你开始实现任何部分吗？
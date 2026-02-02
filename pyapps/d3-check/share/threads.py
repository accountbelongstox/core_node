#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One-shot work functions (run via timer_manager.submit_one_shot) and shared imports for thread logic.

No thread classes here: long-lived thread classes are implemented in their owning modules
(controller/d3_macro_controller, controller/game_interface_controller, ui/components/system_tray).
Used by share.thread_registry for do_* callbacks only.
"""

import shutil
import threading
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CACHE_DIR
from d3utils.path_scanner import scan_for_paths
from providor.providor_index import BATTLE_NET_WINDOW_TITLES
from pycore.pyutils.window_analyzer import WindowAnalyzer
from pycore.pyutils.flutter_dev_tools.api.folder_opener import open_folder

import timers.window_monitor_timer as window_monitor


# --- One-shot work (run via timer_manager.submit_one_shot; no new thread) ---


def do_path_scan(panel: Any) -> None:
    """Path scan work. Run in timer thread via submit_one_shot; schedules UI update on main."""
    try:
        bn, ros = scan_for_paths()
        panel.container.after(0, lambda: panel._apply_scan_results(bn, ros))
    except Exception as e:
        panel.container.after(0, lambda: panel._apply_scan_results(None, [], str(e)))


def do_login_check(panel: Any, login_check_fn: Callable[[], Tuple[bool, Optional[Exception]]]) -> None:
    """Login check work. Run in timer thread via submit_one_shot; schedules UI update on main."""
    result = False
    err = None
    try:
        result, err = login_check_fn()
    except Exception as e:
        err = e
    try:
        panel.container.after(0, lambda: panel._on_login_check_done(result, err))
    except Exception:
        pass


def do_refresh_status(refresh_fn: Callable[[], None]) -> None:
    """Refresh status work. Run in timer thread via submit_one_shot."""
    try:
        refresh_fn()
    except Exception as e:
        ColorPrint.red(f"[RosbotPanel] Refresh status error: {e}")


def do_battlenet_ui_analyze(panel: Any) -> None:
    """Battle.net UI JSON export. Run in timer thread via submit_one_shot; schedules UI updates on main."""
    try:
        import pythoncom
        pythoncom.CoInitialize()
    except ImportError:
        pass
    output_dir = Path(CACHE_DIR) / "battlenet_ui_analyze"
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        try:
            panel.container.after(0, lambda: ColorPrint.red(f"[RosbotPanel] 调试: 创建输出目录失败: {e}"))
        except Exception:
            pass
        return
    analyzer = WindowAnalyzer()
    analyzer.debug_dir = str(output_dir)
    result = analyzer.analyze_window(
        window_titles=list(BATTLE_NET_WINDOW_TITLES),
        program_name="battlenet",
    )
    if result and result.get("success"):
        json_path = result.get("files", {}).get("json")
        controls = result.get("controls", [])
        out_dir = Path(json_path).parent if json_path else output_dir
        jp = str(json_path)
        n = len(controls)
        docs_json_path = None
        if json_path:
            try:
                docs_dir = Path(__file__).resolve().parent.parent / "docs"
                docs_dir.mkdir(parents=True, exist_ok=True)
                docs_json_path = docs_dir / "登陆后的战网元素.json"
                shutil.copy2(json_path, docs_json_path)
                ColorPrint.green(f"[RosbotPanel] 已复制 JSON 到文档: {docs_json_path}")
            except Exception as copy_err:
                ColorPrint.yellow(f"[RosbotPanel] 复制到 docs 失败: {copy_err}")

        def _on_done():
            ColorPrint.blue(f"[RosbotPanel] 战网UI JSON (UI Automation/Chrome 辅助功能树): {jp}")
            ColorPrint.blue(f"[RosbotPanel] 共 {n} 个控件 (按钮/链接/编辑框等)")
            if docs_json_path:
                ColorPrint.blue(f"[RosbotPanel] 文档副本: {docs_json_path}")
            open_folder(Path(out_dir))
        try:
            panel.container.after(0, _on_done)
        except Exception:
            pass
    else:
        err = result.get("error", "未找到战网窗口或枚举失败") if result else "未找到战网窗口"
        try:
            panel.container.after(0, lambda e=err: ColorPrint.red(f"[RosbotPanel] 调试战网UI: {e}"))
        except Exception:
            pass


def do_window_monitor_initial_check() -> None:
    """One-time window check after UI ready. Run in timer thread via submit_one_shot."""
    try:
        window_monitor.check_window()
    except Exception as e:
        ColorPrint.red(f"[WindowMonitor] Initial check error: {e}")


# --- Long-lived thread classes: implemented in their owning modules (no wrappers here) ---
# - MacroLoopThread, GameInterfaceMacroThread: controller/d3_macro_controller.py, controller/game_interface_controller.py
# - TrayRunnerThread: ui/components/system_tray.py
# ThreadRegistry uses controller.create_macro_fallback_thread(), controller.create_macro_thread(); tray is the thread (SystemTray extends Thread).

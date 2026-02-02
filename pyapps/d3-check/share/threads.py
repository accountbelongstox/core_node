#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared native thread classes (no controller/ui imports to avoid cycles).

All classes receive runtime objects (controller, tray, panel, etc.); no type imports from controller or ui.
Used only by share.thread_registry.
"""

import shutil
import threading
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from providor.common_imports import ColorPrint
from providor.providor_index import CACHE_DIR
from d3utils.path_scanner import scan_for_paths
from d3utils.battlenet_manager import get_battlenet_window_titles
from pycore.pyutils.window_analyzer import WindowAnalyzer
from pycore.pyutils.flutter_dev_tools.api.folder_opener import open_folder

import timers.window_monitor_timer as window_monitor


class MacroLoopThread(threading.Thread):
    """Native thread for macro fallback loop. Created only by ThreadRegistry. controller has _macro_loop_fallback()."""

    def __init__(self, controller: Any):
        super().__init__(daemon=True, name="MacroLoopFallback")
        self._controller = controller

    def run(self) -> None:
        self._controller._macro_loop_fallback()


class GameInterfaceMacroThread(threading.Thread):
    """Native thread for game interface macro loop. Created only by ThreadRegistry. controller has _macro_loop(skill_config)."""

    def __init__(self, controller: Any, skill_config: Dict):
        super().__init__(daemon=True, name="GameInterfaceMacro")
        self._controller = controller
        self._skill_config = skill_config

    def run(self) -> None:
        self._controller._macro_loop(self._skill_config)


class TrayRunnerThread(threading.Thread):
    """Native thread for system tray run loop. tray has tray_icon.run(). Created only by ThreadRegistry."""

    def __init__(self, tray: Any):
        super().__init__(daemon=True, name="TrayRunner")
        self._tray = tray

    def run(self) -> None:
        try:
            if self._tray.tray_icon:
                self._tray.tray_icon.run()
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error running tray icon: {e}")


class WindowMonitorInitialCheckThread(threading.Thread):
    """Native thread for one-time window check after UI ready. Created only by ThreadRegistry."""

    def __init__(self) -> None:
        super().__init__(daemon=True, name="WindowMonitorInitialCheck")

    def run(self) -> None:
        try:
            window_monitor.check_window()
        except Exception as e:
            ColorPrint.red(f"[WindowMonitor] Initial check error: {e}")


class PathScanThread(threading.Thread):
    """Native thread for path scan. run() calls scan_for_paths() and schedules _apply_scan_results on main thread."""

    def __init__(self, panel: Any):
        super().__init__(daemon=True, name="PathScan")
        self._panel = panel

    def run(self) -> None:
        try:
            bn, ros = scan_for_paths()
            self._panel.container.after(0, lambda: self._panel._apply_scan_results(bn, ros))
        except Exception as e:
            self._panel.container.after(0, lambda: self._panel._apply_scan_results(None, [], str(e)))


class LoginCheckThread(threading.Thread):
    """Native thread for login check. run() calls injected login_check_fn and schedules _on_login_check_done."""

    def __init__(self, panel: Any, login_check_fn: Callable[[], Tuple[bool, Optional[Exception]]]):
        super().__init__(daemon=True, name="LoginCheck")
        self._panel = panel
        self._login_check_fn = login_check_fn

    def run(self) -> None:
        result = False
        err = None
        try:
            result, err = self._login_check_fn()
        except Exception as e:
            err = e
        try:
            self._panel.container.after(0, lambda: self._panel._on_login_check_done(result, err))
        except Exception:
            pass


class RefreshStatusThread(threading.Thread):
    """Native thread for immediate status refresh. run() calls injected refresh_fn."""

    def __init__(self, refresh_fn: Callable[[], None]):
        super().__init__(daemon=True, name="RefreshStatusNow")
        self._refresh_fn = refresh_fn

    def run(self) -> None:
        try:
            self._refresh_fn()
        except Exception as e:
            ColorPrint.red(f"[RosbotPanel] Refresh status error: {e}")


class BattlenetUiAnalyzeThread(threading.Thread):
    """Native thread for Battle.net UI JSON export. run() does CoInitialize, WindowAnalyzer, then schedules UI updates."""

    def __init__(self, panel: Any):
        super().__init__(daemon=True, name="BattlenetUiAnalyze")
        self._panel = panel

    def run(self) -> None:
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
                self._panel.container.after(0, lambda: ColorPrint.red(f"[RosbotPanel] 调试: 创建输出目录失败: {e}"))
            except Exception:
                pass
            return
        analyzer = WindowAnalyzer()
        analyzer.debug_dir = str(output_dir)
        result = analyzer.analyze_window(
            window_titles=get_battlenet_window_titles(),
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
                self._panel.container.after(0, _on_done)
            except Exception:
                pass
        else:
            err = result.get("error", "未找到战网窗口或枚举失败") if result else "未找到战网窗口"
            try:
                self._panel.container.after(0, lambda e=err: ColorPrint.red(f"[RosbotPanel] 调试战网UI: {e}"))
            except Exception:
                pass

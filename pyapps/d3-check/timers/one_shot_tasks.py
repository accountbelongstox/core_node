#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One-shot work tasks run via timer_manager.submit_one_shot (no new thread).
Used by thread registry and panels. Long-lived thread classes live in controller/d3utils/ui.
"""

import shutil
import time
from pathlib import Path
from typing import Any, Callable, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.window_activator import WindowActivator
from pycore.pyutils.window_analyzer import WindowAnalyzer
from pycore.pyutils.flutter_dev_tools.api.folder_opener import open_folder
from providor.providor_index import CACHE_DIR, BATTLE_NET_WINDOW_TITLES
from d3utils.path_scanner import scan_for_paths
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_operation import get_rosbot_operation
from d3utils.rosbot_status_provider import refresh_rosbot_status
from d3utils.key_send import send_f7_to_system
from d3utils.smart_echo import do_smart_echo_pause_after_complete
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
from share.game_interface_data import get_game_interface_data

try:
    import pythoncom
except ImportError:
    pythoncom = None

_ROSDEBUG_F7_DEBOUNCE_SEC = 3.0
_last_rosdebug_f7_at: Optional[float] = None
_rosdebug_running_busy = False


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


def do_battlenet_only_check(panel: Any) -> None:
    """Ensure Battle.net running and logged in only. Run in timer thread; schedules _on_battlenet_only_done on main."""
    result = False
    err = None
    try:
        from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
        result = get_login_try_screenshot_controller().ensure_battlenet_only()
    except Exception as e:
        err = e
    try:
        panel.container.after(0, lambda r=result, e=err: panel._on_battlenet_only_done(r, e))
    except Exception:
        pass


def do_refresh_status(refresh_fn: Callable[[], None]) -> None:
    """Refresh status work. Run in timer thread via submit_one_shot."""
    try:
        refresh_fn()
    except Exception as e:
        ColorPrint.red(f"[RosbotPanel] Refresh status error: {e}")


def _do_window_ui_analyze(
    panel: Any,
    window_titles: list,
    program_name: str,
    cache_subdir: str,
    docs_json_filename: str,
    log_label: str,
    error_not_found: str,
) -> None:
    """CoInitialize, mkdir, WindowAnalyzer.analyze_window, copy to docs, open folder. Schedules UI updates on main."""
    if pythoncom is not None:
        try:
            pythoncom.CoInitialize()
        except Exception:
            pass
    output_dir = Path(CACHE_DIR) / cache_subdir
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        try:
            panel.container.after(0, lambda err=e: ColorPrint.red(f"[RosbotPanel] {log_label}: mkdir failed: {err}"))
        except Exception:
            pass
        return
    analyzer = WindowAnalyzer()
    analyzer.debug_dir = str(output_dir)
    result = analyzer.analyze_window(window_titles=window_titles, program_name=program_name)
    if result and result.get("success"):
        json_path = result.get("files", {}).get("json")
        controls = result.get("controls", [])
        out_dir = Path(json_path).parent if json_path else output_dir
        jp = str(json_path) if json_path else ""
        n = len(controls)
        docs_json_path = None
        if json_path:
            try:
                docs_dir = Path(__file__).resolve().parent.parent / "docs"
                docs_dir.mkdir(parents=True, exist_ok=True)
                docs_json_path = docs_dir / docs_json_filename
                shutil.copy2(json_path, docs_json_path)
                ColorPrint.green(f"[RosbotPanel] Copied JSON to docs: {docs_json_path}")
            except Exception as copy_err:
                ColorPrint.yellow(f"[RosbotPanel] Copy to docs failed: {copy_err}")

        def _on_done():
            ColorPrint.blue(f"[RosbotPanel] {log_label}: {jp}")
            ColorPrint.blue(f"[RosbotPanel] {n} controls")
            if docs_json_path:
                ColorPrint.blue(f"[RosbotPanel] Docs copy: {docs_json_path}")
            open_folder(Path(out_dir))

        try:
            panel.container.after(0, _on_done)
        except Exception:
            pass
    else:
        err = result.get("error", error_not_found) if result else error_not_found
        try:
            panel.container.after(0, lambda e=err: ColorPrint.red(f"[RosbotPanel] {log_label}: {e}"))
        except Exception:
            pass


def do_rosbot_debug(panel: Any) -> None:
    """Debug ROSBOT: if paused run window analysis; if running send F7 then wait for visible window and run analysis."""
    global _last_rosdebug_f7_at, _rosdebug_running_busy
    refresh_rosbot_status()
    g = get_game_interface_data()
    status = g.rosbot_extended_status
    mgr = get_rosbot_manager()
    if status == "paused":
        winfo = mgr.get_rosbot_window()
        if not winfo or not winfo.get("hwnd"):
            try:
                panel.container.after(0, lambda: ColorPrint.red("[RosbotPanel] Debug ROSBOT: paused but no window"))
            except Exception:
                pass
            return
        title = (winfo.get("title") or "").strip() or "ROSBOT"
        _do_window_ui_analyze(
            panel,
            window_titles=[title],
            program_name="rosbot",
            cache_subdir="rosbot_ui_analyze",
            docs_json_filename="rosbot_ui_elements.json",
            log_label="ROSBOT UI JSON",
            error_not_found="Window not found",
        )
        return
    if status == "running":
        if _rosdebug_running_busy:
            ColorPrint.gray("[RosbotPanel] Debug ROSBOT (running) already in progress, skip")
            return
        now = time.time()
        if _last_rosdebug_f7_at is not None and (now - _last_rosdebug_f7_at) < _ROSDEBUG_F7_DEBOUNCE_SEC:
            ColorPrint.gray("[RosbotPanel] F7 debounced (sent recently), skip send")
            return
        _rosdebug_running_busy = True
        try:
            sent = send_f7_to_system()
            if sent:
                _last_rosdebug_f7_at = time.time()
                ColorPrint.green("[RosbotPanel] F7 sent to system (pause)")
            else:
                ColorPrint.yellow("[RosbotPanel] F7 send failed")
            time.sleep(1.0)
            poll_interval = 2.0
            poll_timeout = 15.0
            deadline = time.time() + poll_timeout
            while time.time() < deadline:
                time.sleep(poll_interval)
                refresh_rosbot_status()
                g2 = get_game_interface_data()
                ColorPrint.gray(f"[RosbotPanel] After F7 poll: status={g2.rosbot_extended_status!r}")
                if g2.rosbot_extended_status == "paused":
                    winfo = mgr.get_rosbot_window()
                    if winfo and winfo.get("hwnd"):
                        title = (winfo.get("title") or "").strip() or "ROSBOT"
                        _do_window_ui_analyze(
                            panel,
                            window_titles=[title],
                            program_name="rosbot",
                            cache_subdir="rosbot_ui_analyze",
                            docs_json_filename="rosbot_ui_elements.json",
                            log_label="ROSBOT UI JSON",
                            error_not_found="Window not found",
                        )
                        return
            ColorPrint.yellow("[RosbotPanel] After F7: no visible window within timeout, skip analysis")
        finally:
            _rosdebug_running_busy = False
        return
    try:
        panel.container.after(0, lambda: ColorPrint.yellow("[RosbotPanel] Debug ROSBOT: not found"))
    except Exception:
        pass


def _send_f7_for_status(mgr: Any, status: str) -> bool:
    """Send F7: pause = to system only; resume = to visible window. Returns True if sent."""
    if status == "running":
        return send_f7_to_system()
    if status == "paused":
        winfo = mgr.get_rosbot_window()
        if winfo and winfo.get("hwnd"):
            return mgr.send_f7_to_process({"hwnd": winfo["hwnd"], "pid": winfo.get("pid"), "title": winfo.get("title")})
        return False
    return False


def do_rosbot_test_pause_resume(panel: Any) -> None:
    """Test ROSBOT pause and resume: pause = F7 to system; resume = main profile + Start botting! (UI)."""
    refresh_rosbot_status()
    g = get_game_interface_data()
    status = g.rosbot_extended_status
    mgr = get_rosbot_manager()

    if status == "not_found":
        ColorPrint.yellow("[RosbotPanel] Test pause/resume: ROSBOT not found")
        return

    poll_interval = 2.0
    timeout = 15.0

    def wait_for(target: str) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            time.sleep(poll_interval)
            refresh_rosbot_status()
            if get_game_interface_data().rosbot_extended_status == target:
                return True
        return False

    if status == "running":
        ColorPrint.blue("[RosbotPanel] Test: pause (F7 to system)...")
        if not _send_f7_for_status(mgr, "running"):
            ColorPrint.red("[RosbotPanel] Test: F7 send failed")
            return
        time.sleep(1.0)
        if wait_for("paused"):
            ColorPrint.green("[RosbotPanel] Test: paused OK")
        else:
            ColorPrint.yellow("[RosbotPanel] Test: pause timeout")
            return
        ColorPrint.blue("[RosbotPanel] Test: resume (main profile + Start botting!)...")
        if not get_rosbot_operation().resume_rosbot(do_tab=True, do_start_botting=True):
            ColorPrint.red("[RosbotPanel] Test: resume (UI) failed")
            return
        time.sleep(1.0)
        if wait_for("running"):
            ColorPrint.green("[RosbotPanel] Test: resume OK")
        else:
            ColorPrint.yellow("[RosbotPanel] Test: resume timeout")
        return

    if status == "paused":
        ColorPrint.blue("[RosbotPanel] Test: resume (main profile + Start botting!)...")
        if not get_rosbot_operation().resume_rosbot(do_tab=True, do_start_botting=True):
            ColorPrint.red("[RosbotPanel] Test: resume (UI) failed")
            return
        time.sleep(1.0)
        if wait_for("running"):
            ColorPrint.green("[RosbotPanel] Test: resumed OK")
        else:
            ColorPrint.yellow("[RosbotPanel] Test: resume timeout")
            return
        ColorPrint.blue("[RosbotPanel] Test: pause (F7 to system)...")
        if not _send_f7_for_status(mgr, "running"):
            ColorPrint.red("[RosbotPanel] Test: F7 send failed")
            return
        time.sleep(1.0)
        if wait_for("paused"):
            ColorPrint.green("[RosbotPanel] Test: paused OK")
        else:
            ColorPrint.yellow("[RosbotPanel] Test: pause timeout")


def do_battlenet_ui_analyze(panel: Any) -> None:
    """Battle.net UI JSON export. Run in timer thread via submit_one_shot; schedules UI updates on main."""
    _do_window_ui_analyze(
        panel,
        window_titles=list(BATTLE_NET_WINDOW_TITLES),
        program_name="battlenet",
        cache_subdir="battlenet_ui_analyze",
        docs_json_filename="登陆后的战网元素.json",
        log_label="Battle.net UI JSON",
        error_not_found="Window not found",
    )


def do_window_monitor_initial_check() -> None:
    """One-time window check after UI ready. Run in timer thread via submit_one_shot."""
    try:
        window_monitor.check_window()
    except Exception as e:
        ColorPrint.red(f"[WindowMonitor] Initial check error: {e}")

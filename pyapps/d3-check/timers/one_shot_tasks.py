#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One-shot work tasks run via timer_manager.submit_one_shot (no new thread).
Used by thread registry and panels. Long-lived thread classes live in controller/d3utils/ui.
"""

import json
import re
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.window_activator import WindowActivator
from pycore.pyutils.window_analyzer import WindowAnalyzer
from pycore.pyutils.flutter_dev_tools.api.folder_opener import open_folder
from providor.providor_index import CACHE_DIR, CONFIG
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.path_scanner import scan_for_paths
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_operation import get_rosbot_operation
from d3utils.rosbot_status_provider import refresh_rosbot_status
from d3utils.key_send import send_f7_to_system
from d3utils.rosbot_flow.flow_e_rosbot_run import (
    run_e1_kill,
    run_e2_sleep,
    run_e3_update_flow,
    run_e4_start,
    run_e5_init,
    run_e5a_wait_win_srv_poll_click,
    run_e6_done,
)
from d3utils.rosbot_task_processor import run_full_status_refresh, start_rosbot_task
from d3utils.rosbot_ui_automation import run_after_rosbot_start, try_close_d3_must_be_launched_dialog
from d3utils.rosbot_update_check import ask_yes_no_on_main_thread
from d3utils.smart_echo import do_smart_echo_pause_after_complete
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
from share.game_interface_data import get_game_interface_data

# Injected by controller; timers must not import controller.
_ensure_bn_started_fn: Optional[Callable[[], bool]] = None
_ensure_d3_no_rosbot_fn: Optional[Callable[[], None]] = None
_ensure_bn_only_fn: Optional[Callable[[], bool]] = None


def register_login_controller_actions(
    ensure_bn_started: Callable[[], bool],
    ensure_d3_no_rosbot: Callable[[], None],
    ensure_bn_only: Callable[[], bool],
) -> None:
    """Register callbacks for D3/BN one-shot tasks. Called from controller layer."""
    global _ensure_bn_started_fn, _ensure_d3_no_rosbot_fn, _ensure_bn_only_fn
    _ensure_bn_started_fn = ensure_bn_started
    _ensure_d3_no_rosbot_fn = ensure_d3_no_rosbot
    _ensure_bn_only_fn = ensure_bn_only


try:
    import pythoncom
except ImportError:
    pythoncom = None

_rosdebug_running_busy = False


def do_path_scan(panel: Any, include_rosbot: bool = True) -> None:
    """Path scan work. Run in timer thread via submit_one_shot; schedules UI update on main.
    When include_rosbot is False, only Battle.net and D3 are scanned; panel._apply_scan_results receives empty ros list."""
    def progress_cb(current_dir: str) -> None:
        if getattr(panel, "_scan_status", None) is not None:
            panel._scan_status[0] = current_dir

    bn, ros, d3 = scan_for_paths(progress_callback=progress_cb, include_rosbot=include_rosbot)
    panel.container.after(0, lambda: panel._apply_scan_results(bn, ros, d3))


def do_login_check(
    panel: Any,
    login_check_fn: Callable[[], Tuple[bool, Optional[Exception]]],
    generation: Optional[int] = None,
) -> None:
    """Login check work. Before starting ROSBOT: only when BN region detected (Asia/CN) check Downloads for update zip; confirm via dialog. Only called by flow via extension thread, UI does not submit directly (FLOW_STATE_ARCHITECTURE)."""
    zip_path, is_newer, version_str, region = run_rosbot_update_check()
    if is_newer and zip_path and region:
        auto = CONFIG.get("ros_settings", {}).get("auto_enable_latest_ros", True)
        if auto:
            apply_rosbot_update(zip_path, region, version_str)
        else:
            if ask_yes_no_on_main_thread(panel, "ROSBOT", "Update found. Update ROSBOT?"):
                apply_rosbot_update(zip_path, region, version_str)
    result = False
    err = None
    try:
        result, err = login_check_fn()
    except Exception as e:
        err = e
    gen = generation
    panel.container.after(0, lambda: panel._on_login_check_done(result, err, generation=gen))


def do_start_d3() -> None:
    """Start D3 (Battle.net + start game flow). Run in timer thread via submit_one_shot. No UI callback."""
    if _ensure_bn_started_fn:
        _ensure_bn_started_fn()
    else:
        ColorPrint.yellow("[OneShot] do_start_d3: callback not set")


def do_ensure_d3_running_from_battlenet_no_rosbot() -> None:
    """
    If D3 online then disconnected: restart from Battle.net (no ROSBOT).
    If D3 not online: start from Battle.net (no ROSBOT).
    If D3 online and not disconnected: no op.
    Run in timer thread via submit_one_shot. No UI callback.
    """
    if _ensure_d3_no_rosbot_fn:
        _ensure_d3_no_rosbot_fn()
    else:
        ColorPrint.yellow("[OneShot] do_ensure_d3_running_from_battlenet_no_rosbot: callback not set")


def do_battlenet_only_check(panel: Any) -> None:
    """Ensure Battle.net running and logged in only. Run in timer thread; schedules _on_battlenet_only_done on main."""
    result = False
    err = None
    try:
        if _ensure_bn_only_fn:
            result = _ensure_bn_only_fn()
        else:
            ColorPrint.yellow("[OneShot] do_battlenet_only_check: callback not set")
    except Exception as e:
        err = e
    panel.container.after(0, lambda r=result, e=err: panel._on_battlenet_only_done(r, e))


def do_refresh_status(refresh_fn: Callable[[], None]) -> None:
    """Refresh status work. Run in timer thread via submit_one_shot."""
    refresh_fn()


def _normalize_controls_for_compare(controls: List[Any]) -> str:
    """Normalize controls list to a comparable string (ignore rect/order variance)."""
    if not controls:
        return "[]"
    rows = []
    for c in controls:
        aid = (c.get("automation_id") or "").strip()
        name = (c.get("name") or "").strip()
        ctype = (c.get("type") or "").strip()
        rows.append((aid, name, ctype))
    rows.sort(key=lambda x: (x[0], x[1], x[2]))
    return json.dumps(rows, sort_keys=True)


def _compute_docs_battlenet_json_path(
    docs_dir: Path,
    new_json_path: Path,
    basename: str,
) -> Tuple[Path, str]:
    """
    Decide docs path: battlenet_ui_elements_N.json. If new content equals an existing file,
    return that path (overwrite). Else return next index. Returns (path, message).
    """
    try:
        with open(new_json_path, "r", encoding="utf-8") as f:
            new_data = json.load(f)
    except (OSError, json.JSONDecodeError):
        new_data = {}
    new_controls = new_data.get("controls") if isinstance(new_data, dict) else []
    new_norm = _normalize_controls_for_compare(new_controls)

    pattern = re.compile(r"^" + re.escape(basename) + r"_(\d+)\.json$")
    existing: List[Tuple[int, Path]] = []
    for p in docs_dir.iterdir():
        if not p.is_file() or not p.suffix == ".json":
            continue
        m = pattern.match(p.name)
        if m:
            existing.append((int(m.group(1)), p))

    for _idx, p in sorted(existing, key=lambda x: x[0]):
        try:
            with open(p, "r", encoding="utf-8") as f:
                old_data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        old_controls = old_data.get("controls") if isinstance(old_data, dict) else []
        if _normalize_controls_for_compare(old_controls) == new_norm:
            return (p, f"Content identical to existing {p.name}, overwrote it.")

    next_index = 1
    if existing:
        next_index = max(i for i, _ in existing) + 1
    target = docs_dir / f"{basename}_{next_index}.json"
    return (target, f"Saved as {target.name}.")


def _do_window_ui_analyze(
    panel: Any,
    window_titles: list,
    program_name: str,
    cache_subdir: str,
    docs_json_filename: str,
    log_label: str,
    error_not_found: str,
    docs_json_basename: Optional[str] = None,
    use_indexed_docs_copy: bool = False,
) -> None:
    """CoInitialize, mkdir, WindowAnalyzer.analyze_window, copy to docs, open folder. Schedules UI updates on main."""
    if pythoncom is not None:
        try:
            pythoncom.CoInitialize()
        except OSError:
            pass
    output_dir = Path(CACHE_DIR) / cache_subdir
    output_dir.mkdir(parents=True, exist_ok=True)
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
        copy_message = None
        if json_path:
            try:
                docs_dir = Path(__file__).resolve().parent.parent / "docs"
                docs_dir.mkdir(parents=True, exist_ok=True)
                if use_indexed_docs_copy and docs_json_basename:
                    docs_json_path, copy_message = _compute_docs_battlenet_json_path(
                        docs_dir, Path(json_path), docs_json_basename
                    )
                    shutil.copy2(json_path, docs_json_path)
                    ColorPrint.green(f"[RosbotPanel] {copy_message}")
                    ColorPrint.green(f"[RosbotPanel] Docs: {docs_json_path}")
                else:
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
            if copy_message:
                ColorPrint.blue(f"[RosbotPanel] {copy_message}")
            open_folder(Path(out_dir))

        panel.container.after(0, _on_done)
    else:
        err = result.get("error", error_not_found) if result else error_not_found
        panel.container.after(0, lambda e=err: ColorPrint.red(f"[RosbotPanel] {log_label}: {e}"))


def _do_window_ui_analyze_by_hwnd(
    panel: Any,
    winfo: Dict[str, Any],
    program_name: str,
    cache_subdir: str,
    docs_json_filename: str,
    log_label: str,
    error_not_found: str,
    docs_json_basename: Optional[str] = None,
    use_indexed_docs_copy: bool = False,
) -> None:
    """Same as _do_window_ui_analyze but find window by hwnd (ROSBOT: same-dir exe / PID, not by title)."""
    if pythoncom is not None:
        try:
            pythoncom.CoInitialize()
        except OSError:
            pass
    output_dir = Path(CACHE_DIR) / cache_subdir
    output_dir.mkdir(parents=True, exist_ok=True)
    analyzer = WindowAnalyzer()
    analyzer.debug_dir = str(output_dir)
    hwnd = winfo.get("hwnd")
    title = (winfo.get("title") or "").strip() or "ROSBOT"
    if not hwnd:
        panel.container.after(0, lambda: ColorPrint.red(f"[RosbotPanel] {log_label}: {error_not_found}"))
        return
    result = analyzer.analyze_window_by_handle(hwnd, title, program_name)
    if result and result.get("success"):
        json_path = result.get("files", {}).get("json")
        controls = result.get("controls", [])
        out_dir = Path(json_path).parent if json_path else output_dir
        jp = str(json_path) if json_path else ""
        n = len(controls)
        docs_json_path = None
        copy_message = None
        if json_path:
            try:
                docs_dir = Path(__file__).resolve().parent.parent / "docs"
                docs_dir.mkdir(parents=True, exist_ok=True)
                if use_indexed_docs_copy and docs_json_basename:
                    docs_json_path, copy_message = _compute_docs_battlenet_json_path(
                        docs_dir, Path(json_path), docs_json_basename
                    )
                    shutil.copy2(json_path, docs_json_path)
                    ColorPrint.green(f"[RosbotPanel] {copy_message}")
                    ColorPrint.green(f"[RosbotPanel] Docs: {docs_json_path}")
                else:
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
            if copy_message:
                ColorPrint.blue(f"[RosbotPanel] {copy_message}")
            open_folder(Path(out_dir))

        panel.container.after(0, _on_done)
    else:
        err = result.get("error", error_not_found) if result else error_not_found
        panel.container.after(0, lambda e=err: ColorPrint.red(f"[RosbotPanel] {log_label}: {e}"))


def do_rosbot_debug(panel: Any) -> None:
    """Debug ROSBOT: export UI JSON. Compatible flow: (1) any window visible -> debug directly;
    (2) process exists but all windows invisible -> send F7 to system, wait for pause, then debug;
    (3) not started -> E1/E2/E4/E5/E5a start, then debug. All by flow (E block), no timers in third-party."""
    global _rosdebug_running_busy
    # Refresh status first so get_rosbot_manager has up-to-date view
    refresh_rosbot_status()
    mgr = get_rosbot_manager()

    # When debugging ROSBOT UI,优先尝试关掉「Diablo III must be launched!」弹窗（小对话框 + OK 按钮，无 TextBox）
    # 仅依赖 UI 特征（尺寸 + 是否有 TextBox + OK 按钮），即使窗口最小化也通过 uiautomation 关闭。
    try:
        closed = try_close_d3_must_be_launched_dialog()
        if closed:
            ColorPrint.gray("[RosbotPanel] Auto-closed 'D3 must be launched' dialog before debug")
    except Exception as e:
        ColorPrint.yellow(f"[RosbotPanel] try_close_d3_must_be_launched_dialog error: {e}")

    winfo_visible = mgr.get_any_visible_rosbot_window()
    if winfo_visible and winfo_visible.get("hwnd"):
        winfo = winfo_visible
    else:
        winfo_any = mgr.get_any_rosbot_window_for_debug()
        if winfo_any and winfo_any.get("hwnd"):
            if _rosdebug_running_busy:
                ColorPrint.gray("[RosbotPanel] Debug ROSBOT (F7 wait) already in progress, skip")
                return
            _rosdebug_running_busy = True
            try:
                ColorPrint.blue("[RosbotPanel] ROSBOT UI JSON: process running, all windows invisible, send F7 then debug")
                sent = send_f7_to_system()
                if sent:
                    ColorPrint.green("[RosbotPanel] F7 sent to system (pause)")
                else:
                    ColorPrint.yellow("[RosbotPanel] F7 send failed")
                time.sleep(1.0)
                refresh_rosbot_status()
                winfo = mgr.get_any_visible_rosbot_window() or mgr.get_any_rosbot_window_for_debug()
            finally:
                _rosdebug_running_busy = False
        else:
            ColorPrint.blue("[RosbotPanel] ROSBOT UI JSON: not started, starting ROSBOT (E1/E2/E4/E5/E5a)...")
            run_e1_kill()
            run_e2_sleep(1.0)
            if not run_e4_start():
                panel.container.after(0, lambda: ColorPrint.red("[RosbotPanel] ROSBOT UI JSON: start failed"))
                return
            run_e5_init(start_rosbot_task)
            run_e5a_wait_win_srv_poll_click(
                run_after_rosbot_start,
                wait_sec=30,
                do_debug=True,
                do_tab=True,
                do_start_botting=True,
            )
            refresh_rosbot_status()
            winfo = mgr.get_any_rosbot_window_for_debug()

    if not winfo or not winfo.get("hwnd"):
        panel.container.after(0, lambda: ColorPrint.red("[RosbotPanel] ROSBOT UI JSON: Window not found"))
        return
    _do_window_ui_analyze_by_hwnd(
        panel,
        winfo,
        program_name="rosbot",
        cache_subdir="rosbot_ui_analyze",
        docs_json_filename="rosbot_ui_elements_1.json",
        log_label="ROSBOT UI JSON",
        error_not_found="Window not found",
        docs_json_basename="rosbot_ui_elements",
        use_indexed_docs_copy=True,
    )


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


def do_rosbot_update(panel: Any) -> None:
    """Update ROSBOT: E1 kill -> E2 sleep -> [E3] E3a-E3f (find zip, confirm, extract/copy/update path) -> E4 start -> E5 E5a -> E6 (ROSBOT_FLOW_MERMAID E block)."""
    ColorPrint.blue("[RosbotPanel] Update ROSBOT: E1 kill existing")
    run_e1_kill()
    ColorPrint.blue("[RosbotPanel] E2 wait 1s")
    run_e2_sleep(1.0)

    def ask_confirm(zip_path: str, version_str: str, region: str) -> bool:
        return ask_yes_no_on_main_thread(
            panel,
            "ROSBOT Update",
            "New version %s found. Extract and update path?\n%s" % (version_str or "?", zip_path),
        )

    proceed, _updated = run_e3_update_flow(ask_confirm_callback=ask_confirm)
    if not proceed:
        ColorPrint.gray("[RosbotPanel] E3 auto_start_rosbot off, skip E4-E5a")
        run_e6_done()
        _rosbot_update_done(panel)
        return
    ColorPrint.blue("[RosbotPanel] E4 start ROSBOT process")
    if not run_e4_start():
        ColorPrint.yellow("[RosbotPanel] E4 start failed")
        run_e6_done()
        _rosbot_update_done(panel)
        return
    ColorPrint.blue("[RosbotPanel] E5 task init")
    run_e5_init(start_rosbot_task)
    ColorPrint.blue("[RosbotPanel] E5a wait window, server, poll UI, click profile & Start botting!")
    run_e5a_wait_win_srv_poll_click(
        run_after_rosbot_start,
        wait_sec=30,
        do_debug=True,
        do_tab=True,
        do_start_botting=True,
    )
    run_e6_done()
    ColorPrint.green("[RosbotPanel] E6 done, update ROSBOT completed")
    _rosbot_update_done(panel)


def _rosbot_update_done(panel: Any) -> None:
    """Main-thread wrap-up after update: refresh status, update panel button."""
    refresh_rosbot_status()
    get_game_interface_data().notify_state_sync()
    if hasattr(panel, "container") and panel.container.winfo_exists():
        panel.container.after(0, lambda: _update_rosbot_button_if_exists(panel))


def _update_rosbot_button_if_exists(panel: Any) -> None:
    """Refresh control button state on main thread."""
    if hasattr(panel, "_update_control_button") and callable(panel._update_control_button):
        panel._update_control_button()


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


def _battlenet_docs_basename_with_region() -> str:
    """Basename for Battle.net UI elements JSON: include region (asia/cn) when known. English only."""
    region = get_game_interface_data().get_battlenet_region()
    if region in ("asia", "cn"):
        return f"battlenet_ui_elements_{region}"
    return "battlenet_ui_elements"


def do_battlenet_ui_analyze(panel: Any) -> None:
    """Battle.net UI JSON export. Find window by exe (Battle.net.exe), prime cache, then analyze. Run in timer thread via submit_one_shot.
    Saves to docs as battlenet_ui_elements[_asia|_cn]_N.json (N auto-incremented; region in name when known). If content equals an existing file, overwrites it."""
    docs_basename = _battlenet_docs_basename_with_region()
    if not get_battlenet_manager().prime_window_cache_for_capture():
        _do_window_ui_analyze(
            panel,
            window_titles=[],
            program_name="battlenet",
            cache_subdir="battlenet_ui_analyze",
            docs_json_filename="battlenet_ui_elements_1.json",
            log_label="Battle.net UI JSON",
            error_not_found="Window not found",
            docs_json_basename=docs_basename,
            use_indexed_docs_copy=True,
        )
        return
    _do_window_ui_analyze(
        panel,
        window_titles=["Battle.net"],
        program_name="battlenet",
        cache_subdir="battlenet_ui_analyze",
        docs_json_filename="battlenet_ui_elements_1.json",
        log_label="Battle.net UI JSON",
        error_not_found="Window not found",
        docs_json_basename=docs_basename,
        use_indexed_docs_copy=True,
    )


def do_window_monitor_initial_check() -> None:
    """Status refresh used by: (1) startup one-shot, (2) manual Refresh, (3) after flow/ensure_bn toggle. Scope = run_full_status_refresh. No time-based debounce; caller (tick/flow) controls when to run."""
    d3_info = run_full_status_refresh()
    window_monitor.notify_window_callbacks(d3_info)
    window_monitor.mark_inactive_refresh_done()
    ColorPrint.blue("[Refresh] Done (Battle.net + D3 + ROSBOT)")

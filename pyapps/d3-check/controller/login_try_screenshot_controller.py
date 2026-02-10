#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Login Try Screenshot Controller
When "Login try" in log: capture Battle.net window, OCR for disconnect keywords (e.g. Retry);
if found, restart Battle.net.exe via taskkill + explorer (no threading).
Also captures full-screen screenshot on demand.
"""

import shutil
import sys
import time
from pathlib import Path
from typing import Optional, Dict

current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler
from providor.constants.common import (
    TEMPLATE_DIR,
    LOGIN_TRY_SCREENSHOT_DIR,
    LOGIN_TRY_SCREENSHOT_PREFIX,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_NEED_LOGIN_KEYWORDS,
    BATTLE_NET_CN_AGREE_KEYWORDS,
    BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS,
    BATTLE_NET_CN_LOGIN_BASE_W,
    BATTLE_NET_CN_LOGIN_BASE_H,
    BATTLE_NET_CN_AGREE_CLICK_X,
    BATTLE_NET_CN_AGREE_CLICK_Y,
    BATTLE_NET_CN_NETEASE_CLICK_X,
    BATTLE_NET_CN_NETEASE_CLICK_Y,
    CLICK_MOVE_DURATION_SEC,
    CLICK_PAUSE_AFTER_MOVE_SEC,
)
from providor.constants.d3 import (
    D3_STANDARD_RESOLUTION_WIDTH,
    D3_STANDARD_RESOLUTION_HEIGHT,
    C3_C3W_TIMEOUT_SEC,
    C3W_WAIT_SEC,
    C10_SKIP_AFTER_TELEPORT_SEC,
    BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME,
    BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME,
)
from providor.providor_index import BATTLENET_TEMPLATE_CONFIGS, CONFIG
from pycore.pyutils.common.window_finder import WindowFinder
from share.game_interface_data import (
    get_game_interface_data,
    get_request_d_block_from_b7,
    get_and_clear_request_d_block_from_b7,
)
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.rosbot_flow.flow_bn_block_state import is_bn_flow_in_login_phase as _is_bn_flow_in_login_phase
from d3utils.d3_manager import get_d3_manager
from d3utils.window_resizer import resize_window_by_titles_to_client_size
from d3utils.d3_start_game_and_teleport_waiter import (
    capture_and_detect_all_d3_states,
    click_start_game_button_if_found,
    try_fragment1_click_start_game_wait_game_tool,
    try_fragment2_game_tool_press_m_then_clicks,
    send_m_then_teleport_three_clicks,
)
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_task_registry import get_start_rosbot_task
from d3utils.rosbot_ui_automation import run_after_rosbot_start
from config.screenshot_categories import get_screenshot_category_manager, MATCH_DEBUG_DIR
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.ocr_helper import (
    ocr_has_any_keywords,
    ocr_get_result,
    ocr_find_keyword_boxes,
    _boxes_from_raw_result,
    bbox_center,
    bbox_left_center,
)
from d3utils.battlenet_capture import capture_battlenet_and_save_to_category
from d3utils.battlenet_operation import get_battlenet_operation
from d3utils.rosbot_flow.flow_bn_block_state import get_and_clear_battlenet_tick_confirmed as _get_and_clear_battlenet_tick_confirmed
from d3utils.rosbot_flow.flow_c_d3_direct import (
    run_c1_entry,
    run_c2_resize,
    run_c3_screenshot_state,
    run_c4_branch_result,
    run_c4_disconnect_then_f1d_f1c,
    run_c12_end_d3,
)
from d3utils.rosbot_flow.extension_flow_state import get_last_teleport_success_time, set_last_teleport_success_time
from d3utils.rosbot_flow_f3_log_timeout import set_f3_rosbot_started_at
from d3utils.battlenet_template_matcher import match_battlenet_template
from d3utils.battlenet_match_debug import debug_all_match_methods as run_battlenet_match_debug
from d3utils.d3u_common.image_annotator_helper import save_match_debug_image, save_no_match_debug_image, save_click_debug_image


class LoginTryScreenshotController:
    """
    On "Login try": capture Battle.net window, OCR for disconnect keywords; if found, restart Battle.net.
    Also captures full-screen screenshot on demand.
    """

    def __init__(self):
        self.screenshot_provider = get_screenshot_provider()
        LOGIN_TRY_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        self._ensure_d3_small_map_template()
        ColorPrint.blue("[LoginTryScreenshotController] Initialized")

    def _ensure_d3_small_map_template(self) -> None:
        """If d3_small_map.png template does not exist, copy from logo.png (screenshot dir or images/)."""
        cfg = BATTLENET_TEMPLATE_CONFIGS.get(BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME)
        if not cfg:
            return
        dest_path = Path(cfg["path"])
        if dest_path.exists():
            return
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        for candidate_dir in (LOGIN_TRY_SCREENSHOT_DIR, Path(TEMPLATE_DIR)):
            src_path = candidate_dir / BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME
            if src_path.exists():
                shutil.copy2(src_path, dest_path)
                ColorPrint.blue(f"[LoginTryScreenshotController] Copied {src_path} -> {dest_path}")
                return
        ColorPrint.yellow(
            f"[LoginTryScreenshotController] Template {dest_path.name} not found; "
            f"put {BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME} in {LOGIN_TRY_SCREENSHOT_DIR} or {TEMPLATE_DIR} or create {dest_path}"
        )

    def _capture_battlenet_window(self) -> Optional[Path]:
        """Capture Battle.net window; return path to saved image for OCR, or None."""
        _, path = capture_battlenet_and_save_to_category("login_try")
        return path

    def _ocr_has_disconnect_keywords(self, image_path: Path) -> bool:
        """Run OCR on image; return True if any disconnect keyword is in text."""
        return ocr_has_any_keywords(
            image_path,
            BATTLE_NET_DISCONNECT_KEYWORDS,
            log_prefix="[LoginTryScreenshotController]",
        )

    def _ocr_has_need_login_keywords(self, image_path: Path) -> bool:
        """Run OCR on image; return True if any need-login keyword is in text."""
        return ocr_has_any_keywords(
            image_path,
            BATTLE_NET_NEED_LOGIN_KEYWORDS,
            log_prefix="[LoginTryScreenshotController]",
        )

    def debug_all_match_methods(
        self,
        pil_image=None,
        template_name: Optional[str] = None,
        window_width: Optional[int] = None,
        window_height: Optional[int] = None,
    ) -> list:
        """Thin wrapper: run d3utils.battlenet_match_debug.debug_all_match_methods. Returns list of saved paths."""
        return run_battlenet_match_debug(
            pil_image=pil_image,
            template_name=template_name,
            window_width=window_width,
            window_height=window_height,
        )

    def handle_login_try(self) -> None:
        """
        On "Login try" in log: check Battle.net state via UI only; if disconnected, restart.
        Uses config battlenet.battlenet_path; no screenshot/OCR.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config")
            return
        op = get_battlenet_operation()
        _, disconnected, *_ = op.get_dynamic_state()
        if not disconnected:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net not disconnected (UI), skip restart")
            return
        ColorPrint.blue("[LoginTryScreenshotController] Disconnect detected (UI), restarting Battle.net...")
        get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)

    def handle_screenshot_trigger(self) -> None:
        """
        Screenshot trigger: check Battle.net state via UI only; if on login run CN flow (UI), if disconnected restart.
        No screenshot/OCR.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config, skip screenshot trigger")
            return
        op = get_battlenet_operation()
        on_login, disconnected, normal_available, *_ = op.get_dynamic_state()
        if normal_available:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net normal_available (UI), skip re-login")
            return
        if disconnected:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net disconnected (UI), restart...")
            get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
            return
        if on_login:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net on login (UI), run CN flow (UI only)")
            self._run_cn_login_flow_ui_only(get_click_handler())
            return
        ColorPrint.blue("[LoginTryScreenshotController] Battle.net state not login/disconnect/normal, skip")

    def _run_cn_login_flow(
        self,
        screenshot_data,
        ocr_result: dict,
        clicker: ClickHandler,
        img_path: Optional[Path] = None,
    ) -> None:
        """
        CN region Battle.net login flow: when on login screen (UI), use BattlenetOperation.perform_cn_login_flow()
        (ensure agreement checkbox checked, click NetEase login/register, wait for web). Then fullscreen capture + OCR/blue, click Login.
        If UI flow not available, fallback to OCR/ratio for agree + NetEase.
        """
        cn_log = "[LoginTryScreenshotController][CN]"
        op = get_battlenet_operation()
        if op.is_on_login_screen():
            if op.perform_cn_login_flow():
                ColorPrint.blue(f"{cn_log} UI login flow done (agree checked + NetEase clicked + wait), proceeding to Login button")
                self._run_cn_login_flow_click_login_button(clicker)
                return
            ColorPrint.yellow(f"{cn_log} perform_cn_login_flow failed, fallback to OCR/ratio")
        raw = (ocr_result or {}).get("raw_result") or []
        ox, oy = screenshot_data.window_offset
        w = (screenshot_data.game_window_size or (0, 0))[0] or (screenshot_data.game_window_image and screenshot_data.game_window_image.width) or 0
        h = (screenshot_data.game_window_size or (0, 0))[1] or (screenshot_data.game_window_image and screenshot_data.game_window_image.height) or 0
        base_w, base_h = BATTLE_NET_CN_LOGIN_BASE_W, BATTLE_NET_CN_LOGIN_BASE_H

        # 1) Agree - click first char (OCR boxes; fallback ocr_find_keyword_boxes; fallback fixed ratio)
        agree_boxes = _boxes_from_raw_result(raw, BATTLE_NET_CN_AGREE_KEYWORDS)
        if not agree_boxes and img_path:
            agree_boxes = ocr_find_keyword_boxes(
                img_path, BATTLE_NET_CN_AGREE_KEYWORDS, log_prefix=cn_log,
            )
        if agree_boxes:
            bbox = agree_boxes[0]["bbox"]
            cx, cy = bbox_left_center(bbox)
            sx, sy = int(ox + cx), int(oy + cy)
            ColorPrint.blue(f"{cn_log} Click agree (left edge, y=50%%) at screen ({sx}, {sy})")
            clicker.click(sx, sy, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(0.5)
        elif w and h:
            cx = BATTLE_NET_CN_AGREE_CLICK_X * w / base_w
            cy = BATTLE_NET_CN_AGREE_CLICK_Y * h / base_h
            sx, sy = int(ox + cx), int(oy + cy)
            ColorPrint.blue(f"{cn_log} Click agree (fallback ratio) at screen ({sx}, {sy})")
            clicker.click(sx, sy, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(0.5)
        else:
            ColorPrint.yellow(f"{cn_log} No agree box and no window size, skip click agree")

        # 2) NetEase login/register (OCR boxes; fallback ocr_find_keyword_boxes; fallback fixed ratio)
        netease_boxes = _boxes_from_raw_result(raw, BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS)
        if not netease_boxes and img_path:
            netease_boxes = ocr_find_keyword_boxes(
                img_path, BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS, log_prefix=cn_log,
            )
        if netease_boxes:
            bbox = netease_boxes[0]["bbox"]
            cx, cy = bbox_center(bbox)
            sx, sy = int(ox + cx), int(oy + cy)
            ColorPrint.blue(f"{cn_log} Click NetEase login at screen ({sx}, {sy})")
            clicker.click(sx, sy, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
        elif w and h:
            cx = BATTLE_NET_CN_NETEASE_CLICK_X * w / base_w
            cy = BATTLE_NET_CN_NETEASE_CLICK_Y * h / base_h
            sx, sy = int(ox + cx), int(oy + cy)
            ColorPrint.blue(f"{cn_log} Click NetEase login (fallback ratio) at screen ({sx}, {sy})")
            clicker.click(sx, sy, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
        else:
            ColorPrint.yellow(f"{cn_log} No NetEase login box and no window size, skip click")

        time.sleep(5)
        self._run_cn_login_flow_click_login_button(clicker)

    def _run_cn_login_flow_ui_only(self, clicker: ClickHandler) -> None:
        """Run CN login flow using only UI Automation (no screenshot/OCR)."""
        cn_log = "[LoginTryScreenshotController][CN]"
        op = get_battlenet_operation()
        if op.is_on_login_screen():
            if op.perform_cn_login_flow():
                ColorPrint.blue(f"{cn_log} UI login flow done (agree + NetEase), proceeding to Login button")
                self._run_cn_login_flow_click_login_button(clicker)
            else:
                ColorPrint.yellow(f"{cn_log} perform_cn_login_flow failed (not CN or UI not found), skip")

    def _run_cn_login_flow_click_login_button(self, clicker: ClickHandler) -> None:
        """After agree + NetEase + wait: click Login button via UI Automation only (no fullscreen/OCR)."""
        cn_log = "[LoginTryScreenshotController][CN]"
        op = get_battlenet_operation()
        if op.click_cn_login_button():
            ColorPrint.blue(f"{cn_log} Login button clicked (UI)")
        else:
            ColorPrint.yellow(f"{cn_log} Login button not found (UI), skip")

    def _restart_battlenet_and_retry_from_step1(self, bn_path: Path) -> None:
        """Reusable: restart Battle.net and wait 5s so caller can retry from step 1 (Battle.net capture)."""
        ColorPrint.yellow("[LoginTryScreenshotController] Start Game / Game tool not found in time; restart Battle.net and retry from step 1...")
        get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
        time.sleep(5)

    def _run_d_block_launch_d3_only(
        self, bn_path: Path, clicker: ClickHandler, kill_d3_first: bool
    ) -> bool:
        """
        D block only: ensure BN logged in, optionally kill D3, activate BN, click D3 tab + Play,
        [D12] sleep(5), poll D3 window 10s. On D3 found: set_d3_status(True) and return True.
        No C branch, no ROSBOT. Reused from ensure_battlenet_started_and_login_check D block.
        """
        if not self._ensure_battlenet_logged_in_first(bn_path, clicker):
            return False
        op = get_battlenet_operation()
        max_rounds = 3
        max_outer_retries = 3
        for outer_round in range(max_outer_retries):
            for round_idx in range(max_rounds):
                ColorPrint.gray("[LoginTryScreenshotController] [D-only] progress: find_windows...")
                windows = get_battlenet_manager().find_windows()
                if not windows:
                    ColorPrint.blue("[LoginTryScreenshotController] [D-only] [D2] No Battle.net window -> start Battle.net -> wait")
                    get_battlenet_manager().start(bn_path)
                    time.sleep(3)
                    continue
                if kill_d3_first:
                    ColorPrint.gray("[LoginTryScreenshotController] [D-only] progress: kill_if_running + sleep(5)...")
                    get_d3_manager().kill_if_running()
                    time.sleep(5)
                ColorPrint.gray("[LoginTryScreenshotController] [D-only] progress: tray + activate_window...")
                clicker.find_and_click_tray_icon(instant=True, interval_after=1.0)
                if not get_battlenet_manager().activate_window():
                    if round_idx < max_rounds - 1:
                        continue
                    return False
                time.sleep(1)
                on_login, disconnected, normal_available, *_ = op.get_dynamic_state()
                if disconnected:
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                if on_login:
                    self._run_cn_login_flow_ui_only(clicker)
                    time.sleep(2)
                    continue
                if not normal_available:
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                if not op.click_d3_tab():
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                time.sleep(0.8)
                if not op.click_start_game():
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                break
            else:
                continue
            ColorPrint.gray("[LoginTryScreenshotController] [D-only] [D12] sleep(3) then poll D3 window 8s...")
            time.sleep(3)
            if not get_d3_manager().poll_until_window_appears(timeout_sec=8.0, interval_sec=0.5, log_progress_every_n=4):
                self._restart_battlenet_and_retry_from_step1(bn_path)
                continue
            get_game_interface_data().set_d3_status(True)
            ColorPrint.green("[LoginTryScreenshotController] [D-only] D3 window found, set_d3_status(True)")
            return True
        ColorPrint.yellow("[LoginTryScreenshotController] [D-only] Exhausted retries")
        return False

    def ensure_d3_running_from_battlenet_no_rosbot(self) -> bool:
        """
        If D3 online then disconnected: restart from Battle.net (kill D3 + BN flow, no ROSBOT).
        If D3 not online: start from Battle.net (BN flow, no ROSBOT).
        If D3 online and not disconnected: do nothing, return True.
        Disconnected = SIFT match of d3_disconnected template (d3_disconnected.png) in D3 window;
        requires two consecutive captures to confirm (same as C3), to avoid single weak match false positive.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path, skip ensure_d3_running_from_battlenet_no_rosbot")
            return False
        d3_windows = get_d3_manager().find_windows()
        has_d3 = bool(d3_windows)
        if has_d3:
            titles = tuple(get_d3_manager().get_capture_titles())
            _sd, state_dict = capture_and_detect_all_d3_states(window_titles=titles)
            disconnected = state_dict.get("disconnected", False)
            if not disconnected:
                ColorPrint.gray("[LoginTryScreenshotController] D3 online and not disconnected, skip")
                return True
            ColorPrint.gray("[LoginTryScreenshotController] First capture: d3_disconnected template matched; confirming with second capture (avoid false positive)...")
            time.sleep(C3W_WAIT_SEC)
            _sd2, state_dict2 = capture_and_detect_all_d3_states(window_titles=titles)
            if not state_dict2.get("disconnected", False):
                ColorPrint.gray("[LoginTryScreenshotController] D3 disconnect not confirmed (second capture != disconnect), skip")
                return True
            ColorPrint.blue("[LoginTryScreenshotController] D3 online then disconnected (confirmed twice) -> restart from Battle.net")
            kill_d3_first = True
        else:
            ColorPrint.blue("[LoginTryScreenshotController] D3 not online -> start from Battle.net")
            kill_d3_first = False
        clicker = get_click_handler()
        return self._run_d_block_launch_d3_only(bn_path, clicker, kill_d3_first)

    def _ensure_battlenet_logged_in_first(self, bn_path: Path, clicker: ClickHandler) -> bool:
        """
        Ensure Battle.net is logged in (normal_available) before any D3 operation.
        If on login screen: run CN login flow or restart; if disconnected: restart.
        Does not kill D3. Returns True only when Battle.net is confirmed logged in (UI normal_available).
        Caller must only run the D3-already-running branch when this returns True.
        """
        op = get_battlenet_operation()
        windows = get_battlenet_manager().find_windows()
        if not windows:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net window not found, starting Battle.net...")
            get_battlenet_manager().start(bn_path)
            time.sleep(3)
        get_battlenet_manager().activate_window()
        time.sleep(0.5)
        max_login_rounds = 5
        for _ in range(max_login_rounds):
            on_login, disconnected, normal_available, *_ = op.get_dynamic_state()
            if normal_available:
                ColorPrint.blue("[LoginTryScreenshotController] Battle.net confirmed logged in (UI), now allow D3 check")
                return True
            if disconnected:
                ColorPrint.blue("[LoginTryScreenshotController] Battle.net disconnected (UI), restarting...")
                get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                time.sleep(5)
                continue
            if on_login:
                if op.is_on_browser_login_wait_screen():
                    ColorPrint.blue("[LoginTryScreenshotController] Battle.net on browser-login-wait (initial), restart and go to step 1...")
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                ColorPrint.blue("[LoginTryScreenshotController] Battle.net on login screen (UI), running login flow (UI only)...")
                self._run_cn_login_flow_ui_only(clicker)
                time.sleep(3)
                continue
            time.sleep(2)
        ColorPrint.yellow("[LoginTryScreenshotController] Battle.net not confirmed logged in; skip D3 branch, run Battle.net flow only")
        return False

    def ensure_battlenet_only(self) -> bool:
        """
        Ensure Battle.net is running and logged in (normal_available). No D3, no ROSBOT.
        If window not found: start Battle.net. If disconnected or on login: restart / run login flow until confirmed.
        Returns True when Battle.net is confirmed logged in.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path, skip ensure_battlenet_only")
            return False
        clicker = get_click_handler()
        return self._ensure_battlenet_logged_in_first(bn_path, clicker)

    def _run_c3_loop_and_handle_branch(self, d3_just_entered: bool = False) -> str:
        """
        [C3] One step per tick: screenshot -> match all (start/game_tool/disconnected/connecting); branch on result.
        Caller must have done C2 (resize) before. Returns "success" if start or game_tool path completed with ROSBOT;
        "disconnect" when F1d+F1c ran (caller must NOT restart Battle.net; next tick F_Entry->B2);
        "fallthrough" for other / timeout (caller may retry from D14).
        d3_just_entered: True when D13 found D3 window within 10s (just entered game); then game_tool skips C6/C10 and goes directly to C7a (ROSBOT_FLOW_MERMAID).
        Doc: no-match/timeout 3min -> C12. Timeout=3min from C3 loop entry; if d3_start_game_button detected then click and reset 3min (Start Game may be stuck and retry).
        """
        c3_deadline = time.time() + C3_C3W_TIMEOUT_SEC  # Timer start: on C3 loop entry (after C2)
        state = None
        while time.time() < c3_deadline:
            if not get_d3_manager().is_running():
                ColorPrint.gray("[LoginTryScreenshotController] [C3] D3 no longer running (e.g. F4 killed), break to D block")
                state = None
                break
            state = run_c3_screenshot_state()
            if state == "disconnect":
                time.sleep(C3W_WAIT_SEC)
                state2 = run_c3_screenshot_state()
                if state2 == "disconnect":
                    break
                ColorPrint.gray("[LoginTryScreenshotController] [C3] disconnect not confirmed (second step != disconnect), continue loop")
                time.sleep(C3W_WAIT_SEC)
                continue
            if state == "game_tool":
                # D13 just entered: need two consecutive game_tool to treat as in-game, avoid loading/char-select screen mis-click teleport
                if d3_just_entered:
                    time.sleep(C3W_WAIT_SEC)
                    state2 = run_c3_screenshot_state()
                    if state2 != "game_tool":
                        state = state2
                        time.sleep(C3W_WAIT_SEC)
                        continue
                break
            if state == "start":
                if click_start_game_button_if_found():
                    c3_deadline = time.time() + C3_C3W_TIMEOUT_SEC  # On start: click and reset 3min
                    ColorPrint.gray("[LoginTryScreenshotController] [C3] d3_start_game_button detected, clicked and reset 3min (Start Game may be stuck)")
                time.sleep(C3W_WAIT_SEC)
                continue
            time.sleep(C3W_WAIT_SEC)
        if time.time() >= c3_deadline and state not in ("disconnect", "start", "game_tool"):
            # Flow doc: when connecting keep wait, do not kill D3; only 'unrecognized/timeout' go to C12. If last round before timeout was wait(connecting) do not do final match, return as connecting
            if state == "wait":
                ColorPrint.gray("[LoginTryScreenshotController] [C3] timeout but last state was connecting (wait), do not kill D3, next tick retry")
                return "connecting"
            state = run_c3_screenshot_state()
        ColorPrint.gray("[LoginTryScreenshotController] [C] progress: run_c4_branch_result -> %s (d3_just_entered=%s)" % (state, d3_just_entered))
        if state == "game_tool" and d3_just_entered:
            branch_result = "game_tool"
            ColorPrint.gray("[LoginTryScreenshotController] [C] progress: branch_result=%s (skip C10: D13 just entered game, ROSBOT_FLOW_MERMAID)" % branch_result)
        else:
            branch_result = run_c4_branch_result(state)
            ColorPrint.gray("[LoginTryScreenshotController] [C] progress: branch_result=%s" % branch_result)
        if branch_result == "disconnect":
            if state == "disconnect":
                ColorPrint.yellow("[LoginTryScreenshotController][C4] D3 disconnected (C3 template: run_c3_screenshot_state matched d3_disconnected), F1d+F1c then C12->D1")
            else:
                ColorPrint.yellow("[LoginTryScreenshotController][C4] D3 disconnected (C10b: check_d3_online_by_m_similarity returned False, before/after M >= threshold), F1d+F1c then C12->D1")
            run_c4_disconnect_then_f1d_f1c()
            return "disconnect"  # Caller must NOT restart BN: next tick F_Entry->B2, BN window stays
        if branch_result == "start":
            r1 = try_fragment1_click_start_game_wait_game_tool()
            if r1 is True and send_m_then_teleport_three_clicks():
                set_last_teleport_success_time(time.time())
                get_game_interface_data().set_d3_status(True)
                get_rosbot_manager().kill_if_running()
                time.sleep(1)
                if CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True) and get_rosbot_manager().start():
                    set_f3_rosbot_started_at()
                    fn = get_start_rosbot_task()
                    if fn:
                        fn()
                    run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
                return "success"
            if r1 is False or r1 is None:
                run_c12_end_d3()
            return "fallthrough"
        if branch_result == "game_tool":
            last_teleport = get_last_teleport_success_time()
            in_teleport_cooldown = last_teleport is not None and (time.time() - last_teleport) < C10_SKIP_AFTER_TELEPORT_SEC
            if in_teleport_cooldown:
                # Already teleported this cycle (tick C7b); only wait for ROSBOT window and click (no M+teleport+kill+start).
                run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
                return "success"
            if try_fragment2_game_tool_press_m_then_clicks():
                set_last_teleport_success_time(time.time())
                get_game_interface_data().set_d3_status(True)
                get_rosbot_manager().kill_if_running()
                time.sleep(1)
                if CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True) and get_rosbot_manager().start():
                    set_f3_rosbot_started_at()
                    fn = get_start_rosbot_task()
                    if fn:
                        fn()
                    run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
                return "success"
            run_c12_end_d3()  # [C6] path fail -> C12 (doc: fallthrough to D)
            return "fallthrough"
        if branch_result == "wait":
            ColorPrint.gray("[LoginTryScreenshotController] [C3] connecting (wait): do not kill D3, next tick retry")
            return "connecting"
        run_c12_end_d3()
        return "fallthrough"

    def ensure_battlenet_started_and_login_check(self) -> bool:
        """
        Step 1 for starting ROSBOT: ensure Battle.net window, capture screenshot. Three states, reuse code only, do not mix flows:
        D3-already-running (C branch): if D3 window exists, [C2] resize then [C3] loop (screenshot+match all) -> branch:
          start -> try_fragment1; game_tool -> try_fragment2; disconnect -> F1d+F1c; other/timeout -> kill D3, fall to D.
        Battle.net flow (D block): ensure BN window, kill D3, activate BN, click D3 tab + Play. [D12] sleep(5), [D13] poll D3 window 10s.
        D13 Yes -> [C1] C2 resize, [C3] loop + branch (same as C); success -> start ROSBOT; fallthrough -> restart BN, retry from step 1.
        Returns True if step completed (C branch or D13->C path success), False if config missing or window unavailable.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config, skip step 1")
            return False

        # Doc F1->C1: check if D3 is running first; when D3 already running go direct to C branch, use this tick refresh to avoid re-querying Battle.net
        has_d3_process = get_d3_manager().is_running()
        clicker = get_click_handler()
        from_tick_fast_path = False
        battlenet_confirmed = False

        if has_d3_process:
            # D3 already running -> prefer direct, use cached BN state, no repeated find_windows/get_dynamic_state
            g = get_game_interface_data()
            if g.battlenet_window_found and g.battlenet_normal_available:
                battlenet_confirmed = True
                ColorPrint.gray("[LoginTryScreenshotController] D3 running -> use cached BN state, skip BN login check (direct C)")
            else:
                battlenet_confirmed = self._ensure_battlenet_logged_in_first(bn_path, clicker)
                if battlenet_confirmed:
                    ColorPrint.gray("[LoginTryScreenshotController] D3 running, BN confirmed after one check")
        else:
            # D3 not running -> per doc do Battle.net confirm then D block
            ColorPrint.gray("[LoginTryScreenshotController] progress: D3 not running -> battlenet_confirmed branch...")
            if get_request_d_block_from_b7():
                ColorPrint.gray("[LoginTryScreenshotController] progress: branch get_request_d_block_from_b7")
                if _is_bn_flow_in_login_phase(True) or _is_bn_flow_in_login_phase(False):
                    get_and_clear_request_d_block_from_b7()
                    battlenet_confirmed = self._ensure_battlenet_logged_in_first(bn_path, clicker)
                    if not battlenet_confirmed:
                        ColorPrint.blue("[LoginTryScreenshotController] D block from B7 but flow on login screen -> run Battle.net flow only (no D3 small map check yet)")
                else:
                    get_and_clear_request_d_block_from_b7()
                    battlenet_confirmed = True
                    ColorPrint.blue("[LoginTryScreenshotController] D block from B7 (no operable UI): run D3 tab, Play, region (CN/Asia) then C or D")
            elif _get_and_clear_battlenet_tick_confirmed(True) or _get_and_clear_battlenet_tick_confirmed(False):
                ColorPrint.gray("[LoginTryScreenshotController] progress: branch get_and_clear_battlenet_tick_confirmed (tick-confirmed)")
                battlenet_confirmed = True
                from_tick_fast_path = True
                ColorPrint.blue("[LoginTryScreenshotController] Battle.net confirmed by tick flow, running D3 part only")
            else:
                ColorPrint.gray("[LoginTryScreenshotController] progress: branch _ensure_battlenet_logged_in_first...")
                battlenet_confirmed = self._ensure_battlenet_logged_in_first(bn_path, clicker)
                if not battlenet_confirmed:
                    ColorPrint.blue("[LoginTryScreenshotController] Battle.net not confirmed; run Battle.net flow only, do not touch D3")
            if not battlenet_confirmed:
                from_tick_fast_path = False

        # Enter branch A (C) only when: Battle.net logged in + [A6] D3 process exists (ROSBOT_FLOW_MERMAID.md)
        has_bn_confirmed = battlenet_confirmed
        # When tick flow is on login screen (BN_LoginAsia/BN_Login1/BN_Login2), do not run D block (kill D3, capture, expect small map). Let tick flow finish login; controller will be triggered again after BN_Confirmed.
        if not has_bn_confirmed and (_is_bn_flow_in_login_phase(True) or _is_bn_flow_in_login_phase(False)):
            ColorPrint.blue("[LoginTryScreenshotController] Flow on login screen, skip D block (no kill/restart); tick flow will perform login")
            return False
        # When D3 running but not in C block (has_bn_confirmed=False), entering D block would kill D3 first. Flow requires: do not kill when connecting. Before D do one C3 step; if connecting this tick do not kill, do not restart BN.
        if has_d3_process and not has_bn_confirmed:
            quick_c3 = run_c3_screenshot_state()
            if quick_c3 == "wait":
                ColorPrint.gray("[LoginTryScreenshotController] D3 running but BN not confirmed; C3 one-step=connecting, do not kill D3, next tick retry")
                return False
        if has_bn_confirmed and has_d3_process:
            if run_c1_entry(has_bn_confirmed, has_d3_process):
                ColorPrint.blue("[LoginTryScreenshotController] [C1] entry -> [C2] Resize -> [C3] loop (doc C1->C2->C3, already present at start)")
                run_c2_resize()
                ColorPrint.gray("[LoginTryScreenshotController] [C] progress: _run_c3_loop_and_handle_branch(d3_just_entered=False)...")
                c3_result = self._run_c3_loop_and_handle_branch(d3_just_entered=False)
                if c3_result == "success":
                    return True
                if c3_result == "disconnect":
                    return False  # F1d+F1c done, next tick F_Entry->B2, do not touch BN
                if c3_result == "connecting":
                    return False  # D3 in connecting, do not kill/restart BN, next tick retry

        # [D1] Launch D3 from Battle.net branch (UI-only: no screenshot/template)
        op = get_battlenet_operation()
        max_rounds = 3
        max_outer_retries = 3
        for outer_round in range(max_outer_retries):
            for round_idx in range(max_rounds):
                # Fast path: tick just confirmed BN (B12), skip kill+5s+tray, go straight to tab+play
                if from_tick_fast_path and outer_round == 0 and round_idx == 0:
                    ColorPrint.gray("[LoginTryScreenshotController] [D fast] progress: find_windows...")
                    windows = get_battlenet_manager().find_windows()
                    if not windows:
                        from_tick_fast_path = False
                        continue
                    ColorPrint.gray("[LoginTryScreenshotController] [D fast] progress: activate_window...")
                    get_battlenet_manager().activate_window()
                    time.sleep(0.3)
                    ColorPrint.gray("[LoginTryScreenshotController] [D fast] progress: get_dynamic_state...")
                    on_login, disconnected, normal_available, *_ = op.get_dynamic_state()
                    if not normal_available:
                        from_tick_fast_path = False
                        continue
                    ColorPrint.green("[LoginTryScreenshotController] [D fast] Tick-confirmed: click D3 tab + one shot Play (flow drives wait)")
                    ColorPrint.gray("[LoginTryScreenshotController] [D fast] progress: before starting D3 try to end ROSBOT...")
                    get_rosbot_manager().kill_if_running()
                    ColorPrint.gray("[LoginTryScreenshotController] [D fast] progress: click_d3_tab...")
                    if op.click_d3_tab():
                        ColorPrint.gray("[LoginTryScreenshotController] [D fast] progress: click_play_button_if_visible (one shot, no timer)...")
                        if op.click_play_button_if_visible(force_refresh=True):
                            from_tick_fast_path = False
                            break
                    from_tick_fast_path = False
                    continue

                # Step 1: ensure Battle.net window (UI only: find_windows)
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: find_windows...")
                windows = get_battlenet_manager().find_windows()
                if not windows:
                    ColorPrint.blue("[LoginTryScreenshotController] [D2] No Battle.net window -> start Battle.net -> wait")
                    get_battlenet_manager().start(bn_path)
                    time.sleep(3)
                    continue

                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: kill_if_running + sleep(5)...")
                get_d3_manager().kill_if_running()
                time.sleep(5)

                ColorPrint.blue("[LoginTryScreenshotController] [D3] End current D3 process if any -> wait 5s; [D4] Tray/activate Battle.net -> wait 1s")
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: find_and_click_tray_icon...")
                clicker.find_and_click_tray_icon(instant=True, interval_after=1.0)
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: activate_window...")
                if not get_battlenet_manager().activate_window():
                    ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window not found for activate")
                    if round_idx < max_rounds - 1:
                        continue
                    return False
                time.sleep(1)

                # Branch by UI state (no screenshot/OCR/template)
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: get_dynamic_state...")
                on_login, disconnected, normal_available, *_ = op.get_dynamic_state()
                if disconnected:
                    ColorPrint.blue("[LoginTryScreenshotController] Battle.net disconnected (UI), restart and retry...")
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                if on_login:
                    ColorPrint.blue("[LoginTryScreenshotController] Battle.net on login screen (UI), run login flow then retry...")
                    self._run_cn_login_flow_ui_only(clicker)
                    time.sleep(2)
                    continue
                if not normal_available:
                    ColorPrint.yellow("[LoginTryScreenshotController] Battle.net not normal_available (UI), restart and retry...")
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue

                # normal_available: click D3 tab then one shot Play (no timer; flow BN_WaitPlay drives wait over ticks)
                ColorPrint.green("[LoginTryScreenshotController] Battle.net normal_available (UI), click D3 tab + one shot Play (flow drives)")
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: before starting D3 try to end ROSBOT...")
                get_rosbot_manager().kill_if_running()
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: click_d3_tab...")
                if not op.click_d3_tab():
                    ColorPrint.yellow("[LoginTryScreenshotController] D3 tab click failed (UI), restart and retry...")
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                ColorPrint.gray("[LoginTryScreenshotController] [D] progress: click_play_button_if_visible (one shot, no timer)...")
                if not op.click_play_button_if_visible(force_refresh=True):
                    ColorPrint.gray("[LoginTryScreenshotController] [D] Play not visible this tick; flow BN_WaitPlay will click next tick, return for tick drive")
                    return False
                break
            else:
                continue

            # [D12] After Play sleep(3), poll for D3 window up to 8s (0.5s interval); [D13] D3 window found -> C1_Entry
            ColorPrint.gray("[LoginTryScreenshotController] [D12] progress: sleep(3) then poll D3 window up to 8s...")
            time.sleep(3)
            if not get_d3_manager().poll_until_window_appears(timeout_sec=8.0, interval_sec=0.5, log_progress_every_n=4):
                self._restart_battlenet_and_retry_from_step1(bn_path)
                return False
            get_game_interface_data().set_d3_status(True)
            # [D13] Yes, mark 'just entered game' -> [C1] entry -> [C2] Resize -> [C3] loop (doc ROSBOT_FLOW_MERMAID)
            if run_c1_entry(True, True):
                run_c2_resize()
                ColorPrint.gray("[LoginTryScreenshotController] [D13] just entered game -> _run_c3_loop_and_handle_branch(d3_just_entered=True), skip C10 when game_tool")
                c3_result = self._run_c3_loop_and_handle_branch(d3_just_entered=True)
                if c3_result == "success":
                    return True
                if c3_result == "disconnect":
                    return False
                if c3_result == "connecting":
                    return False
            self._restart_battlenet_and_retry_from_step1(bn_path)
            return False

        ColorPrint.yellow("[LoginTryScreenshotController] Exhausted outer retries; step 1 did not complete")
        return False

    def capture_screenshot(self) -> Optional[Dict[str, Path]]:
        """
        Capture full-screen screenshot and save to login_try_screenshots dir.

        Returns:
            Dict with fullscreen_path and optionally game_window_path, or None on failure.
        """
        ColorPrint.blue("[LoginTryScreenshotController] Capturing full-screen screenshot...")
        screenshot_data = self.screenshot_provider.gen(
            use_optimized_capture=False,
            window_titles=None,
        )
        if screenshot_data is None:
            ColorPrint.yellow("[LoginTryScreenshotController] Failed to capture screenshot")
            return None
        saved = screenshot_data.save(
            output_dir=LOGIN_TRY_SCREENSHOT_DIR,
            prefix=LOGIN_TRY_SCREENSHOT_PREFIX,
        )
        if saved:
            get_screenshot_category_manager().clean_older_than("login_try")
            ColorPrint.green(
                f"[LoginTryScreenshotController] Screenshot saved: {saved.get('fullscreen_path')}"
            )
        return saved


_login_try_controller: Optional[LoginTryScreenshotController] = None


def get_login_try_screenshot_controller() -> LoginTryScreenshotController:
    """Get global LoginTryScreenshotController instance (singleton)."""
    global _login_try_controller
    if _login_try_controller is None:
        _login_try_controller = LoginTryScreenshotController()
    return _login_try_controller

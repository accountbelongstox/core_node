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
from providor.app_constants import TEMPLATE_DIR, STANDARD_RESOLUTION_WIDTH, STANDARD_RESOLUTION_HEIGHT
from providor.providor_index import BATTLENET_TEMPLATE_CONFIGS, CONFIG, DIABLO_III_WINDOW_TITLES
from pycore.pyutils.common.window_finder import WindowFinder
from providor.app_constants import (
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
    BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME,
    BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME,
    BATTLE_NET_PLAY_BUTTON_LEFT_PX,
    BATTLE_NET_PLAY_BUTTON_BOTTOM_PX,
    CLICK_MOVE_DURATION_SEC,
    CLICK_PAUSE_AFTER_MOVE_SEC,
)
from share.game_interface_data import get_game_interface_data
from d3utils.battlenet_manager import get_battlenet_manager, get_battlenet_window_titles
from d3utils.d3_manager import get_d3_manager
from d3utils.window_resizer import resize_window_by_titles_to_client_size
from d3utils.d3_start_game_and_teleport_waiter import (
    wait_for_and_click_start_game,
    detect_d3_already_running_state,
    try_fragment1_click_start_game_wait_game_tool,
    try_fragment2_game_tool_press_m_then_clicks,
    send_m_then_teleport_three_clicks,
)
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_task_processor import start_rosbot_task
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
from d3utils.rosbot_flow_battlenet import get_and_clear_battlenet_tick_confirmed
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
        """If d3_small_map.png template does not exist, copy from ScreenShot_2026-01-29_225845_569.png (screenshot dir or images/)."""
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
            f"put {BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME} in {LOGIN_TRY_SCREENSHOT_DIR} or {TEMPLATE_DIR} or {dest_path}"
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
        On "Login try" in log: capture Battle.net window, OCR for disconnect keywords;
        if found, treat as disconnect and restart Battle.net.exe (taskkill + explorer).
        Uses config battlenet.battlenet_path and get_battlenet_window_titles(); no Python threading.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config")
            self.capture_screenshot()
            return

        img_path = self._capture_battlenet_window()
        if img_path is None:
            self.capture_screenshot()
            return

        if not self._ocr_has_disconnect_keywords(img_path):
            ColorPrint.blue("[LoginTryScreenshotController] No disconnect keywords, skip restart")
            return

        ColorPrint.blue("[LoginTryScreenshotController] Disconnect detected, restarting Battle.net...")
        get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)

    def handle_screenshot_trigger(self) -> None:
        """
        Screenshot trigger: capture Battle.net window, run OCR once; CN region (agree/NetEase login) first,
        then need-login. Same OCR for both branches, no ocr_has_any_keywords (no "Keyword in UI" log).
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config, skip screenshot trigger")
            return
        screenshot_data, img_path = capture_battlenet_and_save_to_category("login_try")
        if screenshot_data is None or img_path is None:
            ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window not found, skip screenshot trigger")
            return
        ocr_result = ocr_get_result(img_path)
        ocr_text = (ocr_result or {}).get("text") or ""
        cn_agree_netease = BATTLE_NET_CN_AGREE_KEYWORDS + BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS
        has_cn = any(kw in ocr_text for kw in cn_agree_netease)
        if has_cn:
            ColorPrint.blue("[LoginTryScreenshotController][CN] Detected CN region login (agree/NetEase login), run flow")
            self._run_cn_login_flow(screenshot_data, ocr_result or {}, ClickHandler(), img_path=img_path)
            return
        has_need_login = any(kw in ocr_text for kw in BATTLE_NET_NEED_LOGIN_KEYWORDS)
        if not has_need_login:
            ColorPrint.blue("[LoginTryScreenshotController] No need-login keywords, skip re-login")
            return
        ColorPrint.blue("[LoginTryScreenshotController] Need-login text detected, triggering re-login (restart)...")
        get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)

    def _run_cn_login_flow(
        self,
        screenshot_data,
        ocr_result: dict,
        clicker: ClickHandler,
        img_path: Optional[Path] = None,
    ) -> None:
        """
        CN region Battle.net login flow: when on login screen (UI), use BattlenetOperation.perform_cn_login_flow()
        (ensure "您同意" checkbox checked, click "使用网易账号登录或注册", wait for web). Then fullscreen capture + OCR/blue, click Login.
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

    def _ensure_battlenet_logged_in_first(self, bn_path: Path, clicker: ClickHandler) -> bool:
        """
        Ensure Battle.net is logged in (normal_available) before any D3 operation.
        If on login screen: run CN login flow or restart; if disconnected: restart.
        Does not kill D3. Returns True only when Battle.net is confirmed logged in (UI normal_available).
        Caller must only run the D3-already-running branch when this returns True.
        """
        op = get_battlenet_operation()
        windows = WindowFinder.find_windows_by_titles(
            titles=get_battlenet_window_titles(),
            match_mode="in",
            use_cache=False,
        )
        if not windows:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net window not found, starting Battle.net...")
            get_battlenet_manager().start(bn_path)
            time.sleep(3)
        get_battlenet_manager().activate_window()
        time.sleep(0.5)
        max_login_rounds = 5
        for _ in range(max_login_rounds):
            on_login, disconnected, normal_available = op.get_dynamic_state()
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
                    ColorPrint.blue("[LoginTryScreenshotController] Battle.net on '使用浏览器完成登录/取消' (initial), restart and go to step 1...")
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue
                ColorPrint.blue("[LoginTryScreenshotController] Battle.net on login screen (UI), running login flow first...")
                screenshot_data, img_path = capture_battlenet_and_save_to_category("login_try")
                if screenshot_data and img_path:
                    ocr_result = ocr_get_result(img_path) or {}
                    self._run_cn_login_flow(screenshot_data, ocr_result, clicker, img_path=img_path)
                time.sleep(3)
                continue
            time.sleep(2)
        ColorPrint.yellow("[LoginTryScreenshotController] Battle.net not confirmed logged in; skip D3 branch, run Battle.net flow only")
        return False

    def ensure_battlenet_started_and_login_check(self) -> bool:
        """
        Step 1 for starting ROSBOT: ensure Battle.net window, capture screenshot. Three states, reuse code only, do not mix flows:
        D3-already-running: if D3 window exists, resize then detect_d3_already_running_state() -> branch:
          state "start" (state 2): try_fragment1 only; on True do send_m_then_teleport_three_clicks (no fragment2).
          state "game_tool" (state 3): try_fragment2 only (no fragment1).
          None: kill D3, fall through to Battle.net flow.
        Battle.net flow (state 1): if screenshot has D3 small map -> click small map, click Play, then proceed to game.
        2) If screenshot has no D3 small map -> run OCR once; if CN region (agree/NetEase login) run CN flow:
           click first char of agree -> click NetEase login -> wait 5s -> fullscreen OCR click Login,
           then retry from step 1 (next round re-capture).
        3) Not CN and need-login -> restart Battle.net, retry from step 1.
        4) Not CN and no small map -> restart Battle.net, retry from step 1.
        After Play: wait for d3_start_game_button (10 x 2s), then d3_game_tool (10 x 2s). If either fails, restart and retry from step 1.
        Returns True if step completed (D3 small map found or D3 direct path success), False if config missing or window unavailable.
        """
        bn_path = get_battlenet_manager().get_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config, skip step 1")
            return False

        clicker = ClickHandler()
        if get_and_clear_battlenet_tick_confirmed():
            battlenet_confirmed = True
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net confirmed by tick flow, running D3 part only")
        else:
            battlenet_confirmed = self._ensure_battlenet_logged_in_first(bn_path, clicker)
            if not battlenet_confirmed:
                ColorPrint.blue("[LoginTryScreenshotController] Battle.net not confirmed; run Battle.net flow only, do not touch D3")

        if battlenet_confirmed and get_d3_manager().is_running():
            ColorPrint.blue("[LoginTryScreenshotController] D3 already running; detect disconnect, then continue state-1 flow from middle if not disconnected")
            resize_window_by_titles_to_client_size(
                DIABLO_III_WINDOW_TITLES,
                STANDARD_RESOLUTION_WIDTH,
                STANDARD_RESOLUTION_HEIGHT,
            )
            WindowFinder.invalidate_window_cache(list(DIABLO_III_WINDOW_TITLES))
            state = detect_d3_already_running_state()
            if state == "start":
                r1 = try_fragment1_click_start_game_wait_game_tool()
                if r1 is True:
                    if send_m_then_teleport_three_clicks():
                        get_game_interface_data().set_d3_status(True)
                        get_rosbot_manager().kill_if_running()
                        time.sleep(1)
                        if CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True):
                            if get_rosbot_manager().start():
                                start_rosbot_task()
                                run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
                        return True
                if r1 is False or r1 is None:
                    get_d3_manager().kill_if_running()
            elif state == "game_tool":
                if try_fragment2_game_tool_press_m_then_clicks():
                    get_game_interface_data().set_d3_status(True)
                    get_rosbot_manager().kill_if_running()
                    time.sleep(1)
                    if CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True):
                        if get_rosbot_manager().start():
                            start_rosbot_task()
                            run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
                    return True
                get_d3_manager().kill_if_running()
            else:
                get_d3_manager().kill_if_running()

        max_rounds = 3
        max_outer_retries = 3
        for outer_round in range(max_outer_retries):
            d3_small_map_match = None
            for round_idx in range(max_rounds):
                # Step 1: ensure Battle.net window (from beginning each round after restart)
                img_path = self._capture_battlenet_window()
                if img_path is None:
                    ColorPrint.blue("[LoginTryScreenshotController] Battle.net window not found, starting Battle.net...")
                    get_battlenet_manager().start(bn_path)
                    time.sleep(3)

                get_d3_manager().kill_if_running()
                time.sleep(5)

                ColorPrint.blue("[LoginTryScreenshotController] Activating Battle.net UI (tray click, instant + 1s)...")
                clicker.find_and_click_tray_icon(instant=True, interval_after=1.0)
                if get_battlenet_manager().activate_window():
                    time.sleep(1)
                else:
                    ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window not found for activate, proceeding with capture")

                screenshot_data, img_path = capture_battlenet_and_save_to_category("login_try")
                if screenshot_data is None or img_path is None:
                    ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window still not found after activate")
                    if round_idx < max_rounds - 1:
                        continue
                    return False

                img = screenshot_data.game_window_image
                if img is None:
                    if round_idx < max_rounds - 1:
                        continue
                    return False

                # Branch from step 1: check screenshot for D3 small map first; if none, OCR for CN/need-login
                w, h = screenshot_data.game_window_size or (img.width, img.height)
                d3_small_map_match = match_battlenet_template(
                    img, BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME, w, h
                )
                if d3_small_map_match is not None:
                    break

                # No D3 small map on screenshot: OCR to detect CN region (agree/NetEase login)
                ocr_result = ocr_get_result(img_path)
                ocr_text = (ocr_result or {}).get("text") or ""
                cn_agree_netease = BATTLE_NET_CN_AGREE_KEYWORDS + BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS
                has_cn = any(kw in ocr_text for kw in cn_agree_netease)
                if has_cn:
                    ColorPrint.blue("[LoginTryScreenshotController][CN] No D3 small map, CN region login (agree/NetEase), run flow then retry from step 1")
                    self._run_cn_login_flow(screenshot_data, ocr_result or {}, clicker, img_path=img_path)
                    time.sleep(2)
                    continue
                has_need_login = any(kw in ocr_text for kw in BATTLE_NET_NEED_LOGIN_KEYWORDS)
                if has_need_login:
                    ColorPrint.blue("[LoginTryScreenshotController] Need-login text detected, restart and retry from step 1...")
                    get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                    time.sleep(5)
                    continue

                ColorPrint.yellow("[LoginTryScreenshotController] D3 small map not found, restart Battle.net and retry from step 1...")
                get_battlenet_manager().restart(bn_path, wait_after_sec=2.0)
                time.sleep(5)

            if d3_small_map_match is None:
                cfg = BATTLENET_TEMPLATE_CONFIGS.get(BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME)
                tpath = str(cfg["path"]) if cfg and cfg.get("path") else None
                save_no_match_debug_image(
                    img, "SIFT", MATCH_DEBUG_DIR, template_path=tpath,
                    filename_prefix="login_try_match_debug_d3_small_map",
                )
                get_screenshot_category_manager().clean_older_than("match_debug")
                continue

            ColorPrint.green("[LoginTryScreenshotController] UI login success (D3 small map found by SIFT)")
            cfg = BATTLENET_TEMPLATE_CONFIGS.get(BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME)
            tpath = str(cfg["path"]) if cfg and cfg.get("path") else None
            save_match_debug_image(
                img, d3_small_map_match, "d3_small_map", MATCH_DEBUG_DIR, template_path=tpath,
                filename_prefix="login_try_match_debug",
            )
            get_screenshot_category_manager().clean_older_than("match_debug")

            cx = int(d3_small_map_match["center"][0])
            cy = int(d3_small_map_match["center"][1])
            get_battlenet_manager().activate_window()
            time.sleep(0.3)
            moment_data = self.screenshot_provider.gen(
                use_optimized_capture=True,
                window_titles=get_battlenet_window_titles(),
            )
            if moment_data and moment_data.game_window_image:
                ox, oy = moment_data.window_offset
                click_x = ox + cx
                click_y = oy + cy
                save_click_debug_image(
                    moment_data.game_window_image,
                    [(cx, cy, "small_map")],
                    MATCH_DEBUG_DIR,
                    filename_prefix="login_try_small_map_click",
                )
                ColorPrint.blue(f"[LoginTryScreenshotController] Clicking D3 small map at screen ({click_x}, {click_y})")
                clicker.click(click_x, click_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            else:
                ox, oy = screenshot_data.window_offset
                click_x, click_y = ox + cx, oy + cy
                ColorPrint.blue(f"[LoginTryScreenshotController] Clicking D3 small map at screen ({click_x}, {click_y}) (no moment capture)")
                clicker.click(click_x, click_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(0.8)

            get_battlenet_manager().activate_window()
            time.sleep(0.3)
            screenshot_data2 = self.screenshot_provider.gen(
                use_optimized_capture=True,
                window_titles=get_battlenet_window_titles(),
            )
            if screenshot_data2 and screenshot_data2.game_window_image:
                img2 = screenshot_data2.game_window_image
                w2, h2 = screenshot_data2.game_window_size or (img2.width, img2.height)
                ox2, oy2 = screenshot_data2.window_offset
                play_x = ox2 + BATTLE_NET_PLAY_BUTTON_LEFT_PX
                play_y = oy2 + (h2 - BATTLE_NET_PLAY_BUTTON_BOTTOM_PX)
                save_click_debug_image(
                    img2,
                    [(BATTLE_NET_PLAY_BUTTON_LEFT_PX, h2 - BATTLE_NET_PLAY_BUTTON_BOTTOM_PX, "Play")],
                    MATCH_DEBUG_DIR,
                    filename_prefix="login_try_play_click",
                )
                ColorPrint.blue(f"[LoginTryScreenshotController] Clicking Play at fixed position screen ({play_x}, {play_y})")
                clicker.click(play_x, play_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)

            # After Play: wait 5 sec for D3 to stabilize, then poll for D3 window; when found, wait Start Game + Game tool then k ROSBOT and start ROSBOT
            time.sleep(5)
            _poll_sec = 10
            already_restarted = False
            for _ in range(_poll_sec):
                time.sleep(1)
                windows = WindowFinder.find_windows_by_titles(
                    titles=DIABLO_III_WINDOW_TITLES,
                    match_mode="in",
                    use_cache=True,
                )
                if windows:
                    get_game_interface_data().set_d3_status(True)
                    resize_window_by_titles_to_client_size(
                        DIABLO_III_WINDOW_TITLES,
                        STANDARD_RESOLUTION_WIDTH,
                        STANDARD_RESOLUTION_HEIGHT,
                    )
                    WindowFinder.invalidate_window_cache(list(DIABLO_III_WINDOW_TITLES))
                    start_game_ok = wait_for_and_click_start_game(
                        interval_sec=2.0,
                        wait_after_click_sec=2.0,
                    )
                    if not start_game_ok:
                        self._restart_battlenet_and_retry_from_step1(bn_path)
                        already_restarted = True
                        break
                    ColorPrint.blue("[LoginTryScreenshotController] D3 window found, k ROSBOT then start ROSBOT")
                    get_rosbot_manager().kill_if_running()
                    time.sleep(1)
                    if CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True):
                        if get_rosbot_manager().start():
                            start_rosbot_task()
                            run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
                    return True
            if not already_restarted:
                self._restart_battlenet_and_retry_from_step1(bn_path)
            continue

        ColorPrint.yellow("[LoginTryScreenshotController] Exhausted outer retries; step 1 did not complete")
        return False

    def capture_screenshot(self) -> Optional[Dict[str, Path]]:
        """
        Capture full-screen screenshot and save to login_try_screenshots dir.

        Returns:
            Dict with fullscreen_path and optionally game_window_path, or None on failure.
        """
        try:
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

        except Exception as e:
            ColorPrint.red(f"[LoginTryScreenshotController] Error: {e}")
            return None


_login_try_controller: Optional[LoginTryScreenshotController] = None


def get_login_try_screenshot_controller() -> LoginTryScreenshotController:
    """Get global LoginTryScreenshotController instance (singleton)."""
    global _login_try_controller
    if _login_try_controller is None:
        _login_try_controller = LoginTryScreenshotController()
    return _login_try_controller

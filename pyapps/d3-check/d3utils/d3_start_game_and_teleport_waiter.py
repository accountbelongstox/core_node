# -*- coding: utf-8 -*-
"""
D3 start game and teleport flow.
  State 1 = full game flow. From Battle.net small map, click Play, sleep(5), poll D3, resize, then wait_for_and_click_start_game (internally wait_for_game_tool_then_send_m_and_click), or continue from mid-flow.
  State 2/3 = detect client disconnect (same flow). After confirming still online, resume state 1 from mid-flow.
  Common final step for all paths: M opens map; verify with two rounds of (press M once, detect bounty progress); then three teleport clicks. Implemented by open_map_verify_bounty_then_teleport_three_clicks(), called by state 1/2/3.
"""
import time
from typing import Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyutils.window_activator import WindowActivator
from providor.app_constants import STANDARD_RESOLUTION_WIDTH, STANDARD_RESOLUTION_HEIGHT
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.window_ops import send_key as window_send_key
from share.game_interface_data import calculate_unified_scaled_coordinate, get_game_interface_data
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from d3utils.d3u_common.image_annotator_helper import save_click_debug_image
from config.screenshot_categories import MATCH_DEBUG_DIR
from providor.app_constants import (
    D3_START_GAME_BUTTON_TEMPLATE_NAME,
    D3_GAME_TOOL_TEMPLATE_NAME,
    D3_BOUNTY_PROGRESS_TEMPLATE_NAME,
    D3_GAME_TOOL_CLICK_STANDARD,
    D3_GAME_TOOL_CLICK_SECOND,
    D3_GAME_TOOL_CLICK_THIRD,
    D3_GAME_TOOL_AFTER_M_DELAY_SEC,
    D3_START_GAME_WAIT_INTERVAL_SEC,
    D3_START_GAME_MAX_ATTEMPTS,
    D3_GAME_TOOL_MAX_ATTEMPTS,
    D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS,
    D3_FRAGMENT2_DISAPPEAR_ATTEMPTS,
    D3_ONLINE_SIMILARITY_THRESHOLD,
    D3_ONLINE_SIMILARITY_RESIZE,
    CLICK_MOVE_DURATION_SEC,
    CLICK_PAUSE_AFTER_MOVE_SEC,
    VK_M,
    ACTIVATE_BEFORE_CAPTURE_DELAY_SEC,
)
from d3utils.d3u_common.image_conversion import normalize_image_to_bgr
from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_cv2


def _do_teleport_three_clicks(
    provider,
    titles: Tuple[str, ...],
    window_offset: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
) -> bool:
    """Execute the three teleport clicks: first = dropdown 7 (D3_GAME_TOOL_CLICK_STANDARD), then (749,421), (715,608) with moment debug images. Returns True."""
    standard_resolution = (STANDARD_RESOLUTION_WIDTH, STANDARD_RESOLUTION_HEIGHT)
    clicker = ClickHandler()
    coord_std = D3_GAME_TOOL_CLICK_STANDARD
    scaled = calculate_unified_scaled_coordinate(
        coord_std, game_window_size, standard_resolution, is_windowed,
    )
    sx, sy = int(scaled[0]), int(scaled[1])
    screen_x = window_offset[0] + sx
    screen_y = window_offset[1] + sy
    screenshot_data_1 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if screenshot_data_1 and screenshot_data_1.game_window_image:
        save_click_debug_image(
            screenshot_data_1.game_window_image,
            [(sx, sy, "1")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_click_1",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter] Click 1 at standard {coord_std} -> scaled ({sx},{sy}) screen ({screen_x},{screen_y})"
    )
    clicker.click(screen_x, screen_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    time.sleep(1)
    scaled2 = calculate_unified_scaled_coordinate(
        D3_GAME_TOOL_CLICK_SECOND, game_window_size, standard_resolution, is_windowed,
    )
    sx2, sy2 = int(scaled2[0]), int(scaled2[1])
    screen_x2 = window_offset[0] + sx2
    screen_y2 = window_offset[1] + sy2
    screenshot_data_2 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if screenshot_data_2 and screenshot_data_2.game_window_image:
        save_click_debug_image(
            screenshot_data_2.game_window_image,
            [(sx2, sy2, "2")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_click_2",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter] Click 2 at scaled ({sx2},{sy2}) screen ({screen_x2},{screen_y2})"
    )
    clicker.click(screen_x2, screen_y2, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    scaled3 = calculate_unified_scaled_coordinate(
        D3_GAME_TOOL_CLICK_THIRD, game_window_size, standard_resolution, is_windowed,
    )
    sx3, sy3 = int(scaled3[0]), int(scaled3[1])
    screen_x3 = window_offset[0] + sx3
    screen_y3 = window_offset[1] + sy3
    screenshot_data_3 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if screenshot_data_3 and screenshot_data_3.game_window_image:
        save_click_debug_image(
            screenshot_data_3.game_window_image,
            [(sx3, sy3, "3")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_click_3",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter] Click 3 at scaled ({sx3},{sy3}) screen ({screen_x3},{screen_y3})"
    )
    clicker.click(screen_x3, screen_y3, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    ColorPrint.green("[D3StartGameWaiter] Teleport done, starting ROSBOT flow")
    return True


def _activate_d3_window(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """Bring D3 window to front before capture. Returns True if activated."""
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    windows = WindowFinder.find_windows_by_titles(
        titles=list(titles),
        match_mode="in",
        use_cache=False,
    )
    if not windows or not windows[0].get("hwnd"):
        return False
    hwnd = windows[0]["hwnd"]
    WindowActivator().activate_window_by_handle(hwnd)
    time.sleep(ACTIVATE_BEFORE_CAPTURE_DELAY_SEC)
    return True


def _capture_and_match_start_game_button(provider, matcher, titles: Tuple[str, ...]):
    """Activate D3, capture, match d3_start_game_button. Returns (screenshot_data, (cx,cy)) or (None, None)."""
    _activate_d3_window(window_titles=titles)
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd or not sd.game_window_image:
        return None, None
    r = matcher.match_template(
        target_image=sd.game_window_image,
        template_name=D3_START_GAME_BUTTON_TEMPLATE_NAME,
        output_dir=None,
    )
    if not r or r.get("total_matches", 0) < 1:
        return sd, None
    matches = r.get("matches", [])
    if not matches:
        return sd, None
    center = matches[0].get("center")
    if center is None:
        return sd, None
    cx, cy = int(center[0]), int(center[1])
    return sd, (cx, cy)


def _capture_and_match_game_tool(provider, matcher, titles: Tuple[str, ...]):
    """Activate D3, capture, match d3_game_tool. Returns (screenshot_data, found: bool)."""
    _activate_d3_window(window_titles=titles)
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd or not sd.game_window_image:
        return None, False
    r = matcher.match_template(
        target_image=sd.game_window_image,
        template_name=D3_GAME_TOOL_TEMPLATE_NAME,
        output_dir=None,
    )
    found = bool(r and r.get("total_matches", 0) >= 1)
    return sd, found


def _capture_and_match_bounty_progress(provider, matcher, titles: Tuple[str, ...]):
    """Activate D3, capture, match d3_bounty_progress (bounty progress UI). Returns (screenshot_data, found: bool). Differentiated from game_tool."""
    _activate_d3_window(window_titles=titles)
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd or not sd.game_window_image:
        return None, False
    r = matcher.match_template(
        target_image=sd.game_window_image,
        template_name=D3_BOUNTY_PROGRESS_TEMPLATE_NAME,
        output_dir=None,
    )
    found = bool(r and r.get("total_matches", 0) >= 1)
    return sd, found


def detect_d3_already_running_state(window_titles: Optional[Tuple[str, ...]] = None) -> Optional[str]:
    """
    [C3] Detect current D3 UI state (start screen = scale match d3_start_game_button). Online convention applies.
    [C4] Result: start / game_tool / other or none.
    Returns:
        "start" = start screen; caller runs fragment1 (C5).
        "game_tool" = d3_game_tool present; caller runs fragment2 (C9).
        None = other/none; caller should kill D3 and fall to D (C12).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    _activate_d3_window(window_titles=titles)
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd or not sd.game_window_image:
        return None
    r_start = matcher.match_template(
        target_image=sd.game_window_image,
        template_name=D3_START_GAME_BUTTON_TEMPLATE_NAME,
        output_dir=None,
    )
    has_start = bool(r_start and r_start.get("total_matches", 0) >= 1)
    r_tool = matcher.match_template(
        target_image=sd.game_window_image,
        template_name=D3_GAME_TOOL_TEMPLATE_NAME,
        output_dir=None,
    )
    has_game_tool = bool(r_tool and r_tool.get("total_matches", 0) >= 1)
    if has_start:
        return "start"
    if has_game_tool:
        return "game_tool"
    return None


def _image_similarity_0_1(img_a, img_b) -> float:
    """Compare two PIL/numpy images: resize to D3_ONLINE_SIMILARITY_RESIZE, grayscale, return 1 - mean_abs_diff/255 (1 = identical)."""
    np_mod = get_third_package_numpy()
    if np_mod is None:
        return 0.0
    try:
        bgr_a = normalize_image_to_bgr(img_a)
        bgr_b = normalize_image_to_bgr(img_b)
        cv2 = get_third_package_cv2()
        if cv2 is None:
            return 0.0
        gray_a = cv2.cvtColor(cv2.resize(bgr_a, D3_ONLINE_SIMILARITY_RESIZE), cv2.COLOR_BGR2GRAY)
        gray_b = cv2.cvtColor(cv2.resize(bgr_b, D3_ONLINE_SIMILARITY_RESIZE), cv2.COLOR_BGR2GRAY)
        diff = np_mod.mean(np_mod.abs(gray_a.astype(np_mod.float32) - gray_b.astype(np_mod.float32)))
        return 1.0 - min(diff / 255.0, 1.0)
    except Exception:
        return 0.0


def check_d3_online_by_m_similarity(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    [A5] D3 online check (ROSBOT_FLOW_MERMAID.md): only when d3_game_tool is present.
    Five steps: 1. Screenshot A 2. Press M 3. Screenshot B 4. Compare similarity (high = disconnected) 5. Press M again to restore.
    Returns True if online (M had effect), False if disconnected (high similarity = M had no effect).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    _activate_d3_window(window_titles=titles)
    sd_a = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd_a or not sd_a.game_window_image:
        return False
    img_a = sd_a.game_window_image
    windows = WindowFinder.find_windows_by_titles(titles=list(titles), match_mode="in", use_cache=False)
    if not windows or not windows[0].get("hwnd"):
        return False
    hwnd = windows[0]["hwnd"]
    window_send_key(hwnd, VK_M, press=True)
    time.sleep(0.05)
    window_send_key(hwnd, VK_M, press=False)
    time.sleep(D3_GAME_TOOL_AFTER_M_DELAY_SEC)
    sd_b = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd_b or not sd_b.game_window_image:
        window_send_key(hwnd, VK_M, press=True)
        time.sleep(0.05)
        window_send_key(hwnd, VK_M, press=False)
        return False
    img_b = sd_b.game_window_image
    sim = _image_similarity_0_1(img_a, img_b)
    window_send_key(hwnd, VK_M, press=True)
    time.sleep(0.05)
    window_send_key(hwnd, VK_M, press=False)
    if sim >= D3_ONLINE_SIMILARITY_THRESHOLD:
        ColorPrint.yellow(f"[D3StartGameWaiter][A5] D3 online check: similarity={sim:.3f} >= {D3_ONLINE_SIMILARITY_THRESHOLD}, disconnected")
        return False
    ColorPrint.green(f"[D3StartGameWaiter][A5] D3 online check: similarity={sim:.3f}, online")
    return True


def send_m_then_teleport_three_clicks(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    State-2 tail: call common final step (open map with M, two rounds verify bounty progress, then three clicks).
    Call after try_fragment1 returns True (game_tool already visible).
    """
    return open_map_verify_bounty_then_teleport_three_clicks(window_titles=window_titles)


def wait_for_game_tool_then_send_m_and_click(
    interval_sec: float = D3_START_GAME_WAIT_INTERVAL_SEC,
    max_attempts: Optional[int] = None,
    window_titles: Optional[Tuple[str, ...]] = None,
    click_standard: Optional[Tuple[int, int]] = None,
) -> bool:
    """
    After Start Game click: poll D3 window every interval_sec until "Game tool" template is found (SIFT).
    Then send M key to D3 window, scale click_standard (default 602,94) by base 1300x800 to actual window,
    and click at that screen position.

    Args:
        interval_sec: Seconds between screenshot + match attempts (default from constants).
        max_attempts: Stop after this many attempts (default D3_GAME_TOOL_MAX_ATTEMPTS); timeout = max_attempts * interval_sec.
        window_titles: Window title list for D3 (default DIABLO_III_WINDOW_TITLES).
        click_standard: (x, y) at standard 1300x800 to click after M key (default D3_GAME_TOOL_CLICK_STANDARD).

    Returns:
        True if game tool was found and M + click performed; False on timeout.
    """
    n = max_attempts if max_attempts is not None else D3_GAME_TOOL_MAX_ATTEMPTS
    timeout_sec = n * interval_sec
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    coord_std = click_standard or D3_GAME_TOOL_CLICK_STANDARD
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    clicker = ClickHandler()
    standard_resolution = (STANDARD_RESOLUTION_WIDTH, STANDARD_RESOLUTION_HEIGHT)
    deadline = time.monotonic() + timeout_sec
    attempt = 0

    while time.monotonic() < deadline:
        attempt += 1
        try:
            screenshot_data, found = _capture_and_match_game_tool(provider, matcher, titles)
            if not screenshot_data:
                ColorPrint.gray(
                    f"[D3StartGameWaiter] Game tool attempt {attempt}: no D3 window image, retry in {interval_sec}s"
                )
                time.sleep(interval_sec)
                continue
            if not found:
                time.sleep(interval_sec)
                continue

            ColorPrint.green("[D3StartGameWaiter] Game tool (d3_game_tool) found; common final step: open map (M), verify bounty, then three clicks")
            if open_map_verify_bounty_then_teleport_three_clicks(window_titles=titles):
                return True
            time.sleep(interval_sec)

        except Exception as e:
            ColorPrint.yellow(f"[D3StartGameWaiter] Game tool attempt {attempt} error: {e}")
            time.sleep(interval_sec)

    ColorPrint.yellow(
        f"[D3StartGameWaiter] Game tool timeout after {timeout_sec}s ({attempt} attempts); no M+click"
    )
    return False


def try_fragment1_click_start_game_wait_game_tool(
    interval_sec: float = D3_START_GAME_WAIT_INTERVAL_SEC,
    max_wait_game_tool_attempts: int = D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS,
    window_titles: Optional[Tuple[str, ...]] = None,
) -> Optional[bool]:
    """
    [C5] Fragment 1: if d3_start_game_button (scale match) -> click; every 2s screenshot for d3_game_tool, max 5x2s.
    [C6] d3_game_tool present? [C7] Only then press M; after M wait 2s, teleport three clicks. [C8] Result?
    Returns True if game_tool appeared; False if start clicked but game_tool timeout (caller should close D3 → C12);
    None if start button not found (caller should try fragment 2).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    clicker = ClickHandler()
    screenshot_data, center = _capture_and_match_start_game_button(provider, matcher, titles)
    if center is None:
        return None
    cx, cy = center
    window_offset = screenshot_data.window_offset or (0, 0) if screenshot_data else (0, 0)
    screen_x = window_offset[0] + cx
    screen_y = window_offset[1] + cy
    ColorPrint.green(
        f"[D3StartGameWaiter][Fragment1] Found d3_start_game_button at ({cx},{cy}); clicking then waiting 5x{interval_sec}s for d3_game_tool"
    )
    clicker.click(screen_x, screen_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    deadline = time.monotonic() + max_wait_game_tool_attempts * interval_sec
    while time.monotonic() < deadline:
        time.sleep(interval_sec)
        _, found = _capture_and_match_game_tool(provider, matcher, titles)
        if found:
            ColorPrint.green("[D3StartGameWaiter][Fragment1] d3_game_tool appeared after Start Game click")
            return True
    ColorPrint.yellow("[D3StartGameWaiter][Fragment1] d3_game_tool did not appear within 5x2s; caller should close D3")
    return False


def _send_m_twice(titles: Tuple[str, ...]) -> None:
    """Send M key twice to D3 window. Reused by Fragment2 only."""
    windows = WindowFinder.find_windows_by_titles(
        titles=list(titles),
        match_mode="in",
        use_cache=False,
    )
    if not windows or not windows[0].get("hwnd"):
        return
    hwnd = windows[0]["hwnd"]
    for _ in range(2):
        window_send_key(hwnd, VK_M, press=True)
        time.sleep(0.05)
        window_send_key(hwnd, VK_M, press=False)
        time.sleep(0.2)


def _send_m_once_then_wait_for_capture(titles: Tuple[str, ...]) -> None:
    """Send M key once to D3 window, then wait D3_GAME_TOOL_AFTER_M_DELAY_SEC so map opens before screenshot. Before each capture: press M once, wait 2s, then capture."""
    windows = WindowFinder.find_windows_by_titles(
        titles=list(titles),
        match_mode="in",
        use_cache=False,
    )
    if not windows or not windows[0].get("hwnd"):
        return
    hwnd = windows[0]["hwnd"]
    window_send_key(hwnd, VK_M, press=True)
    time.sleep(0.05)
    window_send_key(hwnd, VK_M, press=False)
    time.sleep(D3_GAME_TOOL_AFTER_M_DELAY_SEC)


def open_map_verify_bounty_then_teleport_three_clicks(
    window_titles: Optional[Tuple[str, ...]] = None,
) -> bool:
    """
    Common final step for all 3 flows (independent of what came before).
    M opens the map. Two rounds: press M once, wait 2s, detect bounty progress.
    If either round finds bounty progress = map toggle is open, then three clicks.
    Returns True if bounty found and three clicks done; False otherwise.
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    ColorPrint.green("[D3StartGameWaiter] Common final step: open map (M), two rounds verify bounty progress, then three clicks")
    _send_m_once_then_wait_for_capture(titles)
    sd1, bounty1 = _capture_and_match_bounty_progress(provider, matcher, titles)
    _send_m_once_then_wait_for_capture(titles)
    sd2, bounty2 = _capture_and_match_bounty_progress(provider, matcher, titles)
    if not (bounty1 or bounty2):
        ColorPrint.yellow("[D3StartGameWaiter] Common final step: bounty progress not found in both rounds; map may not be open")
        return False
    sd = sd1 if sd1 else sd2
    if not sd or not sd.game_window_image:
        return False
    # [C7/C11] After M wait 2s, then run teleport three clicks (ROSBOT_FLOW_MERMAID.md)
    time.sleep(D3_START_GAME_WAIT_INTERVAL_SEC)
    window_offset = sd.window_offset or (0, 0)
    game_window_size = sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height)
    shared_data = get_game_interface_data()
    is_windowed = shared_data.is_windowed_mode()
    _do_teleport_three_clicks(provider, titles, window_offset, game_window_size, is_windowed)
    return True


def try_fragment2_game_tool_press_m_then_clicks(
    interval_sec: float = D3_START_GAME_WAIT_INTERVAL_SEC,
    max_disappear_attempts: int = D3_FRAGMENT2_DISAPPEAR_ATTEMPTS,
    window_titles: Optional[Tuple[str, ...]] = None,
) -> bool:
    """
    [C9] Fragment 2: only when d3_game_tool present press M; press M twice; two screenshots to detect bounty progress.
    [C10] Neither has bounty progress? -> end D3 (C12). [C11] Wait 2s then teleport three clicks.
    Returns False if game_tool not found, or both captures lack bounty progress (caller should close D3 → C12).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    _, found = _capture_and_match_game_tool(provider, matcher, titles)
    if not found:
        return False
    ColorPrint.green("[D3StartGameWaiter][Fragment2] d3_game_tool found; common final step: open map (M), verify bounty, then three clicks")
    return open_map_verify_bounty_then_teleport_three_clicks(window_titles=titles)


def wait_for_and_click_start_game(
    interval_sec: float = D3_START_GAME_WAIT_INTERVAL_SEC,
    max_attempts_start: Optional[int] = None,
    max_attempts_game_tool: Optional[int] = None,
    wait_after_click_sec: float = 2.0,
    window_titles: Optional[Tuple[str, ...]] = None,
) -> bool:
    """
    Wait mode: poll D3 every interval_sec. First find d3_start_game_button, click it, wait; then find d3_game_tool, M+click.
    Each phase uses max_attempts (default 10); if either phase fails (10 * interval_sec), return False so caller can restart and retry from step 1.

    Args:
        interval_sec: Seconds between screenshot + match attempts (default from constants).
        max_attempts_start: Max attempts for Start Game (default D3_START_GAME_MAX_ATTEMPTS).
        max_attempts_game_tool: Max attempts for Game tool (default D3_GAME_TOOL_MAX_ATTEMPTS).
        wait_after_click_sec: Seconds to wait after clicking Start Game (default 2).
        window_titles: Window title list for D3 (default DIABLO_III_WINDOW_TITLES).

    Returns:
        True if both Start Game and Game tool were found and actions done; False on timeout (caller should restart and retry from step 1).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    n_start = max_attempts_start if max_attempts_start is not None else D3_START_GAME_MAX_ATTEMPTS
    timeout_start = n_start * interval_sec
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    clicker = ClickHandler()
    deadline = time.monotonic() + timeout_start
    attempt = 0

    while time.monotonic() < deadline:
        attempt += 1
        try:
            screenshot_data, center = _capture_and_match_start_game_button(provider, matcher, titles)
            if not screenshot_data:
                ColorPrint.gray(
                    f"[D3StartGameWaiter] Attempt {attempt}: no D3 window image, retry in {interval_sec}s"
                )
                time.sleep(interval_sec)
                continue
            if center is None:
                time.sleep(interval_sec)
                continue

            cx, cy = center
            window_offset = screenshot_data.window_offset or (0, 0)
            screen_x = window_offset[0] + cx
            screen_y = window_offset[1] + cy
            ColorPrint.green(
                f"[D3StartGameWaiter] Found Start Game at image ({cx}, {cy}), screen ({screen_x}, {screen_y}); clicking"
            )
            clicker.click(screen_x, screen_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(wait_after_click_sec)
            ColorPrint.green("[D3StartGameWaiter] Clicked Start Game, waited {}s; waiting for Game tool...".format(wait_after_click_sec))
            game_tool_ok = wait_for_game_tool_then_send_m_and_click(
                interval_sec=interval_sec,
                max_attempts=max_attempts_game_tool,
                window_titles=window_titles,
            )
            return game_tool_ok

        except Exception as e:
            ColorPrint.yellow(f"[D3StartGameWaiter] Attempt {attempt} error: {e}")
            time.sleep(interval_sec)

    ColorPrint.yellow(f"[D3StartGameWaiter] Timeout after {timeout_start}s ({attempt} attempts); no Start Game click")
    return False

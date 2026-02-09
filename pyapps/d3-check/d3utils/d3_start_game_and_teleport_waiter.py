# -*- coding: utf-8 -*-
"""
D3 start game and teleport flow. ROSBOT_FLOW_MERMAID.md.
C branch: C6 -> C10_Check (screenshot, M, screenshot, similarity) -> C10_Result -> C7a (M again) -> C7w (2s) -> C7b (minimize 751,413 + teleport 610,126) -> C8.
Fragment1 (start): C5/C5w then C10+C7a/C7w/C7b. Fragment2 (game_tool): C10 done in run_c4_branch_result, then C7a/C7w/C7b.
"""
import time
from typing import Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyutils.window_activator import WindowActivator
from providor.constants.d3 import D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.window_ops import send_key as window_send_key
from share.game_interface_data import calculate_unified_scaled_coordinate, get_game_interface_data
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from d3utils.d3u_common.image_annotator_helper import save_click_debug_image
from config.screenshot_categories import MATCH_DEBUG_DIR
from providor.constants.common import (
    CLICK_MOVE_DURATION_SEC,
    CLICK_PAUSE_AFTER_MOVE_SEC,
    VK_M,
    ACTIVATE_BEFORE_CAPTURE_DELAY_SEC,
)
from providor.constants.d3 import (
    D3_START_GAME_BUTTON_TEMPLATE_NAME,
    D3_GAME_TOOL_TEMPLATE_NAME,
    D3_BOUNTY_PROGRESS_TEMPLATE_NAME,
    D3_DISCONNECTED_TEMPLATE_NAME,
    D3_CONNECTING_TEMPLATE_NAME,
    D3_CONNECTING_ALT_TEMPLATE_NAME,
    D3_MAP_MINIMIZE_CLICK,
    D3_TELEPORT_CLICK,
    D3_GAME_TOOL_AFTER_M_DELAY_SEC,
    D3_START_GAME_WAIT_INTERVAL_SEC,
    D3_START_GAME_MAX_ATTEMPTS,
    D3_GAME_TOOL_MAX_ATTEMPTS,
    D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS,
    D3_FRAGMENT2_DISAPPEAR_ATTEMPTS,
    D3_ONLINE_SIMILARITY_THRESHOLD,
    D3_ONLINE_SIMILARITY_RESIZE,
)
from d3utils.d3u_common.image_conversion import normalize_image_to_bgr
from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_cv2


def step_c7b_minimize_only(
    provider,
    titles: Tuple[str, ...],
    window_offset: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
) -> bool:
    """[C7b] One tick: minimize map click (751,413) only. Call step_c7b_teleport_only on next tick. No sleep."""
    standard_resolution = (D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT)
    clicker = ClickHandler()
    scaled1 = calculate_unified_scaled_coordinate(
        D3_MAP_MINIMIZE_CLICK, game_window_size, standard_resolution, is_windowed,
    )
    sx1, sy1 = int(scaled1[0]), int(scaled1[1])
    screen_x1 = window_offset[0] + sx1
    screen_y1 = window_offset[1] + sy1
    sd1 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if sd1 and sd1.game_window_image:
        save_click_debug_image(
            sd1.game_window_image,
            [(sx1, sy1, "minimize")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_minimize",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter][C7b] Minimize map click {D3_MAP_MINIMIZE_CLICK} -> ({sx1},{sy1}) screen ({screen_x1},{screen_y1})"
    )
    clicker.click(screen_x1, screen_y1, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    return True


def step_c7b_teleport_only(
    provider,
    titles: Tuple[str, ...],
    window_offset: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
) -> bool:
    """[C7b] One tick: teleport click (610,126) only. Call after step_c7b_minimize_only and one tick wait. No sleep."""
    standard_resolution = (D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT)
    clicker = ClickHandler()
    scaled2 = calculate_unified_scaled_coordinate(
        D3_TELEPORT_CLICK, game_window_size, standard_resolution, is_windowed,
    )
    sx2, sy2 = int(scaled2[0]), int(scaled2[1])
    screen_x2 = window_offset[0] + sx2
    screen_y2 = window_offset[1] + sy2
    sd2 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if sd2 and sd2.game_window_image:
        save_click_debug_image(
            sd2.game_window_image,
            [(sx2, sy2, "teleport")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_click",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter][C7b] Teleport click {D3_TELEPORT_CLICK} -> ({sx2},{sy2}) screen ({screen_x2},{screen_y2})"
    )
    clicker.click(screen_x2, screen_y2, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    ColorPrint.green("[D3StartGameWaiter][C7b] Teleport done, starting ROSBOT flow")
    return True


def _do_c7b_teleport(
    provider,
    titles: Tuple[str, ...],
    window_offset: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
) -> bool:
    """[C7b] Teleport: minimize then teleport. For tick-driven flow use step_c7b_minimize_only (tick N), next tick step_c7b_teleport_only (tick N+1). This helper runs both in one call with no wait (legacy/callback path)."""
    if not step_c7b_minimize_only(provider, titles, window_offset, game_window_size, is_windowed):
        return False
    return step_c7b_teleport_only(provider, titles, window_offset, game_window_size, is_windowed)


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


def click_start_game_button_if_found(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    If d3_start_game_button is found on screen, click it and return True; else return False.
    Used in C3 loop: Start Game may be stuck; each time start is detected, click and caller resets 1min timer.
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    clicker = ClickHandler()
    screenshot_data, center = _capture_and_match_start_game_button(provider, matcher, titles)
    if center is None:
        return False
    cx, cy = center
    window_offset = screenshot_data.window_offset or (0, 0) if screenshot_data else (0, 0)
    screen_x = window_offset[0] + cx
    screen_y = window_offset[1] + cy
    ColorPrint.blue("[D3StartGameWaiter] C3 loop: d3_start_game_button found, clicking (start may be stuck), caller resets 1min")
    clicker.click(screen_x, screen_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    return True


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


def _match_one(matcher, target_image, template_name: str) -> bool:
    """Match one template; returns True if at least one match."""
    r = matcher.match_template(
        target_image=target_image,
        template_name=template_name,
        output_dir=None,
    )
    return bool(r and r.get("total_matches", 0) >= 1)


def capture_and_detect_all_d3_states(
    window_titles: Optional[Tuple[str, ...]] = None,
):
    """
    Reusable: one D3 window capture -> detect all UI states (disconnected/start_game_button/game_tool/connecting).
    Used by [C3] detect_d3_already_running_state and by D3StatusProvider._detect_d3_dynamic.
    Returns: (screenshot_data_or_none, state_dict).
    state_dict keys: disconnected, start_game_button, game_tool, connecting (all bool).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    _activate_d3_window(window_titles=titles)
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    default_states = {"disconnected": False, "start_game_button": False, "game_tool": False, "connecting": False}
    if not sd or not sd.game_window_image:
        return (sd, default_states)
    state_dict = matcher.match_all_d3_states(sd.game_window_image)
    return (sd, state_dict)


def detect_d3_already_running_state(window_titles: Optional[Tuple[str, ...]] = None) -> Optional[str]:
    """
    [C3] Screenshot and template match in one step (ROSBOT_FLOW_MERMAID.md).
    One capture -> match all templates (reuse match_all_d3_states): disconnected/start/game_tool/connecting.
    Priority: disconnected -> start -> game_tool -> connecting -> None.
    Returns: "disconnect"(->F1d) | "start"(->C5) | "game_tool"(->C6) | "wait"(->C3w_Wait) | None (no-match).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    _sd, states = capture_and_detect_all_d3_states(window_titles=titles)
    if not states:
        return None
    if states.get("disconnected"):
        return "disconnect"
    if states.get("start_game_button"):
        return "start"
    if states.get("game_tool"):
        return "game_tool"
    if states.get("connecting"):
        return "wait"
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
    except (TypeError, ValueError, AttributeError):
        return 0.0


# For tick-driven C10: step_c10_send_m stores img_a here; step_c10_compare reads it (no thread, same flow)
_c10_img_a = None


def step_c10_send_m(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C10a] One tick: capture before, send M (down+up). No wait; call step_c10_compare on next tick. Returns True if img_a stored."""
    global _c10_img_a
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    _activate_d3_window(window_titles=titles)
    sd_a = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd_a or not sd_a.game_window_image:
        return False
    _c10_img_a = sd_a.game_window_image
    windows = WindowFinder.find_windows_by_titles(titles=list(titles), match_mode="in", use_cache=False)
    if not windows or not windows[0].get("hwnd"):
        return False
    hwnd = windows[0]["hwnd"]
    window_send_key(hwnd, VK_M, press=True)
    time.sleep(0.05)
    window_send_key(hwnd, VK_M, press=False)
    return True


def step_c10_compare(window_titles: Optional[Tuple[str, ...]] = None) -> Optional[bool]:
    """[C10b] One tick: capture after M, compare with img_a from step_c10_send_m. Returns True=online, False=disconnect, None=error."""
    global _c10_img_a
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    if _c10_img_a is None:
        return None
    provider = get_screenshot_provider()
    sd_b = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd_b or not sd_b.game_window_image:
        return None
    img_b = sd_b.game_window_image
    sim = _image_similarity_0_1(_c10_img_a, img_b)
    _c10_img_a = None
    if sim >= D3_ONLINE_SIMILARITY_THRESHOLD:
        ColorPrint.yellow(f"[D3StartGameWaiter][C10b] Similarity={sim:.3f} >= threshold, M no effect, disconnected")
        return False
    ColorPrint.green(f"[D3StartGameWaiter][C10b] Similarity={sim:.3f}, online")
    return True


def check_d3_online_by_m_similarity(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    [C10a] Screenshot (before) -> Send M -> Screenshot (after) -> Compare similarity. [C10b] High similarity = M no effect = disconnect.
    ROSBOT_FLOW_MERMAID.md. Returns True if online, False if disconnected. (Blocking; for tick-driven flow use step_c10_send_m then next tick step_c10_compare.)
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    if not step_c10_send_m(window_titles=titles):
        return False
    time.sleep(D3_GAME_TOOL_AFTER_M_DELAY_SEC)
    result = step_c10_compare(window_titles=titles)
    return result is True


def step_c7a_send_m(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C7a] One tick: press M again to reset map. No wait; next tick do C7b. Returns True if M sent."""
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    windows = WindowFinder.find_windows_by_titles(titles=list(titles), match_mode="in", use_cache=False)
    if not windows or not windows[0].get("hwnd"):
        return False
    hwnd = windows[0]["hwnd"]
    window_send_key(hwnd, VK_M, press=True)
    time.sleep(0.05)
    window_send_key(hwnd, VK_M, press=False)
    return True


def _run_c7a_c7w_c7b(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C7a] Press M again to reset map. [C7w] Wait 2s. [C7b] Minimize map (751,413), teleport (610,126). ROSBOT_FLOW_MERMAID.md. (Blocking; for tick-driven flow use step_c7a_send_m then next tick step_c7b_*.)"""
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    if not step_c7a_send_m(window_titles=titles):
        return False
    time.sleep(D3_GAME_TOOL_AFTER_M_DELAY_SEC)
    provider = get_screenshot_provider()
    sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if not sd or not sd.game_window_image:
        return False
    window_offset = sd.window_offset or (0, 0)
    game_window_size = sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height)
    shared_data = get_game_interface_data()
    is_windowed = shared_data.is_windowed_mode()
    return _do_c7b_teleport(provider, titles, window_offset, game_window_size, is_windowed)


def send_m_then_teleport_three_clicks(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    After fragment1 (game_tool appeared): [C10a/C10b] similarity check then [C7a] M, [C7w] 2s, [C7b] minimize+teleport.
    ROSBOT_FLOW_MERMAID.md: C6 -> C10_Check -> C10_Result -> C7a -> C7w -> C7b -> C8.
    """
    if not check_d3_online_by_m_similarity(window_titles=window_titles):
        return False
    return _run_c7a_c7w_c7b(window_titles=window_titles)


def wait_for_game_tool_then_send_m_and_click(
    interval_sec: float = D3_START_GAME_WAIT_INTERVAL_SEC,
    max_attempts: Optional[int] = None,
    window_titles: Optional[Tuple[str, ...]] = None,
    click_standard: Optional[Tuple[int, int]] = None,
) -> bool:
    """
    After Start Game click: [C5w] one screenshot per cycle, match all (start/game_tool/disconnected/connecting) on same
    image; game_tool -> C10 + C7a/C7w/C7b; disconnect -> False; else wait. click_standard unused (C7b uses constants).
    """
    n = max_attempts if max_attempts is not None else D3_GAME_TOOL_MAX_ATTEMPTS
    timeout_sec = n * interval_sec
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    deadline = time.monotonic() + timeout_sec
    attempt = 0

    while time.monotonic() < deadline:
        attempt += 1
        state = detect_d3_already_running_state(window_titles=titles)
        if state == "game_tool":
            ColorPrint.green("[D3StartGameWaiter] Game tool found; C10 then C7a/C7w/C7b (ROSBOT_FLOW_MERMAID.md)")
            if send_m_then_teleport_three_clicks(window_titles=titles):
                return True
        elif state == "disconnect":
            ColorPrint.yellow("[D3StartGameWaiter] d3_disconnected during game_tool wait -> return False")
            return False
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
    [C5] Fragment 1: if d3_start_game_button (scale match) -> click; then [C5w] one screenshot per cycle, match all
    (start/game_tool/disconnected/connecting) on same image; game_tool -> C6, disconnect -> False, else wait.
    Returns True if game_tool appeared; False if start clicked but game_tool timeout or disconnect (caller close D3 → C12);
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
    # [C5w] wait until d3_game_tool or timeout (doc: timeout->C12, game_tool->C6)
    deadline = time.monotonic() + max_wait_game_tool_attempts * interval_sec
    while time.monotonic() < deadline:
        time.sleep(interval_sec)
        state = detect_d3_already_running_state(window_titles=titles)
        if state == "game_tool":
            ColorPrint.green("[D3StartGameWaiter][Fragment1] d3_game_tool appeared after Start Game click")
            return True
        if state == "disconnect":
            ColorPrint.yellow("[D3StartGameWaiter][Fragment1] d3_disconnected during C5w -> caller F1d/C12")
            return False
        # start / wait / None -> keep waiting
    ColorPrint.yellow("[D3StartGameWaiter][Fragment1] C5w timeout -> C12")
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
    _do_c7b_teleport(provider, titles, window_offset, game_window_size, is_windowed)
    return True


def try_fragment2_game_tool_press_m_then_clicks(
    interval_sec: float = D3_START_GAME_WAIT_INTERVAL_SEC,
    max_disappear_attempts: int = D3_FRAGMENT2_DISAPPEAR_ATTEMPTS,
    window_titles: Optional[Tuple[str, ...]] = None,
) -> bool:
    """
    [C6] game_tool path. One screenshot, full state (same as C3); if game_tool then C10 already done in run_c4_branch_result,
    [C7a] Press M, [C7w] wait 2s, [C7b] minimize (751,413) + teleport (610,126). Returns False if game_tool not found.
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    state = detect_d3_already_running_state(window_titles=titles)
    if state != "game_tool":
        return False
    ColorPrint.green("[D3StartGameWaiter][Fragment2] d3_game_tool found; C7a/C7w/C7b (C10 already done)")
    return _run_c7a_c7w_c7b(window_titles=titles)


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

    ColorPrint.yellow(f"[D3StartGameWaiter] Timeout after {timeout_start}s ({attempt} attempts); no Start Game click")
    return False

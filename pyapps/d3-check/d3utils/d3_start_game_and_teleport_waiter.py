# -*- coding: utf-8 -*-
"""
D3 start game and teleport flow. ROSBOT_FLOW_MERMAID.md.
C branch: C6 -> C10_Check -> C10_Result -> C7a (M again) -> C7w (2s) -> C7b (minimize + teleport1 large/small map + teleport2 secret camp minimap, 0.5s between clicks) -> C8.
Fragment1 (start): C5/C5w then C10+C7a/C7w/C7b. Fragment2 (game_tool): C10 done in run_c4_branch_result, then C7a/C7w/C7b.
"""
import time
from typing import Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler
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
    D3_TELEPORT_CLICK_2,
    C7B_AFTER_BOUNTY_STABLE_SEC,
    C7B_TELEPORT_CLICK_INTERVAL_SEC,
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

np_mod = get_third_package_numpy()
cv2_mod = get_third_package_cv2()


def step_c7b_minimize_only(
    provider,
    titles: Tuple[str, ...],
    window_offset: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
) -> bool:
    """[C7b] One tick: minimize map click (751,413) only. Call step_c7b_teleport_only on next tick. No sleep."""
    standard_resolution = (D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT)
    clicker = get_click_handler()
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
    """[C7b] Teleport: 1) large/small map D3_TELEPORT_CLICK, 2) secret camp minimap D3_TELEPORT_CLICK_2, interval C7B_TELEPORT_CLICK_INTERVAL_SEC between clicks."""
    standard_resolution = (D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT)
    clicker = get_click_handler()

    # 1) Large/small map
    scaled1 = calculate_unified_scaled_coordinate(
        D3_TELEPORT_CLICK, game_window_size, standard_resolution, is_windowed,
    )
    sx1, sy1 = int(scaled1[0]), int(scaled1[1])
    screen_x1 = window_offset[0] + sx1
    screen_y1 = window_offset[1] + sy1
    sd1 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if sd1 and sd1.game_window_image:
        save_click_debug_image(
            sd1.game_window_image,
            [(sx1, sy1, "teleport1_big_small_map")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_click",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter][C7b] Teleport 1 large/small map {D3_TELEPORT_CLICK} -> ({sx1},{sy1}) screen ({screen_x1},{screen_y1})"
    )
    clicker.click(screen_x1, screen_y1, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    time.sleep(C7B_TELEPORT_CLICK_INTERVAL_SEC)

    # 2) Secret camp minimap
    scaled2 = calculate_unified_scaled_coordinate(
        D3_TELEPORT_CLICK_2, game_window_size, standard_resolution, is_windowed,
    )
    sx2, sy2 = int(scaled2[0]), int(scaled2[1])
    screen_x2 = window_offset[0] + sx2
    screen_y2 = window_offset[1] + sy2
    sd2 = provider.gen(use_optimized_capture=True, window_titles=list(titles))
    if sd2 and sd2.game_window_image:
        save_click_debug_image(
            sd2.game_window_image,
            [(sx2, sy2, "teleport2_camp_small_map")],
            MATCH_DEBUG_DIR,
            filename_prefix="start_game_teleport_click_2",
        )
    ColorPrint.green(
        f"[D3StartGameWaiter][C7b] Teleport 2 secret camp minimap {D3_TELEPORT_CLICK_2} -> ({sx2},{sy2}) screen ({screen_x2},{screen_y2})"
    )
    clicker.click(screen_x2, screen_y2, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
    time.sleep(C7B_TELEPORT_CLICK_INTERVAL_SEC)
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
    clicker = get_click_handler()
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
    Priority: disconnected -> game_tool -> start -> connecting -> None.
    Returns: "disconnect"(->F1d) | "start"(->C5) | "game_tool"(->C6) | "wait"(->C3w_Wait) | None (no-match).
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    _sd, states = capture_and_detect_all_d3_states(window_titles=titles)
    if not states:
        return None
    if states.get("disconnected"):
        return "disconnect"
    if states.get("game_tool"):
        return "game_tool"
    if states.get("start_game_button"):
        return "start"
    if states.get("connecting"):
        return "wait"
    return None


def _image_similarity_0_1(img_a, img_b) -> float:
    """Compare two PIL/numpy images: resize to D3_ONLINE_SIMILARITY_RESIZE, grayscale, return 1 - mean_abs_diff/255 (1 = identical)."""
    if np_mod is None or cv2_mod is None:
        return 0.0
    bgr_a = normalize_image_to_bgr(img_a)
    bgr_b = normalize_image_to_bgr(img_b)
    gray_a = cv2_mod.cvtColor(cv2_mod.resize(bgr_a, D3_ONLINE_SIMILARITY_RESIZE), cv2_mod.COLOR_BGR2GRAY)
    gray_b = cv2_mod.cvtColor(cv2_mod.resize(bgr_b, D3_ONLINE_SIMILARITY_RESIZE), cv2_mod.COLOR_BGR2GRAY)
    diff = np_mod.mean(np_mod.abs(gray_a.astype(np_mod.float32) - gray_b.astype(np_mod.float32)))
    return 1.0 - min(diff / 255.0, 1.0)


# For tick-driven C10: step_c10_send_m stores img_a here; step_c10_compare reads it (no thread, same flow)
_c10_img_a = None


def step_c10_send_m(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C10a] One tick: capture (before) -> send M -> next tick step_c10_compare capture (after) and compare. C10 only tests map response for disconnect; unrelated to C7 map/teleport. Returns True if img_a stored."""
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
    """[C10b] One tick: compare capture (after) with C10a capture (before). High similarity = M no response = disconnect; low = M response = online. Unrelated to C7 teleport. Returns True=online, False=disconnect, None=error."""
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
    thresh = D3_ONLINE_SIMILARITY_THRESHOLD
    _c10_img_a = None
    if sim >= thresh:
        ColorPrint.yellow(
            f"[D3StartGameWaiter][C10b] Disconnect check: similarity={sim:.3f} >= {thresh} -> before/after M almost same -> M no response -> disconnect"
        )
        return False
    ColorPrint.green(
        f"[D3StartGameWaiter][C10b] Disconnect check: similarity={sim:.3f} < {thresh} -> M response -> online (separate from C7 map/teleport)"
    )
    return True


def check_d3_online_by_m_similarity(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    [C10] M 键仅用于测试：截图(前)->发 M->截图(后)->对比。相似高=掉线。与 C7 打开地图传送无关。Blocking；tick 流用 step_c10_send_m + 下一拍 step_c10_compare。
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    if not step_c10_send_m(window_titles=titles):
        return False
    time.sleep(D3_GAME_TOOL_AFTER_M_DELAY_SEC)
    result = step_c10_compare(window_titles=titles)
    return result is True


def step_c7a_send_m(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C7a] One tick: 向游戏发送 M 键（打开/关闭地图）。下一拍做悬赏进度检测或 C7b。与 C10 判掉线为两套逻辑。Returns True if M sent."""
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    windows = WindowFinder.find_windows_by_titles(titles=list(titles), match_mode="in", use_cache=False)
    if not windows or not windows[0].get("hwnd"):
        return False
    hwnd = windows[0]["hwnd"]
    window_send_key(hwnd, VK_M, press=True)
    time.sleep(0.05)
    window_send_key(hwnd, VK_M, press=False)
    return True


def step_c7a_verify_bounty_progress(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C7a 验证] 当前画面是否出现悬赏进度 UI（说明地图已打开）。用于传送前确认地图已开；若未找到可再按一次 M 后重试。Returns True if bounty progress found."""
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    _, found = _capture_and_match_bounty_progress(provider, matcher, titles)
    return found


def _ensure_map_open_then_c7b_teleport(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """
    [C7] 传送前确保地图已打开：最多两轮 M。每轮：按 M -> 等 2s -> 检测悬赏进度。
    若任一轮找到悬赏则地图已开，等稳定后 C7b；两轮都未找到仍尽力执行 C7b（识图可能漏检），
    文档 C7a 无到 C12 分支，不因未找到悬赏而杀 D3。
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    last_sd = None

    # 预检：若地图本就已打开（悬赏进度可见），则不按 M，直接进入稳定等待后 C7b。
    # 目的：避免「第一次地图就打开」时按 M 反而把地图关掉，导致必须第二轮再按回来。
    sd0, bounty0 = _capture_and_match_bounty_progress(provider, matcher, titles)
    if sd0:
        last_sd = sd0
    if bounty0:
        ColorPrint.green(
            f"[D3StartGameWaiter][C7] 预检已找到悬赏进度，地图已打开 -> 等待 {C7B_AFTER_BOUNTY_STABLE_SEC}s 地图稳定后再缩小+传送"
        )
        if not sd0 or not sd0.game_window_image:
            return False
        time.sleep(C7B_AFTER_BOUNTY_STABLE_SEC)
        window_offset = sd0.window_offset or (0, 0)
        game_window_size = sd0.game_window_size or (sd0.game_window_image.width, sd0.game_window_image.height)
        is_windowed = get_game_interface_data().is_windowed_mode()
        return _do_c7b_teleport(provider, titles, window_offset, game_window_size, is_windowed)

    for round_no in (1, 2):
        ColorPrint.gray(f"[D3StartGameWaiter][C7] 第 {round_no} 轮: 未确认地图打开 -> 按 M 等待地图切换，检测悬赏进度")
        _send_m_once_then_wait_for_capture(titles)
        sd, bounty_found = _capture_and_match_bounty_progress(provider, matcher, titles)
        if sd:
            last_sd = sd
        if bounty_found:
            ColorPrint.green(f"[D3StartGameWaiter][C7] 第 {round_no} 轮找到悬赏进度，地图已打开 -> 等待 {C7B_AFTER_BOUNTY_STABLE_SEC}s 地图稳定后再缩小+传送")
            if not sd or not sd.game_window_image:
                return False
            time.sleep(C7B_AFTER_BOUNTY_STABLE_SEC)
            window_offset = sd.window_offset or (0, 0)
            game_window_size = sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height)
            is_windowed = get_game_interface_data().is_windowed_mode()
            return _do_c7b_teleport(provider, titles, window_offset, game_window_size, is_windowed)
        ColorPrint.gray(f"[D3StartGameWaiter][C7] 第 {round_no} 轮未找到悬赏进度" + ("，进行第二轮 M" if round_no == 1 else "，仍执行 C7b 尽力传送"))
    ColorPrint.yellow("[D3StartGameWaiter][C7] 两轮 M 后均未找到悬赏进度，按文档不杀 D3，仍执行 C7b 尽力传送")
    if not last_sd or not last_sd.game_window_image:
        sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
        if not sd or not sd.game_window_image:
            return False
        last_sd = sd
    window_offset = last_sd.window_offset or (0, 0)
    game_window_size = last_sd.game_window_size or (last_sd.game_window_image.width, last_sd.game_window_image.height)
    is_windowed = get_game_interface_data().is_windowed_mode()
    return _do_c7b_teleport(provider, titles, window_offset, game_window_size, is_windowed)


def _run_c7a_c7w_c7b(window_titles: Optional[Tuple[str, ...]] = None) -> bool:
    """[C7] 确保地图打开（最多两轮 M+悬赏检测）后 [C7b] 缩小+传送。Blocking；tick 流用 step_c7a_send_m -> verify_bounty -> step_c7b_*。"""
    return _ensure_map_open_then_c7b_teleport(window_titles=window_titles)


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
    clicker = get_click_handler()
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
    Ensure map is open before teleport. Pre-check bounty progress first; if already visible, do not press M.
    Otherwise do up to two rounds: press M once, wait 2s, detect bounty progress.
    If any check finds bounty progress = map is open, then three clicks.
    Returns True if bounty found and three clicks done; False otherwise.
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    provider = get_screenshot_provider()
    matcher = get_scaled_template_matcher()
    ColorPrint.green(
        "[D3StartGameWaiter] Common final step: ensure map open (pre-check bounty), up to two rounds M+verify, then three clicks"
    )

    bounty1 = False
    bounty2 = False
    sd0, bounty0 = _capture_and_match_bounty_progress(provider, matcher, titles)
    sd1 = None
    sd2 = None
    if not bounty0:
        _send_m_once_then_wait_for_capture(titles)
        sd1, bounty1 = _capture_and_match_bounty_progress(provider, matcher, titles)
        if not bounty1:
            _send_m_once_then_wait_for_capture(titles)
            sd2, bounty2 = _capture_and_match_bounty_progress(provider, matcher, titles)

    # 未找到悬赏进度：此 helper 与 C7 语义不同（它的返回值用于决定后续是否继续），因此保持严格失败。
    if not (bounty0 or bounty1 or bounty2):
        ColorPrint.yellow("[D3StartGameWaiter] Common final step: bounty progress not found in both rounds; map may not be open")
        return False

    sd = sd0 if bounty0 else (sd1 if bounty1 else sd2)
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
    [C6] game_tool 路径：C10 已在 run_c4_branch_result 完成（仅判掉线）。[C7] 确保地图打开（最多两轮 M+悬赏进度检测）后 [C7b] 缩小+传送。
    """
    titles = window_titles or DIABLO_III_WINDOW_TITLES
    state = detect_d3_already_running_state(window_titles=titles)
    if state != "game_tool":
        return False
    ColorPrint.green("[D3StartGameWaiter][Fragment2] d3_game_tool 已见；C7 确保地图打开（预检+最多两轮 M+悬赏检测）后 C7b 传送")
    return _ensure_map_open_then_c7b_teleport(window_titles=titles)


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
    clicker = get_click_handler()
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

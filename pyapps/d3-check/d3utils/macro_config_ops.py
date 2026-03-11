# -*- coding: utf-8 -*-
"""
Macro config ops: send hotkeys to D3 window from skill_config.
Reads config (skills with key, strategy, interval, delay, random_delay; per-config hotkeys from skill_config_hotkeys)
and sends key events to the game window via PostMessage.
"""

import time
import random
from typing import Any, Dict, Optional, Tuple

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.window_ops import (
    send_key as window_send_key,
    send_mouse_click_at_cursor,
    is_cursor_in_window,
    is_cursor_in_rect,
    get_window_client_rect,
)

# D3 window client rect cache (screen coords left, top, right, bottom). Refreshed once when macro starts.
_cached_d3_client_rect: Optional[Tuple[int, int, int, int]] = None


def refresh_d3_window_cache(hwnd: int) -> None:
    """Cache D3 window client rect (screen coords). Call once when macro starts."""
    global _cached_d3_client_rect
    rect = get_window_client_rect(hwnd)
    _cached_d3_client_rect = rect


def clear_d3_window_cache() -> None:
    """Clear cached D3 window rect (e.g. when macro stops)."""
    global _cached_d3_client_rect
    _cached_d3_client_rect = None


def _is_cursor_in_d3_bounds() -> bool:
    """True if cursor is in D3 window; uses cache when set, else requires hwnd at call site (not used here)."""
    if _cached_d3_client_rect is None:
        return False
    return is_cursor_in_rect(_cached_d3_client_rect)

# Key name (config string) -> Windows VK code; align with UI HotkeyInput and pycore window_ops (§8: mapping table here; single literal constants go to providor)
KEY_NAME_TO_VK: Dict[str, int] = {
    "A": 0x41, "B": 0x42, "C": 0x43, "D": 0x44, "E": 0x45, "F": 0x46,
    "G": 0x47, "H": 0x48, "I": 0x49, "J": 0x4A, "K": 0x4B, "L": 0x4C,
    "M": 0x4D, "N": 0x4E, "O": 0x4F, "P": 0x50, "Q": 0x51, "R": 0x52,
    "S": 0x53, "T": 0x54, "U": 0x55, "V": 0x56, "W": 0x57, "X": 0x58,
    "Y": 0x59, "Z": 0x5A,
    "0": 0x30, "1": 0x31, "2": 0x32, "3": 0x33, "4": 0x34,
    "5": 0x35, "6": 0x36, "7": 0x37, "8": 0x38, "9": 0x39,
    "F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74,
    "F6": 0x75, "F7": 0x76, "F8": 0x77, "F9": 0x78, "F10": 0x79,
    "F11": 0x7A, "F12": 0x7B,
    "ESCAPE": 0x1B, "ENTER": 0x0D, "SPACE": 0x20, "TAB": 0x09,
    "UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27,
}


def key_name_to_vk(key_name: str) -> Optional[int]:
    """Resolve config key string to VK code. Accepts 'Space' and single chars."""
    if not key_name:
        return None
    u = str(key_name).strip().upper()
    if u in KEY_NAME_TO_VK:
        return KEY_NAME_TO_VK[u]
    if len(u) == 1:
        return ord(u)
    return None


def send_key_to_window(hwnd: int, key_name: str, press: bool = True) -> bool:
    """Send one key (down or up) to window by key name. Returns True if sent."""
    vk = key_name_to_vk(key_name)
    if vk is None:
        ColorPrint.yellow(f"[MacroConfigOps] Unknown key name: {key_name}")
        return False
    return window_send_key(hwnd, vk, press)


def press_key_to_window(hwnd: int, key_name: str) -> bool:
    """Press and release key to window. Returns True if both down and up sent."""
    if not send_key_to_window(hwnd, key_name, press=True):
        return False
    time.sleep(0.02)
    return send_key_to_window(hwnd, key_name, press=False)


def run_one_skill_tick(
    hwnd: int,
    skill_config: Dict[str, Any],
    last_skill_times: Optional[Dict[str, float]] = None,
    now: Optional[float] = None,
) -> Dict[str, float]:
    """
    Run one macro tick: for each skill use its own interval, delay, random_delay.
    - interval (ms): minimum time since last press before this skill can fire again.
    - delay (ms): sleep before sending this key (once interval allows).
    - random_delay (ms): extra random sleep [0, random_delay] before sending.
    Returns updated last_skill_times. time.sleep here is in macro thread only (not flow tick; §4.1 exception).
    """
    if now is None:
        now = time.time()
    if last_skill_times is None:
        last_skill_times = {}
    next_times = dict(last_skill_times)
    skills = skill_config.get("skills", {})
    order = ["skill1", "skill2", "skill3", "skill4", "left_click", "right_click", "potion"]
    for sk in order:
        data = skills.get(sk, {})
        if not data:
            continue
        strategy_raw = (data.get("strategy") or "").strip().lower()
        if strategy_raw in ("禁用", "ignore", "disabled"):
            continue
        strategy = (data.get("strategy") or "continuous").lower()
        interval_ms = max(0, int(data.get("interval", 100)))
        delay_ms = max(0, int(data.get("delay", 0)))
        rand_ms = max(0, int(data.get("random_delay", 0)))
        interval_sec = interval_ms / 1000.0
        last = last_skill_times.get(sk, 0.0)
        if now - last < interval_sec:
            continue
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        if rand_ms > 0:
            time.sleep(random.uniform(0, rand_ms / 1000.0))
        sent = False
        if sk == "left_click":
            in_bounds = _is_cursor_in_d3_bounds() if _cached_d3_client_rect is not None else is_cursor_in_window(hwnd)
            sent = send_mouse_click_at_cursor(hwnd, "left") if in_bounds else False
        elif sk == "right_click":
            in_bounds = _is_cursor_in_d3_bounds() if _cached_d3_client_rect is not None else is_cursor_in_window(hwnd)
            sent = send_mouse_click_at_cursor(hwnd, "right") if in_bounds else False
        else:
            key_name = data.get("key")
            if key_name:
                sent = press_key_to_window(hwnd, key_name)
        if sent:
            next_times[sk] = now
        if strategy != "continuous":
            next_times[sk] = now
    return next_times


def run_skill_sequence_loop(
    hwnd: int,
    get_config_fn,
    tick_interval_sec: float = 0.05,
    stop_flag_fn=None,
) -> None:
    """
    Loop: each tick get current skill config from get_config_fn(), run_one_skill_tick, sleep tick_interval_sec.
    Stops when stop_flag_fn() returns True. get_config_fn() returns dict like get_current_skill_config().
    """
    last_times: Dict[str, float] = {}
    while True:
        if stop_flag_fn and stop_flag_fn():
            break
        cfg = get_config_fn()
        if cfg and hwnd:
            last_times = run_one_skill_tick(hwnd, cfg, last_times)
        time.sleep(tick_interval_sec)

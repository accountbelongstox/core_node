# -*- coding: utf-8 -*-
"""
Template match debug queue: for "other image find" debug UI, in-memory only, no disk.
Share layer only: queue, push, clear. Annotated image building lives in d3utils.match_debug_notify.
"""

import queue
from typing import Optional, List, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_PIL_Image

cv2 = get_third_package_cv2()
Image = get_third_package_PIL_Image()

_debug_queue: queue.Queue = queue.Queue()
_entries: List[Dict[str, Any]] = []
_ui_active: bool = False


def set_debug_ui_active(active: bool):
    global _ui_active
    _ui_active = active


def is_debug_ui_active() -> bool:
    return _ui_active


def push(title: str, log_line: str, image=None):
    """Append one debug entry (title, log line, optional match image), in-memory only."""
    _debug_queue.put({"title": title, "log": log_line, "image": image})
    entry = {"title": title, "log": log_line, "image": image}
    _entries.append(entry)


def pop_all() -> List[Dict[str, Any]]:
    """Non-blocking pop of all items currently in queue."""
    out = []
    try:
        while True:
            out.append(_debug_queue.get_nowait())
    except queue.Empty:
        pass
    return out


def get_entries() -> List[Dict[str, Any]]:
    """Return current accumulated entry list (including items just popped from queue)."""
    return list(_entries)


def clear():
    """Clear queue and cache when UI closes."""
    global _entries, _ui_active
    try:
        while True:
            _debug_queue.get_nowait()
    except queue.Empty:
        pass
    _entries = []
    _ui_active = False


def bgr_array_to_pil(arr: Any) -> Optional[Any]:
    """Convert BGR ndarray to PIL Image; for use by d3utils.match_debug_notify."""
    if arr is None:
        return None
    try:
        rgb = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)
    except Exception:
        return None

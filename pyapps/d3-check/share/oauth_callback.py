# -*- coding: utf-8 -*-
"""
OAuth callback for CN Battle.net login.
Tampermonkey script on oauth.g.mkey.163.com notifies this module via HTTP API;
LoginTryScreenshotController waits here instead of fixed sleep after clicking NetEase login.
健康机制：油猴脚本定时 ping，UI 显示「油猴脚本: 已连接/未连接」。
"""

import threading
import time

from providor.app_constants import OAUTH_SCRIPT_PING_TIMEOUT_SEC

_oauth_done = threading.Event()
_last_ping_time: float = 0.0  # single float write is atomic under CPython GIL


def reset_oauth_done() -> None:
    """Clear the event before starting wait (call right after clicking NetEase login)."""
    _oauth_done.clear()


def wait_oauth_done(timeout: float) -> bool:
    """
    Block until Tampermonkey calls /api/login-try/oauth-done or timeout.
    Returns True if event was set (user completed web login), False if timeout.
    """
    return _oauth_done.wait(timeout=timeout)


def notify_oauth_done() -> None:
    """Called by HTTP bridge when Tampermonkey POSTs oauth-done (user clicked 登录 on web)."""
    _oauth_done.set()


def is_oauth_done() -> bool:
    """Non-blocking: True if Tampermonkey has notified oauth-done (for tick-driven flow)."""
    return _oauth_done.is_set()


def notify_ping() -> None:
    """Called by HTTP bridge when Tampermonkey GETs oauth-ping (health check)."""
    global _last_ping_time
    _last_ping_time = time.time()


def get_oauth_script_connected(timeout_sec: float = OAUTH_SCRIPT_PING_TIMEOUT_SEC) -> bool:
    """True if Tampermonkey script has pinged within timeout_sec (for UI health indicator)."""
    global _last_ping_time
    return (time.time() - _last_ping_time) <= timeout_sec

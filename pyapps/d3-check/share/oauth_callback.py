# -*- coding: utf-8 -*-
"""
OAuth callback for CN Battle.net login.
Tampermonkey script on oauth.g.mkey.163.com notifies this module via HTTP API.
LoginTryScreenshotController may wait here instead of fixed sleep after clicking NetEase login.
Health: Tampermonkey script pings periodically; UI shows script connected / disconnected.
"""

import threading
import time

from providor.app_constants import OAUTH_SCRIPT_PING_TIMEOUT_SEC

_oauth_done = threading.Event()
_last_ping_time: float = 0.0  # single float write is atomic under CPython GIL
_last_oauth_done_at: float = 0.0  # set when Tampermonkey calls oauth-done (step1); flow/end page queries and consumes

# Flow/end page (account.battlenet.com.cn) cannot read oauth.g.mkey.163.com localStorage; backend records step1 submit so flow/end can query.
OAUTH_STEP1_VALID_SEC = 120.0  # within this sec, GET oauth-step1-received returns received=True (then consumed once)


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
    """Called by HTTP bridge when Tampermonkey POSTs oauth-done (user completed login on web)."""
    global _last_oauth_done_at
    _oauth_done.set()
    _last_oauth_done_at = time.time()


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


def get_and_consume_step1_received(valid_sec: float = OAUTH_STEP1_VALID_SEC):
    # -> (bool, Optional[float])
    """
    Called by Tampermonkey on account.battlenet.com.cn/login/flow/end (cross-origin, no shared localStorage).
    Returns (received, at): True if step1 (oauth-done) was submitted within valid_sec; at is timestamp. Consumes once.
    """
    global _last_oauth_done_at
    now = time.time()
    if _last_oauth_done_at > 0 and (now - _last_oauth_done_at) <= valid_sec:
        at = _last_oauth_done_at
        _last_oauth_done_at = 0.0
        return (True, at)
    return (False, None)

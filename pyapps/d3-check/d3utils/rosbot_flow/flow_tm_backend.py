# -*- coding: utf-8 -*-
"""
TM – Tampermonkey script backend (ROSBOT_FLOW_MERMAID.md).
T1.5: POST/GET oauth-done -> backend records step1, B11 treats as return. Done in share.oauth_callback.
T2.2: GET oauth-step1-received. TODO if backend endpoint needed.
"""
from share.oauth_callback import is_oauth_done, reset_oauth_done

# TODO: T2.2 GET oauth-step1-received endpoint for Tampermonkey URL2 page to query whether step1 was received.
# Backend would set a flag when T1.5 oauth-done is received; T2 page polls this.

__all__ = ["is_oauth_done", "reset_oauth_done"]

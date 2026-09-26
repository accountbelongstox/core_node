# -*- coding: utf-8 -*-
"""RPC entry for the word-audio full sync (on-demand full pull).

Routing only: the controller kicks the same full-pull entry as the pycore
startup chain (REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE R8) on a
background bus task and returns the live status block. The pull is
pycore-local: it reads Laravel's without-audio dictionary listing and mirrors
it into Part2 of the word_audio Queue; it NEVER mutates Laravel's queue.
"""

from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_CENTER_WORD_AUDIO_FULL_SYNC
from pycore.pyctl.tts.word_audio_full_sync import word_audio_full_sync


def register_word_audio_full_sync_routes(server) -> None:
    """Register the word-audio full-sync controller."""

    def full_sync_handler(params, _request_id, _context):
        base_url = str((params or {}).get("base_url") or "").strip()
        result = word_audio_full_sync.start_background(base_url)
        result["status"] = word_audio_full_sync.get_status()
        return result

    server.post(path=UI_QUEUE_CENTER_WORD_AUDIO_FULL_SYNC, handler=full_sync_handler)

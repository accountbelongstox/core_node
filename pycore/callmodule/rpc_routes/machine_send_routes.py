# -*- coding: utf-8 -*-
"""Register machine send controllers (file, text, clipboard and its history) on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import (
    UI_MACHINE_SEND_FILE,
    UI_MACHINE_SEND_TEXT,
    UI_MACHINE_SEND_CLIPBOARD,
    UI_MACHINE_SEND_CLIPBOARD_HISTORY,
    UI_MACHINE_SEND_CLIPBOARD_HISTORY_DELETE,
    UI_MACHINE_SEND_CLIPBOARD_HISTORY_CLEAR,
)
from pycore.pyctl.desktop.machine_send_service import machine_send_service

OPEN_DISABLED_VALUES = ("0", "false", "no", "off")


def register_machine_send_routes(server) -> None:
    """Multipart and JSON bindings; uploads stream with no request deadline."""

    def send_file(params, _request_id, _context):
        open_value = str(params.get("open", "1")).strip().lower()
        return machine_send_service.send_file(
            params.get("file"),
            open_dir_after=open_value not in OPEN_DISABLED_VALUES,
        )

    def send_text(params, _request_id, _context):
        return machine_send_service.send_text(str(params.get("text") or ""), str(params.get("name") or ""))

    def send_clipboard(params, _request_id, _context):
        return machine_send_service.send_clipboard(
            kind=str(params.get("kind") or "text"),
            text=str(params.get("text") or ""),
            upload=params.get("file"),
        )

    def clipboard_history(params, _request_id, _context):
        limit = params.get("limit")
        return machine_send_service.clipboard_history(int(limit) if str(limit or "").isdigit() else None)

    def clipboard_history_delete(params, _request_id, _context):
        return machine_send_service.clipboard_history_delete(str(params.get("id") or ""))

    def clipboard_history_clear(params, _request_id, _context):
        return machine_send_service.clipboard_history_clear()

    server.post(path=UI_MACHINE_SEND_FILE, handler=send_file)
    server.post(path=UI_MACHINE_SEND_TEXT, handler=send_text)
    server.post(path=UI_MACHINE_SEND_CLIPBOARD, handler=send_clipboard)
    server.post(path=UI_MACHINE_SEND_CLIPBOARD_HISTORY, handler=clipboard_history)
    server.post(path=UI_MACHINE_SEND_CLIPBOARD_HISTORY_DELETE, handler=clipboard_history_delete)
    server.post(path=UI_MACHINE_SEND_CLIPBOARD_HISTORY_CLEAR, handler=clipboard_history_clear)

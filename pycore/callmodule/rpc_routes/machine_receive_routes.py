# -*- coding: utf-8 -*-
"""Register machine receive controllers (files, text, clipboard) on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import (
    UI_MACHINE_CLIPBOARD_SET,
    UI_MACHINE_RECEIVE_FILES,
    UI_MACHINE_RECEIVE_TEXT,
)
from pycore.pyctl.desktop.machine_receive_service import machine_receive_service


def _as_list(value):
    if value is None:
        return []
    return list(value) if isinstance(value, list) else [value]


def register_machine_receive_routes(server) -> None:
    """Multipart and JSON bindings; uploads stream with no request deadline."""

    def receive_files(params, _request_id, _context):
        return machine_receive_service.receive_files(_as_list(params.get("files")))

    def receive_text(params, _request_id, _context):
        return machine_receive_service.receive_text(str(params.get("text") or ""))

    def set_clipboard(params, _request_id, _context):
        return machine_receive_service.set_clipboard(
            content=str(params.get("content") or ""),
            upload=params.get("file"),
        )

    server.post(path=UI_MACHINE_RECEIVE_FILES, handler=receive_files)
    server.post(path=UI_MACHINE_RECEIVE_TEXT, handler=receive_text)
    server.post(path=UI_MACHINE_CLIPBOARD_SET, handler=set_clipboard)

# -*- coding: utf-8 -*-
import re

from pycore.callmodule.rpc_routes.route_names import (
    UI_TERMINAL_ACTIVATE,
    UI_TERMINAL_CLICK,
    UI_TERMINAL_COMMAND_HISTORY,
    UI_TERMINAL_CONTENT,
    UI_TERMINAL_DRAFT,
    UI_TERMINAL_ENTER,
    UI_TERMINAL_INPUT,
    UI_TERMINAL_SCHEDULE_QUEUE_CLEAR,
    UI_TERMINAL_SCHEDULE_QUEUE_SYNC,
    UI_TERMINAL_SCROLL,
    UI_TERMINAL_VIEW,
    UI_TERMINAL_WINDOWS,
)
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyctl.terminal.terminal_scheduler import terminal_scheduler
from pycore.pyctl.terminal.terminal_service import terminal_service


fastapi = get_third_package_fastapi()
Response = fastapi.Response
UNSIGNED_INTEGER_PATTERN = re.compile(r"^\d+$")
NORMALIZED_RATIO_PATTERN = re.compile(r"^(?:0(?:\.\d+)?|1(?:\.0+)?)$")


def _integer_param(params, key: str) -> int:
    value = str(params.get(key) or "")
    return int(value) if UNSIGNED_INTEGER_PATTERN.fullmatch(value) else 0


def _ratio_param(params, key: str) -> float:
    value = str(params.get(key) or "")
    return float(value) if NORMALIZED_RATIO_PATTERN.fullmatch(value) else -1.0


def register_terminal_routes(server) -> None:
    def windows_handler(_params, _request_id, _context):
        return terminal_scheduler.decorate_snapshot(terminal_service.snapshot())

    def activate_handler(params, _request_id, _context):
        window_id = str(params.get("window_id") or "")
        return terminal_service.activate(window_id)

    def click_handler(params, _request_id, _context):
        window_id = str(params.get("window_id") or "")
        horizontal_ratio = _ratio_param(params, "horizontal_ratio")
        vertical_ratio = _ratio_param(params, "vertical_ratio")
        return terminal_service.click(
            window_id,
            horizontal_ratio,
            vertical_ratio,
        )

    def input_handler(params, _request_id, _context):
        window_id = str(params.get("window_id") or "")
        terminal_number = _integer_param(params, "terminal_number")
        text = str(params.get("text") or "")
        return terminal_service.input_text(window_id, terminal_number, text)

    def enter_handler(params, _request_id, _context):
        window_id = str(params.get("window_id") or "")
        terminal_number = _integer_param(params, "terminal_number")
        return terminal_service.press_enter(window_id, terminal_number)

    def command_history_handler(params, _request_id, _context):
        window_id = str(params.get("window_id") or "")
        direction = str(params.get("direction") or "").strip().lower()
        return terminal_service.navigate_history(window_id, direction)

    def scroll_handler(params, _request_id, _context):
        window_id = str(params.get("window_id") or "")
        mode = str(params.get("mode") or "").strip().lower()
        return terminal_service.scroll(window_id, mode)

    def draft_handler(params, _request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        text = str(params.get("text") or "")
        return terminal_service.save_draft(terminal_number, text)

    def view_handler(params, _request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        expanded = str(params.get("text") or "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        return terminal_service.save_preview_expanded(
            terminal_number,
            expanded,
        )

    def schedule_queue_sync_handler(params, _request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        return terminal_scheduler.sync_from_json(terminal_number)

    def schedule_queue_clear_handler(_params, _request_id, _context):
        return terminal_scheduler.clear_entries()

    def content_handler(params, _request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        content_kind = str(params.get("kind") or "")
        item_id = str(params.get("log_id") or "") or str(
            params.get("entry_id") or ""
        )
        content = (
            terminal_scheduler.read_message(terminal_number, item_id)
            if content_kind == "schedule"
            else terminal_service.read_text(
                terminal_number,
                content_kind,
                item_id,
            )
        )
        return Response(
            content=content or "",
            status_code=200 if content is not None else 404,
            media_type="text/plain",
        )

    server.post(path=UI_TERMINAL_WINDOWS, handler=windows_handler)
    server.post(path=UI_TERMINAL_ACTIVATE, handler=activate_handler)
    server.post(path=UI_TERMINAL_CLICK, handler=click_handler)
    server.post(
        path=UI_TERMINAL_COMMAND_HISTORY,
        handler=command_history_handler,
    )
    server.post(path=UI_TERMINAL_DRAFT, handler=draft_handler)
    server.post(path=UI_TERMINAL_ENTER, handler=enter_handler)
    server.post(path=UI_TERMINAL_INPUT, handler=input_handler)
    server.post(path=UI_TERMINAL_SCROLL, handler=scroll_handler)
    server.post(path=UI_TERMINAL_VIEW, handler=view_handler)
    server.post(
        path=UI_TERMINAL_SCHEDULE_QUEUE_CLEAR,
        handler=schedule_queue_clear_handler,
    )
    server.post(
        path=UI_TERMINAL_SCHEDULE_QUEUE_SYNC,
        handler=schedule_queue_sync_handler,
    )
    server.get(path=UI_TERMINAL_CONTENT, handler=content_handler)

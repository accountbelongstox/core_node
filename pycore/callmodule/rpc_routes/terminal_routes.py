# -*- coding: utf-8 -*-
import re
from typing import Any, Callable, Dict

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
    UI_TERMINAL_SCREENSHOT,
    UI_TERMINAL_SCROLL,
    UI_TERMINAL_VIEW,
    UI_TERMINAL_VIEWER_DEMAND,
    UI_TERMINAL_WINDOWS,
)
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
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


def _string_list_param(params, key: str):
    value = params.get(key)
    if not isinstance(value, (list, tuple, set)):
        return []
    return sorted({str(item) for item in value if str(item)})


def _run_terminal_action(
    action: str,
    request_id: str,
    callback: Callable[[], Any],
    log_result: bool = True,
) -> Any:
    terminal_activity_log.info(
        "rpc.started",
        terminal_action=action,
        request_id=request_id,
    )
    try:
        result = callback()
    except Exception as error:
        terminal_activity_log.error(
            "rpc.failed",
            terminal_action=action,
            request_id=request_id,
            error_type=type(error).__name__,
            error=error,
        )
        raise
    success = not isinstance(result, dict) or bool(result.get("success", True))
    log_method = terminal_activity_log.success if success else terminal_activity_log.warning
    payload: Dict[str, Any] = {
        "terminal_action": action,
        "request_id": request_id,
        "success": success,
    }
    if log_result:
        payload["result"] = result
    log_method("rpc.completed", **payload)
    return result


def register_terminal_routes(server) -> None:
    def windows_handler(params, request_id, _context):
        viewer_id = str(params.get("viewer_id") or "")
        visible_window_ids = _string_list_param(params, "visible_window_ids")

        def read_snapshot():
            snapshot = terminal_service.snapshot(viewer_id, visible_window_ids)
            decorated = terminal_scheduler.decorate_snapshot(snapshot)
            return terminal_service.finalize_snapshot(decorated)

        return _run_terminal_action(
            "windows",
            request_id,
            read_snapshot,
            log_result=False,
        )

    def activate_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        return _run_terminal_action(
            "activate",
            request_id,
            lambda: terminal_service.activate(window_id),
        )

    def click_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        horizontal_ratio = _ratio_param(params, "horizontal_ratio")
        vertical_ratio = _ratio_param(params, "vertical_ratio")
        return _run_terminal_action(
            "click",
            request_id,
            lambda: terminal_service.click(
                window_id,
                horizontal_ratio,
                vertical_ratio,
            ),
        )

    def input_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        terminal_number = _integer_param(params, "terminal_number")
        text = str(params.get("text") or "")
        return _run_terminal_action(
            "input",
            request_id,
            lambda: terminal_service.input_text(window_id, terminal_number, text),
        )

    def enter_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        terminal_number = _integer_param(params, "terminal_number")
        return _run_terminal_action(
            "enter",
            request_id,
            lambda: terminal_service.press_enter(window_id, terminal_number),
        )

    def command_history_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        direction = str(params.get("direction") or "").strip().lower()
        return _run_terminal_action(
            "command_history",
            request_id,
            lambda: terminal_service.navigate_history(window_id, direction),
        )

    def scroll_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        mode = str(params.get("mode") or "").strip().lower()
        return _run_terminal_action(
            "scroll",
            request_id,
            lambda: terminal_service.scroll(window_id, mode),
        )

    def draft_handler(params, request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        text = str(params.get("text") or "")
        return _run_terminal_action(
            "draft",
            request_id,
            lambda: terminal_service.save_draft(terminal_number, text),
        )

    def view_handler(params, request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        expanded = str(params.get("text") or "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        return _run_terminal_action(
            "view",
            request_id,
            lambda: terminal_service.save_preview_expanded(
                terminal_number,
                expanded,
            ),
        )

    def schedule_queue_sync_handler(params, request_id, _context):
        terminal_number = _integer_param(params, "terminal_number")
        return _run_terminal_action(
            "schedule_queue_sync",
            request_id,
            lambda: terminal_scheduler.sync_from_json(terminal_number),
        )

    def schedule_queue_clear_handler(_params, request_id, _context):
        return _run_terminal_action(
            "schedule_queue_clear",
            request_id,
            terminal_scheduler.clear_entries,
        )

    def content_handler(params, request_id, _context):
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
        return _run_terminal_action(
            "content",
            request_id,
            lambda: Response(
                content=content or "",
                status_code=200 if content is not None else 404,
                media_type="text/plain",
            ),
        )

    def viewer_demand_handler(params, request_id, _context):
        viewer_id = str(params.get("viewer_id") or "")
        visible_window_ids = _string_list_param(params, "visible_window_ids")
        return _run_terminal_action(
            "viewer_demand",
            request_id,
            lambda: terminal_service.renew_viewer_demand(
                viewer_id,
                visible_window_ids,
            ),
        )

    def screenshot_handler(params, request_id, context):
        window_id = str(params.get("window_id") or "")
        digest = str(params.get("digest") or "")
        headers = context.get("headers") if isinstance(context, dict) else {}
        request_etag = str((headers or {}).get("if-none-match") or "")

        def read_response():
            resource = terminal_service.read_screenshot(window_id, digest)
            if resource is None:
                return Response(status_code=404)
            etag = f'"{str(resource["digest"])}"'
            response_headers = {
                "Cache-Control": "private, max-age=31536000, immutable",
                "ETag": etag,
            }
            if request_etag == etag:
                return Response(status_code=304, headers=response_headers)
            return Response(
                content=resource["body"],
                status_code=200,
                headers=response_headers,
                media_type=str(resource["mime"]),
            )

        return _run_terminal_action("screenshot", request_id, read_response)

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
    server.post(path=UI_TERMINAL_VIEWER_DEMAND, handler=viewer_demand_handler)
    server.post(
        path=UI_TERMINAL_SCHEDULE_QUEUE_CLEAR,
        handler=schedule_queue_clear_handler,
    )
    server.post(
        path=UI_TERMINAL_SCHEDULE_QUEUE_SYNC,
        handler=schedule_queue_sync_handler,
    )
    server.get(path=UI_TERMINAL_CONTENT, handler=content_handler)
    server.get(path=UI_TERMINAL_SCREENSHOT, handler=screenshot_handler)

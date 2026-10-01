# -*- coding: utf-8 -*-
from pycore.callmodule.rpc_routes.route_names import (
    UI_TERMINAL_ACTIVATE,
    UI_TERMINAL_CAPTURE,
    UI_TERMINAL_CLICK,
    UI_TERMINAL_COMMAND_HISTORY,
    UI_TERMINAL_CONTENT,
    UI_TERMINAL_DESKTOP_INTEGRATION,
    UI_TERMINAL_DRAFT,
    UI_TERMINAL_ENTER,
    UI_TERMINAL_INPUT,
    UI_TERMINAL_SCHEDULE_QUEUE_CLEAR,
    UI_TERMINAL_SCHEDULE_QUEUE_SYNC,
    UI_TERMINAL_SCREENSHOT,
    UI_TERMINAL_SCROLL,
    UI_TERMINAL_VIEW,
    UI_TERMINAL_VIEWER_DEMAND,
    UI_TERMINAL_IMAGE_UPLOAD,
    UI_TERMINAL_WINDOWS,
)
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyctl.terminal.terminal_scheduler import terminal_scheduler
from pycore.pyctl.terminal.terminal_rpc import (
    bool_param,
    integer_param,
    ratio_param,
    run_terminal_action,
    string_list_param,
)
from pycore.pyctl.terminal.terminal_service import terminal_service


fastapi = get_third_package_fastapi()
Response = fastapi.Response


def register_terminal_routes(server) -> None:
    def windows_handler(params, request_id, _context):
        viewer_id = str(params.get("viewer_id") or "")
        visible_window_ids = string_list_param(params, "visible_window_ids")

        return run_terminal_action(
            "windows",
            request_id,
            lambda: terminal_service.snapshot(viewer_id, visible_window_ids),
            log_result=False,
            quiet=True,
        )

    def image_upload_handler(params, request_id, _context):
        upload = params.get("file")
        window_id = str(params.get("window_id") or "")
        return run_terminal_action(
            "image_upload",
            request_id,
            lambda: terminal_service.upload_image(upload, window_id),
            log_result=False,
        )

    def activate_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        return run_terminal_action(
            "activate",
            request_id,
            lambda: terminal_service.activate(window_id),
        )

    def click_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        horizontal_ratio = ratio_param(params, "horizontal_ratio")
        vertical_ratio = ratio_param(params, "vertical_ratio")
        return run_terminal_action(
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
        terminal_number = integer_param(params, "terminal_number")
        text = str(params.get("text") or "")
        return run_terminal_action(
            "input",
            request_id,
            lambda: terminal_service.input_text(window_id, terminal_number, text),
        )

    def enter_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        terminal_number = integer_param(params, "terminal_number")
        return run_terminal_action(
            "enter",
            request_id,
            lambda: terminal_service.press_enter(window_id, terminal_number),
        )

    def capture_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        terminal_number = integer_param(params, "terminal_number")
        open_editor = bool_param(params, "open_editor")
        return run_terminal_action(
            "capture",
            request_id,
            lambda: terminal_service.capture_text(
                window_id,
                terminal_number,
                open_editor,
            ),
        )

    def command_history_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        direction = str(params.get("direction") or "").strip().lower()
        return run_terminal_action(
            "command_history",
            request_id,
            lambda: terminal_service.navigate_history(window_id, direction),
        )

    def scroll_handler(params, request_id, _context):
        window_id = str(params.get("window_id") or "")
        mode = str(params.get("mode") or "").strip().lower()
        return run_terminal_action(
            "scroll",
            request_id,
            lambda: terminal_service.scroll(window_id, mode),
        )

    def draft_handler(params, request_id, _context):
        terminal_number = integer_param(params, "terminal_number")
        text = str(params.get("text") or "")
        return run_terminal_action(
            "draft",
            request_id,
            lambda: terminal_service.save_draft(terminal_number, text),
        )

    def view_handler(params, request_id, _context):
        terminal_number = integer_param(params, "terminal_number")
        expanded = bool_param(params, "text")
        return run_terminal_action(
            "view",
            request_id,
            lambda: terminal_service.save_preview_expanded(
                terminal_number,
                expanded,
            ),
        )

    def schedule_queue_sync_handler(params, request_id, _context):
        terminal_number = integer_param(params, "terminal_number")
        return run_terminal_action(
            "schedule_queue_sync",
            request_id,
            lambda: terminal_scheduler.sync_from_json(terminal_number),
        )

    def schedule_queue_clear_handler(_params, request_id, _context):
        return run_terminal_action(
            "schedule_queue_clear",
            request_id,
            terminal_scheduler.clear_entries,
        )

    def content_handler(params, request_id, _context):
        terminal_number = integer_param(params, "terminal_number")
        content_kind = str(params.get("kind") or "")
        item_id = str(params.get("log_id") or "") or str(
            params.get("entry_id") or ""
        )
        if content_kind == "schedule":
            content = terminal_scheduler.read_message(terminal_number, item_id)
        elif content_kind == "capture":
            content = terminal_service.read_capture(terminal_number, item_id)
        else:
            content = terminal_service.read_text(
                terminal_number,
                content_kind,
                item_id,
            )
        return run_terminal_action(
            "content",
            request_id,
            lambda: Response(
                content=content or "",
                status_code=200 if content is not None else 404,
                media_type="text/plain",
            ),
            quiet=True,
        )

    def desktop_integration_handler(params, request_id, _context):
        action = str(params.get("action") or "status")
        return run_terminal_action(
            "desktop_integration",
            request_id,
            lambda: terminal_service.desktop_integration(action),
        )

    def viewer_demand_handler(params, request_id, _context):
        viewer_id = str(params.get("viewer_id") or "")
        visible_window_ids = string_list_param(params, "visible_window_ids")
        return run_terminal_action(
            "viewer_demand",
            request_id,
            lambda: terminal_service.renew_viewer_demand(
                viewer_id,
                visible_window_ids,
            ),
            quiet=True,
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

        return run_terminal_action(
            "screenshot",
            request_id,
            read_response,
            quiet=True,
        )

    server.post(path=UI_TERMINAL_WINDOWS, handler=windows_handler)
    server.post(path=UI_TERMINAL_ACTIVATE, handler=activate_handler)
    server.post(path=UI_TERMINAL_IMAGE_UPLOAD, handler=image_upload_handler)
    server.post(path=UI_TERMINAL_CAPTURE, handler=capture_handler)
    server.post(path=UI_TERMINAL_CLICK, handler=click_handler)
    server.post(
        path=UI_TERMINAL_COMMAND_HISTORY,
        handler=command_history_handler,
    )
    server.post(
        path=UI_TERMINAL_DESKTOP_INTEGRATION,
        handler=desktop_integration_handler,
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

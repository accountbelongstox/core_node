# -*- coding: utf-8 -*-
"""Register audio-orchestration controllers on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyctl.audio_orchestration import (
    orch_auth,
    orch_contract,
    orch_files,
    orch_generate,
    orch_service,
    orch_video_presets,
)
from pycore.pyctl.audio_orchestration.orch_queue import orch_queue

_QUEUE_STARTED = False
_RESOURCE_FILE_CACHE_CONTROL = "private, max-age=3600"

fastapi = get_third_package_fastapi()
Response = fastapi.Response


def register_local_audio_orchestration_routes(server) -> None:
    """Register thin audio-orchestration controller adapters."""

    def auth_login(params, request_id, context):
        return orch_auth.auth_login(
            str(params.get("username") or ""),
            str(params.get("password") or ""),
            str(params.get("access_token") or ""),
            str(params.get("laravel_base_url") or ""),
        )

    def books_list(params, request_id, context):
        return orch_service.books_list(refresh=bool(params.get("refresh")))

    def auth_logout(params, request_id, context):
        return orch_auth.auth_logout(params.get("expected_user_id"))

    def auth_groups(params, request_id, context):
        return orch_auth.auth_groups(refresh=bool(params.get("refresh")))

    def auth_select_group(params, request_id, context):
        return orch_auth.auth_select_group(str(params.get("group_id") or ""))

    def book_sentences(params, request_id, context):
        return orch_service.book_sentences(
            str(params.get("source_key") or ""),
            refresh=bool(params.get("refresh")),
        )

    def task_get(params, request_id, context):
        return orch_service.task_get(str(params.get("task_id") or ""))

    def task_create(params, request_id, context):
        return orch_service.task_create(params or {})

    def tasks_list(params, request_id, context):
        return orch_service.tasks_list(params or {})

    def tasks_active(params, request_id, context):
        return orch_service.tasks_active(params or {})

    def task_submit_text(params, request_id, context):
        source_ref = params.get("source_ref")
        return orch_service.submit_text_task(
            str(params.get("source") or ""),
            params.get("items"),
            name=str(params.get("name") or ""),
            source_ref=source_ref if isinstance(source_ref, dict) else None,
            generate=params.get("generate") is not False,
            source_text=str(params.get("source_text") or ""),
            output_mode=str(params.get("output_mode") or ""),
        )

    def task_update(params, request_id, context):
        patch = dict(params or {})
        task_id = str(patch.pop("task_id", "") or "")
        return orch_service.task_update(task_id, patch)

    def task_delete(params, request_id, context):
        return orch_service.task_delete(str(params.get("task_id") or ""))

    def task_plan(params, request_id, context):
        return orch_service.task_plan(str(params.get("task_id") or ""))

    def task_generate(params, request_id, context):
        return orch_generate.start_generation(
            str(params.get("task_id") or ""),
            params.get("expected_user_id"),
            params.get("expected_base_url"),
            params.get("use_qy_account"),
            params.get("word_group_id"),
            resume=params.get("resume"),
            force_fresh=bool(params.get("force_fresh")),
        )

    def task_cancel(params, request_id, context):
        return orch_service.task_cancel(str(params.get("task_id") or ""))

    def task_progress(params, request_id, context):
        return orch_service.task_progress(str(params.get("task_id") or ""))

    def system_status(params, request_id, context):
        return orch_files.system_status(refresh=bool(params.get("refresh")))

    def task_files(params, request_id, context):
        return orch_files.task_files(str(params.get("task_id") or ""))

    def task_manifest_page(params, request_id, context):
        try:
            page = int(params.get("page") or 1)
            page_size = int(params.get("page_size") or 50)
        except (TypeError, ValueError):
            page, page_size = 1, 50
        return orch_service.task_manifest_page(
            str(params.get("task_id") or ""),
            str(params.get("category") or "all"),
            page,
            page_size,
        )

    def open_output(params, request_id, context):
        return orch_files.open_output(params.get("task_id") or None)

    def task_file_chunk(params, request_id, context):
        return orch_files.task_file_chunk(
            str(params.get("task_id") or ""),
            str(params.get("name") or ""),
            params.get("offset") or 0,
            params.get("length") or orch_files.FILE_CHUNK_BYTES,
        )

    def resource_lookup(params, request_id, context):
        return orch_files.resource_lookup(params.get("items"))

    def resource_chunk(params, request_id, context):
        return orch_files.resource_chunk(
            str(params.get("kind") or ""),
            str(params.get("language") or ""),
            str(params.get("text") or ""),
            params.get("offset") or 0,
            params.get("length") or orch_files.FILE_CHUNK_BYTES,
        )

    def resource_file(params, request_id, context):
        resource = orch_files.resource_file(
            str(params.get("kind") or ""),
            str(params.get("language") or ""),
            str(params.get("text") or ""),
        )
        if resource is None:
            return Response(status_code=404)
        etag = f'"{resource["key"]}-{len(resource["body"])}"'
        headers = {"Cache-Control": _RESOURCE_FILE_CACHE_CONTROL, "ETag": etag}
        request_headers = context.get("headers") if isinstance(context, dict) else {}
        if str((request_headers or {}).get("if-none-match") or "") == etag:
            return Response(status_code=304, headers=headers)
        return Response(content=resource["body"], status_code=200, headers=headers, media_type=resource["media_type"])

    def resource_bundle(params, request_id, context):
        body = orch_files.resource_bundle(params.get("items"))
        if body is None:
            return {"success": False, "error": "ORCH_RESOURCE_BUNDLE_INVALID"}
        return Response(content=body, status_code=200, media_type=orch_contract.BUNDLE_MEDIA_TYPE)

    def task_render_video(params, request_id, context):
        return orch_service.task_render_video(str(params.get("task_id") or ""), params.get("force") is not False)

    def video_presets(params, request_id, context):
        return orch_video_presets.list_presets()

    def video_preset_save(params, request_id, context):
        return orch_video_presets.save_preset(
            str(params.get("preset_id") or ""),
            str(params.get("name") or ""),
            params.get("settings"),
            bool(params.get("activate")),
        )

    def video_preset_delete(params, request_id, context):
        return orch_video_presets.delete_preset(str(params.get("preset_id") or ""))

    def video_preset_activate(params, request_id, context):
        return orch_video_presets.activate_preset(str(params.get("preset_id") or ""))

    def video_preview(params, request_id, context):
        return orch_service.video_preview(params.get("settings"), str(params.get("preset_id") or ""))

    def video_background_import(params, request_id, context):
        return orch_video_presets.import_background(str(params.get("path") or ""))

    routes = (
        (route_names.UI_AUDIO_ORCH_BOOKS_LIST, books_list),
        (route_names.UI_AUDIO_ORCH_BOOK_SENTENCES, book_sentences),
        (route_names.UI_AUDIO_ORCH_AUTH_LOGIN, auth_login),
        (route_names.UI_AUDIO_ORCH_AUTH_STATUS, orch_auth.auth_status),
        (route_names.UI_AUDIO_ORCH_AUTH_LOGOUT, auth_logout),
        (route_names.UI_AUDIO_ORCH_AUTH_GROUPS, auth_groups),
        (route_names.UI_AUDIO_ORCH_AUTH_SELECT_GROUP, auth_select_group),
        (route_names.UI_AUDIO_ORCH_TASKS_LIST, tasks_list),
        (route_names.UI_AUDIO_ORCH_TASKS_ACTIVE, tasks_active),
        (route_names.UI_AUDIO_ORCH_TASK_GET, task_get),
        (route_names.UI_AUDIO_ORCH_TASK_CREATE, task_create),
        (route_names.UI_AUDIO_ORCH_TASK_SUBMIT_TEXT, task_submit_text),
        (route_names.UI_AUDIO_ORCH_TASK_UPDATE, task_update),
        (route_names.UI_AUDIO_ORCH_TASK_DELETE, task_delete),
        (route_names.UI_AUDIO_ORCH_TASK_PLAN, task_plan),
        (route_names.UI_AUDIO_ORCH_TASK_GENERATE, task_generate),
        (route_names.UI_AUDIO_ORCH_TASK_CANCEL, task_cancel),
        (route_names.UI_AUDIO_ORCH_TASK_PROGRESS, task_progress),
        (route_names.UI_AUDIO_ORCH_SYSTEM_STATUS, system_status),
        (route_names.UI_AUDIO_ORCH_TASK_FILES, task_files),
        (route_names.UI_AUDIO_ORCH_TASK_MANIFEST_PAGE, task_manifest_page),
        (route_names.UI_AUDIO_ORCH_OPEN_OUTPUT, open_output),
        (route_names.UI_AUDIO_ORCH_TASK_RENDER_VIDEO, task_render_video),
        (route_names.UI_AUDIO_ORCH_TASK_FILE_CHUNK, task_file_chunk),
        (route_names.UI_AUDIO_ORCH_RESOURCE_LOOKUP, resource_lookup),
        (route_names.UI_AUDIO_ORCH_RESOURCE_CHUNK, resource_chunk),
        (route_names.UI_AUDIO_ORCH_RESOURCE_BUNDLE, resource_bundle),
        (route_names.UI_AUDIO_ORCH_VIDEO_PRESETS, video_presets),
        (route_names.UI_AUDIO_ORCH_VIDEO_PRESET_SAVE, video_preset_save),
        (route_names.UI_AUDIO_ORCH_VIDEO_PRESET_DELETE, video_preset_delete),
        (route_names.UI_AUDIO_ORCH_VIDEO_PRESET_ACTIVATE, video_preset_activate),
        (route_names.UI_AUDIO_ORCH_VIDEO_PREVIEW, video_preview),
        (route_names.UI_AUDIO_ORCH_VIDEO_BACKGROUND_IMPORT, video_background_import),
    )
    server.register_routes(routes, group="audio_orchestration")
    server.get(path=route_names.UI_AUDIO_ORCH_RESOURCE_FILE, handler=resource_file)

    # Startup: the orchestration queue recovers tasks a previous pycore process
    # left generating, registers its heartbeat tick and starts every task whose
    # prerequisites are met (nothing waits for a button press).
    global _QUEUE_STARTED
    if not _QUEUE_STARTED:
        _QUEUE_STARTED = True
        orch_queue.start()

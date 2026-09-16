# -*- coding: utf-8 -*-
"""Register audio-orchestration controllers on HTTP API."""

from pycore.callmodule.rpc_routes import route_names
from pycore.pyctl.audio_orchestration import orch_service


def register_local_audio_orchestration_routes(server) -> None:
    """Register thin audio-orchestration controller adapters."""

    def auth_login(params, request_id, context):
        return orch_service.auth_login(
            str(params.get("username") or ""),
            str(params.get("password") or ""),
        )

    def books_list(params, request_id, context):
        return orch_service.books_list(refresh=bool(params.get("refresh")))

    def book_sentences(params, request_id, context):
        return orch_service.book_sentences(
            str(params.get("source_key") or ""),
            refresh=bool(params.get("refresh")),
        )

    def task_get(params, request_id, context):
        return orch_service.task_get(str(params.get("task_id") or ""))

    def task_create(params, request_id, context):
        return orch_service.task_create(params or {})

    def task_update(params, request_id, context):
        patch = dict(params or {})
        task_id = str(patch.pop("task_id", "") or "")
        return orch_service.task_update(task_id, patch)

    def task_delete(params, request_id, context):
        return orch_service.task_delete(str(params.get("task_id") or ""))

    def task_plan(params, request_id, context):
        return orch_service.task_plan(str(params.get("task_id") or ""))

    def task_generate(params, request_id, context):
        return orch_service.task_generate(str(params.get("task_id") or ""))

    def task_cancel(params, request_id, context):
        return orch_service.task_cancel(str(params.get("task_id") or ""))

    def task_progress(params, request_id, context):
        return orch_service.task_progress(str(params.get("task_id") or ""))

    def system_status(params, request_id, context):
        return orch_service.system_status(refresh=bool(params.get("refresh")))

    def task_files(params, request_id, context):
        return orch_service.task_files(str(params.get("task_id") or ""))

    def open_output(params, request_id, context):
        return orch_service.open_output(params.get("task_id") or None)

    routes = (
        (route_names.UI_AUDIO_ORCH_BOOKS_LIST, books_list),
        (route_names.UI_AUDIO_ORCH_BOOK_SENTENCES, book_sentences),
        (route_names.UI_AUDIO_ORCH_AUTH_LOGIN, auth_login),
        (route_names.UI_AUDIO_ORCH_AUTH_STATUS, orch_service.auth_status),
        (route_names.UI_AUDIO_ORCH_AUTH_LOGOUT, orch_service.auth_logout),
        (route_names.UI_AUDIO_ORCH_TASKS_LIST, orch_service.tasks_list),
        (route_names.UI_AUDIO_ORCH_TASK_GET, task_get),
        (route_names.UI_AUDIO_ORCH_TASK_CREATE, task_create),
        (route_names.UI_AUDIO_ORCH_TASK_UPDATE, task_update),
        (route_names.UI_AUDIO_ORCH_TASK_DELETE, task_delete),
        (route_names.UI_AUDIO_ORCH_TASK_PLAN, task_plan),
        (route_names.UI_AUDIO_ORCH_TASK_GENERATE, task_generate),
        (route_names.UI_AUDIO_ORCH_TASK_CANCEL, task_cancel),
        (route_names.UI_AUDIO_ORCH_TASK_PROGRESS, task_progress),
        (route_names.UI_AUDIO_ORCH_SYSTEM_STATUS, system_status),
        (route_names.UI_AUDIO_ORCH_TASK_FILES, task_files),
        (route_names.UI_AUDIO_ORCH_OPEN_OUTPUT, open_output),
    )
    server.register_routes(routes, group="audio_orchestration")

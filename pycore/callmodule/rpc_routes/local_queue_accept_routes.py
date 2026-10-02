# -*- coding: utf-8 -*-
"""RPC accept entry for UI-dispatched tasks.

A UI client that has already claimed a task from Laravel dispatches the task
payload to pycore through this route; pycore processes it and uploads the
result (status + audio) to Laravel. Pycore's own typed pull workers are separate.
"""

from typing import Any, Dict

from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_CENTER_ACCEPT_TASK
from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyctl.tts.laravel_audio_worker import (
    laravel_sentence_audio_worker,
    laravel_word_audio_worker,
)
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_TYPES_BY_KEY
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager

_WORD_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["word_audio"]["key"]
_SENTENCE_AUDIO_TASK_TYPE = GLOBAL_TASK_TYPES_BY_KEY["sentence_audio"]["key"]


def _route_task(task: Dict[str, Any], base_url: str) -> Dict[str, Any]:
    """Hand one dispatched task to the owning worker lane."""
    task_type = str(task.get("task_type") or "")
    capability = str(task.get("capability") or "")
    if task_type == _WORD_AUDIO_TASK_TYPE or capability == "audio":
        return laravel_word_audio_worker.accept_task(task, base_url)
    if task_type == _SENTENCE_AUDIO_TASK_TYPE or capability == "sentence_audio":
        return laravel_sentence_audio_worker.accept_task(task, base_url)
    return translation_worker_service.accept_task(task, base_url)


def register_local_queue_accept_routes(server) -> None:
    """Register the queue-center task accept controller."""

    def accept_handler(params, _request_id, _context):
        task = params.get("task") if isinstance(params.get("task"), dict) else params
        base_url = str(params.get("laravel_endpoint") or "")
        if not isinstance(task, dict) or task.get("task_id") in (None, ""):
            return {"success": False, "error": "task with task_id is required"}
        # The UI claimed this task from its own Laravel endpoint: pycore only
        # runs work of the server it has selected.
        error = laravel_endpoint_manager.work_endpoint_error(base_url)
        if error:
            return {"success": False, "error": error, "error_code": error}
        return _route_task(task, base_url)

    server.post(path=UI_QUEUE_CENTER_ACCEPT_TASK, handler=accept_handler)

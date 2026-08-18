# -*- coding: utf-8 -*-
"""Wire V11.2A RPC routes to application services."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "rpc_routes"

ROUTES: dict[str, str] = {}


def add(name: str, content: str) -> None:
    ROUTES[name] = content


add(
    "local_version_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for version."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_VERSION_VERSION
from pycore.callmodule.services.version_service import get_version


def register_local_version_routes(server):
    async def version_handler(params, request_id, context):
        return await asyncio.to_thread(get_version)

    server.route(name=UI_VERSION_VERSION, handler=version_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered version RPC routes")


__all__ = ["register_local_version_routes"]
''',
)

add(
    "local_queue_bumps_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for queue_bumps."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_BUMPS_LIST_BUMPS
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub


def register_local_queue_bumps_routes(server):
    async def list_bumps_handler(params, request_id, context):
        params = params or {}
        limit = int(params.get("limit") or 30)

        def _run():
            snap = get_queue_bump_hub().snapshot(limit=max(1, min(limit, 60)))
            return {"success": True, **snap}

        return await asyncio.to_thread(_run)

    server.route(name=UI_QUEUE_BUMPS_LIST_BUMPS, handler=list_bumps_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered queue_bumps RPC routes")


__all__ = ["register_local_queue_bumps_routes"]
''',
)

add(
    "local_engines_load_status_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for engines_load_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_ENGINES_LOAD_STATUS_LOAD_STATUS
from pycore.callmodule.services.engines_load_status_service import get_load_status


def register_local_engines_load_status_routes(server):
    async def load_status_handler(params, request_id, context):
        return await asyncio.to_thread(get_load_status)

    server.route(name=UI_ENGINES_LOAD_STATUS_LOAD_STATUS, handler=load_status_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered engines_load_status RPC routes")


__all__ = ["register_local_engines_load_status_routes"]
''',
)

add(
    "local_word_tts_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for word_tts."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_WORD_TTS_STATUS,
    UI_WORD_TTS_CONFIG,
    UI_WORD_TTS_RUN_ONCE,
)
from pycore.callmodule.services.tts_queue_poller_service import get_tts_queue_poller_service
from pycore.callmodule.services.word_tts_auto import apply_auto_start, get_status


def register_local_word_tts_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(get_status)

    server.route(name=UI_WORD_TTS_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        params = params or {}
        if "auto_start" not in params:
            return {"success": False, "error": "auto_start is required"}
        return await asyncio.to_thread(
            apply_auto_start,
            bool(params["auto_start"]),
            params.get("concurrency"),
        )

    server.route(name=UI_WORD_TTS_CONFIG, handler=config_handler, sync=False)

    async def run_once_handler(params, request_id, context):
        def _run():
            try:
                get_tts_queue_poller_service().poll_and_process()
                return {"ok": True}
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "error": str(exc)}

        return await asyncio.to_thread(_run)

    server.route(name=UI_WORD_TTS_RUN_ONCE, handler=run_once_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered word_tts RPC routes")


__all__ = ["register_local_word_tts_routes"]
''',
)

add(
    "local_dictionary_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for dictionary."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_DICTIONARY_DICTIONARY_STATUS,
    UI_DICTIONARY_DICTIONARY_LOOKUP,
)
from pycore.pyutils.translator.dictionary import get_dictionary_service


def register_local_dictionary_routes(server):
    async def dictionary_status_handler(params, request_id, context):
        def _run():
            status = get_dictionary_service().status()
            return {"success": True, **status}

        return await asyncio.to_thread(_run)

    server.route(name=UI_DICTIONARY_DICTIONARY_STATUS, handler=dictionary_status_handler, sync=False)

    async def dictionary_lookup_handler(params, request_id, context):
        params = params or {}

        def _run():
            svc = get_dictionary_service()
            word = str(params.get("word") or "").strip()
            target = str(params.get("target") or "zh")
            if not word:
                return {"success": False, "error": "word is required", "found": False}
            entry = svc.lookup(word)
            entry["success"] = True
            entry["target"] = target
            entry["target_translation"] = svc.translate(word, target)
            return entry

        return await asyncio.to_thread(_run)

    server.route(name=UI_DICTIONARY_DICTIONARY_LOOKUP, handler=dictionary_lookup_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered dictionary RPC routes")


__all__ = ["register_local_dictionary_routes"]
''',
)

add(
    "local_task_settings_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for task_settings."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TASK_SETTINGS_CHAINS,
    UI_TASK_SETTINGS_UPDATE_CHAIN,
)
from pycore.callmodule.services.task_capability_chains import get_chains, save_chain


def register_local_task_settings_routes(server):
    async def chains_handler(params, request_id, context):
        return await asyncio.to_thread(lambda: {"success": True, "chains": get_chains()})

    server.route(name=UI_TASK_SETTINGS_CHAINS, handler=chains_handler, sync=False)

    async def update_chain_handler(params, request_id, context):
        params = params or {}

        def _run():
            result = save_chain(str(params.get("task_type") or ""), list(params.get("priority") or []))
            if not result.get("ok"):
                return {"success": False, **result}
            return {"success": True, **result}

        return await asyncio.to_thread(_run)

    server.route(name=UI_TASK_SETTINGS_UPDATE_CHAIN, handler=update_chain_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered task_settings RPC routes")


__all__ = ["register_local_task_settings_routes"]
''',
)

add(
    "local_translation_queue_routes.py",
    '''# -*- coding: utf-8 -*-
"""RPC Routes for translation_queue."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.callmodule_config.config import Config
from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATION_QUEUE_SET_PRIORITY,
    UI_TRANSLATION_QUEUE_STACK,
    UI_TRANSLATION_QUEUE_GET_TASK_DETAIL,
)
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker_service import get_translation_worker_service
from pycore.pyheartbeat.heartbeat import get_heartbeat_system


def _monitor():
    return get_queue_monitor_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )


def register_local_translation_queue_routes(server):
    async def set_priority_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            _monitor().set_priority,
            params.get("task_id"),
            params.get("priority"),
        )

    server.route(name=UI_TRANSLATION_QUEUE_SET_PRIORITY, handler=set_priority_handler, sync=False)

    async def stack_handler(params, request_id, context):
        params = params or {}

        def _run():
            result = _monitor().stack(
                words=list(params.get("words") or []),
                language=str(params.get("language") or ""),
                target_language=str(params.get("target_language") or ""),
                priority=params.get("priority"),
            )
            if (
                result.get("success") is not False
                and get_heartbeat_system().is_callback_enabled("translation_worker")
            ):
                get_translation_worker_service().poll_once()
            return result

        return await asyncio.to_thread(_run)

    server.route(name=UI_TRANSLATION_QUEUE_STACK, handler=stack_handler, sync=False)

    async def get_task_detail_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(
            _monitor().get_task_detail,
            str(params.get("task_id") or ""),
        )

    server.route(name=UI_TRANSLATION_QUEUE_GET_TASK_DETAIL, handler=get_task_detail_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered translation_queue RPC routes")


__all__ = ["register_local_translation_queue_routes"]
''',
)

if __name__ == "__main__":
    for name, content in ROUTES.items():
        (ROOT / name).write_text(content, encoding="utf-8")
    print("wired", len(ROUTES), "route modules")

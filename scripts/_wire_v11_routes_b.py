# -*- coding: utf-8 -*-
"""Wire V11.2B RPC routes to application services."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "rpc_routes"

FILES = {
    "local_tts_status_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for tts_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TTS_STATUS_STATUS,
    UI_TTS_STATUS_TEST,
    UI_TTS_STATUS_GET_SETTINGS,
    UI_TTS_STATUS_POST_SETTINGS,
    UI_TTS_STATUS_POST_SERVER_ACTION,
)
import pycore.callmodule.services.tts_status_service as tts
from pycore.callmodule.services.tts_status_service import (
    _TtsServerAction,
    _TtsSettingsPatch,
    _TtsTestReq,
)


def register_local_tts_status_routes(server):
    async def status_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(tts.status, int(params.get("refresh") or 0))

    server.route(name=UI_TTS_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        params = params or {}
        req = _TtsTestReq(
            engine=params.get("engine"),
            text=params.get("text"),
            language=params.get("language"),
            rate=params.get("rate"),
        )
        return await asyncio.to_thread(tts.test, req)

    server.route(name=UI_TTS_STATUS_TEST, handler=test_handler, sync=False)

    async def get_settings_handler(params, request_id, context):
        return await asyncio.to_thread(tts.get_settings)

    server.route(name=UI_TTS_STATUS_GET_SETTINGS, handler=get_settings_handler, sync=False)

    async def post_settings_handler(params, request_id, context):
        params = params or {}
        req = _TtsSettingsPatch(**{k: params[k] for k in params if k in _TtsSettingsPatch.model_fields})
        return await asyncio.to_thread(tts.post_settings, req)

    server.route(name=UI_TTS_STATUS_POST_SETTINGS, handler=post_settings_handler, sync=False)

    async def post_server_action_handler(params, request_id, context):
        params = params or {}
        req = _TtsServerAction(**{k: params[k] for k in params if k in _TtsServerAction.model_fields})
        return await asyncio.to_thread(tts.post_server_action, req)

    server.route(name=UI_TTS_STATUS_POST_SERVER_ACTION, handler=post_server_action_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered tts_status RPC routes")


__all__ = ["register_local_tts_status_routes"]
''',
    "local_stt_status_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for stt_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_STT_STATUS_STATUS, UI_STT_STATUS_TEST
import pycore.callmodule.services.stt_status_service as stt
from pycore.callmodule.services.stt_status_service import _SttTestReq


def register_local_stt_status_routes(server):
    async def status_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(stt.status, int(params.get("refresh") or 0))

    server.route(name=UI_STT_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        params = params or {}
        req = _SttTestReq(
            engine=params.get("engine"),
            language=params.get("language"),
            text=params.get("text"),
        )
        return await asyncio.to_thread(stt.test, req)

    server.route(name=UI_STT_STATUS_TEST, handler=test_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered stt_status RPC routes")


__all__ = ["register_local_stt_status_routes"]
''',
    "local_llm_status_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for llm_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LLM_STATUS_STATUS,
    UI_LLM_STATUS_TEST,
    UI_LLM_STATUS_GET_SETTINGS,
    UI_LLM_STATUS_POST_SETTINGS,
    UI_LLM_STATUS_POST_SERVER_ACTION,
)
import pycore.callmodule.services.llm_status_service as llm
from pycore.callmodule.services.llm_status_service import (
    _LlmServerAction,
    _LlmSettingsPatch,
    _LlmTestReq,
)


def register_local_llm_status_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(llm.status)

    server.route(name=UI_LLM_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        params = params or {}
        req = _LlmTestReq(
            engine=params.get("engine"),
            model=params.get("model"),
            text=params.get("text"),
        )
        return await asyncio.to_thread(llm.test, req)

    server.route(name=UI_LLM_STATUS_TEST, handler=test_handler, sync=False)

    async def get_settings_handler(params, request_id, context):
        return await asyncio.to_thread(llm.get_settings)

    server.route(name=UI_LLM_STATUS_GET_SETTINGS, handler=get_settings_handler, sync=False)

    async def post_settings_handler(params, request_id, context):
        params = params or {}
        req = _LlmSettingsPatch(**{k: params[k] for k in params if k in _LlmSettingsPatch.model_fields})
        return await asyncio.to_thread(llm.post_settings, req)

    server.route(name=UI_LLM_STATUS_POST_SETTINGS, handler=post_settings_handler, sync=False)

    async def post_server_action_handler(params, request_id, context):
        params = params or {}
        req = _LlmServerAction(**{k: params[k] for k in params if k in _LlmServerAction.model_fields})
        return await asyncio.to_thread(llm.post_server_action, req)

    server.route(name=UI_LLM_STATUS_POST_SERVER_ACTION, handler=post_server_action_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered llm_status RPC routes")


__all__ = ["register_local_llm_status_routes"]
''',
    "local_ocr_status_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for ocr_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_OCR_STATUS_STATUS, UI_OCR_STATUS_TEST
import pycore.callmodule.services.ocr_status_service as ocr
from pycore.callmodule.services.ocr_status_service import _OcrTestReq


def register_local_ocr_status_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(ocr.status)

    server.route(name=UI_OCR_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        params = params or {}
        req = _OcrTestReq(
            engine=params.get("engine"),
            image_path=params.get("image_path"),
            image_data=params.get("image_data"),
            lang=params.get("lang"),
        )
        return await asyncio.to_thread(ocr.test, req)

    server.route(name=UI_OCR_STATUS_TEST, handler=test_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ocr_status RPC routes")


__all__ = ["register_local_ocr_status_routes"]
''',
    "local_assist_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for assist."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_ASSIST_ASSIST_STATUS,
    UI_ASSIST_ASSIST_CONFIG,
    UI_ASSIST_ASSIST_CYCLE,
)
import pycore.callmodule.services.assist_service as assist
from pycore.callmodule.services.assist_service import CapabilitiesPatch, ConfigRequest


def register_local_assist_routes(server):
    async def assist_status_handler(params, request_id, context):
        params = params or {}
        include = params.get("include_laravel", True)
        return await asyncio.to_thread(assist.assist_status, bool(include))

    server.route(name=UI_ASSIST_ASSIST_STATUS, handler=assist_status_handler, sync=False)

    async def assist_config_handler(params, request_id, context):
        params = params or {}
        caps = params.get("capabilities")
        req = ConfigRequest(
            enabled=params.get("enabled"),
            capabilities=CapabilitiesPatch(**caps) if isinstance(caps, dict) else None,
        )
        return await asyncio.to_thread(assist.assist_config, req)

    server.route(name=UI_ASSIST_ASSIST_CONFIG, handler=assist_config_handler, sync=False)

    async def assist_cycle_handler(params, request_id, context):
        return await asyncio.to_thread(assist.assist_cycle)

    server.route(name=UI_ASSIST_ASSIST_CYCLE, handler=assist_cycle_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered assist RPC routes")


__all__ = ["register_local_assist_routes"]
''',
    "local_ai_keys_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for ai_keys."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_KEYS_LIST_KEYS,
    UI_AI_KEYS_SET_KEY,
    UI_AI_KEYS_RESET_COOLDOWN,
    UI_AI_KEYS_DELETE_KEY,
)
import pycore.callmodule.services.ai_keys_service as keys
from pycore.callmodule.services.ai_keys_service import CooldownResetRequest, KeySetRequest


def register_local_ai_keys_routes(server):
    async def list_keys_handler(params, request_id, context):
        return await asyncio.to_thread(keys.list_keys)

    server.route(name=UI_AI_KEYS_LIST_KEYS, handler=list_keys_handler, sync=False)

    async def set_key_handler(params, request_id, context):
        params = params or {}
        req = KeySetRequest(
            provider=params.get("provider"),
            base_name=params.get("base_name"),
            value=params.get("value"),
            index=int(params.get("index") or 1),
            image=bool(params.get("image") or False),
        )
        return await asyncio.to_thread(keys.set_key, req)

    server.route(name=UI_AI_KEYS_SET_KEY, handler=set_key_handler, sync=False)

    async def reset_cooldown_handler(params, request_id, context):
        params = params or {}
        req = CooldownResetRequest(
            provider=params.get("provider"),
            index=int(params.get("index") or 1),
            image=bool(params.get("image") or False),
        )
        return await asyncio.to_thread(keys.reset_cooldown, req)

    server.route(name=UI_AI_KEYS_RESET_COOLDOWN, handler=reset_cooldown_handler, sync=False)

    async def delete_key_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(keys.delete_key, str(params.get("key_name") or ""))

    server.route(name=UI_AI_KEYS_DELETE_KEY, handler=delete_key_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ai_keys RPC routes")


__all__ = ["register_local_ai_keys_routes"]
''',
    "local_ai_probe_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for ai_probe."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_PROBE_AI_CATALOG,
    UI_AI_PROBE_PROBE,
    UI_AI_PROBE_BALANCE,
)
import pycore.callmodule.services.ai_probe_service as probe


def register_local_ai_probe_routes(server):
    async def ai_catalog_handler(params, request_id, context):
        return await probe.ai_catalog()

    server.route(name=UI_AI_PROBE_AI_CATALOG, handler=ai_catalog_handler, sync=False)

    async def probe_handler(params, request_id, context):
        params = params or {}
        return await probe.probe(
            int(params.get("refresh") or 0),
            params.get("provider"),
        )

    server.route(name=UI_AI_PROBE_PROBE, handler=probe_handler, sync=False)

    async def balance_handler(params, request_id, context):
        params = params or {}
        return await probe.balance(params.get("provider"))

    server.route(name=UI_AI_PROBE_BALANCE, handler=balance_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ai_probe RPC routes")


__all__ = ["register_local_ai_probe_routes"]
''',
    "local_speech_history_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for speech_history."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_SPEECH_HISTORY_HISTORY,
    UI_SPEECH_HISTORY_HISTORY_FILE,
    UI_SPEECH_HISTORY_HISTORY_REVEAL,
    UI_SPEECH_HISTORY_HISTORY_DELETE,
    UI_SPEECH_HISTORY_HISTORY_CLEAR,
)
import pycore.callmodule.services.speech_history_service as hist


def register_local_speech_history_routes(server):
    async def history_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history, int(params.get("limit") or 50))

    server.route(name=UI_SPEECH_HISTORY_HISTORY, handler=history_handler, sync=False)

    async def history_file_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history_file, str(params.get("audio_id") or ""))

    server.route(name=UI_SPEECH_HISTORY_HISTORY_FILE, handler=history_file_handler, sync=False)

    async def history_reveal_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history_reveal, str(params.get("audio_id") or ""))

    server.route(name=UI_SPEECH_HISTORY_HISTORY_REVEAL, handler=history_reveal_handler, sync=False)

    async def history_delete_handler(params, request_id, context):
        params = params or {}
        return await asyncio.to_thread(hist.history_delete, str(params.get("audio_id") or ""))

    server.route(name=UI_SPEECH_HISTORY_HISTORY_DELETE, handler=history_delete_handler, sync=False)

    async def history_clear_handler(params, request_id, context):
        return await asyncio.to_thread(hist.history_clear)

    server.route(name=UI_SPEECH_HISTORY_HISTORY_CLEAR, handler=history_clear_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered speech_history RPC routes")


__all__ = ["register_local_speech_history_routes"]
''',
    "local_heartbeat_workers_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for heartbeat_workers."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_HEARTBEAT_WORKERS_STATUS,
    UI_HEARTBEAT_WORKERS_CONFIG,
)
import pycore.callmodule.services.heartbeat_workers_service as hb


def register_local_heartbeat_workers_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(hb.status)

    server.route(name=UI_HEARTBEAT_WORKERS_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        params = params or {}
        if "enabled" not in params:
            return {"success": False, "error": "enabled is required"}
        return await asyncio.to_thread(
            hb.config,
            str(params.get("callback_name") or ""),
            bool(params["enabled"]),
        )

    server.route(name=UI_HEARTBEAT_WORKERS_CONFIG, handler=config_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered heartbeat_workers RPC routes")


__all__ = ["register_local_heartbeat_workers_routes"]
''',
    "local_system_resources_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for system_resources."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.local_processing.video_extract_controller import VideoExtractController
from pycore.callmodule.rpc_routes.route_names import UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES


def register_local_system_resources_routes(server):
    controller = VideoExtractController()

    async def system_resources_handler(params, request_id, context):
        return await asyncio.to_thread(controller.system_resources)

    server.route(name=UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES, handler=system_resources_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered system_resources RPC routes")


__all__ = ["register_local_system_resources_routes"]
''',
    "local_local_config_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for local_config."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.management.local_processing_controller import LocalProcessingController
from pycore.callmodule.models.management.local_processing_models import LocalProcessingConfig
from pycore.callmodule.rpc_routes.route_names import UI_LOCAL_CONFIG_UPDATE_CONFIG


def register_local_local_config_routes(server):
    controller = LocalProcessingController()

    async def update_config_handler(params, request_id, context):
        params = params or {}
        config = LocalProcessingConfig(**params)
        return await asyncio.to_thread(controller.update_config, config)

    server.route(name=UI_LOCAL_CONFIG_UPDATE_CONFIG, handler=update_config_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered local_config RPC routes")


__all__ = ["register_local_local_config_routes"]
''',
    "management_config_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for management config."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.controllers.management.system_controller import SystemController
from pycore.callmodule.models.management.system_models import SystemConfig
from pycore.callmodule.rpc_routes.route_names import UI_CONFIG_UPDATE_CONFIG


def register_management_config_routes(server):
    controller = SystemController()

    async def update_config_handler(params, request_id, context):
        params = params or {}
        config = SystemConfig(**params)
        return await asyncio.to_thread(controller.update_config, config)

    server.route(name=UI_CONFIG_UPDATE_CONFIG, handler=update_config_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered management config RPC routes")


__all__ = ["register_management_config_routes"]
''',
    "management_heartbeat_routes.py": '''# -*- coding: utf-8 -*-
"""RPC Routes for management heartbeat."""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_HEARTBEAT_GET_CALLBACK_STATUS
from pycore.pyheartbeat.heartbeat import get_heartbeat_system


def register_management_heartbeat_routes(server):
    async def get_callback_status_handler(params, request_id, context):
        params = params or {}
        callback_name = str(params.get("callback_name") or "").strip()
        if not callback_name:
            return {"success": False, "error": "callback_name is required"}
        heartbeat = get_heartbeat_system()
        stats = heartbeat.get_stats()
        callbacks = (stats.get("heartbeat") or {}).get("callbacks") or {}
        if callback_name not in callbacks:
            return {"success": False, "error": f"Callback '{callback_name}' not found"}
        info = callbacks[callback_name]
        return {
            "success": True,
            "callback_name": callback_name,
            "enabled": info.get("enabled", False),
            "interval": info.get("interval", 0),
            "run_count": info.get("run_count", 0),
            "last_run_tick": info.get("last_run_tick", 0),
            "ticks_until_next": info.get("ticks_until_next", 0),
        }

    server.route(name=UI_HEARTBEAT_GET_CALLBACK_STATUS, handler=get_callback_status_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered heartbeat RPC routes")


__all__ = ["register_management_heartbeat_routes"]
''',
}

if __name__ == "__main__":
    for name, content in FILES.items():
        (ROOT / name).write_text(content, encoding="utf-8")
    print("wired", len(FILES), "route modules")

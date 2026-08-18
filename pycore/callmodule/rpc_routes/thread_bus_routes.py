# -*- coding: utf-8 -*-
"""
Thread Bus HTTP Routes

HTTP controller bridge for THREAD_BUS events and live event subscriptions.

Routes:
- thread_bus/trigger_event: trigger a THREAD_BUS event from the web UI

Listener subscriptions (server.register_thread_bus_listener) broadcast state
changes to connected HTTP event clients for real-time UI refresh:
- voice_subtitle_update / voice_subtitle_queue_update /
  voice_subtitle_ui_show / voice_subtitle_ui_hide: voice-subtitle state
- system_settings_update: system-settings changes
- ui.i18n.language_changed: tray/native language switch -> web UI (PcLanguageSync)
- code_sync_update: Code Sync peer-mesh status/config ticks
- engine_load_status_update: per-engine model-load progress (idle/loading/loaded/
  error) for class-B models + class-C servers, TTS+STT
- article.published: agent-history Daily Reading publication
"""

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.callmodule.rpc_routes.route_names import THREAD_BUS_TRIGGER


def register_thread_bus_routes(server):
    """
    Register the thread_bus/trigger_event HTTP controller and the THREAD_BUS
    broadcast listener subscriptions the desktop UI needs for real-time refresh.

    Preserves the event bridge the original create_rpc_server() provided: the web UI
    issues the shared HTTP request with an event name and payload
    (e.g. for subtitle fullscreen mode), which must be turned into a real
    THREAD_BUS event server-side. Also broadcasts voice-subtitle / system-settings
    / language / code-sync state changes to connected HTTP event clients.
    """

    def thread_bus_trigger_event(params, request_id, context):
        event_name = params.get('event_name')
        event_data = params.get('event_data', {})
        if not event_name:
            return {'success': False, 'error': 'event_name required'}
        THREAD_BUS.trigger_event(event_name, event_data)
        return {'success': True, 'event': event_name}

    server.post(
        path=THREAD_BUS_TRIGGER,
        handler=thread_bus_trigger_event,
        description='Trigger a THREAD_BUS event from the web UI',
    )

    # Voice-subtitle state changes -> live UI refresh.
    event_names = (
        BusSignals.VOICE_SUBTITLE_UPDATE,
        BusSignals.VOICE_SUBTITLE_QUEUE_UPDATE,
        BusSignals.VOICE_SUBTITLE_UI_SHOW,
        BusSignals.VOICE_SUBTITLE_UI_HIDE,
        BusSignals.SYSTEM_SETTINGS_UPDATE,
        BusSignals.I18N_LANGUAGE_CHANGED,
        BusSignals.CODE_SYNC_UPDATE,
        BusSignals.COREBOOK_AUTOFLOW,
        BusSignals.ENGINE_LOAD_STATUS_UPDATE,
        BusSignals.ARTICLE_PUBLISHED,
        BusSignals.AGENT_HISTORY_SESSIONS_CHANGED,
        BusSignals.LARAVEL_LOGS_CHANGED,
        BusSignals.SUBTITLE_LANGUAGE_FILL,
        BusSignals.VIDEO_EXTRACT_SYNC,
    )
    for event_name in event_names:
        server.register_thread_bus_listener(event_name)
    # operation.changed is delivered by the durable HTTP API outbox. Registering
    # it here would duplicate every event as a legacy broadcast frame.

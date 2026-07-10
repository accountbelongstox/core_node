# -*- coding: utf-8 -*-
"""
Thread Bus RPC Routes

WebSocket RPC bridge for THREAD_BUS events + live broadcast subscriptions.

Routes:
- thread_bus.trigger_event: trigger a THREAD_BUS event from the web UI

Listener subscriptions (server.register_thread_bus_listener) broadcast state
changes to connected WS clients for real-time UI refresh:
- voice_subtitle_update / voice_subtitle_queue_update /
  voice_subtitle_ui_show / voice_subtitle_ui_hide: voice-subtitle state
- system_settings_update: system-settings changes
- ui.i18n.language_changed: tray/native language switch -> web UI (PcLanguageSync)
- code_sync_update: Code Sync peer-mesh status/config ticks
"""

from pycore import ColorPrint, THREAD_BUS


def register_thread_bus_routes(server):
    """
    Register the thread_bus.trigger_event WS RPC handler and the THREAD_BUS
    broadcast listener subscriptions the desktop UI needs for real-time refresh.

    Restores the WS bridge the original create_rpc_server() provided: the web UI
    issues `rpcClient.call('thread_bus.trigger_event', {event_name, event_data})`
    (e.g. for subtitle fullscreen mode), which must be turned into a real
    THREAD_BUS event server-side. Also broadcasts voice-subtitle / system-settings
    / language / code-sync state changes to connected WS clients.
    """

    async def thread_bus_trigger_event(params, request_id, context):
        params = params or {}
        event_name = params.get('event_name')
        event_data = params.get('event_data', {})
        if not event_name:
            return {'success': False, 'error': 'event_name required'}
        THREAD_BUS.trigger_event(event_name, event_data)
        return {'success': True, 'event': event_name}

    server.route(
        name='thread_bus.trigger_event',
        handler=thread_bus_trigger_event,
        sync=False,
        description='Trigger a THREAD_BUS event from the web UI',
    )

    # Voice-subtitle state changes -> live UI refresh.
    for ev in ('voice_subtitle_update', 'voice_subtitle_queue_update',
               'voice_subtitle_ui_show', 'voice_subtitle_ui_hide'):
        server.register_thread_bus_listener(ev)
    # System-settings changes are broadcast live to the UI via THREAD_BUS.
    server.register_thread_bus_listener('system_settings_update')
    # Tray / native i18n language switches -> web UI sync (PcLanguageSync).
    server.register_thread_bus_listener('ui.i18n.language_changed')
    # Code Sync peer-mesh status/config ticks -> live UI refresh.
    server.register_thread_bus_listener('code_sync_update')

    ColorPrint.green("[ConfigBuilder] Registered thread_bus.trigger_event + broadcast listeners")


__all__ = ['register_thread_bus_routes']

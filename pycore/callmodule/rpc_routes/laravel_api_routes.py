# -*- coding: utf-8 -*-
"""
Laravel API RPC Routes

WebSocket RPC handlers for the multi-endpoint Laravel API manager (laravel_main
base URL). Stored-first resolution + parallel 3s probes; persisted in
user_data.json under the 'laravel_api' section ({endpoints:[...], current}).
All probing runs on THREAD_BUS workers so the event loop stays free.

Routes:
- laravel_api.list: list endpoints with health (parallel probe, 3s cap)
- laravel_api.add: add a candidate endpoint
- laravel_api.remove: remove a candidate endpoint
- laravel_api.select: select + persist the current endpoint
  → also broadcasts `laravel_endpoint_changed` over WS so the UI updates
    even when the caller's promise has already timed out.
- laravel_api.probe: probe one or all endpoints (3s timeout)
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.callmodule.rpc_routes.route_names import (
    LARAVEL_API_ADD,
    LARAVEL_API_LIST,
    LARAVEL_API_PROBE,
    LARAVEL_API_REMOVE,
    LARAVEL_API_SELECT,
)

# Server-side bus timeout for one endpoint call. Kept shorter than the
# front-end 30s RPC timeout so a slow endpoint returns as an error via
# the RPC path first (never the front-end raising RPC-level timeout).
LARAVEL_API_BUS_TIMEOUT = 20.0

# Event name broadcast to every WS client after a successful select.
LARAVEL_ENDPOINT_CHANGED_EVENT = "laravel_endpoint_changed"


def _broadcast_endpoint_changed(server, payload):
    """Broadcast a successful endpoint switch to every WS client.

    Wrapped so a broadcast failure never poisons the RPC response — the
    select() route still succeeds even if fan-out fails.
    """
    try:
        server.broadcast_event_sync(LARAVEL_ENDPOINT_CHANGED_EVENT, payload)
    except Exception as exc:
        ColorPrint.yellow(
            f"[ConfigBuilder] laravel_endpoint_changed broadcast failed: {exc}"
        )


def register_laravel_api_routes(server):
    """Register the laravel_api.* WS RPC handlers (delegate to the endpoint manager)."""

    async def laravel_api_list(params, request_id, context):
        """List endpoints with health. params: { probe?: bool (default true) }.

        Probes every candidate IN PARALLEL (3s cap) unless probe=false, which
        returns the last known results instead.
        """
        params = params or {}
        probe = params.get('probe', True)
        try:
            return await await_bus_task(
                get_laravel_endpoint_manager().list_endpoints,
                bool(probe),
                timeout=LARAVEL_API_BUS_TIMEOUT,
            )
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.list failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_add(params, request_id, context):
        """Add a candidate endpoint. params: { url }. Invalidates the cache."""
        params = params or {}
        try:
            return await await_bus_task(
                get_laravel_endpoint_manager().add,
                params.get('url'),
                timeout=LARAVEL_API_BUS_TIMEOUT,
            )
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.add failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_remove(params, request_id, context):
        """Remove a candidate endpoint. params: { url }. Invalidates the cache."""
        params = params or {}
        try:
            return await await_bus_task(
                get_laravel_endpoint_manager().remove,
                params.get('url'),
                timeout=LARAVEL_API_BUS_TIMEOUT,
            )
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.remove failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_select(params, request_id, context):
        """Persist the user's endpoint choice. params: { url }.

        Adds the URL when missing, sets it as `current`, invalidates the
        resolve cache and probes the selection once for fresh health info.
        On success also broadcasts `laravel_endpoint_changed` so every UI
        connected via WS picks up the new endpoint even if this RPC
        promise has already timed out on the front-end.
        """
        params = params or {}
        try:
            result = await await_bus_task(
                get_laravel_endpoint_manager().select,
                params.get('url'),
                timeout=LARAVEL_API_BUS_TIMEOUT,
            )
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.select failed: {e}")
            return {'success': False, 'error': str(e)}

        if isinstance(result, dict) and result.get('success'):
            _broadcast_endpoint_changed(server, {
                'url': result.get('current'),
                'endpoints': result.get('endpoints', []),
                'current': result.get('current'),
                'selected': result.get('selected'),
            })

        return result

    async def laravel_api_probe(params, request_id, context):
        """Probe ONE endpoint ({url}) or ALL candidates (no url; parallel, 3s cap)."""
        params = params or {}
        try:
            return await await_bus_task(
                get_laravel_endpoint_manager().probe_route,
                params.get('url'),
                timeout=LARAVEL_API_BUS_TIMEOUT,
            )
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.probe failed: {e}")
            return {'success': False, 'error': str(e)}

    server.route(
        name=LARAVEL_API_LIST,
        handler=laravel_api_list,
        sync=False,
        description='List Laravel API endpoints with health (parallel probe, 3s cap)',
    )
    server.route(
        name=LARAVEL_API_ADD,
        handler=laravel_api_add,
        sync=False,
        description='Add a Laravel API endpoint candidate',
    )
    server.route(
        name=LARAVEL_API_REMOVE,
        handler=laravel_api_remove,
        sync=False,
        description='Remove a Laravel API endpoint candidate',
    )
    server.route(
        name=LARAVEL_API_SELECT,
        handler=laravel_api_select,
        sync=False,
        description='Select + persist the current Laravel API endpoint',
    )
    server.route(
        name=LARAVEL_API_PROBE,
        handler=laravel_api_probe,
        sync=False,
        description='Probe one or all Laravel API endpoints (3s timeout)',
    )

    ColorPrint.green("[ConfigBuilder] Registered laravel_api.* RPC routes")


__all__ = ['register_laravel_api_routes', 'LARAVEL_ENDPOINT_CHANGED_EVENT']

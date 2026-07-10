# -*- coding: utf-8 -*-
"""
Laravel API RPC Routes

WebSocket RPC handlers for the multi-endpoint Laravel API manager (laravel_main
base URL). Stored-first resolution + parallel 3s probes; persisted in
user_data.json under the 'laravel_api' section ({endpoints:[...], current}). All
probing runs on a worker thread (asyncio.to_thread) so the event loop stays free.

Routes:
- laravel_api.list: list endpoints with health (parallel probe, 3s cap)
- laravel_api.add: add a candidate endpoint
- laravel_api.remove: remove a candidate endpoint
- laravel_api.select: select + persist the current endpoint
- laravel_api.probe: probe one or all endpoints (3s timeout)
"""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)


def register_laravel_api_routes(server):
    """Register the laravel_api.* WS RPC handlers (delegate to the endpoint manager)."""

    async def laravel_api_list(params, request_id, context):
        """List endpoints with health. params: { probe?: bool (default true) }.

        Probes every candidate IN PARALLEL (3s cap) unless probe=false, which
        returns the last known results instead. Returns {success, endpoints:
        [{url, healthy, latency_ms, last_checked, status, error}], current,
        resolved}.
        """
        params = params or {}
        probe = params.get('probe', True)
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().list_endpoints, bool(probe))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.list failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_add(params, request_id, context):
        """Add a candidate endpoint. params: { url }. Invalidates the cache."""
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().add, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.add failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_remove(params, request_id, context):
        """Remove a candidate endpoint. params: { url }. Invalidates the cache."""
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().remove, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.remove failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_select(params, request_id, context):
        """Persist the user's endpoint choice. params: { url }.

        Adds the URL when missing, sets it as `current`, invalidates the
        resolve cache and probes the selection once for fresh health info.
        """
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().select, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.select failed: {e}")
            return {'success': False, 'error': str(e)}

    async def laravel_api_probe(params, request_id, context):
        """Probe ONE endpoint ({url}) or ALL candidates (no url; parallel, 3s cap)."""
        params = params or {}
        try:
            return await asyncio.to_thread(
                get_laravel_endpoint_manager().probe_route, params.get('url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] laravel_api.probe failed: {e}")
            return {'success': False, 'error': str(e)}

    server.route(
        name='laravel_api.list',
        handler=laravel_api_list,
        sync=False,
        description='List Laravel API endpoints with health (parallel probe, 3s cap)',
    )
    server.route(
        name='laravel_api.add',
        handler=laravel_api_add,
        sync=False,
        description='Add a Laravel API endpoint candidate',
    )
    server.route(
        name='laravel_api.remove',
        handler=laravel_api_remove,
        sync=False,
        description='Remove a Laravel API endpoint candidate',
    )
    server.route(
        name='laravel_api.select',
        handler=laravel_api_select,
        sync=False,
        description='Select + persist the current Laravel API endpoint',
    )
    server.route(
        name='laravel_api.probe',
        handler=laravel_api_probe,
        sync=False,
        description='Probe one or all Laravel API endpoints (3s timeout)',
    )

    ColorPrint.green("[ConfigBuilder] Registered laravel_api.* RPC routes")


__all__ = ['register_laravel_api_routes']

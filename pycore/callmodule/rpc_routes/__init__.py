# -*- coding: utf-8 -*-
"""
RPC Routes - Modular Route Registration for the desktop UI WS bridge.

Exports the per-area route registration functions called by
callmodule.config._init_rpc_routes. Mirrors the pycore/pyctl/speech/rpc/routes
convention: one file per functional area, each exposing a
``register_<area>_routes(server)`` function.

Route Modules:
- thread_bus_routes: thread_bus.trigger_event + THREAD_BUS broadcast listeners
- video_extract_routes: video_extract.sync_source / backend_status / sync_all
- media_routes: book.sync_source + media.enrich
- laravel_api_routes: laravel_api.list/add/remove/select/probe
"""

from pycore.callmodule.rpc_routes.thread_bus_routes import register_thread_bus_routes
from pycore.callmodule.rpc_routes.video_extract_routes import register_video_extract_routes
from pycore.callmodule.rpc_routes.media_routes import register_media_routes
from pycore.callmodule.rpc_routes.laravel_api_routes import register_laravel_api_routes

__all__ = [
    'register_thread_bus_routes',
    'register_video_extract_routes',
    'register_media_routes',
    'register_laravel_api_routes',
]

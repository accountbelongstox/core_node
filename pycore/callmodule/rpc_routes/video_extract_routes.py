# -*- coding: utf-8 -*-
"""
Video Extract RPC Routes

WebSocket RPC handlers for syncing scanned video-extract sources to laravel_main
(:9000) and comparing local extract outputs against backend holdings.

Routes:
- video_extract.sync_source: idempotently sync a scanned source to laravel_main
- video_extract.backend_status: compare local outputs vs laravel_main holdings
- video_extract.sync_all: one-click idempotent sync of every known source
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.callmodule.services.sync.laravel_media_sync import (
    backend_status,
    sync_all,
    sync_source,
)
from pycore.callmodule.services.sync.laravel_media_query_service import (
    get_media_detail,
    list_media,
)
from pycore.callmodule.rpc_routes.route_names import (
    VIDEO_EXTRACT_BACKEND_MEDIA_DETAIL,
    VIDEO_EXTRACT_BACKEND_MEDIA_LIST,
    VIDEO_EXTRACT_BACKEND_STATUS,
    VIDEO_EXTRACT_SYNC_ALL,
    VIDEO_EXTRACT_SYNC_SOURCE,
)


def register_video_extract_routes(server):
    """Register the video_extract.* WS RPC handlers."""

    async def video_extract_sync_source(params, request_id, context):
        """Idempotently sync a scanned source's media to laravel_main (:9000).

        params: { source_path | paths:[...], language? }. Runs the (blocking,
        network-heavy) sync on a THREAD_BUS worker so the event
        loop stays responsive. Progress streams over ColorPrint (UI log WS) AND a
        'video_extract_sync' THREAD_BUS event per stage. Returns the summary (one
        source) or a {results:[...]} aggregate (multiple paths).
        """
        params = params or {}
        language = params.get('language') or 'en'
        # Checked correspondence language set (Lsel, v3 subtitles). Optional: when
        # omitted sync_source unions only the detected languages with the primary.
        languages = params.get('languages')
        paths = params.get('paths')
        single = params.get('source_path')
        # Precondition guard: need at least one usable source path.
        targets = [p for p in (paths or ([single] if single else []))
                   if p and str(p).strip()]
        if not targets:
            return {'success': False, 'error': 'source_path (or paths) required'}

        try:
            if len(targets) == 1:
                return await await_bus_task(
                    sync_source, targets[0], language, None, None, languages)
            results = []
            for p in targets:
                results.append(await await_bus_task(
                    sync_source, p, language, None, None, languages))
            return {
                'success': all(r.get('success') for r in results),
                'count': len(results),
                'results': results,
            }
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] video_extract.sync_source failed: {e}")
            return {'success': False, 'error': str(e)}

    async def video_extract_backend_status(params, request_id, context):
        """Compare local extract outputs against what laravel_main actually holds.

        params: { paths?:[...], base_url? }. Defaults to ALL history entry paths
        and uses the SAME base-url resolution as the sync engine, so the status
        panel and the sync always target the same host. Runs the (network-bound)
        probe on a THREAD_BUS worker. An unreachable backend
        degrades to reachable:false (never raises from the probe itself).
        """
        params = params or {}
        try:
            return await await_bus_task(
                backend_status, params.get('paths'), params.get('base_url'))
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] video_extract.backend_status failed: {e}")
            return {'success': False, 'error': str(e)}

    async def video_extract_sync_all(params, request_id, context):
        """One-click idempotent sync of EVERY known source to laravel_main (:9000).

        params: { paths?:[...], language? }. Defaults to ALL history entry paths,
        dedupes overlapping output dirs, then runs sync_source per remaining path
        sequentially. Runs the (blocking, network-heavy) sync on a worker thread
        via a THREAD_BUS worker so the event loop stays responsive. Progress streams
        over ColorPrint (UI log WS) AND a 'video_extract_sync' THREAD_BUS event
        per stage (plus an outer stage="source" event per path). Returns the
        aggregate summary.
        """
        params = params or {}
        language = params.get('language') or 'en'
        languages = params.get('languages')  # checked Lsel (v3 subtitles), optional
        try:
            return await await_bus_task(
                sync_all, params.get('paths'), language, None, None, languages)
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] video_extract.sync_all failed: {e}")
            return {'success': False, 'error': str(e)}

    async def video_extract_backend_media_list(params, request_id, context):
        """Read one Laravel media list through the pycore HTTP boundary."""
        params = params or {}
        return await await_bus_task(
            list_media,
            params.get('kind') or '',
            params.get('page') or 1,
            params.get('per_page') or 8,
        )

    async def video_extract_backend_media_detail(params, request_id, context):
        """Read Laravel media detail through the pycore HTTP boundary."""
        params = params or {}
        return await await_bus_task(
            get_media_detail,
            params.get('kind') or '',
            params.get('source_key') or '',
            params.get('grain') or 'sentence',
        )

    server.route(
        name=VIDEO_EXTRACT_SYNC_SOURCE,
        handler=video_extract_sync_source,
        sync=False,
        description='Idempotently sync a scanned source to laravel_main',
    )
    server.route(
        name=VIDEO_EXTRACT_BACKEND_STATUS,
        handler=video_extract_backend_status,
        sync=False,
        description='Compare local extract outputs against laravel_main holdings',
    )
    server.route(
        name=VIDEO_EXTRACT_BACKEND_MEDIA_LIST,
        handler=video_extract_backend_media_list,
        sync=False,
        description='Read a Laravel media list through pycore',
    )
    server.route(
        name=VIDEO_EXTRACT_BACKEND_MEDIA_DETAIL,
        handler=video_extract_backend_media_detail,
        sync=False,
        description='Read Laravel media detail through pycore',
    )
    server.route(
        name=VIDEO_EXTRACT_SYNC_ALL,
        handler=video_extract_sync_all,
        sync=False,
        description='Idempotently sync every known source to laravel_main',
    )

    ColorPrint.green("[ConfigBuilder] Registered video_extract.* RPC routes")


__all__ = ['register_video_extract_routes']

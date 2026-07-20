# -*- coding: utf-8 -*-
"""
Media RPC Routes

WebSocket RPC handlers for book ingestion (shared sentence library) and
sentence-library enrichment.

Routes:
- book.sync_source: idempotently ingest book(s) into the shared sentence library
- media.enrich: trigger laravel_main sentence-library enrichment
"""

import asyncio
import os

from pycore import ColorPrint
from pycore.callmodule.services.sync.laravel_media_sync import (
    resolve_laravel_base_url,
    sync_book_source,
)
from pycore.callmodule.services.processors.book_processor import iter_books
# Unified pycore->Laravel HTTP gateway (times + logs + records every call).
from pycore.callmodule.services.sync.laravel_client import get_laravel_client


def register_media_routes(server):
    """Register the book.sync_source + media.enrich WS RPC handlers."""

    async def book_sync_source(params, request_id, context):
        """Idempotently ingest book(s) into the shared sentence library (:9000).

        params: { source_path | paths:[...], language? }. Books map ONLY to the
        sentence library (no segments/clips). Runs the (blocking, network-heavy)
        ingest on a worker thread via asyncio.to_thread. Progress streams over
        ColorPrint AND a 'video_extract_sync' THREAD_BUS event per stage. Returns
        the summary (one book) or a {results:[...]} aggregate (multiple paths).
        """
        params = params or {}
        language = params.get('language') or 'en'
        # Checked correspondence language set (Lsel, v3). Optional: when omitted
        # sync_book_source defaults to just the declared/detected primary.
        languages = params.get('languages')
        # 'book' (default) or 'document' (Add Document sub-tab) - sets the ingest
        # source_type so document rows land in the document bucket.
        source_type = params.get('source_type') or 'book'
        paths = params.get('paths')
        single = params.get('source_path')
        targets = [p for p in (paths or ([single] if single else []))
                   if p and str(p).strip()]
        if not targets:
            return {'success': False, 'error': 'source_path (or paths) required'}

        # Expand any folder into its book files; a folder "source" should ingest
        # every book it contains (sync_book_source itself handles one file).
        try:
            expanded = []
            for t in targets:
                if os.path.isdir(t):
                    expanded.extend(str(p) for p in iter_books(t))
                else:
                    expanded.append(t)
            if expanded:
                targets = expanded
        except Exception as e:
            ColorPrint.yellow(f"[ConfigBuilder] book folder expansion skipped: {e}")

        try:
            if len(targets) == 1:
                return await asyncio.to_thread(
                    sync_book_source, targets[0], language, None, None, None, None,
                    languages, 3, source_type)
            results = []
            for p in targets:
                results.append(await asyncio.to_thread(
                    sync_book_source, p, language, None, None, None, None,
                    languages, 3, source_type))
            return {
                'success': all(r.get('success') for r in results),
                'count': len(results),
                'results': results,
            }
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] book.sync_source failed: {e}")
            return {'success': False, 'error': str(e)}

    async def media_enrich(params, request_id, context):
        """Trigger Laravel's sentence-library enrichment via pycore.

        params: { limit?:int, language? }. Forwards to laravel_main's
        /api/app_qy_v1/media/enrich (built by another role) and returns its JSON.
        Returns a clear error if the endpoint 404s / is unreachable.
        """
        params = params or {}
        body = {}
        if params.get('limit') is not None:
            body['limit'] = params.get('limit')
        if params.get('language'):
            body['language'] = params.get('language')

        def _do_enrich():
            base = resolve_laravel_base_url()
            url = base + '/api/app_qy_v1/media/enrich'
            try:
                resp = get_laravel_client().post(
                    '/api/app_qy_v1/media/enrich',
                    base_url=base,
                    json=body,
                    timeout=120,
                )
            except Exception as e:
                return {'success': False, 'error': f'enrich unreachable: {e}', 'url': url}
            if resp.status_code in (200, 201):
                try:
                    return resp.json()
                except Exception:
                    return {'success': True, 'status': resp.status_code, 'text': resp.text[:500]}
            return {'success': False,
                    'error': f'HTTP {resp.status_code}: {resp.text[:200]}', 'url': url}

        try:
            return await asyncio.to_thread(_do_enrich)
        except Exception as e:
            ColorPrint.red(f"[ConfigBuilder] media.enrich failed: {e}")
            return {'success': False, 'error': str(e)}

    server.route(
        name='book.sync_source',
        handler=book_sync_source,
        sync=False,
        description='Idempotently ingest book(s) into the shared sentence library',
    )
    server.route(
        name='media.enrich',
        handler=media_enrich,
        sync=False,
        description='Trigger laravel_main sentence-library enrichment',
    )

    ColorPrint.green("[ConfigBuilder] Registered book.sync_source + media.enrich RPC routes")


__all__ = ['register_media_routes']

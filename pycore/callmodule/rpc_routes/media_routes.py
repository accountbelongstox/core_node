# -*- coding: utf-8 -*-
"""Register Laravel media controllers on RPC v2."""

from pycore.callmodule.rpc_routes.route_names import BOOK_SYNC_SOURCE, MEDIA_ENRICH
import pycore.pyctl.laravel.media_service as laravel_media_service
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_media_routes(server) -> None:
    """Register thin Laravel media controller adapters."""

    server.route(
        name=BOOK_SYNC_SOURCE,
        handler=laravel_media_service.sync_book,
        description="Idempotently ingest books into the sentence library",
    )
    server.route(
        name=MEDIA_ENRICH,
        handler=laravel_media_service.enrich,
        description="Trigger sentence-library enrichment",
    )
    ColorPrint.green("[ConfigBuilder] Registered media RPC routes")


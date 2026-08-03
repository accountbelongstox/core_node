# -*- coding: utf-8 -*-
"""Register Laravel media controllers on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import BOOK_SYNC_SOURCE
import pycore.pyctl.laravel.media_service as laravel_media_service


def register_media_routes(server) -> None:
    """Register thin Laravel media controller adapters."""

    server.post(
        path=BOOK_SYNC_SOURCE,
        handler=laravel_media_service.sync_book,
        description="Idempotently ingest books into the sentence library",
    )

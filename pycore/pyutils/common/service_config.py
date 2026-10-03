# -*- coding: utf-8 -*-
"""Central code-backed service and worker configuration."""

import os
import time
from typing import Iterable

from pycore.pyfoundations.notebook_policy import notebook_assist_node
from pycore.pyfoundations.service_contract import laravel_api_catalog_urls, service_domain
from pycore.pyutils.common.strtools.normalization import to_bool


# ONE process-wide pyservice start anchor. Every worker log prefix derives
# its "+<elapsed>s" uptime from this shared constant, so all lanes measure
# uptime from the same service boot instead of per-worker construction.
PYSERVICE_STARTED_AT = time.time()
PYSERVICE_STARTED_MONOTONIC = time.monotonic()

LARAVEL_WORKER_API_URL = (
    os.environ.get("LARAVEL_WORKER_API_URL", "").strip().rstrip("/")
    or f"https://{service_domain('laravel_api')}"
)
# Same catalog as the UI (service_contract laravel_api_catalog_urls), the
# runtime default first.
LARAVEL_WORKER_API_URLS = tuple(dict.fromkeys([LARAVEL_WORKER_API_URL, *laravel_api_catalog_urls()]))


def laravel_worker_api_urls(mesh_domain_value: str = "", mesh_machine_hosts: Iterable[str] = ()) -> tuple:
    """The catalog with the mesh machines of the given (live) tailnet domain."""
    return tuple(dict.fromkeys([LARAVEL_WORKER_API_URL, *laravel_api_catalog_urls(mesh_domain_value, mesh_machine_hosts)]))
PYCORE_WORKER_INSTANCE = ""
TRAY_BACKEND = "native"
UI_ENABLE_TRAY = TRAY_BACKEND == "pyside"
NO_TRAY_ENV = "PYCORE_NO_TRAY"


def tray_disabled() -> bool:
    return to_bool(os.environ.get(NO_TRAY_ENV, "")) or notebook_assist_node()


def qt_tray_enabled() -> bool:
    return UI_ENABLE_TRAY and not tray_disabled()
TRANSLATION_QUEUE_BUMP_TTL_SECONDS = 30
TTS_WORKER_CONCURRENCY = 0
TTS_SENTENCE_WORKER_CONCURRENCY = 0

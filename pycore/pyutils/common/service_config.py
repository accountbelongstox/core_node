# -*- coding: utf-8 -*-
"""Central code-backed service and worker configuration."""

from pycore.pyfoundations.service_contract import service_domain


LARAVEL_WORKER_API_URL = f"https://{service_domain('laravel_api')}"
PYCORE_WORKER_INSTANCE = ""
TRAY_BACKEND = "native"
UI_ENABLE_TRAY = TRAY_BACKEND == "pyside"
TRANSLATION_QUEUE_BUMP_TTL_SECONDS = 30
TTS_WORKER_CONCURRENCY = 0
TTS_SENTENCE_WORKER_CONCURRENCY = 0

# -*- coding: utf-8 -*-
from typing import Dict

PYCORE_CLIENT_HEADER = "X-Core-Node-Client"
PYCORE_CLIENT_ID = "pycore"
CORE_NODE_PROTOCOL_HEADER = "X-Core-Node-Protocol"
CORE_NODE_PROTOCOL_VERSION = "1"
LARAVEL_SERVICE_HEADER = "X-Core-Node-Service"
LARAVEL_SERVICE_ID = "laravel_main"
LARAVEL_HEALTH_SERVICE = "Laravel API"


def build_pycore_identity_headers() -> Dict[str, str]:
    return {
        PYCORE_CLIENT_HEADER: PYCORE_CLIENT_ID,
        CORE_NODE_PROTOCOL_HEADER: CORE_NODE_PROTOCOL_VERSION,
    }

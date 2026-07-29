# -*- coding: utf-8 -*-
"""RPC Routes for ocr_status."""

import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_OCR_STATUS_STATUS, UI_OCR_STATUS_TEST
import pycore.callmodule.services.ocr_status_service as ocr


def register_local_ocr_status_routes(server):
    async def status_handler(params, request_id, context):
        return await asyncio.to_thread(ocr.status)

    server.route(name=UI_OCR_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        return await asyncio.to_thread(ocr.test, params or {})

    server.route(name=UI_OCR_STATUS_TEST, handler=test_handler, sync=False)
    ColorPrint.green("[ConfigBuilder] Registered ocr_status RPC routes")


__all__ = ["register_local_ocr_status_routes"]

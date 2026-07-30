# -*- coding: utf-8 -*-
"""RPC Routes for ocr_status."""


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import UI_OCR_STATUS_STATUS, UI_OCR_STATUS_TEST
import pycore.pyutils.ocr_cluster.status_service as ocr


def register_local_ocr_status_routes(server):
    server.route(name=UI_OCR_STATUS_STATUS, handler=ocr.status)
    server.route(name=UI_OCR_STATUS_TEST, handler=ocr.test)
    ColorPrint.green("[ConfigBuilder] Registered ocr_status RPC routes")


# -*- coding: utf-8 -*-
"""HTTP Routes for ocr_status."""


from pycore.callmodule.rpc_routes.route_names import UI_OCR_STATUS_STATUS, UI_OCR_STATUS_TEST
import pycore.pyutils.ocr_cluster.status_service as ocr


def register_local_ocr_status_routes(server):
    server.post(name=UI_OCR_STATUS_STATUS, handler=ocr.status)
    server.post(name=UI_OCR_STATUS_TEST, handler=ocr.test)


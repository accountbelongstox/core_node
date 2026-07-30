# -*- coding: utf-8 -*-
"""Canonical HTTP paths for device sync."""

import urllib.parse

from pycore.pyfoundations.pygvar import HTTP_EVENTS_PATH


ROOT_PATH = "/"
API_PREFIX = "/api/"
STATUS_PATH = f"{API_PREFIX}status"
FILES_PATH = f"{API_PREFIX}files"
FILE_PATH_PREFIX = f"{API_PREFIX}file/"
DEVICES_PATH = f"{API_PREFIX}devices"
EVENTS_PATH = HTTP_EVENTS_PATH
SYNC_STATUS_PATH = f"{API_PREFIX}sync/status"
SYNC_START_PATH = f"{API_PREFIX}sync/start"
SYNC_STOP_PATH = f"{API_PREFIX}sync/stop"


def file_download_path(file_path: str) -> str:
    return FILE_PATH_PREFIX + urllib.parse.quote(str(file_path or ""))


__all__ = [
    "API_PREFIX",
    "DEVICES_PATH",
    "EVENTS_PATH",
    "FILES_PATH",
    "FILE_PATH_PREFIX",
    "ROOT_PATH",
    "STATUS_PATH",
    "SYNC_START_PATH",
    "SYNC_STATUS_PATH",
    "SYNC_STOP_PATH",
    "file_download_path",
]

# -*- coding: utf-8 -*-

from pathlib import Path

from pycore.database.repositories.json_record_store import JsonRecordStore


def open_record_store(path: Path) -> JsonRecordStore:
    return JsonRecordStore(path)

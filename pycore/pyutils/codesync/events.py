# -*- coding: utf-8 -*-
"""Code Sync event publication: in-process THREAD_BUS listeners and the event journal."""

from typing import Any, Dict

from pycore.pyfoundations.event_journal import event_journal
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

CODE_SYNC_LOG_TOPIC = "code_sync_log"


def publish_code_sync_update(snapshot: Dict[str, Any]) -> None:
    THREAD_BUS.trigger_event(BusSignals.CODE_SYNC_UPDATE, snapshot)
    event_journal.publish_topic(BusSignals.CODE_SYNC_UPDATE, snapshot)


def publish_code_sync_log(entry: Dict[str, Any]) -> None:
    event_journal.publish_topic(CODE_SYNC_LOG_TOPIC, entry)


__all__ = ["CODE_SYNC_LOG_TOPIC", "publish_code_sync_update", "publish_code_sync_log"]

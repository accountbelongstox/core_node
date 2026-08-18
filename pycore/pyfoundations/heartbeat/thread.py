# -*- coding: utf-8 -*-
"""Heartbeat TaskModel / TaskHandler bases (rpc_v2 and pyfoundations heartbeat)."""

from typing import Any


class TaskModel:
    """Base model for heartbeat-scheduled tasks."""

    def get_name(self) -> str:
        raise NotImplementedError

    def has_pending_data(self) -> bool:
        return False

    def get_pending_data(self) -> Any:
        return None

    def get_handler_class(self) -> str:
        raise NotImplementedError

    def get_interval(self) -> int:
        return 1

    def get_priority(self) -> int:
        return 100


class TaskHandler:
    """Base handler invoked by the heartbeat scheduler for a TaskModel."""

    def process(self, data: Any) -> bool:
        raise NotImplementedError

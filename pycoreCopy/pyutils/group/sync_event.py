"""Sync event data class"""

from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class SyncEvent:
    """
    Synchronization event

    Attributes:
        from_device: Source device serial
        event_type: Event type (touch/key/text/etc.)
        event_data: Event data dictionary
    """
    from_device: str
    event_type: str
    event_data: Dict[str, Any]

    def __repr__(self) -> str:
        return (
            f"SyncEvent(from={self.from_device}, "
            f"type={self.event_type}, "
            f"data_keys={list(self.event_data.keys())})"
        )

import math
import time
from typing import Dict, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract


class RelayRequestClock:
    def __init__(self) -> None:
        self._samples: Dict[str, Tuple[float, float, float]] = {}
        init_serialized_owner(self, "relay.request_clock", "RelayRequestClockThread")

    @serialized_method
    def ready(self, endpoint: str) -> bool:
        sample = self._samples.get(endpoint.rstrip("/"))
        return bool(sample and 0 <= time.monotonic() - sample[2] < relay_contract.duration("signature_clock_skew_seconds"))

    @serialized_method
    def observe(self, endpoint: str, server_epoch: float, started: float, received: float) -> bool:
        key = endpoint.rstrip("/")
        elapsed = received - started
        previous = self._samples.get(key)
        midpoint = started + elapsed / 2
        if not math.isfinite(server_epoch) or server_epoch <= 0 or not 0 <= elapsed < relay_contract.duration("signature_clock_skew_seconds"):
            return False
        if previous and received < previous[2]:
            return False
        if previous is None or abs(server_epoch - (previous[0] + midpoint - previous[1])) >= 1:
            relay_activity_log.info(
                "clock.server.synchronized", endpoint=key,
                local_skew_seconds=round(server_epoch + elapsed / 2 - time.time(), 3),
                round_trip_ms=round(elapsed * 1000, 1),
            )
        self._samples[key] = (server_epoch, midpoint, received)
        return True

    @serialized_method
    def timestamp(self, endpoint: str) -> int:
        sample = self._samples.get(endpoint.rstrip("/"))
        if sample is None:
            raise RuntimeError("relay_server_clock_unavailable")
        return int(sample[0] + time.monotonic() - sample[1])


relay_request_clock = RelayRequestClock()

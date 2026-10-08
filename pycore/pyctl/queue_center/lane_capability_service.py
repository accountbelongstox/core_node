# -*- coding: utf-8 -*-
"""Lane capability of this pycore node: per work-lease lane the languages and
engines its claim declares (the same values the lease claim sends), plus the
node identity Laravel knows it by."""

from typing import Any, Dict

from pycore.pyctl.laravel.worker.registration import node_device_id
from pycore.pyctl.laravel.worker.work_leases import WORK_LEASE_LANES, work_node_sid
from pycore.pyctl.queue_center.lane_registry import lane_worker


class LaneCapabilityService:
    """Answers the ``ui/queue_center/lane_capability`` RPC."""

    @staticmethod
    def snapshot() -> Dict[str, Any]:
        workers = {lane: lane_worker(lane) for lane in WORK_LEASE_LANES}
        return {
            "success": True,
            "node_sid": work_node_sid(),
            "device_id": node_device_id(),
            "compute_class": workers[WORK_LEASE_LANES[0]].compute_identity["compute_class"],
            "lanes": {lane: worker.declared_capability() for lane, worker in workers.items()},
        }


lane_capability_service = LaneCapabilityService()


__all__ = ["LaneCapabilityService", "lane_capability_service"]

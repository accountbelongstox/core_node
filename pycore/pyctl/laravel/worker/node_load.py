# -*- coding: utf-8 -*-
"""Node load snapshot of a work-lease claim / renew (contract
``work_leases.load_schema``): host CPU, memory and GPUs plus the per-lane queue
figures. Stateless latest sample; Laravel never routes by it."""

from typing import Any, Dict

from pycore.pyfoundations.time_utils import utc_now_iso
from pycore.pyutils.common.system_resources import system_resources
from pycore.pyutils.tts.audio_queue_center import audio_queue_center
from pycore.pyutils.tts.audio_queue_model import AUDIO_QUEUE_LANES

PERCENT_DIGITS = 1


class WorkNodeLoad:
    """Builds the ``load`` field of a claim / renew request."""

    @staticmethod
    def snapshot() -> Dict[str, Any]:
        resources = system_resources.snapshot()
        return {
            "sampled_at": utc_now_iso(True),
            "cpu_percent": round(float(resources["cpu_percent"]), PERCENT_DIGITS),
            "mem_percent": round(float(resources["mem"]["percent"]), PERCENT_DIGITS),
            "gpus": resources["gpus"],
            "lanes": {lane: audio_queue_center.lane_load(lane) for lane in AUDIO_QUEUE_LANES},
        }


work_node_load = WorkNodeLoad()


__all__ = ["WorkNodeLoad", "work_node_load"]

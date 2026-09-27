# -*- coding: utf-8 -*-
"""Service startup of the shared Laravel delivery outbox.

Importing a delivery module never starts I/O: the feature kinds register
here and ``laravel_delivery_outbox.start()`` subscribes to the online /
switch edges, migrates stored rows and reconciles the active Laravel server.
Audio lane kinds register when their workers are created.
"""

from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox
from pycore.pyctl.agent_history.pipeline.delivery import agent_history_delivery
from pycore.pyctl.audio_orchestration.orch_delivery import orch_delivery
from pycore.pyctl.tts.audio_resource_delivery import audio_resource_delivery


def start_laravel_delivery() -> None:
    audio_resource_delivery.register()
    orch_delivery.register()
    agent_history_delivery.register()
    laravel_delivery_outbox.start()


__all__ = ["start_laravel_delivery"]

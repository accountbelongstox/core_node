# -*- coding: utf-8 -*-
"""Service startup of the shared Laravel delivery outbox.

Importing a delivery module never starts I/O: the feature kinds register
here and ``laravel_delivery_outbox.start()`` subscribes to the online /
switch edges, migrates stored rows and reconciles the active Laravel server.
Audio lane kinds register when their workers are created. The MeshSync fan-out
kind carries replicated records to every online Laravel server; terminal history
publishes into it once the outbox runs.
"""

from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox
from pycore.pyutils.laravel.mesh_sync_publisher import mesh_sync_publisher
from pycore.pyctl.agent_history.pipeline.delivery import agent_history_delivery
from pycore.pyctl.audio_orchestration.orch_delivery import orch_delivery
from pycore.pyctl.terminal.terminal_mesh_sync import terminal_mesh_sync
from pycore.pyctl.tts.audio_resource_delivery import audio_resource_delivery


def start_laravel_delivery() -> None:
    audio_resource_delivery.register()
    orch_delivery.register()
    agent_history_delivery.register()
    mesh_sync_publisher.register()
    laravel_delivery_outbox.start()
    terminal_mesh_sync.start()


__all__ = ["start_laravel_delivery"]

"""
pyutils.group - Group control algorithm module

Features:
- Master-slave device relationship management
- Event broadcasting strategy
- Synchronization rules
- Device group coordination

Dependencies:
- Standard library only

Characteristics:
- Stateless (does not depend on WebSocket)
- Pure algorithm logic
- Easy to test

Example:
    from pycore.pyutils.group import GroupController, AllSyncStrategy, SyncEvent

    # Create group controller
    controller = GroupController()

    # Set master device
    controller.set_master("device1")

    # Add slave devices
    controller.add_slave("device2")
    controller.add_slave("device3")

    # Create sync event
    event = SyncEvent(
        from_device="device1",
        event_type="touch",
        event_data={"x": 500, "y": 1000}
    )

    # Get sync targets
    targets = controller.get_sync_targets(event)
    # Returns: {"device2", "device3"}
"""

from pycore.pyutils.group.group_controller import GroupController
from pycore.pyutils.group.sync_strategy import SyncStrategy, AllSyncStrategy, SelectiveSyncStrategy, TouchOnlySyncStrategy
from pycore.pyutils.group.sync_event import SyncEvent

__all__ = [
    'GroupController',
    'SyncStrategy',
    'AllSyncStrategy',
    'SelectiveSyncStrategy',
    'TouchOnlySyncStrategy',
    'SyncEvent'
]

__version__ = '1.0.0'

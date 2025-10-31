"""Group control service"""

from typing import Optional, Dict, Set
from pycore.pyutils.group import GroupController, SyncStrategy, AllSyncStrategy


class GroupService:
    """
    Group control service

    Responsibilities:
    - Manage device groups
    - Coordinate master-slave relationships
    - Broadcast control events to slave devices
    """

    _instance: Optional['GroupService'] = None

    def __init__(self):
        self.groups: Dict[str, GroupController] = {}  # groupId -> GroupController
        self.group_enabled: Dict[str, bool] = {}  # groupId -> enabled

    @classmethod
    def instance(cls) -> 'GroupService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def create_group(self, group_id: str, host_serial: str) -> bool:
        """
        Create a new device group

        Args:
            group_id: Unique group identifier
            host_serial: Master device serial

        Returns:
            Success status
        """
        try:
            if group_id in self.groups:
                print(f"Group {group_id} already exists")
                return False

            # Create group with AllSyncStrategy (sync all events)
            strategy = AllSyncStrategy()
            controller = GroupController(strategy=strategy)

            # Set master device
            controller.set_master(host_serial)

            self.groups[group_id] = controller
            self.group_enabled[group_id] = False

            print(f"Created group {group_id} with host {host_serial}")
            return True

        except Exception as e:
            print(f"Failed to create group {group_id}: {e}")
            return False

    async def add_slave(self, group_id: str, slave_serial: str) -> bool:
        """
        Add slave device to group

        Args:
            group_id: Group ID
            slave_serial: Slave device serial

        Returns:
            Success status
        """
        try:
            if group_id not in self.groups:
                print(f"Group {group_id} does not exist")
                return False

            controller = self.groups[group_id]
            controller.slave_devices.add(slave_serial)

            print(f"Added slave {slave_serial} to group {group_id}")
            return True

        except Exception as e:
            print(f"Failed to add slave to group {group_id}: {e}")
            return False

    async def remove_slave(self, group_id: str, slave_serial: str) -> bool:
        """
        Remove slave device from group

        Args:
            group_id: Group ID
            slave_serial: Slave device serial

        Returns:
            Success status
        """
        try:
            if group_id not in self.groups:
                return False

            controller = self.groups[group_id]
            controller.slave_devices.discard(slave_serial)

            print(f"Removed slave {slave_serial} from group {group_id}")
            return True

        except Exception as e:
            print(f"Failed to remove slave from group {group_id}: {e}")
            return False

    async def enable_group(self, group_id: str) -> bool:
        """
        Enable group control

        Args:
            group_id: Group ID

        Returns:
            Success status
        """
        if group_id not in self.groups:
            return False

        self.group_enabled[group_id] = True
        print(f"Enabled group {group_id}")
        return True

    async def disable_group(self, group_id: str) -> bool:
        """
        Disable group control

        Args:
            group_id: Group ID

        Returns:
            Success status
        """
        if group_id not in self.groups:
            return False

        self.group_enabled[group_id] = False
        print(f"Disabled group {group_id}")
        return True

    async def get_state(self, group_id: str) -> dict:
        """
        Get group state

        Args:
            group_id: Group ID

        Returns:
            Group state dict
        """
        if group_id not in self.groups:
            return {
                "groupId": group_id,
                "exists": False
            }

        controller = self.groups[group_id]
        enabled = self.group_enabled.get(group_id, False)

        return {
            "groupId": group_id,
            "hostSerial": controller.master_device,
            "slaveSerials": list(controller.slave_devices),
            "totalDevices": 1 + len(controller.slave_devices),
            "enabled": enabled
        }

    def is_enabled(self, group_id: str) -> bool:
        """Check if group is enabled"""
        return self.group_enabled.get(group_id, False)

    def get_controller(self, group_id: str) -> Optional[GroupController]:
        """Get group controller"""
        return self.groups.get(group_id)

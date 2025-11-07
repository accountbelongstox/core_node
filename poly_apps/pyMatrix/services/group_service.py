"""Group control service"""

from typing import Optional, Dict, Set, List
import asyncio
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
        self.group_tree: List[Dict] = []  # Hierarchical group tree structure
        self._init_tree()

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

    async def batch_screenshot(self, group_id: str, format: str = "png") -> Dict:
        """
        Capture screenshots for all devices in a group

        Args:
            group_id: Group ID
            format: Screenshot format (png or jpg)

        Returns:
            {
                "success": bool,
                "groupId": str,
                "totalDevices": int,
                "successful": int,
                "failed": int,
                "results": List[Dict]
            }
        """
        try:
            if group_id not in self.groups:
                return {
                    "success": False,
                    "error": f"Group {group_id} not found"
                }

            controller = self.groups[group_id]

            # Get all devices (master + slaves)
            all_serials = [controller.master_device] + list(controller.slave_devices)

            # Import RecordingService here to avoid circular import
            from .recording_service import RecordingService
            recording_service = RecordingService.instance()

            # Capture screenshots concurrently
            tasks = [
                recording_service.capture_screenshot(serial, format)
                for serial in all_serials
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Count successful and failed operations
            successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            failed = len(results) - successful

            print(f"[GroupService] Batch screenshot for group {group_id}: {successful}/{len(results)} successful")

            return {
                "success": True,
                "groupId": group_id,
                "totalDevices": len(results),
                "successful": successful,
                "failed": failed,
                "results": [r if isinstance(r, dict) else {"success": False, "error": str(r)} for r in results]
            }

        except Exception as e:
            print(f"[GroupService] Failed batch screenshot for group {group_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def batch_start_recording(
        self,
        group_id: str,
        quality: str = "high",
        max_duration: int = 1800
    ) -> Dict:
        """
        Start recording for all devices in a group

        Args:
            group_id: Group ID
            quality: Recording quality (high/medium/low)
            max_duration: Maximum recording duration in seconds

        Returns:
            {
                "success": bool,
                "groupId": str,
                "totalDevices": int,
                "successful": int,
                "failed": int,
                "results": List[Dict]
            }
        """
        try:
            if group_id not in self.groups:
                return {
                    "success": False,
                    "error": f"Group {group_id} not found"
                }

            controller = self.groups[group_id]

            # Get all devices (master + slaves)
            all_serials = [controller.master_device] + list(controller.slave_devices)

            # Import RecordingService here to avoid circular import
            from .recording_service import RecordingService
            recording_service = RecordingService.instance()

            # Start recording concurrently
            tasks = [
                recording_service.start_recording(serial, quality, max_duration)
                for serial in all_serials
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Count successful and failed operations
            successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            failed = len(results) - successful

            print(f"[GroupService] Batch start recording for group {group_id}: {successful}/{len(results)} successful")

            return {
                "success": True,
                "groupId": group_id,
                "totalDevices": len(results),
                "successful": successful,
                "failed": failed,
                "results": [r if isinstance(r, dict) else {"success": False, "error": str(r)} for r in results]
            }

        except Exception as e:
            print(f"[GroupService] Failed batch start recording for group {group_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def batch_stop_recording(self, group_id: str) -> Dict:
        """
        Stop recording for all devices in a group

        Args:
            group_id: Group ID

        Returns:
            {
                "success": bool,
                "groupId": str,
                "totalDevices": int,
                "successful": int,
                "failed": int,
                "results": List[Dict]
            }
        """
        try:
            if group_id not in self.groups:
                return {
                    "success": False,
                    "error": f"Group {group_id} not found"
                }

            controller = self.groups[group_id]

            # Get all devices (master + slaves)
            all_serials = [controller.master_device] + list(controller.slave_devices)

            # Import RecordingService here to avoid circular import
            from .recording_service import RecordingService
            recording_service = RecordingService.instance()

            # Stop recording concurrently
            tasks = [
                recording_service.stop_recording(serial)
                for serial in all_serials
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Count successful and failed operations
            successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            failed = len(results) - successful

            print(f"[GroupService] Batch stop recording for group {group_id}: {successful}/{len(results)} successful")

            return {
                "success": True,
                "groupId": group_id,
                "totalDevices": len(results),
                "successful": successful,
                "failed": failed,
                "results": [r if isinstance(r, dict) else {"success": False, "error": str(r)} for r in results]
            }

        except Exception as e:
            print(f"[GroupService] Failed batch stop recording for group {group_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def batch_system_key(self, group_id: str, action: str) -> Dict:
        """
        Send system key event to all devices in a group

        Args:
            group_id: Group ID
            action: System key action (home/back/recent/power/volume_up/volume_down)

        Returns:
            {
                "success": bool,
                "groupId": str,
                "totalDevices": int,
                "successful": int,
                "failed": int,
                "results": List[Dict]
            }
        """
        try:
            if group_id not in self.groups:
                return {
                    "success": False,
                    "error": f"Group {group_id} not found"
                }

            controller = self.groups[group_id]

            # Get all devices (master + slaves)
            all_serials = [controller.master_device] + list(controller.slave_devices)

            # Import ControlService here to avoid circular import
            from .control_service import ControlService
            control_service = ControlService.instance()

            # Send system key concurrently
            tasks = [
                control_service.send_system_key(serial, action)
                for serial in all_serials
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Count successful and failed operations
            successful = sum(1 for r in results if r is True or (isinstance(r, bool) and r))
            failed = len(results) - successful

            print(f"[GroupService] Batch system key '{action}' for group {group_id}: {successful}/{len(results)} successful")

            return {
                "success": True,
                "groupId": group_id,
                "action": action,
                "totalDevices": len(results),
                "successful": successful,
                "failed": failed
            }

        except Exception as e:
            print(f"[GroupService] Failed batch system key for group {group_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def batch_screen_control(
        self,
        group_id: str,
        control_type: str,
        params: Dict
    ) -> Dict:
        """
        Batch screen control for all devices in a group

        Args:
            group_id: Group ID
            control_type: Control type (power/brightness/rotation)
            params: Control parameters

        Returns:
            {
                "success": bool,
                "groupId": str,
                "totalDevices": int,
                "successful": int,
                "failed": int
            }
        """
        try:
            if group_id not in self.groups:
                return {
                    "success": False,
                    "error": f"Group {group_id} not found"
                }

            controller = self.groups[group_id]

            # Get all devices (master + slaves)
            all_serials = [controller.master_device] + list(controller.slave_devices)

            # Import ScreenService here to avoid circular import
            from .screen_service import ScreenService
            screen_service = ScreenService.instance()

            # Execute screen control concurrently
            tasks = []
            if control_type == "power":
                action = params.get("action", "toggle")
                tasks = [
                    screen_service.control_screen_power(serial, action)
                    for serial in all_serials
                ]
            elif control_type == "brightness":
                level = params.get("level", 128)
                tasks = [
                    screen_service.control_screen_brightness(serial, level)
                    for serial in all_serials
                ]
            elif control_type == "rotation":
                rotation = params.get("rotation", 0)
                tasks = [
                    screen_service.control_screen_rotation(serial, rotation)
                    for serial in all_serials
                ]
            else:
                return {
                    "success": False,
                    "error": f"Invalid control type: {control_type}"
                }

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Count successful and failed operations
            successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            failed = len(results) - successful

            print(f"[GroupService] Batch screen control '{control_type}' for group {group_id}: {successful}/{len(results)} successful")

            return {
                "success": True,
                "groupId": group_id,
                "controlType": control_type,
                "totalDevices": len(results),
                "successful": successful,
                "failed": failed
            }

        except Exception as e:
            print(f"[GroupService] Failed batch screen control for group {group_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _init_tree(self):
        """Initialize default tree structure with sample data"""
        try:
            # Try to load from config file
            import os
            import json
            config_file = os.path.join(os.path.dirname(__file__), '..', 'config', 'group_tree.json')
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    self.group_tree = json.load(f)
                    print(f"[GroupService] Loaded group tree from config: {len(self.group_tree)} root nodes")
                    return
        except Exception as e:
            print(f"[GroupService] Failed to load group tree config: {e}")

        # Default tree structure
        self.group_tree = [
            {
                "id": "group-production",
                "name": "Production Devices",
                "type": "group",
                "children": [
                    {
                        "id": "device-prod-001",
                        "name": "Device-001",
                        "type": "device",
                        "deviceSerial": "device-001",
                        "scriptPath": "/path/to/device-001",
                        "exists": False
                    },
                    {
                        "id": "device-prod-002",
                        "name": "Device-002",
                        "type": "device",
                        "deviceSerial": "device-002",
                        "scriptPath": "/path/to/device-002",
                        "exists": False
                    }
                ]
            },
            {
                "id": "group-testing",
                "name": "Testing Devices",
                "type": "group",
                "children": [
                    {
                        "id": "group-testing-android",
                        "name": "Android Test",
                        "type": "group",
                        "children": [
                            {
                                "id": "device-test-android-001",
                                "name": "Android-Test-001",
                                "type": "device",
                                "deviceSerial": "test-android-001",
                                "scriptPath": "/path/to/test-android-001",
                                "exists": False
                            }
                        ]
                    }
                ]
            }
        ]
        print(f"[GroupService] Initialized default group tree: {len(self.group_tree)} root nodes")

    async def get_tree(self) -> Dict:
        """
        Get hierarchical group tree structure

        Returns:
            {
                "success": bool,
                "tree": List[Dict] - Tree structure with groups and devices
            }
        """
        try:
            # Update device existence status from connected devices
            from .device_service import DeviceService
            device_service = DeviceService.instance()
            connected_serials = {d.get('deviceName', '') for d in device_service.devices if d.get('connected')}

            # Recursively update exists status
            def update_exists(nodes: List[Dict]):
                for node in nodes:
                    if node.get('type') == 'device':
                        serial = node.get('deviceSerial', '')
                        node['exists'] = serial in connected_serials
                    if node.get('children'):
                        update_exists(node['children'])

            update_exists(self.group_tree)

            return {
                "success": True,
                "tree": self.group_tree
            }
        except Exception as e:
            print(f"[GroupService] Failed to get tree: {e}")
            return {
                "success": False,
                "error": str(e),
                "tree": []
            }

    async def update_tree(self, tree: List[Dict]) -> Dict:
        """
        Update entire group tree structure

        Args:
            tree: New tree structure

        Returns:
            {
                "success": bool,
                "message": str
            }
        """
        try:
            # Validate tree structure
            def validate_node(node: Dict, path: str = "root") -> bool:
                if not isinstance(node, dict):
                    print(f"[GroupService] Invalid node at {path}: not a dict")
                    return False

                required_fields = ['id', 'name', 'type']
                for field in required_fields:
                    if field not in node:
                        print(f"[GroupService] Invalid node at {path}: missing '{field}'")
                        return False

                if node['type'] not in ['group', 'device']:
                    print(f"[GroupService] Invalid node at {path}: invalid type '{node['type']}'")
                    return False

                if node['type'] == 'device':
                    if 'deviceSerial' not in node:
                        print(f"[GroupService] Invalid device node at {path}: missing 'deviceSerial'")
                        return False

                # Validate children recursively
                if 'children' in node:
                    if not isinstance(node['children'], list):
                        print(f"[GroupService] Invalid node at {path}: children is not a list")
                        return False
                    for i, child in enumerate(node['children']):
                        if not validate_node(child, f"{path}/{node['name']}[{i}]"):
                            return False

                return True

            # Validate all root nodes
            for i, node in enumerate(tree):
                if not validate_node(node, f"root[{i}]"):
                    return {
                        "success": False,
                        "error": "Invalid tree structure"
                    }

            # Update tree
            self.group_tree = tree
            print(f"[GroupService] Tree updated: {len(tree)} root nodes")

            # Save to config file
            try:
                import os
                import json
                config_dir = os.path.join(os.path.dirname(__file__), '..', 'config')
                os.makedirs(config_dir, exist_ok=True)
                config_file = os.path.join(config_dir, 'group_tree.json')
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(tree, f, indent=2, ensure_ascii=False)
                print(f"[GroupService] Tree saved to {config_file}")
            except Exception as e:
                print(f"[GroupService] Failed to save tree config: {e}")

            return {
                "success": True,
                "message": f"Tree updated successfully: {len(tree)} root nodes"
            }
        except Exception as e:
            print(f"[GroupService] Failed to update tree: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

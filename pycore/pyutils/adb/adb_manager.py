"""ADB Manager - Stateless utility class"""

import subprocess
import re
from pathlib import Path
from typing import List, Optional

from pycore.pyutils.adb.adb_device import ADBDevice, DeviceState
from pycore.pyutils.adb.adb_exceptions import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)


class ADBManager:
    """
    ADB Manager (stateless, pure static methods)

    Design principles:
    1. No state saved, each call is independent
    2. adb path passed through parameters (default uses adb in PATH)
    3. All methods are class methods or static methods
    """

    @staticmethod
    def _run_command(
        command: List[str],
        check: bool = True,
        timeout: Optional[int] = None
    ) -> subprocess.CompletedProcess:
        """
        Execute ADB command

        Args:
            command: Command list, e.g., ['adb', 'devices']
            check: Whether to check return code
            timeout: Timeout in seconds

        Returns:
            subprocess.CompletedProcess

        Raises:
            ADBCommandFailedException: Command execution failed
        """
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout
        )

        if check and result.returncode != 0:
            raise ADBCommandFailedException(
                command=' '.join(command),
                return_code=result.returncode,
                stderr=result.stderr
            )

        return result

    @classmethod
    def list_devices(cls, adb_path: str = "adb") -> List[ADBDevice]:
        """
        List all ADB devices

        Args:
            adb_path: adb executable file path

        Returns:
            Device list

        Example output (adb devices):
            List of devices attached
            ABC123DEF456    device
            XYZ789GHI012    offline
        """
        result = cls._run_command([adb_path, "devices"])
        return cls._parse_devices(result.stdout)

    @staticmethod
    def _parse_devices(output: str) -> List[ADBDevice]:
        """Parse adb devices output"""
        devices = []
        lines = output.strip().split('\n')

        for line in lines[1:]:  # Skip first line "List of devices attached"
            line = line.strip()
            if not line:
                continue

            # Format: serial\tstate
            match = re.match(r'^(\S+)\s+(\S+)$', line)
            if match:
                serial, state_str = match.groups()

                # Check if state_str is valid DeviceState value
                valid_states = [s.value for s in DeviceState]
                if state_str in valid_states:
                    state = DeviceState(state_str)
                else:
                    state = DeviceState.UNKNOWN

                devices.append(ADBDevice(serial=serial, state=state))

        return devices

    @classmethod
    def get_device_info(cls, serial: str, adb_path: str = "adb") -> ADBDevice:
        """
        Get device detailed information

        Args:
            serial: Device serial number
            adb_path: adb path

        Returns:
            Device information (includes model, product)
        """
        # Check if device exists
        devices = cls.list_devices(adb_path)
        device = next((d for d in devices if d.serial == serial), None)

        if not device:
            raise DeviceNotFoundException(serial)

        # Get detailed information
        if device.is_available:
            model = cls.get_prop(serial, "ro.product.model", adb_path).strip()
            product = cls.get_prop(serial, "ro.product.name", adb_path).strip()
            device.model = model
            device.product = product

        return device

    @classmethod
    def get_prop(cls, serial: str, prop: str, adb_path: str = "adb") -> str:
        """
        Get device property

        Args:
            serial: Device serial number
            prop: Property name (e.g., ro.product.model)
            adb_path: adb path

        Returns:
            Property value
        """
        result = cls._run_command([
            adb_path, "-s", serial, "shell", "getprop", prop
        ])
        return result.stdout.strip()

    @classmethod
    def push_file(
        cls,
        serial: str,
        local_path: Path,
        remote_path: str,
        adb_path: str = "adb"
    ) -> bool:
        """
        Push file to device

        Args:
            serial: Device serial number
            local_path: Local file path
            remote_path: Remote path
            adb_path: adb path

        Returns:
            Whether successful

        Example:
            ADBManager.push_file(
                "ABC123",
                Path("scrcpy-server.jar"),
                "/data/local/tmp/scrcpy-server.jar"
            )
        """
        if not local_path.exists():
            raise FileNotFoundError(f"Local file not found: {local_path}")

        result = cls._run_command([
            adb_path, "-s", serial, "push",
            str(local_path), remote_path
        ], check=False)

        return result.returncode == 0

    @classmethod
    def execute_shell(
        cls,
        serial: str,
        command: str,
        adb_path: str = "adb",
        timeout: Optional[int] = None
    ) -> str:
        """
        Execute shell command

        Args:
            serial: Device serial number
            command: Shell command
            adb_path: adb path
            timeout: Timeout in seconds

        Returns:
            Command output

        Example:
            output = ADBManager.execute_shell("ABC123", "wm size")
            # Output: Physical size: 1440x3120
        """
        result = cls._run_command(
            [adb_path, "-s", serial, "shell", command],
            timeout=timeout
        )
        return result.stdout

    @classmethod
    def forward_port(
        cls,
        serial: str,
        local_port: int,
        remote_port: int,
        adb_path: str = "adb"
    ):
        """
        Port forwarding

        Args:
            serial: Device serial number
            local_port: Local port
            remote_port: Remote port
            adb_path: adb path

        Example:
            # Forward device port 27183 to local 27183
            ADBManager.forward_port("ABC123", 27183, 27183)
        """
        cls._run_command([
            adb_path, "-s", serial, "forward",
            f"tcp:{local_port}", f"tcp:{remote_port}"
        ])

    @classmethod
    def remove_forward(
        cls,
        serial: str,
        local_port: int,
        adb_path: str = "adb"
    ):
        """Remove port forwarding"""
        cls._run_command([
            adb_path, "-s", serial, "forward", "--remove",
            f"tcp:{local_port}"
        ], check=False)

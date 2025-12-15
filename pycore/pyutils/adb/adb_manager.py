"""ADB 管理器 - 无状态工具类"""

from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import re
from pathlib import Path
from typing import List, Optional

from .adb_device import ADBDevice, DeviceState
from .adb_exceptions import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)


class ADBManager:
    """
    ADB 管理器（无状态，纯静态方法）

    设计原则：
    1. 不保存状态，每次调用都是独立的
    2. adb 路径通过参数传递（默认使用 PATH 中的 adb）
    3. 所有方法都是类方法或静态方法
    """

    @staticmethod
    def _run_command(
        command: List[str],
        check: bool = True,
        timeout: Optional[int] = None
    ) -> subprocess.CompletedProcess:
        """
        执行 ADB 命令

        Args:
            command: 命令列表，如 ['adb', 'devices']
            check: 是否检查返回码
            timeout: 超时时间（秒）

        Returns:
            subprocess.CompletedProcess

        Raises:
            ADBCommandFailedException: 命令执行失败
        """
        try:
            result = exec_silent(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=timeout
            )

            if check and result.return_code != 0:
                raise ADBCommandFailedException(
                    command=' '.join(command),
                    return_code=result.return_code,
                    stderr=result.stderr
                )

            return result

        except subprocess.TimeoutExpired as e:
            raise ADBException(f"Command timeout: {' '.join(command)}") from e

    @classmethod
    def list_devices(cls, adb_path: str = "adb") -> List[ADBDevice]:
        """
        列出所有 ADB 设备

        Args:
            adb_path: adb 可执行文件路径

        Returns:
            设备列表

        示例输出（adb devices）：
            List of devices attached
            ABC123DEF456    device
            XYZ789GHI012    offline
        """
        result = cls._run_command([adb_path, "devices"])
        return cls._parse_devices(result.stdout)

    @staticmethod
    def _parse_devices(output: str) -> List[ADBDevice]:
        """解析 adb devices 输出"""
        devices = []
        lines = output.strip().split('\n')

        for line in lines[1:]:  # 跳过第一行 "List of devices attached"
            line = line.strip()
            if not line:
                continue

            # 格式：serial\tstate
            match = re.match(r'^(\S+)\s+(\S+)$', line)
            if match:
                serial, state_str = match.groups()
                try:
                    state = DeviceState(state_str)
                except ValueError:
                    state = DeviceState.UNKNOWN

                devices.append(ADBDevice(serial=serial, state=state))

        return devices

    @classmethod
    def get_device_info(cls, serial: str, adb_path: str = "adb") -> ADBDevice:
        """
        获取设备详细信息

        Args:
            serial: 设备序列号
            adb_path: adb 路径

        Returns:
            设备信息（包含 model, product）
        """
        # 检查设备是否存在
        devices = cls.list_devices(adb_path)
        device = next((d for d in devices if d.serial == serial), None)

        if not device:
            raise DeviceNotFoundException(serial)

        # 获取详细信息
        if device.is_available:
            model = cls.get_prop(serial, "ro.product.model", adb_path).strip()
            product = cls.get_prop(serial, "ro.product.name", adb_path).strip()
            device.model = model
            device.product = product

        return device

    @classmethod
    def get_prop(cls, serial: str, prop: str, adb_path: str = "adb") -> str:
        """
        获取设备属性

        Args:
            serial: 设备序列号
            prop: 属性名（如 ro.product.model）
            adb_path: adb 路径

        Returns:
            属性值
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
        推送文件到设备

        Args:
            serial: 设备序列号
            local_path: 本地文件路径
            remote_path: 远程路径
            adb_path: adb 路径

        Returns:
            是否成功

        示例：
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

        return result.return_code == 0

    @classmethod
    def execute_shell(
        cls,
        serial: str,
        command: str,
        adb_path: str = "adb",
        timeout: Optional[int] = None
    ) -> str:
        """
        执行 shell 命令

        Args:
            serial: 设备序列号
            command: shell 命令
            adb_path: adb 路径
            timeout: 超时时间（秒）

        Returns:
            命令输出

        示例：
            output = ADBManager.execute_shell("ABC123", "wm size")
            # 输出：Physical size: 1440x3120
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
        端口转发

        Args:
            serial: 设备序列号
            local_port: 本地端口
            remote_port: 远程端口
            adb_path: adb 路径

        示例：
            # 将设备的 27183 端口转发到本地 27183
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
        """移除端口转发"""
        cls._run_command([
            adb_path, "-s", serial, "forward", "--remove",
            f"tcp:{local_port}"
        ], check=False)

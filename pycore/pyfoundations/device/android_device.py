"""Android device abstraction"""

from abc import ABC, abstractmethod
from typing import Optional, Any
from pycore.pyfoundations.device.device_info import DeviceInfo, Resolution
from pycore.pyfoundations.device.server_params import ServerParams


class AndroidDevice(ABC):
    """
    Android device abstraction

    This is a base class that defines the interface for Android device operations.
    Concrete implementations should handle:
    - Starting/stopping scrcpy-server
    - Managing video and control sockets
    - Device lifecycle management
    """

    def __init__(self, serial: str, params: ServerParams):
        """
        Initialize Android device

        Args:
            serial: Device serial number
            params: scrcpy-server parameters
        """
        self.serial = serial
        self.params = params
        self.info: Optional[DeviceInfo] = None
        self._video_socket: Optional[Any] = None  # socket.socket object
        self._control_socket: Optional[Any] = None  # socket.socket object

    @abstractmethod
    def start_server(self) -> int:
        """
        Start scrcpy-server on the device

        Returns:
            Local port number for video stream

        Raises:
            Exception: If server fails to start
        """
        pass

    @abstractmethod
    def stop_server(self):
        """
        Stop scrcpy-server

        Should clean up:
        - Kill server process
        - Close sockets
        - Remove port forwarding
        """
        pass

    @abstractmethod
    def get_video_socket(self) -> int:
        """
        Get video stream socket file descriptor

        Returns:
            Socket file descriptor for reading H.264 stream
        """
        pass

    @abstractmethod
    def get_control_socket(self) -> int:
        """
        Get control socket file descriptor

        Returns:
            Socket file descriptor for sending control messages
        """
        pass

    @abstractmethod
    def get_device_info(self) -> DeviceInfo:
        """
        Retrieve detailed device information

        Returns:
            DeviceInfo object with model, resolution, Android version, etc.
        """
        pass

    def is_connected(self) -> bool:
        """
        Check if device is connected and server is running

        Returns:
            True if device is ready for streaming/control
        """
        return self._video_socket is not None and self._control_socket is not None

    def __repr__(self) -> str:
        return f"AndroidDevice(serial='{self.serial}', connected={self.is_connected()})"

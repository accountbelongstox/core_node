"""
Device Connection Manager

Abstracts device connection lifecycle management, decoupling from
VideoStreamService to improve modularity and testability.

Responsibilities:
- Device lifecycle (create, connect, disconnect, cleanup)
- Connection retry logic
- Server restart handling
- Port allocation integration

Reference: QtScrcpy's Device and Server classes
"""

import asyncio
import threading
from typing import Dict, Optional, Callable
from pathlib import Path
from enum import Enum

from pycore.pyutils.device.device_manager import DeviceManager
from pycore.pyutils.device.scrcpy_device import ScrcpyDevice, ServerParams, VideoCodec
from pycore.pyutils.device.port_pool import PortPool
from pycore import ColorPrint


class DeviceConnectionState(Enum):
    """Device connection state"""
    IDLE = "idle"               # Not connected
    INITIALIZING = "initializing"  # Starting connection
    CONNECTED = "connected"     # Connected and ready
    RECONNECTING = "reconnecting"  # Reconnecting after failure
    FAILED = "failed"           # Connection failed
    DISCONNECTED = "disconnected"  # Intentionally disconnected


class DeviceConnection:
    """
    Represents a single device connection

    Encapsulates device state and connection lifecycle
    """

    def __init__(self, serial: str, device: ScrcpyDevice, port: int):
        self.serial = serial
        self.device = device
        self.port = port
        self.state = DeviceConnectionState.IDLE
        self.retry_count = 0
        self.max_retries = 3  # Increased from 1 to 3 for multi-device stability

    def mark_initializing(self):
        """Mark device as initializing"""
        self.state = DeviceConnectionState.INITIALIZING

    def mark_connected(self):
        """Mark device as connected"""
        self.state = DeviceConnectionState.CONNECTED
        self.retry_count = 0  # Reset retry count on success

    def mark_reconnecting(self):
        """Mark device as reconnecting"""
        self.state = DeviceConnectionState.RECONNECTING
        self.retry_count += 1

    def mark_failed(self):
        """Mark device as failed"""
        self.state = DeviceConnectionState.FAILED

    def mark_disconnected(self):
        """Mark device as disconnected"""
        self.state = DeviceConnectionState.DISCONNECTED

    def can_retry(self) -> bool:
        """Check if device can attempt reconnection"""
        return self.retry_count < self.max_retries


class ConnectionManager:
    """
    Manages multiple device connections 

    Features:
    - Centralized device lifecycle management
    - Port allocation via PortPool
    - Connection retry and server restart
    - Event callbacks for state changes

    Design Pattern: Facade + Strategy
    """
    def __init__(
        self,
        device_manager: DeviceManager,
        port_pool: PortPool,
        server_manager: 'ScrcpyServerManager',
        adb_path: str
    ):
        """
        Initialize connection manager

        WARNING: Do not call directly. Use ConnectionManager.instance() instead.

        Args:
            device_manager: DeviceManager instance
            port_pool: PortPool instance for port allocation
            server_manager: Shared ScrcpyServerManager instance (global)
            adb_path: Path to ADB executable
        """
        self.device_manager = device_manager
        self.port_pool = port_pool
        self.server_manager = server_manager  # ✅ FIXED: Use shared instance
        self.adb_path = adb_path
        self.scrcpy_server_jar = server_manager.jar_path  # Get from manager

        # Active connections: {serial: DeviceConnection}
        self.connections: Dict[str, DeviceConnection] = {}

        # Initialization locks per device (prevent concurrent init)
        # Use threading.Lock for cross-event-loop synchronization
        self.init_locks: Dict[str, threading.Lock] = {}

        # Event callbacks
        self.on_connected: Optional[Callable[[str], None]] = None
        self.on_disconnected: Optional[Callable[[str], None]] = None
        self.on_failed: Optional[Callable[[str, str], None]] = None

    
    async def connect_device(
        self,
        serial: str,
        params: ServerParams,
        force_reconnect: bool = False
    ) -> DeviceConnection:
        """
        Connect to a device

        Handles:
        - Port allocation
        - Device creation
        - Server startup
        - Connection retry
        - Server restart on failure

        Args:
            serial: Device serial number
            params: Server parameters
            force_reconnect: Force reconnection even if already connected

        Returns:
            DeviceConnection object

        Raises:
            RuntimeError: If connection fails after retries
        """
        # Get or create initialization lock for this device
        if serial not in self.init_locks:
            self.init_locks[serial] = threading.Lock()

        with self.init_locks[serial]:
            # Check if already connected
            if serial in self.connections and not force_reconnect:
                connection = self.connections[serial]
                if connection.state == DeviceConnectionState.CONNECTED:
                    ColorPrint.yellow(f"[ConnectionManager] Device {serial} already connected")
                    return connection

            ColorPrint.blue(f"[ConnectionManager] Connecting device {serial}...")

            # Allocate port
            port = await self.port_pool.allocate(serial)
            ColorPrint.green(f"[ConnectionManager] Allocated port {port} for {serial}")

            # Create or reuse device
            device = self.device_manager.get_device(serial)
            if not device:
                # Create new ScrcpyDevice
                device = ScrcpyDevice(serial, params, self.adb_path)
                ColorPrint.green(f"[ConnectionManager] Created ScrcpyDevice for {serial}")

            # Create connection object
            connection = DeviceConnection(serial, device, port)
            connection.mark_initializing()
            self.connections[serial] = connection

            # Attempt connection with retry
            try:
                await self._connect_with_retry(connection, params)

                # Connection successful
                connection.mark_connected()

                # Register device to DeviceManager
                self.device_manager.devices[serial] = device
                ColorPrint.green(f"[ConnectionManager] ✓ Device {serial} connected on port {port}")

                # Trigger callback
                if self.on_connected:
                    self.on_connected(serial)

                return connection

            except Exception as e:
                # Connection failed
                connection.mark_failed()
                ColorPrint.red(f"[ConnectionManager] ✗ Failed to connect {serial}: {e}")

                # Release port
                await self.port_pool.release(serial)

                # Trigger callback
                if self.on_failed:
                    self.on_failed(serial, str(e))

                raise


    async def _connect_with_retry(self, connection: DeviceConnection, params: ServerParams):
        """
        Internal method: Connect with server restart retry

        Implements enhanced retry strategy for multi-device scenarios:
        1. Push scrcpy-server.jar to device (via ScrcpyServerManager)
        2. Try to start server and connect (60s timeout for ADB queue delays)
        3. If fails, restart server (max 3 times for multi-device stability)

        Args:
            connection: DeviceConnection object
            params: Server parameters

        Raises:
            RuntimeError: If all retry attempts fail
        """
        loop = asyncio.get_event_loop()
        last_error = None

        # STEP 1: Verify and push jar (MANDATORY, IDEMPOTENT)
        # Always check jar on device, push if wrong (never skip this step)
        ColorPrint.blue(f"[ConnectionManager] STEP 1: Verify jar for {connection.serial}...")

        jar_correct = await self.server_manager.check_jar_on_device(connection.serial)

        if not jar_correct:
            ColorPrint.yellow(f"[ConnectionManager] Jar wrong/missing for {connection.serial}, pushing...")
            push_success = await self.server_manager.push_jar_to_device(connection.serial, force=True)

            if push_success:
                ColorPrint.green(f"[ConnectionManager] ✓ Jar pushed successfully for {connection.serial}")
            else:
                ColorPrint.red(f"[ConnectionManager] Failed to push jar for {connection.serial}, will try anyway")
        else:
            ColorPrint.green(f"[ConnectionManager] ✓ Jar correct for {connection.serial}, verified")

        # STEP 2: Connect device with retry
        while connection.can_retry() or connection.retry_count == 0:
            try:
                # Ensure device is not connected
                if connection.device.is_connected():
                    ColorPrint.yellow(f"[ConnectionManager] Device {connection.serial} already connected, stopping server first...")
                    connection.device.stop_server()

                # Update device params
                connection.device.params = params

                # Start scrcpy-server (blocking operation, run in executor)
                # Increased timeout to 60s for multi-device ADB queue delays
                ColorPrint.blue(f"[ConnectionManager] Starting scrcpy-server for {connection.serial}...")
                await asyncio.wait_for(
                    loop.run_in_executor(None, connection.device.start_server),
                    timeout=60.0
                )

                # Success!
                ColorPrint.green(f"[ConnectionManager] ✓ scrcpy-server started for {connection.serial}")
                return

            except asyncio.TimeoutError:
                last_error = f"Timeout starting scrcpy-server (60s)"
                ColorPrint.red(f"[ConnectionManager] {last_error}")

            except Exception as e:
                last_error = str(e)
                ColorPrint.red(f"[ConnectionManager] Connection failed: {e}")

            # Check if we can retry
            if connection.can_retry():
                connection.mark_reconnecting()
                ColorPrint.yellow(
                    f"[ConnectionManager] Retrying {connection.serial} "
                    f"(attempt {connection.retry_count + 1}/{connection.max_retries + 1})..."
                )

                # Clean up before retry - mark connection as reconnecting
                # Note: ScrcpyDevice doesn't have disconnect() method, cleanup happens automatically
                # Already marked as reconnecting in mark_reconnecting() above

                await asyncio.sleep(1.0)  # Brief delay before retry
            else:
                # No more retries
                break

        # All retries exhausted
        raise RuntimeError(
            f"Failed to connect {connection.serial} after {connection.retry_count} retries. "
            f"Last error: {last_error}"
        )

    async def disconnect_device(self, serial: str):
        """
        Disconnect a device and release resources

        Args:
            serial: Device serial number
        """
        if serial not in self.connections:
            ColorPrint.yellow(f"[ConnectionManager] Device {serial} not in connections")
            return

        connection = self.connections[serial]

        ColorPrint.blue(f"[ConnectionManager] Disconnecting device {serial}...")

        # Stop device server
        try:
            connection.device.stop_server()
        except Exception as e:
            ColorPrint.yellow(f"[ConnectionManager] Error stopping device server: {e}")

        # Remove from DeviceManager
        if serial in self.device_manager.devices:
            del self.device_manager.devices[serial]

        # Release port
        await self.port_pool.release(serial)

        # Mark as disconnected
        connection.mark_disconnected()

        # Remove from connections
        del self.connections[serial]

        # Trigger callback
        if self.on_disconnected:
            self.on_disconnected(serial)

        ColorPrint.green(f"[ConnectionManager] ✓ Device {serial} disconnected")

    async def disconnect_all(self):
        """Disconnect all devices"""
        serials = list(self.connections.keys())
        for serial in serials:
            await self.disconnect_device(serial)

    def get_connection(self, serial: str) -> Optional[DeviceConnection]:
        """
        Get connection object for a device

        Args:
            serial: Device serial number

        Returns:
            DeviceConnection or None if not connected
        """
        return self.connections.get(serial)

    def is_connected(self, serial: str) -> bool:
        """
        Check if a device is connected

        Args:
            serial: Device serial number

        Returns:
            True if device is connected
        """
        connection = self.connections.get(serial)
        return connection is not None and connection.state == DeviceConnectionState.CONNECTED

    def get_connected_count(self) -> int:
        """Get number of connected devices"""
        return sum(
            1 for conn in self.connections.values()
            if conn.state == DeviceConnectionState.CONNECTED
        )

    def get_all_serials(self) -> list:
        """Get list of all device serials"""
        return list(self.connections.keys())


# ✅ 延迟初始化（需要先初始化依赖组件）
_connection_manager: Optional[ConnectionManager] = None

def get_connection_manager(
    device_manager=None,
    port_pool=None,
    server_manager=None,
    adb_path: str = "adb"
) -> ConnectionManager:
    """
    获取全局ConnectionManager实例（延迟初始化）

    Args:
        device_manager: DeviceManager实例（首次调用时必需）
        port_pool: PortPool实例（首次调用时必需）
        server_manager: ScrcpyServerManager实例（首次调用时必需）
        adb_path: ADB路径

    Returns:
        ConnectionManager全局实例
    """
    global _connection_manager
    if _connection_manager is None:
        if device_manager is None or port_pool is None or server_manager is None:
            raise ValueError(
                "首次调用get_connection_manager()需要提供 "
                "device_manager, port_pool, server_manager"
            )
        _connection_manager = ConnectionManager(
            device_manager=device_manager,
            port_pool=port_pool,
            server_manager=server_manager,
            adb_path=adb_path
        )
    return _connection_manager

__all__ = ['ConnectionManager', 'DeviceConnection', 'DeviceConnectionState', 'get_connection_manager']

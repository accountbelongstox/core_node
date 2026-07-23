"""
Port Pool Manager for scrcpy devices

Manages port allocation for multiple concurrent scrcpy devices,
preventing port conflicts and enabling port reuse.

Reference: QtScrcpy's DeviceManage::getFreePort() implementation
"""

import asyncio
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
    submit_coroutine_via_bus,
)


class PortPool:
    """
    Thread-safe port pool manager for scrcpy device connections

    Features:
    - Sequential port allocation (27183, 27184, 27185...)
    - Port conflict detection
    - Port reuse when devices disconnect
    - Cross-event-loop access through THREAD_BUS

    Based on QtScrcpy's port management strategy
    """

    def __init__(self, start: int = 27183, pool_size: int = 1000):
        """
        Initialize port pool

        Args:
            start: Starting port number (default 27183, same as QtScrcpy)
            pool_size: Maximum number of ports in pool (default 1000)
        """
        self.start = start
        self.pool_size = pool_size
        self.end = start + pool_size - 1

        # Track allocated ports: {serial: port}
        self.allocated: Dict[str, int] = {}

        # Next port to try (increments sequentially)
        self.next_port = start

        self._state_queue = f'pyutils.device.port_pool.{id(self)}'
        self._state_worker = SerializedWorkerThread(
            self._state_queue,
            f'PortPoolThread-{id(self)}',
        )
        self._state_worker.start()

    async def allocate(self, serial: str) -> int:
        """
        Allocate a port for a device

        If the device already has a port (reconnecting), returns the same port.
        Otherwise, finds the next available port in the pool.

        Args:
            serial: Device serial number

        Returns:
            Allocated port number

        Raises:
            RuntimeError: If port pool is exhausted
        """
        return call_serialized(self._state_queue, self._allocate, serial)

    def _allocate(self, serial: str) -> int:
        """Allocate on the port-pool owner thread."""
        if serial in self.allocated:
            port = self.allocated[serial]
            ColorPrint.blue(f"[PortPool] Reusing port {port} for device {serial}")
            return port
        attempts = 0
        while attempts < self.pool_size:
            port = self.next_port
            self.next_port += 1
            if self.next_port > self.end:
                self.next_port = self.start
            if port not in self.allocated.values():
                self.allocated[serial] = port
                ColorPrint.blue(f"[PortPool] Allocated port {port} for device {serial}")
                return port
            attempts += 1
        raise RuntimeError(
            f"Port pool exhausted (start={self.start}, size={self.pool_size}). "
            f"Currently allocated: {len(self.allocated)} ports"
        )

    async def release(self, serial: str) -> Optional[int]:
        """
        Release a port allocated to a device

        Args:
            serial: Device serial number

        Returns:
            The released port number, or None if device had no allocated port
        """
        return call_serialized(self._state_queue, self._release, serial)

    def _release(self, serial: str) -> Optional[int]:
        """Release on the port-pool owner thread."""
        if serial in self.allocated:
            port = self.allocated.pop(serial)
            ColorPrint.blue(f"[PortPool] Released port {port} for device {serial}")
            return port
        return None

    async def get_port(self, serial: str) -> Optional[int]:
        """
        Get the currently allocated port for a device

        Args:
            serial: Device serial number

        Returns:
            Allocated port number, or None if no port allocated
        """
        return call_serialized(self._state_queue, self.allocated.get, serial)

    async def is_allocated(self, serial: str) -> bool:
        """
        Check if a device has an allocated port

        Args:
            serial: Device serial number

        Returns:
            True if device has an allocated port
        """
        return call_serialized(self._state_queue, self._is_allocated, serial)

    def _is_allocated(self, serial: str) -> bool:
        """Check allocation on the port-pool owner thread."""
        return serial in self.allocated

    async def get_allocated_count(self) -> int:
        """
        Get the number of currently allocated ports

        Returns:
            Number of allocated ports
        """
        return call_serialized(self._state_queue, self._allocated_count)

    def _allocated_count(self) -> int:
        """Count allocations on the port-pool owner thread."""
        return len(self.allocated)

    async def get_available_count(self) -> int:
        """
        Get the number of available ports

        Returns:
            Number of available ports
        """
        return call_serialized(self._state_queue, self._available_count)

    def _available_count(self) -> int:
        """Count free ports on the port-pool owner thread."""
        return self.pool_size - len(self.allocated)

    async def reset(self):
        """
        Reset the port pool, releasing all allocated ports

        WARNING: Only call this when all devices are disconnected
        """
        call_serialized(self._state_queue, self._reset)

    def _reset(self) -> None:
        """Reset on the port-pool owner thread."""
        count = len(self.allocated)
        self.allocated.clear()
        self.next_port = self.start
        ColorPrint.blue(f"[PortPool] Reset complete, released {count} ports")


class SyncPortPool:
    """
    Synchronous wrapper for PortPool (for use in non-async contexts)

    Uses a background event loop to run async operations
    """

    def __init__(self, pool: PortPool):
        # Use provided PortPool instance
        self._pool = pool
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def _set_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the event loop to use (call from async context)"""
        self._loop = loop

    def allocate(self, serial: str) -> int:
        """Synchronous port allocation"""
        if not self._loop:
            raise RuntimeError("Event loop not set. Call _set_loop() first.")

        return submit_coroutine_via_bus(
            self._loop,
            self._pool.allocate(serial),
            wait=True,
            timeout=5.0,
            thread_name="PortPoolAllocateBridgeThread",
        )

    def release(self, serial: str) -> Optional[int]:
        """Synchronous port release"""
        if not self._loop:
            raise RuntimeError("Event loop not set. Call _set_loop() first.")

        return submit_coroutine_via_bus(
            self._loop,
            self._pool.release(serial),
            wait=True,
            timeout=5.0,
            thread_name="PortPoolReleaseBridgeThread",
        )

    def get_port(self, serial: str) -> Optional[int]:
        """Synchronous port query"""
        if not self._loop:
            raise RuntimeError("Event loop not set. Call _set_loop() first.")

        return submit_coroutine_via_bus(
            self._loop,
            self._pool.get_port(serial),
            wait=True,
            timeout=5.0,
            thread_name="PortPoolQueryBridgeThread",
        )


# ✅ 创建全局唯一实例（模块级别单例）
port_pool = PortPool(start=27183, pool_size=1000)
sync_port_pool = SyncPortPool(port_pool)

__all__ = ['port_pool', 'sync_port_pool', 'PortPool', 'SyncPortPool']

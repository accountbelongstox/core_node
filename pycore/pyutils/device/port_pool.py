"""
Port Pool Manager for scrcpy devices

Manages port allocation for multiple concurrent scrcpy devices,
preventing port conflicts and enabling port reuse.

Reference: QtScrcpy's DeviceManage::getFreePort() implementation
"""

import asyncio
import threading
from typing import Dict, Optional


class PortPool:
    """
    Thread-safe port pool manager for scrcpy device connections

    Features:
    - Sequential port allocation (27183, 27184, 27185...)
    - Port conflict detection
    - Port reuse when devices disconnect
    - Thread-safe with asyncio.Lock

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

        # Thread safety lock
        self.lock = asyncio.Lock()

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
        async with self.lock:
            # Reuse existing port for reconnecting devices
            if serial in self.allocated:
                port = self.allocated[serial]
                print(f"[PortPool] Reusing port {port} for device {serial}")
                return port

            # Find next available port
            attempts = 0
            while attempts < self.pool_size:
                port = self.next_port
                self.next_port += 1

                # Wrap around to start if we reach the end
                if self.next_port > self.end:
                    self.next_port = self.start

                # Check if port is already in use
                if port not in self.allocated.values():
                    # Port is free, allocate it
                    self.allocated[serial] = port
                    print(f"[PortPool] Allocated port {port} for device {serial}")
                    return port

                attempts += 1

            # Port pool exhausted
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
        async with self.lock:
            if serial in self.allocated:
                port = self.allocated.pop(serial)
                print(f"[PortPool] Released port {port} for device {serial}")
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
        async with self.lock:
            return self.allocated.get(serial)

    async def is_allocated(self, serial: str) -> bool:
        """
        Check if a device has an allocated port

        Args:
            serial: Device serial number

        Returns:
            True if device has an allocated port
        """
        async with self.lock:
            return serial in self.allocated

    async def get_allocated_count(self) -> int:
        """
        Get the number of currently allocated ports

        Returns:
            Number of allocated ports
        """
        async with self.lock:
            return len(self.allocated)

    async def get_available_count(self) -> int:
        """
        Get the number of available ports

        Returns:
            Number of available ports
        """
        async with self.lock:
            return self.pool_size - len(self.allocated)

    async def reset(self):
        """
        Reset the port pool, releasing all allocated ports

        WARNING: Only call this when all devices are disconnected
        """
        async with self.lock:
            count = len(self.allocated)
            self.allocated.clear()
            self.next_port = self.start
            print(f"[PortPool] Reset complete, released {count} ports")


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

        future = asyncio.run_coroutine_threadsafe(
            self._pool.allocate(serial),
            self._loop
        )
        return future.result(timeout=5.0)

    def release(self, serial: str) -> Optional[int]:
        """Synchronous port release"""
        if not self._loop:
            raise RuntimeError("Event loop not set. Call _set_loop() first.")

        future = asyncio.run_coroutine_threadsafe(
            self._pool.release(serial),
            self._loop
        )
        return future.result(timeout=5.0)

    def get_port(self, serial: str) -> Optional[int]:
        """Synchronous port query"""
        if not self._loop:
            raise RuntimeError("Event loop not set. Call _set_loop() first.")

        future = asyncio.run_coroutine_threadsafe(
            self._pool.get_port(serial),
            self._loop
        )
        return future.result(timeout=5.0)


# ✅ 创建全局唯一实例（模块级别单例）
port_pool = PortPool(start=27183, pool_size=1000)
sync_port_pool = SyncPortPool(port_pool)

__all__ = ['port_pool', 'sync_port_pool', 'PortPool', 'SyncPortPool']

"""THREAD_BUS-backed lease that serializes async device operations by name."""

import asyncio
from contextlib import asynccontextmanager

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

LEASE_POLL_SECONDS = 0.05


@asynccontextmanager
async def bus_lease(signal_name: str):
    """Hold the named lease for the duration of the ``async with`` block."""
    while THREAD_BUS.has_signal(signal_name):
        await asyncio.sleep(LEASE_POLL_SECONDS)
    THREAD_BUS.signal(signal_name, True)
    try:
        yield
    finally:
        THREAD_BUS.clear_signal(signal_name)

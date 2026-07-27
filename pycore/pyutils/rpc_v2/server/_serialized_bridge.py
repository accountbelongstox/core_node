#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Async bridge for THREAD_BUS-serialized state tables (InventoryTable,
RequestEventTable, ...) used by the RPC v2 server.

The tables' public methods are decorated with @serialized_method, so each
call blocks the calling thread until the owner thread returns a response.
The uvicorn event loop MUST NOT block on those calls; if it does, every
route (including /rpc/routes and /rpc/status) times out together.

`await_serialized(fn, *a, **kw)` runs the call on a bounded module-level
ThreadPoolExecutor and awaits its result. Signature parity — call sites
just wrap the sync call.

- `timeout` (optional): raise `TimeoutError` if the executor call does not
  return in time. Use for diagnostic endpoints (e.g. /rpc/status), never
  for the durable request path.
- Pool size 32 with a stable thread name prefix so it is visible in the
  process's thread list. Prevents the "one thread per RPC request" pattern.
"""

from __future__ import annotations

import asyncio
import functools
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Optional

# Bounded pool so a burst of RPC requests never spins up unlimited threads.
# 32 is large enough for parallel HTTP + WS traffic without exhausting the OS
# thread limit even under load — table calls are fast (<1ms) once THREAD_BUS
# no longer sleep-polls.
_EXECUTOR = ThreadPoolExecutor(
    max_workers=32,
    thread_name_prefix="RPCTableBridge",
)


async def await_serialized(
    fn: Callable[..., Any],
    *args: Any,
    timeout: Optional[float] = None,
    **kwargs: Any,
) -> Any:
    """Run a @serialized_method-decorated call in the bridge pool.

    Args:
        fn: the sync serialized method (e.g. `table.get_event`).
        *args, **kwargs: forwarded to `fn`.
        timeout: optional seconds; raises `TimeoutError` on expiry.
            Only pass this for diagnostic paths — the durable request
            path must never abandon a serialized call.

    Returns:
        Whatever `fn` returns.
    """
    loop = asyncio.get_running_loop()
    func = functools.partial(fn, *args, **kwargs)
    future = loop.run_in_executor(_EXECUTOR, func)
    if timeout is None:
        return await future
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"Serialized RPC bridge timed out after {timeout}s: {fn!r}"
        ) from exc


__all__ = ["await_serialized"]

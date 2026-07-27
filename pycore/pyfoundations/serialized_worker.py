"""THREAD_BUS-backed serialized function execution.

Event-driven: SerializedWorkerThread.run() blocks on THREAD_BUS.receive_message
without a poll timeout, and await_bus_task uses an asyncio.Future woken via
loop.call_soon_threadsafe. There is no sleep-poll on any hot path.
"""

import asyncio
import copy
import threading
import uuid
from collections import deque
from functools import wraps
from typing import Any, Callable

from pycore.pyfoundations.thread_bus import THREAD_BUS


DEFAULT_SERIALIZED_TIMEOUT = 30.0


def _response_guard_name(response_signal: str) -> str:
    return f"{response_signal}.waiting"


def _publish_response(
    response_signal: str,
    response_guard: str,
    response: dict[str, Any],
) -> None:
    if not response_signal:
        return
    if response_guard:
        THREAD_BUS.signal_if_present(response_guard, response_signal, response)
        return
    THREAD_BUS.signal(response_signal, response)


class SerializedWorkerThread(threading.Thread):
    """Execute callbacks sequentially after receiving them from THREAD_BUS.

    Blocks indefinitely on the queue via a condition-based wait; consumes no
    CPU while idle. Daemon thread — the process exit clears it.
    """

    def __init__(self, queue_name: str, thread_name: str) -> None:
        super().__init__(name=thread_name, daemon=True)
        self._queue_name = queue_name

    def run(self) -> None:
        while True:
            request = THREAD_BUS.receive_message(self._queue_name, block=True)
            if not isinstance(request, dict):
                continue

            response_signal = request.get("response_signal", "")
            response_guard = request.get("response_guard", "")
            callback = request.get("callback")
            args = request.get("args", ())
            kwargs = request.get("kwargs", {})
            try:
                result = callback(*args, **kwargs)
                response = {"success": True, "result": result}
            except Exception as exc:
                response = {"success": False, "error": str(exc)}
            _publish_response(response_signal, response_guard, response)


class BusTaskThread(threading.Thread):
    """Execute one bus-delivered callback on a named Thread subclass."""

    def __init__(self, queue_name: str, thread_name: str, daemon: bool) -> None:
        super().__init__(name=thread_name, daemon=daemon)
        self._queue_name = queue_name

    def run(self) -> None:
        request = THREAD_BUS.receive_message(self._queue_name, block=True)
        if not isinstance(request, dict):
            return
        response_signal = request.get("response_signal", "")
        response_guard = request.get("response_guard", "")
        callback = request.get("callback")
        args = request.get("args", ())
        kwargs = request.get("kwargs", {})
        try:
            result = callback(*args, **kwargs)
            response = {"success": True, "result": result}
        except Exception as exc:
            response = {"success": False, "error": str(exc)}
        _publish_response(response_signal, response_guard, response)
        THREAD_BUS.clear_queue(self._queue_name)


def start_bus_task(
    callback: Callable[..., Any],
    *args: Any,
    thread_name: str = "BusTaskThread",
    daemon: bool = True,
    response_signal: str = "",
    **kwargs: Any,
) -> BusTaskThread:
    """Start one named Thread subclass with all task data routed by THREAD_BUS."""
    queue_name = f"pyfoundations.bus_task.{uuid.uuid4().hex}"
    response_guard = _response_guard_name(response_signal) if response_signal else ""
    if response_guard:
        THREAD_BUS.signal(response_guard, True)
    THREAD_BUS.send_message(queue_name, {
        "callback": callback,
        "args": args,
        "kwargs": kwargs,
        "response_signal": response_signal,
        "response_guard": response_guard,
    })
    thread = BusTaskThread(queue_name, thread_name, daemon)
    try:
        thread.start()
    except Exception:
        THREAD_BUS.clear_queue(queue_name)
        if response_guard:
            THREAD_BUS.clear_signal(response_guard)
        raise
    return thread


def _run_coroutine_on_loop(
    loop: Any,
    coroutine: Any,
    timeout: float | None,
) -> Any:
    future = asyncio.run_coroutine_threadsafe(coroutine, loop)
    return future.result(timeout=timeout)


def submit_coroutine_via_bus(
    loop: Any,
    coroutine: Any,
    *,
    wait: bool = False,
    timeout: float | None = None,
    thread_name: str = "AsyncioBusBridgeThread",
) -> Any:
    """Submit a coroutine from another thread with all payloads routed by THREAD_BUS."""
    response_signal = (
        f"pyfoundations.asyncio_bridge.{uuid.uuid4().hex}" if wait else ""
    )
    thread = start_bus_task(
        _run_coroutine_on_loop,
        loop,
        coroutine,
        timeout,
        thread_name=thread_name,
        response_signal=response_signal,
    )
    if not wait:
        return thread
    response_timeout = None if timeout is None else timeout + 1.0
    response = THREAD_BUS.wait_signal(response_signal, timeout=response_timeout)
    THREAD_BUS.clear_signal(_response_guard_name(response_signal))
    THREAD_BUS.clear_signal(response_signal)
    if not isinstance(response, dict):
        raise TimeoutError(f"Asyncio bus bridge timed out: {thread_name}")
    if not response.get("success"):
        raise RuntimeError(response.get("error", "Asyncio bus bridge failed"))
    return response.get("result")


async def await_bus_task(
    callback: Callable[..., Any],
    *args: Any,
    thread_name: str = "AsyncBusTaskThread",
    timeout: float | None = None,
    **kwargs: Any,
) -> Any:
    """Await one named Thread-subclass task whose result travels on THREAD_BUS.

    Uses an asyncio.Future woken via loop.call_soon_threadsafe — no poll loop.
    """
    loop = asyncio.get_running_loop()
    future: asyncio.Future = loop.create_future()

    def worker() -> Any:
        try:
            result = callback(*args, **kwargs)
        except Exception as exc:  # bounce the exception onto the loop thread
            loop.call_soon_threadsafe(_set_future_exception, future, exc)
            return None
        loop.call_soon_threadsafe(_set_future_result, future, result)
        return None

    # start_bus_task delivers the worker via THREAD_BUS on a fresh BusTaskThread.
    start_bus_task(worker, thread_name=thread_name)

    if timeout is None:
        return await future
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(f"Asynchronous bus task timed out: {thread_name}") from exc


def _set_future_result(future: asyncio.Future, result: Any) -> None:
    if not future.done():
        future.set_result(result)


def _set_future_exception(future: asyncio.Future, exc: BaseException) -> None:
    if not future.done():
        future.set_exception(exc)


def map_bus_tasks(
    callback: Callable[[Any], Any],
    items: list[Any],
    max_workers: int,
    thread_prefix: str = "BusMap",
    timeout: float | None = None,
) -> list[Any]:
    """Map items through a bounded set of bus-delivered Thread subclasses."""
    item_iterator = iter(enumerate(items))
    pending: list[tuple[int, str]] = []
    results: dict[int, Any] = {}

    def submit(index: int, item: Any) -> None:
        response_signal = f"pyfoundations.bus_map.{uuid.uuid4().hex}"
        start_bus_task(
            callback,
            item,
            thread_name=f"{thread_prefix}-{index + 1}",
            response_signal=response_signal,
        )
        pending.append((index, response_signal))

    for _ in range(max(1, min(max_workers, len(items)))):
        try:
            submit(*next(item_iterator))
        except StopIteration:
            break

    try:
        while pending:
            index, response_signal = pending.pop(0)
            response = THREAD_BUS.wait_signal(response_signal, timeout=timeout)
            THREAD_BUS.clear_signal(_response_guard_name(response_signal))
            THREAD_BUS.clear_signal(response_signal)
            if not isinstance(response, dict):
                raise TimeoutError(f"Bus map task timed out: {thread_prefix}-{index + 1}")
            if not response.get("success"):
                raise RuntimeError(response.get("error", "Bus map task failed"))
            results[index] = response.get("result")
            try:
                submit(*next(item_iterator))
            except StopIteration:
                pass
    finally:
        for _index, pending_signal in pending:
            THREAD_BUS.clear_signal(pending_signal)

    return [results[index] for index in range(len(items))]


def init_serialized_owner(
    owner: Any,
    queue_prefix: str,
    thread_prefix: str,
    timeout: float = DEFAULT_SERIALIZED_TIMEOUT,
) -> None:
    """Give one object a dedicated THREAD_BUS-backed state-owner thread."""
    owner_id = uuid.uuid4().hex
    owner._serialized_queue_name = f"{queue_prefix}.{owner_id}"
    owner._serialized_thread_name = f"{thread_prefix}-{owner_id[:8]}"
    owner._serialized_timeout = timeout
    worker = SerializedWorkerThread(
        owner._serialized_queue_name,
        owner._serialized_thread_name,
    )
    worker.start()


def _invoke_serialized_method(
    method: Callable[..., Any],
    owner: Any,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> Any:
    """Invoke a bound state method on its owner thread."""
    return method(owner, *args, **kwargs)


def serialized_method(method: Callable[..., Any]) -> Callable[..., Any]:
    """Route a synchronous instance method through its state-owner queue."""
    @wraps(method)
    def wrapper(owner: Any, *args: Any, **kwargs: Any) -> Any:
        thread_name = getattr(owner, "_serialized_thread_name", "")
        if threading.current_thread().name == thread_name:
            return method(owner, *args, **kwargs)
        return call_serialized(
            owner._serialized_queue_name,
            _invoke_serialized_method,
            method,
            owner,
            args,
            kwargs,
            timeout=float(getattr(owner, "_serialized_timeout", DEFAULT_SERIALIZED_TIMEOUT)),
        )
    return wrapper


class SerializedStateObject:
    """Route instance data attributes through one THREAD_BUS state owner."""

    def enable_serialized_state(
        self,
        queue_prefix: str,
        thread_prefix: str,
        timeout: float = DEFAULT_SERIALIZED_TIMEOUT,
    ) -> None:
        init_serialized_owner(self, queue_prefix, thread_prefix, timeout)

    @serialized_method
    def _serialized_state_get(self, name: str) -> Any:
        return copy.deepcopy(object.__getattribute__(self, name))

    @serialized_method
    def _serialized_state_set(self, name: str, value: Any) -> None:
        object.__setattr__(self, name, copy.deepcopy(value))

    def __getattribute__(self, name: str) -> Any:
        if name.startswith("_serialized_") or name == "enable_serialized_state":
            return object.__getattribute__(self, name)

        attributes = object.__getattribute__(self, "__dict__")
        owner_thread = attributes.get("_serialized_thread_name", "")
        if name in attributes and owner_thread:
            if threading.current_thread().name == owner_thread:
                return object.__getattribute__(self, name)
            state_getter = object.__getattribute__(self, "_serialized_state_get")
            return state_getter(name)
        return object.__getattribute__(self, name)

    def __setattr__(self, name: str, value: Any) -> None:
        attributes = object.__getattribute__(self, "__dict__")
        owner_thread = attributes.get("_serialized_thread_name", "")
        if name.startswith("_serialized_") or not owner_thread:
            object.__setattr__(self, name, value)
            return
        if threading.current_thread().name == owner_thread:
            object.__setattr__(self, name, value)
            return

        descriptor = vars(type(self)).get(name)
        if isinstance(descriptor, property) and descriptor.fset is not None:
            object.__setattr__(self, name, value)
            return
        state_setter = object.__getattribute__(self, "_serialized_state_set")
        state_setter(name, value)


class SerializedDeque:
    """A small deque whose operations execute on one THREAD_BUS state owner."""

    def __init__(self, items: Any = (), name: str = "SerializedDeque") -> None:
        self._items = deque(items)
        init_serialized_owner(self, "pyfoundations.serialized_deque", name)

    @serialized_method
    def append(self, item: Any) -> None:
        self._items.append(item)

    @serialized_method
    def extend(self, items: Any) -> None:
        self._items.extend(items)

    @serialized_method
    def popleft(self, default: Any = None) -> Any:
        if not self._items:
            return default
        return self._items.popleft()

    @serialized_method
    def snapshot(self) -> list[Any]:
        return list(self._items)

    @serialized_method
    def __len__(self) -> int:
        return len(self._items)


class SerializedSingletonProvider:
    """Create and retain one lazy singleton on a THREAD_BUS state owner."""

    def __init__(
        self,
        factory: Callable[..., Any],
        queue_prefix: str,
        thread_prefix: str,
        timeout: float = DEFAULT_SERIALIZED_TIMEOUT,
    ) -> None:
        self._factory = factory
        self._instance = None
        init_serialized_owner(
            self,
            queue_prefix,
            thread_prefix,
            timeout=timeout,
        )

    @serialized_method
    def get(self, *args: Any, **kwargs: Any) -> Any:
        if self._instance is None:
            self._instance = self._factory(*args, **kwargs)
        return self._instance


class SerializedValue:
    """Store one mutable value on a THREAD_BUS state owner."""

    def __init__(self, value: Any, name: str = "SerializedValue") -> None:
        self._value = value
        init_serialized_owner(
            self,
            "pyfoundations.serialized_value",
            name,
        )

    @serialized_method
    def get(self) -> Any:
        return self._value

    @serialized_method
    def set(self, value: Any) -> Any:
        self._value = value
        return value

    @serialized_method
    def compare_and_set(self, expected: Any, value: Any) -> bool:
        if self._value != expected:
            return False
        self._value = value
        return True


def call_serialized(
    queue_name: str,
    callback: Callable[..., Any],
    *args: Any,
    timeout: float = DEFAULT_SERIALIZED_TIMEOUT,
    **kwargs: Any,
) -> Any:
    """Execute one callback on its queue owner and return the bus response."""
    response_signal = f"{queue_name}.response.{uuid.uuid4().hex}"
    response_guard = _response_guard_name(response_signal)
    THREAD_BUS.signal(response_guard, True)
    THREAD_BUS.send_message(queue_name, {
        "callback": callback,
        "args": args,
        "kwargs": kwargs,
        "response_signal": response_signal,
        "response_guard": response_guard,
    })
    response = THREAD_BUS.wait_signal(response_signal, timeout=timeout)
    THREAD_BUS.clear_signal(response_guard)
    THREAD_BUS.clear_signal(response_signal)
    if not isinstance(response, dict):
        raise TimeoutError(f"Serialized operation timed out: {queue_name}")
    if not response.get("success"):
        raise RuntimeError(response.get("error", "Serialized operation failed"))
    return response.get("result")


__all__ = [
    "DEFAULT_SERIALIZED_TIMEOUT",
    "await_bus_task",
    "BusTaskThread",
    "SerializedWorkerThread",
    "SerializedDeque",
    "SerializedSingletonProvider",
    "SerializedStateObject",
    "SerializedValue",
    "call_serialized",
    "init_serialized_owner",
    "map_bus_tasks",
    "serialized_method",
    "start_bus_task",
    "submit_coroutine_via_bus",
]

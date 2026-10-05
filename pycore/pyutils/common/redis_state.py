# -*- coding: utf-8 -*-
"""Optional shared Redis state for pycore (snapshots, streams) with in-process fallback.

Redis is never required: while it is unreachable every call returns its
default at once (no I/O, no wait), and one probe thread re-tries with backoff
until it answers. Calls never raise Redis or socket errors; a failing call
marks Redis down and starts the probe.

Keys are ``pycore:<machine>:<name>`` so a shared server (Laravel's Redis or a
Dragonfly with ``noeviction``) is never polluted: every write carries a TTL or
a ``MAXLEN``. Protocol 2 is forced because Redis 5 rejects RESP3 ``HELLO``.
The sync client serves any thread with short socket timeouts; the asyncio
client is created inside the RPC server loop only.
"""

from __future__ import annotations

import re
import socket
import traceback
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.batch_owner_thread import BatchOwnerThread
from pycore.pyfoundations.json_codec import json_codec
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import RunningFlag
from pycore.pyfoundations.service_contract import host, port
from pycore.pyfoundations.third_party.api import get_third_package_redis
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

REDIS_KEY_ROOT = "pycore"
REDIS_PROTOCOL = 2
REDIS_SYNC_TIMEOUT_SECONDS = 0.25
REDIS_SYNC_MAX_CONNECTIONS = 8
REDIS_ASYNC_TIMEOUT_SECONDS = 35.0
REDIS_PROBE_INITIAL_SECONDS = 1.0
REDIS_PROBE_MAX_SECONDS = 30.0
REDIS_PROBE_QUEUE = "pyutils.common.redis_state.probe"
REDIS_PROBE_THREAD = "RedisStateProbeThread"
REDIS_MACHINE_PATTERN = re.compile(r"[^a-z0-9_.-]+")

T = TypeVar("T")
StreamEntry = Tuple[str, Dict[str, bytes]]


class RedisState:
    """Health-tracked Redis access; construction starts no connection."""

    def __init__(self) -> None:
        machine = REDIS_MACHINE_PATTERN.sub("-", socket.gethostname().strip().lower()) or "machine"
        self.prefix = f"{REDIS_KEY_ROOT}:{machine}:"
        self._healthy = RunningFlag("redis_state.healthy")
        self._probing = RunningFlag("redis_state.probing")
        self._redis: Any = None
        self._client: Any = None
        self._async_client: Any = None
        self._errors: Tuple[type, ...] = (OSError,)
        self._disabled = False
        self._prober = BatchOwnerThread(
            f"{REDIS_PROBE_QUEUE}.{uuid.uuid4().hex}",
            REDIS_PROBE_THREAD,
            self._probe_until_up,
            self._report_probe_failure,
            1,
        )
        self._prober.start()

    @property
    def available(self) -> bool:
        """True while Redis answers; otherwise False at once, with a probe running."""
        if self._healthy.is_running():
            return True
        if not self._disabled and self._probing.start():
            self._prober.post(True)
        return False

    def key(self, *parts: str) -> str:
        return self.prefix + ":".join(str(part) for part in parts)

    def set_json(self, key: str, value: Any, ttl_seconds: float) -> bool:
        payload = json_codec.encode(value, default=str)
        ttl_ms = max(1, int(float(ttl_seconds) * 1000))
        return bool(self._run(lambda client: client.set(key, payload, px=ttl_ms), False))

    def get_json(self, key: str) -> Any:
        return self._decode(key, self._run(lambda client: client.get(key), None))

    def delete(self, *keys: str) -> int:
        if not keys:
            return 0
        return int(self._run(lambda client: client.delete(*keys), 0))

    def hset_json(self, key: str, field: str, value: Any, ttl_seconds: float) -> bool:
        payload = json_codec.encode(value, default=str)
        ttl_ms = max(1, int(float(ttl_seconds) * 1000))

        def write(client: Any) -> bool:
            pipeline = client.pipeline(transaction=False)
            pipeline.hset(key, field, payload)
            pipeline.pexpire(key, ttl_ms)
            pipeline.execute()
            return True

        return bool(self._run(write, False))

    def hget_json(self, key: str, field: str) -> Any:
        return self._decode(key, self._run(lambda client: client.hget(key, field), None))

    def hgetall_json(self, key: str) -> Dict[str, Any]:
        raw = self._run(lambda client: client.hgetall(key), {})
        return {
            self._text(name): self._decode(key, value)
            for name, value in raw.items()
        }

    def xadd(self, stream: str, fields: Dict[str, Any], maxlen: int, ttl_seconds: float) -> Optional[str]:
        """Append one entry, trimmed to about ``maxlen`` entries; the stream expires ``ttl_seconds`` after its last write."""
        ttl_ms = max(1, int(float(ttl_seconds) * 1000))

        def write(client: Any) -> str:
            pipeline = client.pipeline(transaction=False)
            pipeline.xadd(stream, fields, maxlen=int(maxlen), approximate=True)
            pipeline.pexpire(stream, ttl_ms)
            return self._text(pipeline.execute()[0])

        return self._run(write, None)

    def xrange(self, stream: str, start: str = "-", end: str = "+", count: Optional[int] = None) -> List[StreamEntry]:
        return self._entries(self._run(lambda client: client.xrange(stream, start, end, count), []))

    def xrevrange(self, stream: str, end: str = "+", start: str = "-", count: Optional[int] = None) -> List[StreamEntry]:
        return self._entries(self._run(lambda client: client.xrevrange(stream, end, start, count), []))

    async def xread(self, streams: Dict[str, str], block_ms: int, count: int) -> List[Tuple[str, List[StreamEntry]]]:
        """Blocking read on the RPC loop; an empty list on timeout or while Redis is down."""
        client = self._async_redis()
        if client is None:
            return []
        try:
            response = await client.xread(streams, count=int(count), block=int(block_ms))
        except self._errors as exc:
            self._mark_down(exc)
            return []
        return [(self._text(name), self._entries(entries)) for name, entries in response or []]

    def _async_redis(self) -> Any:
        if not self.available:
            return None
        if self._async_client is None:
            self._async_client = self._redis.asyncio.Redis(
                host=host("loopback"),
                port=port("redis"),
                protocol=REDIS_PROTOCOL,
                socket_timeout=REDIS_ASYNC_TIMEOUT_SECONDS,
                socket_connect_timeout=REDIS_SYNC_TIMEOUT_SECONDS,
            )
        return self._async_client

    def _run(self, operation: Callable[[Any], T], default: T) -> T:
        if not self.available:
            return default
        try:
            return operation(self._client)
        except self._errors as exc:
            self._mark_down(exc)
            return default

    def _mark_down(self, error: BaseException) -> None:
        if self._healthy.stop():
            ColorPrint.yellow(f"[RedisState] unavailable ({error!r}); in-process state is used until it answers")

    def _probe_until_up(self, _batch: List[Any]) -> None:
        try:
            redis_module = get_third_package_redis()
            if redis_module is None:
                self._disabled = True
                ColorPrint.yellow("[RedisState] redis package unavailable; in-process state is used")
                return
            backoff = Backoff(REDIS_PROBE_INITIAL_SECONDS, REDIS_PROBE_MAX_SECONDS)
            while not self._connect(redis_module):
                if backoff.failures == 0:
                    ColorPrint.yellow(
                        f"[RedisState] not reachable at {host('loopback')}:{port('redis')}; "
                        "in-process state is used and the probe retries with backoff"
                    )
                if not backoff.sleep():
                    return
        finally:
            self._probing.stop()

    def _connect(self, redis_module: Any) -> bool:
        client = redis_module.Redis(
            host=host("loopback"),
            port=port("redis"),
            protocol=REDIS_PROTOCOL,
            socket_timeout=REDIS_SYNC_TIMEOUT_SECONDS,
            socket_connect_timeout=REDIS_SYNC_TIMEOUT_SECONDS,
            max_connections=REDIS_SYNC_MAX_CONNECTIONS,
        )
        errors = (redis_module.exceptions.RedisError, OSError)
        try:
            client.ping()
        except errors:
            return False
        self._redis = redis_module
        self._errors = errors
        self._client = client
        if self._healthy.start():
            ColorPrint.green(f"[RedisState] connected {host('loopback')}:{port('redis')} prefix={self.prefix}")
        return True

    def _decode(self, key: str, raw: Any) -> Any:
        if raw is None:
            return None
        try:
            return json_codec.decode(raw)
        except json_codec.DecodeError as exc:
            ColorPrint.yellow(f"[RedisState] undecodable value at {key}: {exc!r}")
            return None

    @staticmethod
    def _text(value: Any) -> str:
        return value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value)

    def _entries(self, raw: Any) -> List[StreamEntry]:
        return [
            (self._text(entry_id), {self._text(name): value for name, value in fields.items()})
            for entry_id, fields in raw or []
        ]

    @staticmethod
    def _report_probe_failure(exc: BaseException) -> None:
        trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).rstrip()
        ColorPrint.red(f"[RedisState] probe failed: {exc!r}\n{trace}")


redis_state = RedisState()


__all__ = ["RedisState", "redis_state"]

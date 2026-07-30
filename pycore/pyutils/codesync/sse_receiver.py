# -*- coding: utf-8 -*-
"""Code Sync CLIENT-side SSE receiver."""

import json
import time
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict

from pycore.pyfoundations.http_sse import (
    SSE_REQUEST_HEADERS,
    is_sse_content_type,
    read_sse_event,
)
from pycore.pyfoundations.pygvar import PYCORE_HTTP_PORT

from pycore.pyutils.codesync.runtime import (
    THREAD_BUS,
    http as requests,
    init_serialized_owner,
    is_shutdown_requested,
    log as ColorPrint,
    serialized_method,
    start_bus_task,
)
from pycore.pyutils.codesync.sse_transport import (
    SSE_ACK_PATH,
    SSE_EVENT_NAME,
    SSE_STREAM_PATH,
)


SSE_RECONNECT_MAX_SECONDS = 30.0


class SseReceiver:
    """Maintain one inbound DEV SSE stream per configured peer."""

    def __init__(self, manager: Any) -> None:
        self.m = manager
        self._running = False
        self._threads: Dict[str, Any] = {}
        self._last_frames: Dict[str, str] = {}
        self._running_signal = f"codesync.sse_receiver.running.{uuid.uuid4().hex}"
        init_serialized_owner(self, "codesync.sse_receiver.state", "CodeSyncSseReceiverState")
        THREAD_BUS.signal(self._running_signal, False)

    def start(self) -> None:
        if not self._begin_start():
            return
        start_bus_task(self._supervisor, thread_name="CodeSync-SseReceiver")
        ColorPrint.green("[CodeSync SSE] Client receiver started")

    def stop(self) -> None:
        self._set_running(False)

    @serialized_method
    def _begin_start(self) -> bool:
        if self._running:
            return False
        self._running = True
        THREAD_BUS.signal(self._running_signal, True)
        return True

    @serialized_method
    def _set_running(self, running: bool) -> None:
        self._running = bool(running)
        THREAD_BUS.signal(self._running_signal, bool(running))

    def _supervisor(self) -> None:
        while THREAD_BUS.get_signal(self._running_signal, False) and not is_shutdown_requested():
            if self.m.get_role() == "client":
                for peer in self.m.config.dev_peers():
                    self._ensure_worker(peer)
            for _ in range(6):
                if not THREAD_BUS.get_signal(self._running_signal, False):
                    return
                time.sleep(0.5)

    @serialized_method
    def _ensure_worker(self, peer: Dict[str, Any]) -> None:
        peer_id = str(peer.get("id") or "").strip()
        worker = self._threads.get(peer_id)
        if not peer_id or (worker is not None and worker.is_alive()):
            return
        self._threads[peer_id] = start_bus_task(
            self._receive_from,
            dict(peer),
            thread_name=f"CodeSync-SSE-{peer_id}",
        )

    @serialized_method
    def _remove_worker(self, peer_id: str) -> None:
        self._threads.pop(str(peer_id or "").strip(), None)

    @serialized_method
    def _last_frame(self, peer_id: str) -> str:
        return self._last_frames.get(str(peer_id or "").strip(), "")

    @serialized_method
    def _store_last_frame(self, peer_id: str, frame_id: str) -> None:
        self._last_frames[str(peer_id or "").strip()] = str(frame_id or "").strip()

    def _receive_from(self, peer: Dict[str, Any]) -> None:
        peer_id = str(peer.get("id") or "").strip()
        host = str(peer.get("host") or "").strip()
        port = int(peer.get("port", PYCORE_HTTP_PORT) or PYCORE_HTTP_PORT)
        delay = 1.0
        while (
            THREAD_BUS.get_signal(self._running_signal, False)
            and self.m.get_role() == "client"
            and not is_shutdown_requested()
        ):
            try:
                self._consume_stream(peer_id, host, port)
                delay = 1.0
            except Exception as exc:
                ColorPrint.yellow(
                    f"[CodeSync SSE] DEV {host}:{port} disconnected ({exc}); "
                    f"retrying in {delay:.0f}s"
                )
                time.sleep(delay)
                delay = min(SSE_RECONNECT_MAX_SECONDS, delay * 2.0)
        self._remove_worker(peer_id)

    def _consume_stream(self, peer_id: str, host: str, port: int) -> None:
        client_id = self.m.config.machine_id
        query = urllib.parse.urlencode({
            "client_id": client_id,
            "client_port": int(
                self.m.config.get_self().get("port", PYCORE_HTTP_PORT)
                or PYCORE_HTTP_PORT
            ),
            "since_frame": self._last_frame(peer_id),
        })
        url = f"http://{host}:{port}{SSE_STREAM_PATH}?{query}"
        request = urllib.request.Request(
            url,
            headers=SSE_REQUEST_HEADERS,
            method="GET",
        )
        ColorPrint.green(f"[CodeSync SSE] Connecting to DEV {host}:{port}")
        with urllib.request.urlopen(request, timeout=60) as response:
            content_type = str(response.headers.get("Content-Type") or "")
            if not is_sse_content_type(content_type):
                raise ConnectionError(f"unexpected content type: {content_type}")
            while (
                THREAD_BUS.get_signal(self._running_signal, False)
                and self.m.get_role() == "client"
                and not is_shutdown_requested()
            ):
                event_name, data, _event_id = read_sse_event(response)
                if event_name == SSE_EVENT_NAME and data:
                    self._handle_frame(peer_id, host, port, data)

    def _handle_frame(self, peer_id: str, host: str, port: int, data: str) -> None:
        payload = json.loads(data)
        frame_id = str(payload.get("frame_id") or "").strip()
        frame = str(payload.get("frame") or "")
        replies = []
        accepted = self.m.push_receiver.handle_text(frame, replies.append)
        reply = replies[0] if replies else ""
        response = requests.post(
            f"http://{host}:{port}{SSE_ACK_PATH}",
            json={
                "client_id": self.m.config.machine_id,
                "frame_id": frame_id,
                "reply": reply,
                "accepted": bool(accepted),
            },
            timeout=15,
        )
        if response.status_code != 200:
            raise ConnectionError(f"SSE acknowledgement failed: HTTP {response.status_code}")
        self._store_last_frame(peer_id, frame_id)

    @serialized_method
    def get_status(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "servers": [
                {"id": peer_id, "connected": worker.is_alive()}
                for peer_id, worker in self._threads.items()
            ],
        }


__all__ = ["SseReceiver"]

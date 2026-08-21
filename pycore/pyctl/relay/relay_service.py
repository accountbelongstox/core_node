# -*- coding: utf-8 -*-
"""Machine-side pycore relay runtime against the Laravel central server.

One facility owns the whole machine plane of the relay (PART_3 §3.4):

- Identity: stable machine id (pycore- prefix + OS installation digest),
  capabilities rendered from the shared contract.
- Registry: register -> heartbeat -> unregister through the contract
  endpoints; endpoint changes re-register against the new Laravel winner.
- Hub tokens: the register response seeds a Mercure 1.0 subscriber token;
  ``hub_token()`` is the single token provider for EVERY local subscriber
  (roster/pair stream here, Queue Center stream in snapshot_service) and
  refreshes it through /api/relay/hub-auth before expiry.
- Subscriptions: machines roster topic + this machine's pair topic.
- Request execution: relay.request frames on the pair topic fetch the full
  request, replay it against the LOCAL pycore HTTP server (RPC v2 :59000)
  through the shared dependency-free HttpClient, and post the response -
  inline under the contract cap, chunked blob above it.
"""

from __future__ import annotations

import platform
import socket
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.machine_id import get_machine_id
from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_client import HttpClient
from pycore.pyutils.common.mercure_client import (
    MERCURE_STATE_OFFLINE,
    MERCURE_STATE_ONLINE,
    MercureSubscriber,
    MercureUpdate,
)
from pycore.pyutils.common.queue_center_contract import (
    QUEUE_CENTER_RELAY,
    queue_center_endpoint,
    relay_cap,
    relay_event,
    relay_hub_int,
    relay_int,
    relay_topic,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


RELAY_STOP_SIGNAL = "relay.runtime.stop"
RELAY_ROSTER_SIGNAL = "relay.roster.changed"
RELAY_MACHINE_ID_PREFIX = "pycore-"
RELAY_HTTP_TIMEOUT_SECONDS = 8.0
# Refresh tokens once three quarters of the TTL have elapsed (the hub also
# closes streams at exp, so early refresh keeps reconnects seamless).
RELAY_TOKEN_LIFETIME_FRACTION = 0.75
RELAY_REGISTER_RETRY_MIN_SECONDS = 2.0
RELAY_REGISTER_RETRY_MAX_SECONDS = 60.0
RELAY_SUBSCRIBER_RECONNECT_MIN_SECONDS = 1.0
RELAY_SUBSCRIBER_RECONNECT_MAX_SECONDS = 30.0
# One heartbeat every contract interval; failures escalate to re-register.
RELAY_HEARTBEAT_GRACE_SECONDS = 5.0


def _response_data(response: Any) -> Dict[str, Any]:
    status = int(getattr(response, "status_code", 0) or 0)
    if status < 200 or status >= 300:
        raise RuntimeError(f"Relay request failed: HTTP {status}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError("Relay response must be an object")
    data = payload.get("data")
    return dict(data) if isinstance(data, dict) else dict(payload)


class RelayService:
    """Own the machine-side relay plane for the whole pycore process."""

    def __init__(self) -> None:
        init_serialized_owner(
            self,
            "relay.runtime.state",
            "RelayRuntimeStateThread",
        )
        self._machine_id = RELAY_MACHINE_ID_PREFIX + get_machine_id()[:12]
        self._threads: List[threading.Thread] = []
        self._token = ""
        self._token_expires_at = 0.0
        self._token_lock = threading.Lock()
        self._hub_url = ""
        self._roster: Dict[str, Dict[str, Any]] = {}
        self._registered_endpoint = ""
        self._executor = HttpClient(
            base_url=f"http://{HTTP_LOOPBACK_HOST}:{PYCORE_HTTP_PORT}",
            default_timeout=30.0,
        )
        THREAD_BUS.clear_signal(RELAY_STOP_SIGNAL)
        laravel_endpoint_manager.register_endpoint_change_listener(
            self._on_endpoint_changed
        )

    # ------------------------------------------------------------- lifecycle

    @serialized_method
    def start(self) -> None:
        if self._threads and any(thread.is_alive() for thread in self._threads):
            return
        THREAD_BUS.clear_signal(RELAY_STOP_SIGNAL)
        self._threads = [
            threading.Thread(
                target=self._registry_loop,
                name="RelayRegistryThread",
                daemon=True,
            ),
            threading.Thread(
                target=self._subscriber_loop,
                name="RelaySubscriberThread",
                daemon=True,
            ),
        ]
        for thread in self._threads:
            thread.start()
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=60,
            name="relay_runtime",
        )

    def stop(self) -> None:
        THREAD_BUS.signal(RELAY_STOP_SIGNAL, True)
        self._unregister_best_effort()

    # -------------------------------------------------------------- identity

    @property
    def machine_id(self) -> str:
        return self._machine_id

    def capabilities(self) -> List[str]:
        claimants = QUEUE_CENTER_RELAY.get("capability_providers")
        mine = (
            claimants.get("pycore")
            if isinstance(claimants, dict)
            else None
        )
        provides = mine.get("provides") if isinstance(mine, dict) else None
        return [str(item) for item in (provides or []) if item]

    # ------------------------------------------------------------ hub tokens

    def hub_token(self, force_refresh: bool = False) -> str:
        """Token provider for every local Mercure subscriber (shared auth)."""
        with self._token_lock:
            if (
                not force_refresh
                and self._token
                and time.time() < self._token_expires_at
            ):
                return self._token
        token = self._request_machine_token()
        with self._token_lock:
            self._token = token
            ttl = max(1, relay_hub_int("token_ttl_seconds") or 600)
            self._token_expires_at = time.time() + ttl * RELAY_TOKEN_LIFETIME_FRACTION
        return token

    # ---------------------------------------------------------------- roster

    def roster(self) -> Dict[str, Dict[str, Any]]:
        return dict(self._roster)

    # ------------------------------------------------------------------ loop

    def _should_stop(self) -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(
            THREAD_BUS.get_signal(RELAY_STOP_SIGNAL, False)
        )

    def _pause(self, seconds: float) -> None:
        THREAD_BUS.wait_signal(RELAY_STOP_SIGNAL, timeout=seconds)

    def _on_endpoint_changed(self, base_url: str) -> None:
        # A new Laravel winner invalidates registration + roster state; the
        # registry loop re-registers on its next tick.
        self._registered_endpoint = ""

    def _endpoint(self) -> str:
        active = laravel_endpoint_manager.get_active_base_url()
        return str(active or "").rstrip("/")

    def _registry_loop(self) -> None:
        retry_seconds = RELAY_REGISTER_RETRY_MIN_SECONDS
        while not self._should_stop():
            endpoint = self._endpoint()
            if not endpoint:
                self._pause(RELAY_REGISTER_RETRY_MAX_SECONDS)
                continue
            try:
                self._register(endpoint)
                retry_seconds = RELAY_REGISTER_RETRY_MIN_SECONDS
                self._heartbeat_until_restart(endpoint)
            except Exception as exc:  # noqa: BLE001 - loop must survive
                ColorPrint.yellow(f"[Relay] registry retry: {exc}")
                retry_seconds = min(
                    RELAY_REGISTER_RETRY_MAX_SECONDS,
                    retry_seconds * 2,
                )
                self._pause(retry_seconds)

    def _register(self, endpoint: str) -> None:
        data = _response_data(
            laravel_client.post(
                queue_center_endpoint("relay_machine_register"),
                base_url=endpoint,
                json={
                    "machine_id": self._machine_id,
                    "label": socket.gethostname() or self._machine_id,
                    "capabilities": self.capabilities(),
                    "hostname": socket.gethostname(),
                    "platform": platform.platform(),
                },
                timeout=RELAY_HTTP_TIMEOUT_SECONDS,
            )
        )
        hub = data.get("hub") if isinstance(data.get("hub"), dict) else {}
        with self._token_lock:
            if hub.get("token"):
                self._token = str(hub["token"])
                ttl = int(hub.get("token_ttl_seconds") or 0) or relay_hub_int(
                    "token_ttl_seconds"
                ) or 600
                self._token_expires_at = (
                    time.time() + ttl * RELAY_TOKEN_LIFETIME_FRACTION
                )
            if hub.get("hub_url"):
                self._hub_url = str(hub["hub_url"])
        self._registered_endpoint = endpoint
        ColorPrint.green(
            f"[Relay] registered {self._machine_id} at {endpoint}"
        )

    def _heartbeat_until_restart(self, endpoint: str) -> None:
        interval = max(5.0, float(relay_int("machine_heartbeat_seconds") or 20))
        while not self._should_stop():
            if self._endpoint() != endpoint or not self._registered_endpoint:
                return
            self._pause(interval - RELAY_HEARTBEAT_GRACE_SECONDS)
            if self._should_stop():
                return
            _response_data(
                laravel_client.post(
                    queue_center_endpoint("relay_machine_heartbeat"),
                    base_url=endpoint,
                    json={"machine_id": self._machine_id},
                    timeout=RELAY_HTTP_TIMEOUT_SECONDS,
                )
            )

    def _unregister_best_effort(self) -> None:
        endpoint = self._registered_endpoint
        if not endpoint:
            return
        try:
            laravel_client.post(
                queue_center_endpoint("relay_machine_unregister"),
                base_url=endpoint,
                json={"machine_id": self._machine_id},
                timeout=RELAY_HTTP_TIMEOUT_SECONDS,
            )
        except Exception:  # noqa: BLE001 - shutdown path
            pass

    def _request_machine_token(self) -> str:
        endpoint = self._registered_endpoint or self._endpoint()
        if not endpoint:
            raise RuntimeError("Laravel endpoint is unavailable")
        data = _response_data(
            laravel_client.post(
                queue_center_endpoint("relay_hub_auth"),
                base_url=endpoint,
                json={"mode": "machine", "machine_id": self._machine_id},
                timeout=RELAY_HTTP_TIMEOUT_SECONDS,
            )
        )
        if not data.get("token"):
            raise RuntimeError("Relay hub-auth returned no token")
        if data.get("hub_url"):
            self._hub_url = str(data["hub_url"])
        return str(data["token"])

    # ----------------------------------------------------------- subscriber

    def _subscriber_loop(self) -> None:
        while not self._should_stop():
            hub_url = self._hub_url
            if not hub_url:
                self._pause(RELAY_REGISTER_RETRY_MIN_SECONDS)
                continue
            subscriber = MercureSubscriber(
                hub_url,
                [
                    relay_topic("machines"),
                    relay_topic("pair", machine_id=self._machine_id),
                ],
                token_provider=self.hub_token,
                on_update=self._on_update,
                on_state_change=self._on_hub_state,
                reconnect_min_seconds=RELAY_SUBSCRIBER_RECONNECT_MIN_SECONDS,
                reconnect_max_seconds=RELAY_SUBSCRIBER_RECONNECT_MAX_SECONDS,
            )
            try:
                subscriber.run(self._should_stop)
            except Exception as exc:  # noqa: BLE001 - lane must survive
                ColorPrint.yellow(f"[Relay] hub stream restart: {exc}")
            if self._should_stop():
                return
            self._pause(RELAY_SUBSCRIBER_RECONNECT_MIN_SECONDS)

    def _on_hub_state(self, state: str, detail: str) -> None:
        if state == MERCURE_STATE_ONLINE:
            ColorPrint.green(f"[Relay] hub stream online ({detail})")
        elif state == MERCURE_STATE_OFFLINE:
            ColorPrint.yellow(f"[Relay] hub stream offline: {detail}")

    # -------------------------------------------------------------- updates

    def _on_update(self, update: MercureUpdate) -> None:
        if update.type == relay_event("request"):
            self._handle_request_frame(update)
        elif update.type == relay_event("roster"):
            self._handle_roster_frame(update)
        # relay.response frames target the session side; machines ignore them.

    def _handle_roster_frame(self, update: MercureUpdate) -> None:
        try:
            payload = update.json()
        except ValueError:
            return
        if not isinstance(payload, dict):
            return
        machine_id = str(payload.get("machine_id") or "")
        if not machine_id:
            return
        if bool(payload.get("online")):
            self._roster[machine_id] = {
                "machine_id": machine_id,
                "label": str(payload.get("label") or machine_id),
                "capabilities": [
                    str(item)
                    for item in (payload.get("capabilities") or [])
                    if item
                ],
                "online": True,
            }
        else:
            self._roster.pop(machine_id, None)
        THREAD_BUS.signal_if_present(RELAY_ROSTER_SIGNAL, dict(self._roster))

    # ------------------------------------------------------------ execution

    def _handle_request_frame(self, update: MercureUpdate) -> None:
        try:
            frame = update.json()
            request_id = str(frame.get("request_id") or "")
            if not request_id:
                return
            request = self._fetch_request(request_id)
            status, headers, body = self._execute(request)
            self._post_response(request_id, status, headers, body)
        except Exception as exc:  # noqa: BLE001 - one frame never kills the lane
            ColorPrint.yellow(f"[Relay] request execution failed: {exc}")

    def _fetch_request(self, request_id: str) -> Dict[str, Any]:
        data = _response_data(
            laravel_client.get(
                queue_center_endpoint(
                    "relay_request_fetch",
                    machine_id=self._machine_id,
                    request_id=request_id,
                ),
                base_url=self._registered_endpoint or self._endpoint(),
                timeout=RELAY_HTTP_TIMEOUT_SECONDS,
            )
        )
        request = data.get("request") if isinstance(data.get("request"), dict) else {}
        if not request:
            raise RuntimeError(f"Relay request {request_id} is empty")
        return dict(request)

    def _execute(self, request: Dict[str, Any]) -> Tuple[int, Dict[str, str], str]:
        method = str(request.get("method") or "GET").upper()
        path = str(request.get("path") or "/")
        headers = {
            str(key): str(value)
            for key, value in dict(request.get("headers") or {}).items()
        }
        body_ref = str(request.get("body_ref") or "")
        body = request.get("body")
        if body is None and body_ref:
            body = self._fetch_blob(body_ref)
        response = self._executor.request(
            method,
            path,
            headers=headers or None,
            body=str(body).encode("utf-8") if body is not None else None,
            timeout=self._execute_timeout(),
        )
        forwarded_headers = {"Content-Type": response.headers.get("Content-Type", "")}
        return (
            response.status_code,
            forwarded_headers,
            response.text,
        )

    @staticmethod
    def _execute_timeout() -> float:
        ttl = relay_int("request_ttl_seconds") or 60
        return max(5.0, float(ttl) - 10.0)

    def _post_response(
        self,
        request_id: str,
        status: int,
        headers: Dict[str, str],
        body: str,
    ) -> None:
        inline_cap = relay_cap("inline_body_bytes") or 262144
        payload: Dict[str, Any] = {
            "request_id": request_id,
            "status": int(status),
            "headers": headers,
        }
        if len(body.encode("utf-8")) > inline_cap:
            payload["body_ref"] = self._upload_blob(body.encode("utf-8"))
        else:
            payload["body"] = body
        _response_data(
            laravel_client.post(
                queue_center_endpoint(
                    "relay_response",
                    machine_id=self._machine_id,
                ),
                base_url=self._registered_endpoint or self._endpoint(),
                json=payload,
                timeout=RELAY_HTTP_TIMEOUT_SECONDS,
            )
        )

    def _upload_blob(self, body: bytes) -> str:
        chunk_size = relay_cap("blob_chunk_bytes") or 4194304
        blob_id = ""
        chunk_index = 0
        total = max(1, (len(body) + chunk_size - 1) // chunk_size)
        for offset in range(0, len(body) or 1, chunk_size):
            chunk = body[offset : offset + chunk_size]
            data = _response_data(
                laravel_client.request(
                    "POST",
                    queue_center_endpoint(
                        "relay_blob_create",
                        machine_id=self._machine_id,
                    ),
                    base_url=self._registered_endpoint or self._endpoint(),
                    params={
                        "blob_id": blob_id,
                        "chunk_index": chunk_index,
                        "chunk_last": str(chunk_index + 1 >= total).lower(),
                    },
                    data=chunk,
                    headers={"Content-Type": "application/octet-stream"},
                    timeout=RELAY_HTTP_TIMEOUT_SECONDS,
                )
            )
            blob = data.get("blob") if isinstance(data.get("blob"), dict) else {}
            blob_id = str(blob.get("blob_id") or blob_id)
            chunk_index += 1
        if not blob_id:
            raise RuntimeError("Relay blob upload produced no blob id")
        return blob_id

    def _fetch_blob(self, blob_id: str) -> str:
        response = laravel_client.get(
            queue_center_endpoint(
                "relay_blob_fetch",
                machine_id=self._machine_id,
                blob_id=blob_id,
            ),
            base_url=self._registered_endpoint or self._endpoint(),
            timeout=RELAY_HTTP_TIMEOUT_SECONDS * 4,
        )
        if int(getattr(response, "status_code", 0) or 0) != 200:
            raise RuntimeError(f"Relay blob fetch failed: HTTP {response.status_code}")
        return (response.content or b"").decode("utf-8", errors="replace")


relay_service = RelayService()


__all__ = ["RelayService", "relay_service"]

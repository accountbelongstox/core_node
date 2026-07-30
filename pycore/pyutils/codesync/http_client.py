# -*- coding: utf-8 -*-
"""Code Sync frame adapter over the shared HTTP client."""

from typing import Optional

from pycore.pyutils.common.http_client import HttpClient


DEFAULT_PUSH_PATH = "/api/controller/code_sync.push_frame"
DEFAULT_PING_PATH = "/api/controller/ui.code_sync.ping"


class HttpFrameClient:
    """Send one protocol frame per persistent HTTP POST."""

    def __init__(
        self,
        host: str,
        port: int,
        path: str = DEFAULT_PUSH_PATH,
        timeout: float = 10.0,
        io_timeout: float = 120.0,
    ) -> None:
        self.host = host
        self.port = port
        self.path = path
        self.timeout = timeout
        self.io_timeout = io_timeout
        self._reply: Optional[str] = None
        self._http = HttpClient(
            base_url=f"http://{self.host}:{self.port}",
            default_timeout=self.timeout,
        )

    def connect(self) -> None:
        self._request(
            "POST",
            DEFAULT_PING_PATH,
            payload={},
            timeout=self.timeout,
        )

    def send_text(self, text: str) -> None:
        response = self._request(
            "POST",
            self.path,
            payload={"frame": text},
            timeout=self.io_timeout,
        )
        self._reply = response.get("reply")

    def recv_text(self) -> Optional[str]:
        reply = self._reply
        self._reply = None
        return reply

    def ping(self) -> None:
        self._request(
            "POST",
            DEFAULT_PING_PATH,
            payload={},
            timeout=self.timeout,
        )

    def close(self) -> None:
        self._reply = None
        self._http.close()

    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[dict] = None,
        timeout: float = 10.0,
    ) -> dict:
        response = self._http.request(
            method,
            path,
            json=payload,
            timeout=timeout,
        )
        if not response.ok:
            raise ConnectionError(
                f"HTTP {response.status_code} from {self.host}:{self.port}{path}"
            )
        result = response.json() if response.content else {}
        if not isinstance(result, dict):
            raise ConnectionError("Code Sync HTTP response must be a JSON object")
        return result


__all__ = ["HttpFrameClient"]

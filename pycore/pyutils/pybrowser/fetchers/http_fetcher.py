"""HTTP page fetcher."""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from pycore.pyfoundations.third_party.api import get_third_package_requests


@dataclass
class FetchResult:
    """Normalized fetch result consumed by the crawl controller."""

    success: bool
    content: str = ""
    error: Optional[str] = None
    status_code: Optional[int] = None
    headers: Dict[str, str] = field(default_factory=dict)


class HTTPFetcher:
    """Fetch pages through the shared requests dependency."""

    def __init__(self):
        self._requests = None
        self._session = None
        self._options: Dict[str, Any] = {}

    def initialize(self, options: Optional[Dict[str, Any]] = None) -> bool:
        self._options = dict(options or {})
        self._requests = get_third_package_requests()
        if self._requests is None:
            return False
        self._session = self._requests.Session()
        headers = self._options.get("headers")
        if isinstance(headers, dict):
            self._session.headers.update(headers)
        return True

    def fetch(self, url: str, options: Optional[Dict[str, Any]] = None) -> FetchResult:
        if self._session is None and not self.initialize():
            return FetchResult(False, error="requests is unavailable")
        request_options = dict(self._options)
        request_options.update(options or {})
        timeout_ms = request_options.pop("timeout", 30000)
        timeout = max(float(timeout_ms) / 1000.0, 0.001)
        request_options.pop("headers", None)
        try:
            response = self._session.get(url, timeout=timeout, **request_options)
            response.raise_for_status()
            return FetchResult(
                True,
                content=response.text,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
        except Exception as exc:
            return FetchResult(False, error=str(exc))

    def cleanup(self) -> None:
        if self._session is not None:
            self._session.close()
        self._session = None


__all__ = ["FetchResult", "HTTPFetcher"]

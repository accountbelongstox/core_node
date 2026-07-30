"""Frontend-specific configuration for the shared singleton detector."""

from typing import Callable, Optional

from pycore.pyfoundations.singleton.detector import SingletonDetector
from pycore.pyfoundations.singleton.protocol import DetectionResult


FRONTEND_SINGLETON_PROTOCOL = "PYCORE_FRONTEND_SINGLETON_V1"
FRONTEND_SINGLETON_PORT_START = 55000
FRONTEND_SINGLETON_PORT_RANGE = 100
FRONTEND_TAKEOVER_TIMEOUT_SECONDS = 15.0

FrontendDetectionResult = DetectionResult


class FrontendSingletonDetector(SingletonDetector):
    """Apply frontend defaults to the shared cross-process detector."""

    def __init__(
        self,
        app_id: str,
        port_start: int = FRONTEND_SINGLETON_PORT_START,
        port_range: int = FRONTEND_SINGLETON_PORT_RANGE,
        timeout: float = 1.0,
        debug: bool = False,
        on_shutdown_request: Optional[Callable[[], None]] = None,
    ) -> None:
        super().__init__(
            app_id=app_id,
            port_start=port_start,
            port_range=port_range,
            timeout=timeout,
            debug=debug,
            shutdown_existing=True,
            protocol_version=FRONTEND_SINGLETON_PROTOCOL,
            on_shutdown_request=on_shutdown_request,
            takeover_timeout=FRONTEND_TAKEOVER_TIMEOUT_SECONDS,
        )

    def detect_and_bind(
        self,
        shutdown_existing: bool = True,
    ) -> FrontendDetectionResult:
        """Detect the frontend instance and optionally replace the old one."""
        self.shutdown_existing = shutdown_existing
        return super().detect_and_bind()

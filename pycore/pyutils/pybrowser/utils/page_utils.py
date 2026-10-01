"""Selenium page adapter."""

from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.pybrowser.utils.selenium_runtime import webdriver_error


class PageWrapper:
    """Expose the screenshot contract expected by ScreenshotManager."""

    def __init__(self, driver: Any):
        self.driver = driver

    def screenshot(self, options: Optional[Dict[str, Any]] = None) -> Optional[bytes]:
        settings = dict(options or {})
        output_path = settings.get("path")
        try:
            content = self.driver.get_screenshot_as_png()
            if output_path:
                path = Path(output_path)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
        except (OSError, webdriver_error()) as e:
            ColorPrint.yellow(f"[PageWrapper] Screenshot failed: path={output_path} error={e}")
            return None
        return content


__all__ = ["PageWrapper"]

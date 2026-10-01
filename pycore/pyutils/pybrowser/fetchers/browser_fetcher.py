"""Browser-backed page fetcher."""

from typing import Any, Dict, Optional

from pycore.pyutils.pybrowser.fetchers.http_fetcher import FetchResult
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.pybrowser.implementations.browsers.chrome_browser import ChromeBrowser
from pycore.pyutils.pybrowser.utils.selenium_runtime import webdriver_error


class BrowserFetcher:
    """Fetch rendered HTML through a Selenium-compatible browser."""

    def __init__(self):
        self._browser = None
        self._owns_browser = False

    def initialize(self, options: Optional[Dict[str, Any]] = None) -> bool:
        settings = dict(options or {})
        browser = settings.pop("browser", None)
        driver = settings.pop("driver", None)
        if browser is not None:
            self._browser = browser
            return getattr(browser, "driver", None) is not None
        self._browser = ChromeBrowser(driver=driver)
        self._owns_browser = driver is None
        return self._browser.launch(settings)

    def fetch(self, url: str, options: Optional[Dict[str, Any]] = None) -> FetchResult:
        driver = getattr(self._browser, "driver", None)
        if driver is None:
            return FetchResult(False, error="Browser is not initialized")
        settings = options or {}
        timeout_ms = settings.get("timeout")
        try:
            if timeout_ms is not None:
                driver.set_page_load_timeout(max(float(timeout_ms) / 1000.0, 0.001))
            driver.get(url)
            content = driver.page_source
        except webdriver_error() as exc:
            ColorPrint.yellow(f"[BrowserFetcher] Fetch failed: url={url} error={exc}")
            return FetchResult(False, error=str(exc))
        return FetchResult(True, content=content)

    def cleanup(self) -> None:
        if self._owns_browser and self._browser is not None:
            self._browser.close()
        self._browser = None
        self._owns_browser = False


__all__ = ["BrowserFetcher"]

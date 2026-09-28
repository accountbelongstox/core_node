"""Concrete Selenium Chrome browser."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.third_party.api import get_third_package_selenium


class ChromeBrowser:
    """Own or adapt one Selenium Chrome driver."""

    def __init__(self, driver: Any = None):
        self.driver = driver
        self._owns_driver = driver is None

    def launch(self, options: Optional[Dict[str, Any]] = None) -> bool:
        if self.driver is not None:
            return True
        settings = dict(options or {})
        selenium = get_third_package_selenium()
        if selenium is None:
            return False
        chrome_options = selenium.webdriver.ChromeOptions()
        if settings.pop("headless", False):
            chrome_options.add_argument("--headless=new")
        binary_location = settings.pop("binary_location", None)
        if binary_location:
            chrome_options.binary_location = str(binary_location)
        for argument in settings.pop("arguments", []):
            chrome_options.add_argument(str(argument))
        try:
            self.driver = selenium.webdriver.Chrome(options=chrome_options, **settings)
            return True
        except Exception:
            self.driver = None
            return False

    def switch_to_tab(self, index: int) -> bool:
        handles = list(self.driver.window_handles) if self.driver is not None else []
        if index < 0 or index >= len(handles):
            return False
        self.driver.switch_to.window(handles[index])
        return True

    def close(self) -> None:
        if self.driver is not None and self._owns_driver:
            self.driver.quit()
        self.driver = None


__all__ = ["ChromeBrowser"]

"""Selenium browser-tab operations."""

from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit


class TabUtils:
    @staticmethod
    def switch_to_tab(driver: Any, index: int) -> bool:
        handles = list(driver.window_handles)
        if index < 0 or index >= len(handles):
            return False
        driver.switch_to.window(handles[index])
        return True

    @staticmethod
    def get_current_tab_index(driver: Any) -> int:
        handles = list(driver.window_handles)
        try:
            return handles.index(driver.current_window_handle)
        except ValueError:
            return -1

    @staticmethod
    def get_tab_count(driver: Any) -> int:
        return len(driver.window_handles)

    @staticmethod
    def get_all_tabs_info(driver: Any) -> List[Dict[str, Any]]:
        original = driver.current_window_handle
        tabs = []
        try:
            for index, handle in enumerate(list(driver.window_handles)):
                driver.switch_to.window(handle)
                tabs.append({"index": index, "handle": handle, "url": driver.current_url, "title": driver.title})
        finally:
            if original in driver.window_handles:
                driver.switch_to.window(original)
        return tabs

    @staticmethod
    def find_tab_by_url(driver: Any, url: str, exact_match: bool = False) -> int:
        return TabUtils._find(driver, "url", url, exact_match, True)

    @staticmethod
    def find_tab_by_url_domain(driver: Any, url: str, exact_match: bool = False) -> int:
        domain = urlsplit(url).netloc.lower()
        for tab in TabUtils.get_all_tabs_info(driver):
            candidate = urlsplit(tab["url"]).netloc.lower()
            if candidate == domain if exact_match else domain in candidate:
                return tab["index"]
        return -1

    @staticmethod
    def find_tab_by_title(driver: Any, title: str, exact_match: bool = False, case_sensitive: bool = False) -> int:
        return TabUtils._find(driver, "title", title, exact_match, case_sensitive)

    @staticmethod
    def find_blank_tab(driver: Any) -> int:
        for tab in TabUtils.get_all_tabs_info(driver):
            if tab["url"] in {"", "about:blank", "data:,"}:
                return tab["index"]
        return -1

    @staticmethod
    def close_tab(driver: Any, index: int, fallback_index: int = 0) -> bool:
        if not TabUtils.switch_to_tab(driver, index):
            return False
        driver.close()
        handles = list(driver.window_handles)
        if handles:
            target = min(max(fallback_index, 0), len(handles) - 1)
            driver.switch_to.window(handles[target])
        return True

    @staticmethod
    def _find(driver: Any, key: str, value: str, exact_match: bool, case_sensitive: bool) -> int:
        expected = value if case_sensitive else value.lower()
        for tab in TabUtils.get_all_tabs_info(driver):
            candidate = tab[key] if case_sensitive else tab[key].lower()
            if candidate == expected if exact_match else expected in candidate:
                return tab["index"]
        return -1


__all__ = ["TabUtils"]

"""Selenium submodules loaded after the lazy third_party selenium getter."""

import importlib

from pycore.pyfoundations.third_party.api import get_third_package_selenium


def selenium_webdriver():
    get_third_package_selenium()
    return importlib.import_module("selenium.webdriver")


def webdriver_error() -> type:
    get_third_package_selenium()
    return importlib.import_module("selenium.common.exceptions").WebDriverException


__all__ = ["selenium_webdriver", "webdriver_error"]

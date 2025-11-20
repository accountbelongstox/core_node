#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyBrowser Fetchers

Unified fetcher system providing 4 fetching modes:
- HTTP: Fast source HTML retrieval (requests)
- Browser: JS-rendered HTML (Selenium-based)
- Iframe: Recursive iframe content extraction
- Tampermonkey: WebSocket-based userscript integration

Usage:
    from pycore.pyutils.pybrowser.fetchers import HTTPFetcher, BrowserFetcher, IframeFetcher, TampermonkeyFetcher

    # HTTP mode (fastest)
    fetcher = HTTPFetcher()
    fetcher.initialize()
    result = fetcher.fetch('https://example.com')
    fetcher.cleanup()

    # Browser mode (JS execution)
    fetcher = BrowserFetcher()
    fetcher.initialize({'browser': 'edge', 'headless': False})
    result = fetcher.fetch('https://example.com')
    fetcher.cleanup()

    # Iframe mode (recursive)
    fetcher = IframeFetcher()
    fetcher.initialize()
    result = fetcher.fetch('https://example.com', {'maxDepth': 5, 'sameOriginOnly': True})
    fetcher.cleanup()

    # Tampermonkey mode (WebSocket)
    fetcher = TampermonkeyFetcher()
    fetcher.initialize({'port': 8765})
    result = fetcher.fetch('https://example.com', {'timeout': 300000})
    fetcher.cleanup()
"""

from pycore.pyutils.pybrowser.fetchers.base_fetcher import BaseFetcher, FetchResult
from pycore.pyutils.pybrowser.fetchers.http_fetcher import HTTPFetcher
from pycore.pyutils.pybrowser.fetchers.browser_fetcher import BrowserFetcher
from pycore.pyutils.pybrowser.fetchers.iframe_fetcher import IframeFetcher, IframeFetchResult
from pycore.pyutils.pybrowser.fetchers.tampermonkey_fetcher import TampermonkeyFetcher, TampermonkeyFetchResult

__all__ = [
    'BaseFetcher',
    'FetchResult',
    'HTTPFetcher',
    'BrowserFetcher',
    'IframeFetcher',
    'IframeFetchResult',
    'TampermonkeyFetcher',
    'TampermonkeyFetchResult'
]

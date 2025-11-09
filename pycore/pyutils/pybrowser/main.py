#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyBrowser Main Entry Point

Selenium-based browser automation framework inspired by puppeteer_spider_v2
"""

from typing import Dict, Any, Optional
from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyutils.pybrowser.core import SpiderEngine, SessionManager, ResourcePool, EventBus, PluginManager, Session
from pycore.pyutils.pybrowser.interfaces import IBrowser, IPage, IPlugin, IDownloader
from pycore.pyutils.pybrowser.factories import BrowserFactory
from pycore.pyutils.pybrowser.config import ConfigManager
from pycore.pyutils.pybrowser.plugins import ContentPlugin, AutomationPlugin, DownloadPlugin, FormPlugin, ScreenshotPlugin, EnhancedDownloadPlugin
from pycore.pyutils.pybrowser.implementations import ChromeBrowser, EdgeBrowser, FirefoxBrowser, StandardPage, EnhancedPage
from pycore.pyutils.pybrowser.utils import (
    PageUtils, BrowserUtils, CacheManager, BaseUtils,
    DataExtractionUtils, ElementFinderUtils, NavigationUtils, IFrameUtils,
    IframeRecursiveCrawler, ResourceInterceptor, DomResourceMapper, EnhancedResourceCollector,
    ResourceDownloadUtils, ResourceProxyServer,
    BrowserControlUtils, EventUtils, PageOperationUtils,
    TampermonkeyServer,
    Logger, Validator, RetryHandler, PerformanceMonitor
)
from pycore.pyutils.pybrowser.compat import LegacyAdapter, MigrationTool
from pycore.pyutils.pybrowser.fetcher import Fetcher

default_engine = None


def create_spider_engine(config: Dict[str, Any] = None) -> SpiderEngine:
    """
    Create new spider engine instance

    Args:
        config: Engine configuration

    Returns:
        SpiderEngine instance
    """
    return SpiderEngine(config or {})


async def get_default_engine(config: Dict[str, Any] = None) -> SpiderEngine:
    """
    Get or create default spider engine

    Args:
        config: Engine configuration

    Returns:
        SpiderEngine instance
    """
    global default_engine

    if not default_engine:
        default_engine = SpiderEngine(config or {})
        await default_engine.initialize()

    return default_engine


async def create_session(options: Dict[str, Any] = None) -> Session:
    """
    Create browser session (convenience function)

    Args:
        options: Session options

    Returns:
        Session instance
    """
    engine = await get_default_engine()
    return await engine.create_session(options or {})


def get_session(session_id: str) -> Optional[Session]:
    """
    Get session by ID

    Args:
        session_id: Session identifier

    Returns:
        Session instance or None
    """
    if not default_engine:
        raise RuntimeError('No default engine available. Call create_session() first.')

    return default_engine.get_session(session_id)


async def close_session(session_id: str) -> Optional[Session]:
    """
    Close session by ID

    Args:
        session_id: Session identifier

    Returns:
        Closed session or None
    """
    if not default_engine:
        raise RuntimeError('No default engine available.')

    return await default_engine.close_session(session_id)


async def shutdown():
    """Shutdown default engine"""
    global default_engine

    if default_engine:
        await default_engine.shutdown()
        default_engine = None


__all__ = [
    'SpiderEngine',
    'SessionManager',
    'Session',
    'ResourcePool',
    'EventBus',
    'PluginManager',
    'IBrowser',
    'IPage',
    'IPlugin',
    'IDownloader',
    'BrowserFactory',
    'ConfigManager',
    'ContentPlugin',
    'AutomationPlugin',
    'DownloadPlugin',
    'EnhancedDownloadPlugin',
    'FormPlugin',
    'ScreenshotPlugin',
    'ChromeBrowser',
    'EdgeBrowser',
    'FirefoxBrowser',
    'StandardPage',
    'EnhancedPage',
    'PageUtils',
    'BrowserUtils',
    'CacheManager',
    'BaseUtils',
    'DataExtractionUtils',
    'ElementFinderUtils',
    'NavigationUtils',
    'IFrameUtils',
    'IframeRecursiveCrawler',
    'ResourceInterceptor',
    'DomResourceMapper',
    'EnhancedResourceCollector',
    'ResourceDownloadUtils',
    'ResourceProxyServer',
    'BrowserControlUtils',
    'EventUtils',
    'PageOperationUtils',
    'TampermonkeyServer',
    'Logger',
    'Validator',
    'RetryHandler',
    'PerformanceMonitor',
    'LegacyAdapter',
    'MigrationTool',
    'Fetcher',
    'create_spider_engine',
    'get_default_engine',
    'create_session',
    'get_session',
    'close_session',
    'shutdown',
]

__version__ = '1.0.0'
__name__ = 'pybrowser'

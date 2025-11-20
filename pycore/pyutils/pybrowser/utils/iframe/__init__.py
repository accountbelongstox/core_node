#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IFrame Utils Package

Exports iframe-related utility classes
"""

from pycore.pyutils.pybrowser.utils.iframe.iframe_utils import IFrameUtils
from pycore.pyutils.pybrowser.utils.iframe.iframe_recursive_crawler import IframeRecursiveCrawler

__all__ = [
    'IFrameUtils',
    'IframeRecursiveCrawler'
]

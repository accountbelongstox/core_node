#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interfaces Package

Exports all interface classes
"""

from pycore.pyutils.pybrowser.interfaces.ibrowser import IBrowser
from pycore.pyutils.pybrowser.interfaces.ipage import IPage
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin
from pycore.pyutils.pybrowser.interfaces.idownloader import IDownloader

__all__ = ['IBrowser', 'IPage', 'IPlugin', 'IDownloader']

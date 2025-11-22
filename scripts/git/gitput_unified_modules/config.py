#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration and constants for gitput_unified
"""

from pathlib import Path
from typing import Dict

# Project configuration
PROJECT_NAME = "core_node"

# Remote configurations
REMOTE_CONFIGS: Dict[str, str] = {
    "gitee": f"git@gitee.com:accountbelongstox/{PROJECT_NAME}.git",
    "github": f"git@github.com:accountbelongstox/{PROJECT_NAME}.git",
    "local": "git@192.168.50.2:adminroot/core_node.git",
}

# Required files in win_common directory
REQUIRED_WIN_COMMON_FILES = [
    "ApplicationsList.ps1",
    "CommonFunc.ps1",
    "DesktopIconManager.ps1",
    "GlobalVars.ps1",
    "IconExtractor.ps1",
    "PackageManagerInvokes.ps1",
    "PostInstallCallbackProcessor.ps1",
    "SimpleIconExtractor.ps1",
    "StartupManager.ps1",
    "WindowsPathFunction.ps1",
    "WindowsServiceManager.ps1",
    "CommonFunc.7z.gz.js",
    "applicationsXml/ApplicationsList.xml",
]

# Default branch
DEFAULT_BRANCH = "main"


#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration and constants for gitput_unified
"""

from pathlib import Path
from typing import Dict

# Project configuration
PROJECT_NAME = "core_node"

def load_remote_configs() -> Dict[str, str]:
    """Load remote configurations from git_remotes.conf"""
    config_file = Path(__file__).parent.parent / "git_remotes.conf"
    remote_configs = {}
    
    if not config_file.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_file}")
    
    with open(config_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                remote_configs[key.strip()] = value.strip()
    
    return remote_configs

# Remote configurations
REMOTE_CONFIGS: Dict[str, str] = load_remote_configs()

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
]

# Default branch
DEFAULT_BRANCH = "main"

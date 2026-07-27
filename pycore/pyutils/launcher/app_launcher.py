# -*- coding: utf-8 -*-
"""Canonical app launcher namespace (V10 bridge)."""

from pycore.pyfoundations.app_launcher import *  # noqa: F401,F403
from pycore.pyfoundations.app_launcher import AppLauncher, main, register_executable_launcher_provider

__all__ = [
    "AppLauncher",
    "register_executable_launcher_provider",
    "main",
]

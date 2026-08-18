# -*- coding: utf-8 -*-
"""Register pylauncher providers into pyfoundations (import once at startup)."""

from pycore.pylauncher.launcher import ServiceLauncher
from pycore.pylauncher.app_executable_launcher import get_app_executable_launcher
from pycore.pyfoundations.app_launcher import register_executable_launcher_provider
from pycore.pyfoundations.service_launcher_provider import register_service_launcher_provider

register_executable_launcher_provider(get_app_executable_launcher)
register_service_launcher_provider(ServiceLauncher)

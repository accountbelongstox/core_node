# -*- coding: utf-8 -*-
"""Bind pylauncher providers into pyfoundations.launch_providers (import once at startup)."""

from pycore.pyfoundations.launch_providers import SERVICE_LAUNCHER_PROVIDER, launch_providers
from pycore.pylauncher.launcher import ServiceLauncher

launch_providers.register(SERVICE_LAUNCHER_PROVIDER, ServiceLauncher)

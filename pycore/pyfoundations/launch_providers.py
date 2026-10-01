#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Keyed provider registry for higher-layer launch components.

pylauncher owns ServiceLauncher; lower layers (pyutils.native_ui) obtain it here
by key instead of importing up. pylauncher.register_providers binds every
provider once at process startup.
"""

from typing import Any, Dict

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


SERVICE_LAUNCHER_PROVIDER = "service_launcher"


class LaunchProviders:
    """Own the key -> provider map on one THREAD_BUS state thread."""

    def __init__(self) -> None:
        self._providers: Dict[str, Any] = {}
        init_serialized_owner(self, "pyfoundations.launch_providers", "LaunchProvidersState")

    @serialized_method
    def register(self, key: str, provider: Any) -> None:
        self._providers[key] = provider

    @serialized_method
    def resolve(self, key: str) -> Any:
        provider = self._providers.get(key)
        if provider is None:
            raise RuntimeError(
                f"Launch provider '{key}' is not registered; import "
                "pycore.pylauncher.register_providers at process startup."
            )
        return provider


launch_providers = LaunchProviders()

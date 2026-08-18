#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service-launcher provider seam (pyfoundations leaf).

pylauncher (a higher layer) owns the ServiceLauncher class. pyutils.native_ui
needs it to start the rpc_v2 / tray services, but pyutils MUST NOT import UP into
pylauncher — that back-edge is what forms the native_ui <-> pylauncher circular
import (pylauncher -> pythreadpool -> native_ui.step6_tray -> native_ui ->
step3_launcher.service_starters -> pylauncher).

This tiny seam inverts the dependency exactly like
``pyfoundations.app_launcher.register_executable_launcher_provider``: pylauncher
registers its ServiceLauncher class DOWN here at its import time, and native_ui
pulls it via ``get_service_launcher()`` with a plain top-level import — so the
lazy in-function ``from pycore.pylauncher import ServiceLauncher`` workarounds
can move to the file top per PYTHON_PYCORE.md §1.4.

Uses only pyfoundations infrastructure and stdlib.
"""

from pycore.pyfoundations.serialized_worker import SerializedValue


_SERVICE_LAUNCHER_PROVIDER = SerializedValue(None, "ServiceLauncherHookState")


def register_service_launcher_provider(provider) -> None:
    """Register the ServiceLauncher class/factory.

    Called by ``pycore.pylauncher`` at its import time so lower layers never
    import pylauncher directly (preserves the one-directional layer dependency).
    """
    _SERVICE_LAUNCHER_PROVIDER.set(provider)


def get_service_launcher():
    """Return the registered ServiceLauncher class/factory.

    Raises ``RuntimeError`` with a clear message when pylauncher never registered
    one (e.g. native_ui driven without importing pylauncher first) — the seam
    cannot self-heal, since pyfoundations may not import UP into pylauncher.
    """
    provider = _SERVICE_LAUNCHER_PROVIDER.get()
    if provider is None:
        raise RuntimeError(
            "ServiceLauncher provider not registered — import pycore.pylauncher "
            "before starting native_ui services (pylauncher registers the "
            "provider at its import time)."
        )
    return provider

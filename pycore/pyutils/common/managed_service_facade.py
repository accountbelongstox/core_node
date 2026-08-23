# -*- coding: utf-8 -*-

import contextlib
from typing import Any, Dict, Iterable, Optional

from pycore.pyutils.common.managed_service import (
    CategorySettings,
    ServiceSpec,
    managed_services,
)
import pycore.pyutils.common.model_load_status as model_load_status


class ManagedServiceFacade:
    def __init__(
        self,
        category: str,
        settings_prefix: str,
        *,
        section: Optional[str] = None,
        idle_default: int = 180,
    ) -> None:
        self.category = category
        self.settings_prefix = settings_prefix
        managed_services.register_category(
            category,
            CategorySettings(
                section or category,
                settings_prefix,
                idle_default=idle_default,
            ),
        )

    def register(self, spec: ServiceSpec) -> None:
        if spec.category != self.category:
            raise ValueError(
                f"service {spec.name} belongs to {spec.category}, expected {self.category}"
            )
        managed_services.register(spec)

    def spec(self, name: str) -> Optional[ServiceSpec]:
        spec = managed_services.spec(name)
        if spec is None or spec.category != self.category:
            return None
        return spec

    def contains(self, name: str) -> bool:
        return self.spec(name) is not None

    def is_running(self, name: str) -> bool:
        return self.contains(name) and managed_services.is_running(name)

    def start(self, name: str) -> Dict[str, Any]:
        spec = self.spec(name)
        if spec is None:
            return {
                "success": False,
                "engine": name,
                "error": f"not a managed {self.category} service: {name}",
            }
        if spec.kind == "model":
            managed_services.record_use(name)
            return {
                "success": True,
                "engine": name,
                "running": managed_services.is_running(name),
                "managed": False,
                "note": "model loads on use",
            }
        if spec.external:
            return {
                "success": False,
                "engine": name,
                "running": managed_services.is_running(name),
                "error": f"{name} is an external service and must be started externally",
            }
        if not spec.installed():
            return {
                "success": False,
                "engine": name,
                "error": f"{name} not installed",
            }
        if spec.ready_without_process is not None and spec.ready_without_process():
            managed_services.record_use(name)
            return {
                "success": True,
                "engine": name,
                "running": True,
                "managed": False,
                "note": "no managed process required",
            }
        started = managed_services.ensure_running(name, force=True)
        return {
            "success": started,
            "engine": name,
            "running": managed_services.is_running(name),
            "managed": started,
            "error": None if started else f"{name} failed to start",
        }

    def stop(self, name: str) -> Dict[str, Any]:
        if not self.contains(name):
            return {
                "success": False,
                "engine": name,
                "error": f"not a managed {self.category} service: {name}",
            }
        result = managed_services.stop(name)
        return {
            "success": bool(result.get("success", False)),
            "engine": name,
            "running": managed_services.is_running(name),
            "error": result.get("error"),
        }

    def set_enabled(
        self,
        name: str,
        enabled: bool,
        *,
        start_now: bool = False,
    ) -> Dict[str, Any]:
        if not self.contains(name):
            return {
                "success": False,
                "engine": name,
                "error": f"not a managed {self.category} service: {name}",
            }
        result = self.apply_settings({
            f"{self.settings_prefix}enabled": {name: bool(enabled)},
        })
        if not enabled:
            stopped = self.stop(name)
            return {
                **result,
                "engine": name,
                "enabled": False,
                "running": stopped.get("running", False),
                "stop_error": stopped.get("error"),
            }
        if start_now:
            return {**result, **self.start(name), "enabled": True}
        return {
            **result,
            "engine": name,
            "enabled": True,
            "running": managed_services.is_running(name),
        }

    def settings(self, *, refresh: bool = True) -> Dict[str, Any]:
        if refresh:
            return managed_services.get_settings(self.category)
        return managed_services.peek_settings(self.category)

    def apply_settings(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        return managed_services.apply_settings(self.category, patch)

    def runtime_status(self, name: str, *, refresh: bool = True) -> Dict[str, Any]:
        spec = self.spec(name)
        if spec is None:
            return {}
        state = (
            managed_services.runtime_status(name)
            if refresh
            else managed_services.peek_runtime_status(name)
        )
        if spec.kind == "server":
            return {
                "server_engine": True,
                "server_running": state.get("running", False),
                "server_managed": state.get("managed", False),
                "server_enabled": state.get("enabled", True),
                "server_idle_remaining_s": state.get("idle_remaining_s"),
                "server_url": state.get("ready_url"),
                "server_external": spec.external,
            }
        return {
            "server_engine": False,
            "model_loaded": state.get("running", False),
            "model_idle_remaining_s": state.get("idle_remaining_s"),
        }

    def all_runtime_status(
        self,
        names: Iterable[str],
        *,
        refresh: bool = True,
    ) -> Dict[str, Dict[str, Any]]:
        return {
            name: self.runtime_status(name, refresh=refresh)
            for name in names
        }


def managed_model_load_context(name: str, device: Optional[str] = None):
    spec = managed_services.spec(name)
    if spec is None or spec.kind != "model":
        return contextlib.nullcontext()
    return model_load_status.report_model_load(
        name,
        is_loaded=lambda: managed_services.is_running(name),
        device=device or "",
    )


__all__ = ["ManagedServiceFacade", "managed_model_load_context"]

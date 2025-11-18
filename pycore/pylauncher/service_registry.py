#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Registry for Launcher

Centralized registry for all launchable services with shutdown priority.
Works with GlobalThreadPool from pyheartbeat.

Design:
- pyheartbeat: Always running (default enabled), provides thread pool
- Other services: Register to thread pool, configurable启动
- Shutdown: Priority-based (lower priority shuts down first)
"""

from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum


class ShutdownPriority(Enum):
    """Shutdown priority levels (lower number = shutdown first)"""
    NETWORK_SERVICES = 50      # RPC, HTTP servers
    PROCESSING_SERVICES = 60    # Speech, File processing
    CORE_SERVICES = 100         # Heartbeat (shutdown last)


@dataclass
class ServiceDefinition:
    """Service definition in registry"""
    name: str                    # Service identifier
    module: str                  # Module path to import
    class_name: str              # Class name to instantiate
    config_key: str              # ServiceConfig field name (e.g., enable_rpc_v2)
    default_enabled: bool        # Whether enabled by default
    shutdown_priority: int       # Shutdown order (lower = earlier)
    init_params: Optional[Dict[str, str]] = None  # Param mapping from ServiceConfig
    requires_heartbeat: bool = True  # Whether requires heartbeat to be running


# Service Registry
# Add new services here to make them available in launcher
SERVICE_REGISTRY: Dict[str, ServiceDefinition] = {
    # Heartbeat (Core Service - always enabled, shutdown last)
    "heartbeat": ServiceDefinition(
        name="heartbeat",
        module="pycore.pyheartbeat",
        class_name="HeartbeatSystem",
        config_key="enable_heartbeat",
        default_enabled=True,  # Always starts
        shutdown_priority=ShutdownPriority.CORE_SERVICES.value,
        requires_heartbeat=False  # Is the heartbeat itself
    ),

    # RPC v2 (Network Service)
    "rpc_v2": ServiceDefinition(
        name="rpc_v2",
        module="pycore.pyutils.rpc_v2.server.unified_server",
        class_name="UnifiedRPCServer",
        config_key="enable_rpc_v2",
        default_enabled=False,  # Needs config
        shutdown_priority=ShutdownPriority.NETWORK_SERVICES.value,
        init_params={
            "port": "rpc_v2_port",
            "host": "rpc_v2_host"
        }
    ),

    # RPC v1 (Network Service - legacy)
    "rpc": ServiceDefinition(
        name="rpc",
        module="pycore.pyutils.rpc.server",
        class_name="RPCServer",
        config_key="enable_rpc",
        default_enabled=False,
        shutdown_priority=ShutdownPriority.NETWORK_SERVICES.value,
        init_params={
            "port": "rpc_port",
            "host": "rpc_host"
        }
    ),

    # Speech (Processing Service)
    "speech": ServiceDefinition(
        name="speech",
        module="pycore.pyutils.speech",
        class_name="SpeechThread",
        config_key="enable_speech",
        default_enabled=False,
        shutdown_priority=ShutdownPriority.PROCESSING_SERVICES.value,
        init_params={
            "mode": "speech_mode",
            "mic_language": "mic_language",
            "system_language": "system_language"
        }
    ),
}


def get_service_definition(service_name: str) -> Optional[ServiceDefinition]:
    """Get service definition from registry"""
    return SERVICE_REGISTRY.get(service_name)


def get_all_services() -> Dict[str, ServiceDefinition]:
    """Get all registered services"""
    return SERVICE_REGISTRY.copy()


def get_services_by_priority() -> list[tuple[str, ServiceDefinition]]:
    """
    Get services sorted by shutdown priority (ascending)

    Returns services in shutdown order (lowest priority first)
    """
    items = list(SERVICE_REGISTRY.items())
    return sorted(items, key=lambda x: x[1].shutdown_priority)


def register_custom_service(service_def: ServiceDefinition) -> bool:
    """
    Register custom service at runtime

    Args:
        service_def: Service definition

    Returns:
        True if registered successfully
    """
    if service_def.name in SERVICE_REGISTRY:
        return False

    SERVICE_REGISTRY[service_def.name] = service_def
    return True

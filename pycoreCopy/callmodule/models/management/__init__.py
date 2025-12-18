# -*- coding: utf-8 -*-
"""
Management Models Package
"""

from .system_models import (
    SystemStatus,
    SystemConfig,
    ControlResponse,
    DashboardOverview,
    RealtimeMetrics,
    ServiceInfo,
    HardwareInfo,
    DiskUsage,
    ResourceUsage,
)

from .local_processing_models import (
    LocalCapabilities,
    LocalProcessingConfig,
    LocalProcessingStats,
    TestRequest,
    TestResponse,
    HardwareCapabilities,
    ProcessingCapability,
)

from .logs_models import (
    LogEntry,
    LogsQuery,
    LogsResponse,
)

__all__ = [
    # System models
    "SystemStatus",
    "SystemConfig",
    "ControlResponse",
    "DashboardOverview",
    "RealtimeMetrics",
    "ServiceInfo",
    "HardwareInfo",
    "DiskUsage",
    "ResourceUsage",

    # Local processing models
    "LocalCapabilities",
    "LocalProcessingConfig",
    "LocalProcessingStats",
    "TestRequest",
    "TestResponse",
    "HardwareCapabilities",
    "ProcessingCapability",

    # Log models
    "LogEntry",
    "LogsQuery",
    "LogsResponse",
]

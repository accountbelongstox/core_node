# -*- coding: utf-8 -*-
"""THREAD_BUS-owned dependency context for MCP backend handlers."""

import copy
from typing import Any, Dict, Tuple

from pycore.pyfoundations.serialized_worker import SerializedValue


_HANDLER_CONTEXT = SerializedValue(
    {
        "backend_info": {},
        "file_controller": None,
        "database_controller": None,
        "codebase_controller": None,
    },
    "MCPHandlerContextStateThread",
)


def set_handler_context(
    backend_info: Dict[str, Any],
    file_controller: Any,
    database_controller: Any,
    codebase_controller: Any,
) -> None:
    """Publish one immutable dependency snapshot for all request handlers."""
    _HANDLER_CONTEXT.set({
        "backend_info": copy.deepcopy(backend_info),
        "file_controller": file_controller,
        "database_controller": database_controller,
        "codebase_controller": codebase_controller,
    })


def get_backend_info() -> Dict[str, Any]:
    """Return a detached backend metadata snapshot."""
    return copy.deepcopy(_HANDLER_CONTEXT.get()["backend_info"])


def get_file_context() -> Tuple[Dict[str, Any], Any]:
    """Return file-handler metadata and its controller."""
    context = _HANDLER_CONTEXT.get()
    return copy.deepcopy(context["backend_info"]), context["file_controller"]


def get_database_context() -> Tuple[Dict[str, Any], Any]:
    """Return database-handler metadata and its controller."""
    context = _HANDLER_CONTEXT.get()
    return copy.deepcopy(context["backend_info"]), context["database_controller"]


def get_codebase_context() -> Tuple[Dict[str, Any], Any]:
    """Return codebase-handler metadata and its controller."""
    context = _HANDLER_CONTEXT.get()
    return copy.deepcopy(context["backend_info"]), context["codebase_controller"]


__all__ = [
    "get_backend_info",
    "get_codebase_context",
    "get_database_context",
    "get_file_context",
    "set_handler_context",
]

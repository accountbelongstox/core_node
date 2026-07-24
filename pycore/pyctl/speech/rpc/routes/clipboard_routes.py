#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Routes

RPC routes for clipboard history management.
"""

import time
from typing import Dict, Any

from pycore.pyfoundations import ColorPrint
from pycore.database import get_database_manager

from pycore.database.models import TableKeys

from pycore.database.models.util_clipboard.clipboard_history_model import ClipboardHistoryModel




def register_clipboard_routes(rpc_server, service_instances: Dict[str, Any] = None):
    """
    Register clipboard-related RPC routes

    Args:
        rpc_server: RPC server instance
        service_instances: Dict with service instances (optional, for consistency)
    """
    ColorPrint.blue("[ClipboardRoutes] Registering clipboard routes...")

    # Auto-initialize clipboard database if not registered

    db_manager = get_database_manager()

    if not db_manager.is_database_registered('clipboard'):
        ColorPrint.blue("[ClipboardRoutes] Initializing clipboard database...")
        db_manager.register_database(database_name='clipboard')
        db_manager.load_tables(
            table_keys=[TableKeys.CLIPBOARD_HISTORY],
            models=[ClipboardHistoryModel],
            database_name='clipboard'
        )
        ColorPrint.green("[ClipboardRoutes] ✓ Clipboard database initialized")

    def handle_clipboard_get(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get clipboard history

        Args:
            params: {
                "limit": int - Maximum items to return (default: 50)
                "client_id": str - Filter by client ID (optional)
                "content_type": str - Filter by content type (optional)
            }

        Returns:
            {
                "success": bool,
                "items": list[dict],
                "error": str (if failed)
            }
        """
        try:
            limit = params.get('limit', 50)
            client_id = params.get('client_id')
            content_type = params.get('content_type')

            # Import model here to avoid circular imports

            db_manager = get_database_manager()

            # Check if clipboard database is registered
            if not db_manager.is_database_registered('clipboard'):
                ColorPrint.yellow("[ClipboardRoutes] Clipboard database not registered, returning empty list")
                return {
                    'success': True,
                    'items': [],
                    'info': 'Clipboard database not initialized'
                }

            with db_manager.get_connection("clipboard") as conn:
                items = ClipboardHistoryModel.get_recent_items(
                    conn,
                    limit=limit,
                    client_id=client_id,
                    content_type=content_type
                )

            # Convert to JSON-serializable format
            items_list = [_sanitize_clipboard_item(item) for item in items]

            return {
                'success': True,
                'items': items_list
            }

        except Exception as e:
            ColorPrint.red(f"[ClipboardRoutes] Error in clipboard_get: {e}")
            return {
                'success': False,
                'error': str(e),
                'items': []
            }

    def handle_clipboard_sync(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Sync clipboard (get updates since timestamp)

        Args:
            params: {
                "since": float - Unix timestamp
                "client_id": str - Client identifier (optional)
            }

        Returns:
            {
                "success": bool,
                "items": list[dict],
                "server_time": float,
                "error": str (if failed)
            }
        """
        try:
            since = params.get('since', 0.0)
            client_id = params.get('client_id')

            # Import model here to avoid circular imports

            db_manager = get_database_manager()

            # Check if clipboard database is registered
            if not db_manager.is_database_registered('clipboard'):
                ColorPrint.yellow("[ClipboardRoutes] Clipboard database not registered, returning empty sync")
                return {
                    'success': True,
                    'items': [],
                    'server_time': time.time(),
                    'info': 'Clipboard database not initialized'
                }

            with db_manager.get_connection("clipboard") as conn:
                items = ClipboardHistoryModel.get_items_since(
                    conn,
                    timestamp=since,
                    client_id=client_id
                )

            # Convert to JSON-serializable format
            items_list = [_sanitize_clipboard_item(item) for item in items]

            return {
                'success': True,
                'items': items_list,
                'server_time': time.time()
            }

        except Exception as e:
            ColorPrint.red(f"[ClipboardRoutes] Error in clipboard_sync: {e}")
            return {
                'success': False,
                'error': str(e),
                'items': [],
                'server_time': time.time()
            }

    # Register routes
    rpc_server.route('clipboard_get', handle_clipboard_get)
    rpc_server.route('clipboard_sync', handle_clipboard_sync)

    ColorPrint.green("[ClipboardRoutes] Registered:")
    ColorPrint.blue("  - clipboard_get")
    ColorPrint.blue("  - clipboard_sync")


def _sanitize_clipboard_item(item: Any) -> Dict[str, Any]:
    """
    Sanitize clipboard item for JSON serialization

    Args:
        item: Clipboard history item (could be dict, object, or row)

    Returns:
        JSON-serializable dict
    """
    # If already a dict, return as-is
    if isinstance(item, dict):
        return item

    # If it's a SQLAlchemy model or dataclass
    if hasattr(item, '__dict__'):
        result = {}
        for key, value in item.__dict__.items():
            if key.startswith('_'):
                continue
            # Handle datetime objects
            if hasattr(value, 'isoformat'):
                result[key] = value.isoformat()
            # Handle other special types
            elif isinstance(value, (str, int, float, bool, type(None))):
                result[key] = value
            else:
                result[key] = str(value)
        return result

    # Fallback: convert to string
    return {'data': str(item)}


__all__ = [
    'register_clipboard_routes'
]

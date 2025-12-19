#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Common Utilities

Common utilities shared by HTTP and WebSocket RPC implementations.
"""

from pycore.pyutils.rpc.common.task_table import (
    TaskTable,
    Task,
    RequestStatus,
    default_task_table,
    # Backward compatibility
    RequestEventTable,
    RequestEvent,
    default_request_event_table
)
from pycore.pyutils.rpc.common.inventory_table import (
    InventoryTable,
    InventoryItem,
    default_inventory_table
)

__all__ = [
    # New async task API
    'TaskTable',
    'Task',
    'RequestStatus',
    'default_task_table',
    # Backward compatibility
    'RequestEventTable',
    'RequestEvent',
    'default_request_event_table',
    # Inventory
    'InventoryTable',
    'InventoryItem',
    'default_inventory_table',
]


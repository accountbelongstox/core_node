#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Queue Management RPC Routes

Task queue management and monitoring endpoints.

Endpoints:
- queue_stats: Get queue statistics
- task_status: Get status of specific task
"""

from typing import Dict, Any

from pycore.pyfoundations import ColorPrint, get_global_task_queue


def register_queue_routes(rpc_server, service_instances: Dict[str, Any]):
    """
    Register queue management routes on RPC server

    Args:
        rpc_server: UnifiedRpcServerRunner instance (HTTP + WebSocket + CORS)
        service_instances: Dict with service instances
    """

    def handle_queue_stats(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get queue statistics from PyHeartbeat

        Returns:
            {
                "success": true,
                "queue_size": int,  # Top-level queue size for easy access
                "stats": {
                    "task_queue": {...},
                    "heartbeat_pusher": {...},
                    "thread_pool": {...}
                }
            }
        """
        from pycore.pyheartbeat import get_heartbeat_system

        heartbeat_system = get_heartbeat_system()

        if not heartbeat_system:
            return {
                'success': False,
                'error': 'Heartbeat system not initialized',
                'queue_size': 0
            }

        stats = heartbeat_system.get_stats()

        # Extract queue size from stats for convenience
        queue_size = 0
        if stats and 'task_queue' in stats and 'queue_size' in stats['task_queue']:
            queue_size = stats['task_queue']['queue_size']

        return {
            'success': True,
            'queue_size': queue_size,  # Top-level for easy access
            'stats': stats  # Full stats for detailed analysis
        }

    def handle_task_status(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get task status by task_id

        Request Parameters:
            task_id (str, required): Task ID to query

        Returns:
            {
                "success": true,
                "data": {
                    "task_id": "...",
                    "type": "tts",
                    "status": "completed",
                    "priority": "normal",
                    "created_at": "...",
                    "started_at": "...",
                    "completed_at": "...",
                    "duration": 1.5,
                    "error": null,
                    "result": {...}
                }
            }
        """
        task_id = params.get('task_id')

        if not task_id:
            return {'success': False, 'error': 'task_id is required'}

        # Get task queue
        task_queue = get_global_task_queue()

        if not task_queue:
            return {'success': False, 'error': 'Task queue not available'}

        # Search for task in queue
        # Note: This searches in the priority queue
        task = None

        # Try to find task in queue (this is a simplified approach)
        # In production, you'd want to track tasks in a separate registry
        try:
            # Access internal queue structure
            for item in list(task_queue._queue):
                # Queue items are (priority, task) tuples
                if isinstance(item, tuple) and len(item) >= 2:
                    potential_task = item[1]
                    if hasattr(potential_task, 'task_id') and potential_task.task_id == task_id:
                        task = potential_task
                        break
                elif hasattr(item, 'task_id') and item.task_id == task_id:
                    task = item
                    break
        except Exception as e:
            ColorPrint.yellow(f"[Queue] Error searching for task: {e}")

        if not task:
            return {
                'success': False,
                'error': f'Task {task_id} not found in queue'
            }

        # Build task status response
        return {
            'success': True,
            'data': {
                'task_id': task.task_id,
                'type': task.task_type,
                'status': task.state.value,
                'priority': task.priority.value,
                'created_at': str(task.created_at) if hasattr(task, 'created_at') else None,
                'started_at': str(task.started_at) if hasattr(task, 'started_at') else None,
                'completed_at': str(task.completed_at) if hasattr(task, 'completed_at') else None,
                'duration': task.get_duration() if hasattr(task, 'get_duration') else None,
                'error': task.error if hasattr(task, 'error') else None,
                'result': task.metadata.get('result') if hasattr(task, 'metadata') else None
            }
        }

    # Register routes
    rpc_server.route('queue_stats', handle_queue_stats)
    rpc_server.route('task_status', handle_task_status)

    ColorPrint.green("[Queue Routes] Registered:")
    ColorPrint.blue("  - queue_stats")
    ColorPrint.blue("  - task_status")


__all__ = ['register_queue_routes']

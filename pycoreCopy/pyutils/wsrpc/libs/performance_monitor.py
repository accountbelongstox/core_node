# -*- coding: utf-8 -*-
"""
Performance Monitor
Tracks performance metrics for WebSocket RPC requests
"""

import time
import threading
from typing import Dict, List, Optional
from collections import deque
from pycore.pyfoundations.color_print import ColorPrint


class PerformanceMonitor:
    """Monitors and tracks performance metrics"""

    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize performance monitor

        Args:
            options: Configuration options
        """
        options = options or {}
        self.enabled = options.get('enabled', True)
        self.sample_rate = options.get('sample_rate', 1.0)
        self.max_history_size = options.get('max_history_size', 1000)

        self.requests: Dict[str, Dict] = {}
        self.routes: Dict[str, Dict] = {}
        self.clients: Dict[str, Dict] = {}
        self.history: deque = deque(maxlen=self.max_history_size)
        self.start_time = time.time()
        self._lock = threading.Lock()

    def start_request(self, request_id: str, route_name: str, client_id: str):
        """
        Start tracking a request

        Args:
            request_id: Unique request identifier
            route_name: Name of the route
            client_id: Client identifier
        """
        if not self.enabled or not self._should_sample():
            return

        with self._lock:
            self.requests[request_id] = {
                'route_name': route_name,
                'client_id': client_id,
                'start_time': time.time()
            }

    def end_request(self, request_id: str, success: bool = True, error: Optional[Exception] = None):
        """
        End tracking a request

        Args:
            request_id: Unique request identifier
            success: Whether request was successful
            error: Exception if failed
        """
        if not self.enabled:
            return

        with self._lock:
            request_data = self.requests.get(request_id)
            if not request_data:
                return

            end_time = time.time()
            duration = (end_time - request_data['start_time']) * 1000  # Convert to ms

            record = {
                'request_id': request_id,
                'route_name': request_data['route_name'],
                'client_id': request_data['client_id'],
                'duration': duration,
                'success': success,
                'error': str(error) if error else None,
                'timestamp': end_time
            }

            self._record_route(request_data['route_name'], duration, success)
            self._record_client(request_data['client_id'], duration, success)
            self._add_to_history(record)

            del self.requests[request_id]

    def get_route_stats(self, route_name: str) -> Dict:
        """
        Get statistics for a route

        Args:
            route_name: Name of the route

        Returns:
            Dictionary with route statistics
        """
        with self._lock:
            return self.routes.get(route_name, {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'total_duration': 0,
                'avg_duration': 0,
                'min_duration': 0,
                'max_duration': 0
            })

    def get_client_stats(self, client_id: str) -> Dict:
        """
        Get statistics for a client

        Args:
            client_id: Client identifier

        Returns:
            Dictionary with client statistics
        """
        with self._lock:
            return self.clients.get(client_id, {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'total_duration': 0,
                'avg_duration': 0
            })

    def get_global_stats(self) -> Dict:
        """
        Get global statistics

        Returns:
            Dictionary with global statistics
        """
        with self._lock:
            total_requests = 0
            successful_requests = 0
            failed_requests = 0
            total_duration = 0

            for stats in self.routes.values():
                total_requests += stats['total_requests']
                successful_requests += stats['successful_requests']
                failed_requests += stats['failed_requests']
                total_duration += stats['total_duration']

            uptime = time.time() - self.start_time
            requests_per_second = total_requests / uptime if uptime > 0 else 0

            return {
                'uptime': uptime,
                'total_requests': total_requests,
                'successful_requests': successful_requests,
                'failed_requests': failed_requests,
                'success_rate': (successful_requests / total_requests * 100) if total_requests > 0 else 0,
                'avg_duration': total_duration / total_requests if total_requests > 0 else 0,
                'requests_per_second': requests_per_second,
                'active_requests': len(self.requests),
                'unique_clients': len(self.clients),
                'unique_routes': len(self.routes)
            }

    def get_history(self, limit: int = 100) -> List[Dict]:
        """
        Get request history

        Args:
            limit: Maximum number of records to return

        Returns:
            List of historical records
        """
        with self._lock:
            history_list = list(self.history)
            return history_list[-limit:]

    def get_slowest_requests(self, limit: int = 10) -> List[Dict]:
        """
        Get slowest requests

        Args:
            limit: Maximum number of records to return

        Returns:
            List of slowest requests
        """
        with self._lock:
            history_list = list(self.history)
            sorted_history = sorted(history_list, key=lambda x: x['duration'], reverse=True)
            return sorted_history[:limit]

    def get_recent_failures(self, limit: int = 10) -> List[Dict]:
        """
        Get recent failures

        Args:
            limit: Maximum number of records to return

        Returns:
            List of recent failures
        """
        with self._lock:
            failures = [r for r in self.history if not r['success']]
            return list(failures)[-limit:]

    def reset(self):
        """Reset all statistics"""
        with self._lock:
            self.requests.clear()
            self.routes.clear()
            self.clients.clear()
            self.history.clear()
            self.start_time = time.time()
            ColorPrint.debug("Performance monitor reset")

    def _should_sample(self) -> bool:
        """Determine if request should be sampled"""
        import random
        return random.random() <= self.sample_rate

    def _record_route(self, route_name: str, duration: float, success: bool):
        """Record route statistics"""
        stats = self.routes.get(route_name)

        if not stats:
            stats = {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'total_duration': 0,
                'avg_duration': 0,
                'min_duration': float('inf'),
                'max_duration': 0
            }
            self.routes[route_name] = stats

        stats['total_requests'] += 1
        if success:
            stats['successful_requests'] += 1
        else:
            stats['failed_requests'] += 1

        stats['total_duration'] += duration
        stats['avg_duration'] = stats['total_duration'] / stats['total_requests']
        stats['min_duration'] = min(stats['min_duration'], duration)
        stats['max_duration'] = max(stats['max_duration'], duration)

    def _record_client(self, client_id: str, duration: float, success: bool):
        """Record client statistics"""
        stats = self.clients.get(client_id)

        if not stats:
            stats = {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'total_duration': 0,
                'avg_duration': 0
            }
            self.clients[client_id] = stats

        stats['total_requests'] += 1
        if success:
            stats['successful_requests'] += 1
        else:
            stats['failed_requests'] += 1

        stats['total_duration'] += duration
        stats['avg_duration'] = stats['total_duration'] / stats['total_requests']

    def _add_to_history(self, record: Dict):
        """Add record to history"""
        self.history.append(record)

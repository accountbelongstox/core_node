# -*- coding: utf-8 -*-
"""
Rate Limiter
Provides rate limiting functionality to prevent request flooding
"""

import time
import threading
from typing import Dict, Optional, Callable
from pycore.pyfoundations.color_print import ColorPrint


class RateLimiter:
    """Rate limiter for WebSocket connections"""

    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize rate limiter

        Args:
            options: Configuration options
        """
        options = options or {}
        self.enabled = options.get('enabled', True)
        self.max_requests = options.get('max_requests') or 100
        self.window_ms = options.get('window_ms') or 60000  # 1 minute
        self.skip_successful_requests = options.get('skip_successful_requests', False)
        self.skip_failed_requests = options.get('skip_failed_requests', False)
        self.on_limit_reached: Optional[Callable] = options.get('on_limit_reached')

        self.clients: Dict[str, Dict] = {}
        self._lock = threading.Lock()

        # Start cleanup timer
        self._cleanup_timer = threading.Timer(self.window_ms / 1000, self._cleanup)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()

    def check(self, client_id: str) -> Dict:
        """
        Check if client is within rate limit

        Args:
            client_id: Unique client identifier

        Returns:
            Dictionary with allowed status and remaining count
        """
        if not self.enabled:
            return {'allowed': True, 'remaining': self.max_requests}

        with self._lock:
            now = time.time() * 1000  # Convert to ms
            client_data = self.clients.get(client_id)

            if not client_data:
                client_data = {
                    'count': 0,
                    'reset_time': now + self.window_ms,
                    'blocked': False
                }
                self.clients[client_id] = client_data

            # Reset if window expired
            if now >= client_data['reset_time']:
                client_data['count'] = 0
                client_data['reset_time'] = now + self.window_ms
                client_data['blocked'] = False

            # Check limit
            if client_data['count'] >= self.max_requests:
                if not client_data['blocked']:
                    client_data['blocked'] = True
                    ColorPrint.yellow(f"Rate limit exceeded for client {client_id}")
                    if self.on_limit_reached:
                        self.on_limit_reached(client_id)

                return {
                    'allowed': False,
                    'remaining': 0,
                    'reset_time': client_data['reset_time'],
                    'retry_after': client_data['reset_time'] - now
                }

            # Increment count
            client_data['count'] += 1

            return {
                'allowed': True,
                'remaining': self.max_requests - client_data['count'],
                'reset_time': client_data['reset_time']
            }

    def record_success(self, client_id: str):
        """
        Record successful request (optionally decrement count)

        Args:
            client_id: Unique client identifier
        """
        if not self.skip_successful_requests:
            return

        with self._lock:
            client_data = self.clients.get(client_id)
            if client_data and client_data['count'] > 0:
                client_data['count'] -= 1

    def record_failure(self, client_id: str):
        """
        Record failed request (optionally decrement count)

        Args:
            client_id: Unique client identifier
        """
        if not self.skip_failed_requests:
            return

        with self._lock:
            client_data = self.clients.get(client_id)
            if client_data and client_data['count'] > 0:
                client_data['count'] -= 1

    def reset(self, client_id: str):
        """
        Reset rate limit for a client

        Args:
            client_id: Unique client identifier
        """
        with self._lock:
            self.clients.pop(client_id, None)
            ColorPrint.debug(f"Rate limit reset for client {client_id}")

    def reset_all(self):
        """Reset all rate limits"""
        with self._lock:
            self.clients.clear()
            ColorPrint.debug("All rate limits reset")

    def get_stats(self, client_id: str) -> Dict:
        """
        Get rate limit statistics for a client

        Args:
            client_id: Unique client identifier

        Returns:
            Dictionary with statistics
        """
        with self._lock:
            now = time.time() * 1000
            client_data = self.clients.get(client_id)

            if not client_data:
                return {
                    'count': 0,
                    'remaining': self.max_requests,
                    'reset_time': now + self.window_ms,
                    'blocked': False
                }

            return {
                'count': client_data['count'],
                'remaining': max(0, self.max_requests - client_data['count']),
                'reset_time': client_data['reset_time'],
                'blocked': client_data['blocked']
            }

    def _cleanup(self):
        """Cleanup expired rate limit data"""
        try:
            with self._lock:
                now = time.time() * 1000
                expired_clients = [
                    client_id for client_id, data in self.clients.items()
                    if now >= data['reset_time'] + self.window_ms
                ]

                for client_id in expired_clients:
                    self.clients.pop(client_id, None)

        except Exception as e:
            ColorPrint.red(f"Error in rate limiter cleanup: {e}")
        finally:
            # Reschedule cleanup
            self._cleanup_timer = threading.Timer(self.window_ms / 1000, self._cleanup)
            self._cleanup_timer.daemon = True
            self._cleanup_timer.start()

    def destroy(self):
        """Cleanup and stop timers"""
        if self._cleanup_timer:
            self._cleanup_timer.cancel()
        self.clients.clear()

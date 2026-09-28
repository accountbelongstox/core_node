#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rate Limiter - Request Rate Control

Controls API request rate to comply with OKX API limits.
Global limit: 20 requests per 3 seconds.
"""

import time
import threading
from collections import deque


class RateLimiter:
    """
    Rate Limiter for OKX API requests

    Ensures requests don't exceed the specified rate limit.
    Thread-safe implementation using locks.
    Tracks actual request timing and calculates real-time rates.
    """

    def __init__(self, max_requests: int = 20, time_window: float = 3.0):
        """
        Initialize rate limiter

        Args:
            max_requests (int): Maximum requests allowed in time window
            time_window (float): Time window in seconds
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()  # Timestamps of requests in current window
        self.lock = threading.Lock()

        # Enhanced tracking
        self.total_requests = 0
        self.total_wait_time = 0.0
        self.last_request_time = None
        self.start_time = time.time()

    def acquire(self):
        """
        Acquire permission to make a request

        Blocks if rate limit would be exceeded.
        Returns actual wait time and timing info.
        """
        with self.lock:
            current_time = time.time()
            wait_time = 0.0

            # Clean up old requests outside the time window
            while self.requests and (current_time - self.requests[0]) >= self.time_window:
                self.requests.popleft()

            # If at capacity, wait until we have room
            if len(self.requests) >= self.max_requests:
                oldest_request = self.requests[0]
                time_since_oldest = current_time - oldest_request

                if time_since_oldest < self.time_window:
                    wait_time = self.time_window - time_since_oldest + 0.01  # Small buffer
                    time.sleep(wait_time)
                    current_time = time.time()

                    # Clean up again after sleeping
                    while self.requests and (current_time - self.requests[0]) >= self.time_window:
                        self.requests.popleft()

            # Record this request
            self.requests.append(current_time)
            self.total_requests += 1
            self.total_wait_time += wait_time
            self.last_request_time = current_time

            return {
                'wait_time': wait_time,
                'request_number': self.total_requests,
                'timestamp': current_time
            }

    def get_stats(self) -> dict:
        """
        Get rate limiter statistics with actual rate calculations

        Returns:
            dict: Statistics including:
                - requests_in_window: Current requests in time window
                - max_requests: Maximum allowed requests
                - available_slots: Available request slots
                - total_requests: Total requests made
                - actual_rate: Actual requests per second (based on real timing)
                - avg_interval: Average interval between requests
                - total_wait_time: Total time spent waiting
                - efficiency: Percentage of time spent on requests vs waiting
        """
        with self.lock:
            current_time = time.time()

            # Clean up old requests
            while self.requests and (current_time - self.requests[0]) >= self.time_window:
                self.requests.popleft()

            # Calculate actual rate based on recent requests
            requests_in_window = len(self.requests)
            if requests_in_window >= 2:
                # Calculate rate from actual request timestamps in window
                oldest_in_window = self.requests[0]
                newest_in_window = self.requests[-1]
                actual_duration = newest_in_window - oldest_in_window

                if actual_duration > 0:
                    actual_rate = (requests_in_window - 1) / actual_duration  # req/s
                else:
                    actual_rate = 0.0
            else:
                actual_rate = 0.0

            # Overall statistics
            total_duration = current_time - self.start_time
            overall_rate = self.total_requests / total_duration if total_duration > 0 else 0.0

            # Average interval between requests
            avg_interval = total_duration / self.total_requests if self.total_requests > 0 else 0.0

            # Efficiency: (total_duration - wait_time) / total_duration
            efficiency = 100.0 * (1.0 - (self.total_wait_time / total_duration)) if total_duration > 0 else 100.0

            return {
                'requests_in_window': requests_in_window,
                'max_requests': self.max_requests,
                'available_slots': self.max_requests - requests_in_window,
                'time_window': self.time_window,
                'total_requests': self.total_requests,
                'actual_rate': actual_rate,  # Current rate in req/s
                'overall_rate': overall_rate,  # Overall average rate
                'avg_interval': avg_interval,  # Average time between requests
                'total_wait_time': self.total_wait_time,
                'efficiency': efficiency,  # % efficiency
                'is_throttled': requests_in_window >= self.max_requests
            }


_global_rate_limiter = None


def get_rate_limiter() -> RateLimiter:
    """
    Get global rate limiter instance

    Returns:
        RateLimiter: Global rate limiter singleton
    """
    global _global_rate_limiter

    if _global_rate_limiter is None:
        _global_rate_limiter = RateLimiter(max_requests=20, time_window=3.0)

    return _global_rate_limiter

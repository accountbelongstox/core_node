"""Logging middleware for API request/response tracking"""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from pyapps.matrix.services.logging_service import LoggingService


class APILoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging all API requests and responses

    Logs:
    - Request method, path, headers
    - Response status code
    - Request duration
    - Client IP address
    - Error details (if any)
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logging_service = LoggingService.instance()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and log details

        Args:
            request: Incoming request
            call_next: Next middleware/route handler

        Returns:
            Response from downstream handlers
        """
        # Record start time
        start_time = time.time()

        # Extract request info
        method = request.method
        path = request.url.path
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent")

        # Process request
        try:
            response = await call_next(request)
            status_code = response.status_code

        except Exception as e:
            # Log error
            duration_ms = (time.time() - start_time) * 1000
            LoggingService.log_api_request(
                method=method,
                path=path,
                client_ip=client_ip,
                status_code=500,
                duration_ms=duration_ms,
                user_agent=user_agent
            )
            raise

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log request (skip health check to reduce noise)
        if path != "/api/health" and not path.endswith("/health"):
            LoggingService.log_api_request(
                method=method,
                path=path,
                client_ip=client_ip,
                status_code=status_code,
                duration_ms=duration_ms,
                user_agent=user_agent
            )

            # Log slow requests (>1s)
            if duration_ms > 1000:
                LoggingService.get_logger().warning(
                    f"Slow API request: {method} {path} took {duration_ms:.2f}ms"
                )

        return response

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """
        Extract client IP from request

        Checks X-Forwarded-For header for proxy situations

        Args:
            request: FastAPI request

        Returns:
            Client IP address
        """
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, use first one
            return forwarded_for.split(",")[0].strip()

        return request.client.host if request.client else "unknown"


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware for monitoring API performance

    Tracks:
    - Request count per endpoint
    - Average response time
    - Error rates
    - Slow requests
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.request_count: dict = {}
        self.total_duration: dict = {}
        self.error_count: dict = {}
        self.slow_request_threshold_ms = 1000  # 1 second

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Monitor request performance

        Args:
            request: Incoming request
            call_next: Next middleware/route handler

        Returns:
            Response from downstream handlers
        """
        path = request.url.path
        start_time = time.time()

        # Initialize metrics for this endpoint
        if path not in self.request_count:
            self.request_count[path] = 0
            self.total_duration[path] = 0.0
            self.error_count[path] = 0

        # Process request
        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            # Update metrics
            self.request_count[path] += 1
            self.total_duration[path] += duration_ms

            # Track errors (4xx, 5xx)
            if response.status_code >= 400:
                self.error_count[path] += 1

            # Log performance metric
            if duration_ms > self.slow_request_threshold_ms:
                LoggingService.log_performance_metric(
                    metric_name="slow_request",
                    value=duration_ms,
                    unit="ms",
                    context={
                        "path": path,
                        "method": request.method,
                        "status_code": response.status_code
                    }
                )

            return response

        except Exception as e:
            # Update error count
            self.error_count[path] += 1
            raise

    def get_metrics(self) -> dict:
        """
        Get performance metrics

        Returns:
            Dictionary with metrics for all endpoints
        """
        metrics = {}

        for path in self.request_count.keys():
            count = self.request_count[path]
            avg_duration = (
                self.total_duration[path] / count
                if count > 0 else 0
            )
            error_rate = (
                (self.error_count[path] / count * 100)
                if count > 0 else 0
            )

            metrics[path] = {
                "request_count": count,
                "avg_duration_ms": round(avg_duration, 2),
                "total_duration_ms": round(self.total_duration[path], 2),
                "error_count": self.error_count[path],
                "error_rate_percent": round(error_rate, 2)
            }

        return metrics

    def reset_metrics(self) -> None:
        """Reset all performance metrics"""
        self.request_count.clear()
        self.total_duration.clear()
        self.error_count.clear()

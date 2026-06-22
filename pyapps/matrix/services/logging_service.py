"""Logging service for comprehensive application logging"""

from pathlib import Path
from typing import Optional
import sys
import logging
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_loguru

loguru = get_third_package_loguru()

try:
    logger = loguru.logger
except (ImportError, AttributeError):
    # Fallback to standard logging if loguru not available
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    logger.addHandler(handler)


class LoggingService:
    """
    Centralized logging service

    Responsibilities:
    - Configure application-wide logging
    - Provide structured logging methods
    - Manage log files and rotation
    - Support different log levels and formats
    """

    _instance: Optional['LoggingService'] = None
    _initialized: bool = False

    def __init__(self):
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)

    @classmethod
    def instance(cls) -> 'LoggingService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def initialize(
        cls,
        log_level: str = "INFO",
        enable_file_logging: bool = True,
        enable_console_logging: bool = True,
        rotation: str = "100 MB",
        retention: str = "30 days"
    ) -> None:
        """
        Initialize logging configuration

        Args:
            log_level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            enable_file_logging: Enable logging to files
            enable_console_logging: Enable console output
            rotation: Log file rotation size
            retention: Log file retention period
        """
        if cls._initialized:
            return

        service = cls.instance()

        # Remove default logger
        logger.remove()

        # Configure console logging
        if enable_console_logging:
            logger.add(
                sys.stdout,
                level=log_level,
                format=(
                    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                    "<level>{level: <8}</level> | "
                    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                    "<level>{message}</level>"
                ),
                colorize=True
            )

        # Configure file logging
        if enable_file_logging:
            # General application log
            logger.add(
                service.log_dir / "pymatrix_{time:YYYY-MM-DD}.log",
                level=log_level,
                rotation=rotation,
                retention=retention,
                format=(
                    "{time:YYYY-MM-DD HH:mm:ss} | "
                    "{level: <8} | "
                    "{name}:{function}:{line} | "
                    "{message}"
                ),
                enqueue=True  # Async logging
            )

            # Error-only log
            logger.add(
                service.log_dir / "errors_{time:YYYY-MM-DD}.log",
                level="ERROR",
                rotation=rotation,
                retention=retention,
                format=(
                    "{time:YYYY-MM-DD HH:mm:ss} | "
                    "{level: <8} | "
                    "{name}:{function}:{line} | "
                    "{message}\n"
                    "{extra}"
                ),
                backtrace=True,
                diagnose=True,
                enqueue=True
            )

            # API requests log
            logger.add(
                service.log_dir / "api_requests_{time:YYYY-MM-DD}.log",
                level="INFO",
                rotation=rotation,
                retention=retention,
                filter=lambda record: "api_request" in record["extra"],
                format="{message}",
                enqueue=True
            )

        cls._initialized = True
        logger.info("Logging service initialized")

    @staticmethod
    def get_logger():
        """Get the logger instance"""
        return logger

    @staticmethod
    def log_api_request(
        method: str,
        path: str,
        client_ip: str,
        status_code: int,
        duration_ms: float,
        user_agent: Optional[str] = None
    ) -> None:
        """
        Log API request

        Args:
            method: HTTP method
            path: Request path
            client_ip: Client IP address
            status_code: Response status code
            duration_ms: Request duration in milliseconds
            user_agent: User agent string
        """
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "method": method,
            "path": path,
            "client_ip": client_ip,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
            "user_agent": user_agent or "Unknown"
        }

        logger.bind(api_request=True).info(
            f"API Request: {method} {path} - Status: {status_code} - "
            f"Duration: {duration_ms:.2f}ms - IP: {client_ip}"
        )

    @staticmethod
    def log_device_operation(
        device_serial: str,
        operation: str,
        success: bool,
        duration_ms: Optional[float] = None,
        error: Optional[str] = None
    ) -> None:
        """
        Log device operation

        Args:
            device_serial: Device serial number
            operation: Operation name
            success: Operation success status
            duration_ms: Operation duration
            error: Error message if failed
        """
        status = "SUCCESS" if success else "FAILED"
        message = (
            f"Device Operation: {operation} on {device_serial} - "
            f"Status: {status}"
        )

        if duration_ms is not None:
            message += f" - Duration: {duration_ms:.2f}ms"

        if error:
            message += f" - Error: {error}"

        if success:
            logger.info(message)
        else:
            logger.error(message)

    @staticmethod
    def log_websocket_event(
        event_type: str,
        device_serial: str,
        message_type: Optional[str] = None,
        details: Optional[str] = None
    ) -> None:
        """
        Log WebSocket event

        Args:
            event_type: Event type (connect, disconnect, message, error)
            device_serial: Device serial number
            message_type: WebSocket message type
            details: Additional details
        """
        message = f"WebSocket {event_type}: {device_serial}"

        if message_type:
            message += f" - Type: {message_type}"

        if details:
            message += f" - {details}"

        logger.info(message)

    @staticmethod
    def log_group_operation(
        group_id: str,
        operation: str,
        device_count: int,
        success_count: int,
        failed_count: int,
        duration_ms: float
    ) -> None:
        """
        Log group batch operation

        Args:
            group_id: Group ID
            operation: Operation name
            device_count: Total devices
            success_count: Successful operations
            failed_count: Failed operations
            duration_ms: Total duration
        """
        message = (
            f"Group Operation: {operation} on group {group_id} - "
            f"Devices: {device_count} - "
            f"Success: {success_count} - "
            f"Failed: {failed_count} - "
            f"Duration: {duration_ms:.2f}ms"
        )

        if failed_count > 0:
            logger.warning(message)
        else:
            logger.info(message)

    @staticmethod
    def log_file_operation(
        operation: str,
        device_serial: str,
        file_path: str,
        file_size: int,
        success: bool,
        duration_ms: Optional[float] = None,
        error: Optional[str] = None
    ) -> None:
        """
        Log file operation

        Args:
            operation: Operation type (push, install, uninstall)
            device_serial: Device serial number
            file_path: File path
            file_size: File size in bytes
            success: Operation success status
            duration_ms: Operation duration
            error: Error message if failed
        """
        size_mb = file_size / (1024 * 1024)
        status = "SUCCESS" if success else "FAILED"

        message = (
            f"File Operation: {operation} - {file_path} ({size_mb:.2f}MB) "
            f"to {device_serial} - Status: {status}"
        )

        if duration_ms:
            message += f" - Duration: {duration_ms:.2f}ms"
            # Calculate transfer speed if applicable
            if success and duration_ms > 0 and operation == "push":
                speed_mbps = (file_size / 1024 / 1024) / (duration_ms / 1000)
                message += f" - Speed: {speed_mbps:.2f}MB/s"

        if error:
            message += f" - Error: {error}"

        if success:
            logger.info(message)
        else:
            logger.error(message)

    @staticmethod
    def log_performance_metric(
        metric_name: str,
        value: float,
        unit: str = "ms",
        context: Optional[dict] = None
    ) -> None:
        """
        Log performance metric

        Args:
            metric_name: Metric name
            value: Metric value
            unit: Value unit
            context: Additional context
        """
        message = f"Performance: {metric_name} = {value:.2f}{unit}"

        if context:
            message += f" - Context: {context}"

        logger.debug(message)


# Initialize with default configuration when module is imported
LoggingService.initialize(
    log_level="INFO",
    enable_file_logging=True,
    enable_console_logging=True
)

# Export logger for convenience
log = LoggingService.get_logger()

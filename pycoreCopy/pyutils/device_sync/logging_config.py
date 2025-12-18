# -*- coding: utf-8 -*-
"""
Device Sync - Logging Configuration

Centralized logging setup for device sync components.
"""

import logging
import sys
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import platform
from pathlib import Path
from datetime import datetime
import subprocess

# Log directory
LOG_DIR = Path.home() / '.device_sync' / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Log file path (rotate daily)
LOG_FILE = LOG_DIR / f"device_sync_{datetime.now().strftime('%Y%m%d')}.log"


def setup_logging(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Set up logging for a module.

    Args:
        name: Logger name (usually __name__)
        level: Logging level

    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid duplicate handlers
    if logger.handlers:
        return logger

    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # File handler
    file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger


def get_log_directory() -> Path:
    """Get log directory path."""
    return LOG_DIR


def get_log_file() -> Path:
    """Get current log file path."""
    return LOG_FILE


def open_log_directory():
    """Open log directory in file explorer."""
    system = platform.system()

    if system == 'Windows':
        subprocess.Popen(['explorer', str(LOG_DIR)])
    elif system == 'Darwin':  # macOS
        subprocess.Popen(['open', str(LOG_DIR)])
    else:  # Linux
        subprocess.Popen(['xdg-open', str(LOG_DIR)])


# Create main logger
logger = setup_logging('DeviceSync')

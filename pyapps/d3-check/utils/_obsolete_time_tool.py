#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Time utility module
Provides time formatting and calculation functions
"""

import time
from typing import Union, Optional


def format_time_difference(seconds: float) -> str:
    """
    Format time difference in a human-readable format
    
    Args:
        seconds: Time difference in seconds
        
    Returns:
        Formatted time string
    """
    if seconds < 60:
        return f"{seconds:.1f}秒"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}分钟"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}小时"


def format_remaining_time(seconds: float) -> str:
    """
    Format remaining time in a human-readable format
    
    Args:
        seconds: Remaining time in seconds
        
    Returns:
        Formatted remaining time string
    """
    if seconds <= 0:
        return "已超时"
    elif seconds < 60:
        return f"剩余{seconds:.1f}秒"
    else:
        minutes = seconds / 60
        return f"剩余{minutes:.1f}分钟"


def format_boss_duration(duration_seconds: float) -> str:
    """
    Format boss encounter duration in a concise format
    
    Args:
        duration_seconds: Duration in seconds
        
    Returns:
        Formatted duration string (e.g., "1.5分", "30秒")
    """
    if duration_seconds < 60:
        return f"{duration_seconds:.1f}秒"
    else:
        minutes = duration_seconds / 60
        return f"{minutes:.1f}分"


def format_boss_timeout_threshold(timeout_seconds: float) -> str:
    """
    Format boss timeout threshold in a concise format
    
    Args:
        timeout_seconds: Timeout threshold in seconds
        
    Returns:
        Formatted timeout string (e.g., "1分", "60秒")
    """
    if timeout_seconds < 60:
        return f"{timeout_seconds:.0f}秒"
    else:
        minutes = timeout_seconds / 60
        return f"{minutes:.0f}分"


def format_boss_elapsed_with_timeout(duration_seconds: float, timeout_seconds: float) -> str:
    """
    Format boss encounter duration with timeout comparison
    
    Args:
        duration_seconds: Current duration in seconds
        timeout_seconds: Timeout threshold in seconds
        
    Returns:
        Formatted string like "1.5分/1分"
    """
    duration_str = format_boss_duration(duration_seconds)
    timeout_str = format_boss_timeout_threshold(timeout_seconds)
    return f"{duration_str}/{timeout_str}"


def get_current_timestamp() -> float:
    """
    Get current timestamp
    
    Returns:
        Current timestamp as float
    """
    return time.time()


def calculate_time_since(timestamp: Optional[float]) -> float:
    """
    Calculate time since given timestamp
    
    Args:
        timestamp: Reference timestamp
        
    Returns:
        Time difference in seconds
    """
    if timestamp is None:
        return 0.0
    
    current_time = get_current_timestamp()
    return current_time - timestamp


def calculate_remaining_time(timestamp: Optional[float], timeout_seconds: float) -> float:
    """
    Calculate remaining time before timeout
    
    Args:
        timestamp: Last activity timestamp
        timeout_seconds: Timeout duration in seconds
        
    Returns:
        Remaining time in seconds (negative if already timed out)
    """
    if timestamp is None:
        return -timeout_seconds
    
    time_since = calculate_time_since(timestamp)
    return timeout_seconds - time_since


def is_timed_out(timestamp: Optional[float], timeout_seconds: float) -> bool:
    """
    Check if timestamp has timed out
    
    Args:
        timestamp: Last activity timestamp
        timeout_seconds: Timeout duration in seconds
        
    Returns:
        True if timed out, False otherwise
    """
    return calculate_remaining_time(timestamp, timeout_seconds) <= 0


def format_timestamp(timestamp: float) -> str:
    """
    Format timestamp to readable string
    
    Args:
        timestamp: Unix timestamp
        
    Returns:
        Formatted timestamp string
    """
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp))

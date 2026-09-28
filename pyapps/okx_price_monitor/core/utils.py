#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Core Utilities

Basic utility functions with no external project dependencies.
Only standard library imports allowed.
"""

import time
from typing import Optional, Union


def timestamp_ms() -> int:
    """
    Get current timestamp in milliseconds
    
    Returns:
        int: Current timestamp in milliseconds
    """
    return int(time.time() * 1000)


def timestamp_s() -> int:
    """
    Get current timestamp in seconds
    
    Returns:
        int: Current timestamp in seconds
    """
    return int(time.time())


def format_price(price: Union[str, float, int]) -> str:
    """
    Format price value for display
    
    Args:
        price: Price value (can be string, float, or int)
        
    Returns:
        str: Formatted price string
    """
    try:
        price_float = float(price)
        
        if price_float >= 1000:
            return f"{price_float:,.2f}"
        elif price_float >= 1:
            return f"{price_float:.4f}"
        elif price_float >= 0.0001:
            return f"{price_float:.6f}"
        else:
            return f"{price_float:.8f}"
    except (ValueError, TypeError):
        return str(price)


def calculate_change_percent(current: float, previous: float) -> float:
    """
    Calculate percentage change between two values
    
    Args:
        current (float): Current value
        previous (float): Previous value
        
    Returns:
        float: Percentage change
    """
    if previous == 0:
        return 0.0
    
    return ((current - previous) / previous) * 100


def safe_float(value: any, default: float = 0.0) -> float:
    """
    Safely convert value to float
    
    Args:
        value: Value to convert
        default (float): Default value if conversion fails
        
    Returns:
        float: Converted value or default
    """
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value: any, default: int = 0) -> int:
    """
    Safely convert value to int
    
    Args:
        value: Value to convert
        default (int): Default value if conversion fails
        
    Returns:
        int: Converted value or default
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def format_timestamp(timestamp: int, format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    Format timestamp to readable string
    
    Args:
        timestamp (int): Timestamp in milliseconds
        format_str (str): Time format string
        
    Returns:
        str: Formatted time string
    """
    try:
        return time.strftime(format_str, time.localtime(timestamp / 1000))
    except Exception:
        return str(timestamp)


def get_time_range(hours: int) -> tuple:
    """
    Get time range for querying historical data
    
    Args:
        hours (int): Number of hours to look back
        
    Returns:
        tuple: (start_timestamp_ms, end_timestamp_ms)
    """
    end_ts = timestamp_ms()
    start_ts = end_ts - (hours * 3600 * 1000)
    return start_ts, end_ts


def batch_list(items: list, batch_size: int) -> list:
    """
    Split list into batches
    
    Args:
        items (list): List to split
        batch_size (int): Size of each batch
        
    Returns:
        list: List of batches
    """
    if batch_size <= 0:
        return [items]
    
    batches = []
    for i in range(0, len(items), batch_size):
        batches.append(items[i:i + batch_size])
    
    return batches


def extract_inst_id(ticker_data: dict) -> Optional[str]:
    """
    Extract instrument ID from ticker data
    
    Args:
        ticker_data (dict): Ticker data from API
        
    Returns:
        Optional[str]: Instrument ID or None
    """
    return ticker_data.get('instId')


def extract_symbol(inst_id: str) -> str:
    """
    Extract symbol from instrument ID
    
    Args:
        inst_id (str): Instrument ID (e.g., "BTC-USDT")
        
    Returns:
        str: Base symbol (e.g., "BTC")
    """
    if '-' in inst_id:
        return inst_id.split('-')[0]
    return inst_id


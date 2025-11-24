#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Utility Functions

Provides consistent RPC response parsing across the application.
"""


def parse_rpc_response(response_json, extract_data=False):
    """
    Parse RPC response with consistent error handling

    RPC Framework Response Format:
    {
        "success": true,
        "result": {
            "success": true,
            "data": [...],
            ...
        }
    }

    Args:
        response_json (dict): JSON response from RPC call
        extract_data (bool): Whether to extract 'data' field from result

    Returns:
        dict or any: Parsed result data

    Raises:
        Exception: If RPC call failed
    """
    if not response_json.get('success'):
        error_msg = response_json.get('error', 'Unknown RPC error')
        raise Exception(f"RPC call failed: {error_msg}")

    if 'result' not in response_json:
        raise Exception("RPC response missing 'result' field")

    actual_data = response_json.get('result')

    if isinstance(actual_data, dict) and not actual_data.get('success', True):
        error_msg = actual_data.get('error', 'Unknown backend error')
        raise Exception(f"Backend returned error: {error_msg}")

    if extract_data:
        if isinstance(actual_data, dict) and 'data' in actual_data:
            return actual_data.get('data')
        return actual_data

    return actual_data


def parse_rpc_response_safe(response_json, extract_data=False, default=None):
    """
    Safely parse RPC response without raising exceptions

    Args:
        response_json (dict): JSON response from RPC call
        extract_data (bool): Whether to extract 'data' field from result
        default: Default value to return on error

    Returns:
        Parsed result data or default value
    """
    try:
        return parse_rpc_response(response_json, extract_data)
    except Exception:
        return default

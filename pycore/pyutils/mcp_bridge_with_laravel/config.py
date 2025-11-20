#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Bridge Configuration

Centralized configuration for Laravel network bridge.
"""

# Laravel Octane server configuration
LARAVEL_BASE_URL = "http://127.0.0.1:9003"
LARAVEL_API_PREFIX = "/api/mcp/v1"

# Timeout settings (in seconds)
DEFAULT_TIMEOUT = 300  # 5 minutes
BATCH_TIMEOUT = 600    # 10 minutes
QUICK_TIMEOUT = 30     # 30 seconds

# Network retry settings
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

__all__ = [
    'LARAVEL_BASE_URL',
    'LARAVEL_API_PREFIX',
    'DEFAULT_TIMEOUT',
    'BATCH_TIMEOUT',
    'QUICK_TIMEOUT',
    'MAX_RETRIES',
    'RETRY_DELAY'
]

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STDIO Compatibility Utilities

Ensures stdin/stdout have buffer attributes required by MCP protocol.
Independent implementation without pycore dependencies.
"""

import sys
import io


def ensure_stdio_has_buffer_attributes():
    """
    Ensure stdin and stdout have buffer attributes required by MCP.

    Some Python environments (like certain Windows configurations) may have
    stdin/stdout without proper buffer attributes. This function wraps them
    if needed.
    """
    # Check and wrap stdin
    if not hasattr(sys.stdin, 'buffer'):
        try:
            sys.stdin = io.TextIOWrapper(
                io.BufferedReader(io.FileIO(sys.stdin.fileno(), 'rb')),
                encoding='utf-8',
                line_buffering=True
            )
        except (AttributeError, OSError):
            # If stdin.fileno() fails, we're probably in a test environment
            # Create a dummy buffer
            sys.stdin.buffer = io.BytesIO()

    # Check and wrap stdout
    if not hasattr(sys.stdout, 'buffer'):
        try:
            sys.stdout = io.TextIOWrapper(
                io.BufferedWriter(io.FileIO(sys.stdout.fileno(), 'wb')),
                encoding='utf-8',
                line_buffering=True
            )
        except (AttributeError, OSError):
            # If stdout.fileno() fails, we're probably in a test environment
            # Create a dummy buffer
            sys.stdout.buffer = io.BytesIO()

    # Check and wrap stderr
    if not hasattr(sys.stderr, 'buffer'):
        try:
            sys.stderr = io.TextIOWrapper(
                io.BufferedWriter(io.FileIO(sys.stderr.fileno(), 'wb')),
                encoding='utf-8',
                line_buffering=True
            )
        except (AttributeError, OSError):
            # If stderr.fileno() fails, we're probably in a test environment
            # Create a dummy buffer
            sys.stderr.buffer = io.BytesIO()


__all__ = ['ensure_stdio_has_buffer_attributes']

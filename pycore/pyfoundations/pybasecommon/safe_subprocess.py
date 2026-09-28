#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Safe Subprocess Wrapper
Automatically handles UTF-8 encoding for all subprocess calls
Prevents 'gbk' codec errors on Windows Chinese systems

Usage:
    Replace:  import subprocess
    With:     from pycore.pyfoundations.safe_subprocess import subprocess
"""

import subprocess as _subprocess
from typing import Any, Optional


class SafePopen(_subprocess.Popen):
    """Safe Popen wrapper with automatic UTF-8 encoding"""

    def __init__(self, *args, **kwargs):
        # Auto-add UTF-8 encoding if text mode is enabled
        if kwargs.get('text') or kwargs.get('universal_newlines'):
            kwargs.setdefault('encoding', 'utf-8')
            kwargs.setdefault('errors', 'replace')

        super().__init__(*args, **kwargs)


def run(*args, **kwargs) -> _subprocess.CompletedProcess:
    """Safe subprocess.run with automatic UTF-8 encoding"""
    # Auto-add UTF-8 encoding if text mode is enabled
    if kwargs.get('text') or kwargs.get('universal_newlines'):
        kwargs.setdefault('encoding', 'utf-8')
        kwargs.setdefault('errors', 'replace')

    return _subprocess.run(*args, **kwargs)


def check_output(*args, **kwargs) -> Any:
    """Safe subprocess.check_output with automatic UTF-8 encoding"""
    # Auto-add UTF-8 encoding if text mode is enabled
    if kwargs.get('text') or kwargs.get('universal_newlines'):
        kwargs.setdefault('encoding', 'utf-8')
        kwargs.setdefault('errors', 'replace')

    return _subprocess.check_output(*args, **kwargs)


def call(*args, **kwargs) -> int:
    """Safe subprocess.call with automatic UTF-8 encoding"""
    # Auto-add UTF-8 encoding if text mode is enabled
    if kwargs.get('text') or kwargs.get('universal_newlines'):
        kwargs.setdefault('encoding', 'utf-8')
        kwargs.setdefault('errors', 'replace')

    return _subprocess.call(*args, **kwargs)


def check_call(*args, **kwargs) -> int:
    """Safe subprocess.check_call with automatic UTF-8 encoding"""
    # Auto-add UTF-8 encoding if text mode is enabled
    if kwargs.get('text') or kwargs.get('universal_newlines'):
        kwargs.setdefault('encoding', 'utf-8')
        kwargs.setdefault('errors', 'replace')

    return _subprocess.check_call(*args, **kwargs)


# Create a module-like object that behaves like subprocess
class SafeSubprocessModule:
    """Module wrapper that provides safe subprocess functions"""

    # Classes
    Popen = SafePopen
    CompletedProcess = _subprocess.CompletedProcess
    CalledProcessError = _subprocess.CalledProcessError
    TimeoutExpired = _subprocess.TimeoutExpired
    SubprocessError = _subprocess.SubprocessError

    # Constants
    PIPE = _subprocess.PIPE
    STDOUT = _subprocess.STDOUT
    DEVNULL = _subprocess.DEVNULL

    # Functions
    run = staticmethod(run)
    call = staticmethod(call)
    check_call = staticmethod(check_call)
    check_output = staticmethod(check_output)

    # Pass through other functions unchanged
    getstatusoutput = staticmethod(_subprocess.getstatusoutput)
    getoutput = staticmethod(_subprocess.getoutput)

    def __getattr__(self, name):
        """Fallback to original subprocess for any missing attributes"""
        return getattr(_subprocess, name)


# Export the module-like object as 'subprocess'
subprocess = SafeSubprocessModule()


# Also export individual functions for convenience
__all__ = [
    'subprocess',
    'SafePopen',
    'run',
    'call',
    'check_call',
    'check_output',
]

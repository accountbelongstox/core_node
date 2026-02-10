#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4Utils Package (PROJECT_STANDARDS §3.4).
All modules use d4_ prefix. D4-only; no D3/ROSBOT imports.
"""

from .d4_red_portal_detector import d4_detect_red_portal

__all__ = [
    "d4_detect_red_portal",
]

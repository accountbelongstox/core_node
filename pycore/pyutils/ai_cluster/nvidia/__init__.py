#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NVIDIA NIM client library.

NVIDIA provides accelerated LLM inference via NIM microservices.
API: https://docs.api.nvidia.com/
"""

from pycore.pyutils.ai_cluster.nvidia.nvidia_client import NVIDIAClient

__all__ = ["NVIDIAClient"]

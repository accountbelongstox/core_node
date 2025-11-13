#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Server Configuration
"""

from dataclasses import dataclass


@dataclass
class Config:
    """MCP Server configuration"""
    WEB_HOST: str = "localhost"
    WEB_PORT: int = 8080
    MCP_SERVER_PORT: int = 8081
    MAIN_SERVER_PORT: int = 8082
    CLIENT_MODE: bool = False


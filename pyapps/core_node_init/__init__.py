"""
Core Node Init - Python MCP Server Application

This application provides web automation and IT tools integration through MCP protocol.
"""

from pyapps.core_node_init.main import start, CoreNodeInitApp
from pyapps.core_node_init.controller import (
    ApplicationController,
    CoreNodeInitMCPServer,
    CoreNodeSingletonLauncher
)
from pyapps.core_node_init.config import Config, config

__version__ = '2.0.0'

__all__ = [
    'start',
    'CoreNodeInitApp',
    'ApplicationController',
    'CoreNodeInitMCPServer',
    'CoreNodeSingletonLauncher',
    'Config',
    'config'
]

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Service Starter

Custom service starter for Matrix application (frontend + backend).
This starter is registered dynamically in matrix_main.py.
"""

from typing import Dict, Any
from pycore import ColorPrint, THREAD_BUS
from pyapps.matrix.controller import MatrixService, MatrixServiceConfig


def start_matrix_service(config: Dict[str, Any]) -> Any:
    """
    Start Matrix application service (frontend + backend lifecycle)

    This is a custom service starter that manages Matrix-specific
    frontend (Nuxt) and backend (FastAPI via controllers) startup.

    Args:
        config: Matrix service configuration
            - project_root: Path - Project root directory
            - frontend_port: int - Frontend port (default: 3007)
            - frontend_timeout: int - Frontend startup timeout (default: 120)
            - frontend_mode: str - Frontend mode (default: 'dev', options: 'dev' | 'production')
            - frontend_skip_build: bool - Skip build in production mode (default: False)
            - backend_host: str - Backend host (default: '0.0.0.0')
            - backend_port: int - Backend port (default: 8000)
            - backend_mode: str - Backend mode (default: 'dev')

    Returns:
        MatrixService instance
    """
    ColorPrint.blue("[matrix_service] Starting Matrix Application Service...")

    # Create Matrix service configuration
    matrix_config = MatrixServiceConfig(
        project_root=config.get('project_root'),
        frontend_port=config.get('frontend_port', 38007),
        frontend_timeout=config.get('frontend_timeout', 120),
        frontend_mode=config.get('frontend_mode', 'production'),
        frontend_skip_build=config.get('frontend_skip_build', False),
        frontend_force_rebuild=config.get('frontend_force_rebuild', False),
        backend_host=config.get('backend_host', '0.0.0.0'),
        backend_port=config.get('backend_port', 8000),
        backend_mode=config.get('backend_mode', 'dev'),
        enabled=True
    )

    # Create and start service
    instance = MatrixService(matrix_config)
    instance.start()

    # Register shutdown handler
    def stop_matrix():
        ColorPrint.blue("[matrix_service] Stopping Matrix Application Service...")
        instance.stop()
        ColorPrint.green("[matrix_service] Matrix Application Service stopped")

    # Use priority 45 to stop before rpc_v2 (priority 50)
    THREAD_BUS.register_shutdown_handler(
        handler=stop_matrix,
        priority=45,
        name="matrix_service"
    )

    ColorPrint.green("[matrix_service] Matrix Application Service started")
    return instance

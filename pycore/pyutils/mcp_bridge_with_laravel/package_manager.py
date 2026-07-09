#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart package installation manager for the File Processor MCP Server.

Extracted from main.py. Provides on-demand pip-install with an import-probe
cache + lock. The pip command is built by the shared platform-aware helper
build_pip_install_command (Linux --break-system-packages included) and run with
realtime output redirected to stderr only -- NEVER stdout, because this server
speaks MCP JSON-RPC over stdout and ensure_packages() is called from tool
functions at runtime. run_pip_install_with_realtime_output() itself prints to
stdout via run_third_party_command, so it cannot be used directly here.
"""

import importlib
import logging
import subprocess
import sys
import threading

from constants import FileProcessorConstants
from pycore.pyfoundations.third_party import build_pip_install_command

logger = logging.getLogger(__name__)


class PackageManager:
    """Smart package installation manager with non-blocking initialization"""

    # Single source of truth lives in FileProcessorConstants.PACKAGE_MAPPING.
    PACKAGE_MAPPING = FileProcessorConstants.PACKAGE_MAPPING

    _installation_status = {}
    _installation_lock = threading.Lock()

    @staticmethod
    def install_package(package_name: str, timeout: int = 60) -> bool:
        """Install a Python package with timeout.

        Uses the shared platform-aware command builder (build_pip_install_command)
        so Linux gets --break-system-packages. Output is streamed realtime to
        stderr (not PIPE-captured) while stdout stays clean for MCP JSON-RPC.
        """
        with PackageManager._installation_lock:
            # Check cache first
            if package_name in PackageManager._installation_status:
                return PackageManager._installation_status[package_name]

            try:
                importlib.import_module(package_name.replace('-', '_').replace('python_', ''))
                logger.info(f"[OK] {package_name} is already installed")
                PackageManager._installation_status[package_name] = True
                return True
            except ImportError:
                logger.info(f"[INFO] Installing {package_name}...")
                try:
                    # Shared platform-aware command (adds --break-system-packages on Linux).
                    pip_cmd = build_pip_install_command(package_name)

                    # Realtime output on stderr only; stdout reserved for MCP JSON-RPC.
                    process = subprocess.Popen(pip_cmd, stdout=sys.stderr, stderr=sys.stderr)
                    try:
                        process.wait(timeout=timeout)
                        if process.returncode == 0:
                            logger.info(f"[OK] {package_name} installed successfully")
                            PackageManager._installation_status[package_name] = True
                            return True
                        else:
                            logger.error(f"[ERROR] Failed to install {package_name} (exit code {process.returncode})")
                            PackageManager._installation_status[package_name] = False
                            return False
                    except subprocess.TimeoutExpired:
                        process.kill()
                        logger.error(f"[ERROR] {package_name} installation timed out")
                        PackageManager._installation_status[package_name] = False
                        return False

                except Exception as e:
                    logger.error(f"[ERROR] Failed to install {package_name}: {e}")
                    PackageManager._installation_status[package_name] = False
                    return False

    @staticmethod
    def ensure_packages(format_type: str, async_install: bool = False) -> bool:
        """Ensure required packages for format type are installed"""
        packages = PackageManager.PACKAGE_MAPPING.get(format_type, [])

        if async_install:
            # Start installation in background
            def install_async():
                for package in packages:
                    PackageManager.install_package(package)

            thread = threading.Thread(target=install_async, daemon=True)
            thread.start()
            return True
        else:
            success_count = 0
            for package in packages:
                if PackageManager.install_package(package):
                    success_count += 1
                else:
                    logger.warning(f"[WARN] Optional package {package} not installed")

            # Return True if at least half of the packages are installed
            return success_count >= len(packages) // 2 + 1 if packages else True

    @staticmethod
    def initialize_all_packages():
        """Initialize all packages in background (non-blocking)"""
        def init_packages():
            logger.info("[INFO] Starting background package initialization...")
            for format_type in PackageManager.PACKAGE_MAPPING:
                PackageManager.ensure_packages(format_type, async_install=False)
            logger.info("[INFO] Package initialization completed")

        thread = threading.Thread(target=init_packages, daemon=True)
        thread.start()
        logger.info("[INFO] Package initialization started in background")

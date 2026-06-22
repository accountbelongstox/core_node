#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Compiler

Manages Nuxt frontend compilation for Matrix application.
Uses pycore.pyutils.frontend_launcher for unified frontend management.
"""

from pathlib import Path

from pycore import ColorPrint
from pycore.pyutils.frontend_launcher import NuxtLauncher, FrontendConfig


def compile_frontend_if_needed(
    project_root: Path,
    skip_build: bool = False,
    force_rebuild: bool = False
) -> bool:
    """
    Compile frontend if needed (production mode only)

    Args:
        project_root: Project root directory
        skip_build: Skip build even if output doesn't exist
        force_rebuild: Force rebuild even if output exists

    Returns:
        True if compilation succeeded or was skipped
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" FRONTEND COMPILATION CHECK")
    ColorPrint.blue("=" * 70)

    # Create frontend configuration
    config = FrontendConfig(
        app_name='pymatrix',
        port=38007,  # Not used in production mode
        mode='production',
        skip_build=skip_build,
        force_rebuild=force_rebuild,
        project_root=project_root,
        show_output=True
    )

    # Create Nuxt launcher
    launcher = NuxtLauncher(config=config)

    # Check if build exists
    if launcher.static_dir.exists() and not force_rebuild:
        if skip_build:
            ColorPrint.green(f"[Frontend] Using existing build: {launcher.static_dir}")
            ColorPrint.blue("=" * 70)
            return True
        else:
            ColorPrint.yellow(f"[Frontend] Build exists but skip_build=False: {launcher.static_dir}")

    # Build frontend
    if skip_build and not force_rebuild:
        ColorPrint.yellow("[Frontend] Build skipped (skip_build=True)")
        ColorPrint.yellow("[Frontend] WARNING: Static files may not exist!")
        ColorPrint.blue("=" * 70)
        return True

    ColorPrint.blue("[Frontend] Starting compilation...")
    success = launcher.prepare_build()

    if success:
        ColorPrint.green("=" * 70)
        ColorPrint.green(" FRONTEND COMPILATION SUCCESS")
        ColorPrint.green("=" * 70)
        ColorPrint.green(f"  Output: {launcher.get_output_dir()}")
        ColorPrint.green(f"  Static: {launcher.static_dir}")
        ColorPrint.green("=" * 70)
    else:
        ColorPrint.red("=" * 70)
        ColorPrint.red(" FRONTEND COMPILATION FAILED")
        ColorPrint.red("=" * 70)

    return success

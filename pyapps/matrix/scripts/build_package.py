#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application Packaging Script

This script packages the Matrix application into a standalone executable.
It automatically handles:
- Dependency checking and installation via third_party.py
- Resource file collection
- PyInstaller packaging with proper configuration
- Frontend build integration

Usage:
    python scripts/build_package.py
"""

import sys
import os
import shutil
import subprocess
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import after path setup
from pycore.pyfoundations.pybasecommon import Commander
from pycore.pyfoundations.color_print import ColorPrint


class MatrixPackager:
    """Matrix Application Packager"""

    def __init__(self):
        self.project_root = PROJECT_ROOT
        self.app_root = self.project_root / "pyapps" / "matrix"
        self.resources_dir = self.app_root / "resources"
        self.frontend_dir = self.project_root / "poly_apps" / "matrixui"
        self.dist_dir = self.app_root / "dist"
        self.build_dir = self.app_root / "build"
        self.spec_file = self.app_root / "matrix.spec"

    def check_pyinstaller(self):
        """Check if PyInstaller is installed, install if missing"""
        ColorPrint.blue("[1/6] Checking PyInstaller...")

        try:
            import PyInstaller
            ColorPrint.green(f"PyInstaller is already installed (version {PyInstaller.__version__})")
            return True
        except ImportError:
            ColorPrint.yellow("PyInstaller not found, installing...")

        # Install PyInstaller
        cmd = [sys.executable, "-m", "pip", "install", "pyinstaller"]
        result = Commander.exec_realtime(cmd, info=True, show_output=True)

        if result.success:
            ColorPrint.green("PyInstaller installed successfully")
            return True
        else:
            ColorPrint.red("Failed to install PyInstaller")
            return False

    def check_dependencies(self):
        """Check and install all dependencies via third_party.py"""
        ColorPrint.blue("[2/6] Checking dependencies via third_party.py...")

        try:
            # Import third_party.py will automatically check and install dependencies
            from pycore.pyfoundations import third_party
            ColorPrint.green("All dependencies checked via third_party.py")
            return True
        except Exception as e:
            ColorPrint.red(f"Failed to check dependencies: {e}")
            return False

    def build_frontend(self):
        """Build frontend if in production mode"""
        ColorPrint.blue("[3/6] Checking frontend build...")

        from pyapps.matrix.matrix_config import Config

        if Config.FRONTEND_MODE == "production":
            ColorPrint.yellow("Building frontend (production mode)...")

            frontend_dist = self.frontend_dir / "dist"
            if frontend_dist.exists() and not Config.FRONTEND_FORCE_REBUILD:
                ColorPrint.green("Frontend already built, skipping")
                return True

            if not self.frontend_dir.exists():
                ColorPrint.red(f"Frontend directory not found: {self.frontend_dir}")
                return False

            # Install npm dependencies
            ColorPrint.blue("Installing npm dependencies...")
            result = Commander.exec_realtime(
                ["npm", "install"],
                cwd=str(self.frontend_dir),
                info=True,
                show_output=True
            )

            if not result.success:
                ColorPrint.red("Failed to install npm dependencies")
                return False

            # Build frontend
            ColorPrint.blue("Building frontend...")
            result = Commander.exec_realtime(
                ["npm", "run", "build"],
                cwd=str(self.frontend_dir),
                info=True,
                show_output=True
            )

            if result.success:
                ColorPrint.green("Frontend built successfully")
                return True
            else:
                ColorPrint.red("Failed to build frontend")
                return False
        else:
            ColorPrint.yellow("Frontend mode is 'dev', skipping frontend build")
            return True

    def collect_resources(self):
        """Collect all resource files needed for packaging"""
        ColorPrint.blue("[4/6] Collecting resources...")

        resources = []

        # Collect resources directory
        if self.resources_dir.exists():
            resources.append((str(self.resources_dir), "resources"))
            ColorPrint.green(f"Added resources directory: {self.resources_dir}")

        # Collect frontend dist (if production mode)
        from pyapps.matrix.matrix_config import Config
        if Config.FRONTEND_MODE == "production":
            frontend_dist = self.frontend_dir / "dist"
            if frontend_dist.exists():
                resources.append((str(frontend_dist), "frontend/dist"))
                ColorPrint.green(f"Added frontend dist: {frontend_dist}")

        # Collect pycore directory (needed for runtime imports)
        pycore_dir = self.project_root / "pycore"
        if pycore_dir.exists():
            resources.append((str(pycore_dir), "pycore"))
            ColorPrint.green(f"Added pycore directory: {pycore_dir}")

        return resources

    def generate_spec_file(self, resources):
        """Generate PyInstaller spec file"""
        ColorPrint.blue("[5/6] Generating PyInstaller spec file...")

        main_entry = self.app_root / "matrix_main.py"
        icon_file = self.resources_dir / "icon.ico"

        spec_content = f"""# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Collected resources
added_files = [
"""

        for src, dst in resources:
            spec_content += f"    ('{src}', '{dst}'),\n"

        spec_content += """]

# Hidden imports (third-party packages used by matrix)
hiddenimports = [
    'pycore',
    'pycore.pyfoundations',
    'pycore.pyutils',
    'pycore.pygvar',
    'pycore.pyheartbeat',
    'pycore.database',
    'fastapi',
    'uvicorn',
    'websockets',
    'PySide6',
    'aiohttp',
    'requests',
    'psutil',
    'netifaces',
    'PIL',
    'cv2',
    'numpy',
    'adb_shell',
    'av',
]

a = Analysis(
    ['{main_entry}'],
    pathex=['{self.project_root}'],
    binaries=[],
    datas=added_files,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Matrix',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='{icon_file}' if {icon_file.exists()} else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Matrix',
)
"""

        self.spec_file.write_text(spec_content, encoding='utf-8')
        ColorPrint.green(f"Spec file generated: {self.spec_file}")
        return True

    def run_pyinstaller(self):
        """Run PyInstaller with generated spec file"""
        ColorPrint.blue("[6/6] Running PyInstaller...")

        if not self.spec_file.exists():
            ColorPrint.red(f"Spec file not found: {self.spec_file}")
            return False

        # Clean previous builds
        if self.build_dir.exists():
            ColorPrint.yellow("Cleaning previous build...")
            shutil.rmtree(self.build_dir)

        if self.dist_dir.exists():
            ColorPrint.yellow("Cleaning previous dist...")
            shutil.rmtree(self.dist_dir)

        # Run PyInstaller
        cmd = [
            sys.executable,
            "-m", "PyInstaller",
            str(self.spec_file),
            "--clean",
            "--noconfirm"
        ]

        result = Commander.exec_realtime(cmd, info=True, show_output=True)

        if result.success:
            ColorPrint.green("=" * 70)
            ColorPrint.green("PyInstaller completed successfully!")
            ColorPrint.green(f"Output directory: {self.dist_dir}")
            ColorPrint.green("=" * 70)
            return True
        else:
            ColorPrint.red("PyInstaller failed")
            return False

    def package(self):
        """Main packaging workflow"""
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" Matrix Application Packaging Script")
        ColorPrint.blue("=" * 70)
        ColorPrint.blue("")

        steps = [
            ("Check PyInstaller", self.check_pyinstaller),
            ("Check Dependencies", self.check_dependencies),
            ("Build Frontend", self.build_frontend),
        ]

        for step_name, step_func in steps:
            if not step_func():
                ColorPrint.red(f"Step failed: {step_name}")
                return False

        # Collect resources
        resources = self.collect_resources()

        # Generate spec file
        if not self.generate_spec_file(resources):
            return False

        # Run PyInstaller
        if not self.run_pyinstaller():
            return False

        ColorPrint.green("")
        ColorPrint.green("=" * 70)
        ColorPrint.green(" Packaging Completed Successfully!")
        ColorPrint.green("=" * 70)
        ColorPrint.green(f" Executable: {self.dist_dir / 'Matrix' / 'Matrix.exe'}")
        ColorPrint.green("=" * 70)

        return True


def main():
    """Main entry point"""
    packager = MatrixPackager()
    success = packager.package()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

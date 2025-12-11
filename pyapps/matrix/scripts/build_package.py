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

        # Install PyInstaller with direct output
        cmd = [sys.executable, "-m", "pip", "install", "pyinstaller"]
        ColorPrint.blue(f"Running: {' '.join(cmd)}")

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        # Print output in real-time
        for line in process.stdout:
            print(line, end='')

        process.wait()

        # Verify by trying to import again
        try:
            import PyInstaller
            ColorPrint.green("PyInstaller installed successfully")
            return True
        except ImportError:
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
            ColorPrint.blue(f"Running: npm install in {self.frontend_dir}")

            process = subprocess.Popen(
                ["npm", "install"],
                cwd=str(self.frontend_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )

            for line in process.stdout:
                print(line, end='')

            process.wait()

            # Build frontend
            ColorPrint.blue("Building frontend...")
            ColorPrint.blue(f"Running: npm run build in {self.frontend_dir}")

            process = subprocess.Popen(
                ["npm", "run", "build"],
                cwd=str(self.frontend_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )

            for line in process.stdout:
                print(line, end='')

            process.wait()

            # Check if build succeeded by verifying dist directory
            if frontend_dist.exists():
                ColorPrint.green("Frontend built successfully")
                return True
            else:
                ColorPrint.red("Failed to build frontend - dist directory not found")
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

        # Use pymain.py as entry point (actual call chain)
        main_entry = self.project_root / "pymain.py"
        icon_file = self.resources_dir / "icon.ico"

        # Convert paths to use forward slashes (PyInstaller compatible)
        def path_to_spec_string(p):
            """Convert Path to spec-compatible string with forward slashes"""
            return str(p).replace('\\', '/')

        spec_content = f"""# -*- mode: python ; coding: utf-8 -*-
# Matrix Application PyInstaller Spec
# Entry: pymain.py app=matrix (actual call chain)

block_cipher = None

# Collected resources
added_files = [
"""

        for src, dst in resources:
            # Use forward slashes for cross-platform compatibility
            src_fixed = path_to_spec_string(src)
            spec_content += f"    (r'{src_fixed}', '{dst}'),\n"

        spec_content += f"""]

# Hidden imports (third-party packages used by matrix)
hiddenimports = [
    # Pycore modules
    'pycore',
    'pycore.pyfoundations',
    'pycore.pyfoundations.app_launcher',
    'pycore.pyutils',
    'pycore.pyutils.native_ui',
    'pycore.pyutils.rpc',
    'pycore.pygvar',
    'pycore.pyheartbeat',
    'pycore.database',

    # Matrix app modules
    'pyapps.matrix',
    'pyapps.matrix.matrix_main',
    'pyapps.matrix.matrix_config',
    'pyapps.matrix.api',
    'pyapps.matrix.controller',
    'pyapps.matrix.adb_device_manager',

    # Third-party packages
    'fastapi',
    'uvicorn',
    'websockets',
    'PySide6',
    'PySide6.QtCore',
    'PySide6.QtGui',
    'PySide6.QtWidgets',
    'PySide6.QtWebEngineWidgets',
    'PySide6.QtWebEngineCore',
    'aiohttp',
    'requests',
    'psutil',
    'netifaces',
    'PIL',
    'cv2',
    'numpy',
    'adb_shell',
    'av',
    'sqlalchemy',
    'pystray',
]

a = Analysis(
    [r'{path_to_spec_string(main_entry)}'],
    pathex=[r'{path_to_spec_string(self.project_root)}'],
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
    icon=r'{path_to_spec_string(icon_file)}' if {icon_file.exists()} else None,
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
        """Run PyInstaller with generated spec file - output everything in real-time"""
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

        # Run PyInstaller with direct real-time output
        cmd = [
            sys.executable,
            "-m", "PyInstaller",
            str(self.spec_file),
            "--clean",
            "--noconfirm"
        ]

        ColorPrint.blue(f"Executing: {' '.join(cmd)}")
        ColorPrint.blue("=" * 70)

        # Use subprocess.Popen for real-time output
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )

        # Print all output in real-time
        for line in process.stdout:
            print(line, end='')

        process.wait()

        ColorPrint.blue("=" * 70)
        ColorPrint.blue("PyInstaller process completed, checking results...")

        # Check results by verifying output files exist
        output_exe = self.dist_dir / "Matrix" / "Matrix.exe"

        if output_exe.exists():
            ColorPrint.green("=" * 70)
            ColorPrint.green("✓ BUILD SUCCESSFUL!")
            ColorPrint.green("=" * 70)
            ColorPrint.green(f"Output directory: {self.dist_dir}")
            ColorPrint.green(f"Executable: {output_exe}")
            ColorPrint.green(f"File size: {output_exe.stat().st_size / (1024*1024):.2f} MB")
            ColorPrint.blue("")
            ColorPrint.blue("Usage Instructions:")
            ColorPrint.blue(f"  Method 1: Run directly with argument")
            ColorPrint.blue(f"    {output_exe} app=matrix")
            ColorPrint.blue(f"  Method 2: Use launcher script")
            ColorPrint.blue(f"    {self.app_root / 'scripts' / 'run_matrix.bat'}")
            ColorPrint.blue("=" * 70)
            return True
        else:
            ColorPrint.red("=" * 70)
            ColorPrint.red("✗ BUILD FAILED!")
            ColorPrint.red("=" * 70)
            ColorPrint.red(f"Expected executable not found: {output_exe}")
            ColorPrint.red("Check the output above for errors")
            ColorPrint.blue("=" * 70)
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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Initialize Python virtual environment for file_sync_tool
Handles PEP 668 externally-managed-environment restriction
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
VENV_DIR = SCRIPT_DIR / ".venv"
REQUIREMENTS = ["flask", "requests", "tqdm"]

def is_venv_active():
    """Check if we're already in a virtual environment"""
    return hasattr(sys, 'real_prefix') or (
        hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix
    )

def create_venv():
    """Create virtual environment"""
    if VENV_DIR.exists():
        print(f"Virtual environment already exists at: {VENV_DIR}")
        return True

    print(f"Creating virtual environment at: {VENV_DIR}")
    try:
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])
        print("Virtual environment created successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to create virtual environment: {e}")
        return False

def get_venv_python():
    """Get path to virtual environment Python executable"""
    if platform.system() == "Windows":
        return VENV_DIR / "Scripts" / "python.exe"
    else:
        return VENV_DIR / "bin" / "python"

def get_venv_pip():
    """Get path to virtual environment pip"""
    if platform.system() == "Windows":
        return VENV_DIR / "Scripts" / "pip.exe"
    else:
        return VENV_DIR / "bin" / "pip"

def install_requirements():
    """Install required packages in virtual environment"""
    pip_path = get_venv_pip()

    if not pip_path.exists():
        print(f"pip not found at: {pip_path}")
        return False

    print("Installing required packages...")
    try:
        for package in REQUIREMENTS:
            print(f"Installing {package}...")
            subprocess.check_call([
                str(pip_path),
                "install",
                package
            ])
        print("All packages installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to install packages: {e}")
        return False

def create_activation_script():
    """Create convenience activation script"""
    if platform.system() == "Windows":
        script_path = SCRIPT_DIR / "activate.ps1"
        content = f"""# Activate virtual environment
$venvPath = "{VENV_DIR.resolve()}"
& "$venvPath\\Scripts\\Activate.ps1"
Write-Host "Virtual environment activated. Run: python file_sync_tool.py" -ForegroundColor Green
"""
        script_path.write_text(content, encoding='utf-8')
        print(f"Created activation script: {script_path}")

        bat_path = SCRIPT_DIR / "activate.bat"
        bat_content = f"""@echo off
call "{VENV_DIR.resolve()}\\Scripts\\activate.bat"
echo Virtual environment activated. Run: python file_sync_tool.py
"""
        bat_path.write_text(bat_content, encoding='utf-8')
        print(f"Created batch activation script: {bat_path}")
    else:
        script_path = SCRIPT_DIR / "activate.sh"
        content = f"""#!/bin/bash
source "{VENV_DIR.resolve()}/bin/activate"
echo "Virtual environment activated. Run: python file_sync_tool.py"
"""
        script_path.write_text(content, encoding='utf-8')
        script_path.chmod(0o755)
        print(f"Created activation script: {script_path}")

def create_run_script():
    """Create convenience run script"""
    if platform.system() == "Windows":
        script_path = SCRIPT_DIR / "run_server.ps1"
        venv_python = get_venv_python().resolve()
        content = f"""# Run file_sync_tool.py in virtual environment
$ErrorActionPreference = "Stop"

$venvPython = "{venv_python}"
$scriptPath = Join-Path $PSScriptRoot "file_sync_tool.py"

if (-not (Test-Path $venvPython)) {{
    Write-Host "Virtual environment not found. Run init_env.py first." -ForegroundColor Red
    exit 1
}}

Write-Host "Starting File Sync Tool Server..." -ForegroundColor Green
& $venvPython $scriptPath server @args
"""
        script_path.write_text(content, encoding='utf-8')
        print(f"Created run script: {script_path}")

        bat_path = SCRIPT_DIR / "run_server.bat"
        bat_content = f"""@echo off
"{venv_python.resolve()}" "%~dp0file_sync_tool.py" server %*
"""
        bat_path.write_text(bat_content, encoding='utf-8')
        print(f"Created batch run script: {bat_path}")
    else:
        script_path = SCRIPT_DIR / "run_server.sh"
        venv_python = get_venv_python().resolve()
        content = f"""#!/bin/bash
VENV_PYTHON="{venv_python}"
SCRIPT_PATH="$(dirname "$0")/file_sync_tool.py"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Virtual environment not found. Run init_env.py first."
    exit 1
fi

echo "Starting File Sync Tool Server..."
"$VENV_PYTHON" "$SCRIPT_PATH" server "$@"
"""
        script_path.write_text(content, encoding='utf-8')
        script_path.chmod(0o755)
        print(f"Created run script: {script_path}")

def verify_installation():
    """Verify that all packages are installed correctly"""
    venv_python = get_venv_python()

    if not venv_python.exists():
        print(f"Virtual environment Python not found: {venv_python}")
        return False

    print("\nVerifying installation...")
    for package in REQUIREMENTS:
        try:
            result = subprocess.run(
                [str(venv_python), "-c", f"import {package}"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                print(f"✓ {package} is installed")
            else:
                print(f"✗ {package} is NOT installed")
                return False
        except Exception as e:
            print(f"✗ Failed to verify {package}: {e}")
            return False

    print("\nAll packages verified successfully!")
    return True

def main():
    """Main initialization process"""
    print("=" * 70)
    print("File Sync Tool - Environment Initialization")
    print("=" * 70)
    print(f"Script directory: {SCRIPT_DIR}")
    print(f"Virtual environment: {VENV_DIR}")
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.system()}")
    print("=" * 70)

    if is_venv_active():
        print("\nAlready running in a virtual environment!")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Aborted.")
            return

    print("\nStep 1: Creating virtual environment...")
    if not create_venv():
        print("\nInitialization failed at step 1.")
        return

    print("\nStep 2: Installing required packages...")
    if not install_requirements():
        print("\nInitialization failed at step 2.")
        return

    print("\nStep 3: Verifying installation...")
    if not verify_installation():
        print("\nInitialization failed at step 3.")
        return

    print("\nStep 4: Creating convenience scripts...")
    create_activation_script()
    create_run_script()

    print("\n" + "=" * 70)
    print("Initialization completed successfully!")
    print("=" * 70)
    print("\nNext steps:")

    if platform.system() == "Windows":
        print("\nOption 1 - Use convenience script:")
        print("  .\\run_server.ps1")
        print("\nOption 2 - Activate and run manually:")
        print("  .\\activate.ps1")
        print("  python file_sync_tool.py server")
    else:
        print("\nOption 1 - Use convenience script:")
        print("  ./run_server.sh")
        print("\nOption 2 - Activate and run manually:")
        print("  source ./activate.sh")
        print("  python file_sync_tool.py server")

    print("\n" + "=" * 70)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInitialization cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

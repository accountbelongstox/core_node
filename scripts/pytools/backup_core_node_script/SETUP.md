# File Sync Tool - Setup Guide

## Problem: externally-managed-environment

Starting with Python 3.11+, some Linux distributions (Debian/Ubuntu) implement PEP 668, which prevents installing packages directly to system Python using pip. This is to protect the system from conflicts.

## Solution: Virtual Environment

This tool now uses a Python virtual environment to isolate dependencies.

---

## Quick Start

### 1. Initialize (First Time Only)

Run the initialization script to create a virtual environment and install dependencies:

```bash
# On Linux/Mac
python3 init_env.py

# On Windows
python init_env.py
```

This will:
- Create a `.venv` directory with isolated Python environment
- Install required packages (flask, requests, tqdm)
- Generate convenience scripts for easy running

### 2. Run the Server

After initialization, use one of these methods:

#### Method 1: Convenience Script (Recommended)

**Linux/Mac:**
```bash
./run_server.sh
```

**Windows PowerShell:**
```powershell
.\run_server.ps1
```

**Windows Command Prompt:**
```cmd
run_server.bat
```

#### Method 2: Manual Activation

**Linux/Mac:**
```bash
source activate.sh
python file_sync_tool.py server
```

**Windows PowerShell:**
```powershell
.\activate.ps1
python file_sync_tool.py server
```

**Windows Command Prompt:**
```cmd
activate.bat
python file_sync_tool.py server
```

---

## Common Issues

### Issue: Permission Denied (Linux)

If you get permission errors on Linux:

```bash
chmod +x init_env.py
chmod +x run_server.sh
chmod +x activate.sh
```

### Issue: PowerShell Execution Policy (Windows)

If PowerShell scripts are blocked:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use the batch file instead:
```cmd
run_server.bat
```

### Issue: python3-venv not installed (Debian/Ubuntu)

If you get an error about missing `venv` module:

```bash
sudo apt-get update
sudo apt-get install python3-venv python3-full
```

### Issue: Virtual Environment Already Exists

If you want to recreate the environment:

```bash
# Remove existing environment
rm -rf .venv

# Re-run initialization
python3 init_env.py
```

---

## Server Configuration

Edit the `Config` class in `file_sync_tool.py`:

```python
class Config:
    SERVER_ROOT = "/www/wwwroot"        # Linux server root
    CLIENT_ROOT = r"D:\www\wwwroot"     # Windows client root
    EXCLUDE_DIRS = ["core_node"]        # Directories to exclude
    DEFAULT_PORT = 8888                 # Server port
```

---

## Usage Examples

### Start Server (Linux Server)

```bash
cd /www/wwwroot/core_node/scripts/pytools/backup_core_node_script
python3 init_env.py  # First time only
./run_server.sh
```

Server will start at: http://server_ip:8888

### Run Client (Windows)

```powershell
cd D:\programing\core_node\scripts\pytools\backup_core_node_script
python init_env.py  # First time only
.\run_server.ps1 client --server http://server_ip:8888
```

---

## Manual Installation (Alternative)

If you prefer to use system Python (not recommended):

### On Systems Allowing System Packages

```bash
pip install --user flask requests tqdm
python file_sync_tool.py server
```

### With --break-system-packages (Not Recommended)

```bash
pip install --break-system-packages flask requests tqdm
python file_sync_tool.py server
```

**Warning:** This can break your system Python. Use virtual environment instead.

---

## File Structure After Setup

```
backup_core_node_script/
├── file_sync_tool.py        # Main script
├── init_env.py               # Environment initializer
├── .venv/                    # Virtual environment (created)
├── activate.sh               # Linux activation script (created)
├── activate.ps1              # Windows activation script (created)
├── activate.bat              # Windows batch activation (created)
├── run_server.sh             # Linux run script (created)
├── run_server.ps1            # Windows run script (created)
├── run_server.bat            # Windows batch run script (created)
└── SETUP.md                  # This file
```

---

## Verification

After initialization, verify the setup:

```bash
# Activate virtual environment
source activate.sh  # Linux/Mac
.\activate.ps1      # Windows

# Check Python
which python        # Should show .venv/bin/python
python --version

# Check packages
pip list | grep flask
pip list | grep requests
pip list | grep tqdm
```

---

## Troubleshooting

### 1. Check Python Version

```bash
python --version  # Should be 3.7+
```

### 2. Check Virtual Environment

```bash
ls -la .venv/  # Should exist with bin/ or Scripts/ directory
```

### 3. Reinstall Dependencies

```bash
source activate.sh  # or .\activate.ps1
pip install --upgrade flask requests tqdm
```

### 4. Clean Start

```bash
rm -rf .venv
python3 init_env.py
```

---

## Why Virtual Environment?

### Benefits:
✅ Isolated dependencies (no system conflicts)
✅ Different Python versions per project
✅ Easy to recreate/share environment
✅ Compliant with PEP 668
✅ Safe and recommended approach

### Without Virtual Environment:
❌ Can break system Python
❌ Package conflicts
❌ Hard to manage dependencies
❌ Violates PEP 668 on modern systems

---

## Support

If you encounter issues:

1. Ensure Python 3.7+ is installed: `python3 --version`
2. On Debian/Ubuntu, install venv: `sudo apt install python3-venv python3-full`
3. Delete `.venv` and re-run `init_env.py`
4. Check error messages in terminal output

---

## References

- [PEP 668 - Marking Python base environments as "externally managed"](https://peps.python.org/pep-0668/)
- [Python venv documentation](https://docs.python.org/3/library/venv.html)
- [Python Virtual Environments Guide](https://realpython.com/python-virtual-environments-a-primer/)

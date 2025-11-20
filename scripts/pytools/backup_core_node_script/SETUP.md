# File Sync Tool - Setup Guide

## ⚡ TL;DR - Zero Setup Required

```bash
# Just run it - everything is automatic!
./quick_start.sh           # Linux
.\quick_start.ps1          # Windows

# Or directly:
python3 file_sync_tool.py server    # Linux
python file_sync_tool.py server     # Windows
```

The tool automatically handles:
- Virtual environment creation
- Dependency installation
- Server startup

**No manual setup needed!**

---

## Problem: externally-managed-environment

Starting with Python 3.11+, some Linux distributions (Debian/Ubuntu) implement PEP 668, which prevents installing packages directly to system Python using pip. This is to protect the system from conflicts.

## Solution: Auto-Initialization

This tool now **automatically creates and manages** a Python virtual environment when you first run it.

---

## How It Works

### First Run
1. You run: `./quick_start.sh` or `python3 file_sync_tool.py server`
2. Tool detects no virtual environment exists
3. Creates `.venv` directory automatically
4. Installs client dependencies (requests, tqdm) in venv
5. Restarts itself in the virtual environment
6. Starts the server

### Subsequent Runs
1. You run: `./quick_start.sh` or `python3 file_sync_tool.py server`
2. Tool detects venv exists
3. Runs directly in venv
4. Starts the server immediately

**Total setup time: ~10 seconds on first run, instant on subsequent runs.**

---

## Architecture

### Server (Zero External Dependencies)
The server uses **ONLY Python standard library**:
- `http.server` - HTTP server
- `json` - JSON responses
- `os`, `sys`, `pathlib` - File operations
- `hashlib` - MD5 checksums
- `threading` - Concurrent handling

**Benefits:**
- ✅ No pip install needed on server
- ✅ Works on any Python 3.7+ installation
- ✅ No dependency conflicts
- ✅ Fast startup, small footprint
- ✅ One file deployment

### Client (Auto-Installed Dependencies)
The client needs external packages:
- `requests` - HTTP client
- `tqdm` - Progress bars

**Auto-Installation:**
- Only installed when running client mode
- Installed in isolated virtual environment
- Never touches system Python

---

## Manual Usage (If You Want Control)

### Server Mode

```bash
# Basic
python3 file_sync_tool.py server

# Custom port
python3 file_sync_tool.py server --port 9999
```

### Client Mode

```bash
# Download from server
python3 file_sync_tool.py client --server http://192.168.1.100:8888
```

---

## Configuration

Edit `file_sync_tool.py` to customize:

```python
class Config:
    SERVER_ROOT = "/www/wwwroot"        # Linux server root
    CLIENT_ROOT = r"D:\www\wwwroot"     # Windows client root
    EXCLUDE_DIRS = ["core_node"]        # Directories to exclude
    DEFAULT_PORT = 8888                 # Server port
    MAX_CONCURRENT_DOWNLOADS = 20       # Download threads
```

---

## Common Issues

### Issue: Permission Denied (Linux)

Make scripts executable:

```bash
chmod +x quick_start.sh
```

### Issue: PowerShell Execution Policy (Windows)

Allow script execution:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or just run directly:

```powershell
python file_sync_tool.py server
```

### Issue: python3-venv not installed (Debian/Ubuntu)

Install venv module:

```bash
sudo apt-get update
sudo apt-get install python3-venv python3-full
```

### Issue: Want to Start Fresh

Delete virtual environment and restart:

```bash
rm -rf .venv
python3 file_sync_tool.py server
```

The venv will be recreated automatically.

---

## File Structure

```
backup_core_node_script/
├── file_sync_tool.py        # Main application
│   ├── Auto-init logic      # Checks and creates venv
│   ├── Server (native)      # http.server based
│   └── Client (requests)    # With auto-installed deps
├── quick_start.sh            # Simple launcher (Linux)
├── quick_start.ps1           # Simple launcher (Windows)
├── .venv/                    # Auto-created virtual env
│   ├── bin/python (Linux)
│   └── Scripts/python.exe (Windows)
├── README_FILE_SYNC.md       # User guide
└── SETUP.md                  # This file
```

**Note:** No separate `init_env.py`, `run_server.sh`, or `activate.sh` scripts needed!

---

## Usage Examples

### Start Server on Linux

```bash
cd /www/wwwroot/core_node/scripts/pytools/backup_core_node_script
./quick_start.sh
```

Server starts at: `http://server_ip:8888`

### Download Files on Windows

```powershell
cd D:\programing\core_node\scripts\pytools\backup_core_node_script
python file_sync_tool.py client --server http://server_ip:8888
```

---

## Verification

After first run, check the virtual environment:

```bash
# Check venv exists
ls -la .venv/

# Check Python location
.venv/bin/python --version    # Linux
.venv\Scripts\python.exe --version    # Windows
```

---

## Why This Architecture?

### 1. PEP 668 Compliance
✅ Uses virtual environment to comply with modern Python standards
✅ No system Python modifications
✅ Safe and isolated

### 2. Zero Server Dependencies
✅ Server uses only standard library
✅ No pip install needed on server
✅ Works on any Python 3.7+ installation
✅ No dependency hell

### 3. Auto-Initialization
✅ No manual setup steps
✅ Just run and go
✅ Handles everything automatically

### 4. Client Dependencies Isolated
✅ Client needs requests and tqdm
✅ Auto-installed in venv on first client run
✅ Never affects system Python

---

## Troubleshooting

### 1. Check Python Version

```bash
python3 --version  # Should be 3.7+
```

### 2. Check Virtual Environment

```bash
ls -la .venv/  # Should exist with bin/ or Scripts/
```

### 3. Manual venv Recreation

```bash
rm -rf .venv
python3 file_sync_tool.py server
```

### 4. Check Permissions (Linux)

```bash
ls -l quick_start.sh  # Should be executable
chmod +x quick_start.sh  # Make executable
```

---

## Advanced: Manual Virtual Environment

If you want to create venv manually:

```bash
# Create venv
python3 -m venv .venv

# Activate (Linux)
source .venv/bin/activate

# Activate (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install client dependencies (optional, for client mode)
pip install requests tqdm

# Run server
python file_sync_tool.py server

# Run client
python file_sync_tool.py client --server http://192.168.1.100:8888
```

**But this is unnecessary** - the tool does all this automatically!

---

## Comparison: Old vs New

### Old Approach (Complex)
```bash
# Step 1: Initialize
python3 init_env.py

# Step 2: Activate
source activate.sh

# Step 3: Run
python file_sync_tool.py server
```

### New Approach (Simple)
```bash
# One step - everything automatic!
./quick_start.sh
```

---

## Support

If you encounter issues:

1. Ensure Python 3.7+ is installed: `python3 --version`
2. On Debian/Ubuntu, install venv: `sudo apt install python3-venv python3-full`
3. Delete `.venv` and rerun: `rm -rf .venv && python3 file_sync_tool.py server`
4. Check error messages in terminal output

---

## References

- [PEP 668](https://peps.python.org/pep-0668/) - Why virtual environment is needed
- [Python venv](https://docs.python.org/3/library/venv.html) - Official documentation
- [Python http.server](https://docs.python.org/3/library/http.server.html) - Native HTTP server

---

**Remember**: You don't need to do anything manually. Just run `./quick_start.sh` and the tool handles everything! 🚀

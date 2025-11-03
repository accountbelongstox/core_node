# File Sync Tool

A powerful file synchronization tool with web interface for browsing and batch downloading files between Linux server and Windows client.

## ⚠️ Important Notice

Starting with Python 3.11+, many Linux distributions implement PEP 668, preventing direct pip installations to system Python. This tool uses **virtual environment** to solve this issue.

## 🚀 Quick Start

### One-Step Launch (Recommended)

**Windows:**
```powershell
.\quick_start.ps1
```

**Linux:**
```bash
chmod +x quick_start.sh
./quick_start.sh
```

This will automatically:
1. Check if virtual environment exists
2. Initialize if needed (first time only)
3. Start the server

## 📋 Manual Setup

If you prefer to set up manually:

### Step 1: Initialize (First Time Only)

```bash
# Linux
python3 init_env.py

# Windows
python init_env.py
```

### Step 2: Run Server

Choose one of these methods:

**Method 1: Convenience Scripts**
```bash
# Linux
./run_server.sh

# Windows
.\run_server.ps1
```

**Method 2: Manual Activation**
```bash
# Linux
source activate.sh
python file_sync_tool.py server

# Windows
.\activate.ps1
python file_sync_tool.py server
```

## 💡 Features

- 🌐 Web-based file browser interface
- 📦 Batch file download with progress tracking
- 🔄 Concurrent downloads (20 threads)
- ✅ File integrity verification (MD5 hash)
- 🔁 Resume capability for interrupted downloads
- 📊 Real-time progress tracking
- 🚫 Directory exclusion support
- 🔒 Safe and isolated environment (virtual env)

## 📁 File Structure

After initialization:

```
backup_core_node_script/
├── file_sync_tool.py        # Main application
├── init_env.py               # Environment initializer
├── quick_start.sh            # One-step launcher (Linux)
├── quick_start.ps1           # One-step launcher (Windows)
├── .venv/                    # Virtual environment (auto-created)
├── activate.sh               # Activation script (Linux)
├── activate.ps1              # Activation script (Windows)
├── run_server.sh             # Run script (Linux)
├── run_server.ps1            # Run script (Windows)
├── SETUP.md                  # Detailed setup guide
└── README_FILE_SYNC.md       # This file
```

## ⚙️ Configuration

Edit `file_sync_tool.py` to customize settings:

```python
class Config:
    SERVER_ROOT = "/www/wwwroot"        # Linux server directory
    CLIENT_ROOT = r"D:\www\wwwroot"     # Windows client directory
    EXCLUDE_DIRS = ["core_node"]        # Skip these directories
    DEFAULT_PORT = 8888                 # Server port
    MAX_CONCURRENT_DOWNLOADS = 20       # Download threads
```

## 🔧 Usage Examples

### Start Server (Linux)

```bash
cd /www/wwwroot/core_node/scripts/pytools/backup_core_node_script
./quick_start.sh
```

Access web interface: `http://server_ip:8888`

### Run Client (Windows)

```powershell
cd D:\programing\core_node\scripts\pytools\backup_core_node_script
.\quick_start.ps1 client --server http://server_ip:8888
```

### Custom Port

```bash
./quick_start.sh --port 9999
```

### Download Specific Directory

```powershell
.\quick_start.ps1 client --server http://server_ip:8888 --path /specific/path
```

## 🐛 Troubleshooting

### Error: externally-managed-environment

**Problem:** Can't install packages to system Python.

**Solution:** Use our initialization script - it creates a virtual environment automatically.

```bash
python3 init_env.py
```

### Error: python3-venv not found (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install python3-venv python3-full
```

### PowerShell Script Blocked (Windows)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Permission Denied (Linux)

```bash
chmod +x quick_start.sh
chmod +x run_server.sh
chmod +x activate.sh
```

### Clean Reinstall

```bash
rm -rf .venv
python3 init_env.py
```

## 📖 Detailed Documentation

See [SETUP.md](SETUP.md) for detailed setup instructions, troubleshooting, and manual installation methods.

## ✅ System Requirements

- Python 3.7 or higher
- Linux: python3-venv, python3-full (Ubuntu/Debian)
- Windows: Python 3.7+ from python.org
- Network access between server and client

## 🔐 Security Notes

- Server binds to all interfaces (0.0.0.0)
- No authentication by default (add reverse proxy if needed)
- Only serves files from configured root directory
- Respects exclude directory settings

## 📊 Performance

- Concurrent downloads: 20 threads (configurable)
- Chunk size: 8KB (configurable)
- Retry attempts: 3 (configurable)
- Supports large file transfers with progress tracking

## 🤝 Contributing

1. Follow AI SPECIAL ATTENTION RULES in file headers
2. Use virtual environment for development
3. Test on both Linux and Windows
4. Maintain backward compatibility

## 📝 License

MIT License - See project root for details

## 🆘 Support

If you encounter issues:

1. Check Python version: `python --version` (should be 3.7+)
2. Try clean reinstall: `rm -rf .venv && python3 init_env.py`
3. Read detailed guide: [SETUP.md](SETUP.md)
4. Check error messages in terminal output

## 🚦 Status Indicators

| Status | Meaning |
|--------|---------|
| ✅ | Feature implemented and working |
| 🔄 | In progress or requires attention |
| ❌ | Not implemented or error |

## 📚 References

- [PEP 668](https://peps.python.org/pep-0668/) - Why virtual environment is needed
- [Python venv](https://docs.python.org/3/library/venv.html) - Official documentation
- [Virtual Environments Guide](https://realpython.com/python-virtual-environments-a-primer/)

---

**Quick Start**: Just run `./quick_start.sh` (Linux) or `.\quick_start.ps1` (Windows) and you're good to go! 🚀

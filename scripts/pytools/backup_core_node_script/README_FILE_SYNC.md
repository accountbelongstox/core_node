# File Sync Tool

A powerful file synchronization tool with web interface for browsing and batch downloading files between Linux server and Windows client.

## ⚡ One-Step Quick Start (Recommended)

**No setup needed!** The tool auto-initializes virtual environment on first run.

**Linux:**
```bash
./quick_start.sh
```

**Windows:**
```powershell
.\quick_start.ps1
```

**Or run directly:**
```bash
# Linux
python3 file_sync_tool.py server

# Windows
python file_sync_tool.py server
```

On first run, the tool will:
1. Automatically create virtual environment (.venv)
2. Install required dependencies (requests, tqdm)
3. Restart in virtual environment
4. Start the server

## 💡 Key Features

- ✅ **Zero-dependency server** - Uses only Python standard library
- 🔄 **Auto-initialization** - Virtual environment setup on first run
- 🌐 Web-based file browser interface
- 📦 Batch file download with progress tracking
- 🔄 Concurrent downloads (20 threads)
- ✅ File integrity verification (MD5 hash)
- 🔁 Resume capability for interrupted downloads
- 📊 Real-time progress tracking
- 🚫 Directory exclusion support
- 🔒 Safe and isolated environment (virtual env)

## 📋 Architecture

- **Server**: Python native `http.server` (no Flask, no external dependencies)
- **Client**: Uses `requests` and `tqdm` (auto-installed in venv)
- **Virtual Environment**: Auto-created using Python's built-in `venv` module

## 🚀 Usage

### Start Server (Linux)

```bash
cd /www/wwwroot/core_node/scripts/pytools/backup_core_node_script
./quick_start.sh
```

Access web interface: `http://server_ip:8888`

### Run Client (Windows)

```powershell
cd D:\programing\core_node\scripts\pytools\backup_core_node_script
python file_sync_tool.py client --server http://server_ip:8888
```

### Custom Port

```bash
./quick_start.sh --port 9999
```

Or:

```bash
python3 file_sync_tool.py server --port 9999
```

### Download Specific Path

```powershell
python file_sync_tool.py client --server http://server_ip:8888
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

## 📁 File Structure

After first run:

```
backup_core_node_script/
├── file_sync_tool.py        # Main application (auto-init + server + client)
├── quick_start.sh            # One-line launcher (Linux)
├── quick_start.ps1           # One-line launcher (Windows)
├── .venv/                    # Virtual environment (auto-created)
├── README_FILE_SYNC.md       # This file
└── SETUP.md                  # Detailed setup guide
```

## 🔧 Command Line Interface

**Server mode:**
```bash
python file_sync_tool.py server [--port PORT]
```

**Client mode:**
```bash
python file_sync_tool.py client --server SERVER_URL
```

## 🐛 Troubleshooting

### Error: externally-managed-environment

**No action needed!** The tool handles this automatically by creating a virtual environment.

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
```

### Clean Reinstall

```bash
rm -rf .venv
python3 file_sync_tool.py server
```

The virtual environment will be recreated automatically.

## 📊 Performance

- Concurrent downloads: 20 threads (configurable)
- Chunk size: 8KB (configurable)
- Retry attempts: 3 (configurable)
- Supports large file transfers with progress tracking
- Range request support for resume capability

## 🔐 Security Notes

- Server binds to all interfaces (0.0.0.0)
- No authentication by default (add reverse proxy if needed)
- Only serves files from configured root directory
- Respects exclude directory settings

## ✅ System Requirements

- Python 3.7 or higher
- Linux: python3-venv (Ubuntu/Debian)
- Windows: Python 3.7+ from python.org
- Network access between server and client

## 🎯 Why This Architecture?

### PEP 668 Compliance
Starting with Python 3.11+, many Linux distributions implement PEP 668, preventing direct pip installations to system Python. This tool uses **virtual environment** to solve this issue automatically.

### Zero Server Dependencies
The server uses only Python standard library (`http.server`, `json`, `os`, etc.), meaning:
- ✅ No pip install needed on server
- ✅ Works on any Python 3.7+ installation
- ✅ No external packages to maintain
- ✅ Faster startup, smaller footprint

### Client Dependencies Auto-Installed
The client needs `requests` and `tqdm`, which are:
- ✅ Auto-installed in virtual environment
- ✅ Isolated from system Python
- ✅ Only installed when running client mode

## 🤝 Contributing

1. Follow AI SPECIAL ATTENTION RULES in file headers
2. Server functionality must use ONLY Python standard library
3. Client dependencies go in venv (auto-managed)
4. Test on both Linux and Windows
5. Maintain backward compatibility

## 📝 License

MIT License - See project root for details

## 🆘 Support

If you encounter issues:

1. Check Python version: `python --version` (should be 3.7+)
2. Try clean reinstall: `rm -rf .venv && python3 file_sync_tool.py server`
3. Read detailed guide: [SETUP.md](SETUP.md)
4. Check error messages in terminal output

## 📚 References

- [PEP 668](https://peps.python.org/pep-0668/) - Why virtual environment is needed
- [Python venv](https://docs.python.org/3/library/venv.html) - Official documentation
- [Python http.server](https://docs.python.org/3/library/http.server.html) - Native HTTP server

---

**Quick Start**: Just run `./quick_start.sh` (Linux) or `.\quick_start.ps1` (Windows) and you're good to go! 🚀

The tool handles all setup automatically - no manual steps needed!

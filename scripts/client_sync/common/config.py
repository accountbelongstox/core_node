"""
Common Configuration for File Sync Server and Client

This module provides shared configuration constants used by both
server and client components of the file sync system.
"""

# Network Configuration
SYNC_PORT = 8888

# File Sync Configuration
IGNORE_DIRS = {"node_modules", "__pycache__", ".git", ".svn", ".hg"}
IGNORE_EXTENSIONS = {".pyc", ".pyo", ".pyd", ".so", ".dll", ".exe", ".obj", ".o", ".a", ".lib"}
IGNORE_FILES = {".DS_Store", "Thumbs.db", "desktop.ini"}

# Sync Behavior
SYNC_INTERVAL = 10
CLIENT_RESCAN_INTERVAL = 30
SCAN_TIMEOUT = 0.5
MAX_SCAN_THREADS = 50

# File Transfer
CHUNK_SIZE = 8192
SOCKET_TIMEOUT = 60
FILE_TRANSFER_TIMEOUT = 300
MAX_RETRIES = 3
RETRY_DELAY = 1


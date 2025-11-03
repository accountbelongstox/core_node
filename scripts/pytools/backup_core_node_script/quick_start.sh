#!/bin/bash
# Quick Start Script for File Sync Tool
# Auto-initializes venv and runs the server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Simply run the tool - it handles venv initialization automatically
python3 file_sync_tool.py server "$@"

#!/usr/bin/env python3
"""
Flutter Source Viewer - Enhanced Independent Web Server Entry Point
Comprehensive resource scanner and viewer for Flutter projects with tree view
"""

import sys
from pathlib import Path

# Import using relative path from build_scripts root
from utils.source_viewer_server import SourceViewerServer

def main():
    """Main entry point - single line calling the class library"""
    print("[ENHANCED-SOURCE-VIEWER] Flutter Source Viewer - Tree View & File Explorer")
    print("[INFO] Features: Images, All Files, Package IDs")
    print("[INFO] Views: Table View & Tree View for easy navigation")
    print("[INFO] Actions: Download, Open Directory (Windows Explorer), Copy Path")
    print(f"[INFO] Scanning directory: {Path.cwd()}")
    print("[INFO] Server starting on http://localhost:8081")
    SourceViewerServer(port=8081, project_root=Path.cwd()).run_standalone()

if __name__ == "__main__":
    main()

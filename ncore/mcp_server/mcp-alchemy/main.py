#!/usr/bin/env python3
"""
MCP Alchemy - Enhanced Database Operations MCP Server
Entry point wrapper for direct execution

This file serves as a simple entry point when running `python main.py`.
All core functionality is in mcp_alchemy/server.py for modularity.
"""

import os
import sys
from pathlib import Path

# Path handling according to project standards
SERVICE_ROOT = Path(__file__).parent.absolute()
PROJECT_ROOT = SERVICE_ROOT.parent.parent.parent

# Add service to Python path
sys.path.insert(0, str(SERVICE_ROOT))

# Set environment variables for service configuration (paths are derived, not set)
# SERVICE_ROOT and PYTHONPATH are automatically derived from file location

def main():
    """Main entry wrapper - delegates to server.py which contains all infrastructure"""
    try:
        print(f"[MCP Alchemy] Starting from main.py wrapper...")
        print(f"[MCP Alchemy] Service Root: {SERVICE_ROOT}")
        print(f"[MCP Alchemy] Project Root: {PROJECT_ROOT}")

        # Import and run the actual server (contains SessionManager, SharedService, etc.)
        from mcp_alchemy.server import main as server_main
        server_main()

    except KeyboardInterrupt:
        print("\n[MCP Alchemy] Received shutdown signal")
    except Exception as e:
        print(f"[MCP Alchemy] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

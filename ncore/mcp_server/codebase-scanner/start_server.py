#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Codebase Scanner MCP Server Startup Script
Starts the MCP server with proper error handling and logging
"""

import sys
import os
from pathlib import Path

# Add current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def main():
    """Main startup function"""
    try:
        print("Starting Codebase Scanner MCP Server...")
        print(f"Working directory: {current_dir}")
        print(f"Python version: {sys.version}")
        
        # Import and run the main module
        from main import mcp, logger
        
        if mcp is None:
            print("ERROR: MCP server not initialized")
            return 1
        
        if logger:
            logger.info("Starting MCP server from startup script")
        
        print("MCP server starting...")
        mcp.run()
        
    except KeyboardInterrupt:
        print("\nServer stopped by user")
        return 0
    except Exception as e:
        print(f"ERROR: Failed to start server: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

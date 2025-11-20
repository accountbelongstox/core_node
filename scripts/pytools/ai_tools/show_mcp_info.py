#!/usr/bin/env python3

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ai_tools_common import get_user_home_directory

def show_mcp_info():
    user_home = get_user_home_directory()
    
    print("=" * 80)
    print("MCP Configuration Information")
    print("=" * 80)
    print()
    
    print(f"User Home: {user_home}")
    print()
    
    print("Current .claude.json is ACTIVE and used by Claude Code by default: Y")
    print()
    
    claude_config = user_home / ".claude.json"
    claude_dir = user_home / ".claude"
    droid_config = user_home / ".factory" / "mcp.json"
    
    configs = [
        ("Claude Config", claude_config),
        ("Claude Directory", claude_dir),
        ("Factory Droid Config", droid_config),
    ]
    
    for name, path in configs:
        print("-" * 80)
        print(f"{name}: {path}")
        print("-" * 80)
        
        if path.exists():
            if path.is_file():
                print(f"Status: EXISTS (file)")
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if "mcpServers" in data:
                        servers = data["mcpServers"]
                        print(f"MCP Servers: {len(servers)}")
                        for server_name in sorted(servers.keys()):
                            print(f"  - {server_name}")
                    else:
                        print("MCP Servers: None found")
                    
                    print()
                    print("Full JSON:")
                    print(json.dumps(data, indent=2))
                except Exception as e:
                    print(f"Error reading file: {e}")
            elif path.is_dir():
                print(f"Status: EXISTS (directory)")
                try:
                    items = list(path.iterdir())
                    print(f"Contents: {len(items)} items")
                    for item in sorted(items):
                        item_type = "DIR" if item.is_dir() else "FILE"
                        print(f"  [{item_type}] {item.name}")
                except Exception as e:
                    print(f"Error listing directory: {e}")
        else:
            print("Status: NOT FOUND")
        
        print()

if __name__ == "__main__":
    show_mcp_info()

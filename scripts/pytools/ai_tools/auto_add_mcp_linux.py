#!/usr/bin/env python3

import os
import sys
import subprocess
import json
import toml
from pathlib import Path
from typing import Dict, Any

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
MCP_TEMPLATES_DIR = SCRIPT_DIR / "mcp_templates"
PROMPT_DIR = PROJECT_ROOT / "_prompt"

sys.path.insert(0, str(SCRIPT_DIR))
from ai_tools_common import get_user_home_directory

def get_context7_api_key() -> str:
    """Get Context7 API key from environment or user input."""
    api_key = os.environ.get("CONTEXT7_API_KEY")
    if api_key:
        print(f"[INFO] Using CONTEXT7_API_KEY from environment")
        return api_key
    
    print("[WARNING] CONTEXT7_API_KEY not found in environment")
    user_input = input("Enter CONTEXT7_API_KEY (or press Enter to skip): ").strip()
    return user_input if user_input else "YOUR_API_KEY"

def replace_placeholders_in_content(content: str, project_root: str, api_key: str = None) -> str:
    """Replace placeholders in content."""
    content = content.replace("$PROJECT_ROOT$", project_root)
    if api_key:
        content = content.replace("$CONTEXT7_API_KEY$", api_key)
    return content

def process_toml_template(template_path: Path, project_root: str) -> Dict[str, Any]:
    """Process TOML template and replace placeholders."""
    with open(template_path, 'r') as f:
        content = f.read()
    
    api_key = get_context7_api_key()
    content = replace_placeholders_in_content(content, project_root, api_key)
    
    data = toml.loads(content)
    return data

def process_json_template(template_path: Path, project_root: str) -> Dict[str, Any]:
    """Process JSON template and replace placeholders."""
    with open(template_path, 'r') as f:
        content = f.read()
    
    api_key = get_context7_api_key()
    content = replace_placeholders_in_content(content, project_root, api_key)
    
    data = json.loads(content)
    return data

def add_mcp_from_shell_templates(project_root: str) -> None:
    """Execute shell scripts from mcp_templates directory."""
    if not MCP_TEMPLATES_DIR.exists():
        print(f"[WARNING] MCP templates directory not found: {MCP_TEMPLATES_DIR}")
        return
    
    shell_files = list(MCP_TEMPLATES_DIR.glob("*.sh"))
    if not shell_files:
        print(f"[INFO] No shell templates found in {MCP_TEMPLATES_DIR}")
        return
    
    print(f"\n[INFO] Processing {len(shell_files)} shell template(s)")
    
    for shell_file in shell_files:
        print(f"\n[INFO] Processing template: {shell_file.name}")
        
        with open(shell_file, 'r') as f:
            content = f.read()
        
        api_key = get_context7_api_key() if "CONTEXT7" in shell_file.name.upper() else None
        content = replace_placeholders_in_content(content, project_root, api_key)
        
        commands = [line.strip() for line in content.split('\n') 
                   if line.strip() and not line.strip().startswith('#')]
        
        for cmd in commands:
            print(f"[EXEC] {cmd}")
            try:
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if result.returncode == 0:
                    print(f"[SUCCESS] Command executed successfully")
                    if result.stdout:
                        print(result.stdout)
                else:
                    print(f"[ERROR] Command failed with code {result.returncode}")
                    if result.stderr:
                        print(result.stderr)
            except Exception as e:
                print(f"[ERROR] Failed to execute command: {e}")

def sync_codex_toml_template(project_root: str) -> None:
    """Sync mcpCodexLinuxTemplate.toml."""
    template_path = PROMPT_DIR / "mcpCodexLinuxTemplate.toml"
    if not template_path.exists():
        print(f"[WARNING] Codex TOML template not found: {template_path}")
        return
    
    print(f"\n[INFO] Processing Codex TOML template: {template_path}")
    
    data = process_toml_template(template_path, project_root)
    
    user_home = get_user_home_directory()
    codex_config_path = user_home / ".config" / "codex" / "config.toml"
    
    print(f"[INFO] Target config: {codex_config_path}")
    
    if not codex_config_path.exists():
        print(f"[INFO] Creating new Codex config at {codex_config_path}")
        codex_config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(codex_config_path, 'w') as f:
            toml.dump(data, f)
        print(f"[SUCCESS] Created Codex config")
    else:
        print(f"[INFO] Merging with existing Codex config")
        existing_data = toml.load(codex_config_path)
        
        if "mcp_servers" not in existing_data:
            existing_data["mcp_servers"] = {}
        
        added_servers = []
        for server_name, server_config in data.get("mcp_servers", {}).items():
            if server_name not in existing_data["mcp_servers"]:
                existing_data["mcp_servers"][server_name] = server_config
                added_servers.append(server_name)
        
        if "experimental_use_rmcp_client" in data:
            existing_data["experimental_use_rmcp_client"] = data["experimental_use_rmcp_client"]
        
        with open(codex_config_path, 'w') as f:
            toml.dump(existing_data, f)
        
        if added_servers:
            print(f"[SUCCESS] Added {len(added_servers)} server(s): {', '.join(added_servers)}")
        else:
            print(f"[INFO] No new servers to add")

def sync_linux_json_template(project_root: str) -> None:
    """Sync mcpLinuxTemplate.json to Claude config."""
    template_path = PROMPT_DIR / "mcpLinuxTemplate.json"
    if not template_path.exists():
        print(f"[WARNING] Linux JSON template not found: {template_path}")
        return
    
    print(f"\n[INFO] Processing Linux JSON template: {template_path}")
    
    data = process_json_template(template_path, project_root)
    
    user_home = get_user_home_directory()
    claude_config_path = user_home / ".claude.json"
    
    print(f"[INFO] Target config: {claude_config_path}")
    
    if not claude_config_path.exists():
        print(f"[INFO] Creating new Claude config at {claude_config_path}")
        with open(claude_config_path, 'w') as f:
            json.dump(data, f, indent=4)
        print(f"[SUCCESS] Created Claude config")
    else:
        print(f"[INFO] Merging with existing Claude config")
        with open(claude_config_path, 'r') as f:
            existing_data = json.load(f)
        
        if "mcpServers" not in existing_data:
            existing_data["mcpServers"] = {}
        
        added_servers = []
        for server_name, server_config in data.get("mcpServers", {}).items():
            if server_name not in existing_data["mcpServers"]:
                existing_data["mcpServers"][server_name] = server_config
                added_servers.append(server_name)
        
        with open(claude_config_path, 'w') as f:
            json.dump(existing_data, f, indent=4)
        
        if added_servers:
            print(f"[SUCCESS] Added {len(added_servers)} server(s): {', '.join(added_servers)}")
        else:
            print(f"[INFO] No new servers to add")

def main():
    """Main entry point."""
    project_root = str(PROJECT_ROOT.resolve())
    
    print("=" * 80)
    print("MCP Auto-Add Tool for Linux")
    print("=" * 80)
    print(f"Project Root: {project_root}")
    print()
    
    add_mcp_from_shell_templates(project_root)
    
    sync_codex_toml_template(project_root)
    
    sync_linux_json_template(project_root)
    
    print("\n" + "=" * 80)
    print("[COMPLETE] MCP configuration synchronization completed")
    print("=" * 80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

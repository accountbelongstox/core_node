# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
from pathlib import Path
import fnmatch

# Configuration
SERVICE_TEMPLATE = """[Unit]
Description={description}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={working_dir}
ExecStart={exec_command}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

LOG_DIR = "/var/log/service_manager"
SERVICE_FILES_DIR = "/www/services_log"

def ensure_directories():
    """Ensure required directories exist"""
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)
    Path(SERVICE_FILES_DIR).mkdir(parents=True, exist_ok=True)

def get_exec_command(filepath):
    """Determine execution command based on file extension"""
    ext = Path(filepath).suffix.lower()
    
    if ext in ['.py']:
        return f"python3 {filepath}"
    elif ext in ['.js', '.mjs']:
        return f"node {filepath}"
    elif ext in ['.sh']:
        return f"bash {filepath}"
    elif ext in ['.pl']:
        return f"perl {filepath}"
    elif ext in ['.rb']:
        return f"ruby {filepath}"
    else:
        # Assume binary or doesn't need interpreter
        return filepath

def generate_service_name(filepath, provided_name=None):
    """Generate service name from filename if not provided"""
    if provided_name:
        return provided_name
    
    base_name = Path(filepath).stem
    service_name = base_name.replace('_', '-').replace('.', '-').lower()
    return f"custom-{service_name}"

def create_service_file(service_name, filepath):
    """Create systemd service file"""
    exec_command = get_exec_command(filepath)
    working_dir = str(Path(filepath).parent)
    description = f"Custom service for {service_name} ({filepath})"
    
    service_content = SERVICE_TEMPLATE.format(
        description=description,
        working_dir=working_dir,
        exec_command=exec_command
    )
    
    service_filename = f"/etc/systemd/system/{service_name}.service"
    
    print(f"Creating service file at {service_filename}")
    print(f"Execution command: {exec_command}")
    
    with open(service_filename, 'w') as f:
        f.write(service_content)
    
    return service_filename

def manage_service(service_name, action):
    """Start, stop or restart a service"""
    commands = {
        'enable': ['systemctl', 'enable', service_name],
        'start': ['systemctl', 'start', service_name],
        'restart': ['systemctl', 'restart', service_name],
        'stop': ['systemctl', 'stop', service_name],
        'disable': ['systemctl', 'disable', service_name]
    }
    
    for cmd_name, cmd in commands.items():
        if cmd_name in action:
            print(f"Running: {' '.join(cmd)}")
            subprocess.run(cmd, check=True)

def log_service(service_name, filepath, action):
    """Log service changes and commands to our tracking file"""
    log_file = Path(SERVICE_FILES_DIR) / "service_commands.log"
    entry = f"{action.upper()}: {service_name} -> {filepath}\n"
    if action.lower() == 'add':
        entry += (
            f"systemctl start {service_name}\n"
            f"systemctl restart {service_name}\n"
            f"systemctl status {service_name}\n"
            f"systemctl stop {service_name}\n"
            f"systemctl enable {service_name}\n"
            f"systemctl disable {service_name}\n"
        )
    with open(log_file, 'a') as f:
        f.write(entry)
    print(f"Logged service {action} to {log_file}")

def resolve_filepath(filepath):
    """Resolve the filepath according to the rules described."""
    script_dir = Path(__file__).parent.resolve()
    root_dir = script_dir.parent
    scripts_dir = root_dir / 'scripts'
    matches = []
    skip_rule = "Skip any directory whose name starts with '.' or '_' (dot or underscore)"
    print(f"Skip rule: {skip_rule}")

    def is_skip_dir(dirname):
        return dirname.startswith('.') or dirname.startswith('_')

    def search_dir(search_root):
        found = []
        for dirpath, dirnames, filenames in os.walk(search_root):
            # Remove skipped dirs in-place
            skipped = [d for d in dirnames if is_skip_dir(d)]
            if skipped:
                for d in skipped:
                    print(f"Skipping directory: {os.path.join(dirpath, d)} (matches skip rule)")
            dirnames[:] = [d for d in dirnames if not is_skip_dir(d)]
            for fname in filenames:
                if fname == filepath:
                    match_path = Path(dirpath) / fname
                    found.append(match_path)
        return found

    resolved = None
    # Absolute path
    if os.path.isabs(filepath):
        resolved = Path(filepath)
    # Contains / or \, treat as relative to root_dir
    elif '/' in filepath or '\\' in filepath:
        resolved = (root_dir / filepath).resolve()
    # Only a filename, search recursively
    else:
        print(f"Searching for '{filepath}' under {root_dir} ...")
        # Priority: scripts_dir first
        if scripts_dir.exists():
            matches += search_dir(scripts_dir)
        matches += search_dir(root_dir)
        # Remove duplicates
        matches = list(dict.fromkeys(matches))
        if not matches:
            print(f"Error: File '{filepath}' not found under {root_dir}")
            sys.exit(1)
        print("Found matches:")
        for i, m in enumerate(matches):
            print(f"  [{i+1}] {m}")
        resolved = matches[0]
        print(f"Using first match: {resolved}")
    if not resolved.exists():
        print(f"Error: File {resolved} does not exist")
        sys.exit(1)
    return str(resolved)

def add_service(filepath, service_name=None):
    """Add a new service"""
    resolved_filepath = resolve_filepath(filepath)
    service_name_generated = generate_service_name(resolved_filepath, service_name)
    print(f"Service name determined: {service_name_generated}")
    print(f"Resolved source file: {resolved_filepath}")
    
    service_file_path = Path(f"/etc/systemd/system/{service_name_generated}.service")
    service_exists = service_file_path.exists()
    old_filepath = None
    # If service exists, check if the ExecStart matches the new file
    if service_exists:
        with open(service_file_path, 'r') as f:
            content = f.read()
        # Try to extract the ExecStart line
        for line in content.splitlines():
            if line.strip().startswith('ExecStart='):
                old_filepath = line.strip().split('ExecStart=')[-1].strip().split(' ')[-1]
                break
        if old_filepath and os.path.abspath(old_filepath) != os.path.abspath(resolved_filepath):
            print(f"Warning: Service '{service_name_generated}' already exists but points to a different file:")
            print(f"  Old: {old_filepath}")
            print(f"  New: {resolved_filepath}")
            print("Updating service to use the new file path.")
        else:
            print(f"Service {service_name_generated} already exists - will be replaced")
        manage_service(service_name_generated, 'stop')
        manage_service(service_name_generated, 'disable')
    else:
        print(f"Creating new service {service_name_generated}")
    create_service_file(service_name_generated, resolved_filepath)
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    manage_service(service_name_generated, 'enable')
    manage_service(service_name_generated, 'start')
    log_service(service_name_generated, resolved_filepath, 'add')
    print(f"\nSuccessfully {'replaced' if service_exists else 'added'} service {service_name_generated}")
    print(f"Service should now be running. Check status with:")
    print(f"  systemctl status {service_name_generated}")

def remove_service(service_name):
    """Remove an existing service"""
    service_file = Path(f"/etc/systemd/system/{service_name}.service")
    
    if not service_file.exists():
        print(f"Error: Service {service_name} does not exist")
        sys.exit(1)
    
    print(f"Removing service {service_name}")
    
    # Stop and disable service
    manage_service(service_name, 'stop')
    manage_service(service_name, 'disable')
    
    # Remove service file
    service_file.unlink()
    
    # Reload systemd
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    
    log_service(service_name, str(service_file), 'remove')
    
    print(f"\nSuccessfully removed service {service_name}")

def show_help():
    """Show example usage"""
    print("""
Service Manager - Manage custom systemd services

Examples:
  Add a service:
    ./service_manager.py add /path/to/script.py [service-name]
  
  Remove a service:
    ./service_manager.py remove service-name

Supported file types:
  .py  - Runs with python3
  .js  - Runs with node
  .sh  - Runs with bash
  .pl  - Runs with perl
  .rb  - Runs with ruby
  Others - Treated as binaries
""")

def main():
    ensure_directories()
    
    if len(sys.argv) < 2:
        show_help()
        sys.exit(1)
    
    parser = argparse.ArgumentParser(description='Manage custom systemd services')
    subparsers = parser.add_subparsers(dest='command')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add a new service')
    add_parser.add_argument('filepath', help='Path to the executable file')
    add_parser.add_argument('servername', nargs='?', help='Optional service name')
    
    # Remove command
    remove_parser = subparsers.add_parser('remove', help='Remove a service')
    remove_parser.add_argument('servername', help='Service name to remove')
    
    args = parser.parse_args()
    
    try:
        if args.command == 'add':
            add_service(args.filepath, args.servername)
        elif args.command == 'remove':
            remove_service(args.servername)
        else:
            show_help()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
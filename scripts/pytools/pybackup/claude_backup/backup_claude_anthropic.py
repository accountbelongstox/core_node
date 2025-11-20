#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude, Codex and @anthropic-ai Backup Manager

Backup and restore Claude CLI, Codex, and @anthropic-ai npm packages
with platform-aware handling and network restore support.
"""

import os
import sys
import shutil
import platform
import subprocess
import json
import socket
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
from http.server import HTTPServer, SimpleHTTPRequestHandler
import zipfile

# Add CORE_NODE_DIR to Python path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
CORE_NODE_DIR = SCRIPT_DIR.parent.parent.parent.parent
sys.path.insert(0, str(CORE_NODE_DIR))

from pycore.pyfoundations.system_paths import map_web_path


def get_npm_global_root() -> Optional[Path]:
    """Get npm global node_modules directory"""
    try:
        result = subprocess.run(
            ['npm', 'root', '-g'],
            capture_output=True,
            text=True,
            check=True
        )
        npm_root = result.stdout.strip()
        return Path(npm_root) if npm_root else None
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("[!] Warning: npm not found or failed to get global root")
        return None


def get_claude_binary_paths() -> List[Path]:
    """Get Claude binary file paths based on platform"""
    claude_paths = []

    if platform.system() == 'Windows':
        # Windows: npm directory
        npm_dir = Path.home() / 'AppData' / 'Roaming' / 'npm'
        if npm_dir.exists():
            claude_paths.extend([
                npm_dir / 'claude',
                npm_dir / 'claude.cmd'
            ])
    else:
        # Linux/Mac: Find using 'which' command
        try:
            result = subprocess.run(
                ['which', 'claude'],
                capture_output=True,
                text=True,
                check=True
            )
            claude_path = result.stdout.strip()
            if claude_path:
                claude_paths.append(Path(claude_path))
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("[!] Warning: claude command not found in PATH")

    # Filter to only existing files
    return [p for p in claude_paths if p.exists() and p.is_file()]


def get_codex_binary_paths() -> List[Path]:
    """Get Codex binary file paths based on platform"""
    codex_paths = []

    if platform.system() == 'Windows':
        # Windows: npm directory
        npm_dir = Path.home() / 'AppData' / 'Roaming' / 'npm'
        if npm_dir.exists():
            codex_paths.extend([
                npm_dir / 'codex',
                npm_dir / 'codex.cmd'
            ])
    else:
        # Linux/Mac: Find using 'which' command
        try:
            result = subprocess.run(
                ['which', 'codex'],
                capture_output=True,
                text=True,
                check=True
            )
            codex_path = result.stdout.strip()
            if codex_path:
                codex_paths.append(Path(codex_path))
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("[!] Warning: codex command not found in PATH")

    # Filter to only existing files
    return [p for p in codex_paths if p.exists() and p.is_file()]


def get_anthropic_package_paths() -> List[Path]:
    """Get @anthropic-ai package directories from global node_modules"""
    npm_root = get_npm_global_root()
    if not npm_root or not npm_root.exists():
        return []

    anthropic_dir = npm_root / '@anthropic-ai'
    if not anthropic_dir.exists() or not anthropic_dir.is_dir():
        return []

    # Return all subdirectories in @anthropic-ai
    return [p for p in anthropic_dir.iterdir() if p.is_dir()]


def get_codex_package_paths() -> List[Path]:
    """Get @openai/codex package directories from global node_modules"""
    npm_root = get_npm_global_root()
    if not npm_root or not npm_root.exists():
        return []

    openai_dir = npm_root / '@openai'
    if not openai_dir.exists() or not openai_dir.is_dir():
        return []

    # Return codex package if exists
    codex_pkg = openai_dir / 'codex'
    if codex_pkg.exists() and codex_pkg.is_dir():
        return [codex_pkg]

    return []


def create_backup_dir() -> Path:
    """Create backup directory using map_web_path"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_namespace = f'ai_tools_{timestamp}'
    backup_dir = map_web_path('www', f'backups/{backup_namespace}')
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def backup_files(source_paths: List[Path], backup_dir: Path, subdir: str) -> Dict[str, any]:
    """
    Backup files/directories to backup directory

    Args:
        source_paths: List of source file/directory paths
        backup_dir: Backup root directory
        subdir: Subdirectory name in backup

    Returns:
        Dict with backup status
    """
    target_dir = backup_dir / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    backed_up = []
    failed = []

    for source in source_paths:
        try:
            if source.is_file():
                # Copy file
                target_file = target_dir / source.name
                shutil.copy2(str(source), str(target_file))
                backed_up.append(str(source))
                print(f"[+] Backed up: {source}")
            elif source.is_dir():
                # Copy directory recursively
                target_subdir = target_dir / source.name
                shutil.copytree(str(source), str(target_subdir), dirs_exist_ok=True)
                backed_up.append(str(source))
                print(f"[+] Backed up: {source}")
        except Exception as e:
            failed.append({'path': str(source), 'error': str(e)})
            print(f"[X] Failed to backup {source}: {e}")

    return {
        'backed_up': backed_up,
        'failed': failed
    }


def create_backup_archive(backup_dir: Path) -> Optional[Path]:
    """Create zip archive of backup directory"""
    archive_name = f'{backup_dir.name}.zip'
    archive_path = backup_dir.parent / archive_name

    try:
        shutil.make_archive(
            str(backup_dir),
            'zip',
            root_dir=str(backup_dir.parent),
            base_dir=backup_dir.name
        )
        print(f"[+] Created archive: {archive_path}")
        return archive_path
    except Exception as e:
        print(f"[X] Failed to create archive: {e}")
        return None


def save_backup_manifest(backup_dir: Path, manifest_data: Dict):
    """Save backup manifest JSON file"""
    manifest_file = backup_dir / 'backup_manifest.json'

    try:
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        print(f"[+] Saved manifest: {manifest_file}")
    except Exception as e:
        print(f"[X] Failed to save manifest: {e}")


def get_local_ip_addresses() -> List[str]:
    """Get all local IP addresses"""
    ip_addresses = []

    try:
        # Get hostname
        hostname = socket.gethostname()

        # Get all IP addresses for this host
        for info in socket.getaddrinfo(hostname, None):
            ip = info[4][0]
            if ip not in ip_addresses and not ip.startswith('127.'):
                ip_addresses.append(ip)
    except Exception as e:
        print(f"[!] Warning: Failed to get IP addresses: {e}")

    # Also try to get IP by connecting to external address
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip not in ip_addresses:
            ip_addresses.append(ip)
    except:
        pass

    return ip_addresses


def start_http_server(backup_root: Path, port: int = 8888):
    """Start HTTP server for backup sharing"""

    class BackupHTTPHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(backup_root), **kwargs)

        def log_message(self, format, *args):
            # Custom logging
            print(f"[*] HTTP Request: {format % args}")

    try:
        server = HTTPServer(('0.0.0.0', port), BackupHTTPHandler)

        print("\n" + "=" * 60)
        print("  HTTP Backup Server Started")
        print("=" * 60)
        print(f"Port: {port}")
        print(f"Backup directory: {backup_root}")
        print("\nAvailable IP addresses:")

        for ip in get_local_ip_addresses():
            print(f"  http://{ip}:{port}/")

        print("\nPress Ctrl+C to stop the server")
        print("=" * 60)

        server.serve_forever()

    except KeyboardInterrupt:
        print("\n[*] Server stopped by user")
    except Exception as e:
        print(f"[X] Server error: {e}")


def download_from_remote(remote_ip: str, port: int, backup_name: str, local_dir: Path) -> Optional[Path]:
    """Download backup from remote server"""
    import urllib.request
    import urllib.error

    url = f"http://{remote_ip}:{port}/{backup_name}"
    local_file = local_dir / backup_name

    try:
        print(f"[*] Downloading from: {url}")

        with urllib.request.urlopen(url) as response:
            total_size = int(response.headers.get('Content-Length', 0))

            with open(local_file, 'wb') as f:
                downloaded = 0
                block_size = 8192

                while True:
                    chunk = response.read(block_size)
                    if not chunk:
                        break

                    f.write(chunk)
                    downloaded += len(chunk)

                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r[*] Progress: {percent:.1f}%", end='', flush=True)

        print(f"\n[+] Downloaded: {local_file}")
        return local_file

    except urllib.error.URLError as e:
        print(f"\n[X] Download failed: {e}")
        return None
    except Exception as e:
        print(f"\n[X] Unexpected error: {e}")
        return None


def restore_from_backup(backup_path: Path, item_type: Optional[str] = None) -> bool:
    """
    Restore from backup (recursively copy, skip errors)

    Args:
        backup_path: Path to backup directory or zip file
        item_type: Type to restore ('claude', 'codex', 'anthropic', 'openai', or None for all)

    Returns:
        bool: True if restore successful
    """
    # Extract if it's a zip file
    if backup_path.suffix == '.zip':
        extract_dir = backup_path.parent / backup_path.stem
        try:
            with zipfile.ZipFile(backup_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            backup_path = extract_dir
            print(f"[+] Extracted archive to: {extract_dir}")
        except Exception as e:
            print(f"[X] Failed to extract archive: {e}")
            return False

    if not backup_path.is_dir():
        print(f"[X] Invalid backup directory: {backup_path}")
        return False

    # Read manifest
    manifest_file = backup_path / 'backup_manifest.json'
    if not manifest_file.exists():
        print(f"[X] Manifest file not found: {manifest_file}")
        return False

    try:
        with open(manifest_file, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"[X] Failed to read manifest: {e}")
        return False

    restore_all = item_type is None

    # Restore Claude binaries
    if restore_all or item_type == 'claude':
        claude_backup_dir = backup_path / 'claude_binary'
        if claude_backup_dir.exists():
            print("[*] Restoring Claude binaries...")
            for item in claude_backup_dir.iterdir():
                if platform.system() == 'Windows':
                    target_dir = Path.home() / 'AppData' / 'Roaming' / 'npm'
                else:
                    target_dir = Path('/usr/local/bin')
                    if not os.access(target_dir, os.W_OK):
                        target_dir = Path.home() / 'bin'

                target_dir.mkdir(parents=True, exist_ok=True)
                target_file = target_dir / item.name

                try:
                    shutil.copy2(str(item), str(target_file))
                    print(f"[+] Restored: {target_file}")
                except Exception as e:
                    print(f"[!] Warning: Failed to restore {item.name}: {e}")

    # Restore Codex binaries
    if restore_all or item_type == 'codex':
        codex_backup_dir = backup_path / 'codex_binary'
        if codex_backup_dir.exists():
            print("[*] Restoring Codex binaries...")
            for item in codex_backup_dir.iterdir():
                if platform.system() == 'Windows':
                    target_dir = Path.home() / 'AppData' / 'Roaming' / 'npm'
                else:
                    target_dir = Path('/usr/local/bin')
                    if not os.access(target_dir, os.W_OK):
                        target_dir = Path.home() / 'bin'

                target_dir.mkdir(parents=True, exist_ok=True)
                target_file = target_dir / item.name

                try:
                    shutil.copy2(str(item), str(target_file))
                    print(f"[+] Restored: {target_file}")
                except Exception as e:
                    print(f"[!] Warning: Failed to restore {item.name}: {e}")

    # Restore @anthropic-ai packages
    if restore_all or item_type == 'anthropic':
        anthropic_backup_dir = backup_path / 'anthropic_packages'
        if anthropic_backup_dir.exists():
            print("[*] Restoring @anthropic-ai packages...")
            npm_root = get_npm_global_root()
            if npm_root:
                target_anthropic_dir = npm_root / '@anthropic-ai'
                target_anthropic_dir.mkdir(parents=True, exist_ok=True)

                for package_dir in anthropic_backup_dir.iterdir():
                    if package_dir.is_dir():
                        target_package_dir = target_anthropic_dir / package_dir.name
                        try:
                            if target_package_dir.exists():
                                shutil.rmtree(str(target_package_dir))
                            shutil.copytree(str(package_dir), str(target_package_dir))
                            print(f"[+] Restored: {target_package_dir}")
                        except Exception as e:
                            print(f"[!] Warning: Failed to restore {package_dir.name}: {e}")

    # Restore @openai/codex packages
    if restore_all or item_type == 'openai':
        openai_backup_dir = backup_path / 'openai_packages'
        if openai_backup_dir.exists():
            print("[*] Restoring @openai packages...")
            npm_root = get_npm_global_root()
            if npm_root:
                target_openai_dir = npm_root / '@openai'
                target_openai_dir.mkdir(parents=True, exist_ok=True)

                for package_dir in openai_backup_dir.iterdir():
                    if package_dir.is_dir():
                        target_package_dir = target_openai_dir / package_dir.name
                        try:
                            if target_package_dir.exists():
                                shutil.rmtree(str(target_package_dir))
                            shutil.copytree(str(package_dir), str(target_package_dir))
                            print(f"[+] Restored: {target_package_dir}")
                        except Exception as e:
                            print(f"[!] Warning: Failed to restore {package_dir.name}: {e}")

    print("[+] Restore completed!")
    return True


def open_directory_in_explorer(directory: Path):
    """Open directory in file explorer (platform-aware)"""
    if not directory.exists():
        print(f"[X] Directory does not exist: {directory}")
        return

    try:
        if platform.system() == 'Windows':
            os.startfile(str(directory))
        elif platform.system() == 'Darwin':
            subprocess.run(['open', str(directory)])
        else:
            for cmd in ['xdg-open', 'nautilus', 'dolphin', 'thunar']:
                if shutil.which(cmd):
                    subprocess.run([cmd, str(directory)])
                    break
        print(f"[+] Opened directory: {directory}")
    except Exception as e:
        print(f"[!] Warning: Failed to open directory: {e}")
        print(f"[*] Backup directory: {directory}")


def perform_backup():
    """Perform backup operation"""
    print("=" * 60)
    print("  AI Tools Backup Manager")
    print("=" * 60)
    print()

    # Get paths to backup
    print("[*] Detecting Claude binary files...")
    claude_paths = get_claude_binary_paths()
    if claude_paths:
        print(f"[+] Found {len(claude_paths)} Claude binary file(s)")
        for p in claude_paths:
            print(f"    - {p}")
    else:
        print("[!] No Claude binary files found")

    print()
    print("[*] Detecting Codex binary files...")
    codex_paths = get_codex_binary_paths()
    if codex_paths:
        print(f"[+] Found {len(codex_paths)} Codex binary file(s)")
        for p in codex_paths:
            print(f"    - {p}")
    else:
        print("[!] No Codex binary files found")

    print()
    print("[*] Detecting @anthropic-ai packages...")
    anthropic_paths = get_anthropic_package_paths()
    if anthropic_paths:
        print(f"[+] Found {len(anthropic_paths)} @anthropic-ai package(s)")
        for p in anthropic_paths:
            print(f"    - {p.name}")
    else:
        print("[!] No @anthropic-ai packages found")

    print()
    print("[*] Detecting @openai/codex packages...")
    codex_pkg_paths = get_codex_package_paths()
    if codex_pkg_paths:
        print(f"[+] Found {len(codex_pkg_paths)} @openai/codex package(s)")
        for p in codex_pkg_paths:
            print(f"    - {p.name}")
    else:
        print("[!] No @openai/codex packages found")

    if not claude_paths and not codex_paths and not anthropic_paths and not codex_pkg_paths:
        print("[X] Nothing to backup!")
        return

    print()
    confirm = input("Proceed with backup? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("[*] Backup cancelled")
        return

    # Create backup directory
    print()
    print("[*] Creating backup directory...")
    backup_dir = create_backup_dir()
    print(f"[+] Backup directory: {backup_dir}")

    # Backup Claude binaries
    claude_result = {'backed_up': [], 'failed': []}
    if claude_paths:
        print()
        print("[*] Backing up Claude binaries...")
        claude_result = backup_files(claude_paths, backup_dir, 'claude_binary')

    # Backup Codex binaries
    codex_result = {'backed_up': [], 'failed': []}
    if codex_paths:
        print()
        print("[*] Backing up Codex binaries...")
        codex_result = backup_files(codex_paths, backup_dir, 'codex_binary')

    # Backup @anthropic-ai packages
    anthropic_result = {'backed_up': [], 'failed': []}
    if anthropic_paths:
        print()
        print("[*] Backing up @anthropic-ai packages...")
        anthropic_result = backup_files(anthropic_paths, backup_dir, 'anthropic_packages')

    # Backup @openai/codex packages
    openai_result = {'backed_up': [], 'failed': []}
    if codex_pkg_paths:
        print()
        print("[*] Backing up @openai packages...")
        openai_result = backup_files(codex_pkg_paths, backup_dir, 'openai_packages')

    # Create manifest
    manifest = {
        'backup_time': datetime.now().isoformat(),
        'platform': platform.system(),
        'platform_version': platform.release(),
        'claude_binaries': {
            'backed_up': claude_result['backed_up'],
            'failed': claude_result['failed']
        },
        'codex_binaries': {
            'backed_up': codex_result['backed_up'],
            'failed': codex_result['failed']
        },
        'anthropic_packages': {
            'backed_up': anthropic_result['backed_up'],
            'failed': anthropic_result['failed']
        },
        'openai_packages': {
            'backed_up': openai_result['backed_up'],
            'failed': openai_result['failed']
        }
    }
    save_backup_manifest(backup_dir, manifest)

    # Create archive
    print()
    print("[*] Creating backup archive...")
    archive_path = create_backup_archive(backup_dir)

    # Summary
    print()
    print("=" * 60)
    print("  Backup Summary")
    print("=" * 60)
    print(f"Claude binaries backed up: {len(claude_result['backed_up'])}")
    print(f"Codex binaries backed up: {len(codex_result['backed_up'])}")
    print(f"@anthropic-ai packages backed up: {len(anthropic_result['backed_up'])}")
    print(f"@openai packages backed up: {len(openai_result['backed_up'])}")
    failed_count = (len(claude_result['failed']) + len(codex_result['failed']) +
                   len(anthropic_result['failed']) + len(openai_result['failed']))
    if failed_count > 0:
        print(f"Failed items: {failed_count}")
    print(f"Backup directory: {backup_dir}")
    if archive_path:
        print(f"Archive: {archive_path}")
    print("=" * 60)

    # Open backup directory
    print()
    open_dir = input("Open backup directory? (yes/no): ").strip().lower()
    if open_dir in ['yes', 'y']:
        open_directory_in_explorer(backup_dir.parent)


def perform_restore():
    """Perform restore operation"""
    print("=" * 60)
    print("  AI Tools Restore Manager")
    print("=" * 60)
    print()
    print("Restore from:")
    print("  1. Local backup")
    print("  2. Remote server")
    print()

    choice = input("Select option (1-2): ").strip()

    if choice == '1':
        restore_from_local()
    elif choice == '2':
        restore_from_remote_server()
    else:
        print("[X] Invalid option")


def restore_from_local():
    """Restore from local backup"""
    # Get backup directory
    backup_root = map_web_path('www', 'backups')
    if not backup_root.exists():
        print(f"[X] Backup root directory not found: {backup_root}")
        return

    # List available backups
    backups = []
    for item in backup_root.iterdir():
        if item.is_dir() and item.name.startswith('ai_tools_'):
            backups.append(item)
        elif item.is_file() and item.suffix == '.zip' and item.stem.startswith('ai_tools_'):
            backups.append(item)

    if not backups:
        print(f"[X] No backups found in: {backup_root}")
        return

    backups.sort(reverse=True)

    print("\nAvailable backups:")
    for i, backup in enumerate(backups, 1):
        print(f"  {i}. {backup.name}")

    print()
    try:
        selection = int(input(f"Select backup to restore (1-{len(backups)}): "))
        if selection < 1 or selection > len(backups):
            print("[X] Invalid selection")
            return
    except ValueError:
        print("[X] Invalid input")
        return

    selected_backup = backups[selection - 1]

    # Ask what to restore
    print()
    print("What to restore:")
    print("  1. Everything")
    print("  2. Claude only")
    print("  3. Codex only")
    print("  4. @anthropic-ai packages only")
    print("  5. @openai packages only")
    print()

    item_choice = input("Select option (1-5): ").strip()

    item_type_map = {
        '1': None,
        '2': 'claude',
        '3': 'codex',
        '4': 'anthropic',
        '5': 'openai'
    }

    item_type = item_type_map.get(item_choice)
    if item_choice not in item_type_map:
        print("[X] Invalid option")
        return

    print()
    print(f"[*] Selected backup: {selected_backup.name}")
    confirm = input("Proceed with restore? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("[*] Restore cancelled")
        return

    print()
    restore_from_backup(selected_backup, item_type)


def restore_from_remote_server():
    """Restore from remote server"""
    print()
    remote_ip = input("Enter remote server IP address: ").strip()
    if not remote_ip:
        print("[X] No IP address provided")
        return

    port = input("Enter port (default 8888): ").strip()
    if not port:
        port = 8888
    else:
        try:
            port = int(port)
        except ValueError:
            print("[X] Invalid port number")
            return

    # Try to list available backups
    import urllib.request
    import urllib.error
    from html.parser import HTMLParser

    class BackupListParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.backups = []

        def handle_starttag(self, tag, attrs):
            if tag == 'a':
                for attr, value in attrs:
                    if attr == 'href' and (value.startswith('ai_tools_') and value.endswith('.zip')):
                        self.backups.append(value)

    try:
        url = f"http://{remote_ip}:{port}/"
        print(f"[*] Connecting to: {url}")

        with urllib.request.urlopen(url, timeout=10) as response:
            html = response.read().decode('utf-8')
            parser = BackupListParser()
            parser.feed(html)

            if not parser.backups:
                print("[X] No backups found on remote server")
                return

            print("\nAvailable backups on remote server:")
            for i, backup in enumerate(parser.backups, 1):
                print(f"  {i}. {backup}")

            print()
            try:
                selection = int(input(f"Select backup to download (1-{len(parser.backups)}): "))
                if selection < 1 or selection > len(parser.backups):
                    print("[X] Invalid selection")
                    return
            except ValueError:
                print("[X] Invalid input")
                return

            selected_backup = parser.backups[selection - 1]

            # Download backup
            print()
            local_backup_dir = map_web_path('www', 'backups')
            local_backup_dir.mkdir(parents=True, exist_ok=True)

            downloaded_file = download_from_remote(remote_ip, port, selected_backup, local_backup_dir)

            if downloaded_file:
                # Ask what to restore
                print()
                print("What to restore:")
                print("  1. Everything")
                print("  2. Claude only")
                print("  3. Codex only")
                print("  4. @anthropic-ai packages only")
                print("  5. @openai packages only")
                print()

                item_choice = input("Select option (1-5): ").strip()

                item_type_map = {
                    '1': None,
                    '2': 'claude',
                    '3': 'codex',
                    '4': 'anthropic',
                    '5': 'openai'
                }

                item_type = item_type_map.get(item_choice)
                if item_choice not in item_type_map:
                    print("[X] Invalid option")
                    return

                print()
                restore_from_backup(downloaded_file, item_type)

    except urllib.error.URLError as e:
        print(f"[X] Connection failed: {e}")
    except Exception as e:
        print(f"[X] Unexpected error: {e}")


def start_server():
    """Start HTTP server for sharing backups"""
    backup_root = map_web_path('www', 'backups')
    if not backup_root.exists():
        print(f"[X] Backup root directory not found: {backup_root}")
        print(f"[*] Creating directory: {backup_root}")
        backup_root.mkdir(parents=True, exist_ok=True)

    print()
    port_input = input("Enter port (default 8888): ").strip()
    port = 8888
    if port_input:
        try:
            port = int(port_input)
        except ValueError:
            print("[!] Invalid port, using default: 8888")
            port = 8888

    print()
    start_http_server(backup_root, port)


def show_menu():
    """Show main menu"""
    while True:
        print()
        print("=" * 60)
        print("  AI Tools Backup Manager")
        print("=" * 60)
        print("  1. Backup (Claude, Codex, @anthropic-ai, @openai)")
        print("  2. Restore from local or remote")
        print("  3. Start HTTP server (for remote restore)")
        print("  4. Exit")
        print("=" * 60)

        choice = input("Select option (1-4): ").strip()

        if choice == '1':
            perform_backup()
        elif choice == '2':
            perform_restore()
        elif choice == '3':
            start_server()
        elif choice == '4':
            print("[*] Exiting...")
            break
        else:
            print("[!] Invalid option")


if __name__ == '__main__':
    try:
        show_menu()
    except KeyboardInterrupt:
        print("\n[*] Interrupted by user")
    except Exception as e:
        print(f"[X] Unexpected error: {e}")
        import traceback
        traceback.print_exc()

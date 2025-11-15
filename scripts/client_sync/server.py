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

import os
import socket
import threading
import time
import json
import hashlib
from pathlib import Path
from datetime import datetime
import platform

# Configuration
CLIENT_IP = "127.0.0.1"
CLIENT_PORT = 8888
SYNC_INTERVAL = 5
IGNORE_DIRS = {"node_modules"}
ROOT_DIR = Path(__file__).parent.parent

# Global state
file_checksums = {}
sync_lock = threading.Lock()
running = True

def get_file_checksum(file_path):
    """Calculate MD5 checksum of file"""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        print(f"Error calculating checksum for {file_path}: {e}")
        return None

def should_ignore_path(path):
    """Check if path should be ignored"""
    path_parts = Path(path).parts
    for part in path_parts:
        if part in IGNORE_DIRS:
            return True
    return False

def get_all_files(root_dir):
    """Get all files in root directory, excluding ignored paths"""
    files = []
    root_path = Path(root_dir)
    if not root_path.exists():
        return files
    
    for root, dirs, filenames in os.walk(root_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for filename in filenames:
            file_path = Path(root) / filename
            if not should_ignore_path(file_path):
                files.append(file_path)
    return files

def get_file_mtime(file_path):
    """Get file modification time"""
    try:
        return os.path.getmtime(file_path)
    except Exception as e:
        print(f"Error getting mtime for {file_path}: {e}")
        return None

def get_all_available_ips():
    """Get all available IP addresses on this machine"""
    ips = set()
    
    hostname = socket.gethostname()
    try:
        host_ips = socket.gethostbyname_ex(hostname)[2]
        ips.update(host_ips)
    except:
        pass
    
    try:
        host_ips = socket.gethostbyname_ex("localhost")[2]
        ips.update(host_ips)
    except:
        pass
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        ips.add(local_ip)
        s.close()
    except:
        pass
    
    if platform.system() == "Windows":
        try:
            import subprocess
            result = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5)
            for line in result.stdout.split("\n"):
                if "IPv4" in line or "IP Address" in line:
                    parts = line.split(":")
                    if len(parts) > 1:
                        ip = parts[1].strip()
                        if ip and ip != "0.0.0.0":
                            try:
                                socket.inet_aton(ip)
                                ips.add(ip)
                            except:
                                pass
        except:
            pass
    else:
        try:
            import subprocess
            result = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=5)
            for ip in result.stdout.strip().split():
                if ip:
                    try:
                        socket.inet_aton(ip)
                        ips.add(ip)
                    except:
                        pass
        except:
            pass
    
    return sorted(list(ips))

def send_file_to_client(sock, file_path, relative_path):
    """Send file to client"""
    try:
        file_size = os.path.getsize(file_path)
        file_info = {
            "action": "file",
            "path": relative_path,
            "size": file_size,
            "mtime": os.path.getmtime(file_path)
        }
        
        info_json = json.dumps(file_info).encode('utf-8')
        info_size = len(info_json)
        sock.sendall(info_size.to_bytes(4, 'big'))
        sock.sendall(info_json)
        
        response = sock.recv(1)
        if response != b'1':
            print(f"Client rejected file: {relative_path}")
            return False
        
        with open(file_path, 'rb') as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                sock.sendall(chunk)
        
        final_response = sock.recv(1)
        return final_response == b'1'
    except Exception as e:
        print(f"Error sending file {relative_path}: {e}")
        return False

def sync_files_to_client():
    """Main sync loop"""
    global file_checksums, running
    
    while running:
        try:
            files = get_all_files(ROOT_DIR)
            files_to_sync = []
            
            for file_path in files:
                relative_path = str(file_path.relative_to(ROOT_DIR))
                current_mtime = get_file_mtime(file_path)
                
                if current_mtime is None:
                    continue
                
                with sync_lock:
                    if relative_path not in file_checksums:
                        files_to_sync.append((file_path, relative_path, current_mtime))
                        current_checksum = get_file_checksum(file_path)
                        file_checksums[relative_path] = {
                            "checksum": current_checksum,
                            "mtime": current_mtime
                        }
                    else:
                        stored_info = file_checksums[relative_path]
                        if current_mtime > stored_info["mtime"]:
                            files_to_sync.append((file_path, relative_path, current_mtime))
                            current_checksum = get_file_checksum(file_path)
                            file_checksums[relative_path] = {
                                "checksum": current_checksum,
                                "mtime": current_mtime
                            }
            
            if files_to_sync:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Found {len(files_to_sync)} files to sync")
                
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(30)
                    sock.connect((CLIENT_IP, CLIENT_PORT))
                    
                    for file_path, relative_path, mtime in files_to_sync:
                        print(f"Syncing: {relative_path}")
                        if send_file_to_client(sock, file_path, relative_path):
                            print(f"Successfully synced: {relative_path}")
                        else:
                            print(f"Failed to sync: {relative_path}")
                    
                    sock.close()
                except Exception as e:
                    print(f"Error connecting to client: {e}")
            
            time.sleep(SYNC_INTERVAL)
        except Exception as e:
            print(f"Error in sync loop: {e}")
            time.sleep(SYNC_INTERVAL)

def main():
    """Main entry point"""
    global running
    
    available_ips = get_all_available_ips()
    
    print(f"File Sync Server")
    print(f"Root directory: {ROOT_DIR}")
    print(f"Sync interval: {SYNC_INTERVAL} seconds")
    print(f"Ignoring directories: {', '.join(IGNORE_DIRS)}")
    print(f"\nAvailable IP addresses on this machine:")
    for ip in available_ips:
        marker = " <-- Using this" if ip == CLIENT_IP else ""
        print(f"  - {ip}:{CLIENT_PORT}{marker}")
    print(f"\nConfigured client IP: {CLIENT_IP}:{CLIENT_PORT}")
    print("Starting sync service...")
    
    try:
        sync_files_to_client()
    except KeyboardInterrupt:
        print("\nShutting down...")
        running = False

if __name__ == "__main__":
    main()


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

"""
File Sync Server

ARCHITECTURE:
- Server-initiated push model: Server unilaterally pushes files to clients
- Server actively scans for clients and initiates connections
- Server monitors local files and pushes changes to clients
- Client decides whether to accept/reject files based on local conditions

WORKFLOW:
1. Server scans LAN for available clients (port 8888)
2. Server monitors local files for changes (modification time)
3. Server connects to client and pushes file metadata
4. Client evaluates whether to accept the file (based on mtime, ignore rules)
5. If client accepts, server sends file data
6. Client confirms receipt or rejects

KEY FEATURES:
- Unilateral push: Only server initiates file transfers
- Client autonomy: Client decides file replacement based on:
  * File modification time comparison
  * Ignore directory rules
  * File existence status
- Automatic client discovery via LAN scanning
- Change detection using file modification time
- Checksum tracking for file integrity
"""

import os
import socket
import threading
import time
import json
import hashlib
from pathlib import Path
from datetime import datetime

from common.network_util import get_local_ip, get_network_segment, scan_lan_hosts, get_all_available_ips, is_client_host, HostIdentifier
from common.config import (
    SYNC_PORT, SYNC_INTERVAL, IGNORE_DIRS, IGNORE_EXTENSIONS, IGNORE_FILES,
    CHUNK_SIZE, SOCKET_TIMEOUT, SCAN_TIMEOUT
)

# Configuration
CLIENT_IP = "127.0.0.1"
CLIENT_PORT = SYNC_PORT
ROOT_DIR = Path(__file__).parent.parent

# Global state
file_checksums = {}
sync_lock = threading.Lock()
running = True

def get_file_checksum(file_path):
    """
    Calculate MD5 checksum of file
    
    PURPOSE: Track file content changes for sync decision
    USAGE: Used to detect if file content has changed even if mtime is same
    RETURNS: MD5 hash string or None on error
    """
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
    """
    Check if path should be ignored
    
    PURPOSE: Filter out directories/files that should not be synced
    RULES:
    - Any path containing IGNORE_DIRS (e.g., node_modules) is skipped
    - Files with IGNORE_EXTENSIONS (e.g., .pyc, .pyo) are skipped
    - Files matching IGNORE_FILES (e.g., .DS_Store) are skipped
    RETURNS: True if path should be ignored, False otherwise
    """
    path_obj = Path(path)
    
    # Check directory names
    path_parts = path_obj.parts
    for part in path_parts:
        if part in IGNORE_DIRS:
            return True
    
    # Check file extension
    if path_obj.suffix.lower() in IGNORE_EXTENSIONS:
        return True
    
    # Check filename
    if path_obj.name in IGNORE_FILES:
        return True
    
    return False

def get_all_files(root_dir):
    """
    Get all files in root directory, excluding ignored paths
    
    PURPOSE: Enumerate all files that need to be synced
    FILTERING: Automatically skips IGNORE_DIRS during directory traversal
    RETURNS: List of Path objects for all files to sync
    """
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
    """
    Get file modification time
    
    PURPOSE: Detect file changes for sync decision
    USAGE: Compare mtime to determine if file needs syncing
    RETURNS: Unix timestamp or None on error
    """
    try:
        return os.path.getmtime(file_path)
    except Exception as e:
        print(f"Error getting mtime for {file_path}: {e}")
        return None



def send_file_to_client(sock, file_path, relative_path):
    """
    Send file to client (Server-initiated push)
    
    PURPOSE: Unilaterally push file from server to client
    PROTOCOL:
    1. Send file metadata (path, size, mtime) as JSON
    2. Wait for client decision (b'1' = accept, b'0' = reject)
    3. If accepted, send file data in chunks
    4. Wait for final confirmation (b'1' = success, b'0' = failure)
    
    CLIENT DECISION: Client decides based on:
    - File modification time (only update if server file is newer)
    - Ignore rules (client can reject ignored paths)
    - File existence (client handles new vs existing files)
    
    RETURNS: True if file was successfully sent and accepted, False otherwise
    """
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
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break
                sock.sendall(chunk)
        
        final_response = sock.recv(1)
        return final_response == b'1'
    except Exception as e:
        print(f"Error sending file {relative_path}: {e}")
        return False

def sync_files_to_client():
    """
    Main sync loop - Server-initiated file pushing
    
    PURPOSE: Continuously monitor and push file changes to client
    WORKFLOW:
    1. FIRST SYNC: Push all files (files not in file_checksums)
    2. SUBSEQUENT SYNC: Push only changed files (mtime > stored mtime)
    3. For new/changed files, connect to client and push
    4. Client makes autonomous decision to accept/reject
    5. Repeat every SYNC_INTERVAL seconds
    
    FIRST SYNC BEHAVIOR: All files are pushed on first connection
    SUBSEQUENT SYNC: Only files with modification time changes are pushed
    
    SERVER ROLE: Active pusher - initiates all file transfers
    CLIENT ROLE: Passive receiver - decides whether to accept files
    """
    global file_checksums, running
    first_sync = True
    
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
                        # FIRST SYNC: File not in checksums - push all files
                        files_to_sync.append((file_path, relative_path, current_mtime))
                        current_checksum = get_file_checksum(file_path)
                        file_checksums[relative_path] = {
                            "checksum": current_checksum,
                            "mtime": current_mtime
                        }
                    else:
                        # SUBSEQUENT SYNC: Only push if file has changed (mtime > stored mtime)
                        stored_info = file_checksums[relative_path]
                        if current_mtime > stored_info["mtime"]:
                            files_to_sync.append((file_path, relative_path, current_mtime))
                            current_checksum = get_file_checksum(file_path)
                            file_checksums[relative_path] = {
                                "checksum": current_checksum,
                                "mtime": current_mtime
                            }
            
            if files_to_sync:
                sync_type = "FIRST SYNC (all files)" if first_sync else "INCREMENTAL SYNC (changed files)"
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {sync_type}: {len(files_to_sync)} files to sync")
                
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(SOCKET_TIMEOUT)
                    sock.connect((CLIENT_IP, CLIENT_PORT))
                    
                    for file_path, relative_path, mtime in files_to_sync:
                        print(f"Syncing: {relative_path}")
                        if send_file_to_client(sock, file_path, relative_path):
                            print(f"Successfully synced: {relative_path}")
                        else:
                            print(f"Failed to sync: {relative_path}")
                    
                    sock.close()
                    first_sync = False
                except Exception as e:
                    print(f"Error connecting to client: {e}")
            else:
                if first_sync:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] No files to sync (empty directory or all ignored)")
                    first_sync = False
            
            time.sleep(SYNC_INTERVAL)
        except Exception as e:
            print(f"Error in sync loop: {e}")
            time.sleep(SYNC_INTERVAL)


def scan_for_other_servers(local_ip, network_segment, available_ips):
    """
    Scan LAN for other servers running on the same port
    
    PURPOSE: Detect if other servers are already running before starting
    MULTIPLE SERVER DETECTION: If other servers are found, server will stop and prompt
    
    NOTE: Filters out clients - only reports actual other servers
    USES: HostIdentifier class for server/client identification
    
    RETURNS:
    - list: List of other server IPs found (excluding all local IPs and clients)
    - None: If network segment cannot be detected
    """
    if not network_segment:
        return None
    
    print(f"\n[SCAN] Checking for other servers on port {CLIENT_PORT}...")
    
    # Scan for any hosts with the port open (could be servers or clients)
    all_hosts = scan_lan_hosts(network_segment, CLIENT_PORT, SCAN_TIMEOUT, "server")
    
    if not all_hosts:
        print(f"[SCAN] No other hosts found on port {CLIENT_PORT}")
        return []
    
    # Filter out all local IP addresses (this server's IPs)
    local_ips_set = set(available_ips)
    other_hosts = [ip for ip in all_hosts if ip not in local_ips_set]
    
    if not other_hosts:
        print(f"[SCAN] No other hosts found (only this server's IPs detected)")
        return []
    
    # Use HostIdentifier class to filter out clients
    print(f"[SCAN] Checking {len(other_hosts)} host(s) to identify clients vs servers...")
    identifier = HostIdentifier(CLIENT_PORT, SCAN_TIMEOUT)
    filtered = identifier.filter_hosts(other_hosts, exclude_local_ips=local_ips_set, exclude_type="client")
    
    clients_found = filtered["clients"]
    other_servers = filtered["servers"]
    
    # Display identification results
    for host_ip in other_hosts:
        host_type = identifier.identify_host(host_ip)
        if host_type == "client":
            print(f"[SCAN] {host_ip}:{CLIENT_PORT} - identified as CLIENT (ignoring)")
        elif host_type == "server":
            print(f"[SCAN] {host_ip}:{CLIENT_PORT} - identified as SERVER (WARNING)")
    
    if clients_found:
        print(f"[SCAN] Filtered out {len(clients_found)} client(s)")
    
    if other_servers:
        print(f"[SCAN] Found {len(other_servers)} other server(s):")
        for i, server_ip in enumerate(other_servers, 1):
            print(f"  {i}. {server_ip}:{CLIENT_PORT}")
    else:
        print(f"[SCAN] No other servers found (only clients detected)")
    
    return other_servers

def main():
    """Main entry point"""
    global running, CLIENT_IP
    
    available_ips = get_all_available_ips()
    local_ip = get_local_ip()
    network_segment = get_network_segment(local_ip)
    
    print(f"File Sync Server")
    print(f"Root directory: {ROOT_DIR}")
    print(f"Sync interval: {SYNC_INTERVAL} seconds")
    print(f"Ignoring directories: {', '.join(sorted(IGNORE_DIRS))}")
    print(f"Ignoring extensions: {', '.join(sorted(IGNORE_EXTENSIONS))}")
    print(f"Ignoring files: {', '.join(sorted(IGNORE_FILES))}")
    print(f"\nAvailable IP addresses on this machine:")
    for ip in available_ips:
        marker = " <-- Local IP" if ip == local_ip else ""
        print(f"  - {ip}:{CLIENT_PORT}{marker}")
    
    # MULTIPLE SERVER DETECTION: Scan for other servers before starting
    if network_segment and local_ip:
        other_servers = scan_for_other_servers(local_ip, network_segment, available_ips)
        
        if other_servers and len(other_servers) > 0:
            print("\n" + "="*60)
            print("[WARNING] OTHER SERVERS DETECTED!")
            print("="*60)
            print(f"Server has detected {len(other_servers)} other host(s) on port {CLIENT_PORT}:")
            for i, server_ip in enumerate(other_servers, 1):
                print(f"  {i}. {server_ip}:{CLIENT_PORT}")
            print(f"\nLocal server IP(s): {', '.join(available_ips)}:{CLIENT_PORT}")
            print("\n[PROMPT] Multiple servers cannot run simultaneously.")
            print("[PROMPT] Please stop the other server(s) before starting this one.")
            print("[PROMPT] Server will not start.")
            print("="*60 + "\n")
            return
    
    if network_segment:
        print(f"\nNetwork segment: {network_segment}")
        print(f"Scanning for clients on port {CLIENT_PORT}...")
        
        active_clients = scan_lan_hosts(network_segment, CLIENT_PORT, SCAN_TIMEOUT, "client")
        
        if active_clients:
            print(f"\nFound {len(active_clients)} active client(s):")
            for i, client_ip in enumerate(active_clients, 1):
                marker = " <-- AUTO-SELECTED" if i == 1 else ""
                print(f"  {i}. {client_ip}:{CLIENT_PORT}{marker}")
            
            if CLIENT_IP not in active_clients:
                CLIENT_IP = active_clients[0]
                print(f"\nAuto-selected first available client: {CLIENT_IP}:{CLIENT_PORT}")
            else:
                print(f"\nUsing configured client IP: {CLIENT_IP}:{CLIENT_PORT}")
        else:
            print(f"\nNo active clients found. Using configured IP: {CLIENT_IP}:{CLIENT_PORT}")
    else:
        print(f"\nCould not detect network segment. Using configured IP: {CLIENT_IP}:{CLIENT_PORT}")
    
    print("\nStarting sync service...")
    
    try:
        sync_files_to_client()
    except KeyboardInterrupt:
        print("\nShutting down...")
        running = False

if __name__ == "__main__":
    main()


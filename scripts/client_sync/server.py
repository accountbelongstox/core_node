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
    SYNC_PORT, SYNC_INTERVAL, CLIENT_RESCAN_INTERVAL, IGNORE_DIRS, IGNORE_EXTENSIONS, IGNORE_FILES,
    CHUNK_SIZE, SOCKET_TIMEOUT, FILE_TRANSFER_TIMEOUT, MAX_RETRIES, RETRY_DELAY, SCAN_TIMEOUT
)

# Configuration
CLIENT_IP = "127.0.0.1"
CLIENT_PORT = SYNC_PORT
ROOT_DIR = Path(__file__).parent.parent

# Global state
file_checksums = {}
client_checksums = {}  # Track which clients have been synced: {client_ip: {file_path: checksum_info}}
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



def send_batch_files_to_client(sock, files_batch, client_ip, max_retries=MAX_RETRIES):
    """
    Send multiple files to client in a single batch transfer

    PURPOSE: Efficiently push multiple files from server to client in one connection
    PROTOCOL:
    Phase 1 - Metadata Exchange:
    1. Send batch metadata: {"action": "batch_metadata", "files": [{path, size, mtime}, ...]}
    2. Wait for client decision: {"action": "batch_decision", "accepted": [path1, path2, ...]}

    Phase 2 - Bulk Transfer:
    3. For each accepted file, send file data in chunks with progress tracking
    4. Wait for batch confirmation: {"action": "batch_complete", "success": bool, "received_count": N}

    ADVANTAGES:
    - Single connection for multiple files (reduced overhead)
    - Client can review all files before accepting (better decision making)
    - Bulk transfer improves efficiency
    - Comprehensive error tracking across entire batch

    Args:
        sock: Connected socket to client
        files_batch: List of (file_path, relative_path, mtime) tuples
        client_ip: Client IP for logging
        max_retries: Maximum retry attempts

    RETURNS: Dict with {successful: int, failed: int, accepted_files: [paths]}
    """
    for attempt in range(max_retries):
        try:
            # Phase 1: Send metadata for all files in batch
            file_metadata = []
            for file_path, relative_path, mtime in files_batch:
                file_size = os.path.getsize(file_path)
                file_metadata.append({
                    "path": relative_path,
                    "size": file_size,
                    "mtime": mtime
                })

            batch_info = {
                "action": "batch_metadata",
                "files": file_metadata,
                "count": len(file_metadata)
            }

            # Calculate total batch timeout (10s base + 5s per file + size-based)
            total_size = sum(fm["size"] for fm in file_metadata)
            batch_timeout = max(SOCKET_TIMEOUT, 10 + len(file_metadata) * 5 + (total_size // (1024 * 1024)) * 2)
            sock.settimeout(batch_timeout)

            # Send batch metadata
            info_json = json.dumps(batch_info).encode('utf-8')
            info_size = len(info_json)
            sock.sendall(info_size.to_bytes(4, 'big'))
            sock.sendall(info_json)

            print(f"[{client_ip}] Sent metadata for {len(file_metadata)} files, waiting for client decision...")

            # Phase 2: Receive client decision
            decision_size_bytes = sock.recv(4)
            if len(decision_size_bytes) < 4:
                raise ConnectionError("Client disconnected during decision")

            decision_size = int.from_bytes(decision_size_bytes, 'big')
            decision_data = b''
            while len(decision_data) < decision_size:
                chunk = sock.recv(min(CHUNK_SIZE, decision_size - len(decision_data)))
                if not chunk:
                    raise ConnectionError("Client disconnected while receiving decision")
                decision_data += chunk

            decision = json.loads(decision_data.decode('utf-8'))

            if decision.get("action") != "batch_decision":
                raise ValueError(f"Invalid decision action: {decision.get('action')}")

            accepted_paths = decision.get("accepted", [])
            rejected_count = len(file_metadata) - len(accepted_paths)

            print(f"[{client_ip}] Client accepted {len(accepted_paths)}/{len(file_metadata)} files (rejected {rejected_count})")

            if not accepted_paths:
                return {"successful": 0, "failed": 0, "accepted_files": []}

            # Phase 3: Send accepted files
            accepted_path_set = set(accepted_paths)
            successful_transfers = 0
            failed_transfers = 0

            for file_path, relative_path, mtime in files_batch:
                if relative_path not in accepted_path_set:
                    continue

                file_size = os.path.getsize(file_path)
                size_kb = file_size / 1024
                size_str = f"{size_kb:.1f}KB" if size_kb < 1024 else f"{size_kb/1024:.2f}MB"

                print(f"  [{client_ip}] Transferring: {relative_path} ({size_str})")

                # Send file data in chunks
                bytes_sent = 0
                last_progress_mb = 0
                try:
                    with open(file_path, 'rb') as f:
                        while bytes_sent < file_size:
                            chunk = f.read(CHUNK_SIZE)
                            if not chunk:
                                break
                            sock.sendall(chunk)
                            bytes_sent += len(chunk)

                            # Show progress for large files (>1MB)
                            if file_size > 1024 * 1024:
                                current_mb = bytes_sent // (1024 * 1024)
                                if current_mb > last_progress_mb:
                                    last_progress_mb = current_mb
                                    progress = (bytes_sent / file_size) * 100
                                    print(f"    Progress: {progress:.1f}% ({bytes_sent // 1024}KB/{file_size // 1024}KB)")

                    # Verify complete transfer
                    if bytes_sent == file_size:
                        successful_transfers += 1
                    else:
                        print(f"  [{client_ip}] Incomplete transfer: {relative_path} ({bytes_sent}/{file_size} bytes)")
                        failed_transfers += 1

                except Exception as e:
                    print(f"  [{client_ip}] Error transferring {relative_path}: {e}")
                    failed_transfers += 1

            # Phase 4: Wait for batch confirmation
            confirm_size_bytes = sock.recv(4)
            if len(confirm_size_bytes) < 4:
                raise ConnectionError("Client disconnected during confirmation")

            confirm_size = int.from_bytes(confirm_size_bytes, 'big')
            confirm_data = b''
            while len(confirm_data) < confirm_size:
                chunk = sock.recv(min(CHUNK_SIZE, confirm_size - len(confirm_data)))
                if not chunk:
                    raise ConnectionError("Client disconnected during confirmation")
                confirm_data += chunk

            confirmation = json.loads(confirm_data.decode('utf-8'))

            if confirmation.get("action") != "batch_complete":
                raise ValueError(f"Invalid confirmation action: {confirmation.get('action')}")

            client_received = confirmation.get("received_count", 0)
            print(f"[{client_ip}] Batch complete: server sent {successful_transfers}, client received {client_received}")

            return {
                "successful": successful_transfers,
                "failed": failed_transfers,
                "accepted_files": accepted_paths
            }

        except socket.timeout:
            if attempt < max_retries - 1:
                print(f"[{client_ip}] Batch timeout (attempt {attempt + 1}/{max_retries}), retrying...")
                time.sleep(RETRY_DELAY)
                continue
            else:
                print(f"[{client_ip}] Batch timeout after {max_retries} attempts")
                return {"successful": 0, "failed": len(files_batch), "accepted_files": []}

        except (ConnectionError, OSError) as e:
            if attempt < max_retries - 1:
                print(f"[{client_ip}] Batch connection error (attempt {attempt + 1}/{max_retries}): {e}, retrying...")
                time.sleep(RETRY_DELAY)
                continue
            else:
                print(f"[{client_ip}] Batch connection error after {max_retries} attempts: {e}")
                return {"successful": 0, "failed": len(files_batch), "accepted_files": []}

        except Exception as e:
            print(f"[{client_ip}] Batch error: {e}")
            return {"successful": 0, "failed": len(files_batch), "accepted_files": []}

    return {"successful": 0, "failed": len(files_batch), "accepted_files": []}

def sync_files_to_client(client_ip, is_new_client=False):
    """
    Sync files to a specific client
    
    PURPOSE: Push files to a single client
    WORKFLOW:
    1. For new clients: Push all files (first sync)
    2. For existing clients: Push only changed files (mtime > stored mtime)
    3. Client makes autonomous decision to accept/reject
    
    Args:
        client_ip: IP address of the client to sync
        is_new_client: True if this is a new client (will push all files)
    
    Returns:
        bool: True if sync was successful, False otherwise
    """
    global file_checksums, client_checksums
    
    try:
        files = get_all_files(ROOT_DIR)
        files_to_sync = []
        
        # Get client's file checksums (empty for new clients)
        client_file_checksums = client_checksums.get(client_ip, {})
        
        for file_path in files:
            relative_path = str(file_path.relative_to(ROOT_DIR))
            current_mtime = get_file_mtime(file_path)
            
            if current_mtime is None:
                continue
            
            with sync_lock:
                # Update global file checksums
                if relative_path not in file_checksums:
                    current_checksum = get_file_checksum(file_path)
                    file_checksums[relative_path] = {
                        "checksum": current_checksum,
                        "mtime": current_mtime
                    }
                else:
                    stored_info = file_checksums[relative_path]
                    if current_mtime > stored_info["mtime"]:
                        current_checksum = get_file_checksum(file_path)
                        file_checksums[relative_path] = {
                            "checksum": current_checksum,
                            "mtime": current_mtime
                        }
                
                # Determine if this file needs to be synced to this client
                if is_new_client:
                    # New client: push all files
                    files_to_sync.append((file_path, relative_path, current_mtime))
                else:
                    # Existing client: only push if file changed or not in client's checksums
                    if relative_path not in client_file_checksums:
                        files_to_sync.append((file_path, relative_path, current_mtime))
                    else:
                        client_stored_info = client_file_checksums[relative_path]
                        if current_mtime > client_stored_info["mtime"]:
                            files_to_sync.append((file_path, relative_path, current_mtime))
        
        if not files_to_sync:
            return True
        
        sync_type = "FIRST SYNC (all files)" if is_new_client else "INCREMENTAL SYNC (changed files)"
        total_size = sum(os.path.getsize(fp) for fp, _, _ in files_to_sync)
        size_mb = total_size / (1024 * 1024)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [{client_ip}] {sync_type}: {len(files_to_sync)} files ({size_mb:.2f}MB) to sync")
        
        # Batch files into groups to avoid excessively long connections
        BATCH_SIZE = 50
        updated_client_checksums = client_file_checksums.copy()
        successful_syncs = 0
        failed_syncs = 0

        for batch_start in range(0, len(files_to_sync), BATCH_SIZE):
            batch = files_to_sync[batch_start:batch_start + BATCH_SIZE]
            batch_num = (batch_start // BATCH_SIZE) + 1
            total_batches = (len(files_to_sync) + BATCH_SIZE - 1) // BATCH_SIZE

            print(f"[{client_ip}] Processing batch {batch_num}/{total_batches} ({len(batch)} files)")

            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(SOCKET_TIMEOUT)
                sock.connect((client_ip, CLIENT_PORT))

                # Send entire batch at once
                result = send_batch_files_to_client(sock, batch, client_ip)

                successful_syncs += result["successful"]
                failed_syncs += result["failed"]

                # Update client checksums for successfully transferred files
                for accepted_path in result["accepted_files"]:
                    if accepted_path in file_checksums:
                        updated_client_checksums[accepted_path] = file_checksums[accepted_path].copy()
                
                sock.close()
                
            except Exception as e:
                print(f"[{client_ip}] Error connecting to client for batch: {e}")
                failed_syncs += len(batch)
                try:
                    sock.close()
                except:
                    pass
        
        # Save updated client checksums
        with sync_lock:
            client_checksums[client_ip] = updated_client_checksums
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [{client_ip}] Sync complete: {successful_syncs} succeeded, {failed_syncs} failed")
        return successful_syncs > 0
    except Exception as e:
        print(f"[{client_ip}] Error in sync: {e}")
        return False

def sync_loop():
    """
    Main sync loop - Server-initiated file pushing with client rescanning
    
    PURPOSE: Continuously rescan for clients and push file changes
    WORKFLOW:
    1. Rescan for clients every CLIENT_RESCAN_INTERVAL seconds
    2. For each client:
       - New clients: Push all files (first sync)
       - Existing clients: Push only changed files (incremental sync)
    3. Client makes autonomous decision to accept/reject
    4. Repeat
    
    CLIENT RESCAN: Scans for clients every 10 seconds
    NEW CLIENT BEHAVIOR: All files are pushed on first connection
    EXISTING CLIENT BEHAVIOR: Only files with modification time changes are pushed
    
    SERVER ROLE: Active pusher - initiates all file transfers
    CLIENT ROLE: Passive receiver - decides whether to accept files
    """
    global running, CLIENT_IP
    
    local_ip = get_local_ip()
    network_segment = get_network_segment(local_ip)
    available_ips = get_all_available_ips()
    last_rescan_time = time.time()  # Initialize to current time to avoid immediate scan
    
    while running:
        try:
            current_time = time.time()
            
            # Rescan for clients every CLIENT_RESCAN_INTERVAL seconds
            if current_time - last_rescan_time >= CLIENT_RESCAN_INTERVAL:
                last_rescan_time = current_time
                
                if network_segment:
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Rescanning for clients...")
                    active_clients = scan_lan_hosts(network_segment, CLIENT_PORT, SCAN_TIMEOUT, "client")
                    
                    if active_clients:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Found {len(active_clients)} active client(s)")
                        
                        # Sync to each active client
                        for client_ip in active_clients:
                            # Check if this is a new client
                            is_new_client = client_ip not in client_checksums
                            
                            if is_new_client:
                                print(f"[{datetime.now().strftime('%H:%M:%S')}] New client detected: {client_ip}:{CLIENT_PORT}")
                                print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting first sync (all files) for {client_ip}")
                            
                            # Sync files to this client
                            sync_files_to_client(client_ip, is_new_client)
                    else:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] No active clients found")
                else:
                    # Fallback: try to sync to configured CLIENT_IP
                    if CLIENT_IP and CLIENT_IP != "127.0.0.1":
                        is_new_client = CLIENT_IP not in client_checksums
                        sync_files_to_client(CLIENT_IP, is_new_client)
            
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
        print(f"Client scanning will begin in {CLIENT_RESCAN_INTERVAL} seconds...")
    else:
        print(f"\nCould not detect network segment. Using configured IP: {CLIENT_IP}:{CLIENT_PORT}")
    
    print("\nStarting sync service...")
    print(f"Client rescan interval: {CLIENT_RESCAN_INTERVAL} seconds")
    print(f"File sync interval: {SYNC_INTERVAL} seconds")
    
    try:
        sync_loop()
    except KeyboardInterrupt:
        print("\nShutting down...")
        running = False

if __name__ == "__main__":
    main()


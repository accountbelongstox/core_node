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
File Sync Client

ARCHITECTURE:
- Passive receiver model: Client listens for server connections
- Server-initiated push: Client receives files pushed by server
- Client autonomy: Client makes independent decisions about file replacement

WORKFLOW:
1. Client listens on port 8888 for server connections
2. Server connects and sends file metadata (path, size, mtime)
3. Client evaluates whether to accept file based on:
   - Ignore rules (reject if in IGNORE_DIRS)
   - File modification time (only accept if server file is newer)
   - File existence (handle new vs existing files)
4. Client sends decision to server (b'1' = accept, b'0' = reject)
5. If accepted, client receives file data and saves it
6. Client confirms receipt (b'1' = success, b'0' = failure)

KEY FEATURES:
- Autonomous decision making: Client decides file replacement independently
- Time-based comparison: Only replaces files if server version is newer
- Ignore rules: Automatically rejects files in ignored directories
- Safe file handling: Creates directories, preserves timestamps, handles errors
- Passive operation: Only responds to server-initiated connections
"""

import os
import sys
import socket
import threading
import json
import time
from pathlib import Path
from datetime import datetime

from common.network_util import get_local_ip, get_network_segment, scan_lan_hosts, get_all_available_ips, is_client_host, HostIdentifier
from common.config import (
    SYNC_PORT, IGNORE_DIRS, IGNORE_EXTENSIONS, IGNORE_FILES,
    CHUNK_SIZE, SCAN_TIMEOUT
)

# Configuration
LISTEN_PORT = SYNC_PORT
ROOT_DIR = Path(__file__).parent.parent
SERVER_PORT = SYNC_PORT

# Global state
running = True
server_socket = None
connected_servers = set()
server_lock = threading.Lock()
multiple_servers_detected_scan = False


def should_ignore_path(path):
    """
    Check if path should be ignored
    
    PURPOSE: Client-side filtering to reject unwanted files
    RULES:
    - Any path containing IGNORE_DIRS (e.g., node_modules) is rejected
    - Files with IGNORE_EXTENSIONS (e.g., .pyc, .pyo) are rejected
    - Files matching IGNORE_FILES (e.g., .DS_Store) are rejected
    RETURNS: True if path should be ignored, False otherwise
    NOTE: Client autonomously decides to reject ignored paths
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

def receive_file(sock):
    """
    Receive a file from server (Client decision-making)
    
    PURPOSE: Receive server-pushed file and make autonomous replacement decision
    PROTOCOL:
    1. Receive file metadata (path, size, mtime) from server
    2. Client evaluates whether to accept:
       a. Check ignore rules - reject if in IGNORE_DIRS
       b. Check file existence and modification time
       c. Only accept if server file is newer (mtime comparison)
    3. Send decision to server (b'1' = accept, b'0' = reject)
    4. If accepted, receive file data and save
    5. Send final confirmation (b'1' = success, b'0' = failure)
    
    CLIENT DECISION LOGIC:
    - REJECT if: Path is in ignore list (directories, extensions, filenames)
    - ACCEPT if: File doesn't exist (new file - first sync)
    - ACCEPT if: Local file exists AND server mtime > local mtime (server is newer)
    - REJECT if: Local file exists AND local mtime >= server mtime (local is newer or same)
    
    REPLACEMENT RULES:
    - Client only replaces files that don't exist OR where server modify-date is after local file
    - Client never replaces files where local version is newer or same
    
    AUTONOMOUS BEHAVIOR: Client makes all decisions independently
    Server cannot force file replacement - client has final say
    
    RETURNS: True if file was processed (accepted or rejected), False on error
    """
    try:
        size_bytes = sock.recv(4)
        if len(size_bytes) < 4:
            return False
        
        info_size = int.from_bytes(size_bytes, 'big')
        info_data = b''
        while len(info_data) < info_size:
            chunk = sock.recv(info_size - len(info_data))
            if not chunk:
                return False
            info_data += chunk
        
        file_info = json.loads(info_data.decode('utf-8'))
        file_path = file_info["path"]
        file_size = file_info["size"]
        server_mtime = file_info["mtime"]
        
        # CLIENT DECISION 1: Check ignore rules
        # Client autonomously rejects files in ignored directories
        if should_ignore_path(file_path):
            print(f"[CLIENT DECISION] Rejecting {file_path} - in ignore list")
            sock.sendall(b'0')
            return True
        
        target_path = ROOT_DIR / file_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # CLIENT DECISION 2: Evaluate file replacement based on modification time
        # Client replacement rules:
        # - Replace if: File doesn't exist (first sync)
        # - Replace if: Server modify-date is after local file (server is newer)
        # - Don't replace if: Local file exists AND local mtime >= server mtime
        should_update = True
        decision_reason = ""
        
        if target_path.exists():
            local_mtime = os.path.getmtime(target_path)
            if local_mtime >= server_mtime:
                # CLIENT DECISION: Local file is newer or same - reject update
                # Client only replaces if server modify-date is after local file
                should_update = False
                decision_reason = f"local file is newer or same (local: {local_mtime}, server: {server_mtime})"
            else:
                # CLIENT DECISION: Server file is newer - accept update
                # Server modify-date is after local file - replace it
                decision_reason = f"server file is newer (local: {local_mtime}, server: {server_mtime})"
        else:
            # CLIENT DECISION: New file - accept (first sync, file doesn't exist)
            decision_reason = "new file (doesn't exist)"
        
        if not should_update:
            print(f"[CLIENT DECISION] Rejecting {file_path} - {decision_reason}")
            sock.sendall(b'0')
            return True
        
        # CLIENT DECISION: Accept file - notify server and receive data
        print(f"[CLIENT DECISION] Accepting {file_path} - {decision_reason}")
        sock.sendall(b'1')
        
        # Receive file data from server
        received = 0
        with open(target_path, 'wb') as f:
            while received < file_size:
                chunk = sock.recv(min(CHUNK_SIZE, file_size - received))
                if not chunk:
                    break
                f.write(chunk)
                received += len(chunk)
        
        # CLIENT DECISION 3: Verify file receipt and confirm to server
        if received == file_size:
            # Success: Set file modification time to match server
            os.utime(target_path, (server_mtime, server_mtime))
            print(f"[CLIENT] Successfully received and saved: {file_path}")
            sock.sendall(b'1')
            return True
        else:
            # Failure: Incomplete transfer - delete partial file and notify server
            print(f"[CLIENT] Failed to receive complete file: {file_path} (received {received}/{file_size} bytes)")
            sock.sendall(b'0')
            if target_path.exists():
                target_path.unlink()
            return False
    except Exception as e:
        print(f"Error receiving file: {e}")
        try:
            sock.sendall(b'0')
        except:
            pass
        return False

def receive_batch_files(sock):
    """
    Receive multiple files from server in a single batch transfer

    PURPOSE: Client passively receives batch of files pushed by server
    PROTOCOL:
    Phase 1 - Metadata Exchange:
    1. Receive batch metadata: {"action": "batch_metadata", "files": [{path, size, mtime}, ...]}
    2. Make decisions for all files at once
    3. Send decision: {"action": "batch_decision", "accepted": [path1, path2, ...]}

    Phase 2 - Bulk Reception:
    4. For each accepted file, receive file data and save
    5. Send batch confirmation: {"action": "batch_complete", "success": bool, "received_count": N}

    CLIENT DECISION LOGIC (per file):
    1. Check ignore rules (reject if in ignore list)
    2. Compare modification time:
       - Accept if: File doesn't exist (new file)
       - Accept if: Server file is newer (server mtime > local mtime)
       - Reject if: Local file is same or newer (local mtime >= server mtime)

    ADVANTAGES:
    - Review entire batch before accepting (better decision making)
    - Single connection for multiple files (reduced overhead)
    - Comprehensive error tracking across batch

    RETURNS: True if batch was processed successfully, False otherwise
    """
    try:
        # Phase 1: Receive batch metadata
        size_bytes = sock.recv(4)
        if len(size_bytes) < 4:
            return False

        metadata_size = int.from_bytes(size_bytes, 'big')
        metadata_data = b''
        while len(metadata_data) < metadata_size:
            chunk = sock.recv(min(CHUNK_SIZE, metadata_size - len(metadata_data)))
            if not chunk:
                return False
            metadata_data += chunk

        batch_info = json.loads(metadata_data.decode('utf-8'))

        if batch_info.get("action") != "batch_metadata":
            print(f"[CLIENT] Invalid batch action: {batch_info.get('action')}")
            return False

        file_list = batch_info.get("files", [])
        file_count = batch_info.get("count", len(file_list))

        # Phase 2: Make decisions for all files
        accepted_files = []
        rejected_files = []
        file_decisions = {}  # path -> (should_accept, size, mtime, reason)

        total_files = len(file_list)
        processed = 0

        for file_meta in file_list:
            file_path = file_meta["path"]
            file_size = file_meta["size"]
            server_mtime = file_meta["mtime"]
            processed += 1

            # Show progress with line refresh
            sys.stdout.write(f"\r[CLIENT] Evaluating files: {processed}/{total_files}...")
            sys.stdout.flush()

            # CLIENT DECISION 1: Check ignore rules
            if should_ignore_path(file_path):
                file_decisions[file_path] = (False, file_size, server_mtime, "ignored")
                rejected_files.append((file_path, "ignored"))
                continue

            target_path = ROOT_DIR / file_path

            # CLIENT DECISION 2: Evaluate based on modification time
            should_update = True
            decision_reason = ""

            if target_path.exists():
                local_mtime = os.path.getmtime(target_path)
                if local_mtime >= server_mtime:
                    should_update = False
                    decision_reason = "local newer/same"
                else:
                    decision_reason = "server newer"
            else:
                decision_reason = "new file"

            file_decisions[file_path] = (should_update, file_size, server_mtime, decision_reason)

            if should_update:
                accepted_files.append(file_path)
            else:
                rejected_files.append((file_path, decision_reason))

        # Clear progress line and print summary
        sys.stdout.write("\r" + " " * 80 + "\r")
        sys.stdout.flush()

        # Phase 3: Send decision to server
        decision_response = {
            "action": "batch_decision",
            "accepted": accepted_files,
            "rejected_count": len(file_list) - len(accepted_files)
        }

        decision_json = json.dumps(decision_response).encode('utf-8')
        decision_size = len(decision_json)
        sock.sendall(decision_size.to_bytes(4, 'big'))
        sock.sendall(decision_json)

        if not accepted_files:
            # No files to receive - print summary
            print(f"[SUMMARY] Batch: {len(accepted_files)} accepted, {len(rejected_files)} rejected")
            return True

        # Phase 4: Receive accepted files
        received_count = 0
        failed_count = 0
        current_file = 0

        for file_path in accepted_files:
            should_accept, file_size, server_mtime, reason = file_decisions[file_path]
            target_path = ROOT_DIR / file_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            current_file += 1

            size_kb = file_size / 1024
            size_str = f"{size_kb:.1f}KB" if size_kb < 1024 else f"{size_kb/1024:.2f}MB"

            # Show progress with line refresh
            sys.stdout.write(f"\r[RECEIVING] [{current_file}/{len(accepted_files)}] {file_path} ({size_str})..." + " " * 20)
            sys.stdout.flush()

            # Receive file data
            received = 0
            try:
                with open(target_path, 'wb') as f:
                    while received < file_size:
                        chunk = sock.recv(min(CHUNK_SIZE, file_size - received))
                        if not chunk:
                            break
                        f.write(chunk)
                        received += len(chunk)

                # Verify receipt
                if received == file_size:
                    # Success: Set file modification time to match server
                    os.utime(target_path, (server_mtime, server_mtime))
                    received_count += 1
                else:
                    # Incomplete transfer
                    sys.stdout.write(f"\r[INCOMPLETE] {file_path} ({received}/{file_size} bytes)\n")
                    sys.stdout.flush()
                    if target_path.exists():
                        target_path.unlink()
                    failed_count += 1

            except Exception as e:
                sys.stdout.write(f"\r[ERROR] {file_path}: {e}\n")
                sys.stdout.flush()
                if target_path.exists():
                    target_path.unlink()
                failed_count += 1

        # Clear progress line
        sys.stdout.write("\r" + " " * 120 + "\r")
        sys.stdout.flush()

        # Phase 5: Send batch confirmation
        confirmation = {
            "action": "batch_complete",
            "success": failed_count == 0,
            "received_count": received_count,
            "failed_count": failed_count
        }

        confirm_json = json.dumps(confirmation).encode('utf-8')
        confirm_size = len(confirm_json)
        sock.sendall(confirm_size.to_bytes(4, 'big'))
        sock.sendall(confirm_json)

        # Print batch summary
        total_size = sum(file_decisions[f][1] for f in accepted_files)
        size_mb = total_size / (1024 * 1024)
        print(f"[SUMMARY] Batch complete: {received_count} received ({size_mb:.2f}MB), {failed_count} failed, {len(rejected_files)} rejected")
        return True

    except Exception as e:
        print(f"[CLIENT] Error receiving batch: {e}")
        try:
            # Send error response
            error_response = {
                "action": "batch_complete",
                "success": False,
                "received_count": 0,
                "error": str(e)
            }
            error_json = json.dumps(error_response).encode('utf-8')
            sock.sendall(len(error_json).to_bytes(4, 'big'))
            sock.sendall(error_json)
        except:
            pass
        return False

def handle_client(sock, addr):
    """
    Handle server connection (Client passive receiver)
    
    PURPOSE: Process incoming file push requests from server
    WORKFLOW:
    1. Server connects and starts pushing files
    2. Check if multiple servers are connected - stop and prompt if so
    3. For each file, client makes autonomous decision
    4. Client accepts or rejects based on local conditions
    5. Continue until server closes connection
    
    NOTE: Client is passive - only responds to server-initiated pushes
    Client has full autonomy to accept or reject any file
    MULTIPLE SERVER DETECTION: Stops and prompts if two or more servers connect
    """
    global running, connected_servers
    
    server_ip = addr[0]
    
    try:
        # Track connected server
        with server_lock:
            connected_servers.add(server_ip)
            server_count = len(connected_servers)
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Server connected from {addr}")
        
        # MULTIPLE SERVER DETECTION: Check if two or more servers are connected
        if server_count >= 2:
            print("\n" + "="*60)
            print("[ERROR] MULTIPLE SERVERS DETECTED!")
            print("="*60)
            print(f"Client has detected {server_count} active server(s):")
            for i, ip in enumerate(sorted(connected_servers), 1):
                print(f"  {i}. {ip}:{SERVER_PORT}")
            print("\n[PROMPT] Client cannot accept pushes from multiple servers.")
            print("[PROMPT] Please ensure only ONE server is running.")
            print("[PROMPT] Client will stop accepting connections.")
            print("="*60 + "\n")
            
            # Stop the client
            running = False
            if server_socket:
                try:
                    server_socket.close()
                except:
                    pass
            return
        
        # Process batch files from single server
        while running:
            if receive_batch_files(sock):
                continue
            else:
                break
    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        # Remove server from tracking when disconnected
        with server_lock:
            connected_servers.discard(server_ip)
        
        sock.close()
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Server disconnected from {server_ip}")

def start_server():
    """
    Start the file sync client listener
    
    PURPOSE: Listen for server connections and receive pushed files
    ARCHITECTURE:
    - Passive listener: Binds to 0.0.0.0:8888 and waits for connections
    - Multi-threaded: Each server connection handled in separate thread
    - Client autonomy: Each file decision made independently
    
    SERVER ROLE: Active pusher - initiates connections and pushes files
    CLIENT ROLE: Passive receiver - listens and makes autonomous decisions
    """
    global server_socket, running
    
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(('0.0.0.0', LISTEN_PORT))
    server_socket.listen(5)
    server_socket.settimeout(1.0)
    
    print(f"File Sync Client")
    print(f"Root directory: {ROOT_DIR}")
    print(f"Listening on port: {LISTEN_PORT}")
    print(f"Ignoring directories: {', '.join(sorted(IGNORE_DIRS))}")
    print(f"Ignoring extensions: {', '.join(sorted(IGNORE_EXTENSIONS))}")
    print(f"Ignoring files: {', '.join(sorted(IGNORE_FILES))}")
    print("Waiting for server connections...")
    
    while running:
        try:
            sock, addr = server_socket.accept()
            client_thread = threading.Thread(target=handle_client, args=(sock, addr))
            client_thread.daemon = True
            client_thread.start()
        except socket.timeout:
            continue
        except Exception as e:
            if running:
                print(f"Error accepting connection: {e}")
            break
    
    if server_socket:
        server_socket.close()

def scan_for_servers():
    """
    Scan LAN for available server IPs
    
    MULTIPLE SERVER DETECTION: If two or more servers are found during scan,
    the client will stop and prompt the user.
    
    NOTE: Filters out other clients - only reports actual servers
    
    RETURNS:
    - str: Server IP if exactly one server found
    - None: If no servers found OR if multiple servers detected (stops client)
    """
    global multiple_servers_detected_scan
    
    multiple_servers_detected_scan = False
    local_ip = get_local_ip()
    network_segment = get_network_segment(local_ip)
    available_ips = get_all_available_ips()
    
    if not network_segment:
        print("\n[SCAN] Could not detect network segment")
        return None
    
    print(f"\n[SCAN] Detected network segment: {network_segment}")
    print(f"[SCAN] Scanning for servers on port {SERVER_PORT}...")
    
    # Scan for any hosts with the port open (could be servers or clients)
    all_hosts = scan_lan_hosts(network_segment, SERVER_PORT, SCAN_TIMEOUT, "server")
    
    if not all_hosts:
        print(f"[SCAN] No hosts found on port {SERVER_PORT}")
        return None
    
    # Filter out all local IP addresses (this client's IPs)
    local_ips_set = set(available_ips)
    other_hosts = [ip for ip in all_hosts if ip not in local_ips_set]
    
    if not other_hosts:
        print(f"[SCAN] No other hosts found (only this client's IPs detected)")
        return None
    
    # Use HostIdentifier class to filter out other clients
    print(f"[SCAN] Checking {len(other_hosts)} host(s) to identify clients vs servers...")
    identifier = HostIdentifier(SERVER_PORT, SCAN_TIMEOUT)
    filtered = identifier.filter_hosts(other_hosts, exclude_local_ips=local_ips_set, exclude_type="client")
    
    clients_found = filtered["clients"]
    actual_servers = filtered["servers"]
    
    # Display identification results
    for host_ip in other_hosts:
        host_type = identifier.identify_host(host_ip)
        if host_type == "client":
            print(f"[SCAN] {host_ip}:{SERVER_PORT} - identified as CLIENT (ignoring)")
        elif host_type == "server":
            print(f"[SCAN] {host_ip}:{SERVER_PORT} - identified as SERVER")
    
    if clients_found:
        print(f"[SCAN] Filtered out {len(clients_found)} client(s)")
    
    if not actual_servers:
        print(f"[SCAN] No servers found (only clients detected)")
        return None
    
    server_count = len(actual_servers)
    print(f"\n[SCAN] Found {server_count} active server(s):")
    for i, server_ip in enumerate(actual_servers, 1):
        marker = " <-- AUTO-SELECTED" if i == 1 else ""
        print(f"  {i}. {server_ip}:{SERVER_PORT}{marker}")
    
    # MULTIPLE SERVER DETECTION: Stop and prompt if two or more servers found
    if server_count >= 2:
        print("\n" + "="*60)
        print("[ERROR] MULTIPLE SERVERS DETECTED DURING SCAN!")
        print("="*60)
        print(f"Client has detected {server_count} active server(s) on the network:")
        for i, ip in enumerate(actual_servers, 1):
            print(f"  {i}. {ip}:{SERVER_PORT}")
        print("\n[PROMPT] Client cannot work with multiple servers.")
        print("[PROMPT] Please ensure only ONE server is running.")
        print("[PROMPT] Client will stop.")
        print("="*60 + "\n")
        multiple_servers_detected_scan = True
        return None  # Return None to signal multiple servers detected
    
    return actual_servers[0]

def main():
    """Main entry point"""
    global running
    
    local_ip = get_local_ip()
    
    print(f"File Sync Client")
    print(f"Root directory: {ROOT_DIR}")
    print(f"Listening on port: {LISTEN_PORT}")
    print(f"Ignoring directories: {', '.join(sorted(IGNORE_DIRS))}")
    print(f"Ignoring extensions: {', '.join(sorted(IGNORE_EXTENSIONS))}")
    print(f"Ignoring files: {', '.join(sorted(IGNORE_FILES))}")
    
    if local_ip:
        print(f"Local IP: {local_ip}")
    
    print("\n[INFO] Scanning for available servers...")
    server_ip = scan_for_servers()
    
    # Check if multiple servers were detected during scan
    if multiple_servers_detected_scan:
        print("\n[INFO] Client stopped due to multiple servers detected during scan.")
        return
    
    if server_ip:
        print(f"\n[INFO] Server auto-detected: {server_ip}:{SERVER_PORT}")
        print(f"[INFO] Client will accept connections from any IP")
        print(f"[INFO] WARNING: If multiple servers connect, client will stop and prompt.")
    else:
        print(f"\n[INFO] No servers found during scan, client will accept connections from any IP")
        print(f"[INFO] WARNING: If multiple servers connect, client will stop and prompt.")
    
    print("\n[INFO] Starting client service...")
    print("Waiting for server connections...")
    
    try:
        start_server()
    except KeyboardInterrupt:
        print("\nShutting down...")
        running = False
        if server_socket:
            server_socket.close()

if __name__ == "__main__":
    main()


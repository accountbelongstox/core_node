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
import json
import time
from pathlib import Path
from datetime import datetime

# Configuration
LISTEN_PORT = 8888
ROOT_DIR = Path(__file__).parent.parent
IGNORE_DIRS = {"node_modules"}

# Global state
running = True
server_socket = None

def should_ignore_path(path):
    """Check if path should be ignored"""
    path_parts = Path(path).parts
    for part in path_parts:
        if part in IGNORE_DIRS:
            return True
    return False

def receive_file(sock):
    """Receive a file from server"""
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
        
        if should_ignore_path(file_path):
            sock.sendall(b'0')
            return True
        
        target_path = ROOT_DIR / file_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        should_update = True
        if target_path.exists():
            local_mtime = os.path.getmtime(target_path)
            if local_mtime >= server_mtime:
                should_update = False
        
        if not should_update:
            sock.sendall(b'0')
            remaining = file_size
            while remaining > 0:
                chunk = sock.recv(min(8192, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
            return True
        
        sock.sendall(b'1')
        
        received = 0
        with open(target_path, 'wb') as f:
            while received < file_size:
                chunk = sock.recv(min(8192, file_size - received))
                if not chunk:
                    break
                f.write(chunk)
                received += len(chunk)
        
        if received == file_size:
            os.utime(target_path, (server_mtime, server_mtime))
            sock.sendall(b'1')
            return True
        else:
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

def handle_client(sock, addr):
    """Handle client connection from server"""
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Server connected from {addr}")
        while True:
            if receive_file(sock):
                continue
            else:
                break
    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        sock.close()
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Server disconnected")

def start_server():
    """Start the file sync server"""
    global server_socket, running
    
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(('0.0.0.0', LISTEN_PORT))
    server_socket.listen(5)
    server_socket.settimeout(1.0)
    
    print(f"File Sync Client")
    print(f"Root directory: {ROOT_DIR}")
    print(f"Listening on port: {LISTEN_PORT}")
    print(f"Ignoring directories: {', '.join(IGNORE_DIRS)}")
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

def main():
    """Main entry point"""
    global running
    
    try:
        start_server()
    except KeyboardInterrupt:
        print("\nShutting down...")
        running = False
        if server_socket:
            server_socket.close()

if __name__ == "__main__":
    main()


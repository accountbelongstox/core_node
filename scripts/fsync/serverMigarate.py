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
import shutil
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# Configuration
SOURCE_DIR = "/www"
DEST_DIR = "/www_new"
LISTEN_PORT = 3900
SYNC_INTERVAL = 10  # seconds

# Global stats
stats = {
    'total_files': 0,
    'copied_files': 0,
    'skipped_files': 0,
    'failed_files': 0,
    'total_bytes': 0,
    'start_time': time.time(),
    'last_sync_time': 0,
    'sync_in_progress': False
}

# Add a global sync availability flag and error message
sync_available = True
sync_error_msg = ''
# Add sync round counters
sync_round_completed = 0
sync_round_in_progress = 0

class SyncHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.send_header('Refresh', '10')
        self.end_headers()
        
        current_time = time.time()
        elapsed = current_time - stats['start_time']
        mb_copied = stats['total_bytes'] / (1024 * 1024)
        
        # If sync is unavailable, show error and restart command
        extra_html = ''
        if not sync_available:
            extra_html = f'''
            <div style="color:red;"><b>Sync paused:</b> {sync_error_msg}</div>
            <div style="margin-top:10px;">
                <b>Restart service command:</b><br>
                <code>systemctl restart custom-servermigarate</code><br>
                <b>Check service status:</b><br>
                <code>systemctl status custom-servermigarate</code>
            </div>
            <div style="margin-top:10px;color:#888;">You can modify the script and restart the service</div>
            '''

        # Show sync round info
        round_info = f"<p>Sync rounds completed: {sync_round_completed}, in progress: {sync_round_in_progress}</p>"

        response = f"""
        <html>
            <head><title>File Sync Status</title></head>
            <body>
                <h1>File Synchronization Status</h1>
                <p>Source: {SOURCE_DIR} → Destination: {DEST_DIR}</p>
                <p>Last sync: {time.ctime(stats['last_sync_time'])}</p>
                <p>Sync in progress: {'Yes' if stats['sync_in_progress'] else 'No'}</p>
                {round_info}
                {extra_html}
                <hr>
                <h2>Statistics:</h2>
                <table border="1">
                    <tr><td>Total files processed:</td><td>{stats['total_files']}</td></tr>
                    <tr><td>Files copied:</td><td>{stats['copied_files']}</td></tr>
                    <tr><td>Files skipped:</td><td>{stats['skipped_files']}</td></tr>
                    <tr><td>Files failed:</td><td>{stats['failed_files']}</td></tr>
                    <tr><td>Total data copied:</td><td>{mb_copied:.2f} MB</td></tr>
                    <tr><td>Total time elapsed:</td><td>{elapsed:.2f} seconds</td></tr>
                </table>
            </body>
        </html>
        """
        self.wfile.write(response.encode('utf-8'))

def sync_files():
    global sync_available, sync_error_msg, sync_round_completed, sync_round_in_progress
    while True:
        # Check if directories exist
        if not os.path.exists(SOURCE_DIR):
            sync_available = False
            sync_error_msg = f"Source directory does not exist: {SOURCE_DIR}"
            time.sleep(SYNC_INTERVAL)
            continue
        if not os.path.exists(DEST_DIR):
            sync_available = False
            sync_error_msg = f"Destination directory does not exist: {DEST_DIR}"
            time.sleep(SYNC_INTERVAL)
            continue
        sync_available = True
        sync_error_msg = ''
        try:
            sync_round_in_progress = sync_round_completed + 1
            print(f"[Sync] Starting round {sync_round_in_progress}")
            stats['sync_in_progress'] = True
            stats['last_sync_time'] = time.time()
            for root, dirs, files in os.walk(SOURCE_DIR):
                rel_path = os.path.relpath(root, SOURCE_DIR)
                dest_root = os.path.join(DEST_DIR, rel_path)
                # Create directories if they don't exist
                if not os.path.exists(dest_root):
                    os.makedirs(dest_root)
                for file in files:
                    src_file = os.path.join(root, file)
                    dest_file = os.path.join(dest_root, file)
                    stats['total_files'] += 1
                    try:
                        # Check if file needs to be copied
                        if not os.path.exists(dest_file) or \
                           os.path.getsize(src_file) != os.path.getsize(dest_file) or \
                           os.path.getmtime(src_file) > os.path.getmtime(dest_file):
                            shutil.copy2(src_file, dest_file)
                            stats['copied_files'] += 1
                            stats['total_bytes'] += os.path.getsize(src_file)
                        else:
                            stats['skipped_files'] += 1
                    except Exception as e:
                        stats['failed_files'] += 1
                        print(f"Error copying {src_file}: {str(e)}")
            print(f"[Sync] Completed round {sync_round_in_progress}")
            sync_round_completed += 1
            sync_round_in_progress = 0
        except Exception as e:
            print(f"Sync error: {str(e)}")
        finally:
            stats['sync_in_progress'] = False
            time.sleep(SYNC_INTERVAL)

def run_server():
    server = HTTPServer(('', LISTEN_PORT), SyncHandler)
    print(f"Starting server on port {LISTEN_PORT}")
    server.serve_forever()

if __name__ == '__main__':
    # Create destination directory if it doesn't exist
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)
    
    # Start sync thread
    sync_thread = threading.Thread(target=sync_files)
    sync_thread.daemon = True
    sync_thread.start()
    
    # Start HTTP server
    run_server()
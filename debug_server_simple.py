"""
Simple test to capture scrcpy-server stderr output
"""
import os
import sys
import time
import subprocess
import random
import threading

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from pycore.pyutils.scrcpy_init import initialize_scrcpy, get_adb_path

def print_output(pipe, prefix):
    """Print output from pipe in real-time"""
    for line in iter(pipe.readline, b''):
        try:
            print(f"[{prefix}] {line.decode('utf-8', errors='ignore').rstrip()}")
        except:
            pass

def main():
    # Initialize scrcpy
    initialize_scrcpy()
    adb_path = str(get_adb_path())

    # Get first device
    result = subprocess.run([adb_path, "devices"], capture_output=True, text=True)
    devices = []
    for line in result.stdout.strip().split('\n')[1:]:
        if line.strip():
            parts = line.split()
            if len(parts) >= 2 and parts[1] == 'device':
                devices.append(parts[0])

    if not devices:
        print("No devices found!")
        return

    serial = devices[0]
    print(f"Using device: {serial}\n")

    # Setup parameters
    scid = random.randint(0, 0x7FFFFFFF)
    scid_hex = f"{scid:08x}"  # CRITICAL: Server expects hex string!
    print(f"SCID: {scid_hex} (hex string), {scid} (decimal value)")

    # Setup environment
    env = os.environ.copy()
    env['ANDROID_SERIAL'] = serial
    env['MSYS_NO_PATHCONV'] = '1'

    # Build server command
    server_cmd = [
        "cd", "/data/local/tmp", "&&",
        "CLASSPATH=scrcpy-server",
        "app_process",
        ".",
        "com.genymobile.scrcpy.Server",
        "3.3.3",
        f"scid={scid_hex}",  # CRITICAL: Must be hex string!
        "log_level=debug",
        "audio=false",
        "max_size=720",
        "max_fps=60",
        "video_bit_rate=8000000",
        "video_codec=h264",
        "tunnel_forward=true"
    ]

    shell_command = ' '.join(server_cmd)
    adb_cmd = [adb_path, "-s", serial, "shell", shell_command]

    print(f"Starting scrcpy-server...")
    print(f"Command: {shell_command}\n")

    # Start server process
    server_process = subprocess.Popen(
        adb_cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.PIPE
    )

    # Create threads to read output
    stdout_thread = threading.Thread(target=print_output, args=(server_process.stdout, "STDOUT"))
    stderr_thread = threading.Thread(target=print_output, args=(server_process.stderr, "STDERR"))
    stdout_thread.daemon = True
    stderr_thread.daemon = True
    stdout_thread.start()
    stderr_thread.start()

    # Wait and observe
    print("Server output (waiting 5 seconds):\n")
    time.sleep(5)

    # Terminate
    server_process.terminate()
    server_process.wait()
    print("\nServer terminated")

if __name__ == "__main__":
    main()

"""
Debug scrcpy-server startup and connection issues
"""
import os
import sys
import time
import socket
import subprocess
import random

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from pycore.pyutils.scrcpy_init import initialize_scrcpy, get_adb_path, get_scrcpy_path

def find_free_port():
    """Find an available local port"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

def main():
    # Initialize scrcpy
    initialize_scrcpy()
    adb_path = str(get_adb_path())
    scrcpy_path = str(get_scrcpy_path())
    print(f"ADB path: {adb_path}")
    print(f"Scrcpy path: {scrcpy_path}")

    # Get device serial
    result = subprocess.run([adb_path, "devices"], capture_output=True, text=True)
    print("\nConnected devices:")
    print(result.stdout)

    devices = []
    for line in result.stdout.strip().split('\n')[1:]:
        if line.strip():
            parts = line.split()
            if len(parts) >= 2 and parts[1] == 'device':
                devices.append(parts[0])

    if not devices:
        print("No devices found!")
        return

    # Use first device
    serial = devices[0]
    print(f"\nUsing device: {serial}")

    # Setup parameters
    scid = random.randint(0, 0x7FFFFFFF)
    device_socket_name = f"scrcpy_{scid:08x}"
    tunnel_port = find_free_port()

    print(f"\nTest parameters:")
    print(f"  SCID: {scid:08x} (hex), {scid} (decimal)")
    print(f"  Device socket: localabstract:{device_socket_name}")
    print(f"  Tunnel port: {tunnel_port}")

    # Setup environment
    env = os.environ.copy()
    env['ANDROID_SERIAL'] = serial
    env['MSYS_NO_PATHCONV'] = '1'

    # Try FORWARD tunnel
    print(f"\n=== Setting up FORWARD tunnel ===")
    forward_cmd = [
        adb_path,
        "-s", serial,
        "forward",
        f"tcp:{tunnel_port}",
        f"localabstract:{device_socket_name}"
    ]
    print(f"Command: {' '.join(forward_cmd)}")

    result = subprocess.run(forward_cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FORWARD tunnel failed: {result.stderr}")
        return
    print("[OK] FORWARD tunnel established")

    # Build server command
    server_cmd = [
        "cd", "/data/local/tmp", "&&",
        "CLASSPATH=scrcpy-server",
        "app_process",
        ".",
        "com.genymobile.scrcpy.Server",
        "3.3.3",
        f"scid={scid}",
        "log_level=debug",
        "audio=false",
        "max_size=720",
        "max_fps=60",
        "video_bit_rate=8000000",
        "video_codec=h264",
        "tunnel_forward=true"
    ]

    shell_command = ' '.join(server_cmd)
    adb_cmd = [
        adb_path,
        "-s", serial,
        "shell",
        shell_command
    ]

    print(f"\n=== Starting scrcpy-server ===")
    print(f"Shell command: {shell_command}")
    print(f"ADB command: {' '.join(adb_cmd)}")

    # Start server process with output capture
    print("\n=== Server output (stderr) ===")
    server_process = subprocess.Popen(
        adb_cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.PIPE
    )

    # Wait a bit for server to start
    print("Waiting for server to start...")
    time.sleep(2)

    # Try to connect
    print(f"\n=== Attempting connection to forwarded port {tunnel_port} ===")

    max_retries = 50
    retry_interval = 0.1
    video_socket = None

    for retry in range(max_retries):
        try:
            video_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            video_socket.settimeout(10.0)
            video_socket.connect(('localhost', tunnel_port))
            print(f"[OK] Video socket connected to port {tunnel_port}")
            break
        except (ConnectionRefusedError, OSError) as e:
            video_socket.close()
            video_socket = None
            if retry < max_retries - 1:
                if retry % 10 == 0 and retry > 0:
                    print(f"Connection refused (retry {retry + 1}/{max_retries})")
                time.sleep(retry_interval)
            else:
                print(f"[ERROR] Failed to connect after {max_retries} retries: {e}")
                break

    if not video_socket:
        print("\n=== Server stderr output ===")
        stderr_output = server_process.stderr.read()
        print(stderr_output.decode('utf-8', errors='ignore'))
        server_process.terminate()
        return

    # CRITICAL: According to scrcpy source code (DesktopConnection.java line 68-70)
    # Dummy byte is sent IMMEDIATELY after accept() on the first socket
    # We MUST read it before connecting other sockets, otherwise it may be lost
    print("\n=== Reading dummy byte from video socket ===")
    import select
    ready_sockets, _, _ = select.select([video_socket], [], [], 5.0)

    if not ready_sockets:
        print("[ERROR] Timeout waiting for dummy byte on video socket")
        video_socket.close()
        server_process.terminate()
        return

    try:
        dummy_byte = video_socket.recv(1)
        if not dummy_byte:
            print("[ERROR] Connection closed while reading dummy byte")
            video_socket.close()
            server_process.terminate()
            return
        else:
            print(f"[OK] Dummy byte received: {dummy_byte.hex()}")
    except Exception as e:
        print(f"[ERROR] Error reading dummy byte: {e}")
        video_socket.close()
        server_process.terminate()
        return

    # NOW connect control socket (server is waiting for it)
    print(f"\n=== Connecting control socket to port {tunnel_port} ===")
    control_socket = None
    for retry in range(max_retries):
        try:
            control_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            control_socket.settimeout(10.0)
            control_socket.connect(('localhost', tunnel_port))
            print(f"[OK] Control socket connected to port {tunnel_port}")
            break
        except (ConnectionRefusedError, OSError) as e:
            control_socket.close()
            control_socket = None
            if retry < max_retries - 1:
                time.sleep(retry_interval)
            else:
                print(f"[ERROR] Failed to connect control socket after {max_retries} retries: {e}")
                break

    if not control_socket:
        print("\n=== Server stderr output ===")
        stderr_output = server_process.stderr.read()
        print(stderr_output.decode('utf-8', errors='ignore'))
        video_socket.close()
        server_process.terminate()
        return

    # Try to read device metadata (sent on first socket after dummy byte)
    print("\n=== Reading device metadata (64 bytes) ===")
    try:
        name_bytes = b''
        while len(name_bytes) < 64:
            chunk = video_socket.recv(64 - len(name_bytes))
            if not chunk:
                print(f"[ERROR] Connection closed while reading metadata (got {len(name_bytes)} bytes)")
                break
            name_bytes += chunk

        if len(name_bytes) == 64:
            device_name = name_bytes.split(b'\x00')[0].decode('utf-8', errors='ignore')
            print(f"[OK] Device name: {device_name}")
    except Exception as e:
        print(f"[ERROR] Error reading metadata: {e}")

    # Check server stderr
    print("\n=== Server stderr output ===")
    # Give server a moment to output any errors
    time.sleep(0.5)

    # Read available stderr (non-blocking)
    import select
    ready_fds, _, _ = select.select([server_process.stderr], [], [], 0.1)
    if ready_fds:
        stderr_output = server_process.stderr.read()
        print(stderr_output.decode('utf-8', errors='ignore'))
    else:
        print("(No stderr output available)")

    # Cleanup
    print("\n=== Cleanup ===")
    if video_socket:
        video_socket.close()
    if control_socket:
        control_socket.close()
    server_process.terminate()
    server_process.wait()

    subprocess.run([adb_path, "-s", serial, "forward", "--remove", f"tcp:{tunnel_port}"],
                   env=env, capture_output=True)
    print("[OK] Cleanup complete")

if __name__ == "__main__":
    main()

import os
import subprocess
import threading
import time
from colorama import Fore, Style, init

# Initialize colorama for colored output
init(autoreset=True)

# Paths to executables
CURSOR_VIP_PATH = r"D:\programing\cursor-vip\build\cursor-vip_windows_amd64.exe"
CURSOR_EXE_PATH = os.path.join(os.getenv("LOCALAPPDATA"), "Programs", "cursor", "Cursor.exe")

# Global flag to indicate when cursor-vip is running
cursor_vip_running = False

def is_process_running(process_name):
    """Check if a process is running by name."""
    try:
        result = subprocess.run(["tasklist"], capture_output=True, text=True)
        return process_name.lower() in result.stdout.lower()
    except Exception as e:
        print(Fore.RED + f"❌ Error checking process: {e}")
        return False

def start_cursor_vip():
    """Start cursor-vip_windows_amd64.exe and capture its output."""
    global cursor_vip_running

    if is_process_running("cursor-vip_windows_amd64.exe"):
        print(Fore.YELLOW + "⚠ cursor-vip_windows_amd64.exe is already running.")
        cursor_vip_running = True
        return

    print(Fore.CYAN + "🚀 Starting cursor-vip_windows_amd64.exe...")

    try:
        process = subprocess.Popen(
            CURSOR_VIP_PATH, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
        )

        # Read output in real-time
        for line in process.stdout:
            print(Fore.BLUE + "[cursor-vip] " + Style.RESET_ALL + line.strip())

            # Check if the process is successfully running
            if "success" in line.lower() or "listening" in line.lower():
                cursor_vip_running = True

    except Exception as e:
        print(Fore.RED + f"❌ Failed to start cursor-vip: {e}")

def start_cursor():
    """Wait for cursor-vip to start, then launch Cursor.exe."""
    while not cursor_vip_running:
        print(Fore.YELLOW + "⏳ Waiting for cursor-vip to be fully operational...")
        time.sleep(2)

    print(Fore.GREEN + "✔ cursor-vip is running! Launching Cursor.exe...")
    
    try:
        subprocess.Popen(["explorer", CURSOR_EXE_PATH], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(Fore.GREEN + "🎉 Cursor.exe launched successfully!")
    except Exception as e:
        print(Fore.RED + f"❌ Failed to start Cursor.exe: {e}")

# Start threads
thread_vip = threading.Thread(target=start_cursor_vip, daemon=True)
thread_cursor = threading.Thread(target=start_cursor, daemon=True)

thread_vip.start()
thread_cursor.start()

# Keep main thread alive
thread_vip.join()
thread_cursor.join()

import os
import subprocess
import threading
import time
import re
from colorama import Fore, Style, init
from pathlib import Path
import zipfile
import shutil
import webbrowser
from urllib.request import Request, urlopen
import sys

# Initialize colorama for colored output
init(autoreset=True)

# 获取脚本所在目录
SCRIPT_DIR = Path(__file__).parent.resolve()
# 构建.bin目录路径
CACHE_DIR = SCRIPT_DIR.parent.parent / ".cache"
BIN_DIR = CACHE_DIR / "bin"
BIN_DIR.mkdir(parents=True, exist_ok=True)


# Paths to executables
CURSOR_VIP_PATH = str(BIN_DIR / "cursor-vip_windows_amd64.exe")
CURSOR_EXE_PATH = os.path.join(os.getenv("LOCALAPPDATA"), "Programs", "cursor", "Cursor.exe")

# Global variables
cursor_vip_running = False
last_message = None
last_full_message = None  # 新增：记录完整格式消息
lock = threading.Lock()
TIME_PATTERN = re.compile(r'\b\d+d \d+h \d+m \d+s\b')

def log_message(message, color=Fore.WHITE, emoji=None):
    """Smart logging with duplicate prevention and dynamic formatting"""
    global last_message, last_full_message
    with lock:
        # Store message without emoji for comparison
        clean_message = f"{emoji} {message}" if emoji else message
        core_message = message.strip()  # Message without decorative elements
        
        is_time = TIME_PATTERN.search(core_message) is not None
        last_was_time = TIME_PATTERN.search(str(last_message)) is not None if last_message else False
        
        try:
            term_width = os.get_terminal_size().columns
        except OSError:
            term_width = 80

        # Build display message with emoji
        display_message = f"{emoji} {message}" if emoji else message
        msg_length = len(display_message)
        padding = max(0, term_width - msg_length)
        current_full = f"{color}{display_message}{' ' * padding}"

        # Skip if core message is identical (ignoring emoji/formatting)
        if core_message == last_message:
            return

        # Time message handling
        if is_time:
            print(current_full, end='\r', flush=True)
            last_full_message = current_full
            last_message = core_message
        else:
            print(f"{color}{display_message}")
            last_message = core_message
            last_full_message = None

def is_process_running(process_name):
    """Check if a process is running by name."""
    try:
        result = subprocess.run(["tasklist"], capture_output=True, text=True)
        return process_name.lower() in result.stdout.lower()
    except Exception as e:
        log_message(f"Error checking process: {e}", Fore.RED, emoji="❌")
        return False

def download_cursor_vip():
    """Download cursor-vip executable with proper validation"""
    log_message("cursor-vip not found, attempting download...", Fore.YELLOW, emoji="⚠️")
    
    # 在下载前确保目录存在
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    
    # Download URLs
    download_url = "https://github.com/kingparks/cursor-vip/releases/download/preview/cursor-vip_windows_amd64.exe"
    releases_url = "https://github.com/kingparks/cursor-vip/releases"
    
    try:
        # Download with browser-like headers
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # 修改curl命令的输出路径
        curl_cmd = [
            "curl", "-L", "-o", CURSOR_VIP_PATH,
            "-H", f"User-Agent: {headers['User-Agent']}",
            download_url
        ]
        
        result = subprocess.run(curl_cmd, check=True, capture_output=True, text=True)
        
        # Validate downloaded file
        if not os.path.exists(CURSOR_VIP_PATH):
            raise FileNotFoundError("Download failed - no file created")
            
        file_size = os.path.getsize(CURSOR_VIP_PATH)
        if file_size < 1024*1024:  # Less than 1MB
            raise ValueError(f"File too small ({file_size} bytes), likely invalid download")
            
        # Check if file is HTML (failed download page)
        with open(CURSOR_VIP_PATH, "rb") as f:
            if b"<html>" in f.read(1024):
                raise ValueError("Download returned HTML content instead of executable")
                
        log_message(f"Downloaded cursor-vip ({file_size//1024} KB)", Fore.GREEN, emoji="✅")
        return True
        
    except Exception as e:
        log_message(f"Download failed: {str(e)}", Fore.RED, emoji="❌")
        if os.path.exists(CURSOR_VIP_PATH):
            try:
                os.remove(CURSOR_VIP_PATH)
                log_message("Removed invalid file", Fore.YELLOW, emoji="⚠️")
            except Exception as remove_error:
                log_message(f"Cleanup failed: {remove_error}", Fore.YELLOW, emoji="⚠️")
        
        # Open browser as fallback
        log_message("Opening browser for manual download...", Fore.CYAN, emoji="🌐")
        webbrowser.open(releases_url)
        return False

def execute_command(command, success_message, error_prefix, color=Fore.WHITE):
    """Common method to execute commands with real-time output logging"""
    try:
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        
        # Read output in real-time
        for line in process.stdout:
            log_message(f"{error_prefix}{line.strip()}", color)
            
        process.wait()
        if process.returncode == 0 and success_message:
            log_message(success_message, Fore.GREEN, "✅")
        return process.returncode
        
    except Exception as e:
        log_message(f"{error_prefix}Error: {str(e)}", Fore.RED, "❌")
        return -1

def start_cursor_vip():
    """Start cursor-vip service with validation"""
    global cursor_vip_running
    
    if not os.path.exists(CURSOR_VIP_PATH):
        if not download_cursor_vip():
            log_message("Missing cursor-vip executable", Fore.RED, "❌")
            return
            
    log_message("Starting cursor-vip service...", Fore.BLUE, "🚀")

    if is_process_running("cursor-vip_windows_amd64.exe"):
        log_message("cursor-vip is already running", Fore.YELLOW, "⚠️")
        cursor_vip_running = True
        return

    # Use common execute method
    return_code = execute_command(
        command=CURSOR_VIP_PATH,
        success_message="cursor-vip service started",
        error_prefix="[cursor-vip] ",
        color=Fore.BLUE
    )
    
    if return_code == 0:
        cursor_vip_running = True

def start_cursor():
    """Wait for cursor-vip to start, then launch Cursor.exe."""
    while not cursor_vip_running:
        # log_message("Waiting for cursor-vip to be fully operational...", Fore.YELLOW, emoji="⏳")
        time.sleep(2)

    log_message("cursor-vip is running! Launching Cursor.exe...", Fore.GREEN, emoji="✔️")
    
    try:
        subprocess.Popen(["explorer", CURSOR_EXE_PATH], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log_message("Cursor.exe launched successfully!", Fore.GREEN, emoji="🎉")
    except Exception as e:
        log_message(f"Failed to start Cursor.exe: {e}", Fore.RED, emoji="❌")
# Start threads
thread_vip = threading.Thread(target=start_cursor_vip, daemon=True)
thread_cursor = threading.Thread(target=start_cursor, daemon=True)

# Add rclone thread startup

thread_vip.start()
thread_cursor.start()

# Keep main thread alive
thread_vip.join()
thread_cursor.join()


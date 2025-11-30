import ctypes
import os
import subprocess
import tempfile
import json
import time
from pathlib import Path

# Win32 API constants
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79

# Use ctypes to define Win32 structures
class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long)]

# EnumDisplayMonitors callback structure
class MONITORINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint),
                ("rcMonitor", RECT),
                ("rcWork", RECT),
                ("dwFlags", ctypes.c_uint)]

# Global list for window enumeration (used by callback)
_enum_windows_list = []

# ============================================================================
# Configuration Variables - Adjust these to change window layout
# ============================================================================

# Window grid layout: how many windows to create
GRID_COLUMNS = 3  # Number of columns in the grid
GRID_ROWS = 2     # Number of rows in the grid
# Total windows = GRID_COLUMNS * GRID_ROWS (default: 3 * 2 = 6 windows)

# Character size ratio based on actual measurement
# Column measurement: 67 columns = 510px (actual measurement)
# Row measurement: If actual height is 485px but calculated is 798px, need actual row count for 485px
# Reverse calculation: If target is ~800px and actual is 485px, ratio needs adjustment
MEASURED_COLUMNS = 67   # Actual measured columns
MEASURED_COLUMNS_WIDTH_PX = 510  # Actual measured width for these columns

# Row measurement: Need to find what term_rows value gives 485px actual height
# If calculated: term_rows * CHAR_HEIGHT = 798px, but actual = 485px
# Then: actual_term_rows * CHAR_HEIGHT = 485px
# So we need: actual_term_rows / calculated_term_rows = 485 / 798 ≈ 0.6075
# If calculated term_rows ≈ 270, then actual_term_rows ≈ 164
# So: 164 rows = 485px -> CHAR_HEIGHT = 485/164 ≈ 2.9573
# But if this still gives wrong result, we need actual measured term_rows value
MEASURED_ROWS = 164     # Actual measured rows that produce 485px height
MEASURED_ROWS_HEIGHT_PX = 485    # Actual measured height for these rows

# Calculate character dimensions from measurement (Step 1: Character pixel ratio)
# IMPORTANT: Column and Row have DIFFERENT ratios - both can be adjusted independently
CHAR_WIDTH = MEASURED_COLUMNS_WIDTH_PX / MEASURED_COLUMNS   # pixels per column = 510/67 ≈ 7.6119
CHAR_HEIGHT = MEASURED_ROWS_HEIGHT_PX / MEASURED_ROWS       # pixels per row = 485/164 ≈ 2.9573

# Temp directory for batch files
USERNAME = os.getenv('USERNAME') or os.getenv('USER')
TEMP_DIR = Path(f'C:\\Users\\{USERNAME}\\.core_node\\launch_multiple')

def get_screen_dimensions():
    """Get virtual desktop dimensions (entire OS desktop across all monitors)"""
    user32 = ctypes.windll.user32
    
    try:
        # Get virtual screen position and size (covers all monitors)
        screen_x = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
        screen_y = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
        screen_width = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
        screen_height = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)
        
        if screen_width <= 0 or screen_height <= 0:
            raise ValueError("Invalid virtual screen dimensions from GetSystemMetrics")
        
        print("Using Win32 API: Virtual desktop (all monitors) dimensions")
        print(f"Screen dimensions: {screen_width}x{screen_height}")
        print(f"Screen position: {screen_x}, {screen_y}")
        return screen_x, screen_y, screen_width, screen_height
    except Exception as e:
        # Fallback: Calculate virtual desktop from all screens using EnumDisplayMonitors
        print("Warning: Win32 API method failed, calculating from all screens")
        try:
            # Use EnumDisplayMonitors to get all monitor bounds
            monitors_bounds = []  # Use closure to capture this list
            
            def monitor_enum_proc(hMonitor, hdcMonitor, lprcMonitor, dwData):
                """Callback for EnumDisplayMonitors"""
                monitor_info = MONITORINFO()
                monitor_info.cbSize = ctypes.sizeof(MONITORINFO)
                if user32.GetMonitorInfoW(hMonitor, ctypes.byref(monitor_info)):
                    rect = monitor_info.rcMonitor
                    monitors_bounds.append((rect.left, rect.top, rect.right, rect.bottom))
                return True
            
            MonitorEnumProc = ctypes.WINFUNCTYPE(ctypes.c_bool,
                                                  ctypes.POINTER(ctypes.c_int),  # HMONITOR
                                                  ctypes.POINTER(ctypes.c_int),  # HDC
                                                  ctypes.POINTER(RECT),         # LPRECT
                                                  ctypes.c_ulong)                # LPARAM
            callback = MonitorEnumProc(monitor_enum_proc)
            
            user32.EnumDisplayMonitors.argtypes = [ctypes.POINTER(ctypes.c_int),
                                                     ctypes.POINTER(RECT),
                                                     MonitorEnumProc,
                                                     ctypes.c_ulong]
            user32.EnumDisplayMonitors.restype = ctypes.c_bool
            
            user32.EnumDisplayMonitors(None, None, callback, 0)
            
            if monitors_bounds:
                # Calculate bounding box of all monitors
                min_x = min(b[0] for b in monitors_bounds)
                min_y = min(b[1] for b in monitors_bounds)
                max_x = max(b[2] for b in monitors_bounds)
                max_y = max(b[3] for b in monitors_bounds)
                
                screen_x = min_x
                screen_y = min_y
                screen_width = max_x - min_x
                screen_height = max_y - min_y
                
                print(f"Using EnumDisplayMonitors: Calculated virtual desktop from {len(monitors_bounds)} screen(s)")
                print(f"Screen dimensions: {screen_width}x{screen_height}")
                print(f"Screen position: {screen_x}, {screen_y}")
                return screen_x, screen_y, screen_width, screen_height
            else:
                raise ValueError("No monitors found")
        except Exception as e2:
            print(f"Error: Failed to get screen dimensions: {e2}")
            # Last resort: use primary monitor via Win32 API
            screen_width = user32.GetSystemMetrics(0)  # SM_CXSCREEN
            screen_height = user32.GetSystemMetrics(1)  # SM_CYSCREEN
            print("Using Win32 API: Primary screen dimensions only")
            print(f"Screen dimensions: {screen_width}x{screen_height}")
            return 0, 0, screen_width, screen_height

def get_cache_path():
    """Get cache file path"""
    username = os.getenv('USERNAME') or os.getenv('USER')
    cache_dir = Path(f'C:\\Users\\{username}\\.core_node\\launch_multiple')
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / 'char_size_cache.json'

def load_char_size_cache():
    """Load character size cache from file"""
    cache_path = get_cache_path()
    if cache_path.exists():
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_char_size_cache(cache):
    """Save character size cache to file"""
    cache_path = get_cache_path()
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2)

def get_window_rect(hwnd):
    """Get window rectangle using Win32 API"""
    user32 = ctypes.windll.user32
    rect = RECT()
    if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        width = rect.right - rect.left
        height = rect.bottom - rect.top
        return (rect.left, rect.top, width, height)
    return None

def find_windows_terminal_window():
    """Find Windows Terminal window by title"""
    user32 = ctypes.windll.user32
    
    def enum_windows_proc(hwnd, lParam):
        title_length = user32.GetWindowTextLengthW(hwnd)
        if title_length > 0:
            title = ctypes.create_unicode_buffer(title_length + 1)
            user32.GetWindowTextW(hwnd, title, title_length + 1)
            if "Windows Terminal" in title.value or "wt.exe" in title.value:
                lParam.append(hwnd)
        return True
    
    windows = []
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.py_object))
    user32.EnumWindows(EnumWindowsProc(enum_windows_proc), ctypes.pointer(ctypes.py_object(windows)))
    return windows[0] if windows else None

def measure_char_size_from_test_window():
    """Launch a test window and measure actual character size"""
    print("No cache found, launching test window to measure character size...")
    
    # Launch a test window with known column and row count
    test_cols = 80
    test_rows = 25
    test_pos_x = 100
    test_pos_y = 100
    
    # Create test bat file
    username = os.getenv('USERNAME') or os.getenv('USER')
    temp_dir = Path(f'C:\\Users\\{username}\\.core_node\\launch_multiple')
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    test_bat = temp_dir / 'test_window.bat'
    cmd = f'wt.exe --pos "{test_pos_x},{test_pos_y}" --size "{test_cols}.{test_rows}"'
    with open(test_bat, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('@echo off\r\n')
        f.write(cmd + '\r\n')
    
    # Launch test window
    subprocess.Popen(['cmd', '/c', str(test_bat)],
                     creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                     close_fds=True)
    
    # Wait for window to appear and stabilize
    time.sleep(2)
    
    # Find and measure the window
    hwnd = None
    user32 = ctypes.windll.user32
    
    def enum_proc(h, lParam):
        """Callback function to enumerate windows"""
        global _enum_windows_list
        # Convert pointer to integer handle value
        hwnd_value = ctypes.cast(h, ctypes.c_void_p).value
        if hwnd_value:
            title_len = user32.GetWindowTextLengthW(hwnd_value)
            if title_len > 0:
                title = ctypes.create_unicode_buffer(title_len + 1)
                user32.GetWindowTextW(hwnd_value, title, title_len + 1)
                if "Windows Terminal" in title.value:
                    _enum_windows_list.append(hwnd_value)
        return True
    
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))
    callback = EnumWindowsProc(enum_proc)
    
    for attempt in range(10):
        global _enum_windows_list
        _enum_windows_list.clear()
        user32.EnumWindows(callback, None)
        
        if _enum_windows_list:
            # Get the one at the test position
            for w in _enum_windows_list:
                rect = get_window_rect(w)
                if rect and abs(rect[0] - test_pos_x) < 50 and abs(rect[1] - test_pos_y) < 50:
                    hwnd = w
                    break
        if hwnd:
            break
        time.sleep(0.5)
    
    if not hwnd:
        print("Warning: Could not find test window, using default values")
        return (16, 8)
    
    # Get actual window size
    rect = get_window_rect(hwnd)
    if not rect:
        print("Warning: Could not get window size, using default values")
        return (16, 8)
    
    actual_width, actual_height = rect[2], rect[3]
    
    # Calculate character dimensions
    char_width = actual_width / test_cols
    char_height = actual_height / test_rows
    
    print(f"Measured character size: width={char_width:.2f}px, height={char_height:.2f}px")
    
    # Close test window
    try:
        ctypes.windll.user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
    except:
        pass
    
    return (char_width, char_height)

def get_char_size(screen_width, screen_height):
    """Get character size based on actual measurement ratio"""
    # Use global configuration values
    print(f"Using fixed character size ratio: width={CHAR_WIDTH:.4f}px, height={CHAR_HEIGHT:.4f}px")
    print(f"  (Based on measurement: {MEASURED_COLUMNS} columns = {MEASURED_COLUMNS_WIDTH_PX}px, {MEASURED_ROWS} rows = {MEASURED_ROWS_HEIGHT_PX}px)")
    return (CHAR_WIDTH, CHAR_HEIGHT)

def calculate_window_layout(screen_x, screen_y, screen_width, screen_height):
    """Calculate window positions and sizes for grid layout - Multi-step calculation"""
    # Use global configuration
    columns = GRID_COLUMNS
    rows = GRID_ROWS
    
    # Step 1: Calculate target window pixel size based on screen division
    # This is the target size we want each window to be
    target_window_width = screen_width // columns  # Screen width divided by grid columns
    target_window_height = screen_height // rows    # Screen height divided by grid rows
    
    # Step 2: Calculate terminal columns and rows needed for target window size
    # Based on character pixel ratio (CHAR_WIDTH and CHAR_HEIGHT)
    term_columns = int(target_window_width / CHAR_WIDTH)   # How many columns fit in target width
    term_rows = int(target_window_height / CHAR_HEIGHT)     # How many rows fit in target height
    
    # Step 3: Calculate actual pixel size that these terminal columns/rows will produce
    # This shows the actual window size that will be created
    actual_window_width = term_columns * CHAR_WIDTH
    actual_window_height = term_rows * CHAR_HEIGHT
    
    print(f"\nCalculation steps:")
    print(f"  Column pixel ratio: {MEASURED_COLUMNS} columns = {MEASURED_COLUMNS_WIDTH_PX}px -> {CHAR_WIDTH:.4f}px per column")
    print(f"  Row pixel ratio: {MEASURED_ROWS} rows = {MEASURED_ROWS_HEIGHT_PX}px -> {CHAR_HEIGHT:.4f}px per row")
    print(f"  Step 1 - Target window size: Screen {screen_width}x{screen_height} / Grid {columns}x{rows} = {target_window_width}x{target_window_height}px")
    print(f"  Step 2 - Terminal size calculation:")
    print(f"    Columns: {target_window_width}px / {CHAR_WIDTH:.4f}px-per-column = {term_columns} columns")
    print(f"    Rows: {target_window_height}px / {CHAR_HEIGHT:.4f}px-per-row = {term_rows} rows")
    print(f"  Step 3 - Actual window size:")
    print(f"    Width: {term_columns} columns * {CHAR_WIDTH:.4f}px-per-column = {actual_window_width:.1f}px")
    print(f"    Height: {term_rows} rows * {CHAR_HEIGHT:.4f}px-per-row = {actual_window_height:.1f}px")
    print(f"  Result: Terminal size = {term_columns}.{term_rows}, Window size = {actual_window_width:.1f}x{actual_window_height:.1f}px\n")
    
    windows = []
    for row in range(rows):
        for col in range(columns):
            x = screen_x + (col * target_window_width)
            y = screen_y + (row * target_window_height)
            windows.append((x, y, term_columns, term_rows, actual_window_width, actual_window_height))
    
    return windows

def create_temp_bat(bat_path, x, y, term_cols, term_rows):
    """Create a temporary batch file to launch Windows Terminal with position and size"""
    # Use proper batch file format with Windows line endings
    # --pos requires quoted x,y format (pixel coordinates): --pos "x,y"
    # --size requires quoted c.r format (columns.rows): --size "c.r"
    cmd = f'wt.exe --pos "{x},{y}" --size "{term_cols}.{term_rows}"'
    lines = [
        '@echo off',
        cmd
    ]
    with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('\r\n'.join(lines) + '\r\n')
    print(f"Created batch file: {bat_path} with command: {cmd}")

def main():
    # Step 0: Display configuration
    print("=" * 60)
    print("Window Layout Calculator - Step by Step")
    print("=" * 60)
    print(f"Character size measurement:")
    print(f"  Column ratio: {MEASURED_COLUMNS} columns = {MEASURED_COLUMNS_WIDTH_PX}px -> {CHAR_WIDTH:.4f}px per column")
    print(f"  Row ratio: {MEASURED_ROWS} rows = {MEASURED_ROWS_HEIGHT_PX}px -> {CHAR_HEIGHT:.4f}px per row")
    print(f"Grid layout: {GRID_COLUMNS} columns x {GRID_ROWS} rows = {GRID_COLUMNS * GRID_ROWS} windows")
    print(f"Calculation: Window size = Screen / Grid, then convert to columns.rows using column/row ratios")
    print("=" * 60)
    
    # Step 1: Get screen dimensions
    screen_x, screen_y, screen_width, screen_height = get_screen_dimensions()
    
    # Step 2: Calculate window layout using multi-step calculation
    windows = calculate_window_layout(screen_x, screen_y, screen_width, screen_height)
    
    # Create temp directory
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    
    total_windows = GRID_COLUMNS * GRID_ROWS
    print(f"\nConfiguration: {GRID_COLUMNS}x{GRID_ROWS} grid = {total_windows} windows")
    print(f"Temp directory: {TEMP_DIR}")
    print(f"Terminal size (columns.rows): {windows[0][2]}.{windows[0][3]}")
    print(f"Window pixel size: {windows[0][4]}x{windows[0][5]}\n")
    
    # Create batch files and launch windows
    bat_files = []
    for i, (x, y, term_cols, term_rows, pixel_width, pixel_height) in enumerate(windows, 1):
        bat_path = TEMP_DIR / f'launch_terminal_{i}.bat'
        create_temp_bat(bat_path, x, y, term_cols, term_rows)
        bat_files.append(bat_path)
    
    # Launch windows using explorer (so they are not child processes of Python)
    # explorer accepts only one parameter (the file path)
    # However, explorer opening a .bat file directly will open file browser, not execute it
    # So we need to use cmd /c to execute the bat file, which ensures independence from Python
    import time
    for i, bat_path in enumerate(bat_files, 1):
        x, y, term_cols, term_rows, pixel_width, pixel_height = windows[i-1]
        print(f"Launching terminal window {i} at position: {x},{y} with size: {term_cols}.{term_rows} (pixel: {pixel_width}x{pixel_height})")
        # Use subprocess with DETACHED_PROCESS to launch bat file independently
        # This mimics explorer behavior: launches process independently from Python
        subprocess.Popen(['cmd', '/c', str(bat_path)], 
                        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                        close_fds=True)
        # Add small delay to avoid rapid sequential launches
        time.sleep(0.2)
    
    print(f"\nAll {total_windows} terminal windows launched.")

if __name__ == '__main__':
    main()


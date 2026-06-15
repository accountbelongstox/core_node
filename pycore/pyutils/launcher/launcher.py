# -*- coding: utf-8 -*-
"""
Window Launcher Main Module
Main entry point for launching multiple windows in grid layout
"""

import sys
from pathlib import Path

# Add project root to Python path to enable pycore imports
# This MUST be done before importing from pycore
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Now import remaining stdlib and pycore modules
import platform
import os
import tempfile
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime, run_background

from pycore.pyutils.launcher.screen_manager import ScreenManager
from pycore.pyutils.launcher.ratio_calculator import RatioCalculator
from pycore.pyutils.launcher.wt_launcher import WindowsTerminalLauncher
from pycore.pyutils.launcher.editor_launcher import EditorLauncher
from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.menu import InteractiveMenu
from pycore.pyutils.common.icon_generator import DesktopIconGenerator


# ============================================================================
# Legacy constants - DEPRECATED: Use ConfigManager instead
# These are kept for backward compatibility but should be removed
# ============================================================================
# Note: All configuration should now come from ConfigManager
# These constants are only used as fallbacks when config is not available


class WindowLauncher:
    """Main launcher class for managing window grid layout"""
    
    def __init__(self, grid_columns=None, grid_rows=None,
                 measured_columns=None, measured_rows=None,
                 measured_width_px=None, measured_height_px=None,
                 calibration_actual_height=None, calibration_term_rows=None,
                 window_chrome_title_bar_px=None, window_chrome_horizontal_px=None,
            window_chrome_content_scale=None):
        """
        Initialize window launcher.

        Args:
            grid_columns, grid_rows: Grid size.
            measured_columns, measured_rows, measured_width_px, measured_height_px: Ratio calibration.
            calibration_actual_height, calibration_term_rows: Height calibration.
            window_chrome_title_bar_px: Reserve px for title bar (default 56).
            window_chrome_horizontal_px: Reserve px for horizontal chrome (default 24).
            window_chrome_content_scale: Scale content so window fits in cell, 0-1 (default 0.78). See WT_LAYOUT_REFERENCE.md.
        """
        # Use provided values or defaults (3x2 grid, standard measurements)
        self.grid_columns = grid_columns or 3
        self.grid_rows = grid_rows or 2
        
        # Use provided calibration or defaults
        self.calibration_actual_height = calibration_actual_height or 485
        self.calibration_term_rows = calibration_term_rows or 270
        # WT --size is content only; full window has title bar + padding. Reserve + scale so each window fits in cell.
        self.window_chrome_title_bar_px = window_chrome_title_bar_px if window_chrome_title_bar_px is not None else 56
        self.window_chrome_horizontal_px = window_chrome_horizontal_px if window_chrome_horizontal_px is not None else 24
        self.window_chrome_content_scale = window_chrome_content_scale if window_chrome_content_scale is not None else 0.78
        
        # If calibration provided, adjust measured values dynamically
        if self.calibration_actual_height and self.calibration_term_rows:
            # Recalculate measured height based on calibration
            adjusted_measured_height = self.calibration_actual_height
            adjusted_measured_rows = self.calibration_term_rows
        else:
            adjusted_measured_height = measured_height_px or 485
            adjusted_measured_rows = measured_rows or 164
        
        # Initialize ratio calculator
        self.ratio_calc = RatioCalculator(
            measured_columns or 67,
            adjusted_measured_rows,
            measured_width_px or 510,
            adjusted_measured_height
        )
        
        # Initialize screen manager
        self.screen_manager = ScreenManager()
        
        # Initialize launchers
        self.script_generator = ScriptGenerator()
        self.wt_launcher = WindowsTerminalLauncher(self.script_generator)
        self.editor_launcher = EditorLauncher(self.script_generator)
    
    def calculate_window_layout(self, screen_x, screen_y, screen_width, screen_height):
        """
        Calculate window positions and sizes for grid layout.

        WT semantics (Microsoft Learn - command-line arguments):
        - Screen and --pos: PIXELS. Screen is pixel size (e.g. 3840x2160). --pos x,y is window
          top-left position in pixels.
        - --size c,r: CHARACTER CELLS (columns c, rows r), NOT pixels. Content area in pixels
          = c * px_per_column + r * px_per_row (depends on profile font). Full window = content
          + title bar + padding. So we reserve window_chrome pixels and compute c,r from
          (cell_px - chrome) to avoid overlap.

        Returns:
            list: List of tuples (x, y, term_cols, term_rows, actual_width, actual_height)
        """
        columns = self.grid_columns
        rows = self.grid_rows
        
        # Step 1: Cell size from screen division (pixels per grid cell)
        target_window_width = screen_width // columns
        target_window_height = screen_height // rows
        # Step 1b: Reserve chrome then scale content so full window stays inside cell (avoids overlap).
        content_width = max(80, int((target_window_width - self.window_chrome_horizontal_px) * self.window_chrome_content_scale))
        content_height = max(40, int((target_window_height - self.window_chrome_title_bar_px) * self.window_chrome_content_scale))
        
        # Step 2: Compute columns and rows so (content_px + chrome) fits in cell -> no overlap
        calibration_height = None
        if hasattr(self, 'calibration_actual_height') and self.calibration_actual_height:
            calibration_height = self.calibration_actual_height
        
        term_columns, term_rows, actual_width, actual_height = \
            self.ratio_calc.calculate_term_size(
                content_width,
                content_height,
                actual_height_px=calibration_height
            )
        
        # Step 3: Print calculation and WT/screen correspondence
        ratio_info = self.ratio_calc.get_info()
        print(f"\nCalculation steps:")
        print(f"  WT/screen: --pos = pixels (window top-left); --size = character cells (cols.rows); content px = cols*px_per_col + rows*px_per_row.")
        print(f"  Column pixel ratio: {ratio_info['column_ratio']}")
        print(f"  Row pixel ratio: {ratio_info['row_ratio']}")
        print(f"  Step 1 - Cell size (px): Screen {screen_width}x{screen_height} / Grid {columns}x{rows} = {target_window_width}x{target_window_height}px")
        print(f"  Step 1b - Content target (chrome {self.window_chrome_horizontal_px}px H, {self.window_chrome_title_bar_px}px V; scale {self.window_chrome_content_scale}): {content_width}x{content_height}px")
        print(f"  Step 2 - Terminal size (character cells):")
        print(f"    Columns: {content_width}px / {self.ratio_calc.char_width:.4f}px-per-column = {term_columns} columns")
        print(f"    Rows: {content_height}px / {self.ratio_calc.char_height:.4f}px-per-row = {term_rows} rows")
        print(f"  Step 3 - Content size (px):")
        print(f"    Width: {term_columns} cols * {self.ratio_calc.char_width:.4f} px/col = {actual_width:.1f}px")
        print(f"    Height: {term_rows} rows * {self.ratio_calc.char_height:.4f} px/row = {actual_height:.1f}px")
        print(f"  Result: --size \"{term_columns}.{term_rows}\" (character cells) -> content {actual_width:.1f}x{actual_height:.1f}px; add chrome so window fits in {target_window_width}x{target_window_height}px cell.\n")
        
        windows = []
        for row in range(rows):
            for col in range(columns):
                x = screen_x + (col * target_window_width)
                y = screen_y + (row * target_window_height)
                windows.append((x, y, term_columns, term_rows, actual_width, actual_height))
        
        return windows
    
    def calculate_ubuntu_count(self, total_windows):
        """
        Calculate number of Ubuntu terminals to launch
        
        Args:
            total_windows: Total number of windows
        
        Returns:
            int: Number of Ubuntu terminals (at least 2, 4 if 16 windows)
        """
        if total_windows >= 16:
            return 4
        elif total_windows >= 2:
            return 2
        else:
            return 0
    
    def launch_windows(self, delay=0.2):
        """
        Launch windows in grid layout (Windows Terminal and Ubuntu terminals)
        
        Args:
            delay: Delay between window launches in seconds
        
        Returns:
            list: List of created batch file paths
        """
        # Get screen dimensions
        screen_x, screen_y, screen_width, screen_height = self.screen_manager.get_screen_dimensions()
        
        # Calculate total windows
        total_windows = self.grid_columns * self.grid_rows
        
        # Calculate Ubuntu count (at least 2, 4 if 16 windows)
        ubuntu_count = self.calculate_ubuntu_count(total_windows)
        
        # Calculate window layout (all windows, including Ubuntu positions)
        windows = self.calculate_window_layout(screen_x, screen_y, screen_width, screen_height)
        
        # Prepare windows config for launcher
        windows_config = [(x, y, term_cols, term_rows) for x, y, term_cols, term_rows, _, _ in windows]
        
        # Launch Windows Terminal and Ubuntu windows
        bat_files = self.wt_launcher.launch_windows(windows_config, delay, ubuntu_count)
        
        wt_count = total_windows - ubuntu_count
        print(f"\nAll {total_windows} terminal windows launched:")
        print(f"  - {wt_count} Windows Terminal windows")
        if ubuntu_count > 0:
            print(f"  - {ubuntu_count} Ubuntu terminals")
        
        return bat_files
    
    def launch_editors(self, app_name, delay=0.2, file_paths=None):
        """
        Launch editor windows (chrome/vscode/cursor) in grid layout
        
        Args:
            app_name: Application name ('chrome', 'vscode', 'cursor')
            delay: Delay between window launches in seconds
            file_paths: Optional list of file paths to open (one per window)
        
        Returns:
            list: List of created batch file paths
        """
        # Get screen dimensions
        screen_x, screen_y, screen_width, screen_height = self.screen_manager.get_screen_dimensions()
        
        # Calculate window layout (using pixel dimensions for editors)
        target_window_width = screen_width // self.grid_columns
        target_window_height = screen_height // self.grid_rows
        
        windows_config = []
        for row in range(self.grid_rows):
            for col in range(self.grid_columns):
                x = screen_x + (col * target_window_width)
                y = screen_y + (row * target_window_height)
                file_path = file_paths[col + row * self.grid_columns] if file_paths and col + row * self.grid_columns < len(file_paths) else None
                if file_path:
                    windows_config.append((x, y, target_window_width, target_window_height, file_path))
                else:
                    windows_config.append((x, y, target_window_width, target_window_height))
        
        # Launch editor windows
        if app_name.lower() == 'chrome':
            return self.editor_launcher.launch_chrome(windows_config, delay)
        elif app_name.lower() == 'vscode':
            return self.editor_launcher.launch_vscode(windows_config, delay)
        elif app_name.lower() == 'cursor':
            return self.editor_launcher.launch_cursor(windows_config, delay)
        else:
            raise ValueError(f"Unknown app name: {app_name}")


def get_windows_version():
    """Get Windows version (win10 or win11)"""
    try:
        version = platform.version()
        build = int(version.split('.')[-1]) if '.' in version else 0
        # Windows 11 build number is 22000 or higher
        return 'win11' if build >= 22000 else 'win10'
    except:
        # Default to win11 if detection fails
        return 'win11'


def get_dev_env_path():
    """Get dev environment path based on Windows version"""
    win_version = get_windows_version()
    dev_path = Path(f'D:\\.dev_{win_version}\\.winenvs')
    dev_path.mkdir(parents=True, exist_ok=True)
    return dev_path


def ensure_desktop_shortcut():
    """Ensure desktop shortcut exists, create or replace if needed"""
    icon_generator = DesktopIconGenerator()
    shortcut_name = "Window Launcher"
    launcher_py_path = Path(__file__).resolve()
    
    # Create bat file in dev environment directory
    dev_env_path = get_dev_env_path()
    bat_path = dev_env_path / 'launch.bat'
    
    # Get Python executable
    python_exe = sys.executable
    
    # Create bat file content - use start with /B to run in background and avoid cmd window
    # Change to launcher directory to ensure correct working directory
    launcher_dir = launcher_py_path.parent
    bat_content = f'@echo off\r\ncd /d "{launcher_dir}"\r\n"{python_exe}" "{launcher_py_path}"\r\n'
    
    # Write bat file (overwrite if exists)
    with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(bat_content)
    
    print(f"Created/updated bat file: {bat_path}")
    
    # Use icon.ico if available, then icon.png, otherwise use Python icon
    icon_ico_path = launcher_dir / 'icon.ico'
    icon_png_path = launcher_dir / 'icon.png'
    if icon_ico_path.exists():
        icon_path = str(icon_ico_path)
    elif icon_png_path.exists():
        icon_path = str(icon_png_path)
    else:
        icon_path = python_exe
    
    # Create desktop shortcut pointing to bat file (will create or overwrite)
    try:
        icon_generator.create_shortcut(
            target_path=bat_path,
            name=shortcut_name,
            icon_path=icon_path,  # Use icon.ico, icon.png, or Python icon
            working_dir=str(launcher_dir),  # Set working directory to launcher directory
            description="Launch Window Launcher - Multiple Terminal Windows"
        )
        print(f"Created/updated desktop shortcut: {shortcut_name}")
    except Exception as e:
        print(f"Warning: Failed to create desktop shortcut: {e}")


# Use file lock to ensure warning is shown only once (even across multiple imports)
def show_admin_permission_warning():
    """Show warning about administrator permission for shortcut (only once) - using file lock"""
    # Use a lock file to ensure only one process shows the warning
    lock_file = Path(tempfile.gettempdir()) / 'window_launcher_admin_warning_shown.lock'
    
    # Check if warning was already shown (check lock file)
    if lock_file.exists():
        return
    
    # Create lock file immediately to prevent duplicate warnings
    try:
        lock_file.touch()
    except:
        pass  # If we can't create lock file, continue anyway
    
    # Print warning WITHOUT ANSI codes to avoid Windows terminal issues
    # Simple text output that won't cause duplicate printing
    print("\n" + "=" * 60)
    print("WARNING: Administrator Permission Required")
    print("=" * 60)
    print("Please add 'Run as administrator' permission to the")
    print("'Window Launcher' desktop shortcut:")
    print("\nSteps:")
    print("1. Right-click on 'Window Launcher' shortcut on desktop")
    print("2. Select 'Properties'")
    print("3. Go to 'Advanced' tab (or 'Compatibility' tab)")
    print("4. Check 'Run as administrator'")
    print("5. Click 'OK' to save")
    print("\nThis will ensure proper window positioning and permissions.")
    print("=" * 60 + "\n")


def launch_device_sync():
    """
    Launch device sync in background mode.

    This starts the device synchronization service which allows:
    - Setting device as primary (file server)
    - Setting device as secondary (sync client)
    - Auto-discovery of primary device on network
    - File synchronization control

    The process runs in background (detached from launcher):
    - Windows: Uses pythonw.exe with DETACHED_PROCESS flags
    - Linux: Uses start_new_session for proper process detachment
    """
    # DISABLED: Device Sync - code kept below, uncomment return to re-enable
    return
    # --- Device Sync implementation (disabled) ---
    print("[Launcher] Starting Device Sync in background...")

    # Get project root directory
    project_root = Path(__file__).parent.parent.parent.parent

    try:
        # Create log file for debugging
        log_dir = Path(tempfile.gettempdir()) / 'device_sync'
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / 'device_sync_launcher.log'

        print(f"[Launcher] Project root: {project_root}")
        print(f"[Launcher] Log file: {log_file}")

        # Determine Python executable (use pythonw.exe on Windows if available)
        python_exe = sys.executable
        if platform.system() == 'Windows':
            python_dir = Path(sys.executable).parent
            pythonw_exe = python_dir / 'pythonw.exe'
            if pythonw_exe.exists():
                python_exe = str(pythonw_exe)
                print(f"[Launcher] Using pythonw.exe for no console window")
            else:
                print("[Launcher] WARNING: pythonw.exe not found, using python.exe")

        # Build command
        cmd = [python_exe, '-m', 'pycore.pyutils.launcher.device_sync', str(project_root)]
        print(f"[Launcher] Command: {' '.join(cmd)}")

        # Set up environment with PYTHONPATH
        env = os.environ.copy()

        # Add project root to PYTHONPATH (platform-specific separator)
        pythonpath = str(project_root)
        if 'PYTHONPATH' in env:
            separator = ';' if platform.system() == 'Windows' else ':'
            pythonpath = f"{pythonpath}{separator}{env['PYTHONPATH']}"
        env['PYTHONPATH'] = pythonpath
        print(f"[Launcher] PYTHONPATH: {pythonpath}")

        # Launch process in background using pybasecommon
        proc = run_background(
            cmd,
            env=env,
            log_file=str(log_file),
            detached=True
        )

        print(f"[Launcher] Process started with PID: {proc.pid}")
        print("[Launcher] Device Sync started in background")
        print("[Launcher] Process will continue running after launcher exits")

        # Check if already running
        import time
        time.sleep(0.5)  # Give it time to start

        from pycore.pyutils.launcher.device_sync.ipc_server import check_single_instance
        if check_single_instance(45678):
            print("[Launcher] Verified: Device Sync is running")
        else:
            print("[Launcher] Warning: Could not verify Device Sync status")

    except Exception as e:
        print(f"[Launcher] Failed to start Device Sync: {e}")
        print("[Launcher] You can start manually with:")
        print(f"[Launcher]   python -m pycore.pyutils.launcher.device_sync")


def launch_pycore_module():
    """
    Launch Pycore Module Caller in background (subprocess).

    Runs pycore_module_caller.py with pythonw on Windows for no console window.
    Process is detached so it continues after launcher exits.
    """
    print("[Launcher] Starting Pycore Module in background...")

    project_root = Path(__file__).parent.parent.parent.parent
    caller_script = project_root / 'pycore_module_caller.py'

    if not caller_script.exists():
        print(f"[Launcher] Failed: pycore_module_caller.py not found at {caller_script}")
        return

    try:
        log_dir = Path(tempfile.gettempdir()) / 'pycore_module'
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / 'pycore_module_launcher.log'
        print(f"[Launcher] Pycore Module log dir: {log_dir}")

        python_exe = sys.executable
        if platform.system() == 'Windows':
            python_dir = Path(sys.executable).parent
            pythonw_exe = python_dir / 'pythonw.exe'
            if pythonw_exe.exists():
                python_exe = str(pythonw_exe)
                print("[Launcher] Using pythonw.exe for no console window")
            else:
                print("[Launcher] WARNING: pythonw.exe not found, using python.exe")

        cmd = [python_exe, str(caller_script)]
        env = os.environ.copy()
        pythonpath = str(project_root)
        if 'PYTHONPATH' in env:
            sep = ';' if platform.system() == 'Windows' else ':'
            pythonpath = f"{pythonpath}{sep}{env['PYTHONPATH']}"
        env['PYTHONPATH'] = pythonpath

        print(f"[Launcher] Command: {' '.join(cmd)}")

        proc = run_background(
            cmd,
            cwd=str(project_root),
            env=env,
            log_file=str(log_file),
            detached=True
        )

        print(f"[Launcher] Pycore Module started with PID: {proc.pid}")
        print("[Launcher] RPC v2 will be available after startup (default port 59000)")

        import time
        time.sleep(0.5)
    except Exception as e:
        print(f"[Launcher] Failed to start Pycore Module: {e}")
        print("[Launcher] You can start manually: python pycore_module_caller.py")


def main():
    """Main entry point"""
    # Check and create desktop shortcut if needed
    ensure_desktop_shortcut()
    
    # Show administrator permission warning (only once)
    show_admin_permission_warning()
    
    # Load configuration and find applications
    config_manager = ConfigManager()
    app_finder = AppFinder()
    script_generator = ScriptGenerator()
    
    # Fix version names (migrate old format to English) in config only
    apps_config = config_manager.get_applications_config()
    config_updated = False
    
    for app_name, app_config in apps_config.items():
        # Fix version names (migrate old format to English)
        if app_name == 'chrome':
            version = app_config.get('version', 'stable')
            # Convert old format version names to English if needed
            version_map = {
                'stable': 'stable',
                'canary': 'canary',
                'beta': 'beta'
            }
            # If version is not in standard format, default to stable
            if version not in version_map:
                version = 'stable'
                config_manager.set('applications.chrome.version', 'stable')
                config_updated = True
            else:
                version = version_map.get(version, 'stable')
    
    if config_updated:
        config_manager.save_config()
    
    # Note: Application path cache is stored in app_cache.json by AppFinder
    # Do NOT write paths to config.json automatically
    # Paths are only written when user explicitly finds applications via menu
    
    # Show prompt
    print("\n" + "=" * 60)
    print("Window Launcher - Startup Options")
    print("=" * 60)
    print("Options:")
    print("  [1] - Launch Window Layout Only")
    print("  [2] - Launch Pycore Module Only (background)")
    print("  [3] - Launch Both (Window Layout + Pycore Module)")
    print("  [M] - Configuration Menu")
    print("  [Enter] - Default (Launch Both)")
    print("=" * 60)
    print("Tip: If admin rights are needed, right-click the desktop shortcut -> Run as administrator.")
    print("=" * 60)
    user_input = input("Select option: ").strip().upper()

    launch_windows = True
    launch_module = False

    if user_input == '1':
        launch_windows = True
        launch_module = False
        print("\n[Launcher] Mode: Window Layout Only")
    elif user_input == '2':
        launch_windows = False
        launch_module = True
        print("\n[Launcher] Mode: Pycore Module Only")
    elif user_input == '3' or user_input == '':
        launch_windows = True
        launch_module = True
        print("\n[Launcher] Mode: Both (Window Layout + Pycore Module)")
    elif user_input == 'M':
        menu = InteractiveMenu(config_manager, app_finder)
        menu.run()
        print("\nContinuing with launcher...")
        launch_windows = True
        launch_module = True
    else:
        print("\n[Launcher] Unknown option, using default (Both)")
        launch_windows = True
        launch_module = True

    if launch_module:
        launch_pycore_module()
        import time
        time.sleep(0.5)

    if not launch_windows:
        print("\n[Launcher] Skipping window layout (Pycore Module only mode)")
        print("[Launcher] Pycore Module running in background (RPC v2 default :59000)")
        print("\n" + "=" * 60)
        input("Press Enter to exit...")
        return

    print("=" * 60)
    print("Window Layout Calculator - Step by Step")
    print("=" * 60)

    # Use configuration
    term_config = config_manager.get_terminal_config()
    measurements_config = config_manager.get_measurements_config()
    calibration_config = config_manager.get_calibration_config()

    if term_config.get('enabled', True) and term_config.get('toggle') != 'DISABLE':
        # Update grid columns and rows from config
        grid_columns = term_config.get('columns', 3)
        grid_rows = term_config.get('rows', 2)
    else:
        grid_columns = 0
        grid_rows = 0

    # Launch based on configuration
    if grid_columns > 0 and grid_rows > 0:
        measured_columns = measurements_config.get('columns', 67)
        measured_width_px = measurements_config.get('columns_width_px', 510)
        measured_rows = measurements_config.get('rows', 164)
        measured_height_px = measurements_config.get('rows_height_px', 485)
        
        calibration_height = calibration_config.get('actual_height_px', 485)
        calibration_rows = calibration_config.get('term_rows', 270)
        window_chrome = config_manager.get('window_chrome') or {}
        if not isinstance(window_chrome, dict):
            window_chrome = {}
        
        print(f"\nCharacter size measurement:")
        print(f"  Column ratio: {measured_columns} columns = {measured_width_px}px")
        print(f"  Row ratio: {measured_rows} rows = {measured_height_px}px")
        if calibration_height and calibration_rows:
            print(f"  Calibration: {calibration_rows} rows = {calibration_height}px (actual)")
        
        total_windows = grid_columns * grid_rows
        ubuntu_count = WindowLauncher().calculate_ubuntu_count(total_windows)
        wt_count = total_windows - ubuntu_count
        
        print(f"Grid layout: {grid_columns} columns x {grid_rows} rows = {total_windows} windows")
        if ubuntu_count > 0:
            print(f"  - {wt_count} Windows Terminal windows")
            print(f"  - {ubuntu_count} Ubuntu terminals (auto-reserved)")
        else:
            print(f"  - {total_windows} Windows Terminal windows")
        print(f"Calculation: Window size = Screen / Grid, then convert to columns.rows using column/row ratios")
        print("=" * 60)
        
        # Create launcher instance with values from config
        launcher = WindowLauncher(
            grid_columns=grid_columns,
            grid_rows=grid_rows,
            measured_columns=measured_columns,
            measured_rows=measured_rows,
            measured_width_px=measured_width_px,
            measured_height_px=measured_height_px,
            calibration_actual_height=calibration_height,
            calibration_term_rows=calibration_rows,
            window_chrome_title_bar_px=window_chrome.get('title_bar_plus_padding_px', 56),
            window_chrome_horizontal_px=window_chrome.get('horizontal_padding_px', 24),
            window_chrome_content_scale=window_chrome.get('content_scale', 0.78)
        )
        
        # Launch windows
        launcher.launch_windows()
    else:
        print("Terminal launching is disabled")
    
    # Launch configured applications using explorer executor (via bat files)
    apps_config = config_manager.get_applications_config()
    executor = ExplorerExecutor()
    
    for app_name, app_config in apps_config.items():
        if app_config.get('enabled', False):
            # Get path from cache first, then from config if cache doesn't have it
            app_path = None
            
            # Try to get from cache (AppFinder cache)
            if app_name == 'chrome':
                version = app_config.get('version', 'stable')
                cache_key = f'chrome_{version}'
                if cache_key in app_finder.cache:
                    cached_path = Path(app_finder.cache[cache_key])
                    if cached_path.exists():
                        app_path = str(cached_path)
            elif app_name == 'chrome_beta':
                # chrome_beta always uses beta version
                # Use same cache key format as find_chrome_by_version('beta')
                cache_key = 'chrome_beta'
                if cache_key in app_finder.cache:
                    cached_path = Path(app_finder.cache[cache_key])
                    if cached_path.exists():
                        app_path = str(cached_path)
            else:
                cache_key = f'{app_name}_path'
                if cache_key in app_finder.cache:
                    cached_path = Path(app_finder.cache[cache_key])
                    if cached_path.exists():
                        app_path = str(cached_path)
            
            # If not in cache, try to find it (and save to cache only, NOT config)
            if not app_path:
                if app_name == 'chrome':
                    version = app_config.get('version', 'stable')
                    app_path = app_finder.find_chrome_by_version(version)
                elif app_name == 'chrome_beta':
                    app_path = app_finder.find_chrome_by_version('beta')
                else:
                    app_path = app_finder.find_app(app_name)
                # AppFinder.save_cache() will be called by find_app/find_chrome_by_version
                # Paths are saved to app_cache.json, NOT config.json
            
            if app_path:
                print(f"\nLaunching {app_name}...")
                try:
                    app_path_obj = Path(app_path)
                    
                    if app_path_obj.exists():
                        # Always create bat file and launch via explorer executor
                        # This ensures application is launched independently from Python
                        temp_bat = script_generator.get_temp_dir() / f'launch_{app_name}.bat'
                        
                        # Create bat file with start command
                        bat_content = f'@echo off\r\nstart "" "{app_path}"\r\n'
                        
                        with open(temp_bat, 'w', encoding='utf-8', newline='\r\n') as f:
                            f.write(bat_content)
                        
                        # Execute via explorer executor using start method (not as child process)
                        executor.execute_file(app_path, independent=True)
                        print(f"  Created and launched: {temp_bat}")
                    else:
                        print(f"  Error: Application path does not exist: {app_path}")
                except Exception as e:
                    print(f"Failed to launch {app_name}: {e}")
    
    # Pause to view output, wait for 'y' or Enter to continue
    print("\n" + "=" * 60)
    while True:
        user_input = input("Press 'y' or Enter to continue: ").strip().lower()
        if user_input == 'y' or user_input == '':
            break


if __name__ == '__main__':
    main()


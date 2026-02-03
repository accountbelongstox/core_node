#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RoS-BoT Manager
Manages RoS-BoT.exe and other executable files in RoS directory
"""

import os
import sys
import time
import glob
import subprocess
import win32gui
import win32process
import win32con
import psutil
import win32api
from typing import List, Dict, Optional

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.providor_second import CONFIG, load_config
from pycore.pyfoundations.color_print import ColorPrint
from utils.window_activator import WindowActivator
from utils.window_analyzer import WindowAnalyzer
from utils.integrated_automation_controller import IntegratedAutomationController

class RoSBotManager:
    """Manages RoS-BoT.exe and other executable files"""
    
    def __init__(self):
        """Initialize RoS-BoT manager"""
        # Ensure configuration is loaded
        load_config()
        
        # Load RoS settings
        ros_settings = CONFIG.get('ros_settings', {})
        self.ros_directory = ros_settings.get('ros_directory', '')
        self.auto_start_rosbot = ros_settings.get('auto_start_rosbot', True)
        self.auto_start_other_exe = ros_settings.get('auto_start_other_exe', True)
        self.rosbot_exe_name = ros_settings.get('rosbot_exe_name', 'RoS-BoT.exe')
        self.search_patterns = ros_settings.get('other_exe_search_patterns', ['*.exe'])
        self.exclude_patterns = ros_settings.get('other_exe_exclude_patterns', 
                                                ['RoS-BoT.exe', 'Uninstall*.exe', 'setup*.exe'])
        self.startup_delay = ros_settings.get('startup_delay_seconds', 3)
        self.detection_timeout = ros_settings.get('process_detection_timeout', 30)
        
        # Initialize components
        self.window_activator = WindowActivator()
        self.window_analyzer = WindowAnalyzer()
        self.integrated_automation_controller = IntegratedAutomationController()
        
        ColorPrint.green("[INIT] RoSBotManager initialized")
        ColorPrint.blue(f"[CONFIG] RoS directory: {self.ros_directory}")
        ColorPrint.blue(f"[CONFIG] Auto start RoS-BoT: {self.auto_start_rosbot}")
        ColorPrint.blue(f"[CONFIG] Auto start other exe: {self.auto_start_other_exe}")
        ColorPrint.blue("[STRATEGY] Clean old processes → Start RoS-BoT.exe → Get new other exe")
    
    def validate_ros_directory(self) -> bool:
        """Validate RoS directory exists"""
        if not self.ros_directory:
            ColorPrint.red("[ERROR] RoS directory not configured")
            return False
        
        if not os.path.exists(self.ros_directory):
            ColorPrint.red(f"[ERROR] RoS directory not found: {self.ros_directory}")
            return False
        
        ColorPrint.green(f"[VALID] RoS directory found: {self.ros_directory}")
        return True
    
    def find_rosbot_exe(self) -> Optional[str]:
        """Find RoS-BoT.exe in the directory"""
        rosbot_path = os.path.join(self.ros_directory, self.rosbot_exe_name)
        
        if os.path.exists(rosbot_path):
            ColorPrint.green(f"[FOUND] RoS-BoT.exe: {rosbot_path}")
            return rosbot_path
        else:
            ColorPrint.yellow(f"[NOT_FOUND] RoS-BoT.exe not found: {rosbot_path}")
            return None
    
    def find_other_exe_files(self) -> List[str]:
        """Find other executable files in RoS directory"""
        other_exe_files = []
        
        try:
            # Search for exe files using patterns
            for pattern in self.search_patterns:
                search_path = os.path.join(self.ros_directory, pattern)
                found_files = glob.glob(search_path)
                
                for file_path in found_files:
                    file_name = os.path.basename(file_path)
                    
                    # Check if file should be excluded
                    should_exclude = False
                    for exclude_pattern in self.exclude_patterns:
                        if exclude_pattern.replace('*', '') in file_name:
                            should_exclude = True
                            break
                    
                    if not should_exclude and file_path not in other_exe_files:
                        other_exe_files.append(file_path)
            
            ColorPrint.blue(f"[SEARCH] Found {len(other_exe_files)} other exe files")
            for exe_file in other_exe_files:
                ColorPrint.gray(f"[OTHER_EXE] {os.path.basename(exe_file)}")
            
            return other_exe_files
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error searching for exe files: {e}")
            return []
    
    def start_executable(self, exe_path: str) -> bool:
        """Start an executable file"""
        try:
            exe_name = os.path.basename(exe_path)
            ColorPrint.blue(f"[START] Starting {exe_name}...")
            
            # Start the process
            process = subprocess.Popen(
                exe_path,
                cwd=os.path.dirname(exe_path),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            ColorPrint.green(f"[SUCCESS] Started {exe_name} (PID: {process.pid})")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to start {exe_name}: {e}")
            return False
    
    def find_process_by_exe_name(self, exe_name: str) -> Optional[Dict]:
        """Find process by exe file name using psutil"""
        try:
            ColorPrint.blue(f"[SEARCH] Searching for process: {exe_name}")

            # Search through all running processes
            for proc in psutil.process_iter(['pid', 'name', 'exe']):
                try:
                    proc_info = proc.info
                    if proc_info['name'] and proc_info['name'].lower() == exe_name.lower():
                        ColorPrint.green(f"[FOUND_PROCESS] {exe_name} found (PID: {proc_info['pid']})")

                        # Now find the window associated with this process
                        window_info = self.find_window_by_pid(proc_info['pid'])
                        if window_info:
                            ColorPrint.green(f"[FOUND_WINDOW] Window: '{window_info['title']}'")
                            return {
                                'pid': proc_info['pid'],
                                'exe_name': proc_info['name'],
                                'exe_path': proc_info['exe'],
                                'hwnd': window_info['hwnd'],
                                'title': window_info['title']
                            }
                        else:
                            ColorPrint.yellow(f"[NO_WINDOW] Process {exe_name} found but no visible window")
                            return {
                                'pid': proc_info['pid'],
                                'exe_name': proc_info['name'],
                                'exe_path': proc_info['exe'],
                                'hwnd': 0,
                                'title': f"{exe_name} (No Window)"
                            }
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue

            ColorPrint.yellow(f"[NOT_FOUND] Process {exe_name} not found")
            return None

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error searching for process {exe_name}: {e}")
            return None

    def find_window_by_pid(self, pid: int) -> Optional[Dict]:
        """Find window by process ID"""
        try:
            found_windows = []

            def enum_windows_callback(hwnd, _):
                if win32gui.IsWindowVisible(hwnd):
                    try:
                        _, window_pid = win32process.GetWindowThreadProcessId(hwnd)
                        if window_pid == pid:
                            window_title = win32gui.GetWindowText(hwnd)
                            found_windows.append({
                                'hwnd': hwnd,
                                'title': window_title,
                                'pid': window_pid
                            })
                    except Exception:
                        pass
                return True

            win32gui.EnumWindows(enum_windows_callback, None)

            if found_windows:
                # Return the first visible window with a title
                for window in found_windows:
                    if window['title'].strip():
                        return window
                # If no window has a title, return the first one
                return found_windows[0]

            return None

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error finding window for PID {pid}: {e}")
            return None

    def check_process_running(self, exe_name: str) -> Optional[Dict]:
        """Check if a process is running by exe name (updated method)"""
        try:
            # First try the new method using exe name
            process_info = self.find_process_by_exe_name(exe_name)
            if process_info:
                return process_info

            # Fallback to old method for compatibility (for RoS-BoT.exe which might have predictable title)
            if exe_name == self.rosbot_exe_name:
                return self.check_process_running_by_title(exe_name)

            return None

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking process {exe_name}: {e}")
            return None

    def check_process_running_by_title(self, exe_name: str) -> Optional[Dict]:
        """Check if a process is running by window title (legacy method)"""
        try:
            # Remove .exe extension for window title matching
            window_title_base = exe_name.replace('.exe', '')

            # Find windows with matching titles
            found_windows = []

            def enum_windows_callback(hwnd, _):
                if win32gui.IsWindowVisible(hwnd):
                    try:
                        window_title = win32gui.GetWindowText(hwnd)
                        if window_title and window_title_base.lower() in window_title.lower():
                            found_windows.append({
                                'hwnd': hwnd,
                                'title': window_title
                            })
                    except Exception:
                        pass
                return True

            win32gui.EnumWindows(enum_windows_callback, None)

            if found_windows:
                window = found_windows[0]  # Use first match
                ColorPrint.green(f"[RUNNING] {exe_name} process found by title: '{window['title']}'")
                return window
            else:
                return None

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking process by title {exe_name}: {e}")
            return None
    
    def wait_for_process(self, exe_name: str, timeout_seconds: int = 30) -> Optional[Dict]:
        """Wait for a process to start using exe name detection"""
        ColorPrint.blue(f"[WAIT] Waiting for {exe_name} process (timeout: {timeout_seconds}s)...")

        start_time = time.time()
        check_count = 0

        while time.time() - start_time < timeout_seconds:
            check_count += 1
            ColorPrint.gray(f"[CHECK] Process check #{check_count} for {exe_name}")

            # Use the new process detection method
            process_info = self.check_process_running(exe_name)
            if process_info:
                elapsed_time = time.time() - start_time
                ColorPrint.green(f"[DETECTED] {exe_name} detected after {elapsed_time:.1f} seconds")

                # Print detailed process info
                if process_info.get('pid'):
                    ColorPrint.blue(f"[PROCESS_INFO] PID: {process_info['pid']}")
                if process_info.get('title'):
                    ColorPrint.blue(f"[WINDOW_INFO] Title: '{process_info['title']}'")
                if process_info.get('hwnd'):
                    ColorPrint.blue(f"[WINDOW_INFO] Handle: {process_info['hwnd']}")

                return process_info

            time.sleep(2)  # Check every 2 seconds

        ColorPrint.red(f"[TIMEOUT] {exe_name} not detected within {timeout_seconds} seconds")
        return None

    def send_f7_to_process(self, process_info: Dict) -> bool:
        """Send F7 key to a process window"""
        try:
            window_handle = process_info.get('hwnd', 0)
            window_title = process_info.get('title', '')
            exe_name = process_info.get('exe_name', '')

            if not window_handle:
                ColorPrint.yellow(f"[F7_SKIP] No window handle for {exe_name}")
                return False

            ColorPrint.blue(f"[F7_SEND] Sending F7 to {exe_name} ('{window_title}')")

            # Activate window first
            try:
                win32gui.SetForegroundWindow(window_handle)
                win32gui.ShowWindow(window_handle, win32con.SW_RESTORE)
                time.sleep(0.5)  # Wait for activation
            except Exception as e:
                ColorPrint.yellow(f"[F7_WARNING] Failed to activate window: {e}")

            # Send F7 key (VK_F7 = 0x76)
            try:
                win32api.keybd_event(0x76, 0, 0, 0)  # F7 key down
                time.sleep(0.1)
                win32api.keybd_event(0x76, 0, 2, 0)  # F7 key up
                ColorPrint.green(f"[F7_SUCCESS] F7 sent to {exe_name}")
                return True
            except Exception as e:
                ColorPrint.red(f"[F7_ERROR] Failed to send F7: {e}")
                return False

        except Exception as e:
            ColorPrint.red(f"[F7_ERROR] Error sending F7: {e}")
            return False

    def kill_process_by_pid(self, pid: int, exe_name: str) -> bool:
        """Kill a process by PID using taskkill"""
        try:
            ColorPrint.blue(f"[KILL] Killing {exe_name} (PID: {pid})")

            # Use taskkill command
            result = subprocess.run(
                ['taskkill', '/F', '/PID', str(pid)],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                ColorPrint.green(f"[KILL_SUCCESS] {exe_name} killed successfully")
                return True
            else:
                ColorPrint.red(f"[KILL_ERROR] Failed to kill {exe_name}: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            ColorPrint.red(f"[KILL_TIMEOUT] Timeout killing {exe_name}")
            return False
        except Exception as e:
            ColorPrint.red(f"[KILL_ERROR] Error killing {exe_name}: {e}")
            return False

    def cleanup_old_other_exe_processes(self) -> bool:
        """Clean up all old other exe processes"""
        try:
            ColorPrint.blue("[CLEANUP] Starting cleanup of old other exe processes...")

            # Find all other exe files in directory
            other_exe_files = self.find_other_exe_files()
            if not other_exe_files:
                ColorPrint.gray("[CLEANUP] No other exe files found in directory")
                return True

            cleanup_count = 0

            # Check each other exe file for running processes
            for exe_path in other_exe_files:
                exe_name = os.path.basename(exe_path)
                ColorPrint.blue(f"[CLEANUP] Checking {exe_name}...")

                process_info = self.find_process_by_exe_name(exe_name)
                if process_info:
                    ColorPrint.yellow(f"[CLEANUP] Found running {exe_name} - cleaning up...")

                    # Step 1: Send F7 to the process
                    f7_sent = self.send_f7_to_process(process_info)
                    if f7_sent:
                        time.sleep(1)  # Wait a moment after F7

                    # Step 2: Kill the process
                    pid = process_info.get('pid')
                    if pid:
                        killed = self.kill_process_by_pid(pid, exe_name)
                        if killed:
                            cleanup_count += 1
                            time.sleep(0.5)  # Wait between kills
                else:
                    ColorPrint.gray(f"[CLEANUP] {exe_name} not running")

            if cleanup_count > 0:
                ColorPrint.green(f"[CLEANUP_SUCCESS] Cleaned up {cleanup_count} old processes")
                time.sleep(2)  # Wait for processes to fully terminate
            else:
                ColorPrint.gray("[CLEANUP] No processes needed cleanup")

            return True

        except Exception as e:
            ColorPrint.red(f"[CLEANUP_ERROR] Error during cleanup: {e}")
            return False

    def wait_for_new_other_exe(self, timeout_seconds: int = 60) -> Optional[Dict]:
        """Wait for RoS-BoT.exe to generate a new other exe process"""
        try:
            ColorPrint.blue(f"[WAIT_NEW] Waiting for new other exe to be generated (timeout: {timeout_seconds}s)...")

            start_time = time.time()
            check_count = 0

            while time.time() - start_time < timeout_seconds:
                check_count += 1
                ColorPrint.gray(f"[CHECK_NEW] New other exe check #{check_count}")

                # Get current other exe files
                other_exe_files = self.find_other_exe_files()

                # Check each for running processes
                for exe_path in other_exe_files:
                    exe_name = os.path.basename(exe_path)
                    process_info = self.find_process_by_exe_name(exe_name)

                    if process_info:
                        elapsed_time = time.time() - start_time
                        ColorPrint.green(f"[NEW_FOUND] New other exe detected: {exe_name}")
                        ColorPrint.green(f"[NEW_DETECTED] Found after {elapsed_time:.1f} seconds")
                        ColorPrint.blue(f"[NEW_TITLE] Actual title: '{process_info.get('title', 'No Title')}'")
                        ColorPrint.blue(f"[NEW_PID] PID: {process_info.get('pid', 'N/A')}")
                        ColorPrint.blue(f"[NEW_HANDLE] Handle: {process_info.get('hwnd', 'N/A')}")

                        return {
                            'exe_name': exe_name,
                            'exe_path': exe_path,
                            'process_info': process_info
                        }

                time.sleep(3)  # Check every 3 seconds

            ColorPrint.red(f"[NEW_TIMEOUT] No new other exe detected within {timeout_seconds} seconds")
            return None

        except Exception as e:
            ColorPrint.red(f"[NEW_ERROR] Error waiting for new other exe: {e}")
            return None
    
    def activate_and_analyze_window(self, process_info: Dict, window_title_for_analysis: str) -> Dict:
        """Activate window and perform UI analysis using process info"""
        try:
            ColorPrint.blue(f"[ANALYZE] Starting analysis for window: '{window_title_for_analysis}'...")

            window_title = process_info.get('title', '')
            window_handle = process_info.get('hwnd', 0)
            exe_name = process_info.get('exe_name', 'Unknown')

            ColorPrint.blue(f"[ANALYZE_INFO] Exe: {exe_name}, Title: '{window_title}', Handle: {window_handle}")

            if not window_title and not window_handle:
                ColorPrint.red(f"[ANALYSIS_ERROR] No window information available for {exe_name}")
                return {"success": False, "error": "No window information available"}

            # Try to activate window by handle first (more reliable for random titles)
            activation_success = False
            if window_handle:
                try:
                    win32gui.SetForegroundWindow(window_handle)
                    win32gui.ShowWindow(window_handle, win32con.SW_RESTORE)
                    activation_success = True
                    ColorPrint.green(f"[ACTIVATED] Window activated by handle: {window_handle}")
                except Exception as e:
                    ColorPrint.yellow(f"[WARNING] Failed to activate by handle: {e}")

            # Fallback to title-based activation
            if not activation_success and window_title:
                activation_success = self.window_activator.activate_window_by_title(window_title)
                if activation_success:
                    ColorPrint.green(f"[ACTIVATED] Window activated by title: '{window_title}'")
                else:
                    ColorPrint.yellow(f"[WARNING] Failed to activate window: '{window_title}'")

            # Give window time to activate
            time.sleep(1)

            # Use existing WindowAnalyzer to perform complete analysis
            # For random titles, we need to pass the exact title we found
            if window_title:
                window_titles = [window_title]
                analysis_result = self.window_analyzer.analyze_window(window_titles, window_title_for_analysis)

                if analysis_result.get("success", False):
                    ColorPrint.green(f"[ANALYSIS_SUCCESS] UI analysis completed for '{window_title}'")

                    # Extract file paths from the analysis result
                    files = analysis_result.get("files", {})
                    ColorPrint.blue(f"[SCREENSHOT] {files.get('screenshot', 'N/A')}")
                    ColorPrint.blue(f"[ANNOTATED] {files.get('annotated_screenshot', 'N/A')}")
                    ColorPrint.blue(f"[JSON] {files.get('json', 'N/A')}")

                    # Report number of controls found
                    controls = analysis_result.get("controls", [])
                    ColorPrint.blue(f"[ELEMENTS] Found {len(controls)} UI elements")

                    # Perform integrated UI automation
                    if window_handle:
                        ColorPrint.blue(f"[UI_AUTO] Starting integrated UI automation for '{window_title}'...")
                        # Use integrated automation with window titles
                        ui_automation_result = self.integrated_automation_controller.perform_integrated_ui_automation([window_title], window_title_for_analysis)

                        if ui_automation_result.get("success", False):
                            if ui_automation_result.get("skipped", False):
                                ColorPrint.gray(f"[UI_SKIP] UI automation skipped: {ui_automation_result.get('reason', 'Unknown')}")
                            else:
                                results = ui_automation_result.get("results", {})
                                success_count = ui_automation_result.get("success_count", 0)
                                total_steps = ui_automation_result.get("total_steps", 0)
                                ColorPrint.green(f"[UI_SUCCESS] UI automation completed: {success_count}/{total_steps} steps successful")

                                # Report individual step results
                                if results.get("tab_clicked"):
                                    ColorPrint.green("  ✓ Tab clicked")
                                if results.get("profile_selected"):
                                    ColorPrint.green("  ✓ Profile selected")
                                if results.get("sequence_selected"):
                                    ColorPrint.green("  ✓ Sequence selected")
                                if results.get("start_clicked"):
                                    ColorPrint.green("  ✓ Start button clicked")
                        else:
                            ColorPrint.red(f"[UI_ERROR] UI automation failed: {ui_automation_result.get('error', 'Unknown')}")

                        # Add UI automation result to analysis result
                        analysis_result["ui_automation"] = ui_automation_result

                else:
                    ColorPrint.red(f"[ANALYSIS_ERROR] UI analysis failed for '{window_title}': {analysis_result.get('error', 'Unknown')}")

                return analysis_result
            else:
                ColorPrint.yellow(f"[ANALYSIS_SKIP] No window title available for {exe_name} - skipping UI analysis")
                return {
                    "success": True,
                    "skipped": True,
                    "reason": "No window title available",
                    "process_info": process_info
                }

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error in window analysis: {e}")
            return {"success": False, "error": str(e)}
    
    def start_rosbot_sequence(self, force_cleanup: bool = None) -> Dict:
        """Start complete RoS-BoT sequence with smart cleanup logic"""
        try:
            # Determine if we should force cleanup
            if force_cleanup is None:
                # Auto-detect: force cleanup if this is likely the first run
                other_exe_files = self.find_other_exe_files()
                running_count = 0
                for exe_path in other_exe_files:
                    exe_name = os.path.basename(exe_path)
                    if self.find_process_by_exe_name(exe_name):
                        running_count += 1
                force_cleanup = running_count > 0  # Force cleanup if any other exe is running

            if force_cleanup:
                ColorPrint.blue("[ROSBOT_SEQUENCE] Starting INITIAL cleanup and restart sequence...")
                ColorPrint.blue("[STRATEGY] Clean old → Start RoS-BoT.exe → Get new other exe → Analyze")
            else:
                ColorPrint.blue("[ROSBOT_SEQUENCE] Starting NORMAL RoS-BoT management sequence...")
                ColorPrint.blue("[STRATEGY] Check status → Start missing → Analyze")

            # Step 1: Validate directory
            if not self.validate_ros_directory():
                return {"success": False, "error": "RoS directory validation failed"}

            # Step 2: Find RoS-BoT.exe
            rosbot_path = self.find_rosbot_exe()
            if not rosbot_path:
                return {"success": False, "error": "RoS-BoT.exe not found"}

            # Step 3: Clean up processes ONLY if force_cleanup is True
            if force_cleanup:
                ColorPrint.blue("[STEP_1] Cleaning up old other exe processes...")
                cleanup_success = self.cleanup_old_other_exe_processes()
                if not cleanup_success:
                    ColorPrint.yellow("[WARNING] Cleanup had issues but continuing...")

                # Step 4: Also clean up old RoS-BoT.exe if running
                ColorPrint.blue("[STEP_2] Checking for old RoS-BoT.exe...")
                old_rosbot = self.find_process_by_exe_name(self.rosbot_exe_name)
                if old_rosbot:
                    ColorPrint.yellow("[CLEANUP_ROSBOT] Found old RoS-BoT.exe - cleaning up...")
                    pid = old_rosbot.get('pid')
                    if pid:
                        self.kill_process_by_pid(pid, self.rosbot_exe_name)
                        time.sleep(2)  # Wait for cleanup
            else:
                ColorPrint.blue("[SKIP_CLEANUP] Normal management mode - skipping cleanup")

            # Step 5: Start fresh RoS-BoT.exe
            ColorPrint.blue("[STEP_3] Starting fresh RoS-BoT.exe...")
            if not self.start_executable(rosbot_path):
                return {"success": False, "error": "Failed to start RoS-BoT.exe"}

            # Step 6: Wait for RoS-BoT.exe to start (may not have window)
            ColorPrint.blue("[STEP_4] Waiting for RoS-BoT.exe to start...")
            rosbot_process = self.wait_for_process(self.rosbot_exe_name, self.detection_timeout)
            if not rosbot_process:
                ColorPrint.yellow("[WARNING] RoS-BoT.exe not detected but may be running")

            # Step 7: Wait for RoS-BoT.exe to generate new other exe
            ColorPrint.blue("[STEP_5] Waiting for RoS-BoT.exe to generate new other exe...")
            new_other_exe = self.wait_for_new_other_exe(60)  # Wait up to 60 seconds

            if not new_other_exe:
                return {"success": False, "error": "No new other exe was generated by RoS-BoT.exe"}

            # Step 8: We now have the new other exe - ignore RoS-BoT.exe from here
            ColorPrint.green(f"[SUCCESS] New other exe found: {new_other_exe['exe_name']}")
            ColorPrint.blue(f"[NEW_PROCESS] Title: '{new_other_exe['process_info'].get('title', 'No Title')}'")
            ColorPrint.blue("[IGNORE_ROSBOT] From now on, ignoring RoS-BoT.exe and focusing on other exe")

            # Step 8.5: Wait for server connection (RoS-BoT needs time to connect)
            server_wait_time = 10  # Wait 10 seconds for server connection
            ColorPrint.blue(f"[SERVER_WAIT] Waiting {server_wait_time} seconds for RoS-BoT to connect to server...")
            time.sleep(server_wait_time)

            # Step 9: Analyze the new other exe window using ACTUAL window title
            analysis_results = {}

            exe_name = new_other_exe['exe_name']
            process_name = exe_name.replace('.exe', '')
            process_info = new_other_exe['process_info']
            actual_window_title = process_info.get('title', '')

            ColorPrint.blue(f"[STEP_6] Analyzing new other exe: {exe_name}...")
            ColorPrint.blue(f"[ACTUAL_TITLE] Using actual window title: '{actual_window_title}'")
            ColorPrint.blue(f"[ACTUAL_HANDLE] Using actual window handle: {process_info.get('hwnd', 0)}")

            # Use actual window title for analysis, not exe name
            analysis_results[process_name] = self.activate_and_analyze_window(
                process_info,
                actual_window_title  # Use actual title instead of process_name
            )

            ColorPrint.green("[ROSBOT_SUCCESS] Robust RoS-BoT sequence completed successfully")

            return {
                "success": True,
                "rosbot_process": rosbot_process,  # May be None or minimal info
                "other_exe_started": [new_other_exe],  # The single new other exe
                "new_other_exe": new_other_exe,  # Primary working process
                "analysis_results": analysis_results
            }

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error in robust RoS-BoT sequence: {e}")
            return {"success": False, "error": str(e)}

def main():
    """Main function for testing"""
    manager = RoSBotManager()
    result = manager.start_rosbot_sequence()
    
    if result["success"]:
        ColorPrint.green("[TEST_SUCCESS] RoS-BoT sequence test completed")
    else:
        ColorPrint.red(f"[TEST_ERROR] RoS-BoT sequence test failed: {result.get('error', 'Unknown')}")

if __name__ == "__main__":
    main()

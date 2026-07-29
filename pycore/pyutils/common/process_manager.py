#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process Manager
Handles process management including starting, stopping, and monitoring processes
"""

import os
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
import sys
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_psutil

from pycore.pyfoundations.third_party.api import get_third_package_win32gui
from pycore.pyfoundations.third_party.api import get_third_package_win32process


psutil = get_third_package_psutil()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class ProcessManager:
    """Manages Windows processes with enhanced functionality"""
    
    def __init__(self):
        """Initialize process manager"""
        self.temp_bat_dir = Path(os.environ.get('TEMP', 'C:\\temp')) / 'd3check_bats'
        self.temp_bat_dir.mkdir(exist_ok=True)
        ColorPrint.green("[INIT] ProcessManager initialized")
    
    def start_program_with_explorer(self, exe_path: str, args: str = "", force_restart: bool = False, wait_time: int = 3) -> bool:
        """
        Start program using explorer (as specified in requirements)
        If program has arguments, create a bat file first

        Args:
            exe_path: Path to executable
            args: Command line arguments
            force_restart: Whether to kill existing processes first
            wait_time: Time to wait before checking if process started

        Returns:
            True if started successfully (process is actually running)
        """
        try:
            exe_path = Path(exe_path)
            if not exe_path.exists():
                ColorPrint.red(f"❌ Executable not found: {exe_path}")
                return False

            # Force restart if requested
            if force_restart:
                ColorPrint.blue(f"🔄 Force restart requested, killing existing {exe_path.name} processes...")
                self.kill_process_by_name(exe_path.name)
                time.sleep(2)  # Wait for processes to terminate
            
            if args:
                # Create bat file for programs with arguments
                bat_content = f'@echo off\ncd /d "{exe_path.parent}"\n"{exe_path}" {args}\n'
                bat_file = self.temp_bat_dir / f"launch_{exe_path.stem}_{int(time.time())}.bat"
                
                with open(bat_file, 'w', encoding='utf-8') as f:
                    f.write(bat_content)
                
                ColorPrint.blue(f"📝 Created bat file: {bat_file}")
                launch_path = str(bat_file)
            else:
                launch_path = str(exe_path)
            
            # Use explorer to launch
            ColorPrint.blue(f"[START] Starting with explorer: {launch_path}")

            # Get process name for checking
            process_name = exe_path.name

            # Execute explorer command
            try:
                exec_silent(['explorer', launch_path],
                             capture_output=True, text=True, timeout=30)
                ColorPrint.blue(f"[EXEC] Explorer command executed for: {process_name}")
            except subprocess.TimeoutExpired:
                ColorPrint.yellow(f"[TIMEOUT] Explorer command timeout for: {process_name}")
            except Exception as e:
                ColorPrint.red(f"[ERROR] Explorer command failed: {e}")
                return False

            # Wait for process to start
            ColorPrint.blue(f"[WAIT] Waiting {wait_time} seconds for process to start...")
            time.sleep(wait_time)

            # Check if process is actually running
            if self.is_process_running(process_name):
                ColorPrint.green(f"[SUCCESS] Process confirmed running: {process_name}")
                return True
            else:
                ColorPrint.red(f"[FAILED] Process not found after startup: {process_name}")
                return False
                
        except subprocess.TimeoutExpired:
            ColorPrint.yellow("⚠️  Explorer launch timeout")
            return False
        except Exception as e:
            ColorPrint.red(f"❌ Error starting program: {e}")
            return False
    
    def kill_process_by_name(self, process_name: str, force: bool = True) -> bool:
        """
        Kill process using taskkill command (as specified in requirements)
        
        Args:
            process_name: Name of process to kill
            force: Whether to use force kill
            
        Returns:
            True if killed successfully
        """
        try:
            ColorPrint.blue(f"🔄 Killing process: {process_name}")
            
            # Use taskkill command
            cmd = ['taskkill', '/IM', process_name]
            if force:
                cmd.append('/F')
            
            result = exec_silent(cmd, capture_output=True, text=True, timeout=30)
            
            if result.return_code == 0:
                ColorPrint.green(f"✅ Successfully killed: {process_name}")
                return True
            else:
                ColorPrint.yellow(f"⚠️  Kill result: {result.stderr}")
                # Check if process actually stopped
                return not self.is_process_running(process_name)
                
        except subprocess.TimeoutExpired:
            ColorPrint.yellow("⚠️  Taskkill timeout")
            return False
        except Exception as e:
            ColorPrint.red(f"❌ Error killing process: {e}")
            return False
    
    def kill_process_by_pid(self, pid: int, force: bool = True) -> bool:
        """
        Kill process by PID using taskkill command
        
        Args:
            pid: Process ID
            force: Whether to use force kill
            
        Returns:
            True if killed successfully
        """
        try:
            ColorPrint.blue(f"🔄 Killing process PID: {pid}")
            
            cmd = ['taskkill', '/PID', str(pid)]
            if force:
                cmd.append('/F')
            
            result = exec_silent(cmd, capture_output=True, text=True, timeout=30)
            
            if result.return_code == 0:
                ColorPrint.green(f"✅ Successfully killed PID: {pid}")
                return True
            else:
                ColorPrint.yellow(f"⚠️  Kill result: {result.stderr}")
                return not self.is_process_running_by_pid(pid)
                
        except Exception as e:
            ColorPrint.red(f"❌ Error killing process: {e}")
            return False
    
    def is_process_running(self, process_name: str) -> bool:
        """
        Check if process is running by name
        
        Args:
            process_name: Name of process to check
            
        Returns:
            True if process is running
        """
        try:
            for proc in psutil.process_iter(['name']):
                if proc.info['name'] and proc.info['name'].lower() == process_name.lower():
                    return True
            return False
        except Exception as e:
            ColorPrint.red(f"❌ Error checking process: {e}")
            return False
    
    def is_process_running_by_pid(self, pid: int) -> bool:
        """
        Check if process is running by PID
        
        Args:
            pid: Process ID
            
        Returns:
            True if process is running
        """
        try:
            return psutil.pid_exists(pid)
        except Exception as e:
            ColorPrint.red(f"❌ Error checking PID: {e}")
            return False
    
    def get_processes_by_name(self, process_name: str) -> List[Dict]:
        """
        Get all processes matching the given name
        
        Args:
            process_name: Name of process to find
            
        Returns:
            List of process information dictionaries
        """
        processes = []
        try:
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'create_time']):
                if proc.info['name'] and proc.info['name'].lower() == process_name.lower():
                    processes.append({
                        'pid': proc.info['pid'],
                        'name': proc.info['name'],
                        'exe': proc.info['exe'],
                        'create_time': proc.info['create_time']
                    })
        except Exception as e:
            ColorPrint.red(f"❌ Error getting processes: {e}")
        
        return processes
    
    def get_processes_by_window_title(self, window_titles: List[str]) -> List[Dict]:
        """
        Get processes that have windows with matching titles
        
        Args:
            window_titles: List of window titles to match
            
        Returns:
            List of process information dictionaries
        """
        win32gui = get_third_package_win32gui()
        win32process = get_third_package_win32process()
        
        matching_processes = []
        
        def enum_windows_callback(hwnd, lparam):
            try:
                if win32gui.IsWindowVisible(hwnd):
                    window_title = win32gui.GetWindowText(hwnd)
                    if window_title:
                        for target_title in window_titles:
                            if target_title.lower() in window_title.lower():
                                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                                try:
                                    proc = psutil.Process(pid)
                                    proc_info = {
                                        'pid': pid,
                                        'name': proc.name(),
                                        'exe': proc.exe(),
                                        'window_title': window_title,
                                        'create_time': proc.create_time()
                                    }
                                    if proc_info not in matching_processes:
                                        matching_processes.append(proc_info)
                                except (psutil.NoSuchProcess, psutil.AccessDenied):
                                    pass
                                break
            except Exception:
                pass
            return True
        
        try:
            win32gui.EnumWindows(enum_windows_callback, None)
        except Exception as e:
            ColorPrint.red(f"❌ Error enumerating windows: {e}")
        
        return matching_processes
    
    def cleanup_temp_files(self):
        """Clean up temporary bat files"""
        try:
            if self.temp_bat_dir.exists():
                for bat_file in self.temp_bat_dir.glob("*.bat"):
                    try:
                        bat_file.unlink()
                        ColorPrint.gray(f"🗑️  Cleaned up: {bat_file}")
                    except Exception as e:
                        ColorPrint.yellow(f"⚠️  Could not delete {bat_file}: {e}")
        except Exception as e:
            ColorPrint.red(f"❌ Error cleaning temp files: {e}")

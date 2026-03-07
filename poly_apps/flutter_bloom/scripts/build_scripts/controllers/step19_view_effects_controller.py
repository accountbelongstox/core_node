#!/usr/bin/env python3
"""
Step 19 View Effects Controller
Opens source viewer for viewing image replacement effects via web interface
"""

import os
import sys
import time
import signal
import webbrowser
import subprocess
import threading
import queue
from pathlib import Path
from typing import Dict, List, Any, Optional

from third_party import psutil

# Import using relative path from build_scripts root
from shared.data_exchange.unified_variable_system import unified_vars
from utils.print_helper import PrintHelper
from utils.source_viewer_server import SourceViewerServer


class Step19ViewEffectsController:
    """
    Step 19 Controller: View Replacement Effects
    Opens web interface to view image replacement effects and project resources
    """

    def __init__(self):
        self.step_name = "STEP-19"
        self.step_description = "View Replacement Effects"
        self.results = {}
        self.temp_build_root = None
        self.app_name = None
        self.server = None
        self.server_thread = None
        self.server_port = 8081

    def initialize(self, temp_build_root: Path, app_name: str) -> bool:
        """
        Initialize Step 19 controller with build parameters

        Args:
            temp_build_root: Path to temporary build directory
            app_name: Name of the application being built

        Returns:
            bool: True if initialization successful, False otherwise
        """
        try:
            PrintHelper.info(f"Initializing {self.step_description}", source=self.step_name)
            PrintHelper.info(f"Build Root: {temp_build_root}", source=self.step_name)
            PrintHelper.info(f"App Name: {app_name}", source=self.step_name)

            self.temp_build_root = temp_build_root
            self.app_name = app_name

            # Validate build root exists
            if not temp_build_root.exists():
                PrintHelper.error(f"Build root directory does not exist: {temp_build_root}", source=self.step_name)
                return False

            PrintHelper.info(f"Step 19 controller initialized successfully", source=self.step_name)
            return True

        except Exception as e:
            PrintHelper.error(f"Failed to initialize Step 19 controller: {e}", source=self.step_name)
            return False

    def execute_step19_view_effects(self) -> Dict[str, Any]:
        """
        Execute Step 19: View Replacement Effects

        Returns:
            Dict containing view results and metadata
        """
        try:
            PrintHelper.info(f"\n{'=' * 80}", source=self.step_name)
            PrintHelper.info(f"{self.step_description.upper()}")
            PrintHelper.info(f"{'=' * 80}")

            PrintHelper.info(f"[EXECUTE] Starting source viewer for replacement effects...", source=self.step_name)

            # Change to the build directory for proper scanning
            original_cwd = os.getcwd()
            os.chdir(self.temp_build_root)

            try:
                # Initialize and start the source viewer server with current temp build directory
                self.server = SourceViewerServer(port=self.server_port, project_root=self.temp_build_root)

                PrintHelper.info(f"[SERVER] Starting Source Viewer Server on port {self.server_port}", source=self.step_name)
                PrintHelper.info(f"[SERVER] Project root: {self.temp_build_root}", source=self.step_name)

                # Start the server in a separate thread
                self.server_thread = self.server.start_server()

                # Wait a moment for server to start
                time.sleep(2)

                # Display web interface information
                web_url = f"http://localhost:{self.server_port}"
                PrintHelper.info(f"[WEB-INTERFACE] Source viewer is now available at: {web_url}", source=self.step_name)
                PrintHelper.info(f"[WEB-INTERFACE] Features available:", source=self.step_name)
                PrintHelper.info(f"  - View all platform images (Android, iOS, Web, macOS, Linux, Windows)", source=self.step_name)
                PrintHelper.info(f"  - Browse replacement effects in table and tree views", source=self.step_name)
                PrintHelper.info(f"  - Download images and open directories", source=self.step_name)
                PrintHelper.info(f"  - View package identifiers and file structures", source=self.step_name)

                # Show user interaction menu
                interaction_result = self._show_user_interaction_menu(web_url)

                # Store results
                self.results = {
                    'step': 19,
                    'step_name': self.step_name,
                    'step_description': self.step_description,
                    'success': True,
                    'temp_build_root': str(self.temp_build_root),
                    'app_name': self.app_name,
                    'server_url': web_url,
                    'server_port': self.server_port,
                    'user_action': interaction_result,
                    'summary': {
                        'server_started': True,
                        'web_interface_accessible': True,
                        'features_available': [
                            'Image viewing',
                            'Tree/Table views',
                            'Download functionality',
                            'Directory operations',
                            'Package ID viewing'
                        ]
                    }
                }

                PrintHelper.info(f"[COMPLETE] Source viewer session completed", source=self.step_name)
                return self.results

            finally:
                # Restore original working directory
                os.chdir(original_cwd)

        except Exception as e:
            error_message = f"Step 19 execution failed: {e}"
            PrintHelper.error(f"{error_message}", source=self.step_name)

            self.results = {
                'step': 19,
                'step_name': self.step_name,
                'step_description': self.step_description,
                'success': False,
                'error': error_message,
                'temp_build_root': str(getattr(self, 'temp_build_root', '')),
                'app_name': getattr(self, 'app_name', ''),
                'server_url': '',
                'server_port': self.server_port,
                'user_action': 'error',
                'summary': {}
            }

            return self.results

    def _show_user_interaction_menu(self, web_url: str) -> str:
        """
        Show interactive menu for user to control source viewer

        Args:
            web_url: URL of the web interface

        Returns:
            str: User's final action choice
        """
        try:
            PrintHelper.info(f"\n[USER-INTERACTION] Source viewer is ready!", source=self.step_name)
            PrintHelper.info(f"{'=' * 60}")
            PrintHelper.info(f"Web Interface: {web_url}")
            PrintHelper.info(f"{'=' * 60}")

            print("Source Viewer Control Menu")
            print("=" * 60)
            print("1. Open web interface automatically in browser")
            print("2. Keep server running - manual browser access")
            print("3. Stop server and continue build process")
            print("4. Stop server and continue to final compilation step (default)")
            print("   Or use 'Exit and Continue Compilation' button on web / close browser to auto-continue")
            print("=" * 60)

            choice_queue = queue.Queue()

            def input_reader():
                try:
                    choice_queue.put(input("Select option (1-4, or ENTER for default): ").strip())
                except (EOFError, KeyboardInterrupt):
                    choice_queue.put(None)

            while True:
                reader = threading.Thread(target=input_reader, daemon=True)
                reader.start()
                choice = None
                while reader.is_alive() or not choice_queue.empty():
                    try:
                        choice = choice_queue.get(timeout=0.4)
                        break
                    except queue.Empty:
                        if self.server_thread and not self.server_thread.is_alive():
                            PrintHelper.info(f"[ACTION] Server stopped from web (exit button or browser closed), continuing to compilation...", source=self.step_name)
                            return 'continue_to_compilation'
                        continue

                if choice is None:
                    PrintHelper.info(f"\n[INTERRUPTED] User interrupted. Stopping server...", source=self.step_name)
                    self._stop_server()
                    return 'interrupted'

                if choice == '' or choice == '4':
                    PrintHelper.info(f"[ACTION] Stopping server and continuing to compilation step...", source=self.step_name)
                    self._stop_server()
                    return 'continue_to_compilation'

                if choice == '1':
                    PrintHelper.info(f"[ACTION] Opening web browser...", source=self.step_name)
                    webbrowser.open(web_url)
                    print("\nBrowser opened. Press ENTER when you're finished viewing...")
                    input()
                    self._stop_server()
                    return 'browser_opened_and_viewed'

                if choice == '2':
                    PrintHelper.info(f"[ACTION] Server running. Access manually at: {web_url}", source=self.step_name)
                    print(f"\nServer is running at {web_url}")
                    print("Press ENTER when you're finished viewing...")
                    input()
                    self._stop_server()
                    return 'manual_access_completed'

                if choice == '3':
                    PrintHelper.info(f"[ACTION] Stopping server and continuing build...", source=self.step_name)
                    self._stop_server()
                    return 'continue_build'

                print("Invalid choice. Please select 1-4 or press ENTER for default.")

        except Exception as e:
            PrintHelper.error(f"User interaction menu failed: {e}", source=self.step_name)
            self._stop_server()
            return 'menu_error'

    def _stop_server(self):
        """Stop the source viewer server using cross-platform process termination"""
        try:
            if self.server:
                PrintHelper.info(f"[SERVER] Stopping Source Viewer Server...", source=self.step_name)

                # Use cross-platform process killing functionality
                success = self._kill_server_processes()

                if success:
                    PrintHelper.info(f"[SERVER] Server stopped successfully", source=self.step_name)
                else:
                    PrintHelper.warning(f"[SERVER] Server may still be running", source=self.step_name)

        except Exception as e:
            PrintHelper.warning(f"Error stopping server: {e}", source=self.step_name)

    def _kill_server_processes(self):
        """
        Cross-platform process killing functionality for Flask server.
        Never kills the current process (Flask may run in a thread in the same process).
        """
        try:
            current_pid = os.getpid()
            PrintHelper.info(f"[PROCESS-KILLER] current process PID={current_pid}, searching for Flask server on port {self.server_port}...", source=self.step_name)

            killed_count = 0

            # Prefer in-process shutdown when server runs in same process (thread)
            if self.server and getattr(self.server, '_werkzeug_server', None):
                PrintHelper.info(f"[PROCESS-KILLER] Shutting down in-process server first (same process as build).", source=self.step_name)
                self._shutdown_inprocess_server()
                if getattr(self, '_inprocess_stopped', False):
                    return True

            # Method 1: Find processes by port using psutil (call connections() per process; 'connections' not valid attr on Windows)
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    raw_pid = proc.info.get('pid')
                    if raw_pid is None:
                        continue
                    pid = int(raw_pid)
                    if pid == current_pid:
                        PrintHelper.info(f"[PROCESS-KILLER] Skipping current process (PID={pid}).", source=self.step_name)
                        continue
                    conns = proc.connections()
                    for conn in conns:
                        if getattr(conn, 'laddr', None) and getattr(conn.laddr, 'port', None) == self.server_port:
                            name = proc.info.get('name', '')
                            PrintHelper.info(f"[PROCESS-KILLER] Found process: {name} (PID: {pid}) using port {self.server_port}", source=self.step_name)
                            if self._kill_process_by_pid(pid):
                                killed_count += 1
                                PrintHelper.info(f"[PROCESS-KILLER] Successfully killed process {pid}", source=self.step_name)
                            break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
                except Exception:
                    continue

            if killed_count == 0 and not getattr(self, '_inprocess_stopped', False):
                PrintHelper.info(f"[PROCESS-KILLER] No other process on port {self.server_port}; server runs in this process. Stopping via shutdown.", source=self.step_name)
                self._shutdown_inprocess_server()

            return killed_count > 0 or getattr(self, '_inprocess_stopped', False)

        except Exception as e:
            PrintHelper.error(f"[PROCESS-KILLER] Error in cross-platform process killing: {e}", source=self.step_name)
            return False

    def _shutdown_inprocess_server(self):
        """Stop the in-process Flask server (same process as build script)."""
        self._inprocess_stopped = False
        try:
            if self.server and getattr(self.server, '_werkzeug_server', None):
                self.server._werkzeug_server.shutdown()
                self._inprocess_stopped = True
        except Exception as e:
            PrintHelper.warning(f"[PROCESS-KILLER] In-process server shutdown: {e}", source=self.step_name)

    def _kill_process_by_pid(self, pid: int) -> bool:
        """Kill a process by PID using cross-platform methods"""
        try:
            if os.name == 'nt':  # Windows
                # Use taskkill for Windows
                result = subprocess.run(['taskkill', '/PID', str(pid), '/F'],
                                      capture_output=True, text=True, timeout=10)
                return result.returncode == 0
            else:  # Unix/Linux/Mac
                # Use kill for Unix-like systems
                os.kill(pid, signal.SIGTERM)
                time.sleep(1)  # Give process time to terminate gracefully

                # Check if still running, then force kill
                try:
                    os.kill(pid, 0)  # Check if process exists
                    os.kill(pid, signal.SIGKILL)  # Force kill if still running
                except ProcessLookupError:
                    pass  # Process already terminated
                return True

        except subprocess.TimeoutExpired:
            PrintHelper.warning(f"[PROCESS-KILLER] Timeout killing process {pid}", source=self.step_name)
            return False
        except Exception as e:
            PrintHelper.warning(f"[PROCESS-KILLER] Error killing process {pid}: {e}", source=self.step_name)
            return False

    def _kill_by_port_platform_specific(self) -> bool:
        """Platform-specific port killing methods"""
        try:
            if os.name == 'nt':  # Windows
                # Find and kill processes using the port on Windows
                cmd = f'netstat -ano | findstr :{self.server_port}'
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)

                if result.returncode == 0 and result.stdout:
                    lines = result.stdout.strip().split('\n')
                    for line in lines:
                        parts = line.split()
                        if len(parts) >= 5 and f':{self.server_port}' in parts[1]:
                            pid = parts[-1]
                            try:
                                subprocess.run(['taskkill', '/PID', pid, '/F'],
                                             capture_output=True, timeout=10)
                                PrintHelper.info(f"[PROCESS-KILLER] Killed Windows process {pid} on port {self.server_port}", source=self.step_name)
                                return True
                            except:
                                continue
            else:  # Unix/Linux/Mac
                # Find and kill processes using the port on Unix-like systems
                cmd = f'lsof -ti:{self.server_port}'
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)

                if result.returncode == 0 and result.stdout:
                    pids = result.stdout.strip().split('\n')
                    for pid in pids:
                        if pid:
                            try:
                                subprocess.run(['kill', '-9', pid], timeout=10)
                                PrintHelper.info(f"[PROCESS-KILLER] Killed Unix process {pid} on port {self.server_port}", source=self.step_name)
                                return True
                            except:
                                continue

            return False

        except subprocess.TimeoutExpired:
            PrintHelper.warning(f"[PROCESS-KILLER] Timeout during platform-specific port killing", source=self.step_name)
            return False
        except Exception as e:
            PrintHelper.warning(f"[PROCESS-KILLER] Platform-specific port killing failed: {e}", source=self.step_name)
            return False

    def get_results(self) -> Dict[str, Any]:
        """Get the results of Step 19 execution"""
        return self.results

    def print_step19_summary(self) -> None:
        """Print a concise summary of Step 19 results"""
        try:
            if not self.results:
                PrintHelper.info(f"[SUMMARY] No results available", source=self.step_name)
                return

            PrintHelper.info(f"\n[SUMMARY] STEP 19 COMPLETION SUMMARY", source=self.step_name)
            PrintHelper.info(f"{'-' * 60}")

            if self.results.get('success', False):
                PrintHelper.info(f"Status: SUCCESS", source=self.step_name)
                PrintHelper.info(f"Server URL: {self.results.get('server_url', 'N/A')}", source=self.step_name)
                PrintHelper.info(f"User Action: {self.results.get('user_action', 'N/A')}", source=self.step_name)

                summary = self.results.get('summary', {})
                features = summary.get('features_available', [])
                if features:
                    PrintHelper.info(f"Features Used: {', '.join(features)}", source=self.step_name)

            else:
                PrintHelper.info(f"Status: FAILED", source=self.step_name)
                PrintHelper.info(f"Error: {self.results.get('error', 'Unknown error')}", source=self.step_name)

            PrintHelper.info(f"{'-' * 60}")

        except Exception as e:
            PrintHelper.error(f"Failed to print summary: {e}", source=self.step_name)


def main():
    """Main function for testing Step 19 controller"""
    PrintHelper.info("[TEST] Step 19 View Effects Controller - Standalone Test", source="STEP-19")

    # Test with current directory
    current_dir = Path.cwd()
    controller = Step19ViewEffectsController()

    if controller.initialize(current_dir, "app_bank"):
        results = controller.execute_step19_view_effects()
        controller.print_step19_summary()
    else:
        PrintHelper.info("[TEST] Initialization failed", source="STEP-19")


if __name__ == "__main__":
    main()
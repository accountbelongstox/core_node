import os
import subprocess
import sys
import time
from pathlib import Path

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

# Check and install dependencies before importing third-party packages
from pytools import check_and_install_dependencies
check_and_install_dependencies()

import psutil
from pywinauto import Application

class AppLauncher:
    """Utility class for launching and connecting to applications."""
    
    @staticmethod
    def kill_exe(exe_path):
        """Kill process by executable path."""
        basename = os.path.basename(exe_path)
        print(f"Killing {basename} process...")
        try:
            subprocess.run(f'taskkill /F /IM "{basename}"', shell=True, check=True)
            print(f"Successfully killed {basename} process")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error killing process: {e}")
            return False
    
    @staticmethod
    def connect_to_app(exe_path, launch_args=None, force=False):
        """Connect to application using simple method."""
        basename = os.path.basename(exe_path)
        
        # If force is True, kill process first
        if force:
            print(f"Force mode: killing {basename} first...")
            AppLauncher.kill_exe(exe_path)
            time.sleep(2)
        
        # Try to connect first
        print(f"Trying to connect to existing {basename}...")
        try:
            app = Application(backend="uia").connect(path=exe_path)
            print(f"Connected to {basename}")
            return app
        except Exception:
            pass
        
        # If connection failed, try to start
        print(f"Could not connect to {basename}, attempting to start...")
        try:
            if launch_args:
                full_path = f"{exe_path} {launch_args}"
            else:
                full_path = exe_path
            app = Application(backend="uia").start(full_path)
            print(f"Started {basename}")
            return app
        except Exception as e:
            print(f"Error starting {basename}: {e}")
        
        # If start failed, kill and restart
        print(f"Start failed, killing {basename} and restarting...")
        AppLauncher.kill_exe(exe_path)
        time.sleep(2)
        
        try:
            if launch_args:
                full_path = f"{exe_path} {launch_args}"
            else:
                full_path = exe_path
            app = Application(backend="uia").start(full_path)
            print(f"Successfully started {basename} after kill")
            return app
        except Exception as e:
            print(f"Error starting {basename} after kill: {e}")
            return None 
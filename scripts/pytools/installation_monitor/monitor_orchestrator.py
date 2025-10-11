"""
Installation Monitor Orchestrator
Main script for monitoring software installations
"""

import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Optional

from filesystem_monitor import create_filesystem_monitor
from registry_monitor import create_registry_monitor
from utils import create_timestamp_dir, save_json
from config import MONITOR_RESULTS_BASE, DEFAULT_SOFTWARE_NAME


class InstallationMonitor:
    """Orchestrates filesystem and registry monitoring"""

    def __init__(self, software_name: Optional[str] = None):
        """
        Initialize installation monitor

        Args:
            software_name: Optional software name
        """
        self.software_name = software_name
        self.fs_monitor = None
        self.reg_monitor = None
        self.output_dir = None
        self.session_info = {}
        self.monitor_options = None  # Will be set by GUI

    def get_option(self, key: str, default: bool = True) -> bool:
        """
        Safely get option value from monitor_options

        Args:
            key: Option key
            default: Default value if option not found

        Returns:
            Boolean value of the option
        """
        if not self.monitor_options:
            return default
        opt = self.monitor_options.get(key)
        if opt is None:
            return default
        try:
            return opt.get()
        except:
            return default

    def setup_monitors(self) -> None:
        """Setup filesystem and registry monitors"""
        print("\n" + "=" * 80)
        print("INSTALLATION MONITOR - SETUP")
        print("=" * 80)

        # Determine which monitors to set up based on options
        if self.monitor_options:
            # GUI mode with options
            # Check if any filesystem directories are enabled
            monitor_fs = any([
                var.get() for key, var in self.monitor_options.items() 
                if key != 'registry'
            ])
            monitor_reg = self.get_option('registry', True)

            # Create filesystem monitor with selected options
            if monitor_fs:
                print("\nSetting up filesystem monitor...")
                self.fs_monitor = self._create_custom_filesystem_monitor()

            # Create registry monitor if selected
            if monitor_reg:
                print("Setting up registry monitor...")
                self.reg_monitor = create_registry_monitor()
        else:
            # CLI mode - monitor everything by default
            print("\nSetting up filesystem monitor...")
            self.fs_monitor = create_filesystem_monitor(
                program_files=True,
                program_files_x86=True,
                user_home=False,  # Too noisy
                start_menus=True
            )

            print("Setting up registry monitor...")
            self.reg_monitor = create_registry_monitor()

        print("\nMonitors ready!")

    def _create_custom_filesystem_monitor(self):
        """Create filesystem monitor based on GUI options"""
        from config import DIRECTORY_CONFIG
        from filesystem_monitor import FilesystemMonitor

        # Create directory configuration based on selected options
        directory_config = {}
        
        for key, var in self.monitor_options.items():
            if key != 'registry' and key in DIRECTORY_CONFIG:
                if var.get():  # Option is enabled
                    directory_config[key] = DIRECTORY_CONFIG[key].copy()
                    directory_config[key]['enabled'] = True

        return FilesystemMonitor(directory_config=directory_config)

    def start_monitoring(self) -> None:
        """Start monitoring process"""
        if not self.fs_monitor:
            self.setup_monitors()

        print("\n" + "=" * 80)
        print("STARTING MONITORING")
        print("=" * 80)

        # Create output directory
        MONITOR_RESULTS_BASE.mkdir(parents=True, exist_ok=True)
        self.output_dir = create_timestamp_dir(MONITOR_RESULTS_BASE, self.software_name)

        print(f"\nResults will be saved to: {self.output_dir}")

        # Start filesystem monitor
        if self.fs_monitor:
            print("\n" + "-" * 80)
            print("Starting filesystem monitoring...")
            self.fs_monitor.start_monitoring()

        # Start registry monitor if enabled
        if self.reg_monitor:
            print("\n" + "-" * 80)
            print("Starting registry monitoring...")
            self.reg_monitor.start_monitoring()

        # Store session info
        self.session_info = {
            "software_name": self.software_name or DEFAULT_SOFTWARE_NAME,
            "start_time": datetime.now().isoformat(),
            "timestamp": time.time(),
            "output_dir": str(self.output_dir)
        }

        print("\n" + "=" * 80)
        print("MONITORING ACTIVE")
        print("=" * 80)
        print("\nNow you can install your software.")
        print("Press ENTER when installation is complete...")

    def stop_monitoring(self) -> None:
        """Stop monitoring and save results"""
        print("\n" + "=" * 80)
        print("STOPPING MONITORING")
        print("=" * 80)

        # Stop filesystem monitoring
        fs_changes = {}
        if self.fs_monitor:
            print("\n" + "-" * 80)
            print("Stopping filesystem monitoring...")
            fs_changes = self.fs_monitor.stop_monitoring()
            self.fs_monitor.print_summary()

        # Stop registry monitoring
        reg_changes = []
        if self.reg_monitor:
            print("\n" + "-" * 80)
            print("Stopping registry monitoring...")
            reg_changes = self.reg_monitor.stop_monitoring()
            self.reg_monitor.print_summary()

        # Update session info
        self.session_info.update({
            "end_time": datetime.now().isoformat(),
            "filesystem_changes": sum(len(v) for v in fs_changes.values()) if fs_changes else 0,
            "registry_changes": len(reg_changes) if reg_changes else 0
        })

        # Save results
        print("\n" + "=" * 80)
        print("SAVING RESULTS")
        print("=" * 80)

        if self.fs_monitor:
            self.fs_monitor.save_results(self.output_dir)
        
        if self.reg_monitor:
            self.reg_monitor.save_results(self.output_dir)
            self.reg_monitor.export_changed_keys(self.output_dir)

        # Save session info
        save_json(self.session_info, self.output_dir / "session_info.json")

        print("\n" + "=" * 80)
        print("MONITORING COMPLETE")
        print("=" * 80)
        print(f"\nResults saved to: {self.output_dir}")
        print(f"Session: {self.session_info['software_name']}")
        print(f"Filesystem changes: {self.session_info['filesystem_changes']}")
        print(f"Registry changes: {self.session_info['registry_changes']}")
        print("\n")


def main():
    """Main entry point"""
    print("\n" + "=" * 80)
    print("SOFTWARE INSTALLATION MONITOR")
    print("=" * 80)
    print("\nThis tool monitors filesystem and registry changes during software installation.")
    print("\nWhat it monitors:")
    print("  1. C:\\Program Files")
    print("  2. C:\\Program Files (x86)")
    print("  3. User home directory (excluding temp files)")
    print("  4. Start Menu directories (user and public)")
    print("  5. AppData directories")
    print("  6. Registry keys (installation and system keys)")
    print("\n" + "=" * 80)

    # Ask for software name
    software_name = input("\nEnter software name (optional, press ENTER to skip): ").strip()
    if not software_name:
        software_name = None
        print("Using auto-generated name.")

    # Confirm to start
    print("\n" + "=" * 80)
    start = input("\nPress 'y' to start monitoring (or any other key to cancel): ").strip().lower()

    if start != 'y':
        print("Monitoring cancelled.")
        return

    # Create and start monitor
    monitor = InstallationMonitor(software_name)

    try:
        monitor.start_monitoring()

        # Wait for user to complete installation
        input()

        # Stop and save results
        monitor.stop_monitoring()

    except KeyboardInterrupt:
        print("\n\nMonitoring interrupted by user.")
        print("Results may be incomplete.")
        sys.exit(1)

    except Exception as e:
        print(f"\n\nError during monitoring: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

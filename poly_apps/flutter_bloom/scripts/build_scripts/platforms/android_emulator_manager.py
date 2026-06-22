#!/usr/bin/env python3
"""
Android Emulator Manager - Cross-platform emulator management
Manages Android Virtual Devices (AVDs) for Flutter debugging
"""

import subprocess
import time
import platform
from typing import List, Optional, Dict
from pathlib import Path


class AndroidEmulatorManager:
    """
    Manages Android emulators for Flutter debugging

    Features:
    - List available AVDs
    - Check running emulators
    - Start emulator if not running
    - Wait for emulator to be ready
    """

    def __init__(self):
        self.is_windows = platform.system() == "Windows"

    def get_available_emulators(self) -> List[str]:
        """
        Get list of available Android Virtual Devices (AVDs)

        Returns:
            List[str]: List of AVD names
        """
        try:
            # Run emulator -list-avds
            result = subprocess.run(
                ['emulator', '-list-avds'],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                # Parse output - one AVD name per line
                avds = [line.strip() for line in result.stdout.split('\n') if line.strip()]
                return avds
            else:
                print(f"[Emulator Manager] Failed to list AVDs: {result.stderr}")
                return []

        except FileNotFoundError:
            print("[Emulator Manager] 'emulator' command not found. Please ensure Android SDK is installed and in PATH.")
            return []
        except subprocess.TimeoutExpired:
            print("[Emulator Manager] Timeout while listing AVDs")
            return []
        except Exception as e:
            print(f"[Emulator Manager] Error listing AVDs: {e}")
            return []

    def get_running_emulators(self) -> List[str]:
        """
        Get list of currently running emulator device IDs

        Returns:
            List[str]: List of emulator device IDs (e.g., ['emulator-5554'])
        """
        try:
            result = subprocess.run(
                ['adb', 'devices'],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                # Parse output - find lines with "emulator-" prefix and "device" status
                running_emulators = []
                for line in result.stdout.split('\n'):
                    if '\t' in line:
                        parts = line.split('\t')
                        device_id = parts[0].strip()
                        status = parts[1].strip() if len(parts) > 1 else ''

                        # Check if it's an emulator and status is "device"
                        if device_id.startswith('emulator-') and status == 'device':
                            running_emulators.append(device_id)

                return running_emulators
            else:
                print(f"[Emulator Manager] Failed to list devices: {result.stderr}")
                return []

        except FileNotFoundError:
            print("[Emulator Manager] 'adb' command not found")
            return []
        except Exception as e:
            print(f"[Emulator Manager] Error checking running emulators: {e}")
            return []

    def is_emulator_running(self, avd_name: Optional[str] = None) -> bool:
        """
        Check if any emulator (or specific AVD) is running

        Args:
            avd_name: Optional AVD name to check. If None, checks if any emulator is running.

        Returns:
            bool: True if emulator is running
        """
        running = self.get_running_emulators()

        if avd_name is None:
            # Check if any emulator is running
            return len(running) > 0
        else:
            # For specific AVD, we can't directly map device ID to AVD name
            # So we just check if any emulator is running
            # (More complex implementation would query each emulator for its AVD name)
            return len(running) > 0

    def start_emulator(self, avd_name: str, wait_timeout: int = 120) -> Dict:
        """
        Start an Android emulator

        Args:
            avd_name: AVD name to start
            wait_timeout: Maximum seconds to wait for emulator to be ready (default: 120)

        Returns:
            Dict: {success: bool, device_id: str, message: str}
        """
        print(f"[Emulator Manager] Starting emulator: {avd_name}")

        # Check if emulator is already running
        if self.is_emulator_running():
            running = self.get_running_emulators()
            print(f"[Emulator Manager] Emulator already running: {running[0]}")
            return {
                'success': True,
                'device_id': running[0],
                'message': f'Emulator already running: {running[0]}'
            }

        try:
            # Start emulator in background
            emulator_args = [
                'emulator',
                '-avd', avd_name,
                '-netdelay', 'none',
                '-netspeed', 'full'
            ]

            # Start process without waiting
            if self.is_windows:
                # Windows: use CREATE_NEW_PROCESS_GROUP to detach
                subprocess.Popen(
                    emulator_args,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                # Unix: use nohup-like behavior
                subprocess.Popen(
                    emulator_args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True
                )

            print(f"[Emulator Manager] Emulator process started, waiting for device to be ready...")

            # Wait for emulator to appear in adb devices with status "device"
            waited = 0
            wait_interval = 2  # Check every 2 seconds

            while waited < wait_timeout:
                time.sleep(wait_interval)
                waited += wait_interval

                running = self.get_running_emulators()
                if running:
                    device_id = running[0]
                    print(f"[Emulator Manager] Emulator ready: {device_id} (waited {waited}s)")
                    return {
                        'success': True,
                        'device_id': device_id,
                        'message': f'Emulator started successfully: {device_id}'
                    }

                # Show progress
                if waited % 10 == 0:
                    print(f"[Emulator Manager] Still waiting for emulator... ({waited}/{wait_timeout}s)")

            # Timeout
            print(f"[Emulator Manager] Timeout waiting for emulator to start ({wait_timeout}s)")
            return {
                'success': False,
                'device_id': '',
                'message': f'Timeout waiting for emulator to start (waited {wait_timeout}s)'
            }

        except FileNotFoundError:
            error_msg = "'emulator' command not found. Please ensure Android SDK is installed and in PATH."
            print(f"[Emulator Manager] {error_msg}")
            return {
                'success': False,
                'device_id': '',
                'message': error_msg
            }
        except Exception as e:
            error_msg = f"Error starting emulator: {e}"
            print(f"[Emulator Manager] {error_msg}")
            return {
                'success': False,
                'device_id': '',
                'message': error_msg
            }

    def get_emulator_choice_display(self, avd_name: str) -> str:
        """
        Get display name for emulator choice

        Args:
            avd_name: AVD name

        Returns:
            str: Display name (e.g., "Pixel_5_API_31" or "Physical Device" or "Auto")
        """
        if avd_name == "auto":
            return "Auto"
        elif avd_name == "physical":
            return "Physical Device"
        else:
            return avd_name


# Global instance
android_emulator_manager = AndroidEmulatorManager()

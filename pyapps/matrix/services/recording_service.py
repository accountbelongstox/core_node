"""Recording and screenshot service using ADB shell commands"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import asyncio
import time
from typing import Optional, Dict
from pathlib import Path
from datetime import datetime
from pycore.pyutils.device import ADBManager
from pycore.pyutils.device_manager import DeviceManager
from pyapps.matrix.matrix_config import Config


class RecordingService:
    """
    Recording and screenshot service

    Responsibilities:
    - Start/stop screen recording
    - Capture screenshots
    - Manage recording files

    Uses ADBManager shell commands for recording/screenshot operations.
    """

    _instance: Optional['RecordingService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = DeviceManager.instance()
        self.recordings_dir = Path("recordings")  # Can be configured
        self.screenshots_dir = Path("screenshots")  # Can be configured

        # Create directories if not exist
        self.recordings_dir.mkdir(exist_ok=True)
        self.screenshots_dir.mkdir(exist_ok=True)

        # Track active recordings: {serial: recording_info}
        self.active_recordings: Dict[str, Dict] = {}

    @classmethod
    def instance(cls) -> 'RecordingService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start_recording(
        self,
        serial: str,
        quality: str = "high",  # high, medium, low
        max_duration: int = 1800  # 30 minutes default
    ) -> Dict:
        """
        Start screen recording on device

        Args:
            serial: Device serial
            quality: Recording quality (high=8Mbps, medium=4Mbps, low=2Mbps)
            max_duration: Maximum recording duration in seconds

        Returns:
            {
                "success": bool,
                "recordingId": str,
                "startTime": str (ISO8601),
                "error": str (if failed)
            }
        """
        try:
            # Check if already recording
            if serial in self.active_recordings:
                return {
                    "success": False,
                    "error": "Device is already recording. Stop current recording first."
                }

            # Check device connection
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return {
                    "success": False,
                    "error": f"Device {serial} not connected"
                }

            # Generate recording ID and file paths
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            recording_id = f"{serial}_{timestamp}"
            device_path = f"/sdcard/pymatrix_recording_{timestamp}.mp4"
            local_path = self.recordings_dir / f"{recording_id}.mp4"

            # Determine bit rate based on quality
            bit_rate_map = {
                "high": 8000000,    # 8 Mbps
                "medium": 4000000,  # 4 Mbps
                "low": 2000000      # 2 Mbps
            }
            bit_rate = bit_rate_map.get(quality, 8000000)

            # Build screenrecord command
            # Note: screenrecord has 3-minute limit by default, can extend with --time-limit
            cmd = f"screenrecord --bit-rate {bit_rate} --time-limit {min(max_duration, 180)} {device_path}"

            # Start recording in background (non-blocking)
            # We use asyncio to run the shell command without blocking
            async def run_recording():
                try:
                    result = await asyncio.to_thread(
                        ADBManager.execute_shell,
                        serial,
                        cmd,
                        self.adb_path,
                        timeout=max_duration + 10  # Add buffer
                    )
                    print(f"[RecordingService] Recording completed for {serial}: {result}")

                    # Pull file from device to local
                    pull_cmd = [self.adb_path, "-s", serial, "pull", device_path, str(local_path)]
                    pull_result = await asyncio.to_thread(
                        ADBManager._run_command,
                        pull_cmd,
                        check=False
                    )

                    if pull_result.returncode == 0:
                        # Clean up device file
                        await asyncio.to_thread(
                            ADBManager.execute_shell,
                            serial,
                            f"rm {device_path}",
                            self.adb_path
                        )
                        print(f"[RecordingService] Recording file saved: {local_path}")

                        # Update recording info
                        if serial in self.active_recordings:
                            self.active_recordings[serial]["status"] = "completed"
                            self.active_recordings[serial]["localPath"] = str(local_path)
                            self.active_recordings[serial]["fileSize"] = local_path.stat().st_size
                    else:
                        print(f"[RecordingService] Failed to pull recording file: {pull_result.stderr}")
                        if serial in self.active_recordings:
                            self.active_recordings[serial]["status"] = "failed"

                except Exception as e:
                    print(f"[RecordingService] Recording error for {serial}: {e}")
                    if serial in self.active_recordings:
                        self.active_recordings[serial]["status"] = "failed"
                        self.active_recordings[serial]["error"] = str(e)

            # Start recording task
            asyncio.create_task(run_recording())

            # Store recording info
            start_time = datetime.now()
            self.active_recordings[serial] = {
                "recordingId": recording_id,
                "startTime": start_time.isoformat(),
                "devicePath": device_path,
                "localPath": str(local_path),
                "status": "recording",
                "quality": quality,
                "maxDuration": max_duration
            }

            return {
                "success": True,
                "recordingId": recording_id,
                "startTime": start_time.isoformat()
            }

        except Exception as e:
            print(f"[RecordingService] Failed to start recording for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def stop_recording(self, serial: str) -> Dict:
        """
        Stop screen recording on device

        Args:
            serial: Device serial

        Returns:
            {
                "success": bool,
                "recordingId": str,
                "duration": float (seconds),
                "fileSize": int (bytes),
                "filePath": str
            }
        """
        try:
            # Check if recording exists
            if serial not in self.active_recordings:
                return {
                    "success": False,
                    "error": "No active recording found for this device"
                }

            recording_info = self.active_recordings[serial]

            # Send SIGINT to stop screenrecord (Ctrl+C equivalent)
            # Note: This is tricky with ADB. A cleaner way is to wait for natural termination
            # or use a time limit. For now, we'll kill the process.
            try:
                # Find and kill screenrecord process
                pid_cmd = "ps | grep screenrecord | grep -v grep | awk '{print $2}'"
                pid_result = await asyncio.to_thread(
                    ADBManager.execute_shell,
                    serial,
                    pid_cmd,
                    self.adb_path
                )

                if pid_result.strip():
                    pid = pid_result.strip().split('\n')[0]
                    kill_cmd = f"kill -2 {pid}"  # SIGINT
                    await asyncio.to_thread(
                        ADBManager.execute_shell,
                        serial,
                        kill_cmd,
                        self.adb_path
                    )

                    # Wait a bit for file to be finalized
                    await asyncio.sleep(2)
            except Exception as e:
                print(f"[RecordingService] Could not kill screenrecord process: {e}")

            # Calculate duration
            start_time = datetime.fromisoformat(recording_info["startTime"])
            duration = (datetime.now() - start_time).total_seconds()

            # Pull file if not already pulled
            local_path = Path(recording_info["localPath"])
            if not local_path.exists():
                device_path = recording_info["devicePath"]
                pull_cmd = [self.adb_path, "-s", serial, "pull", device_path, str(local_path)]
                pull_result = await asyncio.to_thread(
                    ADBManager._run_command,
                    pull_cmd,
                    check=False
                )

                if pull_result.returncode == 0:
                    # Clean up device file
                    await asyncio.to_thread(
                        ADBManager.execute_shell,
                        serial,
                        f"rm {device_path}",
                        self.adb_path
                    )

            # Get file size
            file_size = local_path.stat().st_size if local_path.exists() else 0

            # Remove from active recordings
            del self.active_recordings[serial]

            return {
                "success": True,
                "recordingId": recording_info["recordingId"],
                "duration": duration,
                "fileSize": file_size,
                "filePath": str(local_path)
            }

        except Exception as e:
            print(f"[RecordingService] Failed to stop recording for {serial}: {e}")
            # Clean up
            if serial in self.active_recordings:
                del self.active_recordings[serial]
            return {
                "success": False,
                "error": str(e)
            }

    async def capture_screenshot(self, serial: str, format: str = "png") -> Dict:
        """
        Capture screenshot from device

        Args:
            serial: Device serial
            format: Image format (png or jpg)

        Returns:
            {
                "success": bool,
                "screenshotId": str,
                "filePath": str,
                "timestamp": str (ISO8601),
                "error": str (if failed)
            }
        """
        try:
            # Check device connection
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return {
                    "success": False,
                    "error": f"Device {serial} not connected"
                }

            # Generate screenshot ID and paths
            timestamp = datetime.now()
            timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
            screenshot_id = f"{serial}_{timestamp_str}"
            device_path = f"/sdcard/pymatrix_screenshot_{timestamp_str}.{format}"
            local_path = self.screenshots_dir / f"{screenshot_id}.{format}"

            # Capture screenshot
            screencap_cmd = f"screencap -p {device_path}"
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                screencap_cmd,
                self.adb_path,
                timeout=10
            )

            # Pull screenshot from device
            pull_cmd = [self.adb_path, "-s", serial, "pull", device_path, str(local_path)]
            pull_result = await asyncio.to_thread(
                ADBManager._run_command,
                pull_cmd,
                check=False,
                timeout=15
            )

            if pull_result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Failed to pull screenshot: {pull_result.stderr}"
                }

            # Clean up device file
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                f"rm {device_path}",
                self.adb_path
            )

            print(f"[RecordingService] Screenshot saved: {local_path}")

            return {
                "success": True,
                "screenshotId": screenshot_id,
                "filePath": str(local_path),
                "timestamp": timestamp.isoformat()
            }

        except Exception as e:
            print(f"[RecordingService] Failed to capture screenshot for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_recording_status(self, serial: str) -> Optional[Dict]:
        """Get current recording status for a device"""
        return self.active_recordings.get(serial)

    def is_recording(self, serial: str) -> bool:
        """Check if device is currently recording"""
        return serial in self.active_recordings

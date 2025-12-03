"""File management service for pushing files and installing APKs"""

from typing import Optional, Dict, List
from pathlib import Path
import asyncio
import os
import tempfile
import hashlib
from datetime import datetime

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from pycore.pyutils.device import ADBManager
from pyapps.matrix.matrix_config import Config


class FileService:
    """
    File management service

    Responsibilities:
    - Push files to devices
    - Install/uninstall APK files
    - Track file transfer progress
    - Manage temporary uploaded files
    """

    _instance: Optional['FileService'] = None

    def __init__(self):
        self.upload_dir = Path(tempfile.gettempdir()) / "pymatrix_uploads"
        self.upload_dir.mkdir(exist_ok=True)

        # Track ongoing transfers
        self.transfer_tasks: Dict[str, Dict] = {}  # taskId -> task info

    @classmethod
    def instance(cls) -> 'FileService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _generate_task_id(self, device_serial: str, filename: str) -> str:
        """Generate unique task ID for file transfer"""
        timestamp = datetime.now().isoformat()
        content = f"{device_serial}_{filename}_{timestamp}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

    async def save_uploaded_file(
        self,
        file_content: bytes,
        filename: str
    ) -> Path:
        """
        Save uploaded file to temporary directory

        Args:
            file_content: File content bytes
            filename: Original filename

        Returns:
            Path to saved file
        """
        # Create unique filename to avoid conflicts
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{filename}"
        file_path = self.upload_dir / safe_filename

        # Save file asynchronously
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, file_path.write_bytes, file_content)

        print(f"[FileService] Saved uploaded file: {file_path}")
        return file_path

    async def push_file(
        self,
        device_serial: str,
        local_path: Path,
        remote_path: str
    ) -> Dict:
        """
        Push file to device

        Args:
            device_serial: Device serial number
            local_path: Local file path
            remote_path: Remote path on device (e.g., /sdcard/Download/file.txt)

        Returns:
            {
                "success": bool,
                "taskId": str,
                "localPath": str,
                "remotePath": str,
                "fileSize": int,
                "error": str (if failed)
            }
        """
        try:
            if not local_path.exists():
                return {
                    "success": False,
                    "error": f"Local file not found: {local_path}"
                }

            file_size = local_path.stat().st_size
            task_id = self._generate_task_id(device_serial, local_path.name)

            # Track task
            self.transfer_tasks[task_id] = {
                "type": "push",
                "deviceSerial": device_serial,
                "localPath": str(local_path),
                "remotePath": remote_path,
                "fileSize": file_size,
                "status": "in_progress",
                "startTime": datetime.now().isoformat()
            }

            print(f"[FileService] Pushing file to {device_serial}: {local_path} -> {remote_path}")

            # Execute push in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            adb_path = Config.get_adb_path()

            success = await loop.run_in_executor(
                None,
                ADBManager.push_file,
                device_serial,
                local_path,
                remote_path,
                adb_path
            )

            # Update task status
            self.transfer_tasks[task_id]["status"] = "completed" if success else "failed"
            self.transfer_tasks[task_id]["endTime"] = datetime.now().isoformat()

            if success:
                print(f"[FileService] Successfully pushed file to {device_serial}")
                return {
                    "success": True,
                    "taskId": task_id,
                    "localPath": str(local_path),
                    "remotePath": remote_path,
                    "fileSize": file_size
                }
            else:
                error_msg = "Failed to push file to device"
                self.transfer_tasks[task_id]["error"] = error_msg
                print(f"[FileService] {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }

        except Exception as e:
            error_msg = f"Error pushing file: {str(e)}"
            print(f"[FileService] {error_msg}")
            if task_id in self.transfer_tasks:
                self.transfer_tasks[task_id]["status"] = "failed"
                self.transfer_tasks[task_id]["error"] = error_msg
            return {
                "success": False,
                "error": error_msg
            }

    async def install_apk(
        self,
        device_serial: str,
        apk_path: Path,
        reinstall: bool = False
    ) -> Dict:
        """
        Install APK to device

        Args:
            device_serial: Device serial number
            apk_path: Local APK file path
            reinstall: If True, reinstall if already installed (-r flag)

        Returns:
            {
                "success": bool,
                "taskId": str,
                "apkPath": str,
                "packageName": str (if success),
                "error": str (if failed)
            }
        """
        try:
            if not apk_path.exists():
                return {
                    "success": False,
                    "error": f"APK file not found: {apk_path}"
                }

            if not apk_path.suffix.lower() == '.apk':
                return {
                    "success": False,
                    "error": "File is not an APK"
                }

            file_size = apk_path.stat().st_size
            task_id = self._generate_task_id(device_serial, apk_path.name)

            # Track task
            self.transfer_tasks[task_id] = {
                "type": "install",
                "deviceSerial": device_serial,
                "apkPath": str(apk_path),
                "fileSize": file_size,
                "status": "in_progress",
                "startTime": datetime.now().isoformat()
            }

            print(f"[FileService] Installing APK to {device_serial}: {apk_path}")

            # Build install command
            adb_path = Config.get_adb_path()
            cmd = [adb_path, "-s", device_serial, "install"]
            if reinstall:
                cmd.append("-r")
            cmd.append(str(apk_path))

            # Execute install in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                ADBManager._run_command,
                cmd,
                False  # check=False
            )

            success = result.returncode == 0
            output = result.stdout.strip() if result.stdout else ""

            # Update task status
            self.transfer_tasks[task_id]["status"] = "completed" if success else "failed"
            self.transfer_tasks[task_id]["endTime"] = datetime.now().isoformat()

            if success:
                # Try to extract package name from output (e.g., "Success")
                # For more accurate package name, we could parse the APK
                print(f"[FileService] Successfully installed APK to {device_serial}")
                return {
                    "success": True,
                    "taskId": task_id,
                    "apkPath": str(apk_path),
                    "output": output
                }
            else:
                error_msg = result.stderr.strip() if result.stderr else "Failed to install APK"
                self.transfer_tasks[task_id]["error"] = error_msg
                print(f"[FileService] Failed to install APK: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }

        except Exception as e:
            error_msg = f"Error installing APK: {str(e)}"
            print(f"[FileService] {error_msg}")
            if task_id in self.transfer_tasks:
                self.transfer_tasks[task_id]["status"] = "failed"
                self.transfer_tasks[task_id]["error"] = error_msg
            return {
                "success": False,
                "error": error_msg
            }

    async def uninstall_apk(
        self,
        device_serial: str,
        package_name: str
    ) -> Dict:
        """
        Uninstall APK from device

        Args:
            device_serial: Device serial number
            package_name: Package name to uninstall (e.g., com.example.app)

        Returns:
            {
                "success": bool,
                "packageName": str,
                "error": str (if failed)
            }
        """
        try:
            print(f"[FileService] Uninstalling package from {device_serial}: {package_name}")

            adb_path = Config.get_adb_path()
            cmd = [adb_path, "-s", device_serial, "uninstall", package_name]

            # Execute uninstall in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                ADBManager._run_command,
                cmd,
                False
            )

            success = result.returncode == 0

            if success:
                print(f"[FileService] Successfully uninstalled {package_name} from {device_serial}")
                return {
                    "success": True,
                    "packageName": package_name
                }
            else:
                error_msg = result.stderr.strip() if result.stderr else "Failed to uninstall package"
                print(f"[FileService] Failed to uninstall: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }

        except Exception as e:
            error_msg = f"Error uninstalling APK: {str(e)}"
            print(f"[FileService] {error_msg}")
            return {
                "success": False,
                "error": error_msg
            }

    async def list_installed_packages(
        self,
        device_serial: str,
        filter_pattern: Optional[str] = None
    ) -> Dict:
        """
        List installed packages on device

        Args:
            device_serial: Device serial number
            filter_pattern: Optional filter pattern (e.g., "com.example")

        Returns:
            {
                "success": bool,
                "packages": List[str],
                "count": int,
                "error": str (if failed)
            }
        """
        try:
            print(f"[FileService] Listing installed packages on {device_serial}")

            adb_path = Config.get_adb_path()

            # Execute shell command to list packages
            loop = asyncio.get_event_loop()
            output = await loop.run_in_executor(
                None,
                ADBManager.execute_shell,
                device_serial,
                "pm list packages",
                adb_path
            )

            # Parse output (format: "package:com.example.app")
            packages = []
            for line in output.splitlines():
                if line.startswith("package:"):
                    package_name = line.replace("package:", "").strip()
                    if filter_pattern is None or filter_pattern in package_name:
                        packages.append(package_name)

            print(f"[FileService] Found {len(packages)} packages on {device_serial}")
            return {
                "success": True,
                "packages": packages,
                "count": len(packages)
            }

        except Exception as e:
            error_msg = f"Error listing packages: {str(e)}"
            print(f"[FileService] {error_msg}")
            return {
                "success": False,
                "error": error_msg
            }

    async def get_transfer_status(self, task_id: str) -> Dict:
        """
        Get file transfer task status

        Args:
            task_id: Task ID

        Returns:
            Task info dict or error
        """
        if task_id not in self.transfer_tasks:
            return {
                "success": False,
                "error": "Task not found"
            }

        return {
            "success": True,
            **self.transfer_tasks[task_id]
        }

    async def cleanup_temp_file(self, file_path: Path) -> bool:
        """
        Clean up temporary uploaded file

        Args:
            file_path: Path to temp file

        Returns:
            Success status
        """
        try:
            if file_path.exists() and file_path.parent == self.upload_dir:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, file_path.unlink)
                print(f"[FileService] Cleaned up temp file: {file_path}")
                return True
            return False
        except Exception as e:
            print(f"[FileService] Failed to cleanup temp file: {e}")
            return False

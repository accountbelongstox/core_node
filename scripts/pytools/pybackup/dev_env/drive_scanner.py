import os
import platform
import shutil
from typing import List, Dict, Tuple
from dataclasses import dataclass
import logging

from pycore.pyfoundations.pygvar import IS_WINDOWS

logger = logging.getLogger(__name__)


@dataclass
class DriveInfo:
    letter: str
    total_space: int
    used_space: int
    free_space: int
    filesystem: str
    mount_point: str

    @property
    def free_space_gb(self) -> float:
        return self.free_space / (1024 ** 3)

    @property
    def total_space_gb(self) -> float:
        return self.total_space / (1024 ** 3)

    @property
    def used_space_gb(self) -> float:
        return self.used_space / (1024 ** 3)

    @property
    def usage_percent(self) -> float:
        if self.total_space == 0:
            return 0.0
        return (self.used_space / self.total_space) * 100

    def __repr__(self) -> str:
        return (
            f"DriveInfo(letter='{self.letter}', "
            f"free={self.free_space_gb:.2f}GB, "
            f"total={self.total_space_gb:.2f}GB, "
            f"used={self.usage_percent:.1f}%)"
        )


class DriveScanner:
    def __init__(self, exclude_drives: List[str] = None):
        self.exclude_drives = exclude_drives or []
        if IS_WINDOWS and 'C' not in [d.upper() for d in self.exclude_drives]:
            self.exclude_drives.append('C')

    def scan_drives(self, min_free_space_gb: float = 10.0) -> List[DriveInfo]:
        if IS_WINDOWS:
            drives = self._scan_windows_drives()
        else:
            drives = self._scan_linux_drives()

        filtered_drives = [
            drive for drive in drives
            if drive.letter.upper() not in [d.upper() for d in self.exclude_drives]
        ]

        sorted_drives = sorted(filtered_drives, key=lambda d: d.free_space, reverse=True)

        logger.info(f"Scanned {len(sorted_drives)} available drives")
        for drive in sorted_drives:
            logger.info(f"  {drive}")

        return sorted_drives

    def _scan_windows_drives(self) -> List[DriveInfo]:
        drives = []

        try:
            import string
            from ctypes import windll

            bitmask = windll.kernel32.GetLogicalDrives()

            for letter in string.ascii_uppercase:
                if bitmask & 1:
                    drive_path = f'{letter}:\\'

                    try:
                        usage = shutil.disk_usage(drive_path)

                        drive_info = DriveInfo(
                            letter=letter,
                            total_space=usage.total,
                            used_space=usage.used,
                            free_space=usage.free,
                            filesystem=self._get_filesystem_type(drive_path),
                            mount_point=drive_path
                        )

                        drives.append(drive_info)

                    except (PermissionError, FileNotFoundError, OSError) as e:
                        logger.debug(f"Cannot access drive {letter}: {e}")

                bitmask >>= 1

        except Exception as e:
            logger.error(f"Error scanning Windows drives: {e}")

        return drives

    def _scan_linux_drives(self) -> List[DriveInfo]:
        drives = []

        try:
            import psutil

            partitions = psutil.disk_partitions()

            for partition in partitions:
                if 'loop' in partition.device or 'snap' in partition.mountpoint:
                    continue

                try:
                    usage = shutil.disk_usage(partition.mountpoint)

                    letter = os.path.basename(partition.device)

                    drive_info = DriveInfo(
                        letter=letter,
                        total_space=usage.total,
                        used_space=usage.used,
                        free_space=usage.free,
                        filesystem=partition.fstype,
                        mount_point=partition.mountpoint
                    )

                    drives.append(drive_info)

                except (PermissionError, FileNotFoundError, OSError) as e:
                    logger.debug(f"Cannot access partition {partition.device}: {e}")

        except Exception as e:
            logger.error(f"Error scanning Linux drives: {e}")

        return drives

    def _get_filesystem_type(self, path: str) -> str:
        if not IS_WINDOWS:
            return 'unknown'

        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            volume_name_buffer = ctypes.create_unicode_buffer(1024)
            file_system_name_buffer = ctypes.create_unicode_buffer(1024)
            serial_number = None
            max_component_length = None
            file_system_flags = None

            result = kernel32.GetVolumeInformationW(
                ctypes.c_wchar_p(path),
                volume_name_buffer,
                ctypes.sizeof(volume_name_buffer),
                serial_number,
                max_component_length,
                file_system_flags,
                file_system_name_buffer,
                ctypes.sizeof(file_system_name_buffer)
            )

            if result:
                return file_system_name_buffer.value
            else:
                return 'unknown'

        except Exception as e:
            logger.debug(f"Cannot get filesystem type for {path}: {e}")
            return 'unknown'

    def select_drive_interactive(self, available_drives: List[DriveInfo], recommended_min_gb: float = 50.0) -> DriveInfo:
        if not available_drives:
            raise ValueError("No available drives to select from")

        print("\n" + "=" * 60)
        print("Available Drives for Backup (sorted by free space)")
        print("=" * 60)

        for idx, drive in enumerate(available_drives, start=1):
            is_recommended = drive.free_space_gb >= recommended_min_gb
            recommended_mark = " [RECOMMENDED]" if is_recommended else ""

            print(f"{idx}. Drive {drive.letter}: "
                  f"Free: {drive.free_space_gb:.2f}GB / "
                  f"Total: {drive.total_space_gb:.2f}GB "
                  f"({100 - drive.usage_percent:.1f}% free) "
                  f"[{drive.filesystem}]{recommended_mark}")

        print("=" * 60)

        while True:
            try:
                choice = input(f"\nSelect drive (1-{len(available_drives)}): ").strip()
                choice_idx = int(choice) - 1

                if 0 <= choice_idx < len(available_drives):
                    selected_drive = available_drives[choice_idx]

                    if selected_drive.free_space_gb < recommended_min_gb:
                        print(f"\n⚠ WARNING: Selected drive has only {selected_drive.free_space_gb:.2f}GB free space.")
                        print(f"  Recommended minimum: {recommended_min_gb:.2f}GB")
                        confirm = input("  Continue with this drive? (y/n): ").strip().lower()
                        if confirm != 'y':
                            print("  Please select another drive.")
                            continue

                    print(f"\nSelected: Drive {selected_drive.letter} "
                          f"({selected_drive.free_space_gb:.2f}GB free)")
                    return selected_drive
                else:
                    print(f"Invalid choice. Please enter a number between 1 and {len(available_drives)}")

            except ValueError:
                print("Invalid input. Please enter a number.")
            except KeyboardInterrupt:
                print("\nSelection cancelled.")
                raise

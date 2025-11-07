"""
Registry Monitor for tracking registry changes during software installation
"""

import winreg
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
from utils import save_json


class RegistryMonitor:
    """Monitor Windows Registry changes"""

    def __init__(self, registry_keys: List[str] = None):
        """
        Initialize registry monitor

        Args:
            registry_keys: List of registry keys to monitor
        """
        from config import REGISTRY_KEYS

        self.registry_keys = registry_keys or REGISTRY_KEYS
        self.baseline: Dict[str, Any] = {}
        self.changes: Dict[str, Any] = {}
        self.monitoring = False
        self.baseline_file = None
        self.current_file = None

    def _export_registry_key(self, key_path: str, output_file: Path) -> bool:
        """
        Export a registry key to file using reg export

        Args:
            key_path: Registry key path
            output_file: Output file path

        Returns:
            True if successful
        """
        try:
            # Use reg export command
            cmd = ['reg', 'export', key_path, str(output_file), '/y']
            result = subprocess.run(cmd,
                                    capture_output=True,
                                    text=True,
                                    timeout=30)

            return result.returncode == 0

        except Exception as e:
            print(f"Warning: Cannot export {key_path}: {e}")
            return False

    def _get_registry_snapshot(self) -> Dict[str, str]:
        """
        Get snapshot of all monitored registry keys

        Returns:
            Dictionary mapping key paths to export file paths
        """
        snapshot = {}
        temp_dir = Path(tempfile.mkdtemp())

        for key in self.registry_keys:
            # Create safe filename from registry key
            safe_name = key.replace('\\', '_').replace(':', '')
            output_file = temp_dir / f"{safe_name}.reg"

            if self._export_registry_key(key, output_file):
                snapshot[key] = str(output_file)
            else:
                snapshot[key] = None

        return snapshot

    def _read_registry_file(self, file_path: str) -> List[str]:
        """
        Read registry export file

        Args:
            file_path: Path to registry file

        Returns:
            List of lines
        """
        if not file_path or not Path(file_path).exists():
            return []

        try:
            with open(file_path, 'r', encoding='utf-16-le') as f:
                return f.readlines()
        except Exception as e:
            print(f"Warning: Cannot read {file_path}: {e}")
            return []

    def _compare_registry_files(self, baseline_file: str, current_file: str) -> Dict[str, Any]:
        """
        Compare two registry export files

        Args:
            baseline_file: Baseline registry file
            current_file: Current registry file

        Returns:
            Dictionary of changes
        """
        baseline_lines = set(self._read_registry_file(baseline_file))
        current_lines = set(self._read_registry_file(current_file))

        new_lines = current_lines - baseline_lines
        removed_lines = baseline_lines - current_lines

        return {
            "new_entries": sorted(list(new_lines)),
            "removed_entries": sorted(list(removed_lines)),
            "total_new": len(new_lines),
            "total_removed": len(removed_lines)
        }

    def create_baseline(self) -> None:
        """Create baseline snapshot of registry"""
        print("Creating registry baseline snapshot...")

        self.baseline = self._get_registry_snapshot()

        print(f"Registry baseline created for {len(self.baseline)} keys")

    def start_monitoring(self) -> None:
        """Start monitoring registry"""
        self.monitoring = True
        print("  Monitoring registry keys:")
        for key in self.registry_keys:
            print(f"    [✓] {key}")
        self.create_baseline()

    def stop_monitoring(self) -> Dict[str, Any]:
        """
        Stop monitoring and detect changes

        Returns:
            Dictionary of registry changes
        """
        self.monitoring = False
        print("\nDetecting registry changes...")

        current_snapshot = self._get_registry_snapshot()
        changes = {}

        for key in self.registry_keys:
            baseline_file = self.baseline.get(key)
            current_file = current_snapshot.get(key)

            if baseline_file and current_file:
                key_changes = self._compare_registry_files(baseline_file, current_file)

                if key_changes['total_new'] > 0 or key_changes['total_removed'] > 0:
                    changes[key] = key_changes

        self.changes = changes
        return changes

    def save_results(self, output_dir: Path, filename: str = "registry_changes.json") -> None:
        """
        Save registry monitoring results

        Args:
            output_dir: Output directory
            filename: Output filename
        """
        output_file = output_dir / filename

        result = {
            "monitored_keys": self.registry_keys,
            "changes": self.changes,
            "timestamp": datetime.now().isoformat(),
            "total_changed_keys": len(self.changes)
        }

        save_json(result, output_file)
        print(f"Registry changes saved to: {output_file}")

    def export_changed_keys(self, output_dir: Path) -> None:
        """
        Export full registry dumps of changed keys

        Args:
            output_dir: Output directory
        """
        if not self.changes:
            return

        registry_export_dir = output_dir / "registry_exports"
        registry_export_dir.mkdir(exist_ok=True)

        print("\nExporting changed registry keys...")

        for key in self.changes.keys():
            safe_name = key.replace('\\', '_').replace(':', '')
            output_file = registry_export_dir / f"{safe_name}.reg"

            if self._export_registry_key(key, output_file):
                print(f"  Exported: {key}")
            else:
                print(f"  Failed: {key}")

    def print_summary(self) -> None:
        """Print summary of registry changes"""
        if not self.changes:
            print("\nNo registry changes detected.")
            return

        print("\n" + "=" * 80)
        print("REGISTRY CHANGES SUMMARY")
        print("=" * 80)

        total_new = 0
        total_removed = 0

        for key, change_info in self.changes.items():
            print(f"\n{key}:")
            print(f"  New entries: {change_info['total_new']}")
            print(f"  Removed entries: {change_info['total_removed']}")

            total_new += change_info['total_new']
            total_removed += change_info['total_removed']

        print(f"\n{'=' * 80}")
        print(f"Total changed keys: {len(self.changes)}")
        print(f"Total new entries: {total_new}")
        print(f"Total removed entries: {total_removed}")
        print(f"{'=' * 80}\n")


def create_registry_monitor(keys: List[str] = None) -> RegistryMonitor:
    """
    Create a registry monitor

    Args:
        keys: Registry keys to monitor (defaults to config REGISTRY_KEYS)

    Returns:
        Configured RegistryMonitor
    """
    return RegistryMonitor(keys)

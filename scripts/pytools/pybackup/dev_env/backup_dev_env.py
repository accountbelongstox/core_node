import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../')))

from scripts.pytools.pybackup.dev_env.drive_scanner import DriveScanner
from scripts.pytools.pybackup.dev_env.os_detector import OSDetector
from scripts.pytools.pybackup.dev_env.incremental_backup_manager import IncrementalBackupManager
from scripts.pytools.pybackup.dev_env.user_config_backup import get_user_config_for_backup
from scripts.pytools.pybackup.dev_env.applications_backup import get_applications_for_backup
from pycore.pyutils.common.zip_task_queue import ZipTaskQueue
from pycore.pyfoundations.pygvar import BACKUP_DIR_NAME, APPLICATIONS_DIR, IS_WINDOWS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DevEnvBackup:
    def __init__(self):
        self.os_detector = OSDetector()
        self.drive_scanner = DriveScanner(exclude_drives=['C'])
        self.zip_queue = ZipTaskQueue()
        self.backup_manager: IncrementalBackupManager = None
        self.backup_root: Path = None
        self.namespace: str = self.os_detector.get_backup_namespace()

        logger.info(f"Initialized DevEnvBackup for {self.namespace}")

    def run(self):
        try:
            print("\n" + "=" * 70)
            print(" Development Environment Backup System")
            print("=" * 70)

            selected_drive = self._select_backup_drive()
            self._initialize_backup_root(selected_drive)

            print(f"\n Backup location: {self.backup_root}")
            print(f" Operating System: {self.namespace}")
            print("=" * 70)

            sources_to_backup = self._collect_backup_sources()

            if not sources_to_backup:
                print("\n No sources to backup.")
                return

            print(f"\n Found {len(sources_to_backup)} sources to backup")

            self._execute_backup(sources_to_backup)

            self._wait_for_completion()

            self._print_summary()

            print("\n" + "=" * 70)
            print(" Backup completed successfully!")
            print("=" * 70)

        except KeyboardInterrupt:
            print("\n\n Backup cancelled by user.")
            self.zip_queue.stop()

        except Exception as e:
            logger.error(f"Backup failed: {e}", exc_info=True)
            print(f"\n ERROR: Backup failed: {e}")

    def _select_backup_drive(self):
        print("\n Scanning available drives...")
        drives = self.drive_scanner.scan_drives()

        if not drives:
            raise RuntimeError("No suitable drives found for backup")

        return self.drive_scanner.select_drive_interactive(drives, recommended_min_gb=50.0)

    def _initialize_backup_root(self, drive):
        if IS_WINDOWS:
            backup_path = Path(f"{drive.letter}:\\{BACKUP_DIR_NAME}")
        else:
            backup_path = Path(drive.mount_point) / BACKUP_DIR_NAME

        self.backup_root = backup_path / self.namespace
        self.backup_root.mkdir(parents=True, exist_ok=True)

        self.backup_manager = IncrementalBackupManager(str(self.backup_root))
        logger.info(f"Backup root initialized: {self.backup_root}")

    def _collect_backup_sources(self) -> List[Dict[str, Any]]:
        sources = []

        logger.info("=== Part 1: User Configuration Backup ===")
        try:
            user_configs = get_user_config_for_backup(
                exclude_patterns=['.cache', '.tmp', '.temp', '.vscode-server']
            )
            logger.info(f"Found {len(user_configs)} user config items")

            for config_item in user_configs:
                source_info = {
                    'source': config_item['source_path'],
                    'category': config_item['category'],
                    'namespace': self.namespace
                }
                sources.append(source_info)

        except Exception as e:
            logger.error(f"Error collecting user configs: {e}", exc_info=True)

        logger.info("=== Part 2: Applications Backup ===")
        try:
            applications = get_applications_for_backup(base_applications_dir=APPLICATIONS_DIR)
            logger.info(f"Found {len(applications)} applications to backup")

            applications_metadata = []
            for app in applications:
                category = f"applications/{app['package_source']}"

                source_info = {
                    'source': app['source_path'],
                    'category': category,
                    'namespace': self.namespace,
                    'metadata': {
                        'app_name': app['name'],
                        'package_name': app['package_name'],
                        'desktop_category': app['category'],
                        'install_type': app['install_type'],
                        'package_source': app['package_source']
                    }
                }
                sources.append(source_info)

                app_metadata = {
                    'Name': app['name'],
                    'Exec': app['exec'],
                    'PackageId': app['package_id'],
                    'Description': app['description'],
                    'InstallType': app['install_type'],
                    'Category': app['category'],
                    'PackageSource': app['package_source'],
                    'AppCustomInstallDir': app['app_custom_install_dir'],
                    'ForceToInstallDir': app['force_to_install_dir'],
                    'BackupPackageName': app['package_name']
                }
                applications_metadata.append(app_metadata)

            self._save_applications_metadata(applications_metadata)

        except Exception as e:
            logger.error(f"Error collecting applications: {e}", exc_info=True)

        logger.info("=== Part 3: Development Environment Backup ===")
        os_paths = self.os_detector.get_os_specific_paths()

        for category, paths in os_paths.items():
            logger.info(f"Scanning {category}...")
            for path in paths:
                if os.path.exists(path):
                    source_info = {
                        'source': path,
                        'category': category,
                        'namespace': self.namespace
                    }
                    sources.append(source_info)

        filtered_sources = []
        for source_info in sources:
            if self.backup_manager.should_backup(source_info['source'], self.namespace):
                filtered_sources.append(source_info)
            else:
                logger.info(f"Skipping (up-to-date): {source_info['source']}")

        return filtered_sources

    def _save_applications_metadata(self, applications_metadata: List[Dict[str, any]]):
        """
        Save applications metadata JSON to backup directory.
        Maintains ApplicationsList.ps1 keys plus BackupPackageName.
        """
        try:
            metadata_dir = self.backup_root / "applications"
            metadata_dir.mkdir(parents=True, exist_ok=True)

            metadata_file = metadata_dir / "applications_backup_metadata.json"

            utf8_encoding = 'utf-8'
            with open(metadata_file, 'w', encoding=utf8_encoding) as f:
                json.dump(applications_metadata, f, indent=2, ensure_ascii=False)

            logger.info(f"Saved applications metadata to: {metadata_file}")
            logger.info(f"Total applications in metadata: {len(applications_metadata)}")

        except Exception as e:
            logger.error(f"Failed to save applications metadata: {e}", exc_info=True)

    def _execute_backup(self, sources: List[Dict[str, Any]]):
        print(f"\n Starting backup of {len(sources)} items...")

        group_id = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        def on_task_complete(task):
            if task.status.value == "completed":
                display_name = task.metadata.get('display_name', os.path.basename(task.source))
                print(f" [OK] {display_name}")
                self.backup_manager.register_backup(
                    source_path=task.source,
                    backup_path=task.output,
                    namespace=task.metadata.get('namespace', 'default'),
                    is_archived=True,
                    archive_name=os.path.basename(task.output)
                )
            else:
                display_name = task.metadata.get('display_name', os.path.basename(task.source))
                print(f" [FAILED] {display_name} - {task.error}")

        def on_group_complete(group):
            print(f"\n Backup group completed: {group.completed_count}/{group.total_count} succeeded")

        tasks = []
        for idx, source_info in enumerate(sources):
            source_path = source_info['source']
            category = source_info['category']

            if 'metadata' in source_info and 'package_name' in source_info['metadata']:
                package_name = source_info['metadata']['package_name']
            else:
                package_name = os.path.basename(source_path)

            category_dir = self.backup_root / category
            category_dir.mkdir(parents=True, exist_ok=True)

            output_path = category_dir / f"{package_name}.7z"

            task = {
                'task_id': f"task_{idx}",
                'source': source_path,
                'output': str(output_path),
                'is_compress': True,
                'compression_level': 5,
                'callback': on_task_complete,
                'metadata': {
                    'namespace': source_info['namespace'],
                    'category': category,
                    'display_name': package_name
                }
            }
            tasks.append(task)

        self.zip_queue.add_task_group(
            group_id=group_id,
            tasks=tasks,
            group_callback=on_group_complete
        )

    def _wait_for_completion(self):
        print("\n Waiting for all backup tasks to complete...")
        self.zip_queue.wait_for_completion()

    def _print_summary(self):
        stats = self.zip_queue.get_statistics()

        print("\n" + "=" * 70)
        print(" Backup Summary")
        print("=" * 70)
        print(f" Total tasks: {stats['total_tasks']}")
        print(f" Completed: {stats['completed_tasks']}")
        print(f" Failed: {stats['failed_tasks']}")

        backup_stats = self.backup_manager.get_backup_statistics(self.namespace)
        if backup_stats:
            print(f"\n Namespace: {self.namespace}")
            print(f" Total entries: {backup_stats.get('total_entries', 0)}")
            print(f" Total size: {backup_stats.get('total_size_gb', 0):.2f} GB")

        print("=" * 70)


def main():
    try:
        backup_system = DevEnvBackup()
        backup_system.run()

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        print(f"\n FATAL ERROR: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

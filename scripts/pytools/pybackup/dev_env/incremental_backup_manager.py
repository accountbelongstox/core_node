import os
import json
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

from pycore.pygvar.pyglobal_vars import BACKUP_METADATA_FILENAME, BACKUP_INDEX_FILENAME

logger = logging.getLogger(__name__)


@dataclass
class BackupEntry:
    source_path: str
    backup_path: str
    last_modified_time: float
    file_size: int
    file_hash: Optional[str] = None
    last_backup_time: Optional[float] = None
    is_archived: bool = False
    archive_name: Optional[str] = None
    backup_count: int = 0
    namespace: str = 'default'


class IncrementalBackupManager:
    def __init__(self, backup_root: str):
        self.backup_root = Path(backup_root)
        self.metadata_file = self.backup_root / BACKUP_METADATA_FILENAME
        self.index_file = self.backup_root / BACKUP_INDEX_FILENAME
        self.metadata: Dict[str, Dict[str, Any]] = {}
        self.namespaces: Dict[str, Dict[str, BackupEntry]] = {}

        self._ensure_backup_root()
        self._load_metadata()

    def _ensure_backup_root(self):
        self.backup_root.mkdir(parents=True, exist_ok=True)
        logger.info(f"Backup root ensured: {self.backup_root}")

    def _load_metadata(self):
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.metadata = data.get('metadata', {})
                    namespaces_data = data.get('namespaces', {})

                    for ns_name, entries in namespaces_data.items():
                        self.namespaces[ns_name] = {}
                        for source_path, entry_data in entries.items():
                            self.namespaces[ns_name][source_path] = BackupEntry(**entry_data)

                logger.info(f"Loaded metadata with {len(self.namespaces)} namespaces")

            except Exception as e:
                logger.error(f"Error loading metadata: {e}")
                self.metadata = {}
                self.namespaces = {}
        else:
            logger.info("No existing metadata found, starting fresh")

    def _save_metadata(self):
        try:
            namespaces_data = {}
            for ns_name, entries in self.namespaces.items():
                namespaces_data[ns_name] = {}
                for source_path, entry in entries.items():
                    namespaces_data[ns_name][source_path] = asdict(entry)

            data = {
                'metadata': self.metadata,
                'namespaces': namespaces_data,
                'last_updated': datetime.now().isoformat()
            }

            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            logger.info("Metadata saved successfully")

        except Exception as e:
            logger.error(f"Error saving metadata: {e}")

    def should_backup(self, source_path: str, namespace: str = 'default') -> bool:
        if not os.path.exists(source_path):
            logger.warning(f"Source path does not exist: {source_path}")
            return False

        if namespace not in self.namespaces:
            logger.info(f"New namespace '{namespace}', backup required for: {source_path}")
            return True

        if source_path not in self.namespaces[namespace]:
            logger.info(f"New entry in namespace '{namespace}', backup required for: {source_path}")
            return True

        entry = self.namespaces[namespace][source_path]

        try:
            current_mtime = os.path.getmtime(source_path)

            if current_mtime > entry.last_modified_time:
                logger.info(f"File modified, backup required: {source_path}")
                return True

            if entry.is_archived and not os.path.exists(entry.backup_path):
                logger.info(f"Archive missing, backup required: {source_path}")
                return True

            logger.debug(f"Backup not required: {source_path}")
            return False

        except Exception as e:
            logger.error(f"Error checking if backup needed for {source_path}: {e}")
            return True

    def register_backup(
        self,
        source_path: str,
        backup_path: str,
        namespace: str = 'default',
        is_archived: bool = True,
        archive_name: Optional[str] = None
    ):
        if namespace not in self.namespaces:
            self.namespaces[namespace] = {}

        try:
            file_size = self._get_size(source_path)
            mtime = os.path.getmtime(source_path)

            if source_path in self.namespaces[namespace]:
                entry = self.namespaces[namespace][source_path]
                entry.backup_path = backup_path
                entry.last_modified_time = mtime
                entry.file_size = file_size
                entry.last_backup_time = datetime.now().timestamp()
                entry.is_archived = is_archived
                entry.archive_name = archive_name
                entry.backup_count += 1
            else:
                entry = BackupEntry(
                    source_path=source_path,
                    backup_path=backup_path,
                    last_modified_time=mtime,
                    file_size=file_size,
                    last_backup_time=datetime.now().timestamp(),
                    is_archived=is_archived,
                    archive_name=archive_name,
                    backup_count=1,
                    namespace=namespace
                )
                self.namespaces[namespace][source_path] = entry

            self._save_metadata()
            logger.info(f"Registered backup: {source_path} -> {backup_path}")

        except Exception as e:
            logger.error(f"Error registering backup: {e}")

    def _get_size(self, path: str) -> int:
        try:
            if os.path.isfile(path):
                return os.path.getsize(path)
            elif os.path.isdir(path):
                total_size = 0
                for dirpath, dirnames, filenames in os.walk(path):
                    for filename in filenames:
                        filepath = os.path.join(dirpath, filename)
                        try:
                            total_size += os.path.getsize(filepath)
                        except (PermissionError, FileNotFoundError):
                            pass
                return total_size
            else:
                return 0
        except Exception as e:
            logger.error(f"Error getting size for {path}: {e}")
            return 0

    def get_backup_entry(self, source_path: str, namespace: str = 'default') -> Optional[BackupEntry]:
        if namespace not in self.namespaces:
            return None
        return self.namespaces[namespace].get(source_path)

    def get_namespace_entries(self, namespace: str) -> Dict[str, BackupEntry]:
        return self.namespaces.get(namespace, {})

    def get_all_namespaces(self) -> List[str]:
        return list(self.namespaces.keys())

    def get_backup_statistics(self, namespace: Optional[str] = None) -> Dict[str, Any]:
        if namespace:
            if namespace not in self.namespaces:
                return {}

            entries = self.namespaces[namespace]
            total_size = sum(entry.file_size for entry in entries.values())
            total_backups = sum(entry.backup_count for entry in entries.values())

            return {
                'namespace': namespace,
                'total_entries': len(entries),
                'total_size_bytes': total_size,
                'total_size_gb': total_size / (1024 ** 3),
                'total_backups': total_backups
            }
        else:
            all_stats = {}
            for ns_name in self.namespaces.keys():
                all_stats[ns_name] = self.get_backup_statistics(ns_name)

            return all_stats

    def cleanup_missing_sources(self, namespace: Optional[str] = None):
        namespaces_to_check = [namespace] if namespace else list(self.namespaces.keys())
        removed_count = 0

        for ns_name in namespaces_to_check:
            if ns_name not in self.namespaces:
                continue

            entries = self.namespaces[ns_name]
            to_remove = []

            for source_path, entry in entries.items():
                if not os.path.exists(source_path):
                    to_remove.append(source_path)

            for source_path in to_remove:
                del entries[source_path]
                removed_count += 1
                logger.info(f"Removed missing source from metadata: {source_path}")

        if removed_count > 0:
            self._save_metadata()
            logger.info(f"Cleaned up {removed_count} missing sources")

        return removed_count

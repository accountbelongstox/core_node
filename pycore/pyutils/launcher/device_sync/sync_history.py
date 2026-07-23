# -*- coding: utf-8 -*-
"""
Sync History Tracker - SQLite-based synchronization history

Records synchronization events and maintains a 3-day history.

Features:
- SQLite database storage
- Auto-cleanup of old records (>3 days)
- Event tracking (file sync, mode changes, device events)
- Query interface for history display

Storage: ~/.core_node/.cache/device_sync/sync_history.db
"""

import sqlite3
import json
from contextlib import nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
from .logging_config import setup_logging
from pycore.pyfoundations.system_paths import get_system_cache_dir
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

logger = setup_logging(__name__)

# Default cache directory (centralized root; .cache/device_sync subpath preserved)
DEFAULT_CACHE_DIR = get_system_cache_dir() / '.cache' / 'device_sync'

# Event types
EVENT_FILE_SYNC = 'file_sync'
EVENT_MODE_CHANGE = 'mode_change'
EVENT_DEVICE_ONLINE = 'device_online'
EVENT_DEVICE_OFFLINE = 'device_offline'
EVENT_SYNC_ENABLE = 'sync_enable'
EVENT_SYNC_DISABLE = 'sync_disable'
EVENT_CONFLICT_DETECTED = 'conflict_detected'
EVENT_PRIMARY_VALIDATION = 'primary_validation'

# Status types
STATUS_SUCCESS = 'success'
STATUS_FAILED = 'failed'
STATUS_WARNING = 'warning'


class SyncHistoryTracker:
    """
    Synchronization history tracker using SQLite.

    Automatically records sync events and maintains a 3-day history.
    """

    def __init__(self, cache_dir: Optional[Path] = None, retention_days: int = 3):
        """
        Initialize sync history tracker.

        Args:
            cache_dir: Cache directory (defaults to ~/.core_node/.cache/device_sync)
            retention_days: Number of days to retain history (default: 3)
        """
        self.cache_dir = cache_dir or DEFAULT_CACHE_DIR
        self.retention_days = retention_days

        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Database path
        self.db_path = self.cache_dir / 'sync_history.db'

        self._database_scope = nullcontext()

        # Initialize database
        self._init_database()
        init_serialized_owner(self, "device_sync.history", "DeviceSyncHistory")

        logger.info(f"Sync history tracker initialized: {self.db_path}")
        logger.info(f"Retention period: {retention_days} days")

    def _init_database(self):
        """Initialize SQLite database and create tables."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Create sync_history table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS sync_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME NOT NULL,
                        event_type TEXT NOT NULL,
                        device_id TEXT,
                        device_name TEXT,
                        status TEXT NOT NULL,
                        message TEXT,
                        details TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Create index on timestamp for faster queries
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_timestamp
                    ON sync_history(timestamp DESC)
                ''')

                # Create index on event_type
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_event_type
                    ON sync_history(event_type)
                ''')

                conn.commit()
                logger.info("Database initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize database: {e}", exc_info=True)

    @serialized_method
    def record_event(
        self,
        event_type: str,
        status: str,
        message: str,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        """
        Record a synchronization event.

        Args:
            event_type: Type of event (EVENT_* constants)
            status: Event status (STATUS_* constants)
            message: Human-readable message
            device_id: Device ID (optional)
            device_name: Device hostname (optional)
            details: Additional details as dict (optional)
        """
        with self._database_scope:
            try:
                timestamp = datetime.now()
                details_json = json.dumps(details) if details else None

                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO sync_history
                        (timestamp, event_type, device_id, device_name, status, message, details)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        timestamp,
                        event_type,
                        device_id,
                        device_name,
                        status,
                        message,
                        details_json
                    ))
                    conn.commit()

                logger.debug(f"Recorded event: {event_type} - {message}")

            except Exception as e:
                logger.error(f"Failed to record event: {e}", exc_info=True)

    @serialized_method
    def get_recent_history(
        self,
        limit: int = 100,
        event_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """
        Get recent history entries.

        Args:
            limit: Maximum number of entries to return
            event_type: Filter by event type (optional)
            status: Filter by status (optional)

        Returns:
            List of history entries as dicts
        """
        with self._database_scope:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()

                    # Build query
                    query = 'SELECT * FROM sync_history WHERE 1=1'
                    params = []

                    if event_type:
                        query += ' AND event_type = ?'
                        params.append(event_type)

                    if status:
                        query += ' AND status = ?'
                        params.append(status)

                    query += ' ORDER BY timestamp DESC LIMIT ?'
                    params.append(limit)

                    cursor.execute(query, params)
                    rows = cursor.fetchall()

                    # Convert to list of dicts
                    history = []
                    for row in rows:
                        entry = dict(row)
                        # Parse details JSON
                        if entry.get('details'):
                            try:
                                entry['details'] = json.loads(entry['details'])
                            except:
                                pass
                        history.append(entry)

                    return history

            except Exception as e:
                logger.error(f"Failed to get history: {e}", exc_info=True)
                return []

    @serialized_method
    def get_statistics(self) -> Dict:
        """
        Get history statistics.

        Returns:
            Dict with statistics
        """
        with self._database_scope:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()

                    # Total events
                    cursor.execute('SELECT COUNT(*) FROM sync_history')
                    total_events = cursor.fetchone()[0]

                    # Events by type
                    cursor.execute('''
                        SELECT event_type, COUNT(*) as count
                        FROM sync_history
                        GROUP BY event_type
                    ''')
                    events_by_type = {row[0]: row[1] for row in cursor.fetchall()}

                    # Events by status
                    cursor.execute('''
                        SELECT status, COUNT(*) as count
                        FROM sync_history
                        GROUP BY status
                    ''')
                    events_by_status = {row[0]: row[1] for row in cursor.fetchall()}

                    # Events in last 24 hours
                    cursor.execute('''
                        SELECT COUNT(*)
                        FROM sync_history
                        WHERE timestamp >= datetime('now', '-1 day')
                    ''')
                    last_24h = cursor.fetchone()[0]

                    # Latest event
                    cursor.execute('''
                        SELECT timestamp, event_type, message
                        FROM sync_history
                        ORDER BY timestamp DESC
                        LIMIT 1
                    ''')
                    latest_row = cursor.fetchone()
                    latest_event = None
                    if latest_row:
                        latest_event = {
                            'timestamp': latest_row[0],
                            'event_type': latest_row[1],
                            'message': latest_row[2]
                        }

                    return {
                        'total_events': total_events,
                        'events_by_type': events_by_type,
                        'events_by_status': events_by_status,
                        'last_24h': last_24h,
                        'latest_event': latest_event,
                        'retention_days': self.retention_days,
                        'db_path': str(self.db_path)
                    }

            except Exception as e:
                logger.error(f"Failed to get statistics: {e}", exc_info=True)
                return {}

    @serialized_method
    def cleanup_old_records(self):
        """Clean up records older than retention period."""
        with self._database_scope:
            try:
                cutoff_date = datetime.now() - timedelta(days=self.retention_days)

                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()

                    # Count records to delete
                    cursor.execute(
                        'SELECT COUNT(*) FROM sync_history WHERE timestamp < ?',
                        (cutoff_date,)
                    )
                    count = cursor.fetchone()[0]

                    if count > 0:
                        # Delete old records
                        cursor.execute(
                            'DELETE FROM sync_history WHERE timestamp < ?',
                            (cutoff_date,)
                        )
                        conn.commit()

                        logger.info(f"Cleaned up {count} old records (older than {self.retention_days} days)")
                    else:
                        logger.debug("No old records to clean up")

            except Exception as e:
                logger.error(f"Failed to cleanup old records: {e}", exc_info=True)

    def export_to_text(self, output_path: Optional[Path] = None) -> str:
        """
        Export history to text file.

        Args:
            output_path: Output file path (optional, defaults to cache dir)

        Returns:
            Path to exported file
        """
        if not output_path:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = self.cache_dir / f'sync_history_{timestamp}.txt'

        try:
            history = self.get_recent_history(limit=1000)

            with open(output_path, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write("Device Sync - History Export\n")
                f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("=" * 80 + "\n\n")

                for entry in history:
                    f.write(f"[{entry['timestamp']}] {entry['event_type'].upper()}\n")
                    f.write(f"  Status: {entry['status']}\n")
                    f.write(f"  Message: {entry['message']}\n")

                    if entry.get('device_name'):
                        f.write(f"  Device: {entry['device_name']}\n")

                    if entry.get('details'):
                        f.write(f"  Details: {json.dumps(entry['details'], indent=2)}\n")

                    f.write("\n")

            logger.info(f"Exported history to: {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Failed to export history: {e}", exc_info=True)
            return ""

    def close(self):
        """Close database connection and cleanup."""
        # Perform final cleanup
        self.cleanup_old_records()
        logger.info("Sync history tracker closed")


# Convenience functions for common events

def record_file_sync(tracker: SyncHistoryTracker, filename: str, success: bool, file_size: int = 0):
    """Record file sync event."""
    tracker.record_event(
        event_type=EVENT_FILE_SYNC,
        status=STATUS_SUCCESS if success else STATUS_FAILED,
        message=f"{'Synced' if success else 'Failed to sync'}: {filename}",
        details={'filename': filename, 'size': file_size}
    )


def record_mode_change(tracker: SyncHistoryTracker, old_mode: str, new_mode: str):
    """Record mode change event."""
    tracker.record_event(
        event_type=EVENT_MODE_CHANGE,
        status=STATUS_SUCCESS,
        message=f"Mode changed: {old_mode or 'NOT SET'} → {new_mode}",
        details={'old_mode': old_mode, 'new_mode': new_mode}
    )


def record_device_online(tracker: SyncHistoryTracker, device_info: Dict):
    """Record device online event."""
    tracker.record_event(
        event_type=EVENT_DEVICE_ONLINE,
        status=STATUS_SUCCESS,
        message=f"Device came online",
        device_id=device_info.get('device_id'),
        device_name=device_info.get('hostname'),
        details={
            'ip': device_info.get('ip'),
            'mode': device_info.get('mode')
        }
    )


def record_device_offline(tracker: SyncHistoryTracker, device_info: Dict):
    """Record device offline event."""
    tracker.record_event(
        event_type=EVENT_DEVICE_OFFLINE,
        status=STATUS_WARNING,
        message=f"Device went offline",
        device_id=device_info.get('device_id'),
        device_name=device_info.get('hostname')
    )


def record_sync_enabled(tracker: SyncHistoryTracker, mode: str):
    """Record sync enable event."""
    tracker.record_event(
        event_type=EVENT_SYNC_ENABLE,
        status=STATUS_SUCCESS,
        message=f"Sync enabled (mode: {mode})",
        details={'mode': mode}
    )


def record_sync_disabled(tracker: SyncHistoryTracker, reason: str = "User request"):
    """Record sync disable event."""
    tracker.record_event(
        event_type=EVENT_SYNC_DISABLE,
        status=STATUS_SUCCESS,
        message=f"Sync disabled: {reason}",
        details={'reason': reason}
    )


def record_conflict(tracker: SyncHistoryTracker, conflict_info: Dict):
    """Record conflict detection event."""
    count = conflict_info.get('count', 0)
    tracker.record_event(
        event_type=EVENT_CONFLICT_DETECTED,
        status=STATUS_FAILED,
        message=f"Conflict detected: {count} primary devices",
        details=conflict_info
    )


def record_primary_validation(tracker: SyncHistoryTracker, success: bool, primary_count: int):
    """Record primary device validation event."""
    tracker.record_event(
        event_type=EVENT_PRIMARY_VALIDATION,
        status=STATUS_SUCCESS if success else STATUS_FAILED,
        message=f"Primary validation: {primary_count} primary device(s) found",
        details={'primary_count': primary_count, 'valid': success}
    )

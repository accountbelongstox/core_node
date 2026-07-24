# -*- coding: utf-8 -*-
"""
Database Module - SQLite database for sync history tracking

Records sync operations, file transfers, and connection history.
Database location: Same as device_id.txt
"""

import sqlite3
import time
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)
from .config import get_cache_dir


class SyncDatabase:
    """
    SQLite database for tracking sync operations

    Tables:
    - sync_sessions: Sync session records
    - file_transfers: File transfer records (downloads/uploads)
    - scan_history: File scan history
    - connections: Client connection history
    """

    def __init__(self):
        """Initialize database"""
        self.db_path = get_cache_dir() / 'sync_history.db'
        self._init_database()
        init_serialized_owner(
            self,
            'device_sync.database.state',
            'DeviceSyncDatabaseStateThread',
            timeout=300.0,
        )

    def _init_database(self):
        """Initialize database schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Sync sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_type TEXT NOT NULL,  -- 'server' or 'client'
                start_time REAL NOT NULL,
                end_time REAL,
                device_id TEXT NOT NULL,
                status TEXT NOT NULL,  -- 'active', 'completed', 'failed'
                files_scanned INTEGER DEFAULT 0,
                files_transferred INTEGER DEFAULT 0,
                bytes_transferred INTEGER DEFAULT 0,
                error_message TEXT
            )
        ''')

        # File transfers table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS file_transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                timestamp REAL NOT NULL,
                operation TEXT NOT NULL,  -- 'download', 'upload', 'scan'
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                status TEXT NOT NULL,  -- 'success', 'failed', 'skipped'
                remote_device TEXT,
                error_message TEXT,
                FOREIGN KEY (session_id) REFERENCES sync_sessions(id)
            )
        ''')

        # Scan history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                scan_type TEXT NOT NULL,  -- 'full', 'incremental'
                files_found INTEGER NOT NULL,
                duration_seconds REAL NOT NULL,
                scan_node_modules BOOLEAN NOT NULL
            )
        ''')

        # Connections table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                connection_type TEXT NOT NULL,  -- 'client_connect', 'client_disconnect'
                remote_ip TEXT NOT NULL,
                remote_device_id TEXT,
                remote_hostname TEXT,
                request_path TEXT
            )
        ''')

        conn.commit()
        conn.close()

    @serialized_method
    def create_session(self, session_type: str, device_id: str) -> int:
        """
        Create a new sync session

        Args:
            session_type: 'server' or 'client'
            device_id: Device ID

        Returns:
            Session ID
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO sync_sessions (session_type, start_time, device_id, status)
            VALUES (?, ?, ?, 'active')
        ''', (session_type, time.time(), device_id))

        session_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return session_id

    @serialized_method
    def update_session(self, session_id: int, status: str,
                      files_scanned: int = None, files_transferred: int = None,
                      bytes_transferred: int = None, error_message: str = None):
        """Update sync session"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        updates = ['status = ?', 'end_time = ?']
        params = [status, time.time()]

        if files_scanned is not None:
            updates.append('files_scanned = ?')
            params.append(files_scanned)

        if files_transferred is not None:
            updates.append('files_transferred = ?')
            params.append(files_transferred)

        if bytes_transferred is not None:
            updates.append('bytes_transferred = ?')
            params.append(bytes_transferred)

        if error_message is not None:
            updates.append('error_message = ?')
            params.append(error_message)

        params.append(session_id)

        cursor.execute(f'''
            UPDATE sync_sessions
            SET {', '.join(updates)}
            WHERE id = ?
        ''', params)

        conn.commit()
        conn.close()

    @serialized_method
    def record_transfer(self, session_id: Optional[int], operation: str,
                       file_path: str, file_size: int, status: str,
                       remote_device: str = None, error_message: str = None):
        """Record file transfer"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO file_transfers
            (session_id, timestamp, operation, file_path, file_size, status, remote_device, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (session_id, time.time(), operation, file_path, file_size, status, remote_device, error_message))

        conn.commit()
        conn.close()

    @serialized_method
    def record_scan(self, scan_type: str, files_found: int,
                   duration_seconds: float, scan_node_modules: bool):
        """Record file scan"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO scan_history (timestamp, scan_type, files_found, duration_seconds, scan_node_modules)
            VALUES (?, ?, ?, ?, ?)
        ''', (time.time(), scan_type, files_found, duration_seconds, scan_node_modules))

        conn.commit()
        conn.close()

    @serialized_method
    def record_connection(self, connection_type: str, remote_ip: str,
                         remote_device_id: str = None, remote_hostname: str = None,
                         request_path: str = None):
        """Record client connection"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO connections (timestamp, connection_type, remote_ip, remote_device_id, remote_hostname, request_path)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (time.time(), connection_type, remote_ip, remote_device_id, remote_hostname, request_path))

        conn.commit()
        conn.close()

    @serialized_method
    def get_recent_transfers(self, limit: int = 50) -> List[Dict]:
        """Get recent file transfers"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT timestamp, operation, file_path, file_size, status, remote_device
            FROM file_transfers
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))

        rows = cursor.fetchall()
        conn.close()

        return [{
            'timestamp': datetime.fromtimestamp(row[0]).strftime('%Y-%m-%d %H:%M:%S'),
            'operation': row[1],
            'file_path': row[2],
            'file_size': row[3],
            'status': row[4],
            'remote_device': row[5]
        } for row in rows]

    @serialized_method
    def get_recent_scans(self, limit: int = 10) -> List[Dict]:
        """Get recent scans"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT timestamp, scan_type, files_found, duration_seconds, scan_node_modules
            FROM scan_history
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))

        rows = cursor.fetchall()
        conn.close()

        return [{
            'timestamp': datetime.fromtimestamp(row[0]).strftime('%Y-%m-%d %H:%M:%S'),
            'scan_type': row[1],
            'files_found': row[2],
            'duration_seconds': row[3],
            'scan_node_modules': bool(row[4])
        } for row in rows]

    @serialized_method
    def get_recent_connections(self, limit: int = 50) -> List[Dict]:
        """Get recent connections"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT timestamp, connection_type, remote_ip, remote_device_id, remote_hostname, request_path
            FROM connections
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))

        rows = cursor.fetchall()
        conn.close()

        return [{
            'timestamp': datetime.fromtimestamp(row[0]).strftime('%Y-%m-%d %H:%M:%S'),
            'connection_type': row[1],
            'remote_ip': row[2],
            'remote_device_id': row[3],
            'remote_hostname': row[4],
            'request_path': row[5]
        } for row in rows]

    @serialized_method
    def get_stats(self) -> Dict:
        """Get database statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Total transfers
        cursor.execute('SELECT COUNT(*) FROM file_transfers')
        total_transfers = cursor.fetchone()[0]

        # Total scans
        cursor.execute('SELECT COUNT(*) FROM scan_history')
        total_scans = cursor.fetchone()[0]

        # Total connections
        cursor.execute('SELECT COUNT(*) FROM connections')
        total_connections = cursor.fetchone()[0]

        # Recent transfers by status
        cursor.execute('''
            SELECT status, COUNT(*)
            FROM file_transfers
            WHERE timestamp > ?
            GROUP BY status
        ''', (time.time() - 86400,))  # Last 24 hours

        recent_transfers = dict(cursor.fetchall())

        conn.close()

        return {
            'total_transfers': total_transfers,
            'total_scans': total_scans,
            'total_connections': total_connections,
            'recent_transfers_24h': recent_transfers
        }


# Global database instance
_SYNC_DATABASE_PROVIDER = SerializedSingletonProvider(
    SyncDatabase,
    'device_sync.database.provider',
    'DeviceSyncDatabaseProviderThread',
    timeout=300.0,
)


def get_sync_database() -> SyncDatabase:
    """Get or create global sync database instance"""
    return _SYNC_DATABASE_PROVIDER.get()

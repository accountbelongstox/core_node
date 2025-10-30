"""
SQLite Storage Manager for AI Collaboration MCP
Enables cross-client data sharing with startup namespace support
"""

import sqlite3
import json
import time
import uuid
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from contextlib import contextmanager

class SQLiteStorageManager:
    """
    Thread-safe SQLite storage manager for multi-client AI collaboration

    Features:
    - Startup namespace: Each startup gets a unique namespace ID
    - Concurrent access: Uses timeout and retry for database locks
    - Cross-client sharing: All clients access the same database file
    - Auto cleanup: Old startup sessions can be archived/deleted
    """

    def __init__(self, db_path: Path, max_retries: int = 5, retry_delay: float = 0.1):
        self.db_path = db_path
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._local = threading.local()

        # Ensure directory exists
        db_path.parent.mkdir(parents=True, exist_ok=True)

        # Initialize database schema
        self._init_database()

    @contextmanager
    def _get_connection(self):
        """Get thread-local database connection with retry logic"""
        retry_count = 0
        last_error = None

        while retry_count < self.max_retries:
            try:
                # Get or create thread-local connection
                if not hasattr(self._local, 'conn') or self._local.conn is None:
                    self._local.conn = sqlite3.connect(
                        str(self.db_path),
                        timeout=30.0,  # 30 second timeout
                        check_same_thread=False
                    )
                    self._local.conn.row_factory = sqlite3.Row
                    # Enable WAL mode for better concurrent access
                    self._local.conn.execute("PRAGMA journal_mode=WAL")
                    self._local.conn.execute("PRAGMA busy_timeout=30000")

                yield self._local.conn
                self._local.conn.commit()
                return

            except sqlite3.OperationalError as e:
                last_error = e
                if "locked" in str(e).lower():
                    retry_count += 1
                    if retry_count < self.max_retries:
                        time.sleep(self.retry_delay * retry_count)  # Exponential backoff
                        continue
                raise
            except Exception as e:
                if hasattr(self._local, 'conn') and self._local.conn:
                    self._local.conn.rollback()
                raise

        raise Exception(f"Database locked after {self.max_retries} retries: {last_error}")

    def _init_database(self):
        """Initialize database schema"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Startup sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS startup_sessions (
                    namespace_id TEXT PRIMARY KEY,
                    started_at REAL NOT NULL,
                    ended_at REAL,
                    is_active INTEGER DEFAULT 1,
                    metadata TEXT
                )
            """)

            # AI roles table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    namespace_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    role_name TEXT NOT NULL,
                    ai_name TEXT,
                    registered_at REAL NOT NULL,
                    last_active REAL NOT NULL,
                    metadata TEXT,
                    UNIQUE(namespace_id, session_id, role_name)
                )
            """)

            # Work logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS work_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    namespace_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    role_name TEXT NOT NULL,
                    message TEXT NOT NULL,
                    metadata TEXT,
                    created_at REAL NOT NULL
                )
            """)

            # Q&A table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS qa_history (
                    question_id TEXT PRIMARY KEY,
                    namespace_id TEXT NOT NULL,
                    from_role TEXT NOT NULL,
                    from_session_id TEXT NOT NULL,
                    to_role TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT,
                    context TEXT,
                    priority TEXT DEFAULT 'normal',
                    status TEXT DEFAULT 'pending',
                    asked_at REAL NOT NULL,
                    answered_at REAL,
                    answering_session_id TEXT,
                    metadata TEXT
                )
            """)

            # Create indexes for better query performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_roles_namespace ON roles(namespace_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_roles_session ON roles(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_namespace ON work_logs(namespace_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_role ON work_logs(role_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qa_namespace ON qa_history(namespace_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qa_status ON qa_history(status)")

            conn.commit()

    # Startup Session Management

    def create_startup_namespace(self, metadata: Optional[Dict] = None) -> str:
        """Create a new startup namespace and return its ID"""
        namespace_id = f"startup-{uuid.uuid4().hex[:12]}-{int(time.time())}"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO startup_sessions (namespace_id, started_at, metadata)
                VALUES (?, ?, ?)
            """, (namespace_id, time.time(), json.dumps(metadata) if metadata else None))
            conn.commit()

        return namespace_id

    def get_current_namespace(self) -> Optional[str]:
        """Get the most recent active namespace"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT namespace_id FROM startup_sessions
                WHERE is_active = 1
                ORDER BY started_at DESC
                LIMIT 1
            """)
            row = cursor.fetchone()
            return row['namespace_id'] if row else None

    def end_startup_namespace(self, namespace_id: str):
        """Mark a startup namespace as ended"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE startup_sessions
                SET ended_at = ?, is_active = 0
                WHERE namespace_id = ?
            """, (time.time(), namespace_id))
            conn.commit()

    def list_startup_namespaces(self, include_inactive: bool = False) -> List[Dict]:
        """List all startup namespaces"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM startup_sessions"
            if not include_inactive:
                query += " WHERE is_active = 1"
            query += " ORDER BY started_at DESC"

            cursor.execute(query)
            rows = cursor.fetchall()

            return [dict(row) for row in rows]

    # Role Management

    def register_role(self, namespace_id: str, session_id: str, role_name: str,
                     ai_name: Optional[str] = None, metadata: Optional[Dict] = None) -> Dict:
        """Register an AI role in a namespace"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Check if role already exists
            cursor.execute("""
                SELECT * FROM roles
                WHERE namespace_id = ? AND session_id = ? AND role_name = ?
            """, (namespace_id, session_id, role_name))

            existing = cursor.fetchone()
            now = time.time()

            if existing:
                # Update existing role
                cursor.execute("""
                    UPDATE roles
                    SET ai_name = ?, last_active = ?, metadata = ?
                    WHERE namespace_id = ? AND session_id = ? AND role_name = ?
                """, (ai_name, now, json.dumps(metadata) if metadata else None,
                     namespace_id, session_id, role_name))
                is_new = False
            else:
                # Insert new role
                cursor.execute("""
                    INSERT INTO roles (namespace_id, session_id, role_name, ai_name,
                                      registered_at, last_active, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (namespace_id, session_id, role_name, ai_name, now, now,
                     json.dumps(metadata) if metadata else None))
                is_new = True

            conn.commit()

            return {
                'success': True,
                'is_new': is_new,
                'namespace_id': namespace_id,
                'session_id': session_id,
                'role_name': role_name,
                'ai_name': ai_name,
                'registered_at': now
            }

    def get_roles(self, namespace_id: str, include_inactive: bool = False,
                  inactive_threshold: float = 3600) -> List[Dict]:
        """Get all roles in a namespace"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM roles WHERE namespace_id = ?", (namespace_id,))
            rows = cursor.fetchall()

            result = []
            cutoff_time = time.time() - inactive_threshold

            for row in rows:
                role_dict = dict(row)
                if role_dict['metadata']:
                    role_dict['metadata'] = json.loads(role_dict['metadata'])

                is_active = role_dict['last_active'] > cutoff_time
                role_dict['is_active'] = is_active

                if include_inactive or is_active:
                    result.append(role_dict)

            return result

    def update_role_activity(self, namespace_id: str, session_id: str, role_name: str):
        """Update last activity timestamp for a role"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE roles
                SET last_active = ?
                WHERE namespace_id = ? AND session_id = ? AND role_name = ?
            """, (time.time(), namespace_id, session_id, role_name))
            conn.commit()

    # Work Logs

    def write_log(self, namespace_id: str, session_id: str, role_name: str,
                  message: Any, metadata: Optional[Dict] = None) -> Dict:
        """Write a work log entry"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO work_logs (namespace_id, session_id, role_name, message, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (namespace_id, session_id, role_name,
                 json.dumps(message), json.dumps(metadata) if metadata else None,
                 time.time()))
            conn.commit()

            return {'success': True, 'log_id': cursor.lastrowid}

    def read_logs(self, namespace_id: str, role_name: Optional[str] = None,
                  session_id: Optional[str] = None, limit: int = 100,
                  offset: int = 0) -> List[Dict]:
        """Read work logs from a namespace"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM work_logs WHERE namespace_id = ?"
            params = [namespace_id]

            if role_name:
                query += " AND role_name = ?"
                params.append(role_name)

            if session_id:
                query += " AND session_id = ?"
                params.append(session_id)

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)
            rows = cursor.fetchall()

            result = []
            for row in rows:
                log_dict = dict(row)
                log_dict['message'] = json.loads(log_dict['message'])
                if log_dict['metadata']:
                    log_dict['metadata'] = json.loads(log_dict['metadata'])
                result.append(log_dict)

            return result

    def search_logs(self, namespace_id: str, keyword: str,
                   role_name: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """Search logs by keyword"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT * FROM work_logs
                WHERE namespace_id = ? AND message LIKE ?
            """
            params = [namespace_id, f"%{keyword}%"]

            if role_name:
                query += " AND role_name = ?"
                params.append(role_name)

            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            result = []
            for row in rows:
                log_dict = dict(row)
                log_dict['message'] = json.loads(log_dict['message'])
                if log_dict['metadata']:
                    log_dict['metadata'] = json.loads(log_dict['metadata'])
                result.append(log_dict)

            return result

    # Q&A System

    def ask_question(self, namespace_id: str, from_role: str, from_session_id: str,
                    to_role: str, question: str, context: Optional[Dict] = None,
                    priority: str = 'normal') -> Dict:
        """Ask a question to another AI"""
        question_id = f"q-{uuid.uuid4().hex[:12]}"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO qa_history
                (question_id, namespace_id, from_role, from_session_id, to_role,
                 question, context, priority, status, asked_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (question_id, namespace_id, from_role, from_session_id, to_role,
                 question, json.dumps(context) if context else None, priority, time.time()))
            conn.commit()

        return {
            'success': True,
            'question_id': question_id,
            'namespace_id': namespace_id,
            'from_role': from_role,
            'to_role': to_role,
            'priority': priority
        }

    def answer_question(self, question_id: str, answer: str,
                       answering_session_id: str, metadata: Optional[Dict] = None) -> Dict:
        """Answer a pending question"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE qa_history
                SET answer = ?, status = 'answered', answered_at = ?,
                    answering_session_id = ?, metadata = ?
                WHERE question_id = ?
            """, (answer, time.time(), answering_session_id,
                 json.dumps(metadata) if metadata else None, question_id))

            if cursor.rowcount == 0:
                return {'success': False, 'error': 'Question not found'}

            conn.commit()
            return {'success': True, 'question_id': question_id}

    def get_pending_questions(self, namespace_id: str, to_role: str,
                             session_id: Optional[str] = None,
                             priority_filter: Optional[List[str]] = None,
                             limit: int = 50) -> List[Dict]:
        """Get pending questions for a role"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT * FROM qa_history
                WHERE namespace_id = ? AND to_role = ? AND status = 'pending'
            """
            params = [namespace_id, to_role]

            if session_id:
                query += " AND from_session_id = ?"
                params.append(session_id)

            if priority_filter:
                placeholders = ','.join(['?'] * len(priority_filter))
                query += f" AND priority IN ({placeholders})"
                params.extend(priority_filter)

            query += " ORDER BY asked_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            result = []
            for row in rows:
                qa_dict = dict(row)
                if qa_dict['context']:
                    qa_dict['context'] = json.loads(qa_dict['context'])
                result.append(qa_dict)

            return result

    def get_question_history(self, namespace_id: str, role_name: Optional[str] = None,
                            session_id: Optional[str] = None, status: Optional[str] = None,
                            limit: int = 100) -> List[Dict]:
        """Get question history"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM qa_history WHERE namespace_id = ?"
            params = [namespace_id]

            if role_name:
                query += " AND (from_role = ? OR to_role = ?)"
                params.extend([role_name, role_name])

            if session_id:
                query += " AND from_session_id = ?"
                params.append(session_id)

            if status:
                query += " AND status = ?"
                params.append(status)

            query += " ORDER BY asked_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            result = []
            for row in rows:
                qa_dict = dict(row)
                if qa_dict['context']:
                    qa_dict['context'] = json.loads(qa_dict['context'])
                if qa_dict['metadata']:
                    qa_dict['metadata'] = json.loads(qa_dict['metadata'])
                result.append(qa_dict)

            return result

    # Statistics

    def get_stats(self, namespace_id: Optional[str] = None) -> Dict:
        """Get storage and activity statistics"""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            if namespace_id:
                # Stats for specific namespace
                cursor.execute("SELECT COUNT(*) as count FROM roles WHERE namespace_id = ?",
                              (namespace_id,))
                roles_count = cursor.fetchone()['count']

                cursor.execute("SELECT COUNT(*) as count FROM work_logs WHERE namespace_id = ?",
                              (namespace_id,))
                logs_count = cursor.fetchone()['count']

                cursor.execute("SELECT COUNT(*) as count FROM qa_history WHERE namespace_id = ?",
                              (namespace_id,))
                qa_count = cursor.fetchone()['count']

                return {
                    'namespace_id': namespace_id,
                    'roles_count': roles_count,
                    'logs_count': logs_count,
                    'qa_count': qa_count
                }
            else:
                # Global stats
                cursor.execute("SELECT COUNT(*) as count FROM startup_sessions")
                sessions_count = cursor.fetchone()['count']

                cursor.execute("SELECT COUNT(*) as count FROM roles")
                total_roles = cursor.fetchone()['count']

                cursor.execute("SELECT COUNT(*) as count FROM work_logs")
                total_logs = cursor.fetchone()['count']

                cursor.execute("SELECT COUNT(*) as count FROM qa_history")
                total_qa = cursor.fetchone()['count']

                import os
                db_size = os.path.getsize(self.db_path) if self.db_path.exists() else 0

                return {
                    'database_path': str(self.db_path),
                    'database_size_bytes': db_size,
                    'database_size_mb': round(db_size / (1024 * 1024), 2),
                    'total_sessions': sessions_count,
                    'total_roles': total_roles,
                    'total_logs': total_logs,
                    'total_qa': total_qa
                }

    def cleanup_old_sessions(self, days: int = 30):
        """Clean up old inactive sessions"""
        cutoff_time = time.time() - (days * 24 * 60 * 60)

        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Get old namespaces
            cursor.execute("""
                SELECT namespace_id FROM startup_sessions
                WHERE started_at < ? AND is_active = 0
            """, (cutoff_time,))
            old_namespaces = [row['namespace_id'] for row in cursor.fetchall()]

            # Delete related data
            for namespace_id in old_namespaces:
                cursor.execute("DELETE FROM roles WHERE namespace_id = ?", (namespace_id,))
                cursor.execute("DELETE FROM work_logs WHERE namespace_id = ?", (namespace_id,))
                cursor.execute("DELETE FROM qa_history WHERE namespace_id = ?", (namespace_id,))
                cursor.execute("DELETE FROM startup_sessions WHERE namespace_id = ?", (namespace_id,))

            conn.commit()

            return {'cleaned_sessions': len(old_namespaces)}

    def close(self):
        """Close the database connection"""
        if hasattr(self._local, 'conn') and self._local.conn:
            self._local.conn.close()
            self._local.conn = None

#!/usr/bin/env python3
"""
Database namespace management for multi-AI session handling
Simplified and streamlined from McpAlchemy
"""

import hashlib
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any

from pycore.pygvar import PYTOOLS_TMP_DIR
from pycore.pyfoundations.color_print import ColorPrint


class DatabaseNamespaceManager:
    """
    Manages database namespaces for multi-AI concurrent access
    Singleton pattern with session persistence
    """

    _instance: Optional['DatabaseNamespaceManager'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.sessions_dir = Path(PYTOOLS_TMP_DIR) / "mcp_database_sessions"
        self.sessions_file = self.sessions_dir / "active_sessions.json"
        self.sessions_dir.mkdir(exist_ok=True, parents=True)

        self.sessions: Dict[str, Dict[str, Any]] = self._load_sessions()
        self._initialized = True

        ColorPrint.blue("[DatabaseNamespaceManager] Initialized")

    def _load_sessions(self) -> Dict[str, Dict[str, Any]]:
        """Load active sessions from persistent storage"""
        try:
            if self.sessions_file.exists():
                with open(self.sessions_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            ColorPrint.yellow(f"[DatabaseNamespaceManager] Failed to load sessions: {e}")
            return {}

    def _save_sessions(self) -> None:
        """Save active sessions to persistent storage"""
        try:
            with open(self.sessions_file, 'w', encoding='utf-8') as f:
                json.dump(self.sessions, f, indent=2, ensure_ascii=False)
        except Exception as e:
            ColorPrint.red(f"[DatabaseNamespaceManager] Failed to save sessions: {e}")

    def create_namespace_for_client(
        self,
        client_identifier: str = "default_client",
        custom_namespace: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new namespace for a client with automatic session management

        Args:
            client_identifier: Unique client identifier (e.g., "claude_desktop", "cursor", "vscode")
            custom_namespace: Optional custom namespace name

        Returns:
            Session information including namespace, session_key, and metadata
        """
        session_id = str(uuid.uuid4())[:8]

        if custom_namespace:
            # Check if custom namespace already exists
            for session_info in self.sessions.values():
                if session_info.get('namespace') == custom_namespace:
                    raise ValueError(f"Namespace '{custom_namespace}' already exists")
            namespace = custom_namespace
        else:
            namespace = f"{client_identifier}_{session_id}"

        session_key = f"{client_identifier}_{session_id}"
        workspace_dir = self.sessions_dir / session_key
        workspace_dir.mkdir(exist_ok=True)

        session_info = {
            'session_id': session_id,
            'session_key': session_key,
            'client_id': client_identifier,
            'namespace': namespace,
            'workspace': str(workspace_dir),
            'created_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat(),
            'databases': {},
            'status': 'active'
        }

        self.sessions[session_key] = session_info
        self._save_sessions()

        ColorPrint.green(f"[DatabaseNamespaceManager] Created namespace: {namespace}")
        return session_info

    def get_session_by_namespace(self, namespace: str) -> Optional[Dict[str, Any]]:
        """Get session information by namespace"""
        for session_info in self.sessions.values():
            if session_info.get('namespace') == namespace:
                self._update_session_activity(session_info['session_key'])
                return session_info
        return None

    def get_session_by_key(self, session_key: str) -> Optional[Dict[str, Any]]:
        """Get session information by session key"""
        if session_key in self.sessions:
            self._update_session_activity(session_key)
            return self.sessions[session_key]
        return None

    def _update_session_activity(self, session_key: str) -> None:
        """Update session last activity timestamp"""
        if session_key in self.sessions:
            self.sessions[session_key]['last_active'] = datetime.now().isoformat()
            self._save_sessions()

    def register_database_to_namespace(
        self,
        namespace: str,
        database_name: str,
        connection_string: str
    ) -> Dict[str, Any]:
        """
        Register a database connection to a namespace

        Args:
            namespace: Namespace identifier
            database_name: Friendly name for the database
            connection_string: SQLAlchemy connection string

        Returns:
            Registration result with database identifier
        """
        session_info = self.get_session_by_namespace(namespace)
        if not session_info:
            raise ValueError(f"Namespace '{namespace}' not found")

        # Create database identifier hash
        db_hash = hashlib.md5(connection_string.encode()).hexdigest()[:8]
        db_identifier = f"{database_name}_{db_hash}"

        # Register database
        session_info['databases'][database_name] = {
            'identifier': db_identifier,
            'connection_string': connection_string,
            'registered_at': datetime.now().isoformat(),
            'last_used': datetime.now().isoformat()
        }

        self._save_sessions()

        ColorPrint.green(f"[DatabaseNamespaceManager] Registered database '{database_name}' to namespace '{namespace}'")

        return {
            'database_name': database_name,
            'identifier': db_identifier,
            'namespace': namespace,
            'status': 'registered'
        }

    def get_database_connection_string(
        self,
        namespace: str,
        database_name: str
    ) -> Optional[str]:
        """Get database connection string from namespace"""
        session_info = self.get_session_by_namespace(namespace)
        if not session_info:
            return None

        db_info = session_info['databases'].get(database_name)
        if not db_info:
            return None

        # Update last used timestamp
        db_info['last_used'] = datetime.now().isoformat()
        self._save_sessions()

        return db_info['connection_string']

    def list_namespace_databases(self, namespace: str) -> Dict[str, Any]:
        """List all databases registered to a namespace"""
        session_info = self.get_session_by_namespace(namespace)
        if not session_info:
            return {'error': f"Namespace '{namespace}' not found"}

        return {
            'namespace': namespace,
            'session_key': session_info['session_key'],
            'databases': list(session_info['databases'].keys()),
            'database_details': session_info['databases']
        }

    def cleanup_old_sessions(self, max_age_hours: int = 24) -> Dict[str, Any]:
        """Clean up old inactive sessions"""
        current_time = datetime.now()
        removed_count = 0

        to_remove = []
        for session_key, session_info in self.sessions.items():
            try:
                last_active = datetime.fromisoformat(session_info['last_active'])
                age_hours = (current_time - last_active).total_seconds() / 3600

                if age_hours > max_age_hours:
                    to_remove.append(session_key)
            except Exception:
                to_remove.append(session_key)

        for session_key in to_remove:
            session_info = self.sessions[session_key]

            # Clean up workspace directory
            try:
                workspace = Path(session_info['workspace'])
                if workspace.exists():
                    import shutil
                    shutil.rmtree(workspace, ignore_errors=True)
            except Exception as e:
                ColorPrint.yellow(f"[DatabaseNamespaceManager] Failed to cleanup workspace: {e}")

            del self.sessions[session_key]
            removed_count += 1

        if to_remove:
            self._save_sessions()
            ColorPrint.green(f"[DatabaseNamespaceManager] Cleaned up {removed_count} old sessions")

        return {
            'cleaned_sessions': removed_count,
            'active_sessions': len(self.sessions)
        }

    def get_all_namespaces(self) -> Dict[str, Any]:
        """Get all active namespaces"""
        return {
            'total_sessions': len(self.sessions),
            'namespaces': [
                {
                    'namespace': info['namespace'],
                    'client_id': info['client_id'],
                    'databases_count': len(info['databases']),
                    'created_at': info['created_at'],
                    'last_active': info['last_active']
                }
                for info in self.sessions.values()
            ]
        }


# Singleton instance getter
_namespace_manager_singleton: Optional[DatabaseNamespaceManager] = None


def get_database_namespace_manager_singleton() -> DatabaseNamespaceManager:
    """Get singleton instance of DatabaseNamespaceManager"""
    global _namespace_manager_singleton
    if _namespace_manager_singleton is None:
        _namespace_manager_singleton = DatabaseNamespaceManager()
    return _namespace_manager_singleton

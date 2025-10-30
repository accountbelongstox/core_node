"""
Message Queue for AI Collaboration
Manages work logs in role-specific namespaces
"""

import time
import threading
from typing import Dict, List, Optional
from pathlib import Path

class MessageQueue:
    """Manages message logging for AI collaboration"""

    def __init__(self, storage_manager, messages_dir: Path, max_queue_length: int = 1000):
        self.storage = storage_manager
        self.messages_dir = messages_dir
        self.max_queue_length = max_queue_length

        self.messages_dir.mkdir(parents=True, exist_ok=True)

    def _get_log_file(self, role_name: str, session_id: str) -> Path:
        """Get log file path for a specific role and session"""
        return self.messages_dir / f"{role_name}_{session_id}.json"

    def write_log(self, session_id: str, role_name: str, message: Dict, metadata: Dict = None) -> Dict:
        """
        Write a log message to the role's namespace

        Args:
            session_id: Unique session identifier
            role_name: Role name (e.g., 'frontend_designer')
            message: The log message content
            metadata: Optional metadata

        Returns:
            Write result
        """
        try:
            log_file = self._get_log_file(role_name, session_id)

            log_entry = {
                'timestamp': time.time(),
                'session_id': session_id,
                'role_name': role_name,
                'message': message,
                'metadata': metadata or {}
            }

            success = self.storage.append_to_queue(
                log_file,
                log_entry,
                self.max_queue_length
            )

            if success:
                return {
                    'success': True,
                    'message': 'Log written successfully',
                    'log_file': str(log_file)
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to write log'
                }

        except Exception as e:
            import sys
            print(f"Error writing log: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def read_logs(self, role_name: str, session_id: str = None, limit: int = 100, offset: int = 0) -> Dict:
        """
        Read logs from a specific role's namespace

        Args:
            role_name: Role name to read logs from
            session_id: Optional specific session ID (if None, reads all sessions for this role)
            limit: Maximum number of logs to return
            offset: Number of logs to skip from the end

        Returns:
            Logs and metadata
        """
        try:
            if session_id:
                log_files = [self._get_log_file(role_name, session_id)]
            else:
                pattern = f"{role_name}_*.json"
                log_files = list(self.messages_dir.glob(pattern))

            all_logs = []
            for log_file in log_files:
                if log_file.exists():
                    logs = self.storage.load_json(log_file, [])
                    if isinstance(logs, list):
                        all_logs.extend(logs)

            all_logs.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

            start_index = offset
            end_index = offset + limit
            selected_logs = all_logs[start_index:end_index]

            return {
                'success': True,
                'logs': selected_logs,
                'total_count': len(all_logs),
                'returned_count': len(selected_logs),
                'role_name': role_name,
                'session_id': session_id
            }

        except Exception as e:
            import sys
            print(f"Error reading logs: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'logs': []
            }

    def read_all_logs(self, limit: int = 100, offset: int = 0) -> Dict:
        """
        Read logs from all roles

        Args:
            limit: Maximum number of logs to return
            offset: Number of logs to skip from the end

        Returns:
            All logs sorted by timestamp
        """
        try:
            log_files = list(self.messages_dir.glob("*.json"))

            all_logs = []
            for log_file in log_files:
                if log_file.exists():
                    logs = self.storage.load_json(log_file, [])
                    if isinstance(logs, list):
                        all_logs.extend(logs)

            all_logs.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

            start_index = offset
            end_index = offset + limit
            selected_logs = all_logs[start_index:end_index]

            return {
                'success': True,
                'logs': selected_logs,
                'total_count': len(all_logs),
                'returned_count': len(selected_logs)
            }

        except Exception as e:
            import sys
            print(f"Error reading all logs: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'logs': []
            }

    def get_log_summary(self) -> Dict:
        """
        Get summary of all logs by role

        Returns:
            Summary statistics
        """
        try:
            log_files = list(self.messages_dir.glob("*.json"))

            summary = {}
            total_logs = 0

            for log_file in log_files:
                if log_file.exists():
                    logs = self.storage.load_json(log_file, [])
                    if isinstance(logs, list):
                        file_name = log_file.stem
                        parts = file_name.rsplit('_', 1)
                        if len(parts) == 2:
                            role_name, session_id = parts
                            if role_name not in summary:
                                summary[role_name] = {
                                    'total_logs': 0,
                                    'sessions': []
                                }
                            summary[role_name]['total_logs'] += len(logs)
                            summary[role_name]['sessions'].append({
                                'session_id': session_id,
                                'log_count': len(logs),
                                'last_log_time': logs[-1].get('timestamp', 0) if logs else 0
                            })
                            total_logs += len(logs)

            return {
                'success': True,
                'total_logs': total_logs,
                'roles': summary,
                'total_roles': len(summary)
            }

        except Exception as e:
            import sys
            print(f"Error getting log summary: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def search_logs(self, keyword: str, role_name: str = None, limit: int = 50) -> Dict:
        """
        Search logs by keyword

        Args:
            keyword: Keyword to search for
            role_name: Optional role name to filter by
            limit: Maximum number of results

        Returns:
            Matching logs
        """
        try:
            if role_name:
                pattern = f"{role_name}_*.json"
            else:
                pattern = "*.json"

            log_files = list(self.messages_dir.glob(pattern))

            matching_logs = []
            keyword_lower = keyword.lower()

            for log_file in log_files:
                if log_file.exists():
                    logs = self.storage.load_json(log_file, [])
                    if isinstance(logs, list):
                        for log in logs:
                            message_str = str(log.get('message', '')).lower()
                            if keyword_lower in message_str:
                                matching_logs.append(log)

                                if len(matching_logs) >= limit:
                                    break

                        if len(matching_logs) >= limit:
                            break

            matching_logs.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

            return {
                'success': True,
                'logs': matching_logs,
                'count': len(matching_logs),
                'keyword': keyword,
                'role_name': role_name
            }

        except Exception as e:
            import sys
            print(f"Error searching logs: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e),
                'logs': []
            }

    def clear_logs(self, role_name: str, session_id: str) -> Dict:
        """
        Clear logs for a specific role and session

        Args:
            role_name: Role name
            session_id: Session ID

        Returns:
            Clear result
        """
        try:
            log_file = self._get_log_file(role_name, session_id)

            if log_file.exists():
                log_file.unlink()
                return {
                    'success': True,
                    'message': 'Logs cleared successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Log file not found'
                }

        except Exception as e:
            import sys
            print(f"Error clearing logs: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

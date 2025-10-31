"""
Role Manager for AI Collaboration
Manages AI roles and their registration
"""

import time
import threading
from typing import Dict, List, Optional
from pathlib import Path

class RoleManager:
    """Manages AI roles in the collaboration system"""

    def __init__(self, storage_manager, roles_file: Path, predefined_roles: List[str]):
        self.storage = storage_manager
        self.roles_file = roles_file
        self.predefined_roles = predefined_roles
        self._lock = threading.Lock()

        self.roles: Dict[str, Dict] = self._load_roles()

    def _load_roles(self) -> Dict[str, Dict]:
        """Load roles from storage"""
        return self.storage.load_json(self.roles_file, {})

    def _save_roles(self) -> bool:
        """Save roles to storage"""
        return self.storage.save_json(self.roles_file, self.roles)

    def register_role(self, session_id: str, role_name: str, ai_name: str = None, metadata: Dict = None) -> Dict:
        """
        Register an AI with a role

        Args:
            session_id: Unique session identifier
            role_name: Role name (e.g., 'frontend_designer')
            ai_name: Optional AI name (e.g., 'Claude 1')
            metadata: Additional metadata

        Returns:
            Registration result
        """
        try:
            if role_name not in self.predefined_roles:
                return {
                    'success': False,
                    'error': f'Unknown role: {role_name}',
                    'available_roles': self.predefined_roles
                }

            role_key = f"{role_name}_{session_id}"
            is_new = False
            role_data = None

            with self._lock:
                existing = self.roles.get(role_key)
                if existing:
                    existing['last_active'] = time.time()
                    role_data = existing
                    is_new = False
                else:
                    role_data = {
                        'session_id': session_id,
                        'role_name': role_name,
                        'ai_name': ai_name or f"{role_name}_{session_id[:8]}",
                        'registered_at': time.time(),
                        'last_active': time.time(),
                        'metadata': metadata or {}
                    }
                    self.roles[role_key] = role_data
                    is_new = True

            self._save_roles()

            current_time = time.time()
            total_active = sum(1 for r in self.roles.values() if current_time - r.get('last_active', 0) < 3600)
            total_registered = len(self.roles)

            if is_new:
                return {
                    'success': True,
                    'message': 'Role registered successfully - Service is running, other AIs can join anytime',
                    'role': role_data,
                    'is_new': True,
                    'total_active_roles': total_active,
                    'total_registered_roles': total_registered,
                    'note': 'Use get_role_list tool to see all registered roles'
                }
            else:
                return {
                    'success': True,
                    'message': 'Role already registered - Activity timestamp updated',
                    'role': role_data,
                    'is_new': False,
                    'total_active_roles': total_active,
                    'total_registered_roles': total_registered,
                    'note': 'Service is running, use get_role_list to see all other registered roles'
                }

        except Exception as e:
            import sys
            print(f"Error registering role: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def get_role_list(self, include_inactive: bool = False) -> List[Dict]:
        """
        Get list of all registered roles

        Args:
            include_inactive: Include roles inactive for >1 hour

        Returns:
            List of role information
        """
        try:
            with self._lock:
                current_time = time.time()
                roles_list = []

                for role_key, role_data in self.roles.items():
                    if not include_inactive:
                        if current_time - role_data.get('last_active', 0) > 3600:
                            continue

                    roles_list.append({
                        'role_name': role_data['role_name'],
                        'ai_name': role_data['ai_name'],
                        'session_id': role_data['session_id'],
                        'registered_at': role_data['registered_at'],
                        'last_active': role_data.get('last_active', 0),
                        'is_active': current_time - role_data.get('last_active', 0) < 3600
                    })

                return roles_list

        except Exception as e:
            import sys
            print(f"Error getting role list: {e}", file=sys.stderr)
            return []

    def update_activity(self, session_id: str, role_name: str):
        """Update last activity time for a role"""
        try:
            updated = False
            with self._lock:
                role_key = f"{role_name}_{session_id}"
                if role_key in self.roles:
                    self.roles[role_key]['last_active'] = time.time()
                    updated = True

            if updated:
                self._save_roles()
        except Exception as e:
            import sys
            print(f"Error updating activity: {e}", file=sys.stderr)

    def get_role_info(self, session_id: str, role_name: str) -> Optional[Dict]:
        """Get information about a specific role"""
        role_key = f"{role_name}_{session_id}"
        return self.roles.get(role_key)

    def cleanup_inactive_roles(self, max_inactive_hours: int = 24):
        """Remove roles that have been inactive for too long"""
        try:
            current_time = time.time()
            cutoff_time = current_time - (max_inactive_hours * 3600)
            inactive_roles = []

            with self._lock:
                inactive_roles = [
                    role_key for role_key, role_data in self.roles.items()
                    if role_data.get('last_active', 0) < cutoff_time
                ]

                for role_key in inactive_roles:
                    del self.roles[role_key]
                    import sys
                    print(f"Removed inactive role: {role_key}", file=sys.stderr)

            if inactive_roles:
                self._save_roles()

        except Exception as e:
            import sys
            print(f"Error cleaning up inactive roles: {e}", file=sys.stderr)

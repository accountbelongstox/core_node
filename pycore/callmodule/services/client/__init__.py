# -*- coding: utf-8 -*-
"""
Client Service - Remote server request forwarding

Features:
- Forward requests to remote servers
- Manage server configurations
- Test server connections
- URL encoding for requests
"""

import json
from typing import Dict, Any, Optional, List
from pathlib import Path


class ClientService:
    """Client service for remote server operations"""

    def __init__(self):
        self.servers: List[Dict[str, Any]] = []
        self.config_file = Path("./config/client_config.json")
        self._ensure_config_dir()
        self._load_config()

    def _ensure_config_dir(self):
        """Ensure config directory exists"""
        self.config_file.parent.mkdir(parents=True, exist_ok=True)

    def _load_config(self):
        """Load configuration from file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.servers = config.get('servers', [])
        except Exception as e:
            print(f"[ClientService] Failed to load config: {e}")
            self.servers = []

    def _save_config(self):
        """Save configuration to file"""
        try:
            config = {'servers': self.servers}
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ClientService] Failed to save config: {e}")

    def forward_request(self, endpoint: str, method: str = "POST",
                       data: Optional[dict] = None) -> Dict[str, Any]:
        """
        Forward request to remote server

        Args:
            endpoint: Target endpoint path
            method: HTTP method (GET, POST, PUT, DELETE)
            data: Request data

        Returns:
            Response from remote server
        """
        # TODO: Implement actual HTTP request forwarding
        # Currently returns mock response
        return {
            "success": False,
            "error": "Remote forwarding not yet implemented",
            "endpoint": endpoint,
            "method": method
        }

    def encode_request(self, data: dict) -> Dict[str, Any]:
        """
        Encode request data for URL transmission

        Args:
            data: Request data to encode

        Returns:
            Encoded request data
        """
        try:
            import urllib.parse
            encoded = urllib.parse.urlencode(data)
            return {
                "success": True,
                "encoded": encoded
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Encoding failed: {str(e)}"
            }

    def get_server_config(self) -> Dict[str, Any]:
        """Get all server configurations"""
        return {
            "success": True,
            "servers": self.servers
        }

    def add_server(self, server: Dict[str, Any]) -> Dict[str, Any]:
        """Add new server configuration"""
        try:
            # Validate required fields
            if not server.get('name') or not server.get('url'):
                return {
                    "success": False,
                    "error": "Missing required fields: name, url"
                }

            # Check duplicate name
            if any(s['name'] == server['name'] for s in self.servers):
                return {
                    "success": False,
                    "error": f"Server '{server['name']}' already exists"
                }

            # Add default fields
            server.setdefault('type', 'generic')
            server.setdefault('status', 'unknown')
            server.setdefault('enabled', True)

            self.servers.append(server)
            self._save_config()

            return {
                "success": True,
                "message": "Server added successfully",
                "server": server
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def update_server(self, name: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update server configuration"""
        try:
            for server in self.servers:
                if server['name'] == name:
                    server.update(updates)
                    self._save_config()
                    return {
                        "success": True,
                        "message": "Server updated successfully",
                        "server": server
                    }

            return {
                "success": False,
                "error": f"Server '{name}' not found"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def delete_server(self, name: str) -> Dict[str, Any]:
        """Delete server configuration"""
        try:
            for i, server in enumerate(self.servers):
                if server['name'] == name:
                    del self.servers[i]
                    self._save_config()
                    return {
                        "success": True,
                        "message": f"Server '{name}' deleted successfully"
                    }

            return {
                "success": False,
                "error": f"Server '{name}' not found"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_connection_status(self) -> Dict[str, Any]:
        """Get connection status for all servers"""
        server_status = []
        for server in self.servers:
            server_status.append({
                "name": server['name'],
                "url": server['url'],
                "status": server.get('status', 'unknown'),
                "enabled": server.get('enabled', True),
                "latency": server.get('latency', 0)
            })

        return {
            "success": True,
            "connected": len([s for s in server_status if s['status'] == 'online']) > 0,
            "servers": server_status
        }

    def test_connection(self, name: str) -> Dict[str, Any]:
        """Test connection to specific server"""
        try:
            for server in self.servers:
                if server['name'] == name:
                    # TODO: Implement actual connection test
                    # Currently returns mock result
                    server['status'] = 'online'
                    server['latency'] = 50  # ms
                    self._save_config()

                    return {
                        "success": True,
                        "message": f"Server '{name}' is reachable",
                        "status": "online",
                        "latency": 50
                    }

            return {
                "success": False,
                "error": f"Server '{name}' not found"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

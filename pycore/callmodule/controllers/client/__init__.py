# -*- coding: utf-8 -*-
"""Client Controller"""
from typing import Optional
from ...services.client import ClientService

class ClientController:
    def __init__(self):
        self.service = ClientService()

    def forward(self, endpoint: str, method: str, data: Optional[dict] = None):
        """Forward request to remote server"""
        return self.service.forward_request(endpoint, method, data)

    def encode_request(self, data: dict):
        """Encode request data"""
        return self.service.encode_request(data)

    def get_server_config(self):
        """Get server configurations"""
        return self.service.get_server_config()

    def add_server(self, server: dict):
        """Add server configuration"""
        return self.service.add_server(server)

    def update_server(self, name: str, updates: dict):
        """Update server configuration"""
        return self.service.update_server(name, updates)

    def delete_server(self, name: str):
        """Delete server configuration"""
        return self.service.delete_server(name)

    def get_connection_status(self):
        """Get connection status"""
        return self.service.get_connection_status()

    def test_connection(self, name: str):
        """Test server connection"""
        return self.service.test_connection(name)

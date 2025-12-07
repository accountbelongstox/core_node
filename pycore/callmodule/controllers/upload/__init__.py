# -*- coding: utf-8 -*-
"""Upload Controller"""
<<<<<<< HEAD
from typing import Optional
from ...services.upload import UploadService

class UploadController:
    def __init__(self):
        self.service = UploadService()

    def get_tasks(self, status: Optional[str] = None, limit: int = 50):
        """Get upload tasks list"""
        return self.service.get_tasks(status=status, limit=limit)

    def get_servers(self):
        """Get upload servers configuration"""
        return self.service.get_servers()

    def add_server(self, server: dict):
        """Add upload server"""
        return self.service.add_server(server)

    def update_server(self, name: str, updates: dict):
        """Update upload server configuration"""
        return self.service.update_server(name, updates)

    def delete_server(self, name: str):
        """Delete upload server"""
        return self.service.delete_server(name)

    def test_server(self, name: str):
        """Test server connection"""
        return self.service.test_server(name)

    def get_progress(self, upload_id: str):
        """Get upload progress"""
        return self.service.get_progress(upload_id)

    def cancel_task(self, upload_id: str):
        """Cancel upload task"""
        return self.service.cancel_task(upload_id)

    def get_history(self, limit: int = 50):
        """Get upload history"""
        return self.service.get_history(limit=limit)

    def get_stats(self):
        """Get upload statistics"""
        return self.service.get_stats()
=======
from ...services.upload import UploadService
class UploadController:
    def __init__(self):
        self.service = UploadService()
    def get_tasks(self):
        return self.service.get_tasks()
    def get_servers(self):
        return self.service.get_servers()
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

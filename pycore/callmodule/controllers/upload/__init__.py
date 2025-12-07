# -*- coding: utf-8 -*-
"""Upload Controller"""
from ...services.upload import UploadService
class UploadController:
    def __init__(self):
        self.service = UploadService()
    def get_tasks(self):
        return self.service.get_tasks()
    def get_servers(self):
        return self.service.get_servers()

# -*- coding: utf-8 -*-
"""Client Service"""
class ClientService:
    def forward_request(self, endpoint, method, data):
        return {"success": False, "error": "Not implemented"}
    def get_connection_status(self):
        return {"connected": False}

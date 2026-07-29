# -*- coding: utf-8 -*-
"""Client Controller"""
from pycore.callmodule.services.client.service import ClientService
class ClientController:
    def __init__(self):
        self.service = ClientService()
    def forward(self, endpoint, method, data):
        return self.service.forward_request(endpoint, method, data)
    def get_connection_status(self):
        return self.service.get_connection_status()

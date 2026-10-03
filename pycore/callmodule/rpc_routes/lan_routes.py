# -*- coding: utf-8 -*-
"""HTTP route publishing the pycore machines found on the LAN (service contract
``access.lan.machines_route``)."""

from pycore.pyfoundations.service_contract import lan_machines_route
from pycore.pyutils.rpc.lan_machines import lan_machines
from pycore.pyutils.rpc.server import HTTP_API_PREFIX

# The contract names the full HTTP path; routes are registered below the API prefix.
LAN_MACHINES_ROUTE = lan_machines_route().removeprefix(f"{HTTP_API_PREFIX}/")


def register_lan_routes(server) -> None:
    def machines_handler(params, request_id, context):
        return lan_machines.snapshot()

    server.get(path=LAN_MACHINES_ROUTE, handler=machines_handler)

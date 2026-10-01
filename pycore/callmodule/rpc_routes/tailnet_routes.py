# -*- coding: utf-8 -*-
"""HTTP route publishing the live tailnet machine list (service contract
``access.tailnet.peers_route``)."""

from pycore.pyfoundations import service_contract
from pycore.pyutils.common.tailnet_peers import read_tailnet_peers
from pycore.pyutils.rpc.server import HTTP_API_PREFIX

# The contract names the full HTTP path; routes are registered below the API prefix.
TAILNET_PEERS_ROUTE = str(service_contract.value("access.tailnet.peers_route")).removeprefix(f"{HTTP_API_PREFIX}/")


def register_tailnet_routes(server) -> None:
    def peers_handler(params, request_id, context):
        return read_tailnet_peers()

    server.get(path=TAILNET_PEERS_ROUTE, handler=peers_handler)

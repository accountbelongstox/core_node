import socket
import asyncio
import logging
from typing import Optional, List, Dict
import ipaddress
from constants import ServiceDiscoveryConstants

logger = logging.getLogger(__name__)

class NetworkScanner:
    def __init__(self):
        self.constants = ServiceDiscoveryConstants

    def get_local_ip_and_network(self) -> Dict[str, str]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()

            ip_parts = local_ip.split('.')
            network_segment = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}"
            gateway_ip = f"{network_segment}.1"

            return {
                "local_ip": local_ip,
                "network_segment": network_segment,
                "gateway_ip": gateway_ip
            }
        except Exception as e:
            logger.error(f"Failed to get local IP: {e}", exc_info=True)
            return {
                "local_ip": "127.0.0.1",
                "network_segment": "127.0.0",
                "gateway_ip": "127.0.0.1"
            }

    async def check_gateway_accessible(self, gateway_ip: str) -> bool:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(gateway_ip, 80),
                timeout=self.constants.GATEWAY_TIMEOUT
            )
            writer.close()
            await writer.wait_closed()
            return True
        except:
            return False

    async def check_service_health(self, ip: str, port: int) -> bool:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=self.constants.DISCOVERY_TIMEOUT
            )
            writer.close()
            await writer.wait_closed()
            return True
        except:
            return False

    async def scan_network_for_service(self, network_segment: str, port: int) -> Optional[str]:
        tasks = []
        for i in range(self.constants.SCAN_RANGE_START, self.constants.SCAN_RANGE_END + 1):
            ip = f"{network_segment}.{i}"
            tasks.append(self._check_ip_port(ip, port))

        results = await asyncio.gather(*tasks)

        for ip, is_alive in results:
            if is_alive:
                logger.info(f"Found service at {ip}:{port}")
                return ip

        return None

    async def _check_ip_port(self, ip: str, port: int) -> tuple:
        is_alive = await self.check_service_health(ip, port)
        return (ip, is_alive)

    async def discover_laravel_static(self) -> Dict[str, any]:
        network_info = self.get_local_ip_and_network()

        gateway_accessible = await self.check_gateway_accessible(network_info["gateway_ip"])

        if not gateway_accessible:
            return {
                "status": "network_unreachable",
                "message": "Gateway not accessible, network segment incorrect",
                "network_info": network_info,
                "service_url": None
            }

        default_ip = self.constants.DEFAULT_LARAVEL_IP
        default_port = self.constants.DEFAULT_LARAVEL_PORT

        default_ip_parts = default_ip.split('.')
        default_segment = f"{default_ip_parts[0]}.{default_ip_parts[1]}.{default_ip_parts[2]}"

        if default_segment != network_info["network_segment"]:
            logger.info(f"Network segment mismatch: expected {default_segment}, got {network_info['network_segment']}")
            discovered_ip = await self.scan_network_for_service(network_info["network_segment"], default_port)

            if discovered_ip:
                return {
                    "status": "discovered",
                    "message": f"Laravel service discovered at {discovered_ip}:{default_port}",
                    "network_info": network_info,
                    "service_url": f"http://{discovered_ip}:{default_port}"
                }
            else:
                return {
                    "status": "not_found",
                    "message": "Laravel service not found in network segment",
                    "network_info": network_info,
                    "service_url": None
                }

        is_accessible = await self.check_service_health(default_ip, default_port)

        if is_accessible:
            return {
                "status": "accessible",
                "message": f"Laravel service accessible at {default_ip}:{default_port}",
                "network_info": network_info,
                "service_url": f"http://{default_ip}:{default_port}"
            }
        else:
            return {
                "status": "maintenance",
                "message": "Network segment correct but Laravel service unavailable (may be under maintenance)",
                "network_info": network_info,
                "service_url": None
            }

    async def discover_service_dynamic(self, port: int, service_name: str) -> Dict[str, any]:
        localhost_accessible = await self.check_service_health(self.constants.LOCALHOST, port)

        if localhost_accessible:
            return {
                "status": "localhost",
                "message": f"{service_name} service running on localhost",
                "service_url": f"http://{self.constants.LOCALHOST}:{port}"
            }

        network_info = self.get_local_ip_and_network()

        discovered_ip = await self.scan_network_for_service(network_info["network_segment"], port)

        if discovered_ip:
            return {
                "status": "discovered",
                "message": f"{service_name} service discovered at {discovered_ip}:{port}",
                "service_url": f"http://{discovered_ip}:{port}"
            }
        else:
            return {
                "status": "not_found",
                "message": f"{service_name} service not found on localhost or LAN",
                "service_url": None
            }

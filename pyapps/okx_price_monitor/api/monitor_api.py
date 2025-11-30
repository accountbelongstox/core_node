#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor API - RPC API Endpoints

Provides RPC endpoints for the web UI using rpc_v2.
"""

import json
from typing import Dict, Any, Optional

from pyapps.okx_price_monitor.services.monitor_manager import get_monitor_manager
from pyapps.okx_price_monitor.core.monitor_config import monitor_config


class MonitorAPI:
    """
    Monitor API Handler

    Provides all RPC endpoints for the web UI.
    """

    def __init__(self):
        """Initialize API"""
        self.manager = get_monitor_manager()

    async def get_stats(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Get system statistics

        Returns:
            Dict: System stats
        """
        stats = self.manager.get_stats()
        return {
            'success': True,
            'data': stats
        }

    async def get_coins_list(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Get list of all monitored coins

        Returns:
            Dict: Coins list with record counts
        """
        coins_data = []

        for coin in self.manager.initialized_coins:
            record_count = self.manager.table_manager.get_record_count(coin)
            tracker = self.manager.trackers.get(coin)

            coin_info = {
                'coin': coin,
                'inst_id': f"{coin}-{monitor_config.QUOTE_CURRENCY}",
                'record_count': record_count,
                'current_price': tracker.current_price if tracker else None,
                'last_update': tracker.last_update_time if tracker else None
            }

            coins_data.append(coin_info)

        coins_data.sort(key=lambda x: x['record_count'], reverse=True)

        return {
            'success': True,
            'data': {
                'total_coins': len(coins_data),
                'coins': coins_data
            }
        }

    async def get_coin_summary(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Get summary for specific coin

        Args:
            params: {'coin': 'BTC'}

        Returns:
            Dict: Coin summary
        """
        coin = params.get('coin')

        if not coin:
            return {
                'success': False,
                'error': 'Missing coin parameter'
            }

        summary = self.manager.get_coin_summary(coin)

        if not summary:
            return {
                'success': False,
                'error': f'Coin {coin} not found'
            }

        return {
            'success': True,
            'data': summary
        }

    async def get_all_summaries(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Get summaries for all coins

        Args:
            params: {'limit': 100}

        Returns:
            Dict: All summaries
        """
        limit = params.get('limit', monitor_config.MAX_COINS_DISPLAY)

        summaries = self.manager.get_all_summaries(limit=limit)

        return {
            'success': True,
            'data': {
                'count': len(summaries),
                'summaries': summaries
            }
        }

    async def get_alerts(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Get current trading alerts

        Returns:
            Dict: Active alerts
        """
        alerts = self.manager.check_all_alerts()

        return {
            'success': True,
            'data': {
                'count': len(alerts),
                'alerts': alerts
            }
        }

    async def get_config(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Get current configuration

        Returns:
            Dict: Configuration
        """
        config_data = monitor_config.get_all()

        return {
            'success': True,
            'data': config_data
        }

    async def update_config(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Update configuration

        Args:
            params: Configuration updates

        Returns:
            Dict: Success status
        """
        updates = params.get('updates', {})

        monitor_config.update(updates)

        return {
            'success': True,
            'data': {
                'updated': list(updates.keys())
            }
        }

    async def start_monitoring(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Start continuous monitoring

        Returns:
            Dict: Success status
        """
        self.manager.start_monitoring()

        return {
            'success': True,
            'data': {
                'status': 'started'
            }
        }

    async def stop_monitoring(self, params: Dict, request_id: str, context: Dict) -> Dict:
        """
        Stop continuous monitoring

        Returns:
            Dict: Success status
        """
        self.manager.stop_monitoring()

        return {
            'success': True,
            'data': {
                'status': 'stopped'
            }
        }


def register_monitor_routes(server):
    """
    Register all monitor API routes

    Args:
        server: FastAPIRPCServer instance
    """
    api = MonitorAPI()

    server.route("monitor.stats", api.get_stats, description="Get system statistics")
    server.route("monitor.coins_list", api.get_coins_list, description="Get all coins with record counts")
    server.route("monitor.coin_summary", api.get_coin_summary, description="Get specific coin summary")
    server.route("monitor.all_summaries", api.get_all_summaries, description="Get all coin summaries")
    server.route("monitor.alerts", api.get_alerts, description="Get trading alerts")
    server.route("monitor.config", api.get_config, description="Get configuration")
    server.route("monitor.update_config", api.update_config, description="Update configuration")
    server.route("monitor.start", api.start_monitoring, description="Start monitoring")
    server.route("monitor.stop", api.stop_monitoring, description="Stop monitoring")

    print("[API] Registered 9 monitor routes")

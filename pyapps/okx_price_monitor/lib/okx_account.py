#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Account API

Trading account endpoints that require authentication.
Reference: https://www.okx.com/docs-v5/en/#trading-account-rest-api
"""

from pyapps.okx_price_monitor.lib.okx_client import OKXClient


class OKXAccountAPI:
    """
    OKX Account API

    Provides access to trading account endpoints.
    """

    def __init__(self, client):
        self.client = client

    def get_balance(self, ccy=None):
        """
        Get account balance

        Args:
            ccy (str): Currency (optional, multiple currencies separated by comma)

        Returns:
            dict: API response with balance data
        """
        params = {}
        if ccy:
            params['ccy'] = ccy

        return self.client.get('/api/v5/account/balance', params=params, auth_required=True)

    def get_positions(self, inst_type=None, inst_id=None, pos_id=None):
        """
        Get positions

        Args:
            inst_type (str): Instrument type (MARGIN, SWAP, FUTURES, OPTION)
            inst_id (str): Instrument ID
            pos_id (str): Position ID

        Returns:
            dict: API response with position data
        """
        params = {}
        if inst_type:
            params['instType'] = inst_type
        if inst_id:
            params['instId'] = inst_id
        if pos_id:
            params['posId'] = pos_id

        return self.client.get('/api/v5/account/positions', params=params, auth_required=True)

    def get_account_config(self):
        """
        Get account configuration

        Returns:
            dict: API response with account config data
        """
        return self.client.get('/api/v5/account/config', auth_required=True)

    def get_max_size(self, inst_id, td_mode, ccy=None, px=None):
        """
        Get maximum buy/sell amount or open amount

        Args:
            inst_id (str): Instrument ID
            td_mode (str): Trade mode (cross, isolated, cash)
            ccy (str): Currency
            px (str): Price

        Returns:
            dict: API response with max size data
        """
        params = {
            'instId': inst_id,
            'tdMode': td_mode
        }
        if ccy:
            params['ccy'] = ccy
        if px:
            params['px'] = px

        return self.client.get('/api/v5/account/max-size', params=params, auth_required=True)

    def get_max_avail_size(self, inst_id, td_mode, ccy=None, reduce_only=False):
        """
        Get maximum available tradable amount

        Args:
            inst_id (str): Instrument ID
            td_mode (str): Trade mode (cross, isolated, cash)
            ccy (str): Currency
            reduce_only (bool): Whether to reduce position only

        Returns:
            dict: API response with max available size data
        """
        params = {
            'instId': inst_id,
            'tdMode': td_mode
        }
        if ccy:
            params['ccy'] = ccy
        if reduce_only:
            params['reduceOnly'] = 'true'

        return self.client.get('/api/v5/account/max-avail-size', params=params, auth_required=True)

    def get_leverage(self, inst_id, mgn_mode):
        """
        Get leverage

        Args:
            inst_id (str): Instrument ID
            mgn_mode (str): Margin mode (cross, isolated)

        Returns:
            dict: API response with leverage data
        """
        params = {
            'instId': inst_id,
            'mgnMode': mgn_mode
        }
        return self.client.get('/api/v5/account/leverage-info', params=params, auth_required=True)

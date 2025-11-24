#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Trade API

Order placement and management endpoints that require authentication.
Reference: https://www.okx.com/docs-v5/en/#order-book-trading-trade
"""

from pyapps.okx_price_monitor.lib.okx_client import OKXClient


class OKXTradeAPI:
    """
    OKX Trade API

    Provides access to order placement and management endpoints.
    """

    def __init__(self, client):
        self.client = client

    def place_order(self, inst_id, td_mode, side, ord_type, sz, ccy=None, cl_ord_id=None,
                   tag=None, pos_side=None, px=None, reduce_only=False):
        """
        Place order

        Args:
            inst_id (str): Instrument ID
            td_mode (str): Trade mode (cash, cross, isolated)
            side (str): Order side (buy, sell)
            ord_type (str): Order type (market, limit, post_only, fok, ioc)
            sz (str): Quantity to buy or sell
            ccy (str): Currency for margin
            cl_ord_id (str): Client order ID
            tag (str): Order tag
            pos_side (str): Position side (long, short, net)
            px (str): Order price (required for limit orders)
            reduce_only (bool): Whether to reduce position only

        Returns:
            dict: API response with order data
        """
        data = {
            'instId': inst_id,
            'tdMode': td_mode,
            'side': side,
            'ordType': ord_type,
            'sz': sz
        }

        if ccy:
            data['ccy'] = ccy
        if cl_ord_id:
            data['clOrdId'] = cl_ord_id
        if tag:
            data['tag'] = tag
        if pos_side:
            data['posSide'] = pos_side
        if px:
            data['px'] = px
        if reduce_only:
            data['reduceOnly'] = 'true'

        return self.client.post('/api/v5/trade/order', data=data, auth_required=True)

    def cancel_order(self, inst_id, ord_id=None, cl_ord_id=None):
        """
        Cancel order

        Args:
            inst_id (str): Instrument ID
            ord_id (str): Order ID
            cl_ord_id (str): Client order ID

        Returns:
            dict: API response
        """
        data = {'instId': inst_id}

        if ord_id:
            data['ordId'] = ord_id
        if cl_ord_id:
            data['clOrdId'] = cl_ord_id

        return self.client.post('/api/v5/trade/cancel-order', data=data, auth_required=True)

    def get_order(self, inst_id, ord_id=None, cl_ord_id=None):
        """
        Get order details

        Args:
            inst_id (str): Instrument ID
            ord_id (str): Order ID
            cl_ord_id (str): Client order ID

        Returns:
            dict: API response with order details
        """
        params = {'instId': inst_id}

        if ord_id:
            params['ordId'] = ord_id
        if cl_ord_id:
            params['clOrdId'] = cl_ord_id

        return self.client.get('/api/v5/trade/order', params=params, auth_required=True)

    def get_pending_orders(self, inst_type=None, uly=None, inst_id=None, ord_type=None, state=None):
        """
        Get pending orders

        Args:
            inst_type (str): Instrument type
            uly (str): Underlying
            inst_id (str): Instrument ID
            ord_type (str): Order type
            state (str): Order state (live, partially_filled)

        Returns:
            dict: API response with pending orders
        """
        params = {}
        if inst_type:
            params['instType'] = inst_type
        if uly:
            params['uly'] = uly
        if inst_id:
            params['instId'] = inst_id
        if ord_type:
            params['ordType'] = ord_type
        if state:
            params['state'] = state

        return self.client.get('/api/v5/trade/orders-pending', params=params, auth_required=True)

    def get_order_history(self, inst_type, uly=None, inst_id=None, ord_type=None,
                         state=None, after=None, before=None, limit='100'):
        """
        Get order history (last 7 days)

        Args:
            inst_type (str): Instrument type
            uly (str): Underlying
            inst_id (str): Instrument ID
            ord_type (str): Order type
            state (str): Order state (canceled, filled)
            after (str): Pagination
            before (str): Pagination
            limit (str): Number of results

        Returns:
            dict: API response with order history
        """
        params = {
            'instType': inst_type,
            'limit': limit
        }

        if uly:
            params['uly'] = uly
        if inst_id:
            params['instId'] = inst_id
        if ord_type:
            params['ordType'] = ord_type
        if state:
            params['state'] = state
        if after:
            params['after'] = after
        if before:
            params['before'] = before

        return self.client.get('/api/v5/trade/orders-history', params=params, auth_required=True)

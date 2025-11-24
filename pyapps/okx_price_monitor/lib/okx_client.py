#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX API Client

Base client for making requests to OKX API endpoints.
"""

import json
from pycore.pyfoundations.third_party import get_third_package_requests

requests = None


class OKXClient:
    """
    Base OKX API Client

    Provides low-level HTTP request capabilities for OKX API.
    """

    BASE_URL_PRODUCTION = 'https://www.okx.com'
    BASE_URL_AWS = 'https://aws.okx.com'

    def __init__(self, auth=None, base_url=None, timeout=30):
        global requests
        if requests is None:
            requests = get_third_package_requests()

        self.auth = auth
        self.base_url = base_url or self.BASE_URL_PRODUCTION
        self.timeout = timeout

    def _request(self, method, endpoint, params=None, data=None, auth_required=True):
        """
        Make HTTP request to OKX API

        Args:
            method (str): HTTP method (GET, POST, etc.)
            endpoint (str): API endpoint path (e.g., '/api/v5/market/tickers')
            params (dict): Query parameters for GET requests
            data (dict): Request body for POST requests
            auth_required (bool): Whether authentication headers are required

        Returns:
            dict: API response data
        """
        url = self.base_url + endpoint

        headers = {}
        body = ''

        if auth_required and self.auth:
            if data:
                body = json.dumps(data)

            request_path = endpoint
            if params:
                query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
                request_path = f"{endpoint}?{query_string}"

            headers = self.auth.get_headers(method.upper(), request_path, body)

        response = requests.request(
            method=method,
            url=url,
            params=params,
            data=body if body else None,
            headers=headers,
            timeout=self.timeout
        )

        response.raise_for_status()
        return response.json()

    def get(self, endpoint, params=None, auth_required=True):
        """
        Make GET request

        Args:
            endpoint (str): API endpoint path
            params (dict): Query parameters
            auth_required (bool): Whether authentication is required

        Returns:
            dict: API response data
        """
        return self._request('GET', endpoint, params=params, auth_required=auth_required)

    def post(self, endpoint, data=None, auth_required=True):
        """
        Make POST request

        Args:
            endpoint (str): API endpoint path
            data (dict): Request body data
            auth_required (bool): Whether authentication is required

        Returns:
            dict: API response data
        """
        return self._request('POST', endpoint, data=data, auth_required=auth_required)

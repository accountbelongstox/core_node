#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Authentication and Request Signing

Implements OKX API authentication according to:
https://www.okx.com/docs-v5/en/#overview-rest-authentication
"""

import hmac
import base64
import hashlib
from datetime import datetime, timezone


class OKXAuth:
    """
    OKX API Authentication Handler

    Handles API key management and request signing for OKX API calls.
    """

    def __init__(self, api_key, secret_key, passphrase):
        self.api_key = api_key
        self.secret_key = secret_key
        self.passphrase = passphrase

    def get_timestamp(self):
        """
        Get current UTC timestamp in ISO 8601 format

        Returns:
            str: Timestamp like '2020-12-08T09:08:57.715Z'
        """
        now = datetime.now(timezone.utc)
        timestamp = now.isoformat(timespec='milliseconds')
        timestamp = timestamp.replace('+00:00', 'Z')
        return timestamp

    def sign(self, timestamp, method, request_path, body=''):
        """
        Create signature for OKX API request

        The signature is created by:
        1. Concatenate timestamp + method + requestPath + body
        2. Encrypt with secret_key using HMAC SHA256
        3. Base64 encode the result

        Args:
            timestamp (str): UTC timestamp in ISO format
            method (str): HTTP method (GET, POST, etc.)
            request_path (str): Request path including query string
            body (str): Request body (empty string for GET requests)

        Returns:
            str: Base64-encoded signature
        """
        message = timestamp + method + request_path + body
        mac = hmac.new(
            self.secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        )
        signature = base64.b64encode(mac.digest()).decode('utf-8')
        return signature

    def get_headers(self, method, request_path, body=''):
        """
        Generate all required authentication headers for OKX API

        Args:
            method (str): HTTP method (GET, POST, etc.)
            request_path (str): Request path including query string
            body (str): Request body (empty string for GET requests)

        Returns:
            dict: Headers dictionary with all required authentication headers
        """
        timestamp = self.get_timestamp()
        signature = self.sign(timestamp, method, request_path, body)

        headers = {
            'OK-ACCESS-KEY': self.api_key,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': self.passphrase,
            'Content-Type': 'application/json'
        }

        return headers

# -*- coding: utf-8 -*-
"""
Authentication Manager
Handles authentication and authorization for WebSocket connections
"""

import hmac
import hashlib
import secrets
import time
import json
import base64
from typing import Dict, Optional, Callable, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.gvar.ws_rpc_constants import WS_RPC_CONSTANTS

ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES


class AuthManager:
    """Manages authentication and authorization"""

    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize authentication manager

        Args:
            options: Configuration options
        """
        options = options or {}
        self.enabled = options.get('enabled', True)
        self.secret = options.get('secret', self._generate_secret())
        self.token_expiry = options.get('token_expiry', 3600000)  # 1 hour in ms
        self.auth_handler: Optional[Callable] = options.get('auth_handler')

        self.tokens: Dict[str, str] = {}
        self.client_auth: Dict[str, Dict] = {}
        self.permissions: Dict[str, List[str]] = {}

    async def authenticate(self, client_id: str, credentials: Dict) -> Dict:
        """
        Authenticate a client

        Args:
            client_id: Unique client identifier
            credentials: Authentication credentials

        Returns:
            Authentication result
        """
        if not self.enabled:
            return {'success': True, 'token': None}

        try:
            is_valid = False
            user_data = None

            if self.auth_handler:
                result = await self.auth_handler(credentials)
                is_valid = result.get('success', False)
                user_data = result.get('user')
            else:
                is_valid = self._default_auth(credentials)
                user_data = credentials

            if not is_valid:
                ColorPrint.yellow(f"Authentication failed for client {client_id}")
                return {
                    'success': False,
                    'error': ERROR_CODES['UNAUTHORIZED'],
                    'message': 'Invalid credentials'
                }

            token = self._generate_token(client_id, user_data)
            self.client_auth[client_id] = {
                'token': token,
                'user': user_data,
                'authenticated_at': time.time(),
                'expires_at': time.time() + (self.token_expiry / 1000)
            }

            self.tokens[token] = client_id

            ColorPrint.green(f"Client {client_id} authenticated successfully")

            return {
                'success': True,
                'token': token,
                'expires_in': self.token_expiry
            }

        except Exception as error:
            ColorPrint.red(f"Authentication error for client {client_id}: {error}")
            return {
                'success': False,
                'error': ERROR_CODES['INTERNAL_ERROR'],
                'message': str(error)
            }

    def verify_token(self, token: str) -> Dict:
        """
        Verify authentication token

        Args:
            token: Authentication token

        Returns:
            Verification result
        """
        client_id = self.tokens.get(token)
        if not client_id:
            return {'valid': False, 'error': ERROR_CODES['UNAUTHORIZED']}

        auth_data = self.client_auth.get(client_id)
        if not auth_data:
            self.tokens.pop(token, None)
            return {'valid': False, 'error': ERROR_CODES['UNAUTHORIZED']}

        if time.time() > auth_data['expires_at']:
            self.revoke(client_id)
            return {'valid': False, 'error': ERROR_CODES['UNAUTHORIZED']}

        return {
            'valid': True,
            'client_id': client_id,
            'user': auth_data['user']
        }

    def is_authenticated(self, client_id: str) -> bool:
        """
        Check if client is authenticated

        Args:
            client_id: Unique client identifier

        Returns:
            True if authenticated
        """
        if not self.enabled:
            return True

        auth_data = self.client_auth.get(client_id)
        if not auth_data:
            return False

        if time.time() > auth_data['expires_at']:
            self.revoke(client_id)
            return False

        return True

    def has_permission(self, client_id: str, permission: str) -> bool:
        """
        Check if client has permission

        Args:
            client_id: Unique client identifier
            permission: Permission to check

        Returns:
            True if has permission
        """
        if not self.enabled:
            return True

        auth_data = self.client_auth.get(client_id)
        if not auth_data:
            return False

        client_permissions = self.permissions.get(client_id, [])
        return permission in client_permissions or '*' in client_permissions

    def set_permissions(self, client_id: str, permissions: List[str]):
        """
        Set permissions for client

        Args:
            client_id: Unique client identifier
            permissions: List of permissions
        """
        self.permissions[client_id] = permissions
        ColorPrint.debug(f"Permissions set for client {client_id}: {permissions}")

    def revoke(self, client_id: str):
        """
        Revoke authentication for client

        Args:
            client_id: Unique client identifier
        """
        auth_data = self.client_auth.get(client_id)
        if auth_data:
            self.tokens.pop(auth_data['token'], None)
            self.client_auth.pop(client_id, None)
            self.permissions.pop(client_id, None)
            ColorPrint.green(f"Authentication revoked for client {client_id}")

    def refresh_token(self, client_id: str) -> Optional[str]:
        """
        Refresh authentication token

        Args:
            client_id: Unique client identifier

        Returns:
            New token or None
        """
        auth_data = self.client_auth.get(client_id)
        if not auth_data:
            return None

        self.tokens.pop(auth_data['token'], None)
        new_token = self._generate_token(client_id, auth_data['user'])

        auth_data['token'] = new_token
        auth_data['expires_at'] = time.time() + (self.token_expiry / 1000)

        self.client_auth[client_id] = auth_data
        self.tokens[new_token] = client_id

        ColorPrint.debug(f"Token refreshed for client {client_id}")
        return new_token

    def get_auth_data(self, client_id: str) -> Optional[Dict]:
        """
        Get authentication data for client

        Args:
            client_id: Unique client identifier

        Returns:
            Authentication data or None
        """
        return self.client_auth.get(client_id)

    def _generate_token(self, client_id: str, user_data: Dict) -> str:
        """Generate authentication token"""
        payload = {
            'client_id': client_id,
            'user': user_data,
            'timestamp': time.time()
        }

        data_str = json.dumps(payload)
        signature = hmac.new(
            self.secret.encode(),
            data_str.encode(),
            hashlib.sha256
        ).hexdigest()

        token_data = f"{base64.b64encode(data_str.encode()).decode()}.{signature}"
        return token_data

    def _generate_secret(self) -> str:
        """Generate random secret"""
        return secrets.token_hex(32)

    def _default_auth(self, credentials: Dict) -> bool:
        """Default authentication logic"""
        return credentials and credentials.get('username') and credentials.get('password')

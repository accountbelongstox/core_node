#!/usr/bin/env python3
"""
Local Test Credentials Helper

Provides quick access to local test credentials for development and testing.
"""

from typing import Dict, Optional
from pathlib import Path

from utils.secret_manager import resolve_secret_value
from utils.common_utils import ColorMessage
from config.path_config import get_path_config


class LocalTestHelper:
    """Helper class for accessing local test credentials"""

    def __init__(self, file_number: int = 1):
        """
        Initialize LocalTestHelper

        Args:
            file_number: File number for the credentials set (default: 1)
        """
        self.file_number = file_number
        self.path_config = get_path_config()

    def get_password(self) -> Optional[str]:
        """Get local test password"""
        return resolve_secret_value(f'LOCAL_TEST_PASSWORD_{self.file_number}')

    def get_api_key(self) -> Optional[str]:
        """Get local test API key"""
        return resolve_secret_value(f'LOCAL_TEST_API_KEY_{self.file_number}')

    def get_secret_key(self) -> Optional[str]:
        """Get local test secret key"""
        return resolve_secret_value(f'LOCAL_TEST_SECRET_KEY_{self.file_number}')

    def get_encryption_key(self) -> Optional[str]:
        """Get local test encryption key"""
        return resolve_secret_value(f'LOCAL_TEST_ENCRYPTION_KEY_{self.file_number}')

    def get_jwt_secret(self) -> Optional[str]:
        """Get local test JWT secret"""
        return resolve_secret_value(f'LOCAL_TEST_JWT_SECRET_{self.file_number}')

    def get_db_password(self) -> Optional[str]:
        """Get local test database password"""
        return resolve_secret_value(f'LOCAL_TEST_DB_PASSWORD_{self.file_number}')

    def get_all_credentials(self) -> Dict[str, Optional[str]]:
        """
        Get all local test credentials

        Returns:
            Dictionary with all credential values
        """
        return {
            'password': self.get_password(),
            'api_key': self.get_api_key(),
            'secret_key': self.get_secret_key(),
            'encryption_key': self.get_encryption_key(),
            'jwt_secret': self.get_jwt_secret(),
            'db_password': self.get_db_password()
        }

    def print_credentials_status(self):
        """Print status of all credentials"""
        credentials = self.get_all_credentials()

        ColorMessage.write(f"\nLocal Test Credentials (Set #{self.file_number}):", 'info')
        ColorMessage.write("=" * 60, 'info')

        for key, value in credentials.items():
            display_name = key.replace('_', ' ').title()
            if value:
                ColorMessage.write(f"{display_name:25} {value} [SET]", 'success')
            else:
                ColorMessage.write(f"{display_name:25} {'[NOT SET]':20}", 'warning')

        print()

    def verify_required_credentials(self) -> bool:
        """
        Verify that all required credentials are set

        Returns:
            True if all required credentials are available, False otherwise
        """
        required = {
            'Password': self.get_password(),
            'API Key': self.get_api_key(),
            'Secret Key': self.get_secret_key()
        }

        missing = [name for name, value in required.items() if not value]

        if missing:
            ColorMessage.write("Missing required credentials:", 'error')
            for name in missing:
                ColorMessage.write(f"  - {name}", 'error')
            return False

        ColorMessage.write("All required credentials are available.", 'success')
        return True


def get_local_test_credentials(file_number: int = 1) -> Dict[str, Optional[str]]:
    """
    Quick function to get all local test credentials

    Args:
        file_number: File number for the credentials set (default: 1)

    Returns:
        Dictionary with all credential values
    """
    helper = LocalTestHelper(file_number)
    return helper.get_all_credentials()


def print_local_test_status(file_number: int = 1):
    """
    Quick function to print local test credentials status

    Args:
        file_number: File number for the credentials set (default: 1)
    """
    helper = LocalTestHelper(file_number)
    helper.print_credentials_status()


__all__ = [
    'LocalTestHelper',
    'get_local_test_credentials',
    'print_local_test_status'
]

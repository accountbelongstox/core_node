#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Domain Context

Manages URL validation, normalization, and scope checking for document offline downloads.
"""

from urllib.parse import urlparse, urljoin, urlunparse
from typing import Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class DomainContext:
    """
    Domain context for URL validation and scope management

    Provides URL normalization, same-origin checking, and path scope validation.
    """

    def __init__(self, base_url: str, scope_mode: str = 'full', scope_path: Optional[str] = None):
        """
        Initialize domain context

        Args:
            base_url: Base URL for the domain (e.g., 'https://example.com/docs/')
            scope_mode: Scope mode ('full' or 'path')
            scope_path: Scope path for 'path' mode (e.g., '/docs/')
        """
        self.base_url = base_url
        self.scope_mode = scope_mode
        self.scope_path = scope_path

        # Parse base URL
        parsed = urlparse(base_url)
        if not parsed.scheme or not parsed.netloc:
            ColorPrint.red(f'[DomainContext] Invalid base URL: {base_url}')
            self.origin = None
            self.is_valid = False
            return

        self.scheme = parsed.scheme
        self.netloc = parsed.netloc
        self.origin = f'{parsed.scheme}://{parsed.netloc}'
        self.base_path = parsed.path
        self.is_valid = True

        # Determine scope path
        if scope_mode == 'path':
            if scope_path:
                self.scope_path = scope_path
            else:
                # Use base URL path as scope
                self.scope_path = self.base_path.rstrip('/') + '/'
        else:
            self.scope_path = '/'

        ColorPrint.green(f'[DomainContext] Initialized: {self.origin}, scope={scope_mode}, path={self.scope_path}')

    def canonicalize(self, url: str) -> str:
        """
        Canonicalize URL (normalize)

        - Remove fragments (#section)
        - Remove trailing slashes from paths (except root)
        - Lowercase scheme and netloc
        - Keep query parameters

        Args:
            url: URL to canonicalize

        Returns:
            Canonicalized URL
        """
        parsed = urlparse(url)

        # Lowercase scheme and netloc
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Remove trailing slash from path (except root)
        path = parsed.path
        if path != '/' and path.endswith('/'):
            path = path.rstrip('/')

        # Reconstruct URL without fragment
        canonical = urlunparse((
            scheme,
            netloc,
            path,
            parsed.params,
            parsed.query,
            ''  # Remove fragment
        ))

        return canonical

    def is_internal_link(self, url: str) -> bool:
        """
        Check if URL is same-origin (internal link)

        Args:
            url: URL to check

        Returns:
            True if URL is same-origin
        """
        if not self.is_valid:
            return False

        parsed = urlparse(url)

        # Must have scheme and netloc
        if not parsed.scheme or not parsed.netloc:
            return False

        # Check same origin
        url_origin = f'{parsed.scheme}://{parsed.netloc}'
        return url_origin == self.origin

    def is_within_scope(self, url: str) -> bool:
        """
        Check if URL is within scope

        Args:
            url: URL to check

        Returns:
            True if URL is within scope
        """
        if not self.is_valid:
            return False

        # Must be same-origin first
        if not self.is_internal_link(url):
            return False

        # If scope is 'full', all same-origin URLs are in scope
        if self.scope_mode == 'full':
            return True

        # For 'path' mode, check if URL path starts with scope_path
        parsed = urlparse(url)
        url_path = parsed.path

        return url_path.startswith(self.scope_path)

    def resolve_href(self, base: str, href: str) -> str:
        """
        Resolve relative URL to absolute URL

        Args:
            base: Base URL
            href: Relative or absolute href

        Returns:
            Absolute URL
        """
        # urljoin handles both relative and absolute URLs
        absolute = urljoin(base, href)
        return absolute

    def get_origin(self) -> Optional[str]:
        """
        Get origin (scheme + netloc)

        Returns:
            Origin string or None if invalid
        """
        return self.origin if self.is_valid else None

    def get_scope_url(self) -> Optional[str]:
        """
        Get scope root URL

        Returns:
            Scope root URL or None if invalid
        """
        if not self.is_valid:
            return None

        return f'{self.origin}{self.scope_path}'

    def get_base_url(self) -> str:
        """Get base URL"""
        return self.base_url

    def get_info(self) -> dict:
        """
        Get domain context information

        Returns:
            Dictionary with context info
        """
        return {
            'base_url': self.base_url,
            'origin': self.origin,
            'scope_mode': self.scope_mode,
            'scope_path': self.scope_path,
            'scope_url': self.get_scope_url(),
            'is_valid': self.is_valid
        }

    def cleanup(self):
        """
        Cleanup domain context resources

        Note: DomainContext is stateless and doesn't own resources.
        This method is provided for consistency with other controller classes.
        """
        ColorPrint.blue('[DomainContext] Cleanup complete (stateless, no resources to release)')


__all__ = ['DomainContext']

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Domain Context

Manages domain-specific URL validation and canonicalization
"""

from urllib.parse import urlparse, urlunparse, urljoin, parse_qs, urlencode
from pathlib import Path
from typing import Optional, Dict, Any


class DomainContext:
    """
    Manages domain context for URL validation and scope checking

    Features:
    - URL canonicalization (remove hash, sort query params)
    - Domain validation (same origin check)
    - Scope path validation (restrict to specific path)
    - Internal link detection
    """

    def __init__(self, raw_url: str):
        """
        Initialize domain context

        Args:
            raw_url: Target URL to set as domain context
        """
        if not raw_url:
            raise ValueError('DomainContext requires a target URL')

        self.main_url = urlparse(raw_url)
        self.origin = f"{self.main_url.scheme}://{self.main_url.netloc}"
        self.domain_key = self.normalize_domain(self.main_url.netloc)
        self.scope_path = self.compute_scope_path(self.main_url.path)
        self.scope_url = self.compose_scope_url()
        self.start_url = self.canonicalize(raw_url) or raw_url

    def compute_scope_path(self, pathname: str) -> str:
        """
        Compute scope path from pathname

        Args:
            pathname: URL pathname

        Returns:
            Normalized scope path
        """
        sanitized_path = pathname or '/'
        sanitized_path = sanitized_path.replace('//', '/')

        if not sanitized_path or sanitized_path == '/':
            return '/'

        if sanitized_path.endswith('/'):
            sanitized_path = sanitized_path.rstrip('/')
            if not sanitized_path:
                return '/'

        directory = str(Path(sanitized_path).parent)
        if not directory or directory in ('.', ''):
            return '/'

        return directory if directory.startswith('/') else f'/{directory}'

    def compose_scope_url(self) -> str:
        """
        Compose scope URL from origin and scope path

        Returns:
            Full scope URL
        """
        if not self.scope_path or self.scope_path == '/':
            return self.origin
        return f"{self.origin}{self.scope_path}"

    def normalize_domain(self, hostname: str) -> str:
        """
        Normalize domain name (remove www, lowercase)

        Args:
            hostname: Domain hostname

        Returns:
            Normalized domain
        """
        if not hostname:
            return ''

        # Remove www prefix
        if hostname.lower().startswith('www.'):
            hostname = hostname[4:]

        return hostname.lower()

    def resolve_href(self, base_url: str, href: str) -> Optional[Dict[str, Any]]:
        """
        Resolve relative href to absolute URL

        Args:
            base_url: Base URL for resolution
            href: Href to resolve

        Returns:
            Dict with url and canonical, or None if invalid
        """
        # Skip invalid protocols
        if not href or any(href.startswith(proto) for proto in ['javascript:', 'mailto:', 'tel:', 'data:', 'blob:']):
            return None

        try:
            resolved = urljoin(base_url, href)
            parsed = urlparse(resolved)

            if not parsed.scheme.startswith('http'):
                return None

            return {
                'url': parsed,
                'canonical': self.canonicalize(resolved)
            }
        except Exception:
            return None

    def canonicalize(self, candidate_url: str) -> Optional[str]:
        """
        Canonicalize URL (remove hash, sort query params)

        Args:
            candidate_url: URL to canonicalize

        Returns:
            Canonical URL or None if invalid
        """
        try:
            parsed = urlparse(candidate_url)

            # Remove hash
            parsed = parsed._replace(fragment='')

            # Normalize pathname
            pathname = parsed.path.replace('//', '/')
            if not pathname:
                pathname = '/'
            parsed = parsed._replace(path=pathname)

            # Sort query parameters
            if parsed.query:
                params = parse_qs(parsed.query, keep_blank_values=True)
                sorted_params = sorted(params.items())
                query = urlencode(sorted_params, doseq=True)
                parsed = parsed._replace(query=query)

            return urlunparse(parsed)
        except Exception:
            return None

    def is_internal_link(self, candidate_url: str) -> bool:
        """
        Check if URL is internal link (same domain and within scope)

        Args:
            candidate_url: URL to check

        Returns:
            True if internal link
        """
        if not candidate_url:
            return False

        try:
            parsed = urlparse(candidate_url)
            same_domain = self.normalize_domain(parsed.netloc) == self.domain_key

            if not same_domain:
                return False

            return self.is_within_scope(candidate_url)
        except Exception:
            return False

    def is_within_scope(self, candidate_url: str) -> bool:
        """
        Check if URL is within scope path

        Args:
            candidate_url: URL to check

        Returns:
            True if within scope
        """
        if not candidate_url:
            return False

        try:
            parsed = urlparse(candidate_url)

            if self.scope_path == '/':
                return True

            candidate_path = parsed.path or '/'
            candidate_path = candidate_path.replace('//', '/')

            if not candidate_path.startswith(self.scope_path):
                return False

            if candidate_path == self.scope_path:
                return True

            if candidate_path.startswith(self.scope_path + '/'):
                return True

            return False
        except Exception:
            return False

    def get_origin(self) -> str:
        """Get origin URL"""
        return self.origin

    def get_validation_domain(self) -> str:
        """Get validation domain key"""
        return self.domain_key

    def get_scope_url(self) -> str:
        """Get scope URL"""
        return self.scope_url

    def get_scope_path(self) -> str:
        """Get scope path"""
        return self.scope_path

    def get_start_url(self) -> str:
        """Get start URL"""
        return self.start_url

    def get_storage_root(self) -> str:
        """Get storage root (same as origin)"""
        return self.origin

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ResourceInterceptor

Intercepts and tracks network resources
"""

import hashlib
from typing import Dict, Any, List
from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint


class ResourceInterceptor:
    def __init__(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        self.page = page
        self.enabled = False
        self.intercepted_resources = {}
        self.resource_types = options.get('resourceTypes', ['image', 'stylesheet', 'font', 'media'])
        self.include_failed_requests = options.get('includeFailedRequests', True)
        self.compute_hash = options.get('computeHash', True)

        self.stats = {
            'totalRequests': 0,
            'interceptedRequests': 0,
            'failedRequests': 0,
            'byType': {}
        }

        self.network_requests = []
        self.network_responses = []

    async def enable(self):
        if self.enabled:
            ColorPrint.yellow('[ResourceInterceptor] Already enabled')
            return

        try:
            if hasattr(self.page.driver, 'execute_cdp_cmd'):
                self.page.driver.execute_cdp_cmd('Network.enable', {})

            self.enabled = True
            ColorPrint.green('[ResourceInterceptor] Resource interception enabled')
        except Exception as error:
            ColorPrint.red(f'[ResourceInterceptor] Failed to enable: {error}')

    async def disable(self):
        if not self.enabled:
            return

        try:
            if hasattr(self.page.driver, 'execute_cdp_cmd'):
                self.page.driver.execute_cdp_cmd('Network.disable', {})

            self.enabled = False
            ColorPrint.green('[ResourceInterceptor] Resource interception disabled')
        except Exception as error:
            ColorPrint.red(f'[ResourceInterceptor] Failed to disable: {error}')

    def handle_request(self, request: Dict[str, Any]):
        self.stats['totalRequests'] += 1
        self.network_requests.append(request)

    async def handle_response(self, response: Dict[str, Any]):
        url = response.get('url', '')
        resource_type = response.get('type', 'other')
        status = response.get('status', 0)

        if resource_type not in self.resource_types:
            return

        if status < 200 or status >= 400:
            return

        try:
            self.stats['interceptedRequests'] += 1
            self.stats['byType'][resource_type] = self.stats['byType'].get(resource_type, 0) + 1

            headers = response.get('headers', {})
            content_type = headers.get('content-type', '')
            content_length = int(headers.get('content-length', 0))

            resource_info = {
                'url': url,
                'resourceType': resource_type,
                'status': status,
                'contentType': content_type,
                'contentLength': content_length,
                'timestamp': datetime.now().isoformat(),
                'method': response.get('method', 'GET'),
                'headers': headers
            }

            if self.compute_hash and content_length > 0 and content_length < 10 * 1024 * 1024:
                try:
                    body = response.get('body')
                    if body:
                        resource_info['hash'] = hashlib.md5(body).hexdigest()
                        resource_info['actualSize'] = len(body)
                except Exception as error:
                    ColorPrint.debug(f'[ResourceInterceptor] Could not compute hash for {url}: {error}')

            self.intercepted_resources[url] = resource_info
            self.network_responses.append(resource_info)
            ColorPrint.debug(f'[ResourceInterceptor] Intercepted {resource_type}: {url}')

        except Exception as error:
            ColorPrint.yellow(f'[ResourceInterceptor] Failed to process response: {url}, {error}')

    def handle_request_failed(self, request: Dict[str, Any]):
        if not self.include_failed_requests:
            return

        url = request.get('url', '')
        resource_type = request.get('type', 'other')

        if resource_type not in self.resource_types:
            return

        self.stats['failedRequests'] += 1

        resource_info = {
            'url': url,
            'resourceType': resource_type,
            'status': 0,
            'failed': True,
            'failureText': request.get('errorText', 'Unknown error'),
            'timestamp': datetime.now().isoformat()
        }

        self.intercepted_resources[url] = resource_info
        ColorPrint.yellow(f'[ResourceInterceptor] Failed request: {url} ({resource_info["failureText"]})')

    def get_intercepted_resources(self, resource_type: str = None):
        if not resource_type:
            return list(self.intercepted_resources.values())

        return [r for r in self.intercepted_resources.values() if r.get('resourceType') == resource_type]

    def get_resource_by_url(self, url: str):
        return self.intercepted_resources.get(url)

    def get_stats(self):
        return {
            **self.stats,
            'totalIntercepted': len(self.intercepted_resources),
            'resourceTypes': list(self.stats['byType'].keys())
        }

    def clear(self):
        self.intercepted_resources.clear()
        self.network_requests.clear()
        self.network_responses.clear()
        self.stats = {
            'totalRequests': 0,
            'interceptedRequests': 0,
            'failedRequests': 0,
            'byType': {}
        }
        ColorPrint.green('[ResourceInterceptor] Cleared all intercepted resources')

    def has_resource(self, url: str):
        return url in self.intercepted_resources

    def normalize_url(self, url: str):
        try:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url)
            return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, ''))
        except Exception:
            return url

    def match_resource(self, dom_url: str):
        normalized_dom_url = self.normalize_url(dom_url)

        if normalized_dom_url in self.intercepted_resources:
            return self.intercepted_resources[normalized_dom_url]

        if dom_url in self.intercepted_resources:
            return self.intercepted_resources[dom_url]

        return None

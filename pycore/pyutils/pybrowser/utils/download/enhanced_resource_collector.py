#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EnhancedResourceCollector

Combines ResourceInterceptor and DomResourceMapper to collect page resources
"""

import time
from typing import Dict, Any, List

from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyutils.pybrowser.utils.download.resource_interceptor import ResourceInterceptor
from pycore.pyutils.pybrowser.utils.download.dom_resource_mapper import DomResourceMapper


class EnhancedResourceCollector:
    def __init__(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        self.page = page
        self.interceptor = ResourceInterceptor(page, {
            'resourceTypes': options.get('resourceTypes', ['image', 'stylesheet', 'font', 'media']),
            'includeFailedRequests': options.get('includeFailedRequests', True),
            'computeHash': options.get('computeHash', True)
        })
        self.mapper = DomResourceMapper(page)
        self.enabled = False
        self.matched_resources = []

    async def enable(self):
        if self.enabled:
            ColorPrint.yellow('[EnhancedResourceCollector] Already enabled')
            return

        await self.interceptor.enable()
        self.enabled = True
        ColorPrint.green('[EnhancedResourceCollector] Resource collection enabled')

    async def disable(self):
        if not self.enabled:
            return

        await self.interceptor.disable()
        self.enabled = False
        ColorPrint.green('[EnhancedResourceCollector] Resource collection disabled')

    async def collect_resources(self, options: Dict[str, Any] = None):
        options = options or {}
        ColorPrint.green('[EnhancedResourceCollector] Starting resource collection...')

        wait_for_network = options.get('waitForNetwork', True)
        wait_time = options.get('waitTime', 2000) / 1000

        if wait_for_network:
            ColorPrint.green(f'[EnhancedResourceCollector] Waiting {wait_time}s for network idle...')
            time.sleep(wait_time)

        dom_resources = await self.mapper.extract_dom_resources({
            'includeIframes': options.get('includeIframes', True),
            'includeDataUrls': options.get('includeDataUrls', False)
        })

        ColorPrint.green(f'[EnhancedResourceCollector] DOM extraction complete: {len(dom_resources)} resources found')

        self.matched_resources = self.match_resources_with_interception(dom_resources)

        ColorPrint.green(f'[EnhancedResourceCollector] Resource collection complete: {len(self.matched_resources)} resources matched')

        return self.get_collection_result()

    def match_resources_with_interception(self, dom_resources: List[Dict[str, Any]]):
        matched = []
        intercepted_resources = self.interceptor.get_intercepted_resources()

        ColorPrint.green(f'[EnhancedResourceCollector] Matching {len(dom_resources)} DOM resources with {len(intercepted_resources)} intercepted resources...')

        for dom_resource in dom_resources:
            intercepted_data = self.interceptor.match_resource(dom_resource['url'])

            matched.append({
                'xpath': dom_resource['xpath'],
                'url': dom_resource['url'],
                'tagName': dom_resource['tagName'],
                'sourceType': dom_resource['sourceType'],
                'frame': dom_resource['frame'],
                'attributes': dom_resource['attributes'],
                'intercepted': {
                    'status': intercepted_data.get('status'),
                    'contentType': intercepted_data.get('contentType'),
                    'contentLength': intercepted_data.get('contentLength'),
                    'actualSize': intercepted_data.get('actualSize'),
                    'hash': intercepted_data.get('hash'),
                    'timestamp': intercepted_data.get('timestamp'),
                    'failed': intercepted_data.get('failed'),
                    'failureText': intercepted_data.get('failureText')
                } if intercepted_data else None,
                'matched': intercepted_data is not None
            })

        matched_count = len([r for r in matched if r['matched']])
        unmatched_count = len(matched) - matched_count

        ColorPrint.green(f'[EnhancedResourceCollector] Matched: {matched_count}, Unmatched: {unmatched_count}')

        return matched

    def get_collection_result(self):
        by_source_type = {}
        by_tag_name = {}
        by_frame = {}

        for resource in self.matched_resources:
            source_type = resource['sourceType']
            tag_name = resource['tagName']
            frame = resource['frame']

            by_source_type[source_type] = by_source_type.get(source_type, 0) + 1
            by_tag_name[tag_name] = by_tag_name.get(tag_name, 0) + 1
            by_frame[frame] = by_frame.get(frame, 0) + 1

        result = {
            'resources': self.matched_resources,
            'stats': {
                'total': len(self.matched_resources),
                'matched': len([r for r in self.matched_resources if r['matched']]),
                'unmatched': len([r for r in self.matched_resources if not r['matched']]),
                'bySourceType': by_source_type,
                'byTagName': by_tag_name,
                'byFrame': by_frame,
                'interceptorStats': self.interceptor.get_stats(),
                'mapperStats': self.mapper.get_stats()
            }
        }

        return result

    def get_matched_resources(self):
        return [r for r in self.matched_resources if r['matched']]

    def get_unmatched_resources(self):
        return [r for r in self.matched_resources if not r['matched']]

    def get_resources_by_type(self, source_type: str):
        return [r for r in self.matched_resources if r['sourceType'] == source_type]

    def get_resources_by_tag(self, tag_name: str):
        return [r for r in self.matched_resources if r['tagName'] == tag_name.lower()]

    def get_resources_by_frame(self, frame_path: str):
        return [r for r in self.matched_resources if r['frame'] == frame_path]

    def find_resource_by_xpath(self, xpath: str):
        for r in self.matched_resources:
            if r['xpath'] == xpath:
                return r
        return None

    def find_resources_by_url(self, url: str):
        normalized_url = self.normalize_url(url)
        return [r for r in self.matched_resources if self.normalize_url(r['url']) == normalized_url]

    def normalize_url(self, url: str):
        try:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url)
            return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, ''))
        except Exception:
            return url

    def export_to_json(self, include_unmatched: bool = False):
        resources = self.matched_resources if include_unmatched else self.get_matched_resources()

        from datetime import datetime

        return {
            'timestamp': datetime.now().isoformat(),
            'url': self.page.driver.current_url if hasattr(self.page, 'driver') else '',
            'totalResources': len(resources),
            'resources': [{
                'xpath': r['xpath'],
                'url': r['url'],
                'tagName': r['tagName'],
                'sourceType': r['sourceType'],
                'frame': r['frame'],
                'matched': r['matched'],
                'status': r['intercepted']['status'] if r['intercepted'] else None,
                'contentType': r['intercepted']['contentType'] if r['intercepted'] else None,
                'size': r['intercepted']['actualSize'] or r['intercepted']['contentLength'] if r['intercepted'] else None,
                'hash': r['intercepted']['hash'] if r['intercepted'] else None
            } for r in resources],
            'stats': self.get_collection_result()['stats']
        }

    def clear(self):
        self.matched_resources = []
        self.interceptor.clear()
        self.mapper.clear()
        ColorPrint.green('[EnhancedResourceCollector] Cleared all collected resources')

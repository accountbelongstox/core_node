#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IframeRecursiveCrawler

Recursive iframe crawler for deep page traversal
"""

import time
from typing import Dict, Any, List, Callable, Optional
from urllib.parse import urlparse, urljoin

from pycore.pyfoundations.color_print import ColorPrint


class IframeRecursiveCrawler:
    def __init__(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        self.page = page
        self.max_depth = options.get('maxDepth', 10)
        self.delay = options.get('delay', 1000) / 1000
        self.max_links_per_page = options.get('maxLinksPerPage', float('inf'))
        self.same_origin_only = options.get('sameOriginOnly', True)
        self.skip_hash_links = options.get('skipHashLinks', True)
        self.on_page_callback = options.get('onPageCallback')
        self.on_failed_callback = options.get('onFailedCallback')

        self.global_processed_urls = set()
        self.global_failed_urls = set()
        self.page_link_map = {}
        self.results = []
        self.navigation_stack = []
        self.start_origin = None

    async def initialize(self):
        try:
            initial_url = await self.page.get_url()
            parsed = urlparse(initial_url)
            self.start_origin = f'{parsed.scheme}://{parsed.netloc}'
            ColorPrint.green(f'[RECURSIVE-CRAWLER] Initialized with origin: {self.start_origin}')
            ColorPrint.green(f'[RECURSIVE-CRAWLER] Max depth: {self.max_depth}, Delay: {self.delay}s')
            return True
        except Exception as error:
            ColorPrint.red(f'[RECURSIVE-CRAWLER] Failed to initialize: {error}')
            return False

    def normalize_url(self, url: str):
        try:
            parsed = urlparse(url)
            if self.skip_hash_links:
                return f'{parsed.scheme}://{parsed.netloc}{parsed.path}{("?" + parsed.query) if parsed.query else ""}'
            return url
        except Exception:
            return url

    def is_valid_link(self, url: str):
        try:
            parsed = urlparse(url)

            if parsed.scheme not in ['http', 'https']:
                return False

            if self.same_origin_only:
                origin = f'{parsed.scheme}://{parsed.netloc}'
                if origin != self.start_origin:
                    return False

            return True
        except Exception:
            return False

    async def get_page_links(self, current_url: str):
        try:
            script = """
            return Array.from(document.querySelectorAll('a[href]')).map((a, index) => ({
                href: a.href,
                text: a.textContent.trim(),
                id: a.id || '',
                className: a.className || '',
                index: index
            }));
            """

            links = await self.page.evaluate(script)

            valid_links = [link for link in links if self.is_valid_link(link['href'])]

            normalized_links = [{
                **link,
                'normalizedUrl': self.normalize_url(link['href'])
            } for link in valid_links]

            self.page_link_map[current_url] = normalized_links

            ColorPrint.green(f'[RECURSIVE-CRAWLER] Found {len(normalized_links)} valid links on page: {current_url}')
            return normalized_links
        except Exception as error:
            ColorPrint.red(f'[RECURSIVE-CRAWLER] Failed to get page links: {error}')
            return []

    async def click_link_by_href(self, target_href: str):
        try:
            script = """
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            const targetAnchor = anchors.find(a => a.href === arguments[0]);
            if (targetAnchor) {
                targetAnchor.click();
                return true;
            }
            return false;
            """

            clicked = await self.page.evaluate(script, target_href)

            if not clicked:
                return False

            time.sleep(self.delay)
            return True
        except Exception as error:
            ColorPrint.red(f'[RECURSIVE-CRAWLER] Failed to click link with href {target_href}: {error}')
            return False

    async def navigate_back(self):
        try:
            await self.page.go_back()
            time.sleep(self.delay)
            return True
        except Exception as error:
            ColorPrint.red(f'[RECURSIVE-CRAWLER] Failed to navigate back: {error}')
            return False

    async def capture_page_content(self, url: str, link_info: Dict[str, Any], depth: int):
        try:
            content = await self.page.get_content()
            current_url = await self.page.get_url()
            normalized_url = self.normalize_url(current_url)

            result = {
                'url': normalized_url,
                'originalUrl': current_url,
                'linkText': link_info.get('text', ''),
                'linkHref': link_info.get('href', ''),
                'content': content,
                'contentLength': len(content),
                'depth': depth,
                'success': True,
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
            }

            self.results.append(result)
            self.global_processed_urls.add(normalized_url)

            if self.on_page_callback and callable(self.on_page_callback):
                await self.on_page_callback(result, len(self.results), depth)

            ColorPrint.green(f'[RECURSIVE-CRAWLER] Captured page (depth {depth}): {link_info.get("text", "")} or {normalized_url}')
            return result
        except Exception as error:
            ColorPrint.red(f'[RECURSIVE-CRAWLER] Failed to capture page content: {error}')
            return None

    async def recursive_crawl(self, current_url: str, depth: int = 0):
        if depth >= self.max_depth:
            ColorPrint.yellow(f'[RECURSIVE-CRAWLER] Max depth {self.max_depth} reached at {current_url}')
            return

        normalized_current_url = self.normalize_url(current_url)

        if normalized_current_url in self.global_processed_urls:
            ColorPrint.green(f'[RECURSIVE-CRAWLER] Skipping already processed URL: {normalized_current_url}')
            return

        ColorPrint.green(f'[RECURSIVE-CRAWLER] Processing URL at depth {depth}: {current_url}')

        links = await self.get_page_links(normalized_current_url)

        unprocessed_links = [
            link for link in links
            if link['normalizedUrl'] not in self.global_processed_urls
            and link['normalizedUrl'] not in self.global_failed_urls
        ]

        ColorPrint.green(f'[RECURSIVE-CRAWLER] {len(unprocessed_links)} unprocessed links at depth {depth}')

        links_to_process = unprocessed_links[:min(len(unprocessed_links), int(self.max_links_per_page))]

        for i, link in enumerate(links_to_process):
            if link['normalizedUrl'] in self.global_processed_urls:
                ColorPrint.green(f'[RECURSIVE-CRAWLER] Skipping already processed URL from global set: {link["normalizedUrl"]}')
                continue

            ColorPrint.green(f'[RECURSIVE-CRAWLER] Clicking link {i + 1}/{len(links_to_process)} at depth {depth}: {link.get("text", "")} or {link["normalizedUrl"]}')

            previous_url = await self.page.get_url()
            clicked = await self.click_link_by_href(link['href'])

            if not clicked:
                ColorPrint.yellow(f'[RECURSIVE-CRAWLER] Failed to click link: {link["normalizedUrl"]}')
                self.global_failed_urls.add(link['normalizedUrl'])

                if self.on_failed_callback and callable(self.on_failed_callback):
                    await self.on_failed_callback({
                        'linkText': link.get('text', ''),
                        'linkHref': link.get('href', ''),
                        'targetUrl': link['normalizedUrl'],
                        'success': False,
                        'error': 'Click failed',
                        'depth': depth
                    })
                continue

            time.sleep(self.delay)

            new_url = await self.page.get_url()
            normalized_new_url = self.normalize_url(new_url)

            if normalized_new_url == self.normalize_url(previous_url):
                ColorPrint.yellow(f'[RECURSIVE-CRAWLER] Navigation failed - URL did not change: {link["normalizedUrl"]}')
                self.global_failed_urls.add(link['normalizedUrl'])

                if self.on_failed_callback and callable(self.on_failed_callback):
                    await self.on_failed_callback({
                        'linkText': link.get('text', ''),
                        'linkHref': link.get('href', ''),
                        'targetUrl': link['normalizedUrl'],
                        'success': False,
                        'error': 'Navigation timeout or same URL',
                        'depth': depth
                    })
                continue

            if normalized_new_url in self.global_processed_urls:
                ColorPrint.green(f'[RECURSIVE-CRAWLER] Arrived at already processed URL: {normalized_new_url}, going back')
                await self.navigate_back()
                continue

            await self.capture_page_content(new_url, link, depth + 1)

            self.navigation_stack.append({
                'url': normalized_current_url,
                'linkHref': link['href']
            })

            await self.recursive_crawl(new_url, depth + 1)

            self.navigation_stack.pop()

            ColorPrint.green(f'[RECURSIVE-CRAWLER] Going back from depth {depth + 1} to {depth}')
            await self.navigate_back()

            time.sleep(self.delay)

    async def start(self):
        try:
            initialized = await self.initialize()
            if not initialized:
                raise RuntimeError('Failed to initialize crawler')

            initial_url = await self.page.get_url()
            normalized_initial_url = self.normalize_url(initial_url)

            ColorPrint.green(f'[RECURSIVE-CRAWLER] Starting recursive crawl from: {initial_url}')

            await self.capture_page_content(initial_url, {'text': 'Initial Page', 'href': initial_url}, 0)

            await self.recursive_crawl(initial_url, 0)

            ColorPrint.green('[RECURSIVE-CRAWLER] Crawl completed!')
            ColorPrint.green(f'[RECURSIVE-CRAWLER] Total pages processed: {len(self.results)}')
            ColorPrint.green(f'[RECURSIVE-CRAWLER] Total URLs in global set: {len(self.global_processed_urls)}')
            ColorPrint.green(f'[RECURSIVE-CRAWLER] Failed URLs: {len(self.global_failed_urls)}')

            return {
                'results': self.results,
                'totalProcessed': len(self.results),
                'globalProcessedUrls': list(self.global_processed_urls),
                'failedUrls': list(self.global_failed_urls),
                'pageLinkMap': self.page_link_map,
                'maxDepthReached': max([r['depth'] for r in self.results]) if self.results else 0
            }
        except Exception as error:
            ColorPrint.red(f'[RECURSIVE-CRAWLER] Crawl failed: {error}')
            raise

    def get_results(self):
        return self.results

    def get_page_link_map(self):
        return self.page_link_map

    def get_global_processed_urls(self):
        return self.global_processed_urls

    def get_statistics(self):
        max_depth_reached = 0
        if self.results:
            max_depth_reached = max([r['depth'] for r in self.results])

        average_links_per_page = 0
        if self.page_link_map:
            total_links = sum([len(links) for links in self.page_link_map.values()])
            average_links_per_page = total_links / len(self.page_link_map)

        return {
            'totalPages': len(self.results),
            'totalProcessedUrls': len(self.global_processed_urls),
            'totalFailedUrls': len(self.global_failed_urls),
            'totalPagesInMap': len(self.page_link_map),
            'maxDepthReached': max_depth_reached,
            'averageLinksPerPage': average_links_per_page
        }

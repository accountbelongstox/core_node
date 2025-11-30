#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DomResourceMapper

Maps DOM elements to their resources
"""

from typing import Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint


class DomResourceMapper:
    def __init__(self, page: Any):
        self.page = page
        self.resource_map = {}

    async def extract_dom_resources(self, options: Dict[str, Any] = None):
        options = options or {}
        include_iframes = options.get('includeIframes', True)
        include_data_urls = options.get('includeDataUrls', False)

        ColorPrint.green('[DomResourceMapper] Extracting DOM resources...')

        main_frame_resources = await self.extract_frame_resources('/', include_data_urls)

        ColorPrint.green(f'[DomResourceMapper] Extracted {len(main_frame_resources)} resources from main frame')

        all_resources = list(main_frame_resources)

        if include_iframes:
            try:
                iframes = await self.page.evaluate("""
                    Array.from(document.querySelectorAll('iframe')).map((iframe, index) => index);
                """)

                for i in iframes:
                    try:
                        frame_path = f'/iframe[{i}]'
                        frame_resources = await self.extract_iframe_resources(i, frame_path, include_data_urls)
                        all_resources.extend(frame_resources)
                        ColorPrint.green(f'[DomResourceMapper] Extracted {len(frame_resources)} resources from iframe {i}')
                    except Exception as error:
                        ColorPrint.yellow(f'[DomResourceMapper] Failed to extract resources from iframe {i}: {error}')
            except Exception as error:
                ColorPrint.yellow(f'[DomResourceMapper] Failed to process iframes: {error}')

        self.build_resource_map(all_resources)

        ColorPrint.green(f'[DomResourceMapper] Total resources extracted: {len(all_resources)}')

        return all_resources

    async def extract_frame_resources(self, frame_path: str, include_data_urls: bool):
        injection_code = self.get_injection_code(include_data_urls)

        try:
            resources = await self.page.evaluate(injection_code)

            return [{
                **resource,
                'xpath': resource['xpath'] if frame_path == '/' else frame_path + resource['xpath'],
                'frame': frame_path
            } for resource in resources]
        except Exception as error:
            ColorPrint.red(f'[DomResourceMapper] Failed to execute injection code in frame {frame_path}: {error}')
            return []

    async def extract_iframe_resources(self, iframe_index: int, frame_path: str, include_data_urls: bool):
        injection_code = self.get_injection_code(include_data_urls)

        try:
            script = f"""
            (function() {{
                const iframe = document.querySelectorAll('iframe')[{iframe_index}];
                if (!iframe || !iframe.contentDocument) return [];

                const doc = iframe.contentDocument;
                const originalDoc = document;
                document = doc;
                try {{
                    {injection_code}
                }} finally {{
                    document = originalDoc;
                }}
            }})();
            """

            resources = await self.page.evaluate(script)

            return [{
                **resource,
                'xpath': frame_path + resource['xpath'],
                'frame': frame_path
            } for resource in resources]
        except Exception as error:
            ColorPrint.red(f'[DomResourceMapper] Failed to extract iframe {iframe_index} resources: {error}')
            return []

    def get_injection_code(self, include_data_urls: bool):
        return f"""
            (function() {{
                function stringToLowerCase(str) {{
                    if (typeof str === 'string') {{
                        return str.toLowerCase();
                    }} else {{
                        return '';
                    }}
                }}

                function getXpath(element) {{
                    let xpath = '';
                    for (let me = element, k = 0; me && me.nodeType === 1; element = element.parentNode, me = element, k += 1) {{
                        let i = 0;
                        while ((me = me.previousElementSibling)) {{
                            if (me.tagName === element.tagName) {{
                                i += 1;
                            }}
                        }}
                        const elementTag = stringToLowerCase(element.tagName);
                        let id = i + 1;
                        id = '[' + id + ']';
                        xpath = '/' + elementTag + id + xpath;
                    }}
                    return xpath;
                }}

                function extractUrlFromCss(cssValue) {{
                    if (!cssValue || typeof cssValue !== 'string') {{
                        return null;
                    }}

                    const urlMatch = cssValue.match(/url\\s*\\(\\s*["']?([^"')]+)["']?\\s*\\)/i);
                    if (urlMatch && urlMatch[1]) {{
                        let url = urlMatch[1].trim();
                        if (url.startsWith('data:') && !{str(include_data_urls).lower()}) {{
                            return null;
                        }}
                        return url;
                    }}

                    return null;
                }}

                const results = [];
                const processedUrls = new Set();

                function addResource(element, url, sourceType) {{
                    if (!url || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:')) {{
                        return;
                    }}

                    if (url.startsWith('data:') && !{str(include_data_urls).lower()}) {{
                        return;
                    }}

                    try {{
                        const absoluteUrl = new URL(url, window.location.href).href;
                        const key = absoluteUrl + '::' + getXpath(element);

                        if (processedUrls.has(key)) {{
                            return;
                        }}

                        processedUrls.add(key);

                        results.push({{
                            xpath: getXpath(element),
                            url: absoluteUrl,
                            tagName: stringToLowerCase(element.tagName),
                            sourceType: sourceType,
                            attributes: {{
                                id: element.id || null,
                                class: element.className || null,
                                alt: element.alt || null,
                                title: element.title || null
                            }}
                        }});
                    }} catch (error) {{
                    }}
                }}

                const treeWalker = document.createTreeWalker(
                    document.body ? document.body.parentElement : document.documentElement,
                    NodeFilter.SHOW_ELEMENT,
                    {{
                        acceptNode: function (node) {{
                            return NodeFilter.FILTER_ACCEPT;
                        }}
                    }}
                );

                while (treeWalker.nextNode()) {{
                    const element = treeWalker.currentNode;

                    if (element.src) {{
                        addResource(element, element.src, 'src');
                    }}

                    if (element.href && (element.tagName.toLowerCase() === 'link' || element.tagName.toLowerCase() === 'a')) {{
                        const rel = element.rel ? element.rel.toLowerCase() : '';
                        if (rel.includes('stylesheet') || rel.includes('icon') || rel.includes('preload')) {{
                            addResource(element, element.href, 'href');
                        }}
                    }}

                    if (element.background) {{
                        addResource(element, element.background, 'background');
                    }}

                    if (element.poster && element.tagName.toLowerCase() === 'video') {{
                        addResource(element, element.poster, 'poster');
                    }}

                    const computedStyle = window.getComputedStyle(element, null);

                    const backgroundImage = extractUrlFromCss(computedStyle.backgroundImage);
                    if (backgroundImage) {{
                        addResource(element, backgroundImage, 'css-background-image');
                    }}

                    const listStyleImage = extractUrlFromCss(computedStyle.listStyleImage);
                    if (listStyleImage) {{
                        addResource(element, listStyleImage, 'css-list-style-image');
                    }}

                    const borderImage = extractUrlFromCss(computedStyle.borderImageSource);
                    if (borderImage) {{
                        addResource(element, borderImage, 'css-border-image');
                    }}

                    if (element.srcset) {{
                        const srcsetEntries = element.srcset.split(',');
                        srcsetEntries.forEach(entry => {{
                            const parts = entry.trim().split(/\\s+/);
                            if (parts[0]) {{
                                addResource(element, parts[0], 'srcset');
                            }}
                        }});
                    }}

                    const dataSrc = element.getAttribute('data-src');
                    if (dataSrc) {{
                        addResource(element, dataSrc, 'data-src');
                    }}

                    const dataOriginal = element.getAttribute('data-original');
                    if (dataOriginal) {{
                        addResource(element, dataOriginal, 'data-original');
                    }}

                    const vLazy = element.getAttribute('v-lazy');
                    if (vLazy) {{
                        addResource(element, vLazy, 'v-lazy');
                    }}
                }}

                return results;
            }})();
        """

    def build_resource_map(self, resources: List[Dict[str, Any]]):
        self.resource_map.clear()

        for resource in resources:
            url = self.normalize_url(resource['url'])

            if url not in self.resource_map:
                self.resource_map[url] = []

            self.resource_map[url].append(resource)

    def normalize_url(self, url: str):
        try:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url)
            return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, ''))
        except Exception:
            return url

    def find_resources_by_url(self, url: str):
        normalized_url = self.normalize_url(url)
        return self.resource_map.get(normalized_url, [])

    def get_all_resources(self):
        all_resources = []
        for resources in self.resource_map.values():
            all_resources.extend(resources)
        return all_resources

    def get_resources_by_type(self, source_type: str):
        return [r for r in self.get_all_resources() if r.get('sourceType') == source_type]

    def get_resources_by_tag(self, tag_name: str):
        return [r for r in self.get_all_resources() if r.get('tagName') == tag_name.lower()]

    def get_stats(self):
        stats = {
            'totalResources': 0,
            'uniqueUrls': len(self.resource_map),
            'bySourceType': {},
            'byTagName': {},
            'byFrame': {}
        }

        for resources in self.resource_map.values():
            stats['totalResources'] += len(resources)

            for resource in resources:
                source_type = resource.get('sourceType', 'unknown')
                tag_name = resource.get('tagName', 'unknown')
                frame = resource.get('frame', '/')

                stats['bySourceType'][source_type] = stats['bySourceType'].get(source_type, 0) + 1
                stats['byTagName'][tag_name] = stats['byTagName'].get(tag_name, 0) + 1
                stats['byFrame'][frame] = stats['byFrame'].get(frame, 0) + 1

        return stats

    def clear(self):
        self.resource_map.clear()
        ColorPrint.green('[DomResourceMapper] Cleared resource map')

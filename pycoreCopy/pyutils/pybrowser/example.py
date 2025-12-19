#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyBrowser Example

Demonstrates basic usage of PyBrowser
"""

import asyncio
from pycore.pyutils.pybrowser import create_session, shutdown


async def main():
    """Main example function"""
    session = await create_session({
        'preset': 'desktop',
        'browser': 'edge',
        'headless': False
    })

    page = await session.new_page()

    await page.goto('https://example.com')
    title = await page.get_title()
    print(f'Page title: {title}')

    content_plugin = session.get_plugin('content')
    content = await content_plugin.extract_all(page)

    print(f"Found {len(content['links'])} links")
    print(f"Found {len(content['images'])} images")

    await session.close()
    await shutdown()


if __name__ == '__main__':
    asyncio.run(main())

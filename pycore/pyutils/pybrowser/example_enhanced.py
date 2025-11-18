#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyBrowser Enhanced Usage Examples

Demonstrates advanced features including:
- EnhancedPage with resource collection
- EnhancedDownloadPlugin with file monitoring
- IframeRecursiveCrawler for deep page traversal
- Logger, Validator, RetryHandler, PerformanceMonitor utilities
"""

import asyncio
from pycore.pyutils.pybrowser import (
    create_session,
    shutdown,
    Logger,
    Validator,
    RetryHandler,
    PerformanceMonitor,
    IframeRecursiveCrawler,
    BrowserControlUtils,
    PageOperationUtils,
    ResourceInterceptor,
    DomResourceMapper,
    EnhancedResourceCollector
)


async def example_enhanced_page():
    """Example: Using EnhancedPage with resource collection"""
    print('\n=== Example 1: EnhancedPage with Resource Collection ===')

    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': False,
        'enableResourceCollection': True
    })

    page = await session.new_page()

    await page.goto('https://example.com')

    if hasattr(page, 'collect_resources'):
        result = await page.collect_resources()
        print(f"Collected resources: {result['stats']['total']} total, {result['stats']['matched']} matched")

    await session.close()


async def example_enhanced_download():
    """Example: Using EnhancedDownloadPlugin"""
    print('\n=== Example 2: EnhancedDownloadPlugin ===')

    session = await create_session({
        'preset': 'desktop',
        'browser': 'edge',
        'headless': False
    })

    page = await session.new_page()
    download_plugin = session.get_plugin('enhanced_download')

    if download_plugin:
        result = await download_plugin.download_file(
            'https://example.com/sample.pdf',
            {'filename': 'sample_download.pdf'}
        )
        print(f"Download result: {result}")

        metrics = download_plugin.get_download_metrics()
        print(f"Download metrics: {metrics}")

    await session.close()


async def example_iframe_recursive_crawler():
    """Example: Using IframeRecursiveCrawler"""
    print('\n=== Example 3: IframeRecursiveCrawler ===')

    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': True
    })

    page = await session.new_page()
    await page.goto('https://example.com')

    crawler = IframeRecursiveCrawler(page, {
        'maxDepth': 2,
        'delay': 1000,
        'maxLinksPerPage': 5,
        'sameOriginOnly': True,
        'skipHashLinks': True,
        'onPageCallback': lambda result, count, depth: print(f"Crawled page {count} at depth {depth}: {result['url']}")
    })

    result = await crawler.start()
    print(f"Crawl completed: {result['totalProcessed']} pages processed")
    print(f"Max depth reached: {result['maxDepthReached']}")

    await session.close()


async def example_logger():
    """Example: Using Logger utility"""
    print('\n=== Example 4: Logger ===')

    logger = Logger({
        'level': 'debug',
        'enabled': True,
        'prefix': 'MyApp'
    })

    logger.error('This is an error message')
    logger.warn('This is a warning message')
    logger.info('This is an info message')
    logger.debug('This is a debug message')

    logger.set_level('warn')
    logger.info('This message will not be shown (level is warn)')


async def example_validator():
    """Example: Using Validator utility"""
    print('\n=== Example 5: Validator ===')

    print(f"Is string: {Validator.is_string('hello')}")
    print(f"Is number: {Validator.is_number(42)}")
    print(f"Is URL: {Validator.is_url('https://example.com')}")
    print(f"Is email: {Validator.is_email('test@example.com')}")

    config = {
        'timeout': 5000,
        'retries': 3,
        'url': 'https://example.com'
    }

    schema = {
        'timeout': {'required': True, 'type': int, 'min': 1000, 'max': 30000},
        'retries': {'required': True, 'type': int, 'min': 1, 'max': 10},
        'url': {'required': True, 'type': str, 'validator': Validator.is_url}
    }

    validation_result = Validator.validate_config(config, schema)
    print(f"Config validation: {validation_result}")


async def example_retry_handler():
    """Example: Using RetryHandler utility"""
    print('\n=== Example 6: RetryHandler ===')

    retry_handler = RetryHandler({
        'maxAttempts': 3,
        'delay': 1000,
        'backoff': 2.0,
        'maxDelay': 5000,
        'retryCondition': lambda error: 'timeout' in str(error).lower()
    })

    attempt_count = 0

    async def flaky_operation():
        nonlocal attempt_count
        attempt_count += 1
        print(f"Attempt {attempt_count}")
        if attempt_count < 3:
            raise Exception('Timeout error')
        return 'Success!'

    result = await retry_handler.execute(flaky_operation)
    print(f"Operation result: {result}")


async def example_performance_monitor():
    """Example: Using PerformanceMonitor utility"""
    print('\n=== Example 7: PerformanceMonitor ===')

    from pycore.pyutils.pybrowser import PerformanceMonitor
    import time

    monitor = PerformanceMonitor()

    monitor.start_timer('operation1')
    await asyncio.sleep(0.5)
    duration1 = monitor.end_timer('operation1')
    print(f"Operation 1 took: {duration1}ms")

    monitor.start_timer('operation2')
    await asyncio.sleep(0.3)
    duration2 = monitor.end_timer('operation2')
    print(f"Operation 2 took: {duration2}ms")

    for i in range(5):
        monitor.record_metric('api_response_time', 100 + i * 20)

    metrics = monitor.get_all_metrics()
    print(f"All metrics: {metrics}")


async def example_browser_control_utils():
    """Example: Using BrowserControlUtils"""
    print('\n=== Example 8: BrowserControlUtils ===')

    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': False
    })

    page = await session.new_page()
    await page.goto('https://example.com')

    control_utils = BrowserControlUtils()

    await control_utils.set_viewport(page, {'width': 1920, 'height': 1080})

    await control_utils.set_user_agent(page, 'Mozilla/5.0 (Custom User Agent)')

    screenshot = await control_utils.take_screenshot(page, {'path': 'screenshot.png'})
    print('Screenshot taken')

    cookies = await control_utils.get_cookies(page)
    print(f"Cookies: {len(cookies)}")

    await session.close()


async def example_page_operation_utils():
    """Example: Using PageOperationUtils"""
    print('\n=== Example 9: PageOperationUtils ===')

    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': True
    })

    page = await session.new_page()
    await page.goto('https://example.com')

    ops = PageOperationUtils()

    await ops.safe_click(page, 'a', {'timeout': 5000})
    print('Clicked link safely')

    await session.close()


async def example_resource_collection():
    """Example: Using ResourceInterceptor and DomResourceMapper"""
    print('\n=== Example 10: Resource Collection ===')

    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': True
    })

    page = await session.new_page()

    interceptor = ResourceInterceptor(page, {
        'resourceTypes': ['image', 'stylesheet', 'font'],
        'includeFailedRequests': True,
        'computeHash': True
    })

    await interceptor.enable()

    await page.goto('https://example.com')

    await asyncio.sleep(2)

    stats = interceptor.get_stats()
    print(f"Interceptor stats: {stats}")

    resources = interceptor.get_intercepted_resources()
    print(f"Intercepted {len(resources)} resources")

    mapper = DomResourceMapper(page)
    dom_resources = await mapper.extract_dom_resources({
        'includeIframes': True,
        'includeDataUrls': False
    })
    print(f"Extracted {len(dom_resources)} DOM resources")

    mapper_stats = mapper.get_stats()
    print(f"Mapper stats: {mapper_stats}")

    await session.close()


async def main():
    """Run all examples"""
    print('PyBrowser Enhanced Features Examples')
    print('=' * 60)

    await example_logger()
    await example_validator()
    await example_retry_handler()
    await example_performance_monitor()

    await shutdown()
    print('\n=== Examples completed ===')


if __name__ == '__main__':
    asyncio.run(main())

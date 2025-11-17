# PyBrowserAuto Automation Usage Examples

Complete examples for using the automation components.

---

## Table of Contents

1. [ImageUtils - Image Operations](#imageutils---image-operations)
2. [ScreenshotManager - Screenshot Management](#screenshotmanager---screenshot-management)
3. [PageSwitcher - Page Switching](#pageswitcher---page-switching)
4. [AutomationController - Complete Workflows](#automationcontroller---complete-workflows)

---

## ImageUtils - Image Operations

### Example 1: Load and Merge Images

```python
from pycore.pyutils.pybrowser.utils.image_utils import ImageUtils

# Load images from different sources
img1 = ImageUtils.load_image('/path/to/local/image.png')
img2 = ImageUtils.load_image('https://example.com/remote/image.jpg')

# Merge horizontally with spacing
merged = ImageUtils.merge_images_horizontal([img1, img2], spacing=10)

# Save result
ImageUtils.save_image(merged, '/output/merged_horizontal.png', format='PNG')
```

### Example 2: Vertical and Grid Merging

```python
from pycore.pyutils.pybrowser.utils.image_utils import ImageUtils

# Load multiple images
images = [
    ImageUtils.load_image(f'/screenshots/page{i}.png')
    for i in range(1, 5)
]

# Merge vertically
vertical = ImageUtils.merge_images_vertical(images, spacing=5)
ImageUtils.save_image(vertical, '/output/vertical.png')

# Merge in grid (2 columns)
grid = ImageUtils.merge_images_grid(images, cols=2, spacing=10)
ImageUtils.save_image(grid, '/output/grid.png')
```

### Example 3: Compare Images

```python
from pycore.pyutils.pybrowser.utils.image_utils import ImageUtils

# Load two images
baseline = ImageUtils.load_image('/baseline/screenshot.png')
current = ImageUtils.load_image('/current/screenshot.png')

# Compare
result = ImageUtils.compare_images(baseline, current)

print(f"Identical: {result['identical']}")
print(f"Similarity: {result['similarity']:.2%}")
print(f"Different pixels: {result['diff_pixels']}")
```

---

## ScreenshotManager - Screenshot Management

### Example 4: Basic Screenshot

```python
from pycore.pyctl.pybrowserauto.automation import ScreenshotManager
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser
from pycore.pyutils.pybrowser.implementations.pages import StandardPage

# Setup browser
chrome = ChromeBrowser()
chrome.launch()
chrome.driver.get('https://example.com')

# Create page wrapper
page = StandardPage(chrome.driver)

# Screenshot manager
manager = ScreenshotManager(output_dir='/screenshots')
screenshot_bytes = manager.take_screenshot(page, output_path='/screenshots/example.png')

print(f"Screenshot saved: {len(screenshot_bytes)} bytes")

chrome.close()
```

### Example 5: Screenshot and Merge

```python
from pycore.pyctl.pybrowserauto.automation import ScreenshotManager
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser
from pycore.pyutils.pybrowser.implementations.pages import StandardPage

# Setup
chrome = ChromeBrowser()
chrome.launch()
chrome.driver.get('https://example.com')
page = StandardPage(chrome.driver)

# Screenshot and merge
manager = ScreenshotManager()
result = manager.take_screenshot_and_merge(
    page=page,
    reference_image_source='/baseline/reference.png',  # or URL
    output_path='/output/comparison.png',
    merge_mode='horizontal',
    spacing=10
)

if result['success']:
    print(f"Merged image: {result['merged_path']}")
    print(f"Screenshot: {result['screenshot_path']}")
else:
    print(f"Error: {result['error']}")

chrome.close()
```

### Example 6: Batch Screenshot

```python
from pycore.pyctl.pybrowserauto.automation import ScreenshotManager
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser
from pycore.pyutils.pybrowser.implementations.pages import StandardPage

chrome = ChromeBrowser()
chrome.launch()

# Open multiple tabs
urls = ['https://example.com', 'https://google.com', 'https://github.com']
pages = []

for url in urls:
    chrome.new_tab(url)
    pages.append(StandardPage(chrome.driver))

# Batch screenshot
manager = ScreenshotManager()
results = manager.batch_screenshot_pages(pages, output_dir='/screenshots', prefix='page')

for i, result in enumerate(results):
    if result['success']:
        print(f"Page {i+1}: {result['path']}")

chrome.close()
```

---

## PageSwitcher - Page Switching

### Example 7: Basic Tab Switching

```python
from pycore.pyctl.pybrowserauto.automation import PageSwitcher
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

# Setup browser
chrome = ChromeBrowser()
chrome.launch()

# Open multiple tabs
chrome.new_tab('https://example.com')
chrome.new_tab('https://google.com')
chrome.new_tab('https://github.com')

# Create switcher
switcher = PageSwitcher(chrome)

# Switch by index
switcher.switch_by_index(1)  # Switch to 2nd tab (Google)

# Switch by URL
switcher.switch_by_url('https://example.com', exact_match=False)

# Switch by title
switcher.switch_by_title('GitHub', exact_match=False)

chrome.close()
```

### Example 8: Get All Tabs Info

```python
from pycore.pyctl.pybrowserauto.automation import PageSwitcher
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

chrome = ChromeBrowser()
chrome.launch()

# Open tabs
chrome.new_tab('https://example.com')
chrome.new_tab('https://google.com')

switcher = PageSwitcher(chrome)

# Get all tabs info
tabs = switcher.get_all_tabs_info()

for tab in tabs:
    print(f"[{tab['index']}] {tab['title']}")
    print(f"    URL: {tab['url']}")

chrome.close()
```

### Example 9: Smart Tab Management

```python
from pycore.pyctl.pybrowserauto.automation import PageSwitcher
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

chrome = ChromeBrowser()
chrome.launch()

switcher = PageSwitcher(chrome)

# Open and switch (reuses blank tab if available)
switcher.open_and_switch('https://example.com', reuse_blank=True)

# Get current tab
current = switcher.get_current_tab_index()
print(f"Current tab: {current}")

# Close current and switch to first tab
switcher.close_current_and_switch(fallback_index=0)

chrome.close()
```

---

## AutomationController - Complete Workflows

### Example 10: Navigate, Screenshot, and Merge

```python
from pycore.pyctl.pybrowserauto.automation import AutomationController
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

# Setup
chrome = ChromeBrowser()
chrome.launch()

controller = AutomationController()
controller.initialize(chrome, screenshot_output_dir='/automation_output')

# Complete workflow: Navigate → Screenshot → Merge
result = controller.navigate_screenshot_merge(
    url='https://example.com',
    reference_image='/baseline/reference.png',
    output_path='/output/comparison.png',
    wait_time=3.0,
    merge_mode='horizontal',
    spacing=10
)

if result['success']:
    print(f"Success!")
    print(f"  Merged image: {result['merged_path']}")
    print(f"  Screenshot: {result['screenshot_path']}")
else:
    print(f"Failed: {result['error']}")

controller.cleanup()
```

### Example 11: Switch, Screenshot, and Merge

```python
from pycore.pyctl.pybrowserauto.automation import AutomationController
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

# Setup browser with multiple tabs
chrome = ChromeBrowser()
chrome.launch()
chrome.new_tab('https://example.com/page1')
chrome.new_tab('https://example.com/page2')
chrome.new_tab('https://example.com/page3')

# Initialize controller
controller = AutomationController()
controller.initialize(chrome)

# Switch to 2nd tab, screenshot, and merge
result = controller.switch_screenshot_merge(
    target=1,  # Index 1 = 2nd tab
    target_type='index',
    reference_image='https://cdn.example.com/baseline.png',
    merge_mode='vertical'
)

if result['success']:
    print(f"Merged image: {result['merged_path']}")

# Switch by URL
result2 = controller.switch_screenshot_merge(
    target='https://example.com/page3',
    target_type='url',
    reference_image='/baseline.png',
    merge_mode='horizontal'
)

controller.cleanup()
```

### Example 12: Batch Processing Multiple URLs

```python
from pycore.pyctl.pybrowserauto.automation import AutomationController
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

# Setup
chrome = ChromeBrowser()
chrome.launch()

controller = AutomationController()
controller.initialize(chrome, screenshot_output_dir='/batch_output')

# Batch process
urls = [
    'https://example.com/product/1',
    'https://example.com/product/2',
    'https://example.com/product/3',
    'https://example.com/product/4'
]

results = controller.batch_navigate_screenshot_merge(
    url_list=urls,
    reference_image='/baseline/product_template.png',
    output_dir='/batch_output/comparisons',
    merge_mode='horizontal',
    spacing=15
)

# Print results
for i, result in enumerate(results):
    if result['success']:
        print(f"[{i+1}] ✓ {result['url']}")
        print(f"     Merged: {result['merged_path']}")
    else:
        print(f"[{i+1}] ✗ {result['url']}")
        print(f"     Error: {result['error']}")

controller.cleanup()
```

### Example 13: Accessing Sub-Components

```python
from pycore.pyctl.pybrowserauto.automation import AutomationController
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

chrome = ChromeBrowser()
chrome.launch()

controller = AutomationController()
controller.initialize(chrome)

# Access PageSwitcher directly
switcher = controller.get_page_switcher()
switcher.switch_by_index(0)
tabs = switcher.get_all_tabs_info()

# Access ScreenshotManager directly
screenshot_mgr = controller.get_screenshot_manager()
# ... use screenshot_mgr methods

# Get statistics
stats = controller.get_stats()
print(f"Initialized: {stats['is_initialized']}")
print(f"Switch count: {stats['page_switcher']['switch_count']}")
print(f"Screenshot count: {stats['screenshot_manager']['screenshot_count']}")

controller.cleanup()
```

---

## Advanced Example: Complete Testing Workflow

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete visual regression testing workflow
"""

from pycore.pyctl.pybrowserauto.automation import AutomationController
from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser
from pycore.pyutils.pybrowser.utils.image_utils import ImageUtils

def visual_regression_test(baseline_dir: str, test_urls: list, output_dir: str):
    """
    Visual regression testing workflow

    Args:
        baseline_dir: Directory with baseline screenshots
        test_urls: List of URLs to test
        output_dir: Output directory for results
    """
    # Setup
    chrome = ChromeBrowser()
    chrome.launch()

    controller = AutomationController()
    controller.initialize(chrome, screenshot_output_dir=output_dir)

    results = []

    for i, url in enumerate(test_urls):
        print(f"\n[{i+1}/{len(test_urls)}] Testing: {url}")

        # Get baseline path
        baseline_path = f"{baseline_dir}/page_{i+1}.png"

        # Navigate, screenshot, and merge
        result = controller.navigate_screenshot_merge(
            url=url,
            reference_image=baseline_path,
            output_path=f"{output_dir}/comparison_{i+1}.png",
            wait_time=3.0,
            merge_mode='horizontal'
        )

        if result['success']:
            # Load and compare images
            baseline = ImageUtils.load_image(baseline_path)
            current = ImageUtils.load_image(result['screenshot_path'])

            comparison = ImageUtils.compare_images(baseline, current)

            result['comparison'] = comparison
            results.append(result)

            print(f"  Similarity: {comparison['similarity']:.2%}")

            if comparison['identical']:
                print(f"  ✓ PASS: Images are identical")
            elif comparison['similarity'] >= 0.95:
                print(f"  ~ WARNING: Minor differences ({comparison['diff_pixels']} pixels)")
            else:
                print(f"  ✗ FAIL: Significant differences")
        else:
            print(f"  ✗ ERROR: {result['error']}")
            results.append(result)

    # Cleanup
    controller.cleanup()

    # Generate report
    print(f"\n{'='*60}")
    print(f"VISUAL REGRESSION TEST REPORT")
    print(f"{'='*60}")

    passed = sum(1 for r in results if r.get('comparison', {}).get('identical', False))
    total = len(results)

    print(f"Total: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {passed/total*100:.1f}%")

    return results


# Run test
if __name__ == '__main__':
    test_urls = [
        'https://example.com/',
        'https://example.com/about',
        'https://example.com/contact'
    ]

    results = visual_regression_test(
        baseline_dir='/baselines',
        test_urls=test_urls,
        output_dir='/test_results'
    )
```

---

## Tips and Best Practices

### 1. Browser Lifecycle Management

```python
# Always close browser after use
try:
    chrome = ChromeBrowser()
    chrome.launch()
    # ... do work ...
finally:
    chrome.close()
```

### 2. Wait for Page Load

```python
# Use appropriate wait times
controller.navigate_screenshot_merge(
    url=url,
    reference_image=ref,
    wait_time=5.0  # Increase for slow pages
)
```

### 3. Error Handling

```python
# Check result status
result = controller.navigate_screenshot_merge(...)
if not result['success']:
    print(f"Error: {result['error']}")
    # Handle error...
```

### 4. Resource Management

```python
# Use AutomationController for automatic cleanup
controller = AutomationController()
controller.initialize(chrome)
# ... work ...
controller.cleanup()  # Closes browser and cleans up
```

---

## Common Patterns

### Pattern 1: Screenshot Comparison Workflow

```python
# 1. Load baseline
baseline = ImageUtils.load_image('/baseline.png')

# 2. Take current screenshot
manager = ScreenshotManager()
current_bytes = manager.take_screenshot(page, '/current.png')
current = ImageUtils.load_image('/current.png')

# 3. Compare
comparison = ImageUtils.compare_images(baseline, current)

# 4. Merge for visual comparison if different
if not comparison['identical']:
    merged = ImageUtils.merge_images_horizontal([baseline, current], spacing=10)
    ImageUtils.save_image(merged, '/comparison.png')
```

### Pattern 2: Multi-Tab Screenshot

```python
# 1. Get all tabs
switcher = PageSwitcher(browser)
tabs_info = switcher.get_all_tabs_info()

# 2. Screenshot each tab
for tab in tabs_info:
    switcher.switch_by_index(tab['index'])
    manager.take_screenshot(page, f"/tab_{tab['index']}.png")
```

---

**End of Examples**

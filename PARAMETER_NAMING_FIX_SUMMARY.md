# Parameter Naming Standardization Fix

## Problem
Inconsistent and inverted parameter naming across tab/page finding methods:
- `strict=True` means **exact** match
- `partial=True` means **partial** match (OPPOSITE!)

This inverted logic is confusing and error-prone.

## Solution
Standardize ALL methods to use: `exact_match: bool = False`
- `exact_match=True` → Require exact match
- `exact_match=False` → Allow partial match (default)

## Files to Fix
1. **pycore/pyutils/pybrowser/utils/tab_utils.py**
   - find_tab_by_url(strict) → find_tab_by_url(exact_match)
   - find_tab_by_title(partial) → find_tab_by_title(exact_match)

2. **pycore/pyctl/pybrowserauto/automation/page_switcher.py**
   - switch_by_url(strict) → switch_by_url(exact_match)
   - switch_by_title(partial) → switch_by_title(exact_match)

3. **pycore/pyutils/pybrowser/implementations/pages/enhanced_page.py**
   - find_normalized_url_index(url_strict) → find_normalized_url_index(exact_match)

## Backward Compatibility Note
This is a **breaking change** but necessary for correctness.
Code using these methods will need to update parameter names.

## Status
- [ ] TabUtils.find_tab_by_url()
- [ ] TabUtils.find_tab_by_title()
- [ ] PageSwitcher.switch_by_url()
- [ ] PageSwitcher.switch_by_title()
- [ ] EnhancedPage.find_normalized_url_index()

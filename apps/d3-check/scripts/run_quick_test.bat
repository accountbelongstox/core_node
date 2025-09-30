@echo off
echo Starting Quick Screenshot Performance Test (Standard Libraries)...
echo Screenshots will be saved to: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
echo.

cd /d "D:\programing\core_node\apps\d3check"
python scripts\quick_screenshot_test_standard.py

echo.
echo Quick test completed! Check the results in: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
pause

@echo off
echo Starting Simple Screenshot Performance Test...
echo Screenshots will be saved to: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
echo.

cd /d "D:\programing\core_node\apps\d3check"
python scripts\simple_screenshot_test.py

echo.
echo Simple test completed! Check the results in: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
pause

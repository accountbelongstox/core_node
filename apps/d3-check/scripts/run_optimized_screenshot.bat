@echo off
echo Starting Optimized Screenshot Tool Demo...
echo Screenshots will be saved to: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
echo.

cd /d "D:\programing\core_node\apps\d3check"
python scripts\optimized_screenshot.py

echo.
echo Demo completed! Check the results in: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
pause

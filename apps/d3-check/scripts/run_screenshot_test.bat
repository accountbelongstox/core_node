@echo off
echo Starting Screenshot Performance Test (Standard Libraries)...
echo Screenshots will be saved to: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
echo.

cd /d "D:\programing\core_node\apps\d3check"
python scripts\screenshot_performance_test_standard.py

echo.
echo Test completed! Check the results in: C:\Users\%USERNAME%\.core_node\.d3check\screen_test
pause

@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo Network Device Scanner
echo Scanning 192.168.31.1 - 192.168.31.255
echo ========================================
echo.

set "found_count=0"
set "total_count=0"

echo [INFO] 正在查找设备...
echo.

for /l %%i in (1,1,255) do (
    set /a total_count+=1
    set "ip=192.168.31.%%i"
    
    ping -n 1 -w 1000 !ip! >nul 2>&1
    if !errorlevel! equ 0 (
        set /a found_count+=1
        echo [FOUND] !ip! - 设备可访问
    )
)

echo.
echo ========================================
echo [INFO] 扫描完成
echo [INFO] 已找到设备数量: %found_count%
echo [INFO] 已扫描总数: %total_count%
echo ========================================

if %found_count% gtr 0 (
    echo.
    echo [SUCCESS] 已经找到设备
) else (
    echo.
    echo [WARNING] 未找到可访问的设备
)

pause


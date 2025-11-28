@echo off
REM 视频批量处理工具 - 便捷启动脚本
REM Video Batch Processing Tool - Quick Launch Script

echo ======================================================================
echo 视频批量裁剪合并工具 / Video Trim and Concat Tool
echo ======================================================================
echo.

REM 检查是否传入了参数
if "%~1"=="" (
    echo 使用方法 / Usage:
    echo   batch_process.bat "视频目录路径"
    echo.
    echo 示例 / Example:
    echo   batch_process.bat "D:\.tmp\BaiduNetdiskDownload\Laos\v"
    echo   batch_process.bat D:\videos
    echo.
    pause
    exit /b 1
)

REM 获取视频目录路径
set VIDEO_DIR=%~1

REM 检查目录是否存在
if not exist "%VIDEO_DIR%" (
    echo 错误: 目录不存在 - %VIDEO_DIR%
    echo Error: Directory not found - %VIDEO_DIR%
    pause
    exit /b 1
)

REM 显示处理信息
echo 视频目录: %VIDEO_DIR%
echo 裁剪设置: 开头 5秒, 结尾 4秒
echo.
echo 开始处理...
echo.

REM 运行Python脚本
python "%~dp0trim_and_concat_videos.py" "%VIDEO_DIR%"

REM 检查执行结果
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo ✅ 处理完成! / Processing completed!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo ❌ 处理失败! / Processing failed!
    echo ======================================================================
)

pause

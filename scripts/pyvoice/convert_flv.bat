@echo off
REM FLV转MP4批量转换工具 - 便捷启动脚本
REM FLV to MP4 Batch Converter - Quick Launch Script

echo ======================================================================
echo FLV转MP4批量转换工具 / FLV to MP4 Batch Converter
echo ======================================================================
echo.

REM 检查是否传入了参数
if "%~1"=="" (
    echo 使用方法 / Usage:
    echo   convert_flv.bat "视频目录路径" [选项]
    echo.
    echo 示例 / Examples:
    echo   convert_flv.bat "D:\videos"
    echo   convert_flv.bat "D:\videos" --delete-original
    echo   convert_flv.bat "D:\videos" --parallel 4
    echo   convert_flv.bat "D:\videos" --output "D:\converted"
    echo.
    echo 常用选项 / Common Options:
    echo   --delete-original     转换后删除原FLV文件
    echo   --overwrite          覆盖已存在的MP4文件
    echo   --parallel N         使用N个线程并行处理
    echo   --output PATH        输出到指定目录
    echo   --no-keep-structure  不保持目录结构
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
echo.
echo 开始扫描和转换FLV文件...
echo.

REM 运行Python脚本，传递所有参数
python "%~dp0flv_to_mp4.py" %*

REM 检查执行结果
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo ✅ 转换完成! / Conversion completed!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo ❌ 转换失败! / Conversion failed!
    echo ======================================================================
)

pause

@echo off
chcp 65001 >nul
echo ========================================
echo    HoloFortune React Native 启动脚本
echo ========================================
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo 检测到 node_modules 不存在，开始安装依赖...
    echo.
    call npm install
    echo.
    echo 依赖安装完成！
    echo.
) else (
    echo 依赖已存在，跳过安装步骤。
    echo.
)

echo 请选择模式:
echo 1. 调试模式 (Debug) - 启动 Metro bundler 和开发服务器
echo 2. 构建 Android Debug (Build Android Debug) - 构建 Android Debug APK
echo 3. 构建 Android Release (Build Android Release) - 构建 Android Release APK
echo 4. 仅启动 Metro (Start Metro Only) - 只启动 Metro bundler
echo 5. 清理并重新安装 (Clean ^& Reinstall) - 清理并重新安装依赖
echo.

set /p choice=请输入选项 (1-5): 

if "%choice%"=="1" (
    echo.
    echo 启动调试模式...
    echo.
    call npm start
) else if "%choice%"=="2" (
    echo.
    echo 构建 Android Debug APK...
    echo.
    cd android
    call gradlew.bat assembleDebug
    cd ..
) else if "%choice%"=="3" (
    echo.
    echo 构建 Android Release APK...
    echo.
    cd android
    call gradlew.bat assembleRelease
    cd ..
) else if "%choice%"=="4" (
    echo.
    echo 启动 Metro bundler...
    echo.
    call npm start
) else if "%choice%"=="5" (
    echo.
    echo 清理并重新安装...
    echo.
    echo 删除 node_modules...
    if exist "node_modules" (
        rmdir /s /q "node_modules"
    )
    echo 删除 package-lock.json...
    if exist "package-lock.json" (
        del /q "package-lock.json"
    )
    echo 重新安装依赖...
    echo.
    call npm install
    echo.
    echo 清理完成！
    echo.
) else (
    echo.
    echo 无效选项，退出。
    echo.
    exit /b 1
)

pause


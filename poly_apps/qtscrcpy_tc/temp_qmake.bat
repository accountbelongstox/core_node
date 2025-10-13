@echo off
echo ============================================================
echo Setting up MSVC environment...
echo ============================================================
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 (
    echo ERROR: Failed to initialize Visual Studio environment
    exit /b 1
)

echo.
echo ============================================================
echo MSVC environment initialized successfully
echo ============================================================
echo.
echo Compiler: %VCToolsInstallDir%
echo.

cd /d "D:\programing\core_node\poly_apps\qtscrcpy_tc\build_temp"

echo ============================================================
echo Running qmake...
echo ============================================================
"D:\.dev_win11\Qt\6.9.3\msvc2022_64\bin\qmake.exe" ..\TcUi\17_TcUi.pro -spec win32-msvc "CONFIG+=qtquickcompiler"
if errorlevel 1 (
    echo ERROR: qmake failed
    exit /b 1
)

echo.
echo ============================================================
echo qmake completed successfully
echo ============================================================

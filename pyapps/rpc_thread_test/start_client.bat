@echo off
REM Quick start script for RPC Test Client

cd /d D:\programing\core_node
echo ============================================================
echo  Starting RPC Test Client
echo ============================================================
echo.
echo Make sure the RPC server is running first!
echo.
timeout /t 2 /nobreak >nul

python -m pyapps.rpc_thread_test.test_client

pause

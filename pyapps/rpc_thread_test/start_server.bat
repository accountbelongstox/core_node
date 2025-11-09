@echo off
REM Quick start script for RPC Thread Test Server

cd /d D:\programing\core_node
echo ============================================================
echo  Starting RPC Thread Test Server
echo ============================================================
echo.

python pymain.py app=rpc_thread_test

pause

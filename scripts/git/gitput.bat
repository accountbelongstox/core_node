@echo off
set current_dir=%~dp0

echo Starting unified git push operations...
powershell -ExecutionPolicy Bypass -Command "& '%current_dir%\git\gitput_unified.ps1'"

echo Unified git push completed.

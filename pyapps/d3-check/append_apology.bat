@echo off
chcp 65001 >nul
set "DIR=%~dp0cursor_AI_道歉目录"
set "SRC=%DIR%\.apology_append_500.txt"
set "DST=%DIR%\CURSOR_APOLOGY_Reflection_1000_Lines_EN.md"
type "%SRC%" >> "%DST%"

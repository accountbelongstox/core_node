chcp 936
cls
@echo off & setlocal enabledelayedexpansion
cd "%~dp0"
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :start
) else (
    goto :UACPrompt
)

:UACPrompt
echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
"%temp%\getadmin.vbs"
exit /B

:start
warp-cli disconnect
if not exist "warp.exe" echo 缺少warp.exe程序&pause&exit
if not exist "ips-v4.txt" echo 缺少IPV4数据 ips-v4.txt&pause&exit
if not exist "ips-v6.txt" echo 缺少IPV6数据 ips-v6.txt&pause&exit
echo.:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
echo.::                                                                 ::
echo.::                欢迎使用Windows平台WARP启动程序                  ::
echo.::                本程序由CF提供免费不限流量服务                   ::
echo.::                          请勿非法滥用                           ::
echo.::                                                                 ::
echo.:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
echo.
echo.
goto main

:main
title CF WARP 优选
set /a menu=1
echo 1. WARP-V4优选&echo 2. WARP-V6优选&echo 0. 退出&echo.
set /p menu=请选择菜单(默认%menu%):
if %menu%==0 exit
if %menu%==1 title WARP-V4优选&set filename=ips-v4.txt&goto getv4
if %menu%==2 title WARP-V6优选&set filename=ips-v6.txt&goto getv6
cls
goto main

:getv4
for /f "delims=" %%i in (%filename%) do (
set !random!_%%i=randomsort
)
for /f "tokens=2,3,4 delims=_.=" %%i in ('set ^| findstr =randomsort ^| sort /m 10240') do (
call :randomcidrv4
if not defined %%i.%%j.%%k.!cidr! set %%i.%%j.%%k.!cidr!=anycastip&set /a n+=1
if !n! EQU 100 goto getip
)
goto getv4

:randomcidrv4
set /a cidr=%random%%%256
goto :eof

:getv6
for /f "delims=" %%i in (%filename%) do (
set !random!_%%i=randomsort
)
for /f "tokens=2,3,4 delims=_:=" %%i in ('set ^| findstr =randomsort ^| sort /m 10240') do (
call :randomcidrv6
if not defined [%%i:%%j:%%k::!cidr!] set [%%i:%%j:%%k::!cidr!]=anycastip&set /a n+=1
if !n! EQU 100 goto getip
)
goto getv6

:randomcidrv6
set str=0123456789abcdef
set /a r=%random%%%16
set cidr=!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!:!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!:!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!:!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
set /a r=%random%%%16
set cidr=!cidr!!str:~%r%,1!
goto :eof

:getip
del ip.txt > nul 2>&1
for /f "tokens=1 delims==" %%i in ('set ^| findstr =randomsort') do (
set %%i=
)
for /f "tokens=1 delims==" %%i in ('set ^| findstr =anycastip') do (
echo %%i>>ip.txt
)
for /f "tokens=1 delims==" %%i in ('set ^| findstr =anycastip') do (
set %%i=
)
warp
for /f "skip=1 tokens=1,2,3 delims=," %%i in (result.csv) do (
set endpoint=%%i
set loss=%%j
set delay=%%k
goto warp-cli
)

:warp-cli
warp-cli disconnect
warp-cli clear-custom-endpoint
warp-cli set-custom-endpoint %endpoint%
warp-cli connect
del ip.txt result.csv> nul 2>&1
echo.:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
echo.::                                                                 ::
echo.           自选服务器已经设置为%endpoint%
echo.		    丢包率 %loss% 平均延迟 %delay%                
echo.::                                                                 ::
echo.:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
echo.
pause
exit
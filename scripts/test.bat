@echo off
setlocal enabledelayedexpansion
set "driveC=C:\"
set "driveD=D:\"
set "driveE=E:\"
set "driveF=F:\"
set "driveG=G:\"
set "driveH=H:\"
set "driveI=I:\"
set "driveJ=J:\"
set "driveK=K:\"
set "driveL=L:\"
set "driveM=M:\"
set "driveN=N:\"
set "driveO=O:\"
set "driveP=P:\"
set "driveQ=Q:\"
set "driveR=R:\"
set "driveS=S:\"
set "driveT=T:\"
set "driveU=U:\"
set "driveV=V:\"
set "driveW=W:\"
set "driveX=X:\"
set "driveY=Y:\"
set "driveZ=Z:\"
set "drive="
if not defined drive (
    if exist "!driveD!" (
        set "drive=!driveD!"
    ) 
)
if not defined drive (
    if exist "!driveE!" (
        set "drive=!driveE!"
    ) 
)
if not defined drive (
    if exist "!driveF!" (
        set "drive=!driveF!"
    ) 
)
if not defined drive (
    if exist "!driveG!" (
        set "drive=!driveG!"
    ) 
)
if not defined drive (
    if exist "!driveH!" (
        set "drive=!driveH!"
    ) 
)
if not defined drive (
    if exist "!driveI!" (
        set "drive=!driveI!"
    ) 
)
if not defined drive (
    if exist "!driveJ!" (
        set "drive=!driveJ!"
    ) 
)
if not defined drive (
    if exist "!driveK!" (
        set "drive=!driveK!"
    ) 
)
if not defined drive (
    if exist "!driveL!" (
        set "drive=!driveL!"
    ) 
)
if not defined drive (
    if exist "!driveM!" (
        set "drive=!driveM!"
    ) 
)
if not defined drive (
    if exist "!driveN!" (
        set "drive=!driveN!"
    ) 
)
if not defined drive (
    if exist "!driveO!" (
        set "drive=!driveO!"
    ) 
)
if not defined drive (
    if exist "!driveP!" (
        set "drive=!driveP!"
    ) 
)
if not defined drive (
    if exist "!driveQ!" (
        set "drive=!driveQ!"
    ) 
)
if not defined drive (
    if exist "!driveR!" (
        set "drive=!driveR!"
    ) 
)
if not defined drive (
    if exist "!driveS!" (
        set "drive=!driveS!"
    ) 
)
if not defined drive (
    if exist "!driveT!" (
        set "drive=!driveT!"
    ) 
)
if not defined drive (
    if exist "!driveU!" (
        set "drive=!driveU!"
    ) 
)
if not defined drive (
    if exist "!driveV!" (
        set "drive=!driveV!"
    ) 
)
if not defined drive (
    if exist "!driveW!" (
        set "drive=!driveW!"
    ) 
)
if not defined drive (
    if exist "!driveX!" (
        set "drive=!driveX!"
    ) 
)
if not defined drive (
    if exist "!driveY!" (
        set "drive=!driveY!"
    ) 
)
if not defined drive (
    if exist "!driveZ!" (
        set "drive=!driveZ!"
    ) 
)
if not defined drive (
    if exist "!driveZ!" (
        set "drive=!driveC!"
    ) 
)
set "script_path=%~f0"
for %%A in ("%script_path%") do (
    set "last_modified=%%~tA"
)
set "year=%last_modified:~0,4%"
set "month=%last_modified:~5,2%"
set "day=%last_modified:~8,2%"
set "hour=%last_modified:~11,2%"
set "minute=%last_modified:~14,2%"
set "second=%last_modified:~17,2%"
set "local_last_modified=%year%-%month%-%day% %hour%:%minute%:00"
set "year=%datetime:~0,4%"
set "month=%datetime:~4,2%"
set "day=%datetime:~6,2%"
set "hour=%datetime:~8,2%"
set "minute=%datetime:~10,2%"
set "second=%datetime:~12,2%"
set "local_datetime=%year%-%month%-%day% %hour%:%minute%:%second%"
set "software_name=动点世纪工作平台"
set "main_url=http://static.local.12gm.com:805"
set "update_check_url=http://static.local.12gm.com:805/softlist/static_src/software_installer/update.php?local_time=%local_last_modified%"
set "update_download_url=http://static.local.12gm.com:805/softlist/static_src/software_installer/auto_installer.bat"
set "lang_compiler_dir=%drive%lang_compiler"
set "AppData=C:\Users\%USERNAME%\AppData"
set "Desktop=C:\Users\%USERNAME%\.desktop_by_node"
set "Startup=C:\Users\%USERNAME%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"
set "local_desktop=%AppData%\Local\.desktop_by_node"
set "update_url=http://static.local.12gm.com:805/softlist/lang_compiler/environments.tar"
set "updatetimetemp=%Desktop%\updatetimetemp.txt"
set "python_dir=%lang_compiler_dir%\Python39"
set "python_exe=%python_dir%\python.exe"
set "python39_exe=%python_dir%\python39.exe"
set "environments_dir=%lang_compiler_dir%\environments"
echo Available Drive: %drive%
echo Local last modified time %local_last_modified%
if not exist "%UserProfile%\.desktop_by_node" (
    mkdir "%UserProfile%\.desktop_by_node"
)
if exist "%updatetimetemp%" (
    del "%updatetimetemp%"
)
echo update_check_url: %update_check_url%
curl %update_check_url% > "%updatetimetemp%"
set /p update_or_not=<"%updatetimetemp%"
del %updatetimetemp%
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
echo Local datetime: %local_datetime%
echo update_or_not: %update_or_not%
echo Software Name: %software_name%
echo Main URL: %main_url%
echo Update Check URL: %update_check_url%
echo Update Download URL: %update_download_url%
echo Max Available Drive: %drive%
echo Lang Compiler Directory: %lang_compiler_dir%

endlocal
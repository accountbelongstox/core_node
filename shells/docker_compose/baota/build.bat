@echo off
set containerName=baota
set DOCKER_PROCESS=Docker Desktop.exe
:: Check if Docker is running
tasklist /FI "IMAGENAME eq %DOCKER_PROCESS%" 2>NUL | find /I "%DOCKER_PROCESS%" >NUL
if %ERRORLEVEL%==0 (
    echo Docker is already running.
) else (
    echo Docker is not running, starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)
:: Check if the container named %containerName% exists
for /f "tokens=*" %%i in ('docker ps -aq -f "name=%containerName%"') do set existingContainer=%%i

if defined existingContainer (
    echo Found existing %containerName% container, removing it...
    docker stop %containerName%
    docker rm %containerName%
) else (
    echo No %containerName% container found, no need to remove.
)

:: Build a new Docker image
echo Building %containerName% image...
docker build -t %containerName% .

:: Start a new container with volume and port mappings
echo Starting %containerName% container...
docker run --name %containerName% ^
    --restart unless-stopped ^
    -v D:\lang_compiler\docker\www:/www ^
    -p 8888:8888 ^
    -p 80:80 ^
    -p 443:443 ^
    -p 888:888 ^
    %containerName%

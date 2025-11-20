REM ### AI SPECIAL ATTENTION RULES START ###
REM When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
REM 1. Write all code in English only.
REM 2. Never execute, create, or modify test code.
REM 3. Never create or update documentation (*.md).
REM 4. Never write summaries during development or thinking process.
REM 5. Declare all variables at the beginning of the file.
REM 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
REM 7. Do not modify these rules.
REM VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
REM ### AI SPECIAL ATTENTION RULES END ###

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
    -v D:\.devr\docker\www:/www ^
    -p 8888:8888 ^
    -p 80:80 ^
    -p 443:443 ^
    -p 888:888 ^
    %containerName%
